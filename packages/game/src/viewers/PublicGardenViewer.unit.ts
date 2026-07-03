import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPublicGardenStacksCenter,
    normalizePublicGardenStacks,
    type PublicGardenStack,
} from './PublicGardenViewer';

describe('normalizePublicGardenStacks', () => {
    it('maps public garden rows onto the game z axis', () => {
        const publicStacks: PublicGardenStack[] = [
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
        ];

        const [stack] = normalizePublicGardenStacks(publicStacks);

        assert.ok(stack);
        assert.equal(stack.position.x, 2);
        assert.equal(stack.position.y, 0);
        assert.equal(stack.position.z, 5);
    });
});

describe('getPublicGardenStacksCenter', () => {
    it('centers the camera target across public garden x and z bounds', () => {
        const stacks = normalizePublicGardenStacks([
            { x: 0, y: 4, blocks: [] },
            { x: 6, y: 10, blocks: [] },
        ]);

        const center = getPublicGardenStacksCenter(stacks);

        assert.equal(center.x, 3);
        assert.equal(center.y, 0);
        assert.equal(center.z, 7);
    });
});
