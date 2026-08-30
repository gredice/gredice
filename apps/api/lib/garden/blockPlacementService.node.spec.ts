import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveGardenBlockPlacement } from './blockPlacementService';

const blockDataByName = new Map([
    ['Block_Grass', { attributes: { stackable: true, height: 1 } }],
    ['Block_Grass_Angle', { attributes: { stackable: true, height: 1 } }],
    [
        'Block_Water',
        {
            attributes: {
                stackable: true,
                height: 1,
                placeableOnWater: true,
            },
        },
    ],
    [
        'Block_Swamp',
        {
            attributes: {
                stackable: true,
                height: 1,
                placeableOnWater: true,
            },
        },
    ],
    [
        'FishingBoat',
        {
            attributes: {
                stackable: false,
                height: 0.62,
                placeableOnWater: true,
                spanWidth: 1,
                spanDepth: 2,
            },
        },
    ],
    [
        'SmallWoodenBridge',
        {
            attributes: {
                stackable: false,
                height: 0.38,
                placeableOnWater: true,
            },
        },
    ],
    [
        'Raised_Bed',
        {
            attributes: {
                stackable: false,
                height: 1,
                spanWidth: 1,
                spanDepth: 2,
            },
        },
    ],
    ['Shade', { attributes: { stackable: false, height: 1 } }],
    [
        'LemonadeStand',
        {
            attributes: {
                stackable: false,
                height: 1,
                spanWidth: 3,
                spanDepth: 2,
            },
        },
    ],
    ['HazelLightArch', { attributes: { stackable: false, height: 1.65 } }],
    ['StoneWalkway', { attributes: { stackable: false, height: 0.1 } }],
    ['WoodenWalkway', { attributes: { stackable: false, height: 0.1 } }],
]);

const maxSpiralSteps = 1000;

function spiral(step: number) {
    const r = Math.floor((Math.sqrt(step + 1) - 1) / 2) + 1;
    const p = (8 * r * (r - 1)) / 2;
    const en = r * 2;
    const a = (1 + step - p) % (r * 8);

    switch (Math.floor(a / (r * 2))) {
        case 0:
            return { x: a - r, y: -r };
        case 1:
            return { x: r, y: (a % en) - r };
        case 2:
            return { x: r - (a % en), y: r };
        case 3:
            return { x: -r, y: r - (a % en) };
        default:
            return { x: 0, y: 0 };
    }
}

function createWaterOnlyPlacementSearch() {
    const blockNameById = new Map([['water-origin', 'Block_Water']]);
    const stacks = [{ positionX: 0, positionY: 0, blocks: ['water-origin'] }];

    for (let step = 0; step < maxSpiralSteps; step++) {
        const { x, y } = spiral(step);
        const blockId = `water-${step}`;
        blockNameById.set(blockId, 'Block_Water');
        stacks.push({ positionX: x, positionY: y, blocks: [blockId] });
    }

    return { blockNameById, stacks };
}

