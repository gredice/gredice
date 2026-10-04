'use client';

import { useState } from 'react';
import { OfflineRoutePanel } from '../components/OfflineRoutePanel';
import type {
    DeliveryActionQueueEntry,
    DeliveryActionQueueSnapshot,
} from '../lib/deliveryActionQueue';
import type { OfflineRouteSnapshot } from '../lib/offlineRouteCache';

const cachedAt = '2026-07-15T10:00:00.000Z';

const routeSnapshot: OfflineRouteSnapshot = {
    version: 1,
    scope: { userId: 'driver-offline', runId: 'run-offline' },
    source: {
        routeRevision: 7,
        refreshedAt: cachedAt,
        reroutePending: false,
    },
    cachedAt,
    expiresAt: '2026-07-16T10:00:00.000Z',
    steps: [
        {
            kind: 'delivery',
            id: 71,
            itinerarySequence: 2,
            actionState: 'current',
            address: 'Ilica 71, Zagreb',
            estimatedArrivalAt: '2026-07-15T10:15:00.000Z',
            estimatedTravelSeconds: 600,
            estimatedDistanceMeters: 3_200,
            stopState: 'pending',
            statusLabel: 'U dostavi',
            slotStartAt: '2026-07-15T10:00:00.000Z',
            slotEndAt: '2026-07-15T11:00:00.000Z',
            arrivedAt: null,
            deliveredAt: null,
            retryLaneRank: null,
            retryAttempt: 0,
            lockedReason: null,
            items: [
                {
                    stopId: 71,
                    requestId: 'request-71',
                    stopState: 'pending',
                    requestState: 'in_delivery',
                    contactName: 'Ana Offline',
                    phone: '+385991234567',
                    requestNotes: 'Pozvoniti na drugi kat',
                    harvest: {
                        plantName: 'Rajčica',
                        raisedBedName: 'Gredica A',
                        fieldName: null,
                        tracePath: '/trag/offline-tomato-0001',
                    },
                    exception: null,
                },
            ],
        },
        {
            kind: 'delivery',
            id: 72,
            itinerarySequence: 3,
            actionState: 'locked',
            address: 'Vukovarska 72, Zagreb',
            estimatedArrivalAt: '2026-07-15T10:45:00.000Z',
            estimatedTravelSeconds: 900,
            estimatedDistanceMeters: 5_100,
            stopState: 'pending',
            statusLabel: 'Sljedeća dostava',
            slotStartAt: '2026-07-15T10:30:00.000Z',
            slotEndAt: '2026-07-15T11:30:00.000Z',
            arrivedAt: null,
            deliveredAt: null,
            retryLaneRank: null,
            retryAttempt: 0,
            lockedReason: 'Dovrši prethodnu dostavu.',
            items: [
                {
                    stopId: 72,
                    requestId: 'request-72',
                    stopState: 'pending',
                    requestState: 'in_delivery',
                    contactName: 'Borna Sljedeći',
                    phone: null,
                    requestNotes: null,
                    harvest: {
                        plantName: 'Bosiljak',
                        raisedBedName: 'Gredica B',
                        fieldName: null,
                        tracePath: '/trag/offline-basil-00001',
                    },
                    exception: null,
                },
            ],
        },
    ],
};

const bulkRecipientRouteSnapshot: OfflineRouteSnapshot = {
    ...routeSnapshot,
    steps: routeSnapshot.steps.map((step, index) => {
        if (index !== 0 || step.kind !== 'delivery') return step;
        const [item] = step.items;
        if (!item) return step;
        return {
            ...step,
            recipientCount: 1,
            items: [
                ...step.items,
                {
                    ...item,
                    stopId: 73,
                    requestId: 'request-73',
                    harvest: {
                        ...item.harvest,
                        plantName: 'Paprika',
                        tracePath: '/trag/offline-pepper-0001',
                    },
                },
            ],
        };
    }),
};

function queueSnapshot(
    entries: DeliveryActionQueueEntry[],
    durability: DeliveryActionQueueSnapshot['durability'] = 'durable',
): DeliveryActionQueueSnapshot {
    return {
        scope: routeSnapshot.scope,
        durability,
        coordination: durability === 'durable' ? 'coordinated' : 'best-effort',
        entries,
        queuedCount: entries.filter((entry) => entry.state === 'queued').length,
        sendingCount: entries.filter((entry) => entry.state === 'sending')
            .length,
        reconcilingCount: entries.filter(
            (entry) => entry.state === 'reconciling',
        ).length,
        syncedCount: entries.filter((entry) => entry.state === 'synced').length,
        failedCount: entries.filter((entry) => entry.state === 'failed').length,
        conflictedCount: entries.filter((entry) => entry.state === 'conflicted')
            .length,
    };
}

function routeEntry(
    kind: 'arrive' | 'deliver',
    sequence: number,
    stopId = 71,
    state: DeliveryActionQueueEntry['state'] = 'queued',
    reroutePending = false,
): DeliveryActionQueueEntry {
    const acknowledgement: DeliveryActionQueueEntry['acknowledgement'] =
        state === 'synced'
            ? {
                  kind: 'server',
                  replayed: false,
                  routeRevision: 8,
                  reroutePending,
                  runCompleted: false,
              }
            : undefined;
    return {
        sequence,
        command: {
            kind,
            operationId: `${kind}-offline-${sequence}`,
            runId: routeSnapshot.scope.runId,
            stopId,
            expectedRouteRevision: 7 + sequence,
            occurredAt: cachedAt,
        },
        state,
        attemptCount: state === 'queued' ? 0 : 1,
        createdAt: cachedAt,
        updatedAt: cachedAt,
        ...(acknowledgement ? { acknowledgement } : {}),
    };
}

