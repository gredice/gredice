import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createGardenBlockPlacementValidator,
    type GardenBlockDataLike,
    type GardenBlockGridPosition,
    type GardenBlockPlacementValidator,
    type GardenBlockStack,
} from '../gardenBlocks';
import {
    clampGardenBlockExpansionCorner,
    type GardenBlockBatchPlacementInput,
    gardenAnimalBlockNames,
    gardenBlockExpansionClientMaxSide,
    gardenBlockExpansionLimits,
    getGardenBlockExpansionBounds,
    getGardenBlockExpansionClientMaxSide,
    getGardenBlockExpansionEligibility,
    getGardenBlockExpansionSource,
    isGardenAnimalBlockName,
    planGardenBlockExpansion,
    validateGardenBlockBatchPlacements,
} from './index';

const blockDataByName = new Map<string, GardenBlockDataLike>([
    ['Block_Grass', { attributes: { height: 1, stackable: true } }],
    // Shaped terrain: water on it collapses to its surface.
    ['Block_Grass_Angle', { attributes: { height: 1, stackable: true } }],
    ['Block_Water', { attributes: { height: 1, stackable: true } }],
    ['Tulip', { attributes: { height: 0.4, stackable: false } }],
    ['StoneSmall', { attributes: { height: 0.2, stackable: true } }],
    ['Crate', { attributes: { height: 1, stackable: false } }],
    // A flat cover with no height.
    ['LeafLitter', { attributes: { height: 0, stackable: true } }],
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
        'Bench',
        {
            attributes: {
                height: 0.6,
                stackable: false,
                spanWidth: 2,
                spanDepth: 1,
            },
        },
    ],
]);

type GardenBlock = { id: string; name: string; rotation?: number };

function createGarden(cells: [x: number, y: number, blocks: GardenBlock[]][]) {
    const stacks: GardenBlockStack[] = [];
    const blockNameById = new Map<string, string>();
    const blockRotationById = new Map<string, number | null | undefined>();
    for (const [x, y, blocks] of cells) {
        stacks.push({
            positionX: x,
            positionY: y,
            blocks: blocks.map((block) => block.id),
        });
        for (const block of blocks) {
            blockNameById.set(block.id, block.name);
            blockRotationById.set(block.id, block.rotation);
        }
    }

    return { stacks, blockNameById, blockRotationById };
}

function createValidator(
    blockName: string,
    cells: [x: number, y: number, blocks: GardenBlock[]][],
) {
    return createGardenBlockPlacementValidator({
        blockName,
        ...createGarden(cells),
        blockDataByName,
    });
}

const grass = (id: string): GardenBlock => ({ id, name: 'Block_Grass' });
const shore = (id: string): GardenBlock => ({
    id,
    name: 'Block_Grass_Angle',
});
const water = (id: string): GardenBlock => ({ id, name: 'Block_Water' });
const leafLitter = (id: string): GardenBlock => ({ id, name: 'LeafLitter' });

/** Places every planned copy and returns each copy's top surface. */
function copyTopHeights(
    validator: GardenBlockPlacementValidator,
    plan: ReturnType<typeof planGardenBlockExpansion>,
) {
    let placed = validator;
    for (const [index, { position }] of plan.placements.entries()) {
        placed = placed.withPlacedBlock({
            position,
            blockId: `copy-${index.toString()}`,
            rotation: plan.rotation,
        });
    }

    return plan.placements.map(({ position }) =>
        placed.getCellTopHeight(position),
    );
}

type ValidatorCalls = {
    validate: { position: GardenBlockGridPosition; rotation: unknown }[];
    withPlacedBlock: {
        position: GardenBlockGridPosition;
        blockId: string;
        rotation: unknown;
    }[];
};

/** Records the arguments every check receives. */
function spyValidator(validator: GardenBlockPlacementValidator) {
    const calls: ValidatorCalls = { validate: [], withPlacedBlock: [] };
    const wrap = (
        inner: GardenBlockPlacementValidator,
    ): GardenBlockPlacementValidator => ({
        blockName: inner.blockName,
        validate: (position, rotation) => {
            calls.validate.push({ position, rotation });
            return inner.validate(position, rotation);
        },
        getCellTopHeight: (position) => inner.getCellTopHeight(position),
        isCellEmpty: (position) => inner.isCellEmpty(position),
        getStackBlockIds: (position) => inner.getStackBlockIds(position),
        getStackBlockLevels: (position) => inner.getStackBlockLevels(position),
        getCellTopBlock: (position) => inner.getCellTopBlock(position),
        withPlacedBlock: (input) => {
            calls.withPlacedBlock.push({
                position: input.position,
                blockId: input.blockId,
                rotation: input.rotation,
            });
            return wrap(inner.withPlacedBlock(input));
        },
    });

    return { validator: wrap(validator), calls };
}

