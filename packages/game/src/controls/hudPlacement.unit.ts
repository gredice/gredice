import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';
import { resolveHudPlacementPreview } from './hudPlacement';

function createBlockData({
    height = 1,
    name,
    stackable = true,
}: {
    height?: number;
    name: string;
    stackable?: boolean;
}): BlockData {
    return {
        id: name.length,
        entityType: {
            id: 8,
            name: 'block',
            label: 'Blok',
        },
        slug: name,
        information: {
            name,
            shortDescription: name,
            fullDescription: name,
            label: name,
        },
        attributes: {
            height,
            stackable,
            type: 'decoration',
            nightOnlyPurchase: false,
        },
        prices: {
            sunflowers: 10,
        },
        functions: {
            recycler: false,
            raisedBed: name === 'Raised_Bed',
        },
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
    };
}

function createStack(x: number, z: number, name: string): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks: [
            {
                id: `${name}:${x}:${z}`,
                name,
                rotation: 0,
            },
        ],
    };
}

const blockData = [
    createBlockData({ name: 'Tree' }),
    createBlockData({ name: 'StoneLarge', stackable: false }),
    createBlockData({ name: 'Block_Grass', height: 0.2 }),
];

describe('resolveHudPlacementPreview', () => {
    it('allows a new HUD item on an exact empty scene cell', () => {
        const preview = resolveHudPlacementPreview({
            blockData,
            blockName: 'Tree',
            garden: { stacks: [] },
            position: { x: 4, z: -2 },
        });

        assert.equal(preview?.isBlocked, false);
        assert.equal(preview?.error, null);
        assert.equal(preview?.hoverHeight, 0);
        assert.deepEqual(preview?.position, { x: 4, z: -2 });
    });

    it('marks exact invalid targets as blocked instead of falling back nearby', () => {
        const preview = resolveHudPlacementPreview({
            blockData,
            blockName: 'Tree',
            garden: {
                stacks: [createStack(0, 0, 'StoneLarge')],
            },
            position: { x: 0, z: 0 },
        });

        assert.equal(preview?.isBlocked, true);
        assert.match(preview?.error ?? '', /cannot support Tree/u);
        assert.equal(preview?.hoverHeight, 1);
        assert.deepEqual(preview?.position, { x: 0, z: 0 });
    });
});
