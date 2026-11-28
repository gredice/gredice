import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import {
    canStackBlockOnBlock,
    createGardenBlockPlacementValidator,
    type GardenBlockDataLike,
    type GardenBlockPlacementResult,
    type GardenBlockPlacementValidationResult,
    type GardenBlockStack,
    getEffectiveGardenStackBlockHeight,
    getGardenBlockFootprintOffsets,
    getGardenStackHeightByBlockIds,
    isBlockPlaceableOnWater,
    isEdgeOrCornerTerrainBlockName,
    isWaterBlockName,
    normalizeGardenBlockRotation,
    resolveGardenBlockPlacement,
} from './index';

const nonStackable: GardenBlockDataLike = {
    attributes: { stackable: false },
};

const validatorBlockData = new Map<string, GardenBlockDataLike>([
    ['Block_Grass', { attributes: { height: 1, stackable: true } }],
    ['Block_Grass_Angle', { attributes: { height: 1, stackable: true } }],
    ['Block_Water', { attributes: { height: 1, stackable: true } }],
    ['Tulip', { attributes: { height: 0.4, stackable: false } }],
    ['StoneSmall', { attributes: { height: 0.2, stackable: true } }],
    ['Crate', { attributes: { height: 1, stackable: false } }],
    [
        'HorseStable',
        {
            attributes: {
                height: 2,
                stackable: false,
                spanWidth: 2,
                spanDepth: 2,
            },
        },
    ],
    [
        'Raised_Bed',
        {
            attributes: {
                height: 0.5,
                stackable: false,
                spanWidth: 1,
                spanDepth: 2,
            },
        },
    ],
    [
        'FishingBoat',
        {
            attributes: {
                height: 0.3,
                stackable: false,
                spanWidth: 1,
                spanDepth: 2,
            },
        },
    ],
]);

function createValidatorGarden() {
    const stacks: GardenBlockStack[] = [
        { positionX: 0, positionY: 0, blocks: ['g0'] },
        { positionX: 1, positionY: 0, blocks: ['g1', 'tulip1'] },
        { positionX: 2, positionY: 0, blocks: ['crate1'] },
        // Covers (3,0), (4,0), (3,1) and (4,1).
        { positionX: 3, positionY: 0, blocks: ['stable1'] },
        // Water on shaped terrain collapses to the terrain's surface.
        { positionX: 0, positionY: 2, blocks: ['angle1', 'water1'] },
        { positionX: 1, positionY: 2, blocks: ['water2'] },
        // Rotated a quarter turn: covers (2,2) and (3,2).
        { positionX: 2, positionY: 2, blocks: ['bed1'] },
        { positionX: 0, positionY: 3, blocks: ['g2', 'stone1'] },
        { positionX: 5, positionY: 5, blocks: ['unknown1'] },
        { positionX: 6, positionY: 6, blocks: [] },
    ];
    const blockNameById = new Map([
        ['g0', 'Block_Grass'],
        ['g1', 'Block_Grass'],
        ['g2', 'Block_Grass'],
        ['tulip1', 'Tulip'],
        ['crate1', 'Crate'],
        ['stable1', 'HorseStable'],
        ['angle1', 'Block_Grass_Angle'],
        ['water1', 'Block_Water'],
        ['water2', 'Block_Water'],
        ['bed1', 'Raised_Bed'],
        ['stone1', 'StoneSmall'],
    ]);
    const blockRotationById = new Map<string, number | null | undefined>([
        ['bed1', 1],
        ['stable1', null],
    ]);

    return { stacks, blockNameById, blockRotationById };
}

function createTestValidator(blockName: string) {
    return createGardenBlockPlacementValidator({
        blockName,
        ...createValidatorGarden(),
        blockDataByName: validatorBlockData,
    });
}

function withoutBaseHeight(
    result: GardenBlockPlacementValidationResult,
): GardenBlockPlacementResult {
    if (!result.valid) {
        return result;
    }

    const { x, y, index, existingBlocks } = result.placement;
    return { valid: true, placement: { x, y, index, existingBlocks } };
}

