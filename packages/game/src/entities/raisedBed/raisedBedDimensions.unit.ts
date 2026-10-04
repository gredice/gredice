import assert from 'node:assert/strict';
import test from 'node:test';
import {
    RAISED_BED_SUPPORT_HEIGHT_METERS,
    RAISED_BED_SUPPORT_SCALE,
} from './raisedBedDimensions';

test('raised-bed supports extend 1.2 meters above the soil surface', () => {
    assert.equal(RAISED_BED_SUPPORT_HEIGHT_METERS, 1.2);
    assert.deepEqual(RAISED_BED_SUPPORT_SCALE, [1, 1.2, 1]);
});
