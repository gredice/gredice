import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSlopedGroundNormalizedHeight } from './groundSurfaceHeight';

describe('getSlopedGroundNormalizedHeight', () => {
    it('resolves straight stone stairs as discrete half-tile treads', () => {
        for (const name of [
            'Block_Stone_Stairs',
            'Block_Polished_Stone_Stairs',
        ]) {
            assert.equal(getSlopedGroundNormalizedHeight(name, -0.25, 0), 0.5);
            assert.equal(getSlopedGroundNormalizedHeight(name, 0.25, 0), 1);
        }
    });

    it('resolves corner stairs as a full-tile L and raised positive-X negative-Z quadrant', () => {
        for (const name of [
            'Block_Stone_Stairs_Corner',
            'Block_Polished_Stone_Stairs_Corner',
            'Block_Stone_Stairs_Half',
        ]) {
            assert.equal(getSlopedGroundNormalizedHeight(name, 0.25, -0.25), 1);
            assert.equal(
                getSlopedGroundNormalizedHeight(name, -0.25, -0.25),
                0.5,
            );
            assert.equal(
                getSlopedGroundNormalizedHeight(name, -0.25, 0.25),
                0.5,
            );
            assert.equal(
                getSlopedGroundNormalizedHeight(name, 0.25, 0.25),
                0.5,
            );
        }
    });
});