function expectBaseHeight(
    result: GardenBlockPlacementValidationResult,
    baseHeight: number,
) {
    assert.equal(result.valid, true);
    if (result.valid) {
        assert.equal(result.placement.baseHeight, baseHeight);
    }
}

describe('normalizeGardenBlockRotation', () => {
    const cases: [number | null | undefined, number][] = [
        [0, 0],
        [1, 1],
        [3, 3],
        [4, 0],
        [5, 1],
        [-1, 3],
        [-4, 0],
        [-0, 0],
        [2.6, 3],
        [2.4, 2],
        [-1.5, 3],
        [2_147_483_647, 3],
        [-2_147_483_648, 0],
        [null, 0],
        [undefined, 0],
        [Number.NaN, 0],
        [Number.POSITIVE_INFINITY, 0],
        [Number.NEGATIVE_INFINITY, 0],
    ];

    for (const [rotation, expected] of cases) {
        it(`maps ${String(rotation)} to ${expected}`, () => {
            assert.equal(
                Object.is(normalizeGardenBlockRotation(rotation), expected),
                true,
            );
        });
    }
});

describe('createGardenBlockPlacementValidator', () => {
    it('matches resolveGardenBlockPlacement for every cell, block and rotation', () => {
        const garden = createValidatorGarden();
        const rotations = [undefined, 0, 1, 2, 3, 5, -1];
        let compared = 0;

        for (const blockName of [
            'Tulip',
            'Block_Grass',
            'Block_Water',
            'Crate',
            'Raised_Bed',
            'HorseStable',
            'FishingBoat',
        ]) {
            const validator = createTestValidator(blockName);
            for (let x = -1; x <= 7; x++) {
                for (let y = -1; y <= 7; y++) {
                    for (const rotation of rotations) {
                        assert.deepStrictEqual(
                            withoutBaseHeight(
                                validator.validate({ x, y }, rotation),
                            ),
                            resolveGardenBlockPlacement({
                                blockName,
                                ...garden,
                                blockDataByName: validatorBlockData,
                                requestedPosition: { x, y },
                                requestedRotation: rotation,
                            }),
                            `${blockName} at ${x},${y} rotation ${String(rotation)}`,
                        );
                        compared++;
                    }
                }
            }
        }

        assert.equal(compared, 7 * 9 * 9 * rotations.length);
    });

    it('applies the shared rules at a requested cell', () => {
        const tulip = createTestValidator('Tulip');
        const grass = createTestValidator('Block_Grass');

        assert.deepStrictEqual(tulip.validate({ x: 0, y: 0 }), {
            valid: true,
            placement: {
                x: 0,
                y: 0,
                index: 1,
                existingBlocks: ['g0'],
                baseHeight: 1,
            },
        });
        // Non-stackable support, neighbour footprint, water, unknown block.
        assert.equal(tulip.validate({ x: 1, y: 0 }).valid, false);
        assert.equal(tulip.validate({ x: 4, y: 1 }).valid, false);
        assert.equal(tulip.validate({ x: 1, y: 2 }).valid, false);
        assert.equal(tulip.validate({ x: 5, y: 5 }).valid, false);
        // Ground blocks only go on empty stacks.
        assert.equal(grass.validate({ x: 0, y: 0 }).valid, false);
        assert.equal(grass.validate({ x: 3, y: 2 }).valid, false);
        assert.equal(grass.validate({ x: 6, y: 6 }).valid, true);
    });

    it('reports the surface height under the footprint as baseHeight', () => {
        expectBaseHeight(
            createTestValidator('Tulip').validate({ x: 0, y: 0 }),
            1,
        );
        expectBaseHeight(
            createTestValidator('Tulip').validate({ x: 0, y: 3 }),
            1.2,
        );
        expectBaseHeight(
            createTestValidator('Tulip').validate({ x: 7, y: 7 }),
            0,
        );
        // Water collapses onto shaped terrain.
        expectBaseHeight(
            createTestValidator('Block_Water').validate({ x: 0, y: 2 }),
            1,
        );
        expectBaseHeight(
            createTestValidator('Block_Water').validate({ x: 1, y: 2 }),
            1,
        );
        // A multi-cell footprint on one level.
        expectBaseHeight(
            createTestValidator('Raised_Bed').validate({ x: 6, y: 0 }),
            0,
        );
        // Spanned cells on different levels are rejected.
        assert.equal(
            createTestValidator('Raised_Bed').validate({ x: 0, y: 0 }).valid,
            false,
        );
    });

    it('reads cell top heights including blocks anchored on neighbours', () => {
        const validator = createTestValidator('Tulip');
        const garden = createValidatorGarden();

        assert.equal(validator.getCellTopHeight({ x: 0, y: 0 }), 1);
        assert.equal(validator.getCellTopHeight({ x: 1, y: 0 }), 1.4);
        assert.equal(
            validator.getCellTopHeight({ x: 0, y: 3 }),
            getGardenStackHeightByBlockIds(
                ['g2', 'stone1'],
                garden.blockNameById,
                validatorBlockData,
            ),
        );
        // The stable anchored at (3,0) covers (4,1).
        assert.equal(validator.getCellTopHeight({ x: 3, y: 0 }), 2);
        assert.equal(validator.getCellTopHeight({ x: 4, y: 1 }), 2);
        assert.equal(validator.getCellTopHeight({ x: 5, y: 1 }), 0);
        // The quarter-turned bed covers (3,2), not (2,3).
        assert.equal(validator.getCellTopHeight({ x: 3, y: 2 }), 0.5);
        assert.equal(validator.getCellTopHeight({ x: 2, y: 3 }), 0);
        // Shaped terrain plus collapsed water.
        assert.equal(validator.getCellTopHeight({ x: 0, y: 2 }), 1);
        // Unknown blocks add no height.
        assert.equal(validator.getCellTopHeight({ x: 5, y: 5 }), 0);
        assert.equal(validator.getCellTopHeight({ x: 9, y: 9 }), 0);
    });

    it('reports empty cells and copies of stack ids', () => {
        const validator = createTestValidator('Tulip');

        assert.equal(validator.isCellEmpty({ x: 9, y: 9 }), true);
        assert.equal(validator.isCellEmpty({ x: 6, y: 6 }), true);
        assert.equal(validator.isCellEmpty({ x: 0, y: 0 }), false);
        assert.equal(validator.isCellEmpty({ x: 4, y: 1 }), false);
        assert.equal(validator.isCellEmpty({ x: 5, y: 5 }), false);

        const stack = validator.getStackBlockIds({ x: 1, y: 0 });
        assert.deepStrictEqual(stack, ['g1', 'tulip1']);
        stack.push('changed');
        assert.deepStrictEqual(validator.getStackBlockIds({ x: 1, y: 0 }), [
            'g1',
            'tulip1',
        ]);
        assert.deepStrictEqual(validator.getStackBlockIds({ x: 4, y: 1 }), []);
        assert.equal(validator.blockName, 'Tulip');
    });

    it('reads the levels of a cell stack, collapsed water included', () => {
        const validator = createTestValidator('Tulip');

        assert.deepStrictEqual(validator.getStackBlockLevels({ x: 1, y: 0 }), [
            {
                blockId: 'g1',
                blockName: 'Block_Grass',
                baseHeight: 0,
                topHeight: 1,
            },
            {
                blockId: 'tulip1',
                blockName: 'Tulip',
                baseHeight: 1,
                topHeight: 1.4,
            },
        ]);
        // Water on shaped terrain has no height of its own.
        assert.deepStrictEqual(validator.getStackBlockLevels({ x: 0, y: 2 }), [
            {
                blockId: 'angle1',
                blockName: 'Block_Grass_Angle',
                baseHeight: 0,
                topHeight: 1,
            },
            {
                blockId: 'water1',
                blockName: 'Block_Water',
                baseHeight: 1,
                topHeight: 1,
            },
        ]);
        // Only the cell's own stack; unknown blocks are left out.
        assert.deepStrictEqual(
            validator.getStackBlockLevels({ x: 4, y: 1 }),
            [],
        );
        assert.deepStrictEqual(
            validator.getStackBlockLevels({ x: 5, y: 5 }),
            [],
        );
        assert.deepStrictEqual(
            validator.getStackBlockLevels({ x: 9, y: 9 }),
            [],
        );
    });

    it('reads the block a new block would stand on', () => {
        const validator = createTestValidator('Tulip');

        assert.deepStrictEqual(validator.getCellTopBlock({ x: 1, y: 0 }), {
            blockId: 'tulip1',
            blockName: 'Tulip',
            baseHeight: 1,
            topHeight: 1.4,
        });
        // Collapsed water wins the tie with the terrain under it.
        assert.deepStrictEqual(validator.getCellTopBlock({ x: 0, y: 2 }), {
            blockId: 'water1',
            blockName: 'Block_Water',
            baseHeight: 1,
            topHeight: 1,
        });
        // A block anchored on a neighbouring cell.
        assert.deepStrictEqual(validator.getCellTopBlock({ x: 4, y: 1 }), {
            blockId: 'stable1',
            blockName: 'HorseStable',
            baseHeight: 0,
            topHeight: 2,
        });
        assert.equal(validator.getCellTopBlock({ x: 5, y: 5 }), null);
        assert.equal(validator.getCellTopBlock({ x: 9, y: 9 }), null);

        const placed = validator.withPlacedBlock({
            position: { x: 0, y: 0 },
            blockId: 'tulip-new',
        });
        assert.deepStrictEqual(placed.getCellTopBlock({ x: 0, y: 0 }), {
            blockId: 'tulip-new',
            blockName: 'Tulip',
            baseHeight: 1,
            topHeight: 1.4,
        });
        assert.deepStrictEqual(
            placed
                .getStackBlockLevels({ x: 0, y: 0 })
                .map((level) => level.blockId),
            ['g0', 'tulip-new'],
        );
        assert.deepStrictEqual(validator.getCellTopBlock({ x: 0, y: 0 }), {
            blockId: 'g0',
            blockName: 'Block_Grass',
            baseHeight: 0,
            topHeight: 1,
        });
    });

    it('keeps its own copy of the garden snapshot', () => {
        const garden = createValidatorGarden();
        const validator = createGardenBlockPlacementValidator({
            blockName: 'Tulip',
            ...garden,
            blockDataByName: validatorBlockData,
        });

        garden.stacks[0]?.blocks.push('tulip-late');
        garden.stacks.push({ positionX: 9, positionY: 9, blocks: ['g-late'] });
        garden.blockNameById.set('tulip-late', 'Tulip');
        garden.blockNameById.set('g-late', 'Block_Grass');
        garden.blockNameById.set('crate1', 'Block_Grass');

        assert.equal(validator.validate({ x: 0, y: 0 }).valid, true);
        assert.equal(validator.isCellEmpty({ x: 9, y: 9 }), true);
        assert.equal(validator.validate({ x: 2, y: 0 }).valid, false);
    });

    it('uses the first stack listed at a position, as lookups did', () => {
        const validator = createGardenBlockPlacementValidator({
            blockName: 'Tulip',
            stacks: [
                { positionX: 0, positionY: 0, blocks: ['g0'] },
                { positionX: 0, positionY: 0, blocks: ['crate1'] },
            ],
            blockNameById: new Map([
                ['g0', 'Block_Grass'],
                ['crate1', 'Crate'],
            ]),
            blockDataByName: validatorBlockData,
        });

        assert.deepStrictEqual(validator.getStackBlockIds({ x: 0, y: 0 }), [
            'g0',
        ]);
    });
});

