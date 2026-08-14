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

    it('uses an explicit pair to resolve a three-record component', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            resolvedPairs: [{ firstRaisedBedId: 2, secondRaisedBedId: 3 }],
            raisedBeds: ['oldest', 'middle', 'newest'].map(
                (blockId, index) => ({
                    blockId,
                    gardenId: 18,
                    orientation: 'vertical' as const,
                    raisedBedId: index + 1,
                    status: 'new',
                }),
            ),
            placements: ['oldest', 'middle', 'newest'].map(
                (blockId, index) => ({
                    blockId,
                    gardenId: 18,
                    index: 0,
                    referenced: true,
                    rotation: 0,
                    x: 4,
                    y: index + 1,
                }),
            ),
        });

        assert.deepEqual(result, {
            alreadySingle: [],
            plans: [
                {
                    anchor: { x: 4, y: 2 },
                    canonicalBlockId: 'middle',
                    gardenId: 18,
                    legacyBlockId: 'newest',
                    orientation: 'horizontal',
                    raisedBedId: 2,
                    rotation: 0,
                    sourceRaisedBedId: 3,
                    stackIndex: 0,
                },
                {
                    anchor: { x: 4, y: 1 },
                    canonicalBlockId: 'oldest',
                    gardenId: 18,
                    legacyBlockId: null,
                    orientation: 'vertical',
                    raisedBedId: 1,
                    rotation: 1,
                    sourceRaisedBedId: null,
                    stackIndex: 0,
                },
            ],
            unplaced: [],
            unsafe: [],
        });
    });

    it('rejects an explicit pair unless both active records are adjacent and new', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            resolvedPairs: [{ firstRaisedBedId: 1, secondRaisedBedId: 2 }],
            raisedBeds: ['left', 'right'].map((blockId, index) => ({
                blockId,
                gardenId: 1,
                orientation: 'horizontal' as const,
                raisedBedId: index + 1,
                status: index === 0 ? 'built' : 'new',
            })),
            placements: ['left', 'right'].map((blockId, index) => ({
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
        assert.match(result.unsafe[0]?.reason ?? '', /must still be new/);
    });

    it('keeps adjacent full 18-field raised beds as separate logical beds', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: ['left', 'right'].map((blockId, index) => ({
                blockId,
                gardenId: 137,
                maxFieldPosition: 17,
                minFieldPosition: 0,
                orientation: 'vertical' as const,
                raisedBedId: index + 1,
                status: 'new',
            })),
            placements: ['left', 'right'].map((blockId, index) => ({
                blockId,
                gardenId: 137,
                index: 1,
                referenced: true,
                rotation: index,
                x: -2,
                y: index - 1,
            })),
        });

        assert.deepEqual(result, {
            alreadySingle: [],
            plans: [
                {
                    anchor: { x: -2, y: -1 },
                    canonicalBlockId: 'left',
                    gardenId: 137,
                    legacyBlockId: null,
                    orientation: 'vertical',
                    raisedBedId: 1,
                    rotation: 1,
                    sourceRaisedBedId: null,
                    stackIndex: 1,
                },
                {
                    anchor: { x: -2, y: 0 },
                    canonicalBlockId: 'right',
                    gardenId: 137,
                    legacyBlockId: null,
                    orientation: 'vertical',
                    raisedBedId: 2,
                    rotation: 1,
                    sourceRaisedBedId: null,
                    stackIndex: 1,
                },
            ],
            unplaced: [],
            unsafe: [],
        });
    });

    it('supports an explicit keep-separate decision after a partial migration', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            separatePairs: [{ firstRaisedBedId: 1, secondRaisedBedId: 2 }],
            raisedBeds: [
                {
                    blockId: 'legacy-single',
                    gardenId: 18,
                    maxFieldPosition: null,
                    minFieldPosition: null,
                    orientation: 'vertical',
                    raisedBedId: 1,
                    status: 'new',
                },
                {
                    blockId: 'converted-pair',
                    gardenId: 18,
                    maxFieldPosition: 17,
                    minFieldPosition: 0,
                    orientation: 'horizontal',
                    raisedBedId: 2,
                    status: 'new',
                },
            ],
            placements: [
                {
                    blockId: 'legacy-single',
                    gardenId: 18,
                    index: 0,
                    referenced: true,
                    rotation: 1,
                    x: 4,
                    y: 1,
                },
                {
                    blockId: 'converted-pair',
                    gardenId: 18,
                    index: 0,
                    referenced: true,
                    rotation: 0,
                    x: 4,
                    y: 2,
                },
            ],
        });

        assert.equal(result.plans.length, 2);
        assert.equal(result.plans[0]?.legacyBlockId, null);
        assert.equal(result.plans[1]?.legacyBlockId, null);
        assert.deepEqual(result.unsafe, []);
    });

    it('fails closed on a mixed legacy and converted pair without an explicit decision', () => {
        const result = planRaisedBedSingleBlockMigration({
            nativeFootprint: false,
            raisedBeds: [
                {
                    blockId: 'legacy-single',
                    gardenId: 18,
                    maxFieldPosition: null,
                    minFieldPosition: null,
                    orientation: 'vertical',
                    raisedBedId: 1,
                    status: 'new',
                },
                {
                    blockId: 'converted-pair',
                    gardenId: 18,
                    maxFieldPosition: 17,
                    minFieldPosition: 0,
                    orientation: 'horizontal',
                    raisedBedId: 2,
                    status: 'new',
                },
            ],
            placements: [
                {
                    blockId: 'legacy-single',
                    gardenId: 18,
                    index: 0,
                    referenced: true,
                    rotation: 1,
                    x: 4,
                    y: 1,
                },
                {
                    blockId: 'converted-pair',
                    gardenId: 18,
                    index: 0,
                    referenced: true,
                    rotation: 0,
                    x: 4,
                    y: 2,
                },
            ],
        });

        assert.equal(result.plans.length, 0);
        assert.match(result.unsafe[0]?.reason ?? '', /keep-separate/);
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
