import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCowPoseTargets } from './cowPose';

describe('cow procedural pose targets', () => {
    it('combines breathing, ear/head motion, and tail swats while idle', () => {
        const now = Math.PI / (2 * 1.8);
        const pose = getCowPoseTargets({
            behavior: 'idle',
            moving: false,
            now,
            trot: false,
            walkPhase: 0,
        });

        assert.notEqual(pose.bodyScaleZ, 1);
        assert.notEqual(pose.earRotationZ, 0);
        assert.notEqual(pose.headRotationX, 0);
        assert.ok(pose.tailTipRotationY > pose.tailBaseRotationY);
    });

    it('lowers the neck to graze and moves the jaw while chewing cud', () => {
        const grazing = getCowPoseTargets({
            behavior: 'graze',
            moving: false,
            now: 0,
            trot: false,
            walkPhase: 0,
        });
        const chewing = getCowPoseTargets({
            behavior: 'chew-cud',
            moving: false,
            now: Math.PI / (2 * 4.2),
            trot: false,
            walkPhase: 0,
        });

        assert.equal(grazing.neckRotationX, -0.5);
        assert.equal(grazing.headRotationX, -0.62);
        assert.ok(chewing.jawRotationY > 0.09);
    });

    it('uses a stronger diagonal gait and body weight shift for the heavy trot', () => {
        const walking = getCowPoseTargets({
            behavior: 'roam',
            moving: true,
            now: 0,
            trot: false,
            walkPhase: Math.PI / 4,
        });
        const trotting = getCowPoseTargets({
            behavior: 'trot',
            moving: true,
            now: 0,
            trot: true,
            walkPhase: Math.PI / 4,
        });

        assert.ok(
            Math.abs(trotting.legRotations[0] ?? 0) >
                Math.abs(walking.legRotations[0] ?? 0),
        );
        assert.ok(trotting.bodyPositionY > walking.bodyPositionY);
    });
});