function statusAt(
    plan: ReturnType<typeof planGardenBlockExpansion>,
    x: number,
    y: number,
) {
    return plan.cells.find((cell) => cell.x === x && cell.y === y)?.status;
}

describe('gardenBlockExpansionLimits', () => {
    it('caps the server batch at 100 placements in a 10 × 10 box', () => {
        assert.deepStrictEqual(gardenBlockExpansionLimits, {
            maxSide: 10,
            maxPlacements: 100,
        });
    });

    it('clamps instanced blocks to 10 per side and others to 5', () => {
        assert.equal(
            getGardenBlockExpansionClientMaxSide({ instanced: true }),
            10,
        );
        assert.equal(
            getGardenBlockExpansionClientMaxSide({ instanced: false }),
            5,
        );
        for (const maxSide of Object.values(
            gardenBlockExpansionClientMaxSide,
        )) {
            assert.ok(maxSide <= gardenBlockExpansionLimits.maxSide);
            assert.ok(
                maxSide * maxSide <= gardenBlockExpansionLimits.maxPlacements,
            );
        }
    });
});

describe('getGardenBlockExpansionEligibility', () => {
    const oneCell: GardenBlockDataLike = { attributes: { height: 0.4 } };

    it('allows one-cell decorations and terrain', () => {
        for (const blockName of [
            'Tulip',
            'Block_Grass',
            'Block_Water',
            'BeachBall',
        ]) {
            assert.deepStrictEqual(
                getGardenBlockExpansionEligibility({
                    blockName,
                    blockData: oneCell,
                    rotation: 0,
                }),
                { eligible: true },
            );
        }
        assert.deepStrictEqual(
            getGardenBlockExpansionEligibility({
                blockName: 'Tulip',
                blockData: {
                    attributes: { spanWidth: 1, spanDepth: 1 },
                },
                rotation: 7,
            }),
            { eligible: true },
        );
        assert.deepStrictEqual(
            getGardenBlockExpansionEligibility({
                blockName: 'Tulip',
                blockData: { attributes: null },
            }),
            { eligible: true },
        );
    });

    it('rejects multi-cell footprints at any rotation', () => {
        for (const blockData of [
            { attributes: { spanWidth: 1, spanDepth: 2 } },
            { attributes: { spanWidth: 2, spanDepth: 1 } },
            { attributes: { spanWidth: 2, spanDepth: 2 } },
            { attributes: { spanWidth: 3, spanDepth: 2 } },
            { attributes: { spanWidth: 1.2, spanDepth: 1 } },
        ]) {
            for (const rotation of [0, 1, 2, 3, 5, -1, null, undefined]) {
                assert.deepStrictEqual(
                    getGardenBlockExpansionEligibility({
                        blockName: 'FishingBoat',
                        blockData,
                        rotation,
                    }),
                    { eligible: false, reason: 'multi-cell' },
                );
            }
        }
    });

    it('rejects raised beds, garden boxes and gift boxes', () => {
        const cases: [string, string][] = [
            ['Raised_Bed', 'raised-bed'],
            ['GardenBox', 'garden-box'],
            ['GiftBox', 'gift-box'],
            ['GiftBox_RedWhite', 'gift-box'],
            ['GiftBox_GoldRed', 'gift-box'],
            ['GiftBox_Unregistered', 'gift-box'],
            ['WoodenSign', 'per-block-content'],
        ];
        for (const [blockName, reason] of cases) {
            assert.deepStrictEqual(
                getGardenBlockExpansionEligibility({
                    blockName,
                    blockData: oneCell,
                    rotation: 0,
                }),
                { eligible: false, reason },
                blockName,
            );
        }
    });

    it('rejects every animal and animal home', () => {
        for (const blockName of [
            ...gardenAnimalBlockNames,
            'ChickenCoop',
            'PigletPen',
            'DogHouse',
            'CatPillow',
            'Cat_Pillow',
            'Ladybug',
            'RabbitHutch',
            'GoatShelter',
            'BirdHouse',
            'HedgehogShelter',
        ]) {
            assert.equal(isGardenAnimalBlockName(blockName), true, blockName);
            assert.deepStrictEqual(
                getGardenBlockExpansionEligibility({
                    blockName,
                    blockData: oneCell,
                    rotation: 0,
                }),
                { eligible: false, reason: 'animal' },
                blockName,
            );
        }
    });

    it('rejects appearance-variant entities and reports animal before multi-cell', () => {
        for (const blockName of [
            'HorseStable',
            'CowShelter',
            'RabbitHutch',
            'Cow',
            'Horse',
            'Rabbit',
        ]) {
            assert.equal(isGardenAnimalBlockName(blockName), true, blockName);
            assert.deepStrictEqual(
                getGardenBlockExpansionEligibility({
                    blockName,
                    blockData: { attributes: { spanWidth: 2, spanDepth: 2 } },
                    rotation: 1,
                }),
                { eligible: false, reason: 'animal' },
                blockName,
            );
        }
    });

    it('keeps the animal set to animals', () => {
        assert.equal(isGardenAnimalBlockName('Tulip'), false);
        assert.equal(isGardenAnimalBlockName('Block_Grass'), false);
        assert.equal(isGardenAnimalBlockName('Bush'), false);
    });

    it('rejects blocks with no block data', () => {
        for (const blockData of [null, undefined]) {
            assert.deepStrictEqual(
                getGardenBlockExpansionEligibility({
                    blockName: 'Tulip',
                    blockData,
                    rotation: 0,
                }),
                { eligible: false, reason: 'unknown-block' },
            );
        }
    });
});

