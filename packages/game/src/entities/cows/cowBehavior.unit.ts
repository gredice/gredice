import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    cowAvatarResponseSpeed,
    cowHerdMinimumDistance,
    cowTrotSpeed,
    cowWalkSpeed,
    getCowDwellSeconds,
    getCowMovementSpeed,
    pickCowBehavior,
    resolveCowHerdSpacingTarget,
} from './cowBehavior';

describe('cow behavior', () => {
    it('covers calm idle, grazing, cud, walking, and short trot states', () => {
        assert.equal(
            pickCowBehavior(() => 0),
            'idle',
        );
        assert.equal(
            pickCowBehavior(() => 0.25),
            'graze',
        );
        assert.equal(
            pickCowBehavior(() => 0.56),
            'chew-cud',
        );
        assert.equal(
            pickCowBehavior(() => 0.78),
            'roam',
        );
        assert.equal(
            pickCowBehavior(() => 0.99),
            'trot',
        );
    });

    it('keeps the heavy trot short and the avatar response calm', () => {
        assert.equal(getCowMovementSpeed('roam'), cowWalkSpeed);
        assert.equal(getCowMovementSpeed('trot'), cowTrotSpeed);
        assert.equal(
            getCowMovementSpeed('observe-avatar'),
            cowAvatarResponseSpeed,
        );
        assert.ok(cowTrotSpeed > cowWalkSpeed);
        assert.ok(cowAvatarResponseSpeed < cowWalkSpeed);
        assert.equal(
            getCowDwellSeconds('trot', () => 0),
            2,
        );
        assert.equal(
            getCowDwellSeconds('trot', () => 1),
            3.5,
        );
        assert.ok(getCowDwellSeconds('graze', () => 0) > 3.5);
    });

    it('adds bounded separation when cows would overlap', () => {
        const target = resolveCowHerdSpacingTarget({
            candidate: { x: 0, z: 0 },
            neighbors: [
                { id: 'cow-b', position: { x: 0.2, z: 0 } },
                { id: 'cow-c', position: { x: 4, z: 0 } },
            ],
            ownId: 'cow-a',
        });

        assert.equal(target.adjusted, true);
        assert.ok(target.x < 0);
        assert.ok(Math.hypot(target.x, target.z) <= 0.600_001);
        assert.ok(target.nearestDistance < cowHerdMinimumDistance);
    });

    it('uses a stable non-zero separation direction for coincident cows', () => {
        const first = resolveCowHerdSpacingTarget({
            candidate: { x: 1, z: 1 },
            neighbors: [{ id: 'cow-b', position: { x: 1, z: 1 } }],
            ownId: 'cow-a',
        });
        const second = resolveCowHerdSpacingTarget({
            candidate: { x: 1, z: 1 },
            neighbors: [{ id: 'cow-b', position: { x: 1, z: 1 } }],
            ownId: 'cow-a',
        });

        assert.deepEqual(first, second);
        assert.notDeepEqual({ x: first.x, z: first.z }, { x: 1, z: 1 });
    });
});
