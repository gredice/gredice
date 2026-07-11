import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { shareCurrentGardenData } from './currentGardenStructuralSharing';
import type { CurrentGarden } from './useCurrentGarden';

function createBlock(overrides: Partial<Block> = {}): Block {
    return {
        id: 'block-1',
        name: 'Block_Grass',
        rotation: 0,
        ...overrides,
    };
}

function createStack(
    x: number,
    z: number,
    blocks: Block[] = [createBlock()],
): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks,
    };
}

function createGarden(overrides: Partial<CurrentGarden> = {}): CurrentGarden {
    const { homeCamera, ...gardenOverrides } = overrides;

    return {
        id: 1,
        name: 'Garden',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: 'current',
        farmId: 1,
        stacks: [createStack(0, 0)],
        location: {
            lat: 45,
            lon: 16,
        },
        raisedBeds: [],
        ...gardenOverrides,
        homeCamera: homeCamera ?? null,
    };
}

describe('shareCurrentGardenData', () => {
    it('keeps the optimistic garden when a refetch rebuilds equivalent stack objects', () => {
        const previousStack = createStack(0, 0, [
            createBlock({ id: 'backend-block' }),
        ]);
        const previousGarden = createGarden({
            stacks: [previousStack],
        });
        const nextGarden = createGarden({
            stacks: [
                createStack(0, 0, [
                    createBlock({
                        id: 'backend-block',
                        variant: null,
                    }),
                ]),
            ],
        });

        assert.equal(
            shareCurrentGardenData(previousGarden, nextGarden),
            previousGarden,
        );
    });

    it('keeps unchanged stack references when another stack changes', () => {
        const unchangedStack = createStack(0, 0, [
            createBlock({ id: 'unchanged' }),
        ]);
        const changedStack = createStack(1, 0, [createBlock({ id: 'old' })]);
        const previousGarden = createGarden({
            stacks: [unchangedStack, changedStack],
        });
        const nextChangedStack = createStack(1, 0, [
            createBlock({ id: 'old' }),
            createBlock({ id: 'new' }),
        ]);
        const nextGarden = createGarden({
            stacks: [
                createStack(0, 0, [createBlock({ id: 'unchanged' })]),
                nextChangedStack,
            ],
        });

        const sharedGarden = shareCurrentGardenData(previousGarden, nextGarden);

        assert.notEqual(sharedGarden, previousGarden);
        assert.equal(sharedGarden?.stacks[0], unchangedStack);
        assert.notEqual(sharedGarden?.stacks[1], changedStack);
        assert.equal(sharedGarden?.stacks[1]?.position, changedStack.position);
        assert.equal(
            sharedGarden?.stacks[1]?.blocks[0],
            changedStack.blocks[0],
        );
        assert.equal(
            sharedGarden?.stacks[1]?.blocks[1],
            nextChangedStack.blocks[1],
        );
    });

    it('returns new data when garden metadata changes', () => {
        const previousGarden = createGarden();
        const nextGarden = createGarden({ name: 'Renamed garden' });

        assert.equal(
            shareCurrentGardenData(previousGarden, nextGarden),
            nextGarden,
        );
    });

    it('keeps preview metadata updates without discarding the garden change', () => {
        const previousGarden = createGarden({
            previewImage: null,
            previewSourceRevision: 'revision-1',
        });
        const previewImage = {
            url: 'https://blob.example/garden.webp',
            width: 1200,
            height: 630,
            capturedAt: '2026-07-11T10:00:00.000Z',
            sourceRevision: 'revision-1',
            rendererVersion: 'garden-preview-v1',
        };
        const nextGarden = createGarden({
            previewImage,
            previewSourceRevision: 'revision-1',
        });

        const sharedGarden = shareCurrentGardenData(previousGarden, nextGarden);

        assert.notEqual(sharedGarden, previousGarden);
        assert.equal(sharedGarden?.previewImage, previewImage);
        assert.equal(sharedGarden?.stacks, previousGarden.stacks);
    });
});
