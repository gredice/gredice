import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getFishingBoatOarPose,
    getFishingBoatOarRotation,
} from './fishingBoatRowing';

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

describe('fishing boat oar pose', () => {
    it('stows both oars inside the hull while nobody is aboard', () => {
        for (const side of ['port', 'starboard'] as const) {
            assert.deepEqual(
                getFishingBoatOarPose({
                    distance: 0.16,
                    mounted: false,
                    rowingAmount: 1,
                    side,
                }),
                { lift: 0, tilt: 0, yaw: 0 },
            );
        }
    });

    it('swings mounted oars out to opposite sides above the hull', () => {
        const port = getFishingBoatOarPose({
            distance: 0,
            mounted: true,
            rowingAmount: 0,
            side: 'port',
        });
        const starboard = getFishingBoatOarPose({
            distance: 0,
            mounted: true,
            rowingAmount: 0,
            side: 'starboard',
        });

        assert.equal(port.yaw, Math.PI / 2);
        assert.equal(starboard.yaw, -Math.PI / 2);
        assert.equal(port.tilt, -starboard.tilt);
        assert.ok(port.tilt > 0);
        assert.equal(port.lift, starboard.lift);
        assert.ok(port.lift > 0);
    });

    it('sweeps both blades towards the same end of the boat', () => {
        const stroke = getFishingBoatOarRotation({
            distance: 0.16,
            rowingAmount: 1,
        });
        const port = getFishingBoatOarPose({
            distance: 0.16,
            mounted: true,
            rowingAmount: 1,
            side: 'port',
        });
        const starboard = getFishingBoatOarPose({
            distance: 0.16,
            mounted: true,
            rowingAmount: 1,
            side: 'starboard',
        });

        assert.ok(stroke > 0);
        assert.equal(port.yaw, Math.PI / 2 + stroke);
        assert.equal(starboard.yaw, -(Math.PI / 2 + stroke));
    });
});
