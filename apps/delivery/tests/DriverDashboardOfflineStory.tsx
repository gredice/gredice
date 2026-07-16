'use client';

import { useEffect, useRef, useState } from 'react';
import { DriverDashboard } from '../components/DriverDashboard';
import type { DriverRouteWakeLockState } from '../hooks/useDriverRouteWakeLock';
import type { DriverTrackingState } from '../hooks/useDriverTracking';
import type {
    DeliveryActionQueueEntry,
    DeliveryActionQueueSnapshot,
} from '../lib/deliveryActionQueue';
import type {
    DeliveryPickupManifestSummary,
    DeliveryPickupStepSummary,
    DeliveryRouteStepSummary,
    DeliveryStopSummary,
    DriverDeliveryDashboard,
} from '../lib/deliveryDashboardTypes';
import type { PickupManifestQueueSnapshot } from '../lib/pickupManifestQueue';
import { currentPickupFixture } from './DriverCurrentStopCommandCenterStory';
import {
    bulkExceptionStop,
    deferredRetryStop,
    mixedStatusStop,
} from './deliveryRecoveryFixtures';

const occurredAt = '2026-07-15T08:32:00.000Z';
const nextStop: DeliveryStopSummary = {
    ...mixedStatusStop,
    id: 42,
    requestId: 'request-next-offline',
    sequence: 3,
    stopState: 'pending',
    statusLabel: 'Sljedeća dostava',
    isCurrent: false,
    contactName: 'Nika Sljedeća',
    address: 'Vukovarska 42, Zagreb',
    arrivedAt: null,
    estimatedArrivalAt: '2026-07-15T09:00:00.000Z',
    actionState: 'upcoming',
    deliveries: mixedStatusStop.deliveries.map((delivery, index) => ({
        ...delivery,
        stopId: 42,
        requestId: `request-next-offline-${index}`,
        stopState: 'pending',
        contactName: 'Nika Sljedeća',
        exception: null,
    })),
};

const dashboard: DriverDeliveryDashboard = {
    kind: 'driver',
    user: {
        id: 'driver-live-offline',
        displayName: 'Vozač Offline',
        role: 'delivery',
    },
    activeRun: {
        id: 'run-component-4127',
        state: 'active',
        startedAt: '2026-07-15T08:00:00.000Z',
        completedAt: null,
        totalDistanceMeters: 8_000,
        totalDurationSeconds: 1_800,
        routePlanVersion: 3,
        routeRevision: 12,
        reroutePending: false,
        estimateSource: 'local',
        tracking: {
            status: 'offline',
            lastAcceptedAt: null,
            mapAvailable: false,
        },
        location: null,
        estimatesUpdatedAt: occurredAt,
        mapUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
        deliveryCount: 4,
        stops: [mixedStatusStop, nextStop],
        routeSteps: [
            {
                kind: 'delivery',
                itinerarySequence: 2,
                retryLaneRank: null,
                retryAttempt: 0,
                actionState: 'current',
                lockedReason: null,
                stop: mixedStatusStop,
            },
            {
                kind: 'delivery',
                itinerarySequence: 3,
                retryLaneRank: null,
                retryAttempt: 0,
                actionState: 'upcoming',
                lockedReason: null,
                stop: nextStop,
            },
        ],
    },
    batches: [],
    maximumRouteStops: 24,
    maximumRouteWindowHours: 12,
    refreshedAt: occurredAt,
};

const completion: DeliveryActionQueueEntry = {
    sequence: 0,
    command: {
        kind: 'deliver',
        operationId: 'deliver-live-offline-current',
        runId: 'run-component-4127',
        stopId: 41,
        expectedRouteRevision: 12,
        occurredAt,
    },
    state: 'queued',
    attemptCount: 0,
    createdAt: occurredAt,
    updatedAt: occurredAt,
};

const actionQueue: DeliveryActionQueueSnapshot = {
    scope: {
        userId: dashboard.user.id,
        runId: 'run-component-4127',
    },
    durability: 'durable',
    coordination: 'coordinated',
    entries: [completion],
    queuedCount: 1,
    sendingCount: 0,
    reconcilingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    conflictedCount: 0,
};

const rerouteActionQueue: DeliveryActionQueueSnapshot = {
    ...actionQueue,
    entries: [
        {
            ...completion,
            state: 'synced',
            attemptCount: 1,
            acknowledgement: {
                kind: 'server',
                replayed: false,
                routeRevision: 13,
                reroutePending: true,
                runCompleted: false,
            },
        },
    ],
    queuedCount: 0,
    syncedCount: 1,
};

