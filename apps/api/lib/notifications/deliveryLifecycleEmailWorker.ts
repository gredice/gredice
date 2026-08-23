import { createHash } from 'node:crypto';
import {
    isEmailProviderSubmissionRejectedError,
    isEmailProviderSubmissionUncertainError,
} from '@gredice/email/acs';
import {
    buildCustomerDeliveryTrackerLink,
    type CustomerDeliveryNotificationEvent,
    customerDeliveryNotificationCatalog,
    type DeliveryLifecycleMilestone,
} from '@gredice/notifications/customer-delivery';
import {
    claimDeliveryLifecycleEmailCandidate,
    type DeliveryLifecycleEmailCandidate,
    type DeliveryLifecycleEmailClaim,
    type DeliveryLifecycleEmailClaimResult,
    type DeliveryRunExceptionOutcome,
    DeliveryRunExceptionOutcomes,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
    dropDeliveryLifecycleEmailAttempt,
    getDeliveryLifecycleEmailCandidates,
    markDeliveryLifecycleEmailAttemptFailed,
    markDeliveryLifecycleEmailAttemptSent,
    startDeliveryLifecycleEmailAttempt,
} from '@gredice/storage';
import { sendDeliveryLifecycleUpdate } from '../email/transactional';

const defaultBatchLimit = 50;
const opaqueIdentifierMaxLength = 128;
const opaqueIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/u;

type DeliveryLifecycleEmailWorkerDependencies = {
    claim: (
        candidate: DeliveryLifecycleEmailCandidate & { now?: Date },
    ) => Promise<DeliveryLifecycleEmailClaimResult>;
    clock: () => Date;
    drop: typeof dropDeliveryLifecycleEmailAttempt;
    listCandidates: typeof getDeliveryLifecycleEmailCandidates;
    markFailed: typeof markDeliveryLifecycleEmailAttemptFailed;
    markSent: typeof markDeliveryLifecycleEmailAttemptSent;
    send: (
        to: string,
        config: Parameters<typeof sendDeliveryLifecycleUpdate>[1],
        options: { providerOperationId: string },
    ) => Promise<unknown>;
    start: typeof startDeliveryLifecycleEmailAttempt;
};

export type DeliveryLifecycleEmailWorkerResult = {
    candidates: number;
    claimFailures: number;
    claimed: number;
    deferred: number;
    enabled: boolean;
    failed: number;
    finalizationFailures: number;
    invalidPayloads: number;
    sent: number;
    skipped: number;
    unavailable: number;
};

const defaultDependencies: DeliveryLifecycleEmailWorkerDependencies = {
    claim: claimDeliveryLifecycleEmailCandidate,
    clock: () => new Date(),
    drop: dropDeliveryLifecycleEmailAttempt,
    listCandidates: getDeliveryLifecycleEmailCandidates,
    markFailed: markDeliveryLifecycleEmailAttemptFailed,
    markSent: markDeliveryLifecycleEmailAttemptSent,
    send: sendDeliveryLifecycleUpdate,
    start: startDeliveryLifecycleEmailAttempt,
};

function emptyResult(enabled: boolean): DeliveryLifecycleEmailWorkerResult {
    return {
        candidates: 0,
        claimFailures: 0,
        claimed: 0,
        deferred: 0,
        enabled,
        failed: 0,
        finalizationFailures: 0,
        invalidPayloads: 0,
        sent: 0,
        skipped: 0,
        unavailable: 0,
    };
}

export function readDeliveryLifecycleEmailEnabled(
    value = process.env.GREDICE_DELIVERY_NOTIFICATION_EMAIL_ENABLED,
) {
    const normalized = value?.trim().toLowerCase();
    return normalized
        ? ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)
        : false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
    value: Record<string, unknown>,
    expectedKeys: readonly string[],
) {
    const keys = Object.keys(value).sort();
    const sortedExpectedKeys = [...expectedKeys].sort();
    return (
        keys.length === sortedExpectedKeys.length &&
        keys.every((key, index) => key === sortedExpectedKeys[index])
    );
}

function isOpaqueIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= opaqueIdentifierMaxLength &&
        opaqueIdentifierPattern.test(value)
    );
}

function isMilestone(value: unknown): value is DeliveryLifecycleMilestone {
    return (
        typeof value === 'string' &&
        Object.hasOwn(customerDeliveryNotificationCatalog, value)
    );
}

function isDeliveryLifecycleSource(value: unknown) {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, ['id', 'kind', 'version']) ||
        !isOpaqueIdentifier(value.id) ||
        typeof value.version !== 'number' ||
        !Number.isSafeInteger(value.version) ||
        value.version < 0 ||
        value.version > 10_000
    ) {
        return false;
    }
    switch (value.kind) {
        case 'exception-operation':
        case 'retry-state':
        case 'route-progress':
        case 'run-state':
        case 'stop-operation':
            return true;
        default:
            return false;
    }
}

function isExceptionOutcome(
    value: unknown,
): value is DeliveryRunExceptionOutcome {
    return Object.values(DeliveryRunExceptionOutcomes).some(
        (candidate) => candidate === value,
    );
}

