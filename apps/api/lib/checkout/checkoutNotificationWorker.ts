import { randomUUID } from 'node:crypto';
import {
    isEmailProviderSubmissionRejectedError,
    isEmailProviderSubmissionUncertainError,
    isEmailProviderTerminalFailureError,
} from '@gredice/email/acs';
import {
    deliverDeliveryRequestSlackNotification,
    deliverOperationSlackNotification,
} from '@gredice/notifications';
import {
    buildDeliveryEmailDetails,
    claimCheckoutNotification,
    markCheckoutNotificationFailed,
    markCheckoutNotificationSent,
    markCheckoutNotificationSkipped,
    startCheckoutNotificationSubmission,
} from '@gredice/storage';
import { sendDeliveryScheduled } from '../email/transactional';

const defaultLimit = 20;
const maximumLimit = 100;
const defaultMaximumRunMilliseconds = 50_000;
const maximumRunMilliseconds = 55_000;
const minimumProviderStartBudgetMilliseconds = 10_000;
const finalizationReserveMilliseconds = 5_000;
const claimLeaseMilliseconds = 5 * 60_000;
const customerAppUrl =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

class CheckoutNotificationClaimUnavailableError extends Error {
    constructor() {
        super('Checkout notification claim is no longer available.');
        this.name = 'CheckoutNotificationClaimUnavailableError';
    }
}

type WorkerDependencies = {
    abortSignal: (timeoutMilliseconds: number) => AbortSignal;
    buildDeliveryEmailDetails: typeof buildDeliveryEmailDetails;
    claim: typeof claimCheckoutNotification;
    markFailed: typeof markCheckoutNotificationFailed;
    markSent: typeof markCheckoutNotificationSent;
    markSkipped: typeof markCheckoutNotificationSkipped;
    monotonicNow: () => number;
    notifyDelivery: typeof deliverDeliveryRequestSlackNotification;
    notifyOperation: typeof deliverOperationSlackNotification;
    now: () => Date;
    randomId: () => string;
    sendDeliveryEmail: typeof sendDeliveryScheduled;
    start: typeof startCheckoutNotificationSubmission;
};

const defaultDependencies: WorkerDependencies = {
    abortSignal: (timeoutMilliseconds) =>
        AbortSignal.timeout(timeoutMilliseconds),
    buildDeliveryEmailDetails,
    claim: claimCheckoutNotification,
    markFailed: markCheckoutNotificationFailed,
    markSent: markCheckoutNotificationSent,
    markSkipped: markCheckoutNotificationSkipped,
    monotonicNow: () => performance.now(),
    notifyDelivery: deliverDeliveryRequestSlackNotification,
    notifyOperation: deliverOperationSlackNotification,
    now: () => new Date(),
    randomId: randomUUID,
    sendDeliveryEmail: sendDeliveryScheduled,
    start: startCheckoutNotificationSubmission,
};

export type CheckoutNotificationWorkerResult = {
    claimFailures: number;
    claimed: number;
    durationMs: number;
    exhausted: number;
    failed: number;
    finalizationFailures: number;
    invalid: number;
    oldestQueueAgeMs: number | null;
    queuedForRetry: number;
    sent: number;
    skipped: number;
    stoppedForTimeBudget: boolean;
    terminalFailures: number;
    uncertain: number;
};

function emptyResult(): CheckoutNotificationWorkerResult {
    return {
        claimFailures: 0,
        claimed: 0,
        durationMs: 0,
        exhausted: 0,
        failed: 0,
        finalizationFailures: 0,
        invalid: 0,
        oldestQueueAgeMs: null,
        queuedForRetry: 0,
        sent: 0,
        skipped: 0,
        stoppedForTimeBudget: false,
        terminalFailures: 0,
        uncertain: 0,
    };
}

function boundedLimit(value: number) {
    if (!Number.isFinite(value)) return defaultLimit;
    return Math.min(maximumLimit, Math.max(1, Math.floor(value)));
}