describe('clampGardenBlockExpansionCorner', () => {
    const source = { x: 3, y: -2 };

    for (const maxSide of [10, 5]) {
        const reach = maxSide - 1;
        it(`keeps the corner within ${maxSide} cells in all four quadrants`, () => {
            for (const [dx, dy] of [
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
            ] as const) {
                assert.deepStrictEqual(
                    clampGardenBlockExpansionCorner(
                        source,
                        {
                            x: source.x + dx * (reach + 7),
                            y: source.y + dy * (reach + 3),
                        },
                        maxSide,
                    ),
                    { x: source.x + dx * reach, y: source.y + dy * reach },
                );
                // At the edge and inside: unchanged.
                const atEdge = {
                    x: source.x + dx * reach,
                    y: source.y + dy * (reach - 1),
                };
                assert.deepStrictEqual(
                    clampGardenBlockExpansionCorner(source, atEdge, maxSide),
                    atEdge,
                );
                const bounds = getGardenBlockExpansionBounds(
                    source,
                    clampGardenBlockExpansionCorner(
                        source,
                        { x: source.x + dx * 100, y: source.y + dy * 100 },
                        maxSide,
                    ),
                );
                assert.equal(bounds.width, maxSide);
                assert.equal(bounds.depth, maxSide);
            }
        });
    }

    it('handles degenerate input', () => {
        assert.deepStrictEqual(
            clampGardenBlockExpansionCorner(source, source, 10),
            source,
        );
        assert.deepStrictEqual(
            clampGardenBlockExpansionCorner(source, { x: 9, y: 9 }, 1),
            source,
        );
        assert.deepStrictEqual(
            clampGardenBlockExpansionCorner(source, { x: 9, y: 9 }, 0),
            source,
        );
        assert.deepStrictEqual(
            clampGardenBlockExpansionCorner(
                source,
                { x: Number.NaN, y: 4.6 },
                10,
            ),
            { x: source.x, y: 5 },
        );
        assert.deepStrictEqual(
            clampGardenBlockExpansionCorner(source, { x: 9, y: 9 }, Number.NaN),
            source,
        );
    });
});

describe('getGardenBlockExpansionBounds', () => {
    it('spans both cells in any direction', () => {
        assert.deepStrictEqual(
            getGardenBlockExpansionBounds({ x: 2, y: 5 }, { x: -1, y: 3 }),
            { minX: -1, maxX: 2, minY: 3, maxY: 5, width: 4, depth: 3 },
        );
        assert.deepStrictEqual(
            getGardenBlockExpansionBounds({ x: 0, y: 0 }, { x: 0, y: 0 }),
            { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, depth: 1 },
        );
    });
});

