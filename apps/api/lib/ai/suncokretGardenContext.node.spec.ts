import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildGardenCompositionContext,
    visibleOperationsForGarden,
    visibleRaisedBedsForGarden,
} from './suncokretGardenContext';

test('buildGardenCompositionContext summarizes only placed blocks with directory details', () => {
    const context = buildGardenCompositionContext({
        blockData: [
            {
                information: {
                    name: 'Sunflower',
                    label: 'Suncokret',
                    shortDescription: 'Cvijet koji daruje suncokrete.',
                    fullDescription: 'Dekoracija s posebnom nagradom.',
                },
                attributes: { type: 'decoration' },
                functions: { raisedBed: false, recycler: false },
            },
            {
                information: {
                    name: 'Raised_Bed',
                    label: 'Gredica',
                },
                attributes: { type: 'raisedBed' },
                functions: { raisedBed: true, recycler: false },
            },
        ],
        blocks: [
            { id: 'sunflower-1', name: 'Sunflower' },
            { id: 'sunflower-2', name: 'Sunflower' },
            { id: 'raised-bed', name: 'Raised_Bed' },
            { id: 'stored-tree', name: 'Tree' },
        ],
        isSandbox: false,
        stacks: [
            { blocks: ['sunflower-1', 'raised-bed'] },
            { blocks: ['sunflower-2', 'missing-block'] },
        ],
    });

    assert.equal(context.placedBlockCount, 3);
    assert.equal(context.distinctBlockTypeCount, 2);
    assert.equal(context.unresolvedPlacedBlockCount, 1);
    assert.deepStrictEqual(
        context.items.map(({ count, label, name, type }) => ({
            count,
            label,
            name,
            type,
        })),
        [
            {
                count: 2,
                label: 'Suncokret',
                name: 'Sunflower',
                type: 'decoration',
            },
            {
                count: 1,
                label: 'Gredica',
                name: 'Raised_Bed',
                type: 'raisedBed',
            },
        ],
    );
    assert.equal(
        context.items.some((item) => item.name === 'Tree'),
        false,
    );
});

test('buildGardenCompositionContext explains the exact sunflower drop chance and rules', () => {
    const context = buildGardenCompositionContext({
        blockData: [],
        blocks: Array.from({ length: 5 }, (_, index) => ({
            id: `sunflower-${index.toString()}`,
            name: 'Sunflower',
        })),
        isSandbox: false,
        stacks: [
            {
                blocks: Array.from(
                    { length: 5 },
                    (_, index) => `sunflower-${index.toString()}`,
                ),
            },
        ],
    });
    const reward = context.specialRewards.sunflowerDrop;

    assert.equal(reward.placedSunflowerCount, 5);
    assert.equal(reward.eligibleByGardenTypeAndContents, true);
    assert.equal(reward.baseChancePerSunflower, 0.1);
    assert.equal(reward.chancePerEligibleVisit, 1 - 0.9 ** 5);
    assert.equal(reward.chancePercentPerEligibleVisit, 40.95);
    assert.equal(reward.rewardAmount, 1);
    assert.equal(reward.dailyLimit, 2);
    assert.equal(reward.dailyLimitScope, 'account');
    assert.equal(reward.requirements.sunnyWeatherRequired, true);
    assert.equal(
        reward.requirements.currentWeatherMustBeCheckedSeparately,
        true,
    );
});

test('visibleRaisedBedsForGarden excludes beds whose blocks are no longer placed', () => {
    const visibleRaisedBeds = visibleRaisedBedsForGarden({
        raisedBeds: [
            { id: 11, blockId: 'current-block' },
            { id: 12, blockId: 'deleted-block' },
            { id: 13, blockId: null },
        ],
        stacks: [{ blocks: ['current-block', 'decoration-block'] }],
    });

    assert.deepStrictEqual(
        visibleRaisedBeds.map((raisedBed) => raisedBed.id),
        [11],
    );
});

test('visibleOperationsForGarden keeps garden-wide and visible-bed operations', () => {
    const garden = {
        raisedBeds: [
            { id: 11, blockId: 'current-block' },
            { id: 12, blockId: 'deleted-block' },
            { id: 13, blockId: null },
        ],
        stacks: [{ blocks: ['current-block'] }],
    };
    const operations = [
        { id: 101, raisedBedId: null },
        { id: 102, raisedBedId: 11 },
        { id: 103, raisedBedId: 12 },
        { id: 104, raisedBedId: 13 },
    ];

    assert.deepStrictEqual(
        visibleOperationsForGarden(garden, operations).map(
            (operation) => operation.id,
        ),
        [101, 102],
    );
});
