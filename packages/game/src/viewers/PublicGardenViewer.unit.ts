import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPublicGardenInitialView,
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

describe('getPublicGardenInitialView', () => {
    it('uses the saved public garden home camera when available', () => {
        const view = getPublicGardenInitialView({
            homeCamera: {
                position: [12, 80, -18],
                target: [4, 0, -6],
                zoom: 140,
            },
            stacks: normalizePublicGardenStacks([
                { x: 0, y: 4, blocks: [] },
                { x: 6, y: 10, blocks: [] },
            ]),
        });

        assert.equal(view.cameraPosition.x, 12);
        assert.equal(view.cameraPosition.y, 80);
        assert.equal(view.cameraPosition.z, -18);
        assert.equal(view.cameraTarget.x, 4);
        assert.equal(view.cameraTarget.y, 0);
        assert.equal(view.cameraTarget.z, -6);
        assert.equal(view.cameraZoom, 140);
    });

    it('falls back to centering the garden bounds', () => {
        const view = getPublicGardenInitialView({
            stacks: normalizePublicGardenStacks([
                { x: 0, y: 4, blocks: [] },
                { x: 6, y: 10, blocks: [] },
            ]),
        });

        assert.equal(view.cameraPosition.x, -97);
        assert.equal(view.cameraPosition.y, 100);
        assert.equal(view.cameraPosition.z, -93);
        assert.equal(view.cameraTarget.x, 3);
        assert.equal(view.cameraTarget.y, 0);
        assert.equal(view.cameraTarget.z, 7);
        assert.equal(view.cameraZoom, 90);
    });
});
