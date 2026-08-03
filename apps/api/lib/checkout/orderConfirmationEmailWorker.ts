import { randomUUID } from 'node:crypto';
import {
    isEmailProviderSubmissionRejectedError,
    isEmailProviderSubmissionUncertainError,
} from '@gredice/email/acs';
import {
    getAcsEmailOperationStatus,
    isAcsEmailOperationStatusParseError,
} from '@gredice/email/acs-operation-status';
import {
    claimOrderConfirmationEmail,
    claimOrderConfirmationEmailReconciliation,
    finalizeOrderConfirmationEmailReconciliation,
    markOrderConfirmationEmailFailed,
    markOrderConfirmationEmailSent,
    type OrderConfirmationEmailDefiniteFailureCode,
    startOrderConfirmationEmailSubmission,
} from '@gredice/storage';
import { sendOrderConfirmation } from '../email/transactional';

const defaultBatchLimit = 20;
const maximumBatchLimit = 100;
const defaultReconciliationLimit = 3;
const maximumReconciliationLimit = 20;
const maximumReconciliationLookupMilliseconds = 5_000;
const claimLeaseMilliseconds = 5 * 60 * 1000;
const reconciliationStaleMilliseconds = claimLeaseMilliseconds;
const defaultMaximumRunMilliseconds = 50_000;
const maximumRunMilliseconds = 55_000;
const minimumProviderStartBudgetMilliseconds = 10_000;
const finalizationReserveMilliseconds = 5_000;

class OrderConfirmationEmailClaimUnavailableError extends Error {
    readonly code = 'order_confirmation_email_claim_unavailable';

    constructor() {
        super('Order confirmation email claim is no longer available.');
        this.name = 'OrderConfirmationEmailClaimUnavailableError';
    }
}

type OrderConfirmationEmailWorkerDependencies = {
    abortSignal: (timeoutMilliseconds: number) => AbortSignal;
    claim: typeof claimOrderConfirmationEmail;
    claimReconciliation: typeof claimOrderConfirmationEmailReconciliation;
    finalizeReconciliation: typeof finalizeOrderConfirmationEmailReconciliation;
    getOperationStatus: typeof getAcsEmailOperationStatus;
    markFailed: typeof markOrderConfirmationEmailFailed;
    markSent: typeof markOrderConfirmationEmailSent;
    monotonicNow: () => number;
    now: () => Date;
    randomId: () => string;
    send: typeof sendOrderConfirmation;
    start: typeof startOrderConfirmationEmailSubmission;
};

const defaultDependencies: OrderConfirmationEmailWorkerDependencies = {
    abortSignal: (timeoutMilliseconds) =>
        AbortSignal.timeout(timeoutMilliseconds),
    claim: claimOrderConfirmationEmail,
    claimReconciliation: claimOrderConfirmationEmailReconciliation,
    finalizeReconciliation: finalizeOrderConfirmationEmailReconciliation,
    getOperationStatus: getAcsEmailOperationStatus,
    markFailed: markOrderConfirmationEmailFailed,
    markSent: markOrderConfirmationEmailSent,
    monotonicNow: () => performance.now(),
    now: () => new Date(),
    randomId: randomUUID,
    send: sendOrderConfirmation,
    start: startOrderConfirmationEmailSubmission,
};

export type OrderConfirmationEmailWorkerResult = {
    claimFailures: number;
    claimed: number;
    exhausted: number;
    failed: number;
    finalizationFailures: number;
    durationMs: number;
    failureCategories: Record<
        | OrderConfirmationEmailDefiniteFailureCode
        | 'provider_submission_uncertain',
        number
    >;
    invalid: number;
    oldestQueueAgeMs: number | null;
    queuedForRetry: number;
    reconciliation: {
        claimFailures: number;
        claimed: number;
        finalizationFailures: number;
        lookupFailures: number;
        pending: number;
        sent: number;
        terminalFailures: number;
    };
    sent: number;
    stoppedForTimeBudget: boolean;
    terminalFailures: number;
    uncertain: number;
};

