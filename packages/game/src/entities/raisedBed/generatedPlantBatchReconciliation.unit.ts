import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileGeneratedPlantBatches } from './generatedPlantBatchReconciliation';

test('generated-plant reconciliation preserves unrelated bed batches', () => {
    const firstBed = {
        batchKey: 'mid:bed:1',
        fields: [1],
        signature: 'bed-1:v1',
    };
    const secondBed = {
        batchKey: 'mid:bed:2',
        fields: [2],
        signature: 'bed-2:v1',
    };
    const previous = [firstBed, secondBed];
    const next = [
        {
            batchKey: 'near:bed:1',
            fields: [1],
            signature: 'bed-1:v2',
        },
        {
            batchKey: 'mid:bed:2',
            fields: [200],
            signature: 'bed-2:v1',
        },
    ];

    const reconciled = reconcileGeneratedPlantBatches(previous, next);

    assert.notEqual(reconciled, previous);
    assert.notEqual(reconciled[0], firstBed);
    assert.equal(reconciled[1], secondBed);
    assert.equal(reconciled[1]?.fields, secondBed.fields);
});

test('generated-plant reconciliation reuses the complete stable list', () => {
    const previous = [
        {
            batchKey: 'far:bed:1',
            signature: 'stable',
        },
    ];

    assert.equal(
        reconcileGeneratedPlantBatches(previous, [
            {
                batchKey: 'far:bed:1',
                signature: 'stable',
            },
        ]),
        previous,
    );
});

test('generated-plant reconciliation rejects duplicate batch keys', () => {
    assert.throws(
        () =>
            reconcileGeneratedPlantBatches(undefined, [
                { batchKey: 'mid:bed:1', signature: 'one' },
                { batchKey: 'mid:bed:1', signature: 'two' },
            ]),
        /Duplicate generated-plant batch/,
    );
});
