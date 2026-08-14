import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planRaisedBedSingleBlockMigration } from './raisedBedSingleBlockMigration';

describe('planRaisedBedSingleBlockMigration', () => {
    it('keeps the referenced id and chooses the minimum coordinate as anchor', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    orientation: 'vertical',
                    raisedBedId: 10,
                    status: 'new',
                },
            ],
            placements: [
                {
                    blockId: 'legacy',
                    gardenId: 1,
                    index: 1,
                    referenced: false,
                    rotation: 0,
                    x: 4,
                    y: 2,
                },
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    index: 1,
                    referenced: true,
                    rotation: 0,
                    x: 3,
                    y: 2,
                },
            ],
        });

        assert.deepEqual(result, {
            alreadySingle: [],
            plans: [
                {
                    anchor: { x: 3, y: 2 },
                    canonicalBlockId: 'canonical',
                    gardenId: 1,
                    legacyBlockId: 'legacy',
                    orientation: 'vertical',
                    raisedBedId: 10,
                    rotation: 1,
                    sourceRaisedBedId: null,
                    stackIndex: 1,
                },
            ],
            unplaced: [],
            unsafe: [],
        });
    });

    it('normalizes a legacy single block to its stored orientation', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    orientation: 'vertical',
                    raisedBedId: 10,
                    status: 'active',
                },
            ],
            placements: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    index: 1,
                    referenced: true,
                    rotation: 0,
                    x: 3,
                    y: 2,
                },
            ],
        });

        assert.deepEqual(result, {
            alreadySingle: [],
            plans: [
                {
                    anchor: { x: 3, y: 2 },
                    canonicalBlockId: 'canonical',
                    gardenId: 1,
                    legacyBlockId: null,
                    orientation: 'vertical',
                    raisedBedId: 10,
                    rotation: 1,
                    sourceRaisedBedId: null,
                    stackIndex: 1,
                },
            ],
            unplaced: [],
            unsafe: [],
        });
    });

    it('is idempotent once the catalogue has a native footprint', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: true,
            raisedBeds: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    orientation: 'vertical',
                    raisedBedId: 10,
                    status: 'active',
                },
            ],
            placements: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    index: 1,
                    referenced: true,
                    rotation: 1,
                    x: 3,
                    y: 2,
                },
            ],
        });

        assert.deepEqual(result, {
            alreadySingle: [10],
            plans: [],
            unplaced: [],
            unsafe: [],
        });
    });

    it('merges a pair of referenced new raised-bed halves', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: [
                {
                    blockId: 'z-source',
                    gardenId: 1,
                    orientation: 'vertical',
                    raisedBedId: 11,
                    status: 'new',
                },
                {
                    blockId: 'a-target',
                    gardenId: 1,
                    orientation: 'vertical',
                    raisedBedId: 10,
                    status: 'new',
                },
            ],
            placements: [
                {
                    blockId: 'z-source',
                    gardenId: 1,
                    index: 1,
                    referenced: true,
                    rotation: 0,
                    x: 4,
                    y: 2,
                },
                {
                    blockId: 'a-target',
                    gardenId: 1,
                    index: 1,
                    referenced: true,
                    rotation: 0,
                    x: 3,
                    y: 2,
                },
            ],
        });

        assert.deepEqual(result, {
            alreadySingle: [],
            plans: [
                {
                    anchor: { x: 3, y: 2 },
                    canonicalBlockId: 'a-target',
                    gardenId: 1,
                    legacyBlockId: 'z-source',
                    orientation: 'vertical',
                    raisedBedId: 10,
                    rotation: 1,
                    sourceRaisedBedId: 11,
                    stackIndex: 1,
                },
            ],
            unplaced: [],
            unsafe: [],
        });
    });

    it('refuses a referenced component with more than two halves', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: ['left', 'middle', 'right'].map((blockId, index) => ({
                blockId,
                gardenId: 1,
                orientation: 'horizontal' as const,
                raisedBedId: index + 1,
                status: 'new',
            })),
            placements: ['left', 'middle', 'right'].map((blockId, index) => ({
                blockId,
                gardenId: 1,
                index: 0,
                referenced: true,
                rotation: 0,
                x: 0,
                y: index,
            })),
        });

        assert.equal(result.plans.length, 0);
        assert.match(result.unsafe[0]?.reason ?? '', /3 records/);
    });

    it('refuses ambiguous legacy halves', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    orientation: 'horizontal',
                    raisedBedId: 10,
                    status: 'new',
                },
            ],
            placements: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    index: 0,
                    referenced: true,
                    rotation: 0,
                    x: 0,
                    y: 0,
                },
                {
                    blockId: 'legacy-a',
                    gardenId: 1,
                    index: 0,
                    referenced: false,
                    rotation: 0,
                    x: 0,
                    y: 1,
                },
                {
                    blockId: 'legacy-b',
                    gardenId: 1,
                    index: 0,
                    referenced: false,
                    rotation: 0,
                    x: 1,
                    y: 0,
                },
            ],
        });

        assert.equal(result.plans.length, 0);
        assert.match(result.unsafe[0]?.reason ?? '', /at most one/);
        assert.equal(result.unsafe.length, 3);
    });

    it('refuses an unreferenced raised-bed block that no plan consumes', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    orientation: 'horizontal',
                    raisedBedId: 10,
                    status: 'new',
                },
            ],
            placements: [
                {
                    blockId: 'canonical',
                    gardenId: 1,
                    index: 0,
                    referenced: true,
                    rotation: 0,
                    x: 0,
                    y: 0,
                },
                {
                    blockId: 'orphan',
                    gardenId: 1,
                    index: 0,
                    referenced: false,
                    rotation: 0,
                    x: 5,
                    y: 5,
                },
            ],
        });

        assert.deepEqual(result, {
            alreadySingle: [],
            plans: [
                {
                    anchor: { x: 0, y: 0 },
                    canonicalBlockId: 'canonical',
                    gardenId: 1,
                    legacyBlockId: null,
                    orientation: 'horizontal',
                    raisedBedId: 10,
                    rotation: 0,
                    sourceRaisedBedId: null,
                    stackIndex: 0,
                },
            ],
            unplaced: [],
            unsafe: [
                {
                    blockId: 'orphan',
                    gardenId: 1,
                    raisedBedId: null,
                    reason: 'unreferenced Raised_Bed block was not matched to a canonical block',
                },
            ],
        });
    });
});
