import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    projectSelectedRaisedBedPlantingLifecycle,
    type SelectedRaisedBedPlantingEvent,
    SelectedRaisedBedPlantingLifecycleProjectionError,
} from '../src/helpers/selectedRaisedBedPlantingLifecycle';
import { knownEventTypes } from '../src/repositories/events';

const aggregateId = 'raised-bed-planting:selected:lifecycle-test';
const currentDate = new Date('2026-08-10T12:00:00.000Z');

function lifecycleEvent({
    createdAt,
    data,
    id,
    type,
}: {
    createdAt: string;
    data: Record<string, unknown>;
    id: number;
    type: string;
}): SelectedRaisedBedPlantingEvent {
    return {
        id,
        type,
        version: 1,
        aggregateId,
        data,
        createdAt: new Date(createdAt),
    };
}

function startEvent(): SelectedRaisedBedPlantingEvent {
    return lifecycleEvent({
        id: 1,
        type: knownEventTypes.raisedBedPlantings.lifecycleStarted,
        createdAt: '2026-08-01T08:00:00.000Z',
        data: {
            commandId: randomUUID(),
            plantingId: 71,
            plantSortId: 81,
            status: 'planned',
            scheduledDate: '2026-08-02T08:00:00.000Z',
            sowingLocation: 'direct',
            startedBy: 'system:checkout',
            purchase: {
                cartItemId: 91,
                currency: 'eur',
                euroAmountCents: 1250,
            },
        },
    });
}

function commandEvent({
    createdAt,
    data,
    id,
    type,
}: {
    createdAt: string;
    data: Record<string, unknown>;
    id: number;
    type: string;
}) {
    return lifecycleEvent({
        id,
        type,
        createdAt,
        data: {
            commandId: randomUUID(),
            expectedLifecycleVersionEventId: id - 1,
            ...data,
        },
    });
}

function project(events: SelectedRaisedBedPlantingEvent[]) {
    return projectSelectedRaisedBedPlantingLifecycle(
        events,
        { aggregateId, plantingId: 71, plantSortId: 81 },
        { currentDate },
    );
}

function expectProjectionError(
    callback: () => unknown,
    code: SelectedRaisedBedPlantingLifecycleProjectionError['code'],
) {
    assert.throws(callback, (error: unknown) => {
        assert.ok(
            error instanceof SelectedRaisedBedPlantingLifecycleProjectionError,
        );
        assert.equal(error.code, code);
        return true;
    });
}

test('projects a task-visible canonical start with immutable purchase identity', () => {
    const projection = project([startEvent()]);

    assert.equal(projection.status, 'planned');
    assert.equal(projection.isActive, true);
    assert.equal(projection.versionEventId, 1);
    assert.deepStrictEqual(projection.task.identity, {
        kind: 'selected',
        plantingId: 71,
        expectedLifecycleVersionEventId: 1,
        expectedPlantSortId: 81,
    });
    assert.deepStrictEqual(projection.task.purchase, {
        cartItemId: 91,
        currency: 'eur',
        euroAmountCents: 1250,
    });
});

test('rejects completing a blocked task until an explicit unblock or reschedule', () => {
    const blocked = commandEvent({
        id: 2,
        type: knownEventTypes.raisedBedPlantings.taskBlocked,
        createdAt: '2026-08-02T08:00:00.000Z',
        data: {
            blockedBy: 'farmer-1',
            reasonCode: 'missing_materials',
            reasonLabel: 'Nedostaje materijal ili oprema',
        },
    });
    const completed = commandEvent({
        id: 3,
        type: knownEventTypes.raisedBedPlantings.taskCompleted,
        createdAt: '2026-08-03T08:00:00.000Z',
        data: {
            completedBy: 'farmer-1',
            images: [],
            status: 'pendingVerification',
        },
    });

    expectProjectionError(
        () => project([startEvent(), blocked, completed]),
        'invalid_transition',
    );
});