describe('GardenBlockPlacementValidator.withPlacedBlock', () => {
    it('returns a new validator that sees the placed block', () => {
        const validator = createTestValidator('Tulip');
        const next = validator.withPlacedBlock({
            position: { x: 7, y: 7 },
            blockId: 'tulip-new',
        });

        assert.notEqual(next, validator);
        assert.equal(next.blockName, 'Tulip');
        assert.deepStrictEqual(next.getStackBlockIds({ x: 7, y: 7 }), [
            'tulip-new',
        ]);
        assert.equal(next.getCellTopHeight({ x: 7, y: 7 }), 0.4);
        assert.equal(next.isCellEmpty({ x: 7, y: 7 }), false);
        // A tulip cannot hold another tulip.
        assert.equal(next.validate({ x: 7, y: 7 }).valid, false);

        // The original validator is unchanged.
        assert.deepStrictEqual(validator.getStackBlockIds({ x: 7, y: 7 }), []);
        assert.equal(validator.getCellTopHeight({ x: 7, y: 7 }), 0);
        assert.equal(validator.isCellEmpty({ x: 7, y: 7 }), true);
        assert.equal(validator.validate({ x: 7, y: 7 }).valid, true);
    });

    it('stacks on existing blocks and on earlier placed blocks', () => {
        const water = createTestValidator('Block_Water');
        const once = water.withPlacedBlock({
            position: { x: 0, y: 2 },
            blockId: 'water-new-1',
        });
        const twice = once.withPlacedBlock({
            position: { x: 0, y: 2 },
            blockId: 'water-new-2',
        });

        assert.deepStrictEqual(twice.getStackBlockIds({ x: 0, y: 2 }), [
            'angle1',
            'water1',
            'water-new-1',
            'water-new-2',
        ]);
        assert.equal(water.getCellTopHeight({ x: 0, y: 2 }), 1);
        assert.equal(once.getCellTopHeight({ x: 0, y: 2 }), 2);
        assert.equal(twice.getCellTopHeight({ x: 0, y: 2 }), 3);
        expectBaseHeight(twice.validate({ x: 0, y: 2 }), 3);
        // Earlier layers keep their own view.
        expectBaseHeight(once.validate({ x: 0, y: 2 }), 2);
    });

    it('marks every footprint cell of a multi-cell block at its rotation', () => {
        const bed = createTestValidator('Raised_Bed');
        const placed = bed.withPlacedBlock({
            position: { x: 6, y: 0 },
            blockId: 'bed-new',
            rotation: 1,
        });

        assert.equal(placed.getCellTopHeight({ x: 7, y: 0 }), 0.5);
        assert.equal(placed.getCellTopHeight({ x: 6, y: 1 }), 0);
        assert.equal(placed.isCellEmpty({ x: 7, y: 0 }), false);
        assert.deepStrictEqual(placed.getStackBlockIds({ x: 7, y: 0 }), []);
        assert.equal(placed.validate({ x: 7, y: 0 }).valid, false);
        assert.equal(placed.validate({ x: 6, y: 1 }).valid, true);
        assert.equal(bed.validate({ x: 7, y: 0 }).valid, true);
    });
});

