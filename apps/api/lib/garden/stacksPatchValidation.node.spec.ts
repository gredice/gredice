import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    validateSpanningBlockMove,
    validateStackPlacement,
} from './stacksPatchValidation';

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
        'FishingBoat',
        {
            attributes: {
                stackable: false,
                height: 0.62,
                placeableOnWater: true,
            },
        },
    ],
    ['Tree', { attributes: { stackable: true, height: 1 } }],
    ['HazelLightArch', { attributes: { stackable: false, height: 1.65 } }],
    ['StoneWalkway', { attributes: { stackable: false, height: 0.1 } }],
    ['WoodenWalkway', { attributes: { stackable: false, height: 0.1 } }],
    ['MulchWood', { attributes: { stackable: false, height: 0.01 } }],
    [
        'IceCreamCart',
        {
            attributes: {
                stackable: false,
                height: 1.9,
                spanDepth: 2,
                spanWidth: 3,
            },
        },
    ],
]);

describe('validateStackPlacement', () => {
    it('blocks non-water blocks directly above water', () => {
        const validation = validateStackPlacement({
            blockIds: ['water-a', 'tree-a'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['tree-a', 'Tree'],
            ]),
            blockDataByName,
        });

        assert.deepEqual(validation, {
            valid: false,
            error: 'Invalid stack placement: block water-a cannot support block tree-a',
        });
    });

    it('allows water blocks directly above water', () => {
        const validation = validateStackPlacement({
            blockIds: ['water-a', 'water-b'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['water-b', 'Block_Water'],
            ]),
            blockDataByName,
        });

        assert.deepEqual(validation, { valid: true });
    });

    it('allows the small wooden bridge directly above water', () => {
        const validation = validateStackPlacement({
            blockIds: ['water-a', 'bridge-a'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['bridge-a', 'SmallWoodenBridge'],
            ]),
            blockDataByName,
        });

        assert.deepEqual(validation, { valid: true });
    });

    for (const surfaceName of ['MulchWood', 'WoodenWalkway']) {
        it(`allows a decoration directly above ${surfaceName}`, () => {
            const validation = validateStackPlacement({
                blockIds: ['surface-a', 'cart-a'],
                blockNameById: new Map([
                    ['surface-a', surfaceName],
                    ['cart-a', 'IceCreamCart'],
                ]),
                blockDataByName,
            });

            assert.deepEqual(validation, { valid: true });
        });
    }

    for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
        it(`allows HazelLightArch directly above ${walkwayName}`, () => {
            const validation = validateStackPlacement({
                blockIds: ['walkway-a', 'arch-a'],
                blockNameById: new Map([
                    ['walkway-a', walkwayName],
                    ['arch-a', 'HazelLightArch'],
                ]),
                blockDataByName,
            });

            assert.deepEqual(validation, { valid: true });
        });
    }

    it('requires the fishing boat to have water or swamp support', () => {
        const unsupported = validateStackPlacement({
            blockIds: ['boat-a'],
            blockNameById: new Map([['boat-a', 'FishingBoat']]),
            blockDataByName,
        });
        const onLand = validateStackPlacement({
            blockIds: ['grass-a', 'boat-a'],
            blockNameById: new Map([
                ['grass-a', 'Block_Grass'],
                ['boat-a', 'FishingBoat'],
            ]),
            blockDataByName,
        });
        const onWater = validateStackPlacement({
            blockIds: ['water-a', 'boat-a'],
            blockNameById: new Map([
                ['water-a', 'Block_Water'],
                ['boat-a', 'FishingBoat'],
            ]),
            blockDataByName,
        });

        assert.equal(unsupported.valid, false);
        assert.equal(onLand.valid, false);
        assert.deepEqual(onWater, { valid: true });
    });
});

describe('validateSpanningBlockMove', () => {
    it('allows a boat move across level water with different support stacks', () => {
        const validation = validateSpanningBlockMove({
            stacks: [
                {
                    positionX: -2,
                    positionY: 7,
                    blocks: ['source-angle', 'source-water', 'boat-a'],
                },
                {
                    positionX: 0,
                    positionY: -8,
                    blocks: ['target-angle', 'target-water-shaped'],
                },
                {
                    positionX: 0,
                    positionY: -7,
                    blocks: ['target-water-flat'],
                },
            ],
            fromPath: '/-2/7/2',
            toPath: '/0/-8/-',
            movedBlockId: 'boat-a',
            blockNameById: new Map([
                ['source-angle', 'Block_Grass_Angle'],
                ['source-water', 'Block_Water'],
                ['boat-a', 'FishingBoat'],
                ['target-angle', 'Block_Grass_Angle'],
                ['target-water-shaped', 'Block_Water'],
                ['target-water-flat', 'Block_Water'],
            ]),
            blockDataByName,
            parsePath: (path) => {
                const [, x, y, index] = path.split('/');
                return {
                    x: Number(x),
                    y: Number(y),
                    index: index === '-' ? undefined : Number(index),
                };
            },
        });

        assert.deepEqual(validation, { valid: true });
    });

    it('allows every cell of a multi-cell decoration on even mulch supports', () => {
        const mulchStacks = Array.from({ length: 3 }, (_, x) =>
            Array.from({ length: 2 }, (_, y) => ({
                positionX: x + 4,
                positionY: y,
                blocks: [`mulch-${x}-${y}`],
            })),
        ).flat();
        const blockNameById = new Map([
            ['cart-a', 'IceCreamCart'],
            ...mulchStacks.map(
                (stack) => [stack.blocks[0] ?? '', 'MulchWood'] as const,
            ),
        ]);
        const validation = validateSpanningBlockMove({
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['cart-a'] },
                ...mulchStacks,
            ],
            fromPath: 'source',
            toPath: 'destination',
            movedBlockId: 'cart-a',
            blockNameById,
            blockDataByName,
            parsePath: (path) =>
                path === 'source'
                    ? { x: 0, y: 0, index: 0 }
                    : { x: 4, y: 0, index: 1 },
        });

        assert.deepEqual(validation, { valid: true });
    });
});