test('enforces canonical crop transitions and rejects harvested backtracking', () => {
    const completed = commandEvent({
        id: 2,
        type: knownEventTypes.raisedBedPlantings.taskCompleted,
        createdAt: '2026-08-02T08:00:00.000Z',
        data: { completedBy: 'admin-1', images: [], status: 'sowed' },
    });
    const sprouted = commandEvent({
        id: 3,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-03T08:00:00.000Z',
        data: {
            changedBy: 'admin-1',
            effectiveAt: '2026-08-03T08:00:00.000Z',
            status: 'sprouted',
        },
    });
    const ready = commandEvent({
        id: 4,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-04T08:00:00.000Z',
        data: {
            changedBy: 'admin-1',
            effectiveAt: '2026-08-04T08:00:00.000Z',
            status: 'ready',
        },
    });
    const harvested = commandEvent({
        id: 5,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-05T08:00:00.000Z',
        data: {
            changedBy: 'admin-1',
            effectiveAt: '2026-08-05T08:00:00.000Z',
            status: 'harvested',
        },
    });
    const backtracked = commandEvent({
        id: 6,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-06T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'sprouted' },
    });

    expectProjectionError(
        () =>
            project([
                startEvent(),
                completed,
                sprouted,
                ready,
                harvested,
                backtracked,
            ]),
        'invalid_transition',
    );
});

test('rejects out-of-order and future effective lifecycle dates', () => {
    const completed = commandEvent({
        id: 2,
        type: knownEventTypes.raisedBedPlantings.taskCompleted,
        createdAt: '2026-08-04T08:00:00.000Z',
        data: { completedBy: 'admin-1', images: [], status: 'sowed' },
    });
    const outOfOrder = commandEvent({
        id: 3,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-05T08:00:00.000Z',
        data: {
            changedBy: 'admin-1',
            effectiveAt: '2026-08-03T08:00:00.000Z',
            status: 'sprouted',
        },
    });
    const future = commandEvent({
        id: 3,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-10T08:00:00.000Z',
        data: {
            changedBy: 'admin-1',
            effectiveAt: '2026-08-11T08:00:00.000Z',
            status: 'sprouted',
        },
    });

    expectProjectionError(
        () => project([startEvent(), completed, outOfOrder]),
        'invalid_transition',
    );
    expectProjectionError(
        () => project([startEvent(), completed, future]),
        'invalid_transition',
    );
});

test('allows failed-growth corrections but keeps selected removal final', () => {
    const completed = commandEvent({
        id: 2,
        type: knownEventTypes.raisedBedPlantings.taskCompleted,
        createdAt: '2026-08-02T08:00:00.000Z',
        data: { completedBy: 'admin-1', images: [], status: 'sowed' },
    });
    const notSprouted = commandEvent({
        id: 3,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-03T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'notSprouted' },
    });
    const corrected = commandEvent({
        id: 4,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-04T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'sprouted' },
    });
    const died = commandEvent({
        id: 5,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-05T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'died' },
    });
    const correctedAgain = commandEvent({
        id: 6,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-06T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'sprouted' },
    });
    const removed = commandEvent({
        id: 7,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-07T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'died' },
    });
    const explicitlyRemoved = commandEvent({
        id: 8,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-08T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'removed' },
    });
    const unsafeReactivation = commandEvent({
        id: 9,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-09T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'sowed' },
    });

    const correctedProjection = project([
        startEvent(),
        completed,
        notSprouted,
        corrected,
        died,
        correctedAgain,
    ]);
    assert.equal(correctedProjection.status, 'sprouted');
    assert.equal(correctedProjection.stoppedAt, null);
    assert.equal(correctedProjection.isActive, true);
    expectProjectionError(
        () =>
            project([
                startEvent(),
                completed,
                notSprouted,
                corrected,
                died,
                correctedAgain,
                removed,
                explicitlyRemoved,
                unsafeReactivation,
            ]),
        'invalid_transition',
    );
});

test('persists same-status commands without changing the effective status date', () => {
    const initial = startEvent();
    const sameStatus = commandEvent({
        id: 2,
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        createdAt: '2026-08-05T08:00:00.000Z',
        data: { changedBy: 'admin-1', status: 'planned' },
    });
    const projection = project([initial, sameStatus]);

    assert.equal(projection.versionEventId, 2);
    assert.equal(projection.statusEventId, 2);
    assert.equal(
        projection.statusChanges.at(-1)?.occurredAt.getTime(),
        initial.createdAt.getTime(),
    );
});
