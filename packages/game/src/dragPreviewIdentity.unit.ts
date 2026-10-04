import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
    findActiveDragPreviewTargetOffset,
    getActiveDragPreviewTargetPositionOffset,
} from './dragPreviewIdentity';

describe('activeDragPreviewTargetMatches', () => {
    it('matches the same block in the same stack slot', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'duplicate-block',
            blockIndex: 1,
            stackPosition: { x: 2, z: 3 },
        });

        assert.equal(activeDragPreviewTargetMatches(target, target), true);
    });

    it('does not match the same block id in another stack', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'duplicate-block',
            blockIndex: 0,
            stackPosition: { x: 2, z: 3 },
        });
        const sameIdElsewhere = createActiveDragPreviewTarget({
            blockId: 'duplicate-block',
            blockIndex: 0,
            stackPosition: { x: 4, z: 3 },
        });

        assert.equal(
            activeDragPreviewTargetMatches(target, sameIdElsewhere),
            false,
        );
    });

    it('does not match another block at the same stack position', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'block-a',
            blockIndex: 0,
            stackPosition: { x: 2, z: 3 },
        });
        const samePositionOtherBlock = createActiveDragPreviewTarget({
            blockId: 'block-b',
            blockIndex: 0,
            stackPosition: { x: 2, z: 3 },
        });

        assert.equal(
            activeDragPreviewTargetMatches(target, samePositionOtherBlock),
            false,
        );
    });

    it('does not match the same block id at another stack index', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'duplicate-block',
            blockIndex: 0,
            stackPosition: { x: 2, z: 3 },
        });
        const samePositionOtherIndex = createActiveDragPreviewTarget({
            blockId: 'duplicate-block',
            blockIndex: 1,
            stackPosition: { x: 2, z: 3 },
        });

        assert.equal(
            activeDragPreviewTargetMatches(target, samePositionOtherIndex),
            false,
        );
    });
});

describe('findActiveDragPreviewTargetOffset', () => {
    it('returns the matching target offset', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'block-a',
            blockIndex: 1,
            stackPosition: { x: 2, z: 3 },
        });
        const match = { ...target, hoverHeight: 1.25 };

        assert.equal(
            findActiveDragPreviewTargetOffset(
                [
                    {
                        blockId: 'block-b',
                        blockIndex: 0,
                        stackPosition: { x: 2, z: 3 },
                        hoverHeight: 0,
                    },
                    match,
                ],
                target,
            ),
            match,
        );
    });

    it('returns undefined when no target offset matches', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'block-a',
            blockIndex: 1,
            stackPosition: { x: 2, z: 3 },
        });

        assert.equal(
            findActiveDragPreviewTargetOffset(
                [
                    {
                        blockId: 'block-a',
                        blockIndex: 0,
                        stackPosition: { x: 2, z: 3 },
                        hoverHeight: 0,
                    },
                ],
                target,
            ),
            undefined,
        );
    });
});

describe('getActiveDragPreviewTargetPositionOffset', () => {
    it('returns the active drag transform for a matching target', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'block-a',
            blockIndex: 1,
            stackPosition: { x: 2, z: 3 },
        });

        assert.deepEqual(
            getActiveDragPreviewTargetPositionOffset(target, {
                relative: { x: -2, z: 4 },
                targets: [{ ...target, hoverHeight: 0.75 }],
            }),
            { x: -2, y: 0.85, z: 4 },
        );
    });

    it('returns null when there is no active drag transform match', () => {
        const target = createActiveDragPreviewTarget({
            blockId: 'block-a',
            blockIndex: 1,
            stackPosition: { x: 2, z: 3 },
        });

        assert.equal(
            getActiveDragPreviewTargetPositionOffset(target, {
                relative: { x: -2, z: 4 },
                targets: [],
            }),
            null,
        );
    });
});
