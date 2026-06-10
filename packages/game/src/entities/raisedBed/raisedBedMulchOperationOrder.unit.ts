import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    type AppliedRaisedBedMulchOperationOrderInput,
    appliedMulchOperationsOldestFirst,
    latestAppliedMulchOperation,
} from './raisedBedMulchOperationOrder';

type MulchOperation = AppliedRaisedBedMulchOperationOrderInput & {
    application: 'plant' | 'raisedBedFull';
    blockName: string;
    raisedBedFieldId?: number | null;
};

test('latestAppliedMulchOperation selects the newest whole-bed mulch visual', () => {
    const operations: MulchOperation[] = [
        {
            id: 1,
            application: 'raisedBedFull',
            blockName: 'MulchHey',
            completedAt: '2026-06-01T08:00:00.000Z',
        },
        {
            id: 2,
            application: 'plant',
            blockName: 'MulchWood',
            completedAt: '2026-06-03T08:00:00.000Z',
            raisedBedFieldId: 50,
        },
        {
            id: 3,
            application: 'raisedBedFull',
            blockName: 'MulchCoconut',
            completedAt: '2026-06-02T08:00:00.000Z',
        },
    ];

    assert.equal(
        latestAppliedMulchOperation(
            operations,
            (operation) => operation.application === 'raisedBedFull',
        )?.blockName,
        'MulchCoconut',
    );
});

test('appliedMulchOperationsOldestFirst lets newer field mulch override older field mulch', () => {
    const operations: MulchOperation[] = [
        {
            id: 2,
            application: 'plant',
            blockName: 'MulchWood',
            completedAt: '2026-06-02T08:00:00.000Z',
            raisedBedFieldId: 50,
        },
        {
            id: 1,
            application: 'plant',
            blockName: 'MulchHey',
            completedAt: '2026-06-01T08:00:00.000Z',
            raisedBedFieldId: 50,
        },
        {
            id: 3,
            application: 'plant',
            blockName: 'MulchCoconut',
            completedAt: '2026-06-03T08:00:00.000Z',
            raisedBedFieldId: 50,
        },
    ];
    const fieldMulchByFieldId = new Map<number, string>();

    for (const operation of appliedMulchOperationsOldestFirst(operations)) {
        if (operation.raisedBedFieldId != null) {
            fieldMulchByFieldId.set(
                operation.raisedBedFieldId,
                operation.blockName,
            );
        }
    }

    assert.equal(fieldMulchByFieldId.get(50), 'MulchCoconut');
});

test('applied mulch ordering falls back to createdAt and operation id', () => {
    const operations: MulchOperation[] = [
        {
            id: 11,
            application: 'raisedBedFull',
            blockName: 'MulchWood',
            createdAt: '2026-06-02T08:00:00.000Z',
        },
        {
            id: 10,
            application: 'raisedBedFull',
            blockName: 'MulchHey',
            createdAt: '2026-06-02T08:00:00.000Z',
        },
    ];

    assert.deepEqual(
        appliedMulchOperationsOldestFirst(operations).map(
            (operation) => operation.id,
        ),
        [10, 11],
    );
    assert.equal(latestAppliedMulchOperation(operations, () => true)?.id, 11);
});
