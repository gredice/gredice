import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import { createActiveDragPreviewTarget } from '../dragPreviewIdentity';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    createPickupSelectionMoveRequests,
    createPickupSelectionMovingSegments,
} from './pickupSelection';

function createBlock(name: string, id = name): Block {
    return {
        id,
        name,
        rotation: 0,
    };
}

function createStack(x: number, z: number, blocks: Block[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks,
    };
}

function createBlockData(name: string, id: number, height = 1): BlockData {
    return {
        id,
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
            stackable: true,
            type: 'decoration',
            nightOnlyPurchase: false,
        },
        prices: {
            sunflowers: 0,
        },
        functions: {
            recycler: false,
            raisedBed: name === 'Raised_Bed',
        },
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
    };
}

const blockData = [
    createBlockData('Block_Grass', 1, 0.2),
    createBlockData('Raised_Bed', 2),
    createBlockData('Tree', 3),
];

describe('createPickupSelectionMovingSegments', () => {
    it('uses the primary target when selection state has not been seeded yet', () => {
        const grass = createBlock('Block_Grass', 'grass');
        const tree = createBlock('Tree', 'tree');
        const sourceStack = createStack(0, 0, [grass, tree]);
        const primaryTarget = createActiveDragPreviewTarget({
            blockId: tree.id,
            blockIndex: 1,
            stackPosition: sourceStack.position,
        });

        const segments = createPickupSelectionMovingSegments({
            blockData,
            canRecyclePrimarySegment: true,
            primaryTarget,
            selectedTargets: [],
            stacks: [sourceStack],
        });

        assert.equal(segments.length, 1);
        assert.deepEqual(segments[0]?.blocks, [tree]);
        assert.equal(segments[0]?.baseHeight, 0.2);
        assert.equal(segments[0]?.canRecycle, true);
    });

    it('moves selected blocks from multiple stacks together', () => {
        const primaryBlock = createBlock('Tree', 'primary');
        const extraBlock = createBlock('Raised_Bed', 'extra');
        const primaryStack = createStack(0, 0, [primaryBlock]);
        const extraStack = createStack(2, 0, [extraBlock]);
        const primaryTarget = createActiveDragPreviewTarget({
            blockId: primaryBlock.id,
            blockIndex: 0,
            stackPosition: primaryStack.position,
        });
        const extraTarget = createActiveDragPreviewTarget({
            blockId: extraBlock.id,
            blockIndex: 0,
            stackPosition: extraStack.position,
        });

        const segments = createPickupSelectionMovingSegments({
            blockData,
            canRecyclePrimarySegment: true,
            primaryTarget,
            selectedTargets: [primaryTarget, extraTarget],
            stacks: [primaryStack, extraStack],
        });

        assert.equal(segments.length, 2);
        assert.deepEqual(
            segments.map((segment) => segment.blocks[0]?.id),
            ['primary', 'extra'],
        );
        assert.equal(segments[0]?.canRecycle, false);
        assert.equal(segments[1]?.canRecycle, false);
    });

    it('creates move requests for the primary block and additional selected blocks', () => {
        const primaryBlock = createBlock('Tree', 'primary');
        const extraBlock = createBlock('Raised_Bed', 'extra');
        const upperBlock = createBlock('Tree', 'upper');
        const primaryStack = createStack(0, 0, [primaryBlock]);
        const extraStack = createStack(2, 1, [extraBlock, upperBlock]);
        const primaryTarget = createActiveDragPreviewTarget({
            blockId: primaryBlock.id,
            blockIndex: 0,
            stackPosition: primaryStack.position,
        });
        const extraTarget = createActiveDragPreviewTarget({
            blockId: extraBlock.id,
            blockIndex: 0,
            stackPosition: extraStack.position,
        });

        const segments = createPickupSelectionMovingSegments({
            blockData,
            canRecyclePrimarySegment: true,
            primaryTarget,
            selectedTargets: [primaryTarget, extraTarget],
            stacks: [primaryStack, extraStack],
        });
        const moveRequests = createPickupSelectionMoveRequests(segments, {
            x: 1,
            z: -1,
        });

        assert.deepEqual(moveRequests, [
            {
                sourcePosition: { x: 0, z: 0 },
                destinationPosition: { x: 1, z: -1 },
                blockIndex: 0,
                sourceBlockId: 'primary',
            },
            {
                sourcePosition: { x: 2, z: 1 },
                destinationPosition: { x: 3, z: 0 },
                blockIndex: 0,
                sourceBlockId: 'extra',
            },
            {
                sourcePosition: { x: 2, z: 1 },
                destinationPosition: { x: 3, z: 0 },
                blockIndex: 0,
                sourceBlockId: 'upper',
            },
        ]);
    });

    it('dedupes one stack by the lowest selected block', () => {
        const lowerBlock = createBlock('Tree', 'lower');
        const upperBlock = createBlock('Raised_Bed', 'upper');
        const sourceStack = createStack(0, 0, [lowerBlock, upperBlock]);
        const primaryTarget = createActiveDragPreviewTarget({
            blockId: upperBlock.id,
            blockIndex: 1,
            stackPosition: sourceStack.position,
        });
        const lowerTarget = createActiveDragPreviewTarget({
            blockId: lowerBlock.id,
            blockIndex: 0,
            stackPosition: sourceStack.position,
        });

        const segments = createPickupSelectionMovingSegments({
            blockData,
            canRecyclePrimarySegment: true,
            primaryTarget,
            selectedTargets: [primaryTarget, lowerTarget],
            stacks: [sourceStack],
        });

        assert.equal(segments.length, 1);
        assert.equal(segments[0]?.sourceStartIndex, 0);
        assert.deepEqual(segments[0]?.blocks, [lowerBlock, upperBlock]);
    });

    it('does not add an attached segment already covered by a selected stack slice', () => {
        const raisedBed = createBlock('Raised_Bed', 'raised-bed');
        const attachedBlock = createBlock('Block_Grass', 'attached');
        const sourceStack = createStack(0, 0, [raisedBed, attachedBlock]);
        const primaryTarget = createActiveDragPreviewTarget({
            blockId: raisedBed.id,
            blockIndex: 0,
            stackPosition: sourceStack.position,
        });

        const segments = createPickupSelectionMovingSegments({
            attachedSegment: {
                sourceStack,
                sourceStartIndex: 1,
                blocks: [attachedBlock],
                baseHeight: 1,
            },
            blockData,
            canRecyclePrimarySegment: false,
            primaryTarget,
            selectedTargets: [primaryTarget],
            stacks: [sourceStack],
        });

        assert.equal(segments.length, 1);
        assert.deepEqual(segments[0]?.blocks, [raisedBed, attachedBlock]);
    });
});