const trackingState: DriverTrackingState = {
    status: 'retrying',
    lastAttemptAt: occurredAt,
    lastAcceptedAt: null,
    nextRetryAt: null,
    retryAttempt: 1,
    sampleQueued: false,
    reason: 'offline',
    retryNow: () => undefined,
    recheckPermission: () => undefined,
};

const routeWakeLock: DriverRouteWakeLockState = {
    status: 'inactive',
    consented: false,
    documentVisible: true,
    enable: () => undefined,
    disable: () => undefined,
    retry: () => undefined,
};

function DashboardStory({
    dashboardData = dashboard,
    deliveryQueue,
    pickupQueue = null,
    onDeliver = () => undefined,
    onRetry = () => undefined,
    onPickupScan = () => undefined,
    onPickupItemState = () => undefined,
    onRetryPickupSync = () => undefined,
    onDiscardPickupSync = () => undefined,
}: {
    dashboardData?: DriverDeliveryDashboard;
    deliveryQueue: DeliveryActionQueueSnapshot;
    pickupQueue?: PickupManifestQueueSnapshot | null;
    onDeliver?: () => unknown | Promise<unknown>;
    onRetry?: () => unknown | Promise<unknown>;
    onPickupScan?: () => unknown | Promise<unknown>;
    onPickupItemState?: () => unknown | Promise<unknown>;
    onRetryPickupSync?: (operationId: string) => unknown | Promise<unknown>;
    onDiscardPickupSync?: (operationId: string) => unknown | Promise<unknown>;
}) {
    return (
        <DriverDashboard
            dashboard={dashboardData}
            routeWakeLock={routeWakeLock}
            trackingState={trackingState}
            pendingAction={null}
            onSelectionChange={() => undefined}
            onStartRun={() => undefined}
            onRetry={onRetry}
            onArrive={() => undefined}
            onDeliver={onDeliver}
            onException={async () => ({ status: 'saved' })}
            pickupQueue={pickupQueue}
            deliveryQueue={deliveryQueue}
            onPickupScan={onPickupScan}
            onPickupItemState={onPickupItemState}
            onConfirmPickupManifest={() => undefined}
            onRetryPickupSync={onRetryPickupSync}
            onDiscardPickupSync={onDiscardPickupSync}
            onVerificationScan={() => undefined}
            onRetryDeliverySync={() => undefined}
            onDiscardDeliverySync={() => undefined}
            onReconcileDeliverySync={() => undefined}
        />
    );
}

export function DriverDashboardOfflineContinuationStory() {
    return <DashboardStory deliveryQueue={actionQueue} />;
}

export function DriverDashboardPendingRerouteStory() {
    return <DashboardStory deliveryQueue={rerouteActionQueue} />;
}

const emptyActionQueue: DeliveryActionQueueSnapshot = {
    ...actionQueue,
    entries: [],
    queuedCount: 0,
};

function dashboardWithCurrentBulkStop(
    stop: DeliveryStopSummary,
): DriverDeliveryDashboard {
    if (!dashboard.activeRun) return dashboard;
    return {
        ...dashboard,
        activeRun: {
            ...dashboard.activeRun,
            deliveryCount: stop.deliveries.length + nextStop.deliveries.length,
            stops: [stop, nextStop],
            routeSteps: dashboard.activeRun.routeSteps.map((step, index) =>
                index === 0 && step.kind === 'delivery'
                    ? { ...step, stop }
                    : step,
            ),
        },
    };
}

const partialBulkStop: DeliveryStopSummary = {
    ...bulkExceptionStop,
    deliveryCount: bulkExceptionStop.deliveries.length,
    deliveries: bulkExceptionStop.deliveries.map((delivery) =>
        delivery.requestId === 'request-basil'
            ? {
                  ...delivery,
                  stopState: 'failed',
                  requestState: 'failed',
              }
            : delivery,
    ),
};

export function DriverDashboardBulkRecipientAdvanceStory() {
    const [partial, setPartial] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setPartial(true)}>
                Simuliraj djelomičnu iznimku
            </button>
            <DashboardStory
                dashboardData={dashboardWithCurrentBulkStop(
                    partial ? partialBulkStop : bulkExceptionStop,
                )}
                deliveryQueue={emptyActionQueue}
            />
        </>
    );
}

const advancedDashboard: DriverDeliveryDashboard = {
    ...dashboard,
    activeRun: dashboard.activeRun
        ? {
              ...dashboard.activeRun,
              routeRevision: 13,
              routeSteps: dashboard.activeRun.routeSteps.map((step, index) => {
                  if (step.kind !== 'delivery') return step;
                  return index === 0
                      ? { ...step, actionState: 'completed' as const }
                      : {
                            ...step,
                            actionState: 'current' as const,
                            stop: {
                                ...step.stop,
                                isCurrent: true,
                                actionState: 'current' as const,
                            },
                        };
              }),
          }
        : null,
};