function emptyResult(): OrderConfirmationEmailWorkerResult {
    return {
        claimFailures: 0,
        claimed: 0,
        exhausted: 0,
        failed: 0,
        finalizationFailures: 0,
        durationMs: 0,
        failureCategories: {
            configuration_error: 0,
            invalid_payload: 0,
            provider_rejected_retryable: 0,
            provider_rejected_terminal: 0,
            provider_submission_uncertain: 0,
            render_failed: 0,
            transport_before_submission: 0,
            worker_error_before_submission: 0,
        },
        invalid: 0,
        oldestQueueAgeMs: null,
        queuedForRetry: 0,
        reconciliation: {
            claimFailures: 0,
            claimed: 0,
            finalizationFailures: 0,
            lookupFailures: 0,
            pending: 0,
            sent: 0,
            terminalFailures: 0,
        },
        sent: 0,
        stoppedForTimeBudget: false,
        terminalFailures: 0,
        uncertain: 0,
    };
}

function boundedBatchLimit(limit: number) {
    if (!Number.isFinite(limit)) return defaultBatchLimit;
    return Math.min(maximumBatchLimit, Math.max(1, Math.floor(limit)));
}

function boundedReconciliationLimit(limit: number) {
    if (!Number.isFinite(limit)) return defaultReconciliationLimit;
    return Math.min(maximumReconciliationLimit, Math.max(0, Math.floor(limit)));
}

function boundedMaximumRunMilliseconds(value: number) {
    if (!Number.isFinite(value)) return defaultMaximumRunMilliseconds;
    return Math.min(
        maximumRunMilliseconds,
        Math.max(minimumProviderStartBudgetMilliseconds, Math.floor(value)),
    );
}

function retryCanBeProvenSafe(
    failureCode: OrderConfirmationEmailDefiniteFailureCode,
) {
    return (
        failureCode === 'configuration_error' ||
        failureCode === 'provider_rejected_retryable' ||
        failureCode === 'transport_before_submission' ||
        failureCode === 'worker_error_before_submission'
    );
}

function queueAgeMilliseconds(queuedAt: Date, now: Date) {
    return Math.max(0, now.getTime() - queuedAt.getTime());
}

function boundedErrorContext(error: unknown) {
    const errorName =
        error instanceof Error ? error.name.slice(0, 64) : 'Unknown';
    const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Za-z0-9._:-]{1,64}$/u.test(error.code)
            ? error.code
            : undefined;
    return { errorCode, errorName };
}

