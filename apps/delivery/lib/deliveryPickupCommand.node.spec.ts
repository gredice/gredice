import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliveryPickupManifestSummary } from './deliveryDashboardTypes';
import { resolveRemainingPickupManifest } from './deliveryPickupCommand';

const manifest: DeliveryPickupManifestSummary = {
    id: 'manifest-bulk-command',
    timeSlotId: 1,
    startAt: '2026-07-15T08:00:00.000Z',
    endAt: '2026-07-15T09:00:00.000Z',
    state: 'pending',
    confirmedAt: null,
    expectedCount: 3,
    scannedCount: 0,
    missingLabelCount: 0,
    notReadyCount: 0,
    remainingCount: 3,
    items: [1, 2, 3].map((stopId) => ({
        id: `pickup-item-${stopId}`,
        stopId,
        requestId: `request-${stopId}`,
        stopKey: `stop-${stopId}`,
        state: 'ready',
        resolvedAt: null,
        tracePath: `/trag/pickup-item-${stopId}`,
        harvest: {
            plantName: `Urod ${stopId}`,
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: `/trag/pickup-item-${stopId}`,
        },
    })),
};

test('bulk pickup resolution stops and returns the first durable failure', async () => {
    const attemptedStopIds: number[] = [];
    const result = await resolveRemainingPickupManifest(
        'pickup-node',
        manifest,
        (_pickupNodeId, _manifestId, stopId) => {
            attemptedStopIds.push(stopId);
            return stopId === 2
                ? {
                      status: 'failed' as const,
                      message: 'Drugi urod nije spremljen.',
                  }
                : { status: 'saved' as const };
        },
    );

    assert.deepEqual(attemptedStopIds, [1, 2]);
    assert.deepEqual(result, {
        status: 'failed',
        message: 'Drugi urod nije spremljen.',
    });
});
