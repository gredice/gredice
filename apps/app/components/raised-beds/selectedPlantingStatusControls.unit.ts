import assert from 'node:assert/strict';
import test from 'node:test';
import { getSelectedPlantingStatusControl } from './selectedPlantingStatusControls';

function planting(): NonNullable<
    Parameters<typeof getSelectedPlantingStatusControl>[0]
> {
    return {
        configurationSource: 'selected',
        isActive: true,
        lifecycleStatus: 'sprouted',
        lifecycleStartedAt: new Date('2026-08-01T08:00:00Z'),
        lifecycleStatusChanges: [
            {
                eventId: 1,
                status: 'planned',
                occurredAt: new Date('2026-08-01T08:00:00Z'),
            },
            {
                eventId: 2,
                status: 'sowed',
                occurredAt: new Date('2026-08-02T08:00:00Z'),
            },
            {
                eventId: 3,
                status: 'sprouted',
                occurredAt: new Date('2026-08-04T08:00:00Z'),
            },
        ],
        selectedTask: {
            identity: {
                kind: 'selected',
                plantingId: 20,
                expectedPlantSortId: 50,
                expectedLifecycleVersionEventId: 3,
            },
            status: 'completed',
            sowingLocation: 'greenhouse',
            scheduledDate: null,
            initialScheduledDate: null,
            initialSowingLocation: 'greenhouse',
            startedBy: 'user',
            initialCommandId: 'command',
            assignedUserIds: [],
            assignedBy: null,
            assignedAt: null,
            block: null,
            cancellation: null,
            verification: null,
            completion: null,
        },
    };
}

test('offers valid lifecycle changes and retains planting identity and version', () => {
    const control = getSelectedPlantingStatusControl(planting());
    assert.ok(control);
    assert.deepEqual(control.identity, planting().selectedTask?.identity);
    assert.deepEqual(
        control.options.map((item) => item.value),
        [
            'sprouted',
            'firstFlowers',
            'firstFruitSet',
            'notSprouted',
            'died',
            'ready',
        ],
    );
});

test('date corrections use the previous distinct status while transitions use the latest status date', () => {
    const control = getSelectedPlantingStatusControl(planting());
    assert.equal(
        control?.options.find((item) => item.value === 'sprouted')?.minimumDate,
        '2026-08-02T08:00:00.000Z',
    );
    assert.equal(
        control?.options.find((item) => item.value === 'ready')?.minimumDate,
        '2026-08-04T08:00:00.000Z',
    );
});

test('hides lifecycle mutations until sowing is verified and after removal', () => {
    const item = planting();
    assert.ok(item.selectedTask);
    for (const status of [
        'planned',
        'blocked',
        'pendingVerification',
        'cancelled',
    ] as const) {
        assert.equal(
            getSelectedPlantingStatusControl({
                ...item,
                selectedTask: { ...item.selectedTask, status },
            }),
            null,
        );
    }
    assert.equal(
        getSelectedPlantingStatusControl({ ...item, isActive: false }),
        null,
    );
    assert.equal(
        getSelectedPlantingStatusControl({
            ...item,
            configurationSource: 'legacy',
        }),
        null,
    );
    assert.equal(
        getSelectedPlantingStatusControl({
            ...item,
            lifecycleStatus: 'removed',
        }),
        null,
    );
});
