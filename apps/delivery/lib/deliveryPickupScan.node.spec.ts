import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliveryPickupStepSummary } from './deliveryDashboardTypes';
import { scanPickupManifest } from './deliveryPickupScan';

const pickup: DeliveryPickupStepSummary = {
    id: 'pickup-scan-test',
    pickupLocationId: 1,
    sequence: 1,
    itinerarySequence: 1,
    name: 'HQ',
    address: 'HQ 1, Zagreb',
    estimatedArrivalAt: null,
    estimatedTravelSeconds: null,
    estimatedDistanceMeters: null,
    serviceDurationSeconds: null,
    state: 'partial',
    isCurrent: true,
    expectedCount: 1,
    scannedCount: 0,
    missingLabelCount: 0,
    notReadyCount: 0,
    remainingCount: 1,
    manifests: [
        {
            id: 'manifest-scan-test',
            timeSlotId: 1,
            startAt: '2026-07-15T08:00:00.000Z',
            endAt: '2026-07-15T09:00:00.000Z',
            state: 'pending',
            confirmedAt: null,
            expectedCount: 1,
            scannedCount: 0,
            missingLabelCount: 0,
            notReadyCount: 0,
            remainingCount: 1,
            items: [
                {
                    id: 'pickup-scan-item',
                    stopId: 1,
                    requestId: 'pickup-scan-request',
                    stopKey: 'pickup-scan-stop',
                    state: 'ready',
                    resolvedAt: null,
                    tracePath: '/trag/pickup-scan-test',
                    harvest: {
                        plantName: 'Rajčica',
                        operationName: null,
                        raisedBedName: null,
                        fieldName: null,
                        tracePath: '/trag/pickup-scan-test',
                    },
                },
            ],
        },
    ],
};

test('pickup scan reports success only after durable enqueue succeeds', async () => {
    const calls: string[] = [];
    const saved = await scanPickupManifest(
        pickup,
        '/trag/pickup-scan-test',
        async (_pickupNodeId, tracePath) => {
            calls.push(tracePath);
            return { status: 'saved' as const };
        },
    );
    assert.deepEqual(calls, ['/trag/pickup-scan-test']);
    assert.equal(saved.status, 'pickup-queued');

    const failed = await scanPickupManifest(
        pickup,
        '/trag/pickup-scan-test',
        async () => ({
            status: 'failed' as const,
            message: 'Skeniranje nije spremljeno.',
        }),
    );
    assert.deepEqual(failed, {
        status: 'pickup-failed',
        tracePath: '/trag/pickup-scan-test',
        plantName: 'Rajčica',
        message: 'Skeniranje nije spremljeno.',
    });
});