export function DriverDashboardServerAdvanceStory() {
    const [advanced, setAdvanced] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setAdvanced(true)}>
                Simuliraj potvrdu poslužitelja
            </button>
            <DashboardStory
                dashboardData={advanced ? advancedDashboard : dashboard}
                deliveryQueue={emptyActionQueue}
                onDeliver={() => ({
                    status: 'failed',
                    message: 'Dostava nije spremljena.',
                })}
            />
        </>
    );
}

const basePickupManifest = currentPickupFixture.manifests[0];
if (!basePickupManifest) {
    throw new Error('Current pickup fixture requires one manifest.');
}

const firstPickupManifest: DeliveryPickupManifestSummary = {
    ...basePickupManifest,
    id: 'manifest-first-slot',
};
const secondPickupManifest: DeliveryPickupManifestSummary = {
    ...basePickupManifest,
    id: 'manifest-second-slot',
    startAt: '2026-07-15T09:00:00.000Z',
    endAt: '2026-07-15T10:00:00.000Z',
    items: basePickupManifest.items.map((item) => ({
        ...item,
        id: `${item.id}-second`,
        stopId: item.stopId + 1,
        requestId: `${item.requestId}-second`,
        stopKey: `${item.stopKey}-second`,
    })),
};

const pickupWithTwoManifests = {
    ...currentPickupFixture,
    manifests: [firstPickupManifest, secondPickupManifest],
};

function dashboardWithRouteSteps(
    routeSteps: DeliveryRouteStepSummary[],
    stops: DeliveryStopSummary[] = [],
): DriverDeliveryDashboard {
    if (!dashboard.activeRun) return dashboard;
    return {
        ...dashboard,
        activeRun: {
            ...dashboard.activeRun,
            deliveryCount: stops.reduce(
                (count, stop) => count + stop.deliveries.length,
                0,
            ),
            stops,
            routeSteps,
        },
    };
}

const pickupManifestDashboard = dashboardWithRouteSteps([
    {
        kind: 'pickup',
        itinerarySequence: 1,
        actionState: 'current',
        pickup: pickupWithTwoManifests,
    },
]);
const advancedPickupManifestDashboard = dashboardWithRouteSteps([
    {
        kind: 'pickup',
        itinerarySequence: 1,
        actionState: 'current',
        pickup: {
            ...pickupWithTwoManifests,
            manifests: [
                {
                    ...firstPickupManifest,
                    state: 'confirmed',
                    confirmedAt: occurredAt,
                },
                secondPickupManifest,
            ],
        },
    },
]);

export function DriverDashboardPickupManifestAdvanceStory() {
    const [advanced, setAdvanced] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setAdvanced(true)}>
                Potvrdi prvi manifest
            </button>
            <DashboardStory
                dashboardData={
                    advanced
                        ? advancedPickupManifestDashboard
                        : pickupManifestDashboard
                }
                deliveryQueue={emptyActionQueue}
                onPickupItemState={() => ({
                    status: 'failed',
                    message: 'Ishod preuzimanja nije spremljen.',
                })}
            />
        </>
    );
}

const blockedEarlierPickupQueue: PickupManifestQueueSnapshot = {
    scope: {
        userId: dashboard.user.id,
        runId: 'run-component-4127',
    },
    status: 'conflicted',
    durability: 'durable',
    coordination: 'coordinated',
    entries: [
        {
            sequence: 0,
            command: {
                kind: 'scan',
                operationId: 'pickup-earlier-conflict',
                runId: 'run-component-4127',
                pickupNodeId: 'pickup-earlier',
                occurredAt,
                tracePath: '/trag/pickup-earlier-0001',
            },
            state: 'conflicted',
            attemptCount: 1,
            updatedAt: occurredAt,
            errorCode: 'pickup-trace-not-found',
        },
    ],
    queuedCount: 0,
    sendingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    conflictedCount: 1,
};

export function DriverDashboardEarlierPickupConflictStory() {
    const [discardedOperationId, setDiscardedOperationId] = useState('none');
    return (
        <>
            <output data-testid="pickup-recovery-result">
                {discardedOperationId}
            </output>
            <DashboardStory
                dashboardData={pickupManifestDashboard}
                deliveryQueue={emptyActionQueue}
                pickupQueue={blockedEarlierPickupQueue}
                onDiscardPickupSync={setDiscardedOperationId}
            />
        </>
    );
}

