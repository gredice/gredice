import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { getBlockHitboxSize } from './blockHitbox';

const now = '2026-05-30T00:00:00.000Z';

function createBlockData(attributes: Partial<BlockData['attributes']> = {}) {
    return {
        id: 1,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: 'test-block',
        information: {
            name: 'TestBlock',
            label: 'Test block',
            shortDescription: 'Test block.',
            fullDescription: 'Test block.',
        },
        attributes: {
            height: 0.2,
            nightOnlyPurchase: false,
            stackable: true,
            type: 'decoration',
            ...attributes,
        },
        prices: { sunflowers: 1 },
        functions: {
            recycler: false,
            raisedBed: false,
        },
        createdAt: now,
        updatedAt: now,
    } satisfies BlockData;
}

describe('getBlockHitboxSize', () => {
    it('uses existing control target defaults when no hitbox attributes exist', () => {
        assert.deepEqual(getBlockHitboxSize(createBlockData()), {
            width: 1,
            height: 0.35,
            depth: 1,
        });
    });

    it('uses positive hitbox attributes from block data', () => {
        assert.deepEqual(
            getBlockHitboxSize(
                createBlockData({
                    hitboxWidth: 0.28,
                    hitboxHeight: 0.18,
                    hitboxDepth: 0.42,
                }),
            ),
            {
                width: 0.28,
                height: 0.18,
                depth: 0.42,
            },
        );
    });

    it('keeps known tall asset hitboxes at least as large as their rendered model bounds', () => {
        assert.deepEqual(
            getBlockHitboxSize(
                createBlockData({
                    height: 0.8,
                    hitboxWidth: 0.34,
                    hitboxHeight: 1.25,
                    hitboxDepth: 0.34,
                }),
            ),
            {
                width: 0.34,
                height: 1.25,
                depth: 0.34,
            },
        );

        assert.deepEqual(
            getBlockHitboxSize({
                ...createBlockData({
                    height: 0.8,
                    hitboxWidth: 0.34,
                    hitboxHeight: 1.25,
                    hitboxDepth: 0.34,
                }),
                information: {
                    name: 'Tree',
                    label: 'Tree',
                    shortDescription: 'Tree.',
                    fullDescription: 'Tree.',
                },
            }),
            {
                width: 1.36,
                height: 2.38,
                depth: 1.43,
            },
        );
    });

    it('ignores non-positive and non-finite hitbox attributes', () => {
        assert.deepEqual(
            getBlockHitboxSize(
                createBlockData({
                    hitboxWidth: 0,
                    hitboxHeight: Number.NaN,
                    hitboxDepth: Number.POSITIVE_INFINITY,
                }),
            ),
            {
                width: 1,
                height: 0.35,
                depth: 1,
            },
        );
    });
});
