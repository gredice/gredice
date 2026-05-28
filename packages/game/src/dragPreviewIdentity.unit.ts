import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
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
