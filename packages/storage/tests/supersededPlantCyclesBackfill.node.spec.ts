import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type PlantCycleRepairEvent,
    planSupersededPlantCycleRepairs,
} from '../scripts/lib/supersededPlantCycles';

function event(
    id: number,
    type: string,
    createdAt: string,
    data: unknown = null,
): PlantCycleRepairEvent {
    return {
        aggregateId: '12|2',
        createdAt: new Date(createdAt),
        data,
        id,
        type,
    };
}

test('plans a terminal event for an active cycle superseded by a placement', () => {
    const plan = planSupersededPlantCycleRepairs([
        event(1, 'raisedBedField.plantPlace', '2026-01-01T00:00:00.000Z'),
        event(2, 'raisedBedField.plantUpdate', '2026-01-02T00:00:00.000Z', {
            status: 'planned',
        }),
        event(3, 'raisedBedField.plantPlace', '2026-02-01T00:00:00.000Z'),
    ]);

    assert.deepStrictEqual(plan.unsafe, []);
    assert.strictEqual(plan.repairs.length, 1);
    assert.deepStrictEqual(plan.repairs[0], {
        aggregateId: '12|2',
        nextPlantPlaceEventId: 3,
        positionIndex: 2,
        raisedBedId: 12,
        repairCreatedAt: new Date('2026-01-31T23:59:59.999Z'),
        repairKey: 'superseded-plant-cycle:1:3',
        supersededPlantPlaceEventId: 1,
    });
});

test('does not repair a cycle with an existing terminal event', () => {
    const plan = planSupersededPlantCycleRepairs([
        event(1, 'raisedBedField.plantPlace', '2026-01-01T00:00:00.000Z'),
        event(2, 'raisedBedField.plantUpdate', '2026-01-02T00:00:00.000Z', {
            status: 'removed',
        }),
        event(3, 'raisedBedField.plantPlace', '2026-02-01T00:00:00.000Z'),
    ]);

    assert.deepStrictEqual(plan, { repairs: [], unsafe: [] });
});

test('a planned repair is idempotent after its synthetic removal is present', () => {
    const plan = planSupersededPlantCycleRepairs([
        event(1, 'raisedBedField.plantPlace', '2026-01-01T00:00:00.000Z'),
        event(4, 'raisedBedField.plantUpdate', '2026-01-31T23:59:59.999Z', {
            repairKey: 'superseded-plant-cycle:1:3',
            status: 'removed',
        }),
        event(3, 'raisedBedField.plantPlace', '2026-02-01T00:00:00.000Z'),
    ]);

    assert.deepStrictEqual(plan, { repairs: [], unsafe: [] });
});
