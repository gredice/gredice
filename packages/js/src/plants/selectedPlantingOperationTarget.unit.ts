import assert from 'node:assert/strict';
import test from 'node:test';
import { readSelectedPlantingOperationTarget } from './selectedPlantingOperationTarget';

test('selected operation target preserves exact identity through JSON snapshots', () => {
    const plantingTarget = {
        plantingId: 42,
        expectedPlantSortId: 51,
        expectedLifecycleVersionEventId: 100,
    };
    assert.deepEqual(
        readSelectedPlantingOperationTarget(JSON.stringify({ plantingTarget })),
        plantingTarget,
    );
    assert.deepEqual(
        readSelectedPlantingOperationTarget({ plantingTarget }),
        plantingTarget,
    );
    for (const value of [
        null,
        undefined,
        '',
        '{}',
        { scheduledDate: '2026-09-15' },
    ]) {
        assert.equal(readSelectedPlantingOperationTarget(value), null);
    }
});
test('malformed explicit targets fail closed rather than reverting to a field', () => {
    for (const target of [
        null,
        {},
        { plantingId: 1 },
        {
            plantingId: 1,
            expectedPlantSortId: 2,
            expectedLifecycleVersionEventId: 0,
        },
        {
            plantingId: '1',
            expectedPlantSortId: 2,
            expectedLifecycleVersionEventId: 3,
        },
        {
            plantingId: 1.5,
            expectedPlantSortId: 2,
            expectedLifecycleVersionEventId: 3,
        },
    ])
        assert.throws(() =>
            readSelectedPlantingOperationTarget({ plantingTarget: target }),
        );
});