const blockedEarlierPickupFailureQueue: PickupManifestQueueSnapshot = {
    ...blockedEarlierPickupQueue,
    status: 'failed',
    entries: blockedEarlierPickupQueue.entries.map((entry) => ({
        ...entry,
        command: {
            ...entry.command,
            operationId: 'pickup-earlier-failure',
        },
        state: 'failed',
        errorCode: 'transport-error',
    })),
    failedCount: 1,
    conflictedCount: 0,
};

export function DriverDashboardEarlierPickupFailureStory() {
    return (
        <DashboardStory
            dashboardData={pickupManifestDashboard}
            deliveryQueue={emptyActionQueue}
            pickupQueue={blockedEarlierPickupFailureQueue}
        />
    );
}

const readyToConfirmPickup: DeliveryPickupStepSummary = {
    ...currentPickupFixture,
    expectedCount: 1,
    scannedCount: 1,
    remainingCount: 0,
    manifests: currentPickupFixture.manifests.map((manifest) => ({
        ...manifest,
        expectedCount: 1,
        scannedCount: 1,
        remainingCount: 0,
        items: manifest.items.map((item) => ({
            ...item,
            state: 'scanned',
        })),
    })),
};

const readyToConfirmPickupDashboard = dashboardWithRouteSteps([
    {
        kind: 'pickup',
        itinerarySequence: 1,
        actionState: 'current',
        pickup: readyToConfirmPickup,
    },
]);

function earlierPickupQueue(
    state: 'failed' | 'queued' | 'sending' | 'synced',
): PickupManifestQueueSnapshot {
    return {
        ...blockedEarlierPickupFailureQueue,
        status: state,
        entries: blockedEarlierPickupFailureQueue.entries.map((entry) => ({
            ...entry,
            state,
            ...(state === 'failed'
                ? { errorCode: 'transport-error' }
                : { errorCode: undefined }),
        })),
        queuedCount: state === 'queued' ? 1 : 0,
        sendingCount: state === 'sending' ? 1 : 0,
        syncedCount: state === 'synced' ? 1 : 0,
        failedCount: state === 'failed' ? 1 : 0,
    };
}

export function DriverDashboardEarlierPickupDeferredRetryStory({
    sendRetry = false,
    completeRetry = false,
}: {
    sendRetry?: boolean;
    completeRetry?: boolean;
}) {
    const [queueState, setQueueState] = useState<
        'failed' | 'queued' | 'sending' | 'synced'
    >('failed');
    const resolveRetryRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (completeRetry) {
            setQueueState('synced');
            resolveRetryRef.current?.();
            resolveRetryRef.current = null;
            return;
        }
        if (sendRetry) setQueueState('sending');
    }, [completeRetry, sendRetry]);

    return (
        <>
            <output data-testid="pickup-queue-state">{queueState}</output>
            <DashboardStory
                dashboardData={readyToConfirmPickupDashboard}
                deliveryQueue={emptyActionQueue}
                pickupQueue={earlierPickupQueue(queueState)}
                onRetryPickupSync={() => {
                    setQueueState('queued');
                    return new Promise<void>((resolve) => {
                        resolveRetryRef.current = resolve;
                    });
                }}
            />
        </>
    );
}

const crossQueuePickupDashboard = dashboardWithRouteSteps(
    [
        {
            kind: 'delivery',
            itinerarySequence: 1,
            retryLaneRank: null,
            retryAttempt: 0,
            actionState: 'current',
            lockedReason: null,
            stop: mixedStatusStop,
        },
        {
            kind: 'pickup',
            itinerarySequence: 2,
            actionState: 'locked',
            pickup: currentPickupFixture,
        },
    ],
    [mixedStatusStop],
);

export function DriverDashboardCrossQueuePickupStory() {
    return (
        <DashboardStory
            dashboardData={crossQueuePickupDashboard}
            deliveryQueue={actionQueue}
        />
    );
}

const locallyAdvancedDeferredDashboard = dashboardWithRouteSteps(
    [
        {
            kind: 'delivery',
            itinerarySequence: 1,
            retryLaneRank: null,
            retryAttempt: 0,
            actionState: 'current',
            lockedReason: null,
            stop: mixedStatusStop,
        },
        {
            kind: 'delivery',
            itinerarySequence: 2,
            retryLaneRank: 1,
            retryAttempt: 1,
            actionState: 'upcoming',
            lockedReason: null,
            stop: deferredRetryStop,
        },
    ],
    [mixedStatusStop, deferredRetryStop],
);

export function DriverDashboardLocallyAdvancedDeferredStory() {
    return (
        <DashboardStory
            dashboardData={locallyAdvancedDeferredDashboard}
            deliveryQueue={actionQueue}
        />
    );
}
