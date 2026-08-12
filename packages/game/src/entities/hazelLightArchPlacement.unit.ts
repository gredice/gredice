import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getHazelLightArchFootprintCenterOffset } from './hazelLightArchPlacement';

describe('getHazelLightArchFootprintCenterOffset', () => {
    it('centers the model along its two-cell depth at even rotations', () => {
        assert.deepEqual(
            getHazelLightArchFootprintCenterOffset(0).toArray(),
            [0, 0, 0.5],
        );
        assert.deepEqual(
            getHazelLightArchFootprintCenterOffset(2).toArray(),
            [0, 0, 0.5],
        );
    });

    it('centers the rotated model along its two-cell width', () => {
        assert.deepEqual(
            getHazelLightArchFootprintCenterOffset(1).toArray(),
            [0.5, 0, 0],
        );
        assert.deepEqual(
            getHazelLightArchFootprintCenterOffset(-1).toArray(),
            [0.5, 0, 0],
        );
    });
});