describe('resolveGardenBlockPlacement', () => {
    it('skips invalid raised-bed positions near origin and finds the first valid slot', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Raised_Bed',
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] },
                { positionX: 1, positionY: 0, blocks: ['grass-b', 'bed-b'] },
            ],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['grass-b', 'Block_Grass'],
                ['bed-a', 'Raised_Bed'],
                ['bed-b', 'Raised_Bed'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: -1,
                y: 1,
                index: 0,
                existingBlocks: [],
            },
        });
    });

    it('resolves a raised-bed purchase as one complete 1 x 2 offer', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Raised_Bed',
            requestedPosition: { x: 4, y: 6 },
            stacks: [],
            blockNameById: new Map(),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 4,
                y: 6,
                index: 0,
                existingBlocks: [],
            },
        });
    });

    it('starts automatic placement near the preferred position', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Shade',
            preferredPosition: { x: 12.4, y: -7.6 },
            stacks: [],
            blockNameById: new Map(),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 12,
                y: -8,
                index: 0,
                existingBlocks: [],
            },
        });
    });

    it('searches outward from the preferred position when that cell is blocked', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Shade',
            preferredPosition: { x: 12, y: -8 },
            stacks: [{ positionX: 12, positionY: -8, blocks: ['shade-a'] }],
            blockNameById: new Map([['shade-a', 'Shade']]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 12,
                y: -9,
                index: 0,
                existingBlocks: [],
            },
        });
    });

    it('skips structure-occupied cells during automatic placement', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Shade',
            blockedCells: new Set(['0|0', '0|-1']),
            stacks: [],
            blockNameById: new Map(),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 1,
                y: -1,
                index: 0,
                existingBlocks: [],
            },
        });
    });

    it('rejects a requested footprint that intersects a structure', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Raised_Bed',
            blockedCells: new Set(['4|7']),
            requestedPosition: { x: 4, y: 6 },
            stacks: [],
            blockNameById: new Map(),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid block placement: structure occupies 4|7',
        });
    });

    it('rejects explicitly requested raised-bed positions that the backend would not allow', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Raised_Bed',
            requestedPosition: { x: 0, y: -1 },
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['grass-a', 'bed-a'] },
                { positionX: 1, positionY: 0, blocks: ['grass-b', 'bed-b'] },
            ],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['grass-b', 'Block_Grass'],
                ['bed-a', 'Raised_Bed'],
                ['bed-b', 'Raised_Bed'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid block placement: block bed-a cannot support Raised_Bed',
        });
    });

    it('rejects placing ground blocks on non-empty stacks', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Block_Grass',
            requestedPosition: { x: 0, y: 0 },
            stacks: [{ positionX: 0, positionY: 0, blocks: ['shade-a'] }],
            blockNameById: new Map([['shade-a', 'Shade']]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid block placement: ground blocks can only be placed on empty stacks',
        });
    });

    it('prefers a valid non-water stack over a valid water stack', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Shade',
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['water-a'] },
                { positionX: 0, positionY: -1, blocks: ['grass-a'] },
            ],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['grass-a', 'Block_Grass'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 0,
                y: -1,
                index: 1,
                existingBlocks: ['grass-a'],
            },
        });
    });

    it('rejects water stacks when the placed block is not placeable on water', () => {
        const { blockNameById, stacks } = createWaterOnlyPlacementSearch();
        const placement = resolveGardenBlockPlacement({
            blockName: 'Shade',
            stacks,
            blockNameById,
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'No valid placement position found',
        });
    });

    it('uses a water stack when the placed block is placeable on water', () => {
        const { blockNameById, stacks } = createWaterOnlyPlacementSearch();
        const placement = resolveGardenBlockPlacement({
            blockName: 'Block_Water',
            stacks,
            blockNameById,
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 0,
                y: 0,
                index: 1,
                existingBlocks: ['water-origin'],
            },
        });
    });

    it('places the small wooden bridge on a requested water stack', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'SmallWoodenBridge',
            requestedPosition: { x: 0, y: 0 },
            stacks: [{ positionX: 0, positionY: 0, blocks: ['water-origin'] }],
            blockNameById: new Map([['water-origin', 'Block_Water']]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 0,
                y: 0,
                index: 1,
                existingBlocks: ['water-origin'],
            },
        });
    });

    for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
        it(`places HazelLightArch on a requested ${walkwayName} stack`, () => {
            const placement = resolveGardenBlockPlacement({
                blockName: 'HazelLightArch',
                requestedPosition: { x: 0, y: 0 },
                stacks: [
                    {
                        positionX: 0,
                        positionY: 0,
                        blocks: ['walkway-origin'],
                    },
                ],
                blockNameById: new Map([['walkway-origin', walkwayName]]),
                blockDataByName,
            });

            assert.deepStrictEqual(placement, {
                valid: true,
                placement: {
                    x: 0,
                    y: 0,
                    index: 1,
                    existingBlocks: ['walkway-origin'],
                },
            });
        });
    }

    it('requires water or swamp below every fishing boat footprint cell', () => {
        const supportCases = [
            {
                name: 'water',
                supportNames: ['Block_Water', 'Block_Water'],
                valid: true,
            },
            {
                name: 'swamp',
                supportNames: ['Block_Swamp', 'Block_Swamp'],
                valid: true,
            },
            {
                name: 'land',
                supportNames: ['Block_Grass', 'Block_Grass'],
                valid: false,
            },
            {
                name: 'partial water',
                supportNames: ['Block_Water'],
                valid: false,
            },
        ] as const;

        for (const supportCase of supportCases) {
            const supportBlocks = supportCase.supportNames.map(
                (supportName, index) => ({
                    id: `${supportCase.name}-${index.toString()}`,
                    name: supportName,
                }),
            );
            const placement = resolveGardenBlockPlacement({
                blockName: 'FishingBoat',
                requestedPosition: { x: 0, y: 0 },
                stacks: supportBlocks.map((support, index) => ({
                    positionX: 0,
                    positionY: index,
                    blocks: [support.id],
                })),
                blockNameById: new Map(
                    supportBlocks.map((support) => [support.id, support.name]),
                ),
                blockDataByName,
            });

            assert.equal(placement.valid, supportCase.valid, supportCase.name);
        }
    });

    it('rejects multi-block placement on uneven footprint support', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'LemonadeStand',
            requestedPosition: { x: 0, y: 0 },
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['grass-a'] },
                { positionX: 0, positionY: 1, blocks: ['grass-b'] },
                { positionX: 1, positionY: 0, blocks: ['grass-c'] },
                { positionX: 1, positionY: 1, blocks: ['grass-d'] },
                { positionX: 2, positionY: 0, blocks: ['grass-e'] },
            ],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['grass-b', 'Block_Grass'],
                ['grass-c', 'Block_Grass'],
                ['grass-d', 'Block_Grass'],
                ['grass-e', 'Block_Grass'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid block placement: all spanned cells must be on the same level',
        });
    });

    it('places a spanning block on level water with shaped terrain underneath', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'FishingBoat',
            requestedPosition: { x: 0, y: 0 },
            stacks: [
                {
                    positionX: 0,
                    positionY: 0,
                    blocks: ['angle-a', 'water-shaped'],
                },
                {
                    positionX: 0,
                    positionY: 1,
                    blocks: ['water-flat'],
                },
            ],
            blockNameById: new Map([
                ['angle-a', 'Block_Grass_Angle'],
                ['water-shaped', 'Block_Water'],
                ['water-flat', 'Block_Water'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 0,
                y: 0,
                index: 2,
                existingBlocks: ['angle-a', 'water-shaped'],
            },
        });
    });

    it('treats existing multi-block footprints as occupied cells', () => {
        const placement = resolveGardenBlockPlacement({
            blockName: 'Shade',
            requestedPosition: { x: 1, y: 0 },
            stacks: [
                {
                    positionX: 0,
                    positionY: 0,
                    blocks: ['grass-a', 'stand-a'],
                },
                { positionX: 1, positionY: 0, blocks: ['grass-b'] },
            ],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['grass-b', 'Block_Grass'],
                ['stand-a', 'LemonadeStand'],
            ]),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: false,
            error: 'Invalid block placement: block stand-a cannot support Shade',
        });
    });

    it('treats water anywhere under a multi-block footprint as a fallback', () => {
        const supportBlocks = [
            { x: 0, y: 0, id: 'grass-0-0', name: 'Block_Grass' },
            { x: 1, y: 0, id: 'water-1-0', name: 'Block_Water' },
            { x: 2, y: 0, id: 'grass-2-0', name: 'Block_Grass' },
            { x: 3, y: 0, id: 'grass-3-0', name: 'Block_Grass' },
            { x: 0, y: 1, id: 'grass-0-1', name: 'Block_Grass' },
            { x: 1, y: 1, id: 'grass-1-1', name: 'Block_Grass' },
            { x: 2, y: 1, id: 'grass-2-1', name: 'Block_Grass' },
            { x: 3, y: 1, id: 'grass-3-1', name: 'Block_Grass' },
            { x: 1, y: 2, id: 'grass-1-2', name: 'Block_Grass' },
            { x: 2, y: 2, id: 'grass-2-2', name: 'Block_Grass' },
            { x: 3, y: 2, id: 'grass-3-2', name: 'Block_Grass' },
        ];
        const placement = resolveGardenBlockPlacement({
            blockName: 'LemonadeStand',
            stacks: supportBlocks.map((block) => ({
                positionX: block.x,
                positionY: block.y,
                blocks: [block.id],
            })),
            blockNameById: new Map(
                supportBlocks.map((block) => [block.id, block.name]),
            ),
            blockDataByName,
        });

        assert.deepStrictEqual(placement, {
            valid: true,
            placement: {
                x: 1,
                y: 1,
                index: 1,
                existingBlocks: ['grass-1-1'],
            },
        });
    });
});