function isExceptionReason(
    value: unknown,
): value is DeliveryRunExceptionReason {
    return Object.values(DeliveryRunExceptionReasons).some(
        (candidate) => candidate === value,
    );
}

function boundedException(value: unknown) {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, ['outcome', 'reason']) ||
        !isExceptionOutcome(value.outcome) ||
        !isExceptionReason(value.reason)
    ) {
        return null;
    }
    return { outcome: value.outcome, reason: value.reason };
}

export function parseDeliveryLifecycleEmailMetadata(
    value: unknown,
): CustomerDeliveryNotificationEvent | null {
    if (!isRecord(value) || !isMilestone(value.milestone)) return null;
    const expectedKeys = [
        'eventVersion',
        'milestone',
        'requestId',
        'retryAttempt',
        'runId',
        ...(Object.hasOwn(value, 'source') ? ['source'] : []),
        'stopId',
        ...(value.milestone === 'exception' ? ['exception'] : []),
    ];
    if (
        !hasExactKeys(value, expectedKeys) ||
        value.eventVersion !== 1 ||
        !isOpaqueIdentifier(value.requestId) ||
        !isOpaqueIdentifier(value.runId) ||
        !isOpaqueIdentifier(value.stopId) ||
        (Object.hasOwn(value, 'source') &&
            !isDeliveryLifecycleSource(value.source)) ||
        typeof value.retryAttempt !== 'number' ||
        !Number.isSafeInteger(value.retryAttempt) ||
        value.retryAttempt < 0 ||
        value.retryAttempt > 10_000
    ) {
        return null;
    }
    try {
        buildCustomerDeliveryTrackerLink(value.requestId);
    } catch {
        return null;
    }
    if (value.milestone === 'exception') {
        const exception = boundedException(value.exception);
        if (!exception) return null;
        return {
            exception,
            milestone: value.milestone,
            requestId: value.requestId,
        };
    }
    return {
        milestone: value.milestone,
        requestId: value.requestId,
    };
}

function boundedBatchLimit(value: number) {
    if (!Number.isSafeInteger(value) || value < 1) return defaultBatchLimit;
    return Math.min(value, 200);
}

function providerMessageId(result: unknown) {
    if (
        !isRecord(result) ||
        typeof result.id !== 'string' ||
        result.id.trim().length === 0
    ) {
        return null;
    }
    return result.id.trim().slice(0, 128);
}

function boundedErrorContext(error: unknown) {
    const errorName =
        error instanceof Error ? error.name.slice(0, 64) : 'Unknown';
    const errorCode =
        isRecord(error) &&
        typeof error.code === 'string' &&
        /^[A-Za-z0-9._:-]{1,64}$/u.test(error.code)
            ? error.code
            : undefined;
    return { errorCode, errorName };
}

function boundedLogIdentifier(value: string) {
    return value.slice(0, opaqueIdentifierMaxLength);
}

export function deliveryLifecycleEmailProviderOperationId({
    attemptId,
    notificationId,
    userId,
}: Pick<
    DeliveryLifecycleEmailClaim,
    'attemptId' | 'notificationId' | 'userId'
>) {
    if (!Number.isSafeInteger(attemptId) || attemptId < 1) {
        throw new Error('Delivery lifecycle email attempt ID is invalid.');
    }
    const hash = createHash('sha1')
        .update(
            `gredice:delivery-lifecycle-email:${notificationId}:${userId}:${attemptId}`,
        )
        .digest('hex');
    const variant = (
        (Number.parseInt(hash[16] ?? '0', 16) & 0x3) |
        0x8
    ).toString(16);
    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        `5${hash.slice(13, 16)}`,
        `${variant}${hash.slice(17, 20)}`,
        hash.slice(20, 32),
    ].join('-');
}

