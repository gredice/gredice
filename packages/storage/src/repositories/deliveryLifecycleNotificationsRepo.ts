import { and, asc, eq, gte, inArray, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import 'server-only';
import {
    customerDeliveryNotificationRecipientRoles,
    deliveryLifecycleNotificationCategory,
    deliveryLifecycleNotificationType,
} from '../deliveryNotificationPolicy';
import {
    accountUsers,
    type DeliveryRunExceptionOutcome,
    DeliveryRunExceptionOutcomes,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
    events,
    notifications,
    users,
} from '../schema';
import { storage } from '../storage';
import { getDeliveryRequestOwners } from './deliveryRequestsRepo';
import { createEvent, knownEvents, knownEventTypes } from './eventsRepo';

const deliveryLifecycleSourceEventTypes = [
    knownEventTypes.delivery.requestRouteStarted,
    knownEventTypes.delivery.requestRouteProgress,
    knownEventTypes.delivery.requestArrived,
    knownEventTypes.delivery.requestFulfilled,
    knownEventTypes.delivery.requestExceptionRecorded,
    knownEventTypes.delivery.requestExceptionRecovered,
] as const;

export type DeliveryLifecycleReconciliationCandidate = {
    accountId: string;
    eventId: number;
    milestone:
        | 'route-started'
        | 'near-arrival'
        | 'next-stop'
        | 'delayed'
        | 'arrived'
        | 'delivered'
        | 'exception'
        | 'recovery';
    occurredAt: Date;
    requestId: string;
    retryAttempt: number;
    runId: string;
    sourceKind:
        | 'run-state'
        | 'route-progress'
        | 'stop-operation'
        | 'exception-operation'
        | 'retry-state';
    sourceVersion: number;
    stopId: number;
    exception?: {
        outcome: DeliveryRunExceptionOutcome;
        reason: DeliveryRunExceptionReason;
    };
};

export type DeliveryLifecycleReconciliationSkippedSource = {
    eventId: number;
    reason: 'invalid-source-event' | 'owner-unavailable';
    requestId: string;
};

export type DeliveryLifecycleReconciliationTarget =
    DeliveryLifecycleReconciliationCandidate & {
        userId: string;
    };

type CandidateWithoutOwner = Omit<
    DeliveryLifecycleReconciliationCandidate,
    'accountId'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function boundedString(value: unknown, maximum = 256) {
    return typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= maximum
        ? value
        : null;
}

function opaqueRequestId(value: unknown) {
    return typeof value === 'string' &&
        value.length <= 128 &&
        /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/u.test(value)
        ? value
        : null;
}

function nonnegativeInteger(value: unknown) {
    return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
        ? value
        : null;
}

function positiveInteger(value: unknown) {
    const parsed = nonnegativeInteger(value);
    return parsed !== null && parsed > 0 ? parsed : null;
}

function canonicalDate(value: unknown) {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
        ? parsed
        : null;
}

function deliveryLifecycleMilestone(value: unknown) {
    switch (value) {
        case 'route-started':
        case 'near-arrival':
        case 'next-stop':
        case 'delayed':
        case 'arrived':
        case 'delivered':
        case 'exception':
        case 'recovery':
            return value;
        default:
            return null;
    }
}

function routeProgressCandidate({
    eventId,
    requestId,
    data,
}: {
    eventId: number;
    requestId: string;
    data: Record<string, unknown>;
}): CandidateWithoutOwner | null {
    const runId = boundedString(data.runId);
    const stopId = positiveInteger(data.stopId);
    const retryAttempt = nonnegativeInteger(data.retryAttempt);
    const occurredAt = canonicalDate(data.occurredAt);
    const sourceVersion = nonnegativeInteger(data.routeRevision);
    const milestone = deliveryLifecycleMilestone(data.milestone);
    if (
        !runId ||
        stopId === null ||
        retryAttempt === null ||
        !occurredAt ||
        sourceVersion === null ||
        (milestone !== 'near-arrival' &&
            milestone !== 'next-stop' &&
            milestone !== 'delayed')
    ) {
        return null;
    }
    return {
        eventId,
        milestone,
        occurredAt,
        requestId,
        retryAttempt,
        runId,
        sourceKind: 'route-progress',
        sourceVersion,
        stopId,
    };
}

function lifecycleTransitionCandidate({
    eventId,
    requestId,
    data,
    milestone,
}: {
    eventId: number;
    requestId: string;
    data: Record<string, unknown>;
    milestone: 'arrived' | 'route-started';
}): CandidateWithoutOwner | null {
    const runId = boundedString(data.runId);
    const stopId = positiveInteger(data.stopId);
    const retryAttempt = nonnegativeInteger(data.retryAttempt);
    const occurredAt = canonicalDate(data.occurredAt);
    const sourceVersion = nonnegativeInteger(data.routeRevision);
    if (
        !runId ||
        stopId === null ||
        retryAttempt === null ||
        !occurredAt ||
        sourceVersion === null
    ) {
        return null;
    }
    return {
        eventId,
        milestone,
        occurredAt,
        requestId,
        retryAttempt,
        runId,
        sourceKind:
            milestone === 'route-started' ? 'run-state' : 'stop-operation',
        sourceVersion,
        stopId,
    };
}

function deliveredCandidate({
    eventId,
    eventVersion,
    requestId,
    data,
    createdAt,
}: {
    eventId: number;
    eventVersion: number;
    requestId: string;
    data: Record<string, unknown>;
    createdAt: Date;
}): CandidateWithoutOwner | null {
    if (!isRecord(data.handoffVerification)) return null;
    const handoff = data.handoffVerification;
    const runId = boundedString(handoff.runId);
    const stopId = positiveInteger(handoff.stopId);
    const retryAttempt = nonnegativeInteger(handoff.retryAttempt);
    const occurredAt = canonicalDate(data.fulfilledAt) ?? createdAt;
    if (!runId || stopId === null || retryAttempt === null) return null;
    return {
        eventId,
        milestone: 'delivered',
        occurredAt,
        requestId,
        retryAttempt,
        runId,
        sourceKind: 'stop-operation',
        sourceVersion: eventVersion,
        stopId,
    };
}

function exceptionCandidate({
    eventId,
    requestId,
    data,
}: {
    eventId: number;
    requestId: string;
    data: Record<string, unknown>;
}): CandidateWithoutOwner | null {
    const runId = boundedString(data.runId);
    const stopId = positiveInteger(data.stopId);
    const retryAttempt = nonnegativeInteger(data.retryAttempt);
    const occurredAt = canonicalDate(data.occurredAt);
    const sourceVersion = nonnegativeInteger(data.routeRevision);
    const outcome = Object.values(DeliveryRunExceptionOutcomes).find(
        (candidate) => candidate === data.outcome,
    );
    const reason = Object.values(DeliveryRunExceptionReasons).find(
        (candidate) => candidate === data.reason,
    );
    if (
        !runId ||
        stopId === null ||
        retryAttempt === null ||
        !occurredAt ||
        sourceVersion === null ||
        !outcome ||
        !reason
    ) {
        return null;
    }
    return {
        eventId,
        exception: { outcome, reason },
        milestone: 'exception',
        occurredAt,
        requestId,
        retryAttempt,
        runId,
        sourceKind: 'exception-operation',
        sourceVersion,
        stopId,
    };
}

function recoveryCandidate({
    eventId,
    requestId,
    data,
}: {
    eventId: number;
    requestId: string;
    data: Record<string, unknown>;
}): CandidateWithoutOwner | null {
    if (data.recovery !== 'retry' && data.recovery !== 'admin-recovery') {
        return null;
    }
    const runId = boundedString(data.runId);
    const stopId = positiveInteger(data.stopId);
    const retryAttempt = nonnegativeInteger(data.retryAttempt);
    const occurredAt = canonicalDate(data.recoveredAt);
    const sourceVersion = nonnegativeInteger(data.routeRevision);
    if (
        !runId ||
        stopId === null ||
        retryAttempt === null ||
        !occurredAt ||
        sourceVersion === null
    ) {
        return null;
    }
    return {
        eventId,
        milestone: 'recovery',
        occurredAt,
        requestId,
        retryAttempt,
        runId,
        sourceKind: 'retry-state',
        sourceVersion,
        stopId,
    };
}

export async function getDeliveryLifecycleReconciliationCandidates({
    startedAt,
    limit = 500,
}: {
    startedAt: Date;
    limit?: number;
}) {
    const boundedLimit =
        Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 500;
    const processedEvents = alias(
        events,
        'delivery_lifecycle_notification_processed_events',
    );
    const rows = await storage().query.events.findMany({
        where: and(
            inArray(events.type, [...deliveryLifecycleSourceEventTypes]),
            gte(events.createdAt, startedAt),
            notExists(
                storage()
                    .select({ id: processedEvents.id })
                    .from(processedEvents)
                    .where(
                        and(
                            eq(
                                processedEvents.type,
                                knownEventTypes.delivery
                                    .requestLifecycleNotificationProcessed,
                            ),
                            eq(processedEvents.aggregateId, events.aggregateId),
                            eq(
                                sql<string>`${processedEvents.data}->>'sourceEventId'`,
                                sql<string>`${events.id}::text`,
                            ),
                            or(
                                eq(
                                    sql<string>`${processedEvents.data}->>'completed'`,
                                    'true',
                                ),
                                eq(
                                    sql<string>`${processedEvents.data}->>'skipped'`,
                                    'true',
                                ),
                            ),
                        ),
                    ),
            ),
        ),
        orderBy: [asc(events.createdAt), asc(events.id)],
        limit: boundedLimit,
    });
    const parsedRows = rows.map((event) => {
        const requestId = opaqueRequestId(event.aggregateId);
        if (!isRecord(event.data) || !requestId) {
            return { event, candidate: null };
        }
        const common = {
            eventId: event.id,
            requestId,
            data: event.data,
        };
        const candidate =
            event.version === 1 &&
            event.type === knownEventTypes.delivery.requestRouteStarted
                ? lifecycleTransitionCandidate({
                      ...common,
                      milestone: 'route-started',
                  })
                : event.version === 1 &&
                    event.type === knownEventTypes.delivery.requestRouteProgress
                  ? routeProgressCandidate(common)
                  : event.version === 1 &&
                      event.type === knownEventTypes.delivery.requestArrived
                    ? lifecycleTransitionCandidate({
                          ...common,
                          milestone: 'arrived',
                      })
                    : event.version === 2 &&
                        event.type === knownEventTypes.delivery.requestFulfilled
                      ? deliveredCandidate({
                            ...common,
                            eventVersion: event.version,
                            createdAt: event.createdAt,
                        })
                      : event.version === 1 &&
                          event.type ===
                              knownEventTypes.delivery.requestExceptionRecorded
                        ? exceptionCandidate(common)
                        : event.version === 1 &&
                            event.type ===
                                knownEventTypes.delivery
                                    .requestExceptionRecovered
                          ? recoveryCandidate(common)
                          : null;
        return { event, candidate };
    });
    const parsed = parsedRows.flatMap(({ candidate }) =>
        candidate ? [candidate] : [],
    );
    const owners = await getDeliveryRequestOwners(
        parsed.map((candidate) => candidate.requestId),
    );
    const accountIdByRequestId = new Map(
        owners.map((owner) => [owner.requestId, owner.accountId]),
    );
    const candidates = parsed.flatMap((candidate) => {
        const accountId = accountIdByRequestId.get(candidate.requestId);
        return accountId ? [{ ...candidate, accountId }] : [];
    });
    const candidateEventIds = new Set(
        candidates.map((candidate) => candidate.eventId),
    );
    const skipped = parsedRows.flatMap(
        ({
            event,
            candidate,
        }): DeliveryLifecycleReconciliationSkippedSource[] => {
            if (!candidate) {
                return [
                    {
                        eventId: event.id,
                        reason: 'invalid-source-event',
                        requestId: event.aggregateId,
                    },
                ];
            }
            return candidateEventIds.has(event.id)
                ? []
                : [
                      {
                          eventId: event.id,
                          reason: 'owner-unavailable',
                          requestId: event.aggregateId,
                      },
                  ];
        },
    );
    return { candidates, skipped, sourceCount: rows.length };
}

export async function markDeliveryLifecycleNotificationProcessed({
    completed,
    notificationId,
    processedAt = new Date(),
    reason,
    requestId,
    skipped,
    sourceEventId,
}: {
    completed: boolean;
    notificationId?: string;
    processedAt?: Date;
    reason:
        | 'already-published'
        | 'invalid-source-event'
        | 'owner-unavailable'
        | 'published';
    requestId: string;
    skipped: boolean;
    sourceEventId: number;
}) {
    await createEvent(
        knownEvents.delivery.requestLifecycleNotificationProcessedV1(
            requestId,
            {
                completed,
                ...(notificationId ? { notificationId } : {}),
                processedAt: processedAt.toISOString(),
                reason,
                skipped,
                sourceEventId,
            },
        ),
    );
}

function candidateKey(
    candidate: Pick<
        DeliveryLifecycleReconciliationTarget,
        | 'accountId'
        | 'milestone'
        | 'requestId'
        | 'retryAttempt'
        | 'runId'
        | 'stopId'
        | 'userId'
    >,
) {
    const attempt =
        candidate.milestone === 'route-started' ||
        candidate.milestone === 'delivered'
            ? 'all'
            : String(candidate.retryAttempt);
    return JSON.stringify([
        candidate.accountId,
        candidate.milestone,
        candidate.requestId,
        candidate.runId,
        candidate.stopId,
        attempt,
        candidate.userId,
    ]);
}

export async function filterMissingDeliveryLifecycleNotifications(
    candidates: DeliveryLifecycleReconciliationCandidate[],
) {
    if (candidates.length === 0) return [];
    const accountIds = Array.from(
        new Set(candidates.map((candidate) => candidate.accountId)),
    );
    const recipientRows = await storage()
        .select({
            accountId: accountUsers.accountId,
            userId: accountUsers.userId,
        })
        .from(accountUsers)
        .innerJoin(users, eq(users.id, accountUsers.userId))
        .where(
            and(
                inArray(accountUsers.accountId, accountIds),
                inArray(users.role, [
                    ...customerDeliveryNotificationRecipientRoles,
                ]),
            ),
        );
    const recipientIdsByAccountId = new Map<string, Set<string>>();
    for (const recipient of recipientRows) {
        const userIds =
            recipientIdsByAccountId.get(recipient.accountId) ?? new Set();
        userIds.add(recipient.userId);
        recipientIdsByAccountId.set(recipient.accountId, userIds);
    }
    const targets: DeliveryLifecycleReconciliationTarget[] = candidates.flatMap(
        (candidate) =>
            Array.from(
                recipientIdsByAccountId.get(candidate.accountId) ?? [],
            ).map((userId) => ({ ...candidate, userId })),
    );
    if (targets.length === 0) return [];
    const requestIds = Array.from(
        new Set(candidates.map((candidate) => candidate.requestId)),
    );
    const rows = await storage()
        .select({
            accountId: notifications.accountId,
            metadata: notifications.metadata,
            userId: notifications.userId,
        })
        .from(notifications)
        .where(
            and(
                inArray(
                    sql<string>`${notifications.metadata} ->> 'requestId'`,
                    requestIds,
                ),
                eq(
                    notifications.category,
                    deliveryLifecycleNotificationCategory,
                ),
                eq(notifications.type, deliveryLifecycleNotificationType),
            ),
        );
    const existingKeys = new Set(
        rows.flatMap((row) => {
            const metadata = row.metadata;
            const milestone = deliveryLifecycleMilestone(metadata.milestone);
            const requestId = boundedString(metadata.requestId);
            const runId = boundedString(metadata.runId);
            const stopId = positiveInteger(
                typeof metadata.stopId === 'string'
                    ? Number(metadata.stopId)
                    : metadata.stopId,
            );
            const retryAttempt = nonnegativeInteger(metadata.retryAttempt);
            if (
                !row.userId ||
                !milestone ||
                !requestId ||
                !runId ||
                stopId === null ||
                retryAttempt === null
            ) {
                return [];
            }
            return [
                candidateKey({
                    accountId: row.accountId,
                    milestone,
                    requestId,
                    retryAttempt,
                    runId,
                    stopId,
                    userId: row.userId,
                }),
            ];
        }),
    );
    return targets.filter((target) => !existingKeys.has(candidateKey(target)));
}
