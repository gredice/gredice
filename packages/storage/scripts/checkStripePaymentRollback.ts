import { getStripePaymentCompletionRollbackPreflight } from '../src/repositories/stripePaymentCompletionOutputsRepo';

const preflight = await getStripePaymentCompletionRollbackPreflight();
console.log(JSON.stringify(preflight, null, 2));
if (!preflight.safeToRollback) {
    process.exitCode = 2;
}
