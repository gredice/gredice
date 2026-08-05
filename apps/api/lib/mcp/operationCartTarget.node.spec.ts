import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOperationCartTarget } from './operationCartTarget';

test('raised-bed operations require a raised bed and no individual field', () => {
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
    assert.throws(
        () =>
            assertOperationCartTarget('raisedBed1m', {
                raisedBedId: 12,
                positionIndex: 3,
            }),
        /cannot target an individual field/,
    );
});

test('plant operations require a concrete field', () => {
    assert.doesNotThrow(() =>
        assertOperationCartTarget('plant', {
            raisedBedId: 12,
            positionIndex: 0,
        }),
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