test('represents a raised bed as one two-cell block footprint', () => {
    assert.deepStrictEqual(
        getGardenBlockFootprintOffsets({
            attributes: { spanWidth: 1, spanDepth: 2 },
        }),
        [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
        ],
    );
});

test('recognizes standard and swamp water as water terrain', () => {
    assert.equal(isWaterBlockName('Block_Water'), true);
    assert.equal(isWaterBlockName('Block_Swamp_Water'), true);
    assert.equal(isWaterBlockName('Block_Swamp_Ground'), false);
});

test('lets both water styles stack on water without catalog fallbacks', () => {
    const stackableWater = { attributes: { stackable: true } };

    for (const belowBlockName of ['Block_Water', 'Block_Swamp_Water']) {
        for (const aboveBlockName of ['Block_Water', 'Block_Swamp_Water']) {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: undefined,
                    aboveBlockName,
                    belowBlockData: stackableWater,
                    belowBlockName,
                }),
                true,
            );
        }
    }
});

test('treats swamp water as placeable on water by default', () => {
    assert.equal(
        isBlockPlaceableOnWater({
            blockData: undefined,
            blockName: 'Block_Swamp_Water',
        }),
        true,
    );
});

test('collapses water above shaped terrain to the shared surface height', () => {
    const blockNameById = new Map([
        ['angle', 'Block_Grass_Angle'],
        ['water-shaped', 'Block_Water'],
        ['water-flat', 'Block_Water'],
    ]);
    const blockDataByName = new Map([
        ['Block_Grass_Angle', { attributes: { height: 1 } }],
        ['Block_Water', { attributes: { height: 1 } }],
    ]);

    assert.equal(
        getGardenStackHeightByBlockIds(
            ['angle', 'water-shaped'],
            blockNameById,
            blockDataByName,
        ),
        getGardenStackHeightByBlockIds(
            ['water-flat'],
            blockNameById,
            blockDataByName,
        ),
    );
    assert.equal(
        getEffectiveGardenStackBlockHeight({
            blockHeight: 1,
            blockName: 'Block_Water',
            supportBlockName: 'Block_Grass_Angle',
        }),
        0,
    );
});