describe('planGardenBlockExpansion', () => {
    it('fills empty cells with terrain and skips everything else', () => {
        const validator = createValidator('Block_Grass', [
            [0, 0, [grass('source')]],
            [1, 0, [grass('g1')]],
            [1, 1, [{ id: 'leaf1', name: 'LeafLitter' }]],
            [2, 1, [grass('optimistic-1')]],
        ]);

        const plan = planGardenBlockExpansion({
            blockName: 'Block_Grass',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 2, y: 1 },
            validator,
            isPendingBlockId: (blockId) => blockId.startsWith('optimistic-'),
        });

        assert.deepStrictEqual(plan.bounds, {
            minX: 0,
            maxX: 2,
            minY: 0,
            maxY: 1,
            width: 3,
            depth: 2,
        });
        assert.deepStrictEqual(plan.cells, [
            { x: 0, y: 0, status: 'source' },
            { x: 1, y: 0, status: 'occupied' },
            { x: 2, y: 0, status: 'place' },
            { x: 0, y: 1, status: 'place' },
            // Same height, but a block underneath: another kind of support.
            { x: 1, y: 1, status: 'other-level' },
            { x: 2, y: 1, status: 'pending' },
        ]);
        assert.deepStrictEqual(plan.placements, [
            { position: { x: 0, y: 1 }, expectedExistingBlocks: [] },
            { position: { x: 2, y: 0 }, expectedExistingBlocks: [] },
        ]);
        assert.equal(plan.skippedCount, 3);
        assert.equal(plan.rotation, 0);
    });

    it('fills a flower on grass only into grass at the same height', () => {
        const validator = createValidator('Tulip', [
            [0, 0, [grass('g0'), { id: 'source', name: 'Tulip' }]],
            [1, 0, [grass('g1')]],
            // A bed standing on grass at (2,-1) also covers (2,0).
            [2, -1, [grass('g5'), { id: 'bed1', name: 'Raised_Bed' }]],
            [0, 1, [grass('g2'), { id: 'stone1', name: 'StoneSmall' }]],
            [2, 1, [{ id: 'water1', name: 'Block_Water' }]],
            [0, 2, [grass('g3')]],
            [1, 2, [grass('g4'), { id: 'optimistic-2', name: 'StoneSmall' }]],
            [2, 2, [{ id: 'crate1', name: 'Crate' }]],
        ]);

        const plan = planGardenBlockExpansion({
            blockName: 'Tulip',
            rotation: 2,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 2, y: 2 },
            validator,
            isPendingBlockId: (blockId) => blockId.startsWith('optimistic-'),
        });

        assert.equal(statusAt(plan, 0, 0), 'source');
        assert.equal(statusAt(plan, 1, 0), 'place');
        // Anchored on a neighbouring cell, above the source's base.
        assert.equal(statusAt(plan, 2, 0), 'occupied');
        assert.equal(statusAt(plan, 0, 1), 'occupied');
        // Bare ground is lower than the grass the source stands on.
        assert.equal(statusAt(plan, 1, 1), 'other-level');
        // Same level, but a tulip cannot stand on water or on a crate.
        assert.equal(statusAt(plan, 2, 1), 'invalid');
        assert.equal(statusAt(plan, 2, 2), 'invalid');
        assert.equal(statusAt(plan, 0, 2), 'place');
        assert.equal(statusAt(plan, 1, 2), 'pending');
        assert.deepStrictEqual(plan.placements, [
            { position: { x: 1, y: 0 }, expectedExistingBlocks: ['g1'] },
            { position: { x: 0, y: 2 }, expectedExistingBlocks: ['g3'] },
        ]);
        assert.equal(plan.skippedCount, 6);
    });

    it('treats a block on a flat block and an empty cell as different levels', () => {
        const validator = createValidator('Tulip', [
            [
                0,
                0,
                [
                    { id: 'leaf0', name: 'LeafLitter' },
                    { id: 'source', name: 'Tulip' },
                ],
            ],
            [2, 0, [{ id: 'leaf2', name: 'LeafLitter' }]],
        ]);

        const plan = planGardenBlockExpansion({
            blockName: 'Tulip',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 2, y: 0 },
            validator,
        });

        assert.deepStrictEqual(
            plan.cells.map((cell) => cell.status),
            ['source', 'other-level', 'place'],
        );
        assert.deepStrictEqual(plan.placements, [
            { position: { x: 2, y: 0 }, expectedExistingBlocks: ['leaf2'] },
        ]);
    });

    it('copies collapsed shore water only onto bare shore pieces', () => {
        const validator = createValidator('Block_Water', [
            [0, 0, [shore('a0'), water('source')]],
            // The same collapsed water is already here.
            [1, 0, [shore('a1'), water('w1')]],
            [2, 0, [shore('a2')]],
            // Flat ground at the same height: a copy would not collapse.
            [3, 0, [grass('g3')]],
        ]);

        const plan = planGardenBlockExpansion({
            blockName: 'Block_Water',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 3, y: 0 },
            validator,
        });

        assert.deepStrictEqual(plan.source, {
            baseHeight: 1,
            topHeight: 1,
            support: {
                blockId: 'a0',
                blockName: 'Block_Grass_Angle',
                baseHeight: 0,
                topHeight: 1,
            },
        });
        assert.deepStrictEqual(
            plan.cells.map((cell) => cell.status),
            ['source', 'occupied', 'place', 'other-level'],
        );
        assert.deepStrictEqual(plan.placements, [
            { position: { x: 2, y: 0 }, expectedExistingBlocks: ['a2'] },
        ]);
        assert.deepStrictEqual(copyTopHeights(validator, plan), [1]);
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Water',
                rotation: plan.rotation,
                placements: plan.placements,
                validator,
            }),
            { ok: true },
        );
    });

    it('does not copy raised water onto shore pieces', () => {
        const validator = createValidator('Block_Water', [
            [0, 0, [grass('g0'), water('source')]],
            [1, 0, [shore('a1')]],
            [2, 0, [grass('g2')]],
        ]);

        const plan = planGardenBlockExpansion({
            blockName: 'Block_Water',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 2, y: 0 },
            validator,
        });

        assert.equal(plan.source?.topHeight, 2);
        assert.deepStrictEqual(
            plan.cells.map((cell) => cell.status),
            ['source', 'other-level', 'place'],
        );
        assert.deepStrictEqual(copyTopHeights(validator, plan), [2]);
    });

    it('compares the support level for blocks with no height', () => {
        const litter = createValidator('LeafLitter', [
            [0, 0, [grass('g0'), leafLitter('source')]],
            // Litter already lies here.
            [1, 0, [grass('g1'), leafLitter('leaf1')]],
            [2, 0, [grass('g2')]],
        ]);
        assert.deepStrictEqual(
            planGardenBlockExpansion({
                blockName: 'LeafLitter',
                rotation: 0,
                source: { x: 0, y: 0 },
                sourceBlockId: 'source',
                corner: { x: 2, y: 0 },
                validator: litter,
            }).cells.map((cell) => cell.status),
            ['source', 'occupied', 'place'],
        );

        // A tulip on litter fills litter-covered cells, not bare grass.
        const tulip = createValidator('Tulip', [
            [
                0,
                0,
                [
                    grass('g0'),
                    leafLitter('leaf0'),
                    { id: 'source', name: 'Tulip' },
                ],
            ],
            [1, 0, [grass('g1')]],
            [2, 0, [grass('g2'), leafLitter('leaf2')]],
        ]);
        const plan = planGardenBlockExpansion({
            blockName: 'Tulip',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 2, y: 0 },
            validator: tulip,
        });
        assert.deepStrictEqual(
            plan.cells.map((cell) => cell.status),
            ['source', 'other-level', 'place'],
        );
        assert.deepStrictEqual(plan.placements, [
            {
                position: { x: 2, y: 0 },
                expectedExistingBlocks: ['g2', 'leaf2'],
            },
        ]);
        assert.deepStrictEqual(copyTopHeights(tulip, plan), [1.4]);
    });

    it('reads the source from the snapshot and plans nothing without it', () => {
        const cells: [number, number, GardenBlock[]][] = [
            [0, 0, [grass('g0'), { id: 'source', name: 'Tulip' }]],
            [1, 0, [grass('g1'), { id: 'tulip1', name: 'Tulip' }]],
            [2, 0, [grass('g2')]],
        ];
        const validator = createValidator('Tulip', cells);

        assert.deepStrictEqual(
            getGardenBlockExpansionSource({
                validator,
                position: { x: 0, y: 0 },
                blockId: 'source',
            }),
            {
                baseHeight: 1,
                topHeight: 1.4,
                support: {
                    blockId: 'g0',
                    blockName: 'Block_Grass',
                    baseHeight: 0,
                    topHeight: 1,
                },
            },
        );
        assert.deepStrictEqual(
            getGardenBlockExpansionSource({
                validator: createValidator('Block_Grass', cells),
                position: { x: 0, y: 0 },
                blockId: 'g0',
            }),
            { baseHeight: 0, topHeight: 1, support: null },
        );
        for (const [position, blockId] of [
            [{ x: 0, y: 0 }, 'missing'],
            // Another cell's block.
            [{ x: 0, y: 0 }, 'tulip1'],
            // Not a block of the validator's type.
            [{ x: 0, y: 0 }, 'g0'],
        ] as const) {
            assert.equal(
                getGardenBlockExpansionSource({
                    validator,
                    position,
                    blockId,
                }),
                null,
            );
        }

        for (const [blockName, sourceBlockId] of [
            ['Tulip', 'missing'],
            // The validator is for another block type.
            ['Block_Grass', 'g0'],
        ] as const) {
            const plan = planGardenBlockExpansion({
                blockName,
                rotation: 0,
                source: { x: 0, y: 0 },
                sourceBlockId,
                corner: { x: 2, y: 0 },
                validator,
            });
            assert.equal(plan.source, null);
            assert.deepStrictEqual(
                plan.cells.map((cell) => cell.status),
                ['source', 'invalid', 'invalid'],
            );
            assert.deepStrictEqual(plan.placements, []);
            assert.equal(plan.skippedCount, 2);
        }
    });

    it('reports pending before any other rule and only with a pending check', () => {
        const cells: [number, number, GardenBlock[]][] = [
            [0, 0, [grass('source')]],
            [1, 0, [grass('optimistic-9')]],
        ];
        const input = {
            blockName: 'Block_Grass',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 1, y: 0 },
        };

        assert.equal(
            statusAt(
                planGardenBlockExpansion({
                    ...input,
                    validator: createValidator('Block_Grass', cells),
                    isPendingBlockId: (blockId) =>
                        blockId.startsWith('optimistic-'),
                }),
                1,
                0,
            ),
            'pending',
        );
        assert.equal(
            statusAt(
                planGardenBlockExpansion({
                    ...input,
                    validator: createValidator('Block_Grass', cells),
                }),
                1,
                0,
            ),
            'occupied',
        );
    });

    it('orders placements by distance from the source, then y, then x', () => {
        const plan = planGardenBlockExpansion({
            blockName: 'Block_Grass',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 2, y: -2 },
            validator: createValidator('Block_Grass', [
                [0, 0, [grass('source')]],
            ]),
        });

        assert.deepStrictEqual(
            plan.placements.map(({ position }) => [position.x, position.y]),
            [
                [0, -1],
                [1, -1],
                [1, 0],
                [0, -2],
                [1, -2],
                [2, -2],
                [2, -1],
                [2, 0],
            ],
        );
        // Cells are listed by row.
        assert.deepStrictEqual(
            plan.cells.map((cell) => [cell.x, cell.y]),
            [
                [0, -2],
                [1, -2],
                [2, -2],
                [0, -1],
                [1, -1],
                [2, -1],
                [0, 0],
                [1, 0],
                [2, 0],
            ],
        );
        assert.equal(plan.skippedCount, 0);
    });

    it('returns only the source when the corner is the source', () => {
        const plan = planGardenBlockExpansion({
            blockName: 'Block_Grass',
            rotation: 0,
            source: { x: 4, y: 4 },
            sourceBlockId: 'source',
            corner: { x: 4, y: 4 },
            validator: createValidator('Block_Grass', [
                [4, 4, [grass('source')]],
            ]),
        });

        assert.deepStrictEqual(plan.cells, [{ x: 4, y: 4, status: 'source' }]);
        assert.deepStrictEqual(plan.placements, []);
        assert.equal(plan.skippedCount, 0);
    });

    it('plans rotations 5, -1 and null like 1, 3 and 0', () => {
        const cells: [number, number, GardenBlock[]][] = [
            [0, 0, [grass('g0'), { id: 'source', name: 'Tulip' }]],
            [1, 0, [grass('g1')]],
            [1, 1, [grass('g2'), { id: 'crate1', name: 'Crate' }]],
        ];
        const plan = (rotation: number | null) => {
            const spy = spyValidator(createValidator('Tulip', cells));
            const result = planGardenBlockExpansion({
                blockName: 'Tulip',
                rotation,
                source: { x: 0, y: 0 },
                sourceBlockId: 'source',
                corner: { x: 1, y: 1 },
                validator: spy.validator,
            });

            return {
                result,
                rotations: [
                    ...spy.calls.validate,
                    ...spy.calls.withPlacedBlock,
                ].map((call) => call.rotation),
            };
        };

        for (const [raw, normalized] of [
            [5, 1],
            [-1, 3],
            [null, 0],
        ] as const) {
            const actual = plan(raw);
            const expected = plan(normalized);
            assert.deepStrictEqual(actual, expected);
            assert.equal(actual.result.rotation, normalized);
            assert.ok(actual.rotations.length > 0);
            assert.ok(
                actual.rotations.every((rotation) => rotation === normalized),
            );
        }
    });

    it('clamps the corner to maxSide and to the server limit', () => {
        const validator = createValidator('Block_Grass', [
            [0, 0, [grass('source')]],
        ]);
        const input = {
            blockName: 'Block_Grass',
            rotation: 0,
            source: { x: 0, y: 0 },
            sourceBlockId: 'source',
            corner: { x: 40, y: -40 },
            validator,
        };

        const small = planGardenBlockExpansion({ ...input, maxSide: 5 });
        assert.equal(small.bounds.width, 5);
        assert.equal(small.bounds.depth, 5);
        assert.equal(small.placements.length, 24);

        const large = planGardenBlockExpansion({ ...input, maxSide: 50 });
        assert.equal(large.bounds.width, gardenBlockExpansionLimits.maxSide);
        assert.equal(large.bounds.depth, gardenBlockExpansionLimits.maxSide);
        assert.equal(large.placements.length, 99);
        assert.ok(
            large.placements.length <= gardenBlockExpansionLimits.maxPlacements,
        );

        // The full plan passes the server check.
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: large.rotation,
                placements: large.placements,
                validator,
            }),
            { ok: true },
        );
    });
});

