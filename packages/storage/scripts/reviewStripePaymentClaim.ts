import {
    getStripePaymentProcessingClaim,
    requeueStripePaymentProcessingClaim,
    resolveStripePaymentProcessingClaim,
} from '../src/repositories/transactionsRepo';

const args = process.argv.slice(2);
const action = args[0];

function readRequiredArgument(name: string) {
    const prefix = `--${name}=`;
    const value = args
        .find((arg) => arg.startsWith(prefix))
        ?.slice(prefix.length);
    if (!value?.trim()) {
        throw new Error(`Missing required ${prefix}<value> argument`);
    }
    return value;
}

if (action !== 'requeue' && action !== 'resolve') {
    throw new Error('First argument must be requeue or resolve');
}

const stripePaymentId = readRequiredArgument('stripe-payment-id');
const reviewedBy = readRequiredArgument('reviewed-by');
const reason = readRequiredArgument('reason');
const apply = args.includes('--apply');

if (!apply) {
    const claim = await getStripePaymentProcessingClaim(stripePaymentId);
    console.log(
        JSON.stringify(
            {
                action,
                apply: false,
                claim: claim
                    ? {
                          attemptCount: claim.attemptCount,
                          completedTransactionId: claim.completedTransactionId,
                          manualReviewReason: claim.manualReviewReason,
                          status: claim.status,
                          stripePaymentId: claim.stripePaymentId,
                      }
                    : null,
                reason,
                reviewedBy,
            },
            null,
            2,
        ),
    );
    process.exitCode = claim?.status === 'manual_review' ? 0 : 2;
} else {
    const result =
        action === 'requeue'
            ? await requeueStripePaymentProcessingClaim({
                  reason,
                  reviewedBy,
                  stripePaymentId,
              })
            : await resolveStripePaymentProcessingClaim({
                  reason,
                  reviewedBy,
                  stripePaymentId,
              });
    console.log(JSON.stringify({ action, apply: true, result }, null, 2));
    if (
        result.status !== 'requeued' &&
        result.status !== 'resolved_completed'
    ) {
        process.exitCode = 2;
    }
}