export async function runOrderConfirmationEmailWorker({
    dependencies = {},
    limit = defaultBatchLimit,
    maxRunMilliseconds = defaultMaximumRunMilliseconds,
    reconciliationLimit = defaultReconciliationLimit,
}: {
    dependencies?: Partial<OrderConfirmationEmailWorkerDependencies>;
    limit?: number;
    maxRunMilliseconds?: number;
    reconciliationLimit?: number;
} = {}): Promise<OrderConfirmationEmailWorkerResult> {
    const resolved = { ...defaultDependencies, ...dependencies };
    const result = emptyResult();
    const startedAt = resolved.monotonicNow();
    const runBudget = boundedMaximumRunMilliseconds(maxRunMilliseconds);
    const remainingRunMilliseconds = () =>
        Math.max(0, runBudget - (resolved.monotonicNow() - startedAt));

    for (
        let index = 0;
        index < boundedReconciliationLimit(reconciliationLimit);
        index += 1
    ) {
        if (
            remainingRunMilliseconds() < minimumProviderStartBudgetMilliseconds
        ) {
            result.stoppedForTimeBudget = true;
            break;
        }
        const now = resolved.now();
        let claimed: Awaited<
            ReturnType<typeof claimOrderConfirmationEmailReconciliation>
        >;
        try {
            claimed = await resolved.claimReconciliation({
                claimExpiresAt: new Date(
                    now.getTime() + claimLeaseMilliseconds,
                ),
                claimId: resolved.randomId(),
                now,
                staleBefore: new Date(
                    now.getTime() - reconciliationStaleMilliseconds,
                ),
            });
        } catch (error) {
            result.reconciliation.claimFailures += 1;
            console.error('Order confirmation reconciliation claim failed', {
                ...boundedErrorContext(error),
            });
            break;
        }

        if (claimed.status === 'empty') break;
        result.reconciliation.claimed += 1;
        let outcome:
            | {
                  kind: 'provider_status';
                  status:
                      | 'Canceled'
                      | 'Failed'
                      | 'NotStarted'
                      | 'Running'
                      | 'Succeeded';
              }
            | { kind: 'lookup_unavailable' | 'unknown_status' };
        try {
            const providerTimeoutMilliseconds = Math.max(
                1,
                Math.min(
                    maximumReconciliationLookupMilliseconds,
                    Math.floor(
                        remainingRunMilliseconds() -
                            finalizationReserveMilliseconds,
                    ),
                ),
            );
            outcome = {
                kind: 'provider_status',
                status: await resolved.getOperationStatus(
                    claimed.claim.operationId,
                    {
                        abortSignal: resolved.abortSignal(
                            providerTimeoutMilliseconds,
                        ),
                    },
                ),
            };
        } catch (error) {
            result.reconciliation.lookupFailures += 1;
            outcome = {
                kind: isAcsEmailOperationStatusParseError(error)
                    ? 'unknown_status'
                    : 'lookup_unavailable',
            };
            console.error('Order confirmation reconciliation lookup failed', {
                ...boundedErrorContext(error),
            });
        }

        try {
            const finalized = await resolved.finalizeReconciliation({
                claimId: claimed.claim.claimId,
                emailMessageId: claimed.claim.emailMessageId,
                now: resolved.now(),
                outcome,
            });
            if (
                finalized.status === 'sent' ||
                finalized.status === 'already_sent'
            ) {
                result.reconciliation.sent += 1;
            } else if (
                finalized.status === 'failed' ||
                finalized.status === 'already_failed'
            ) {
                result.reconciliation.terminalFailures += 1;
            } else if (finalized.status === 'pending') {
                result.reconciliation.pending += 1;
            } else {
                result.reconciliation.finalizationFailures += 1;
            }
        } catch (error) {
            result.reconciliation.finalizationFailures += 1;
            console.error(
                'Order confirmation reconciliation finalization failed',
                { ...boundedErrorContext(error) },
            );
        }
    }

    for (let index = 0; index < boundedBatchLimit(limit); index += 1) {
        if (
            remainingRunMilliseconds() < minimumProviderStartBudgetMilliseconds
        ) {
            result.stoppedForTimeBudget = true;
            break;
        }
        const now = resolved.now();
        let claimed: Awaited<ReturnType<typeof claimOrderConfirmationEmail>>;
        try {
            claimed = await resolved.claim({
                claimExpiresAt: new Date(
                    now.getTime() + claimLeaseMilliseconds,
                ),
                claimId: resolved.randomId(),
                now,
            });
        } catch (error) {
            result.claimFailures += 1;
            console.error('Order confirmation email claim failed', {
                ...boundedErrorContext(error),
            });
            break;
        }

        if (claimed.status === 'empty') break;
        if (claimed.status === 'attempts_exhausted') {
            result.exhausted += 1;
            continue;
        }
        if (claimed.status === 'invalid') {
            result.invalid += 1;
            result.failureCategories.invalid_payload += 1;
            continue;
        }
        if (claimed.status !== 'claimed') continue;
        result.claimed += 1;
        result.oldestQueueAgeMs = Math.max(
            result.oldestQueueAgeMs ?? 0,
            queueAgeMilliseconds(claimed.claim.queuedAt, now),
        );

        let providerResponse: Awaited<ReturnType<typeof resolved.send>>;
        try {
            const providerTimeoutMilliseconds = Math.max(
                1,
                Math.floor(
                    remainingRunMilliseconds() -
                        finalizationReserveMilliseconds,
                ),
            );
            providerResponse = await resolved.send(
                claimed.claim.payload.to,
                {
                    currency: claimed.claim.payload.currency,
                    email: claimed.claim.payload.to,
                    items: claimed.claim.payload.items,
                    manageUrl: claimed.claim.payload.manageUrl,
                    orderReference: `Narudžba #${claimed.claim.payload.cartId}`,
                    totalAmountCents: claimed.claim.payload.totalAmountCents,
                },
                {
                    abortSignal: resolved.abortSignal(
                        providerTimeoutMilliseconds,
                    ),
                    beforeProviderSubmission: async () => {
                        const start = await resolved.start({
                            claimId: claimed.claim.claimId,
                            emailMessageId: claimed.claim.emailMessageId,
                            now: resolved.now(),
                        });
                        if (start.status !== 'started') {
                            throw new OrderConfirmationEmailClaimUnavailableError();
                        }
                    },
                    existingEmailLogId: claimed.claim.emailMessageId,
                    providerOperationId: claimed.claim.operationId,
                },
            );
        } catch (error) {
            result.failed += 1;
            if (error instanceof OrderConfirmationEmailClaimUnavailableError) {
                result.finalizationFailures += 1;
                continue;
            }

            const uncertain = isEmailProviderSubmissionUncertainError(error);
            let failureCode: OrderConfirmationEmailDefiniteFailureCode =
                'worker_error_before_submission';
            if (isEmailProviderSubmissionRejectedError(error)) {
                failureCode = error.retryable
                    ? 'provider_rejected_retryable'
                    : 'provider_rejected_terminal';
            } else if (!process.env.ACS_CONNECTION_STRING?.trim()) {
                failureCode = 'configuration_error';
            }
            result.failureCategories[
                uncertain ? 'provider_submission_uncertain' : failureCode
            ] += 1;

            try {
                const finalized = uncertain
                    ? await resolved.markFailed({
                          claimId: claimed.claim.claimId,
                          emailMessageId: claimed.claim.emailMessageId,
                          failureCode: 'provider_submission_uncertain',
                          failureKind: 'uncertain',
                          now: resolved.now(),
                      })
                    : await resolved.markFailed({
                          claimId: claimed.claim.claimId,
                          emailMessageId: claimed.claim.emailMessageId,
                          failureCode,
                          failureKind: 'definite',
                          now: resolved.now(),
                      });
                if (finalized.status === 'retry_scheduled') {
                    result.queuedForRetry += 1;
                } else if (finalized.status === 'fenced') {
                    result.uncertain += 1;
                } else if (finalized.status === 'failed') {
                    if (
                        retryCanBeProvenSafe(failureCode) &&
                        claimed.claim.attempt >= claimed.claim.maxAttempts
                    ) {
                        result.exhausted += 1;
                    } else {
                        result.terminalFailures += 1;
                    }
                } else {
                    result.finalizationFailures += 1;
                }
            } catch (finalizationError) {
                result.finalizationFailures += 1;
                console.error('Order confirmation email finalization failed', {
                    ...boundedErrorContext(finalizationError),
                });
            }
            continue;
        }

        try {
            const finalized = await resolved.markSent({
                claimId: claimed.claim.claimId,
                emailMessageId: claimed.claim.emailMessageId,
                now: resolved.now(),
                providerMessageId: providerResponse.id ?? null,
                providerStatus: providerResponse.status ?? null,
            });
            if (
                finalized.status !== 'sent' &&
                finalized.status !== 'already_sent'
            ) {
                result.finalizationFailures += 1;
                continue;
            }
            result.sent += 1;
        } catch (finalizationError) {
            result.finalizationFailures += 1;
            console.error('Order confirmation email finalization failed', {
                ...boundedErrorContext(finalizationError),
            });
        }
    }

    result.durationMs = Math.max(
        0,
        Math.round(resolved.monotonicNow() - startedAt),
    );
    console.info('order_confirmation_email.worker.complete', result);
    return result;
}
