import assert from 'node:assert/strict';
import test from 'node:test';
import type { GardenOperationItem } from '../hooks/useGardenOperations';
import { buildGardenOperationDiaryTarget } from './gardenOperationDiaryTargets';

function operation(
    overrides: Partial<GardenOperationItem> = {},
): GardenOperationItem {
    return {
        id: 41,
        entityId: 72,
        taskVersionEventId: 301,
        entityTypeName: 'operation',
        raisedBedId: null,
        raisedBedFieldId: null,
        status: 'planned',
        createdAt: '2026-07-15T08:00:00.000Z',
        scheduledDate: '2026-07-17T08:00:00.000Z',
        scheduledAt: '2026-07-15T08:00:00.000Z',
        completedAt: null,
        verifiedAt: null,
        canceledAt: null,
        cancellationReason: null,
        blockedAt: null,
        blockReasonLabel: null,
        blockNote: null,
        blockImageUrls: [],
        imageUrls: [],
        completionNotes: null,
        targetLabel: 'Vrt',
        statusHistory: [],
        ...overrides,
    };
}

test('operation diary targets carry the exact task-attempt version', () => {
    assert.deepEqual(buildGardenOperationDiaryTarget(operation(), undefined), {
        type: 'operation',
        expectedEntityId: 72,
        expectedTaskVersionEventId: 301,
        operationId: 41,
        raisedBedId: null,
        raisedBedFieldId: null,
        positionIndex: undefined,
        scheduledDate: '2026-07-17T08:00:00.000Z',
    });
});

test('planting diary targets carry the exact active-cycle version', () => {
    assert.deepEqual(
        buildGardenOperationDiaryTarget(
            operation({
                id: -91,
                entityId: 17,
                taskVersionEventId: 407,
                entityTypeName: 'plantSort',
                raisedBedId: 8,
                raisedBedFieldId: 19,
            }),
            4,
        ),
        {
            type: 'raisedBedFieldPlant',
            expectedPlantCycleEventId: 91,
            expectedPlantCycleVersionEventId: 407,
            expectedPlantSortId: 17,
            raisedBedId: 8,
            positionIndex: 4,
            scheduledDate: '2026-07-17T08:00:00.000Z',
        },
    );
});

test('diary targets fail closed when an attempt version is unavailable', () => {
    assert.equal(
        buildGardenOperationDiaryTarget(
            operation({ taskVersionEventId: null }),
            undefined,
        ),
        null,
    );
});
