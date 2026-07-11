import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPublicGardenRaisedBedInteractionTargets } from './PublicGardenRaisedBedInteractions';
import {
    getPublicGardenInitialView,
    getPublicGardenRaisedBedsWithBlocks,
    getPublicGardenStacksCenter,
    normalizePublicGardenStacks,
    type PublicGardenStack,
} from './PublicGardenViewer';

describe('getPublicGardenRaisedBedsWithBlocks', () => {
    it('excludes raised beds that cannot be selected in the rendered garden', () => {
        const stacks = normalizePublicGardenStacks([
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'raised-bed-1',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
        ]);

        const raisedBeds = getPublicGardenRaisedBedsWithBlocks(
            [
                { id: 1, blockId: 'raised-bed-1' },
                { id: 2, blockId: 'removed-raised-bed' },
                { id: 3, blockId: null },
            ],
            stacks,
        );

        assert.deepEqual(
            raisedBeds.map((raisedBed) => raisedBed.id),
            [1],
        );
    });
});

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

describe('getPublicGardenRaisedBedInteractionTargets', () => {
    it('registers only raised-bed blocks for public selection', () => {
        const stacks = normalizePublicGardenStacks([
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'raised-bed-1',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                    {
                        id: 'decoration-1',
                        name: 'Bucket',
                        rotation: 0,
                    },
                ],
            },
        ]);

        const targets = getPublicGardenRaisedBedInteractionTargets(stacks);

        assert.equal(targets.length, 1);
        assert.equal(targets[0]?.block.id, 'raised-bed-1');
        assert.equal(targets[0]?.blockIndex, 0);
    });
});
