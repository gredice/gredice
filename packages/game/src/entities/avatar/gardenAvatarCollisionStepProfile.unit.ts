import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProfiledGardenAvatarHorizontalMovement } from './gardenAvatarCollisionStepProfile';
import { createIndexedGardenAvatarCollisionWorld } from './gardenAvatarMovement';

test('samples the real bounded collision resolution interval', () => {
    const durations: number[] = [];
    const timestamps = [10, 16];
    const world = createIndexedGardenAvatarCollisionWorld({
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: [
            { kind: 'ground', x: 0, y: 0, z: 0 },
            { kind: 'ground', x: 1, y: 0, z: 0 },
        ],
    });

    const result = resolveProfiledGardenAvatarHorizontalMovement({
        input: {
            deltaX: 1,
            deltaZ: 0,
            position: { x: 0, y: 0, z: 0 },
            world,
        },
        now: () => timestamps.shift() ?? 16,
        recordDuration: (durationMs) => durations.push(durationMs),
    });

    assert.equal(result.collided, true);
    assert.deepEqual(durations, [6]);
});