export async function runDeliveryLifecycleEmailWorker({
    dependencies = {},
    enabled = readDeliveryLifecycleEmailEnabled(),
    limit = defaultBatchLimit,
}: {
    dependencies?: Partial<DeliveryLifecycleEmailWorkerDependencies>;
    enabled?: boolean;
    limit?: number;
} = {}): Promise<DeliveryLifecycleEmailWorkerResult> {
    const result = emptyResult(enabled);
    if (!enabled) return result;
    const resolved = { ...defaultDependencies, ...dependencies };
    const candidates = await resolved.listCandidates({
        limit: boundedBatchLimit(limit),
        now: resolved.clock(),
    });
    result.candidates = candidates.length;

    for (const candidate of candidates) {
        let claimed: DeliveryLifecycleEmailClaimResult;
        try {
            claimed = await resolved.claim({
                ...candidate,
                now: resolved.clock(),
            });
        } catch (error) {
            result.claimFailures += 1;
            console.error('Failed to claim delivery lifecycle email', {
                ...boundedErrorContext(error),
                notificationId: boundedLogIdentifier(candidate.notificationId),
            });
            continue;
        }

        if (claimed.status === 'deferred') {
            result.deferred += 1;
            continue;
        }
        if (claimed.status === 'skipped') {
            result.skipped += 1;
            continue;
        }
        if (claimed.status === 'unavailable') {
            result.unavailable += 1;
            continue;
        }
        result.claimed += 1;
        const event = parseDeliveryLifecycleEmailMetadata(
            claimed.claim.metadata,
        );
        if (!event) {
            result.invalidPayloads += 1;
            result.skipped += 1;
            try {
                const dropped = await resolved.drop({
                    attemptId: claimed.claim.attemptId,
                    notificationId: claimed.claim.notificationId,
                    now: resolved.clock(),
                    reason: 'invalid_payload',
                    userId: claimed.claim.userId,
                });
                if (!dropped) {
                    throw new Error(
                        'Delivery lifecycle email claim was not open.',
                    );
                }
            } catch (error) {
                result.finalizationFailures += 1;
                console.error(
                    'Failed to drop invalid delivery lifecycle email',
                    {
                        ...boundedErrorContext(error),
                        attemptId: claimed.claim.attemptId,
                        notificationId: boundedLogIdentifier(
                            claimed.claim.notificationId,
                        ),
                    },
                );
            }
            continue;
        }

        let startResult: Awaited<ReturnType<typeof resolved.start>>;
        try {
            startResult = await resolved.start({
                attemptId: claimed.claim.attemptId,
                notificationId: claimed.claim.notificationId,
                now: resolved.clock(),
                userId: claimed.claim.userId,
            });
        } catch (error) {
            result.finalizationFailures += 1;
            console.error('Failed to start delivery lifecycle email', {
                ...boundedErrorContext(error),
                attemptId: claimed.claim.attemptId,
                notificationId: boundedLogIdentifier(
                    claimed.claim.notificationId,
                ),
            });
            continue;
        }
        if (startResult.status !== 'started') {
            if (startResult.status === 'deferred') result.deferred += 1;
            if (startResult.status === 'skipped') result.skipped += 1;
            if (startResult.status === 'unavailable') result.unavailable += 1;
            continue;
        }

        let sendResult: unknown;
        try {
            sendResult = await resolved.send(
                startResult.email,
                {
                    email: startResult.email,
                    event,
                },
                {
                    providerOperationId:
                        deliveryLifecycleEmailProviderOperationId(
                            claimed.claim,
                        ),
                },
            );
        } catch (error) {
            result.failed += 1;
            if (isEmailProviderSubmissionUncertainError(error)) {
                // Keep the durable attempt in its "sending" state. ACS does not
                // guarantee repeatability for Operation-Id, so retrying this
                // attempt could submit the same email twice.
                console.warn(
                    'Delivery lifecycle email send status is uncertain',
                    {
                        ...boundedErrorContext(error),
                        attemptId: claimed.claim.attemptId,
                        notificationId: boundedLogIdentifier(
                            claimed.claim.notificationId,
                        ),
                    },
                );
                continue;
            }
            const providerRejection = isEmailProviderSubmissionRejectedError(
                error,
            )
                ? error
                : null;
            try {
                const finalized =
                    providerRejection && !providerRejection.retryable
                        ? await resolved.drop({
                              attemptId: claimed.claim.attemptId,
                              notificationId: claimed.claim.notificationId,
                              now: resolved.clock(),
                              reason: 'provider_rejected',
                              userId: claimed.claim.userId,
                          })
                        : await resolved.markFailed({
                              attemptId: claimed.claim.attemptId,
                              notificationId: claimed.claim.notificationId,
                              now: resolved.clock(),
                              userId: claimed.claim.userId,
                          });
                if (!finalized) {
                    throw new Error(
                        'Delivery lifecycle email claim was not open.',
                    );
                }
            } catch (recordingError) {
                result.finalizationFailures += 1;
                console.error(
                    'Failed to record delivery lifecycle email failure',
                    {
                        ...boundedErrorContext(recordingError),
                        attemptId: claimed.claim.attemptId,
                        notificationId: boundedLogIdentifier(
                            claimed.claim.notificationId,
                        ),
                    },
                );
            }
            console.warn('Delivery lifecycle email send failed', {
                ...boundedErrorContext(error),
                attemptId: claimed.claim.attemptId,
                notificationId: boundedLogIdentifier(
                    claimed.claim.notificationId,
                ),
                ...(providerRejection
                    ? {
                          providerStatusCode: providerRejection.statusCode,
                          retryable: providerRejection.retryable,
                      }
                    : {}),
            });
            continue;
        }

        try {
            const finalized = await resolved.markSent({
                attemptId: claimed.claim.attemptId,
                notificationId: claimed.claim.notificationId,
                now: resolved.clock(),
                providerMessageId: providerMessageId(sendResult),
                userId: claimed.claim.userId,
            });
            if (!finalized) {
                throw new Error('Delivery lifecycle email claim was not open.');
            }
            result.sent += 1;
        } catch (error) {
            result.finalizationFailures += 1;
            console.error('Failed to finalize delivery lifecycle email', {
                ...boundedErrorContext(error),
                attemptId: claimed.claim.attemptId,
                notificationId: boundedLogIdentifier(
                    claimed.claim.notificationId,
                ),
            });
        }
    }

    return result;
}
