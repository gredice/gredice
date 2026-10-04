import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    DeliveryRouteStepSummary,
    DeliveryStopDeliverySummary,
    DeliveryStopSummary,
} from './deliveryDashboardTypes';
import {
    deliveryRouteStepIdentity,
    deliveryRouteTimelineItems,
} from './deliveryRouteTimelinePresentation';

function deliveryItem(index: number): DeliveryStopDeliverySummary {
    return {
        stopId: index,
        stopState: 'pending',
        requestId: `request-${index}`,
        requestState: 'in_delivery',
        contactName: `Primatelj ${index}`,
        phone: '+385 91 555 0101',
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        harvest: {
            plantName: `Urod ${index}`,
            operationName: 'Berba',
            raisedBedName: `Gredica ${index}`,
            fieldName: null,
            tracePath: `/trag/${index}`,
        },
        exception: null,
    };
}

function deliveryStep({
    id,
    actionState,
    stopState = 'pending',
    retryLaneRank = null,
    deliveryCount = 1,
}: {
    id: number | null;
    actionState: Extract<
        DeliveryRouteStepSummary,
        { kind: 'delivery' }
    >['actionState'];
    stopState?: string;
    retryLaneRank?: number | null;
    deliveryCount?: number;
}): Extract<DeliveryRouteStepSummary, { kind: 'delivery' }> {
    const numericId = id ?? 99;
    const deliveries = Array.from({ length: deliveryCount }, (_, index) =>
        deliveryItem(numericId * 10 + index),
    );
    const stop: DeliveryStopSummary = {
        id,
        requestId: `request-stop-${numericId}`,
        sequence: numericId,
        stopState,
        requestState: 'in_delivery',
        statusLabel: stopState === 'delivered' ? 'Dostavljeno' : 'U dostavi',
        isCurrent: actionState === 'current',
        contactName: `Primatelj ${numericId}`,
        phone: '+385 91 555 0101',
        address: `Adresa ${numericId}, Zagreb`,
        addressLabel: `Ulaz ${numericId}`,
        requestNotes: null,
        deliveryNotes: null,
        slotStartAt: null,
        slotEndAt: null,
        estimatedArrivalAt: '2026-07-15T10:00:00.000Z',
        estimatedTravelSeconds: 600,
        estimatedDistanceMeters: 2_000,
        reroutePending: false,
        arrivedAt: null,
        deliveredAt:
            stopState === 'delivered' ? '2026-07-15T09:45:00.000Z' : null,
        harvest: deliveries[0]?.harvest ?? deliveryItem(1).harvest,
        recovery: null,
        tracking: null,
        runId: 'run-timeline',
        deliveryCount,
        deliveries,
        actionState,
        lockedReason: actionState === 'locked' ? 'Prethodna stanica' : null,
    };
    return {
        kind: 'delivery',
        itinerarySequence: numericId,
        mapNodeId: id === null ? undefined : String(deliveries[0]?.stopId),
        retryLaneRank,
        retryAttempt: retryLaneRank === null ? 0 : 1,
        actionState,
        lockedReason: stop.lockedReason ?? null,
        stop,
    };
}

function pickupStep(
    id: string,
    itinerarySequence: number,
): Extract<DeliveryRouteStepSummary, { kind: 'pickup' }> {
    return {
        kind: 'pickup',
        itinerarySequence,
        actionState: 'completed',
        pickup: {
            id,
            pickupLocationId: itinerarySequence,
            sequence: itinerarySequence,
            itinerarySequence,
            name: `Preuzimanje ${itinerarySequence}`,
            address: `Lokacija ${itinerarySequence}, Zagreb`,
            estimatedArrivalAt: null,
            estimatedTravelSeconds: null,
            estimatedDistanceMeters: null,
            serviceDurationSeconds: null,
            state: 'confirmed',
            isCurrent: false,
            expectedCount: 2,
            scannedCount: 2,
            missingLabelCount: 0,
            notReadyCount: 0,
            remainingCount: 0,
            manifests: [],
        },
    };
}

test('derives completed, current, next, and locked route states with bulk counts', () => {
    const steps: DeliveryRouteStepSummary[] = [
        deliveryStep({
            id: 1,
            actionState: 'completed',
            stopState: 'delivered',
        }),
        deliveryStep({ id: 2, actionState: 'current', deliveryCount: 3 }),
        deliveryStep({ id: 3, actionState: 'upcoming' }),
        deliveryStep({ id: 4, actionState: 'locked' }),
    ];

    const items = deliveryRouteTimelineItems(steps);
    assert.deepEqual(
        items.map((item) => item.state),
        ['completed', 'current', 'next', 'locked'],
    );
    assert.equal(items[1]?.deliveryCount, 3);
    assert.equal(items[1]?.title, 'Ulaz 2');
    assert.deepEqual(items[1]?.mapSelection, {
        kind: 'delivery',
        id: '20',
    });
});

test('keeps retry and terminal exception states ahead of route progress state', () => {
    const items = deliveryRouteTimelineItems([
        deliveryStep({
            id: 5,
            actionState: 'completed',
            stopState: 'failed',
        }),
        deliveryStep({
            id: 6,
            actionState: 'current',
            stopState: 'deferred',
            retryLaneRank: 1,
        }),
    ]);

    assert.deepEqual(
        items.map((item) => item.state),
        ['exception', 'retry'],
    );
});

test('labels locally completed steps as syncing without masking exceptions', () => {
    const completed = deliveryStep({ id: 7, actionState: 'completed' });
    const exception = deliveryStep({
        id: 8,
        actionState: 'completed',
        stopState: 'cancelled',
    });
    const syncingIds = new Set([
        deliveryRouteStepIdentity(completed),
        deliveryRouteStepIdentity(exception),
    ]);

    const items = deliveryRouteTimelineItems(
        [completed, exception],
        syncingIds,
    );
    assert.deepEqual(
        items.map((item) => item.state),
        ['syncing', 'exception'],
    );
});

test('uses a stable request fallback when a delivery has no persisted stop id', () => {
    const step = deliveryStep({ id: null, actionState: 'current' });
    assert.equal(deliveryRouteStepIdentity(step), 'delivery:request-stop-99');
    const withoutMapSequence = {
        ...step,
        stop: { ...step.stop, sequence: null },
    };
    assert.equal(
        deliveryRouteTimelineItems([withoutMapSequence])[0]?.mapSelection,
        null,
    );
});

test('maps pickup checkpoints to their stable persisted identities', () => {
    const items = deliveryRouteTimelineItems([
        pickupStep('pickup-a', 1),
        pickupStep('pickup-b', 2),
    ]);
    assert.deepEqual(
        items.map((item) => item.mapSelection),
        [
            { kind: 'pickup', id: 'pickup-a' },
            { kind: 'pickup', id: 'pickup-b' },
        ],
    );
});