export function OfflineRouteAcknowledgedDeliveryStory() {
    return (
        <OfflineRoutePanel
            snapshot={routeSnapshot}
            actionQueue={queueSnapshot([
                routeEntry('deliver', 0, 71, 'synced'),
            ])}
            onArrive={() => undefined}
            onDeliver={() => undefined}
            onException={async () => ({ status: 'saved' })}
            onVerificationScan={() => undefined}
            onRetry={() => undefined}
            onRecoverConflict={() => undefined}
            onReconcile={() => undefined}
        />
    );
}

export function OfflineRouteBulkRecipientCountStory() {
    return (
        <OfflineRoutePanel
            snapshot={bulkRecipientRouteSnapshot}
            actionQueue={queueSnapshot([])}
            onArrive={() => undefined}
            onDeliver={() => undefined}
            onException={async () => ({ status: 'saved' })}
            onVerificationScan={() => undefined}
            onRetry={() => undefined}
            onRecoverConflict={() => undefined}
            onReconcile={() => undefined}
        />
    );
}

export function OfflineRoutePendingRerouteStory() {
    const [reconciled, setReconciled] = useState(false);
    return (
        <>
            <output data-testid="offline-reroute-reconciled">
                {reconciled ? 'yes' : 'no'}
            </output>
            <OfflineRoutePanel
                snapshot={routeSnapshot}
                actionQueue={queueSnapshot([
                    routeEntry('deliver', 0, 71, 'synced', true),
                ])}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({ status: 'saved' })}
                onVerificationScan={() => undefined}
                onRetry={() => undefined}
                onRecoverConflict={() => undefined}
                onReconcile={() => setReconciled(true)}
            />
        </>
    );
}

export function OfflineRouteBlockedContinuationStory() {
    return (
        <OfflineRoutePanel
            snapshot={routeSnapshot}
            actionQueue={queueSnapshot([
                routeEntry('deliver', 0),
                {
                    ...routeEntry('arrive', 1, 72, 'failed'),
                    errorCode: 'offline',
                },
            ])}
            onArrive={() => undefined}
            onDeliver={() => undefined}
            onException={async () => ({ status: 'saved' })}
            onVerificationScan={() => undefined}
            onRetry={() => undefined}
            onRecoverConflict={() => undefined}
            onReconcile={() => undefined}
        />
    );
}

export function OfflineRouteArrivalStory() {
    const [entries, setEntries] = useState<DeliveryActionQueueEntry[]>([]);
    const [exceptionQueued, setExceptionQueued] = useState(false);
    const [verifiedTrace, setVerifiedTrace] = useState('');
    return (
        <>
            <output data-testid="offline-operations">
                {entries.map((entry) => entry.command.kind).join(',')}
            </output>
            <output data-testid="offline-exception">
                {exceptionQueued ? 'queued' : 'none'}
            </output>
            <output data-testid="offline-verification">{verifiedTrace}</output>
            <OfflineRoutePanel
                snapshot={routeSnapshot}
                actionQueue={queueSnapshot(entries)}
                onArrive={(stopId) =>
                    setEntries((current) => [
                        ...current,
                        routeEntry('arrive', current.length, stopId),
                    ])
                }
                onDeliver={(stopId) =>
                    setEntries((current) => [
                        ...current,
                        routeEntry('deliver', current.length, stopId),
                    ])
                }
                onException={async () => {
                    setExceptionQueued(true);
                    return { status: 'saved' };
                }}
                onVerificationScan={(_, tracePath) =>
                    setVerifiedTrace(tracePath)
                }
                onRetry={() => undefined}
                onRecoverConflict={() => undefined}
                onReconcile={() => undefined}
            />
        </>
    );
}

export function OfflineRouteExceptionBarrierStory() {
    const [reconciled, setReconciled] = useState(false);
    const exception: DeliveryActionQueueEntry = {
        sequence: 0,
        command: {
            kind: 'exception',
            operationId: 'exception-offline',
            runId: routeSnapshot.scope.runId,
            stopId: 71,
            expectedRouteRevision: 7,
            occurredAt: cachedAt,
            exceptions: [
                {
                    stopId: 71,
                    outcome: 'deferred',
                    reason: 'customer-unavailable',
                },
            ],
        },
        state: 'reconciling',
        attemptCount: 1,
        createdAt: cachedAt,
        updatedAt: cachedAt,
        acknowledgement: {
            kind: 'server',
            replayed: false,
            routeRevision: 8,
            reroutePending: false,
            runCompleted: false,
        },
    };
    return (
        <>
            <output data-testid="offline-reconciled">
                {reconciled ? 'yes' : 'no'}
            </output>
            <OfflineRoutePanel
                snapshot={routeSnapshot}
                actionQueue={queueSnapshot([exception], 'memory')}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({
                    status: 'review-required',
                    message: 'Ruta čeka novi plan.',
                })}
                onVerificationScan={() => undefined}
                onRetry={() => undefined}
                onRecoverConflict={() => undefined}
                onReconcile={() => setReconciled(true)}
            />
        </>
    );
}
