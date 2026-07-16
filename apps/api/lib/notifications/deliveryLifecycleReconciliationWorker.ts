import {
    createDeliveryLifecycleEvent,
    customerDeliveryLifecycleNotification,
    customerDeliveryLifecycleRecipientIdempotencyKey,
    type DeliveryLifecycleEvent,
} from '@gredice/notifications';
import {
    createNotification,
    type DeliveryLifecycleReconciliationCandidate,
    type DeliveryLifecycleReconciliationSkippedSource,
    type DeliveryLifecycleReconciliationTarget,
    filterMissingDeliveryLifecycleNotifications,
    getDeliveryLifecycleReconciliationCandidates,
    markDeliveryLifecycleNotificationProcessed,
} from '@gredice/storage';

const maximumBatchSize = 500;

export function deliveryLifecycleReconciliationStartedAt(
    value = process.env.GREDICE_DELIVERY_NOTIFICATION_ROLLOUT_STARTED_AT,
) {
    const normalized = value?.trim();
    if (!normalized) return null;
    const startedAt = new Date(normalized);
    if (
        Number.isNaN(startedAt.getTime()) ||
        startedAt.toISOString() !== normalized
    ) {
        return null;
    }
    return startedAt;
}

export function deliveryLifecycleReconciliationEnabled(
    value = process.env.GREDICE_DELIVERY_NOTIFICATION_RECONCILIATION_ENABLED,
    producerValue = process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED,
    startedAtValue = process.env
        .GREDICE_DELIVERY_NOTIFICATION_ROLLOUT_STARTED_AT,
) {
    return (
        value?.trim().toLowerCase() === 'true' &&
        producerValue?.trim().toLowerCase() === 'true' &&
        deliveryLifecycleReconciliationStartedAt(startedAtValue) !== null
    );
}

export function reconciledDeliveryLifecycleEvent(
    candidate: DeliveryLifecycleReconciliationCandidate,
): DeliveryLifecycleEvent {
    const common = {
        context: {
            accountId: candidate.accountId,
            requestId: candidate.requestId,
            runId: candidate.runId,
            stopId: String(candidate.stopId),
        },
        occurredAt: candidate.occurredAt.toISOString(),
        retryAttempt: candidate.retryAttempt,
        source: {
            id: `delivery-event:${candidate.eventId}`,
            kind: candidate.sourceKind,
            version: candidate.sourceVersion,
        },
    };
    if (candidate.milestone === 'exception') {
        if (!candidate.exception) {
            throw new Error('Exception reconciliation candidate is invalid.');
        }
        return createDeliveryLifecycleEvent({
            ...common,
            exception: candidate.exception,
            milestone: candidate.milestone,
        });
    }
    return createDeliveryLifecycleEvent({
        ...common,
        milestone: candidate.milestone,
    });
}

type ReconciliationDependencies = {
    create: typeof createNotification;
    filterMissing: typeof filterMissingDeliveryLifecycleNotifications;
    getCandidates: typeof getDeliveryLifecycleReconciliationCandidates;
    markProcessed: typeof markDeliveryLifecycleNotificationProcessed;
};

const defaultDependencies: ReconciliationDependencies = {
    create: createNotification,
    filterMissing: filterMissingDeliveryLifecycleNotifications,
    getCandidates: getDeliveryLifecycleReconciliationCandidates,
    markProcessed: markDeliveryLifecycleNotificationProcessed,
};

async function forEachWithConcurrency<T>(
    values: readonly T[],
    operation: (value: T) => Promise<void>,
) {
    const concurrency = 5;
    for (let index = 0; index < values.length; index += concurrency) {
        const results = await Promise.allSettled(
            values.slice(index, index + concurrency).map(operation),
        );
        const rejected = results.find(
            (result): result is PromiseRejectedResult =>
                result.status === 'rejected',
        );
        if (rejected) throw rejected.reason;
    }
}

export async function processDeliveryLifecycleReconciliation({
    now = new Date(),
    limit = maximumBatchSize,
    dependencies = defaultDependencies,
}: {
    now?: Date;
    limit?: number;
    dependencies?: ReconciliationDependencies;
} = {}) {
    if (!deliveryLifecycleReconciliationEnabled()) {
        return {
            enabled: false,
            failed: 0,
            missing: 0,
            published: 0,
            scanned: 0,
            skipped: 0,
        };
    }
    const startedAt = deliveryLifecycleReconciliationStartedAt();
    if (!startedAt)
        throw new Error('Reconciliation rollout boundary is missing.');
    const boundedLimit =
        Number.isSafeInteger(limit) && limit > 0
            ? Math.min(limit, maximumBatchSize)
            : maximumBatchSize;
    const pending = await dependencies.getCandidates({
        startedAt,
        limit: boundedLimit,
    });
    const missing = await dependencies.filterMissing(pending.candidates);
    const missingByEventId = new Map<
        number,
        DeliveryLifecycleReconciliationTarget[]
    >();
    for (const target of missing) {
        const targets = missingByEventId.get(target.eventId) ?? [];
        targets.push(target);
        missingByEventId.set(target.eventId, targets);
    }
    let published = 0;
    let failed = 0;
    let skipped = 0;
    await forEachWithConcurrency(
        pending.candidates,
        async (candidate: DeliveryLifecycleReconciliationCandidate) => {
            try {
                const missingTargets =
                    missingByEventId.get(candidate.eventId) ?? [];
                const isMissing = missingTargets.length > 0;
                const notificationIds: string[] = [];
                if (isMissing) {
                    const event = reconciledDeliveryLifecycleEvent(candidate);
                    await forEachWithConcurrency(
                        missingTargets,
                        async (target) => {
                            notificationIds.push(
                                await dependencies.create(
                                    customerDeliveryLifecycleNotification(
                                        event,
                                        target.userId,
                                    ),
                                    {
                                        idempotencyKey:
                                            customerDeliveryLifecycleRecipientIdempotencyKey(
                                                event,
                                                target.userId,
                                            ),
                                        now,
                                    },
                                ),
                            );
                        },
                    );
                }
                await dependencies.markProcessed({
                    completed: true,
                    ...(notificationIds.length === 1
                        ? { notificationId: notificationIds[0] }
                        : {}),
                    processedAt: now,
                    reason: isMissing ? 'published' : 'already-published',
                    requestId: candidate.requestId,
                    skipped: false,
                    sourceEventId: candidate.eventId,
                });
                if (isMissing) published += 1;
            } catch (error) {
                failed += 1;
                console.warn(
                    'Delivery lifecycle notification reconciliation failed',
                    {
                        errorName:
                            error instanceof Error ? error.name : 'Unknown',
                        eventId: candidate.eventId,
                        milestone: candidate.milestone,
                    },
                );
            }
        },
    );
    await forEachWithConcurrency(
        pending.skipped,
        async (source: DeliveryLifecycleReconciliationSkippedSource) => {
            try {
                await dependencies.markProcessed({
                    completed: false,
                    processedAt: now,
                    reason: source.reason,
                    requestId: source.requestId,
                    skipped: true,
                    sourceEventId: source.eventId,
                });
                skipped += 1;
            } catch (error) {
                failed += 1;
                console.warn('Delivery lifecycle reconciliation skip failed', {
                    errorName: error instanceof Error ? error.name : 'Unknown',
                    eventId: source.eventId,
                    reason: source.reason,
                });
            }
        },
    );
    return {
        enabled: true,
        failed,
        missing: missingByEventId.size,
        published,
        scanned: pending.sourceCount,
        skipped,
    };
}
