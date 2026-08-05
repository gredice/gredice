import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertOperationCartTarget,
    resolveOperationCartTarget,
} from './operationCartTarget';

test('raised-bed operations require a raised bed', () => {
    assert.doesNotThrow(() =>
        assertOperationCartTarget('raisedBedFull', { raisedBedId: 12 }),
    );
    assert.doesNotThrow(() =>
        assertOperationCartTarget('raisedBed1m', { raisedBedId: 12 }),
    );
    assert.throws(
        () => assertOperationCartTarget('raisedBedFull', {}),
        /requires a raised bed/,
    );
});

test('raised-bed operations ignore an incidental focused field', () => {
    assert.deepStrictEqual(
        resolveOperationCartTarget('raisedBedFull', {
            raisedBedId: 12,
            positionIndex: 3,
        }),
        { raisedBedId: 12 },
    );
    assert.deepStrictEqual(
        resolveOperationCartTarget('raisedBed1m', {
            raisedBedId: 12,
            positionIndex: 0,
        }),
        { raisedBedId: 12 },
    );
});

test('plant operations require a concrete field', () => {
    assert.deepStrictEqual(
        resolveOperationCartTarget('plant', {
            raisedBedId: 12,
            positionIndex: 0,
        }),
        { raisedBedId: 12, positionIndex: 0 },
    );
    assert.throws(
        () => assertOperationCartTarget('plant', { raisedBedId: 12 }),
        /requires a raised-bed field/,
    );
});

test('other operation applications cannot be ordered through a raised-bed target', () => {
    assert.throws(
        () => assertOperationCartTarget('garden', { raisedBedId: 12 }),
        /not orderable for this target/,
    );
});
