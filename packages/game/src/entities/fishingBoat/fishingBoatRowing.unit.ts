import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getFishingBoatOarRotation } from './fishingBoatRowing';

describe('fishing boat rowing', () => {
    it('rests the oars when the boat is stopped', () => {
        assert.equal(
            getFishingBoatOarRotation({ distance: 0.2, rowingAmount: 0 }),
            0,
        );
    });

    it('cycles the oars through a visible stroke while travelling', () => {
        const first = getFishingBoatOarRotation({
            distance: 0.16,
            rowingAmount: 1,
        });
        const opposite = getFishingBoatOarRotation({
            distance: 0.57,
            rowingAmount: 1,
        });

        assert.ok(first > 0.4);
        assert.ok(opposite < -0.4);
    });

    it('clamps excessive rowing input', () => {
        assert.equal(
            getFishingBoatOarRotation({ distance: 0.16, rowingAmount: 2 }),
            getFishingBoatOarRotation({ distance: 0.16, rowingAmount: 1 }),
        );
    });
});
