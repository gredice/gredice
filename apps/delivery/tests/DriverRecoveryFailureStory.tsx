'use client';

import { DeliveryPickupCard } from '../components/DeliveryPickupCard';
import { DeliveryActionSyncStatus } from '../components/DriverDashboard';
import type { DeliveryActionQueueSnapshot } from '../lib/deliveryActionQueue';
import { currentPickupFixture } from './DriverCurrentStopCommandCenterStory';

const occurredAt = '2026-07-15T08:32:00.000Z';

const failedDeliveryQueue: DeliveryActionQueueSnapshot = {
    scope: {
        userId: 'driver-recovery-failure',
        runId: 'run-recovery-failure',
    },
    durability: 'durable',
    coordination: 'coordinated',
    entries: [
        {
            sequence: 0,
            command: {
                kind: 'deliver',
                operationId: 'operation-non-current-delivery',
                runId: 'run-recovery-failure',
                stopId: 42,
                expectedRouteRevision: 12,
                occurredAt,
            },
            state: 'failed',
            attemptCount: 1,
            createdAt: occurredAt,
            updatedAt: occurredAt,
            errorCode: 'offline',
        },
    ],
    queuedCount: 0,
    sendingCount: 0,
    reconcilingCount: 0,
    syncedCount: 0,
    failedCount: 1,
    conflictedCount: 0,
};

export function NonCurrentDeliveryRecoveryFailureStory() {
    return (
        <main className="p-4">
            <DeliveryActionSyncStatus
                snapshot={failedDeliveryQueue}
                currentStopId={41}
                onRetry={() => ({
                    status: 'failed',
                    message: 'Ponovno slanje dostave nije uspjelo.',
                })}
                onRecoverConflict={() => ({ status: 'saved' })}
                onReconcile={() => ({ status: 'saved' })}
            />
        </main>
    );
}

export function NonCurrentPickupRecoveryFailureStory() {
    return (
        <main className="p-4">
            <DeliveryPickupCard
                pickup={currentPickupFixture}
                actionState="locked"
                pendingAction={null}
                showCurrentCommand={false}
                sync={{
                    state: 'failed',
                    pendingCount: 1,
                    durability: 'durable',
                    coordination: 'coordinated',
                    blockingOperationId: 'operation-non-current-pickup',
                }}
                onScan={() => ({ status: 'pickup-invalid' })}
                onSetItemState={() => undefined}
                onResolveRemaining={() => undefined}
                onConfirmManifest={() => undefined}
                onRetrySync={() => ({
                    status: 'failed',
                    message: 'Ponovno slanje preuzimanja nije uspjelo.',
                })}
                onDiscardSync={() => ({ status: 'saved' })}
            />
        </main>
    );
}
