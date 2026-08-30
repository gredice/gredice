import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { GardenStack } from '../types/Stack';
import type { CurrentGarden } from './useCurrentGarden';
import { createSceneCurrentGardenAdapter } from './useSceneCurrentGarden';

function createGarden(stacks: GardenStack[]): CurrentGarden {
    return {
        id: 1,
        name: 'Garden',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: 'current',
        homeCamera: null,
        stacks,
        structures: [],
        location: {
            lat: 45,
            lon: 16,
        },
        raisedBeds: [],
    };
}

describe('createSceneCurrentGardenAdapter', () => {
    it('converts plain garden coordinates into scene Vector3 values', () => {
        const gardenStack: GardenStack = {
            position: { x: 4, y: 0, z: -2 },
            blocks: [],
        };
        const sceneGarden = createSceneCurrentGardenAdapter()(
            createGarden([gardenStack]),
        );

        assert.ok(sceneGarden);
        assert.ok(sceneGarden.stacks[0]?.position instanceof Vector3);
        assert.deepStrictEqual(
            sceneGarden.stacks[0]?.position.toArray(),
            [4, 0, -2],
        );
        assert.deepStrictEqual(gardenStack.position, { x: 4, y: 0, z: -2 });
    });

    it('reuses scene stack identities for structurally shared garden stacks', () => {
        const gardenStack: GardenStack = {
            position: { x: 1, y: 0, z: 3 },
            blocks: [],
        };
        const garden = createGarden([gardenStack]);
        const adaptGarden = createSceneCurrentGardenAdapter();
        const firstSceneGarden = adaptGarden(garden);
        const nextSceneGarden = adaptGarden({ ...garden });

        assert.ok(firstSceneGarden);
        assert.ok(nextSceneGarden);
        assert.equal(nextSceneGarden.stacks[0], firstSceneGarden.stacks[0]);
    });
});
