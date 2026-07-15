'use client';

import { DriverDashboard } from '../components/DriverDashboard';
import type { DriverRouteWakeLockState } from '../hooks/useDriverRouteWakeLock';
import type { DriverTrackingState } from '../hooks/useDriverTracking';
import type {
    DeliveryActionQueueEntry,
    DeliveryActionQueueSnapshot,
} from '../lib/deliveryActionQueue';
import type {
    DeliveryStopSummary,
    DriverDeliveryDashboard,
} from '../lib/deliveryDashboardTypes';
import { mixedStatusStop } from './deliveryRecoveryFixtures';

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
    deliveryQueue,
}: {
    deliveryQueue: DeliveryActionQueueSnapshot;
}) {
    return (
        <DriverDashboard
            dashboard={dashboard}
            routeWakeLock={routeWakeLock}
            trackingState={trackingState}
            pendingAction={null}
            onSelectionChange={() => undefined}
            onStartRun={() => undefined}
            onRetry={() => undefined}
            onArrive={() => undefined}
            onDeliver={() => undefined}
            onException={async () => ({ status: 'saved' })}
            pickupQueue={null}
            deliveryQueue={deliveryQueue}
            onPickupScan={() => undefined}
            onPickupItemState={() => undefined}
            onConfirmPickupManifest={() => undefined}
            onRetryPickupSync={() => undefined}
            onDiscardPickupSync={() => undefined}
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