describe('validateGardenBlockBatchPlacements', () => {
    const tulipGarden: [number, number, GardenBlock[]][] = [
        [0, 0, [grass('g0'), { id: 'source', name: 'Tulip' }]],
        [1, 0, [grass('g1')]],
        [0, 1, [grass('g2'), { id: 'stone1', name: 'StoneSmall' }]],
        [2, 1, [{ id: 'water1', name: 'Block_Water' }]],
        [0, 2, [grass('g3')]],
    ];

    it('accepts placements whose stacks match the snapshot', () => {
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Tulip',
                rotation: 0,
                placements: [
                    {
                        position: { x: 1, y: 0 },
                        expectedExistingBlocks: ['g1'],
                    },
                    {
                        position: { x: 0, y: 2 },
                        expectedExistingBlocks: ['g3'],
                    },
                    // Stone holds a tulip.
                    {
                        position: { x: 0, y: 1 },
                        expectedExistingBlocks: ['g2', 'stone1'],
                    },
                    { position: { x: 3, y: 3 }, expectedExistingBlocks: [] },
                ],
                validator: createValidator('Tulip', tulipGarden),
            }),
            { ok: true },
        );
    });

    it('reports duplicates, changed stacks and invalid cells by index', () => {
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Tulip',
                rotation: 0,
                placements: [
                    {
                        position: { x: 1, y: 0 },
                        expectedExistingBlocks: ['g1'],
                    },
                    {
                        position: { x: 1, y: 0 },
                        expectedExistingBlocks: ['g1'],
                    },
                    // Stack grew.
                    { position: { x: 0, y: 2 }, expectedExistingBlocks: [] },
                    // Same ids, different order.
                    {
                        position: { x: 0, y: 1 },
                        expectedExistingBlocks: ['stone1', 'g2'],
                    },
                    // Expected a block where there is none.
                    {
                        position: { x: 4, y: 4 },
                        expectedExistingBlocks: ['g9'],
                    },
                    // A tulip cannot stand on water.
                    {
                        position: { x: 2, y: 1 },
                        expectedExistingBlocks: ['water1'],
                    },
                    // A tulip cannot stand on the source tulip.
                    {
                        position: { x: 0, y: 0 },
                        expectedExistingBlocks: ['g0', 'source'],
                    },
                    { position: { x: 3, y: 3 }, expectedExistingBlocks: [] },
                ],
                validator: createValidator('Tulip', tulipGarden),
            }),
            {
                ok: false,
                conflicts: [
                    { index: 1, reason: 'duplicate' },
                    { index: 2, reason: 'stack-changed' },
                    { index: 3, reason: 'stack-changed' },
                    { index: 4, reason: 'stack-changed' },
                    { index: 5, reason: 'invalid-placement' },
                    { index: 6, reason: 'invalid-placement' },
                ],
            },
        );
    });

    it('flags a repeat of a rejected position as duplicate', () => {
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Tulip',
                rotation: 0,
                placements: [
                    { position: { x: 1, y: 0 }, expectedExistingBlocks: [] },
                    {
                        position: { x: 1, y: 0 },
                        expectedExistingBlocks: ['g1'],
                    },
                ],
                validator: createValidator('Tulip', tulipGarden),
            }),
            {
                ok: false,
                conflicts: [
                    { index: 0, reason: 'stack-changed' },
                    { index: 1, reason: 'duplicate' },
                ],
            },
        );
    });

    it('adds a placeholder after each accepted placement', () => {
        const spy = spyValidator(createValidator('Tulip', tulipGarden));
        const result = validateGardenBlockBatchPlacements({
            blockName: 'Tulip',
            rotation: 6,
            placements: [
                { position: { x: 1, y: 0 }, expectedExistingBlocks: ['g1'] },
                {
                    position: { x: 2, y: 1 },
                    expectedExistingBlocks: ['water1'],
                },
                { position: { x: 0, y: 2 }, expectedExistingBlocks: ['g3'] },
            ],
            validator: spy.validator,
        });

        assert.deepStrictEqual(result, {
            ok: false,
            conflicts: [{ index: 1, reason: 'invalid-placement' }],
        });
        assert.deepStrictEqual(
            spy.calls.validate.map((call) => call.rotation),
            [2, 2, 2],
        );
        assert.deepStrictEqual(
            spy.calls.withPlacedBlock.map((call) => [
                call.position,
                call.rotation,
            ]),
            [
                [{ x: 1, y: 0 }, 2],
                [{ x: 0, y: 2 }, 2],
            ],
        );
        const placeholderIds = spy.calls.withPlacedBlock.map(
            (call) => call.blockId,
        );
        assert.equal(new Set(placeholderIds).size, placeholderIds.length);
        assert.ok(
            placeholderIds.every((blockId) => !['g1', 'g3'].includes(blockId)),
        );
    });

    it('rejects overlapping multi-cell footprints through the placeholders', () => {
        // A bench covers its cell and the next one along x.
        const validator = createValidator('Bench', []);
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Bench',
                rotation: 0,
                placements: [
                    { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
                    { position: { x: 1, y: 0 }, expectedExistingBlocks: [] },
                    { position: { x: 2, y: 0 }, expectedExistingBlocks: [] },
                ],
                validator,
            }),
            {
                ok: false,
                conflicts: [{ index: 1, reason: 'invalid-placement' }],
            },
        );
        // A quarter turn covers the next cell along y instead.
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Bench',
                rotation: 1,
                placements: [
                    { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
                    { position: { x: 1, y: 0 }, expectedExistingBlocks: [] },
                    { position: { x: 0, y: 1 }, expectedExistingBlocks: [] },
                ],
                validator,
            }),
            {
                ok: false,
                conflicts: [{ index: 2, reason: 'invalid-placement' }],
            },
        );
    });

    it('rejects a bounding box wider or deeper than maxSide', () => {
        const validator = createValidator('Block_Grass', []);
        const at = (x: number, y: number): GardenBlockBatchPlacementInput => ({
            position: { x, y },
            expectedExistingBlocks: [],
        });

        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [at(0, 0), at(10, 0)],
                validator,
            }),
            { ok: false, reason: 'area-too-large' },
        );
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [at(-5, 0), at(-5, 5), at(-5, -5)],
                validator,
            }),
            { ok: false, reason: 'area-too-large' },
        );
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [at(0, 0), at(9, -9)],
                validator,
            }),
            { ok: true },
        );
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [at(0, 0), at(4, 0)],
                validator,
                limits: { maxSide: 4, maxPlacements: 16 },
            }),
            { ok: false, reason: 'area-too-large' },
        );
    });

    it('rejects more than maxPlacements placements', () => {
        const validator = createValidator('Block_Grass', []);
        const square: GardenBlockBatchPlacementInput[] = [];
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                square.push({ position: { x, y }, expectedExistingBlocks: [] });
            }
        }

        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: square,
                validator,
            }),
            { ok: true },
        );
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                // 101 entries; the extra one is a duplicate inside the box.
                placements: [
                    ...square,
                    { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
                ],
                validator,
            }),
            { ok: false, reason: 'area-too-large' },
        );
    });

    it('reports malformed coordinates as invalid placements', () => {
        const validator = createValidator('Block_Grass', []);
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [
                    { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
                    { position: { x: 0.5, y: 0 }, expectedExistingBlocks: [] },
                    {
                        position: { x: Number.NaN, y: 0 },
                        expectedExistingBlocks: [],
                    },
                    {
                        position: { x: 1e300, y: 0 },
                        expectedExistingBlocks: [],
                    },
                ],
                validator,
            }),
            {
                ok: false,
                conflicts: [
                    { index: 1, reason: 'invalid-placement' },
                    { index: 2, reason: 'invalid-placement' },
                    { index: 3, reason: 'invalid-placement' },
                ],
            },
        );
    });

    it('accepts an empty list and refuses a validator for another block', () => {
        assert.deepStrictEqual(
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [],
                validator: createValidator('Block_Grass', []),
            }),
            { ok: true },
        );
        assert.throws(() =>
            validateGardenBlockBatchPlacements({
                blockName: 'Block_Grass',
                rotation: 0,
                placements: [
                    { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
                ],
                validator: createValidator('Tulip', []),
            }),
        );
    });
});
