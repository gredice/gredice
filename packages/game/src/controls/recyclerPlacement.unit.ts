import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { isRecyclerPlacementTarget } from './recyclerPlacement';

const now = '2026-06-02T00:00:00.000Z';

function createBlockData({
    name = 'Composter',
    recycler = true,
}: {
    name?: string;
    recycler?: boolean;
} = {}) {
    return {
        id: 1,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name.toLowerCase(),
        information: {
            name,
            label: name,
            shortDescription: '',
            fullDescription: '',
        },
        attributes: {
            height: 0.8,
            nightOnlyPurchase: false,
            stackable: false,
            type: 'decoration',
        },
        prices: { sunflowers: 0 },
        functions: {
            recycler,
            raisedBed: false,
        },
        createdAt: now,
        updatedAt: now,
    } satisfies BlockData;
}

describe('isRecyclerPlacementTarget', () => {
    it('allows dropping recyclable blocks onto composter recycler targets', () => {
        assert.equal(
            isRecyclerPlacementTarget({
                canRecycle: true,
                sourcePosition: { x: 0, z: 0 },
                destination: { x: 1, z: 0 },
                blockUnderData: createBlockData({ name: 'Composter' }),
            }),
            true,
        );
    });

    it('does not recycle when the block is released at its source position', () => {
        assert.equal(
            isRecyclerPlacementTarget({
                canRecycle: true,
                sourcePosition: { x: 1, z: 0 },
                destination: { x: 1, z: 0 },
                blockUnderData: createBlockData({ name: 'Composter' }),
            }),
            false,
        );
    });

    it('requires the moving selection to be recyclable', () => {
        assert.equal(
            isRecyclerPlacementTarget({
                canRecycle: false,
                sourcePosition: { x: 0, z: 0 },
                destination: { x: 1, z: 0 },
                blockUnderData: createBlockData({ name: 'Composter' }),
            }),
            false,
        );
    });

    it('ignores blocks that are not recycler targets', () => {
        assert.equal(
            isRecyclerPlacementTarget({
                canRecycle: true,
                sourcePosition: { x: 0, z: 0 },
                destination: { x: 1, z: 0 },
                blockUnderData: createBlockData({
                    name: 'GardenBox',
                    recycler: false,
                }),
            }),
            false,
        );
    });
});
