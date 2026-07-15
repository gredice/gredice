import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryActionCompletionMessage,
    deliveryRouteStepsWithLocalActions,
} from './deliveryActionPresentation';
import type {
    DeliveryActionCommandState,
    DeliveryActionQueueEntry,
    DeliveryActionQueueSnapshot,
} from './deliveryActionQueue';
import type {
    DeliveryRouteStepSummary,
    DeliveryStopSummary,
} from './deliveryDashboardTypes';

const occurredAt = '2026-07-15T12:00:00.000Z';

function stop(id: number, isCurrent: boolean): DeliveryStopSummary {
    return {
        id,
        requestId: `request-${id}`,
        sequence: id,
        stopState: 'pending',
        requestState: 'in_delivery',
        statusLabel: 'U dostavi',
        isCurrent,
        contactName: `Kontakt ${id}`,
        phone: null,
        address: `Adresa ${id}, Zagreb`,
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        slotStartAt: null,
        slotEndAt: null,
        estimatedArrivalAt: null,
        estimatedTravelSeconds: null,
        estimatedDistanceMeters: null,
        reroutePending: false,
        arrivedAt: null,
        deliveredAt: null,
        harvest: {
            plantName: 'Rajčica',
            operationName: null,
            raisedBedName: 'Gredica A',
            fieldName: null,
            tracePath: `/trag/route-${id}`,
        },
        recovery: null,
        tracking: null,
        runId: 'run-route-projection',
        deliveryCount: 1,
        deliveries: [],
    };
}

function deliveryStep(
    id: number,
    actionState: 'locked' | 'upcoming' | 'current' | 'completed',
): DeliveryRouteStepSummary {
    return {
        kind: 'delivery',
        itinerarySequence: id,
        retryLaneRank: null,
        retryAttempt: 0,
        actionState,
        lockedReason: actionState === 'locked' ? 'Prethodni korak' : null,
        stop: stop(id, actionState === 'current'),
    };
}

function deliverEntry(
    stopId: number,
    sequence: number,
    state: DeliveryActionCommandState,
    reroutePending = false,
): DeliveryActionQueueEntry {
    const acknowledgement: DeliveryActionQueueEntry['acknowledgement'] =
        state === 'synced'
            ? {
                  kind: 'server',
                  replayed: false,
                  routeRevision: 11 + sequence,
                  reroutePending,
                  runCompleted: false,
              }
            : undefined;
    return {
        sequence,
        command: {
            kind: 'deliver',
            operationId: `deliver-${stopId}`,
            runId: 'run-route-projection',
            stopId,
            expectedRouteRevision: 10 + sequence,
            occurredAt,
        },
        state,
        attemptCount: state === 'queued' ? 0 : 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        ...(acknowledgement ? { acknowledgement } : {}),
    };
}

function queue(
    entries: readonly DeliveryActionQueueEntry[],
): DeliveryActionQueueSnapshot {
    return {
        scope: {
            userId: 'driver-route-projection',
            runId: 'run-route-projection',
        },
        durability: 'durable',
        coordination: 'coordinated',
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

test('queued completion locally advances the already loaded route to its next stop', () => {
    const projected = deliveryRouteStepsWithLocalActions(
        [deliveryStep(1, 'current'), deliveryStep(2, 'upcoming')],
        queue([deliverEntry(1, 0, 'queued')]),
    );

    assert.equal(projected[0]?.actionState, 'completed');
    assert.equal(projected[0]?.kind, 'delivery');
    if (projected[0]?.kind === 'delivery') {
        assert.equal(projected[0].stop.isCurrent, false);
    }
    assert.equal(projected[1]?.actionState, 'current');
    assert.equal(projected[1]?.kind, 'delivery');
    if (projected[1]?.kind === 'delivery') {
        assert.equal(projected[1].stop.isCurrent, true);
        assert.equal(projected[1].lockedReason, null);
    }
});

test('ordered local completions advance repeatedly but a failed action remains a barrier', () => {
    const steps = [
        deliveryStep(1, 'current'),
        deliveryStep(2, 'upcoming'),
        deliveryStep(3, 'locked'),
    ];
    const advanced = deliveryRouteStepsWithLocalActions(
        steps,
        queue([deliverEntry(1, 0, 'synced'), deliverEntry(2, 1, 'sending')]),
    );
    assert.deepEqual(
        advanced.map((step) => step.actionState),
        ['completed', 'completed', 'current'],
    );

    const blocked = deliveryRouteStepsWithLocalActions(
        steps,
        queue([deliverEntry(1, 0, 'failed')]),
    );
    assert.equal(blocked, steps);
});

test('server acknowledgement that requires a reroute never advances the stale route', () => {
    const steps = [deliveryStep(1, 'current'), deliveryStep(2, 'upcoming')];
    const projected = deliveryRouteStepsWithLocalActions(
        steps,
        queue([deliverEntry(1, 0, 'synced', true)]),
    );

    assert.equal(projected, steps);
});

test('completion copy distinguishes device-pending from server-acknowledged state', () => {
    assert.match(
        deliveryActionCompletionMessage(deliverEntry(1, 0, 'queued')),
        /čeka potvrdu poslužitelja/,
    );
    assert.match(
        deliveryActionCompletionMessage(deliverEntry(1, 0, 'synced'), true),
        /Poslužitelj je potvrdio dostavu.*Možeš nastaviti/,
    );
});
