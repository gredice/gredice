import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    resolveDeterministicCloudSpawn,
    seededCloudRandom,
} from './cloudDeterministicLayout';

describe('seededCloudRandom', () => {
    it('returns a stable unit interval value for a scene seed', () => {
        const value = seededCloudRandom(42.5);

        assert.equal(value, seededCloudRandom(42.5));
        assert.ok(value >= 0);
        assert.ok(value < 1);
    });
});

describe('resolveDeterministicCloudSpawn', () => {
    const input = {
        focusX: 4,
        focusZ: -3,
        laneX: 0.4,
        laneZ: -0.2,
        seed: 18.25,
        spawnHalfX: 12,
        spawnHalfZ: 9,
    };

    it('repeats the exact placement without runtime randomness', () => {
        assert.deepEqual(
            resolveDeterministicCloudSpawn(input),
            resolveDeterministicCloudSpawn(input),
        );
    });

    it('keeps seeded jitter inside the camera spawn frame', () => {
        const placement = resolveDeterministicCloudSpawn(input);

        assert.ok(placement.x >= input.focusX - input.spawnHalfX);
        assert.ok(placement.x <= input.focusX + input.spawnHalfX);
        assert.ok(placement.z >= input.focusZ - input.spawnHalfZ);
        assert.ok(placement.z <= input.focusZ + input.spawnHalfZ);
    });

    it('produces a distinct layout for a distinct cloud seed', () => {
        assert.notDeepEqual(
            resolveDeterministicCloudSpawn(input),
            resolveDeterministicCloudSpawn({
                ...input,
                seed: input.seed + 1,
            }),
        );
    });
});
