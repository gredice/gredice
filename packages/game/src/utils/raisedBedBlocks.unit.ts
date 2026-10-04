import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
    getRaisedBedFootprintSegments,
} from './raisedBedBlocks';

describe('single-block raised-bed geometry', () => {
    it('maps a horizontal block to both nine-field visual sections', () => {
        assert.deepEqual(getRaisedBedFootprintSegments(0), [
            {
                blockIndex: 0,
                blockOffset: 9,
                offset: { x: 0, z: 0.05 },
                shapeRotation: 3,
            },
            {
                blockIndex: 1,
                blockOffset: 0,
                offset: { x: 0, z: 0.95 },
                shapeRotation: 1,
            },
        ]);
    });

    it('rotates the complete footprint without introducing another block id', () => {
        const garden = {
            raisedBeds: [
                { id: 7, blockId: 'bed', orientation: 'vertical' as const },
            ],
        };

        assert.deepEqual(getRaisedBedBlockIds(garden, 7), ['bed']);
        assert.equal(findRaisedBedByBlockId(garden, 'bed')?.id, 7);
        assert.deepEqual(
            getRaisedBedFootprintSegments(1).map((segment) => segment.offset),
            [
                { x: 0.05, z: 0 },
                { x: 0.95, z: 0 },
            ],
        );
    });
});