test('does not treat terrain stair corners as water-fill supports', () => {
    assert.equal(isEdgeOrCornerTerrainBlockName('Block_Grass_Corner'), true);
    assert.equal(
        isEdgeOrCornerTerrainBlockName('Block_Stone_Stairs_Corner'),
        false,
    );
    assert.equal(
        getEffectiveGardenStackBlockHeight({
            blockHeight: 1,
            blockName: 'Block_Water',
            supportBlockName: 'Block_Stone_Stairs_Corner',
        }),
        1,
    );
});

describe('canStackBlockOnBlock', () => {
    for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
        it(`allows HazelLightArch on ${walkwayName}`, () => {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: nonStackable,
                    aboveBlockName: 'HazelLightArch',
                    belowBlockData: nonStackable,
                    belowBlockName: walkwayName,
                }),
                true,
            );
        });
    }

    for (const surfaceName of [
        'MulchCoconut',
        'MulchHey',
        'MulchWood',
        'StoneWalkway',
        'WoodenWalkway',
    ]) {
        it(`allows other decorations on ${surfaceName} surface cover`, () => {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: nonStackable,
                    aboveBlockName: 'EnamelGardenLamp',
                    belowBlockData: nonStackable,
                    belowBlockName: surfaceName,
                }),
                true,
            );
        });
    }

    it('keeps other decorations blocked on unrelated non-stackable blocks', () => {
        assert.equal(
            canStackBlockOnBlock({
                aboveBlockData: nonStackable,
                aboveBlockName: 'EnamelGardenLamp',
                belowBlockData: nonStackable,
                belowBlockName: 'WaterWell',
            }),
            false,
        );
    });

    it('keeps HazelLightArch blocked on unrelated non-stackable blocks', () => {
        assert.equal(
            canStackBlockOnBlock({
                aboveBlockData: nonStackable,
                aboveBlockName: 'HazelLightArch',
                belowBlockData: nonStackable,
                belowBlockName: 'WaterWell',
            }),
            false,
        );
    });

    for (const swampGroundName of [
        'Block_Swamp_Ground',
        'Block_Swamp_Ground_Angle',
    ]) {
        it(`keeps ordinary decorations stackable on ${swampGroundName}`, () => {
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockData: nonStackable,
                    aboveBlockName: 'EnamelGardenLamp',
                    belowBlockData: { attributes: { stackable: true } },
                    belowBlockName: swampGroundName,
                }),
                true,
            );
        });
    }
});