function boundedRunMilliseconds(value: number) {
    if (!Number.isFinite(value)) return defaultMaximumRunMilliseconds;
    return Math.min(
        maximumRunMilliseconds,
        Math.max(minimumProviderStartBudgetMilliseconds, Math.floor(value)),
    );
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

function slackDeliveryId(response: unknown) {
    if (
        typeof response !== 'object' ||
        response === null ||
        !('ts' in response)
    ) {
        return null;
    }
    const timestamp = response.ts;
    return typeof timestamp === 'string' ? timestamp.slice(0, 128) : null;
}

export async function runCheckoutNotificationWorker({
    dependencies = {},
    limit = defaultLimit,
    maxRunMilliseconds = defaultMaximumRunMilliseconds,
}: {
    dependencies?: Partial<WorkerDependencies>;
    limit?: number;
    maxRunMilliseconds?: number;
} = {}): Promise<CheckoutNotificationWorkerResult> {
    const resolved = { ...defaultDependencies, ...dependencies };
    const result = emptyResult();
    const startedAt = resolved.monotonicNow();
    const runBudget = boundedRunMilliseconds(maxRunMilliseconds);
    const remaining = () =>
        Math.max(0, runBudget - (resolved.monotonicNow() - startedAt));

    for (let index = 0; index < boundedLimit(limit); index += 1) {
        if (remaining() < minimumProviderStartBudgetMilliseconds) {
            result.stoppedForTimeBudget = true;
            break;
        }
        const now = resolved.now();
        let claimed: Awaited<ReturnType<typeof claimCheckoutNotification>>;
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
            console.error('Checkout notification claim failed', {
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
            continue;
        }
        if (claimed.status !== 'claimed') continue;

        result.claimed += 1;
        result.oldestQueueAgeMs = Math.max(
            result.oldestQueueAgeMs ?? 0,
            Math.max(0, now.getTime() - claimed.claim.queuedAt.getTime()),
        );
        let submissionStarted = false;
        const beforeProviderSubmission = async () => {
            const started = await resolved.start({
                claimId: claimed.claim.claimId,
                emailMessageId: claimed.claim.emailMessageId,
                now: resolved.now(),
            });
            if (started.status !== 'started') {
                throw new CheckoutNotificationClaimUnavailableError();
            }
            submissionStarted = true;
        };
        const abortSignal = resolved.abortSignal(
            Math.max(
                1,
                Math.floor(remaining() - finalizationReserveMilliseconds),
            ),
        );

        try {
            if (claimed.claim.payload.kind === 'delivery_scheduled_email') {
                const details = await resolved.buildDeliveryEmailDetails(
                    claimed.claim.payload.requestId,
                );
                if (!details) {
                    const skipped = await resolved.markSkipped({
                        claimId: claimed.claim.claimId,
                        emailMessageId: claimed.claim.emailMessageId,
                        now: resolved.now(),
                        reason: 'ineligible',
                    });
                    if (skipped.status === 'skipped') result.skipped += 1;
                    else result.finalizationFailures += 1;
                    continue;
                }
                const response = await resolved.sendDeliveryEmail(
                    claimed.claim.payload.to,
                    {
                        addressLine: details.addressLine,
                        contactName: details.contactName,
                        deliveryWindow: details.deliveryWindow,
                        email: claimed.claim.payload.to,
                        manageUrl: customerAppUrl,
                    },
                    {
                        abortSignal,
                        beforeProviderSubmission,
                        existingEmailLogId: claimed.claim.emailMessageId,
                        providerOperationId: claimed.claim.providerOperationId,
                    },
                );
                const finalized = await resolved.markSent({
                    claimId: claimed.claim.claimId,
                    emailMessageId: claimed.claim.emailMessageId,
                    now: resolved.now(),
                    providerDeliveryId: response.id ?? null,
                    providerStatus: response.status ?? null,
                });
                if (
                    finalized.status === 'sent' ||
                    finalized.status === 'already_sent'
                ) {
                    result.sent += 1;
                } else {
                    result.finalizationFailures += 1;
                }
                continue;
            }

            const deliveryOptions = { abortSignal, beforeProviderSubmission };
            const response =
                claimed.claim.payload.kind === 'operation_scheduled_slack'
                    ? await resolved.notifyOperation(
                          claimed.claim.payload.operationId,
                          'scheduled',
                          {
                              scheduledDate:
                                  claimed.claim.payload.scheduledDate,
                          },
                          deliveryOptions,
                      )
                    : await resolved.notifyDelivery(
                          claimed.claim.payload.requestId,
                          'created',
                          {},
                          deliveryOptions,
                      );
            if (!response || response.skipped === 'missing_channel') {
                const skipped = await resolved.markSkipped({
                    claimId: claimed.claim.claimId,
                    emailMessageId: claimed.claim.emailMessageId,
                    now: resolved.now(),
                    reason: 'missing_destination',
                });
                if (skipped.status === 'skipped') result.skipped += 1;
                else result.finalizationFailures += 1;
                continue;
            }
            if (response.skipped === 'missing_token') {
                const deferred = await resolved.markFailed({
                    claimId: claimed.claim.claimId,
                    emailMessageId: claimed.claim.emailMessageId,
                    failureCode: 'configuration_error',
                    failureKind: 'configuration',
                    now: resolved.now(),
                });
                if (deferred.status === 'retry_scheduled') {
                    result.queuedForRetry += 1;
                } else {
                    result.finalizationFailures += 1;
                }
                continue;
            }
            if (response.outcome === 'uncertain') {
                const fenced = await resolved.markFailed({
                    claimId: claimed.claim.claimId,
                    emailMessageId: claimed.claim.emailMessageId,
                    failureCode: 'provider_submission_uncertain',
                    failureKind: 'uncertain',
                    now: resolved.now(),
                });
                if (fenced.status === 'fenced') result.uncertain += 1;
                else result.finalizationFailures += 1;
                continue;
            }
            if (!response.ok) {
                const retryable =
                    response.status === 429 ||
                    (response.status !== undefined && response.status >= 500);
                const failed = await resolved.markFailed({
                    claimId: claimed.claim.claimId,
                    emailMessageId: claimed.claim.emailMessageId,
                    failureCode: retryable
                        ? 'provider_rejected_retryable'
                        : 'provider_rejected_terminal',
                    failureKind: retryable ? 'retryable' : 'terminal',
                    now: resolved.now(),
                });
                if (failed.status === 'retry_scheduled') {
                    result.queuedForRetry += 1;
                } else if (failed.status === 'failed') {
                    if (retryable) result.exhausted += 1;
                    else result.terminalFailures += 1;
                } else {
                    result.finalizationFailures += 1;
                }
                continue;
            }
            const finalized = await resolved.markSent({
                claimId: claimed.claim.claimId,
                emailMessageId: claimed.claim.emailMessageId,
                now: resolved.now(),
                providerDeliveryId: slackDeliveryId(response.response),
                providerStatus: 'accepted',
            });
            if (
                finalized.status === 'sent' ||
                finalized.status === 'already_sent'
            ) {
                result.sent += 1;
            } else {
                result.finalizationFailures += 1;
            }
        } catch (error) {
            result.failed += 1;
            if (error instanceof CheckoutNotificationClaimUnavailableError) {
                result.finalizationFailures += 1;
                continue;
            }
            const uncertain = isEmailProviderSubmissionUncertainError(error);
            let failureCode:
                | 'configuration_error'
                | 'provider_rejected_retryable'
                | 'provider_rejected_terminal'
                | 'provider_submission_uncertain'
                | 'worker_error_before_submission' = submissionStarted
                ? 'provider_submission_uncertain'
                : 'worker_error_before_submission';
            let failureKind:
                | 'configuration'
                | 'retryable'
                | 'terminal'
                | 'uncertain' = submissionStarted ? 'uncertain' : 'retryable';
            if (uncertain) {
                failureCode = 'provider_submission_uncertain';
                failureKind = 'uncertain';
            } else if (isEmailProviderTerminalFailureError(error)) {
                failureCode = 'provider_rejected_terminal';
                failureKind = 'terminal';
            } else if (isEmailProviderSubmissionRejectedError(error)) {
                failureCode = error.retryable
                    ? 'provider_rejected_retryable'
                    : 'provider_rejected_terminal';
                failureKind = error.retryable ? 'retryable' : 'terminal';
            } else if (
                !submissionStarted &&
                claimed.claim.payload.kind === 'delivery_scheduled_email' &&
                !process.env.ACS_CONNECTION_STRING?.trim()
            ) {
                failureCode = 'configuration_error';
                failureKind = 'configuration';
            }
            try {
                const finalized = await resolved.markFailed({
                    claimId: claimed.claim.claimId,
                    emailMessageId: claimed.claim.emailMessageId,
                    failureCode,
                    failureKind,
                    now: resolved.now(),
                });
                if (finalized.status === 'retry_scheduled') {
                    result.queuedForRetry += 1;
                } else if (finalized.status === 'fenced') {
                    result.uncertain += 1;
                } else if (finalized.status === 'failed') {
                    if (failureKind === 'retryable') result.exhausted += 1;
                    else result.terminalFailures += 1;
                } else {
                    result.finalizationFailures += 1;
                }
            } catch (finalizationError) {
                result.finalizationFailures += 1;
                console.error('Checkout notification finalization failed', {
                    ...boundedErrorContext(finalizationError),
                });
            }
        }
    }

    result.durationMs = Math.max(
        0,
        Math.round(resolved.monotonicNow() - startedAt),
    );
    console.info('checkout_notification.worker.complete', result);
    return result;
}
