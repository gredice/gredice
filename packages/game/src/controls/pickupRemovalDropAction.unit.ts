import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import type { MovingSegment } from './PickupPlacementResolver';
import {
    getMovingSegmentBlockIds,
    resolvePickupHudDropAction,
} from './pickupRemovalDropAction';

function createBlock(name: string, id = name): Block {
    return {
        id,
        name,
        rotation: 0,
    };
}

function createSegment({
    blocks,
    canRecycle = false,
}: {
    blocks: Block[];
    canRecycle?: boolean;
}): MovingSegment {
    const sourceStack: Stack = {
        position: new Vector3(0, 0, 0),
        blocks,
    };

    return {
        sourceStack,
        sourceStartIndex: 0,
        blocks,
        baseHeight: 0,
        canRecycle,
    };
}

describe('resolvePickupHudDropAction', () => {
    it('recycles eligible primary selections outside forced delete targets', () => {
        const action = resolvePickupHudDropAction({
            forceDelete: false,
            movingSegments: [
                createSegment({
                    blocks: [createBlock('Raised_Bed', 'raised-bed')],
                    canRecycle: true,
                }),
            ],
        });

        assert.deepEqual(action, { type: 'recycle' });
    });

    it('deletes selected moving blocks when recycling is not eligible', () => {
        const tree = createBlock('Tree', 'tree');
        const bucket = createBlock('Bucket', 'bucket');

        const action = resolvePickupHudDropAction({
            forceDelete: false,
            movingSegments: [
                createSegment({ blocks: [tree] }),
                createSegment({ blocks: [bucket] }),
            ],
        });

        assert.deepEqual(action, {
            type: 'delete',
            blockIds: ['tree', 'bucket'],
        });
    });

    it('keeps sandbox trash drops on the delete path even for recyclable blocks', () => {
        const action = resolvePickupHudDropAction({
            forceDelete: true,
            movingSegments: [
                createSegment({
                    blocks: [createBlock('Raised_Bed', 'raised-bed')],
                    canRecycle: true,
                }),
            ],
        });

        assert.deepEqual(action, {
            type: 'delete',
            blockIds: ['raised-bed'],
        });
    });

    it('returns no action for canceled or empty pickup state', () => {
        const action = resolvePickupHudDropAction({
            forceDelete: false,
            movingSegments: [],
        });

        assert.equal(action, null);
    });
});

describe('getMovingSegmentBlockIds', () => {
    it('dedupes block ids while preserving first-seen order', () => {
        const tree = createBlock('Tree', 'tree');
        const duplicateTree = createBlock('Tree', 'tree');
        const bucket = createBlock('Bucket', 'bucket');

        assert.deepEqual(
            getMovingSegmentBlockIds([
                createSegment({ blocks: [tree, bucket] }),
                createSegment({ blocks: [duplicateTree] }),
            ]),
            ['tree', 'bucket'],
        );
    });
});
