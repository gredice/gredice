import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { GardenBlockDataLike } from '../gardenBlocks';
import {
    type GardenStructureDocumentV1,
    type GardenStructureFootprintCell,
    type GardenStructurePlacement,
    getGardenStructureWorldFootprintCells,
} from '../gardenStructures';
import {
    createGardenOccupancyIndex,
    type GardenOccupancyBlock,
    type GardenOccupancyBlockStack,
    type GardenOccupancyIndex,
    type GardenOccupancyPlacedStructure,
    getGardenOccupancyCell,
    validateGardenStructurePlacement,
    validateGardenStructuresAfterMutation,
} from './index';

const blockDataByName: ReadonlyMap<string, GardenBlockDataLike> = new Map([
    ['Block_Grass', { attributes: { height: 1, stackable: true } }],
    ['Block_Tall', { attributes: { height: 2, stackable: true } }],
    ['Block_Water', { attributes: { height: 1, stackable: true } }],
    ['Block_Swamp', { attributes: { height: 1, stackable: true } }],
    [
        'Raised_Bed',
        {
            attributes: {
                height: 1,
                spanDepth: 2,
                spanWidth: 1,
                stackable: false,
            },
        },
    ],
    [
        'Long_Block',
        {
            attributes: {
                height: 0.5,
                spanDepth: 1,
                spanWidth: 2,
                stackable: true,
            },
        },
    ],
]);

function block(
    id: string,
    name = 'Block_Grass',
    rotation = 0,
): GardenOccupancyBlock {
    return { id, name, rotation };
}

function stack(
    positionX: number,
    positionY: number,
    ...blocks: string[]
): GardenOccupancyBlockStack {
    return { positionX, positionY, blocks };
}

function footprintCell(
    x: number,
    y: number,
    spaceKind: GardenStructureFootprintCell['spaceKind'] = 'interior',
): GardenStructureFootprintCell {
    return { x, y, spaceKind };
}

function documentForCells(
    cells: readonly GardenStructureFootprintCell[],
): GardenStructureDocumentV1 {
    return {
        schemaVersion: 1,
        footprint: { cells },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

function structureFromDocument(
    id: string,
    cells: readonly GardenStructureFootprintCell[],
    placement: GardenStructurePlacement = {
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
    },
): Readonly<{
    id: string;
    document: GardenStructureDocumentV1;
    placement: GardenStructurePlacement;
}> {
    return { id, document: documentForCells(cells), placement };
}

function structureFromFootprint(
    id: string,
    worldFootprint: readonly { x: number; y: number }[],
): GardenOccupancyPlacedStructure {
    return { id, worldFootprint };
}

function createIndex({
    blocks,
    catalog = blockDataByName,
    excludedBlockIds,
    excludedStructureIds,
    stacks,
    structures = [],
}: {
    blocks: readonly GardenOccupancyBlock[];
    catalog?: ReadonlyMap<string, GardenBlockDataLike>;
    excludedBlockIds?: ReadonlySet<string>;
    excludedStructureIds?: ReadonlySet<string>;
    stacks: readonly GardenOccupancyBlockStack[];
    structures?: readonly GardenOccupancyPlacedStructure[];
}): GardenOccupancyIndex {
    const result = createGardenOccupancyIndex({
        blockDataByName: catalog,
        blocks,
        excludedBlockIds,
        excludedStructureIds,
        stacks,
        structures,
    });
    assert.equal(
        result.valid,
        true,
        result.valid ? undefined : JSON.stringify(result.issues),
    );
    if (!result.valid) {
        throw new Error('Expected a valid occupancy index.');
    }
    return result.index;
}

function issueCodes(
    result:
        | ReturnType<typeof createGardenOccupancyIndex>
        | ReturnType<typeof validateGardenStructurePlacement>
        | ReturnType<typeof validateGardenStructuresAfterMutation>,
) {
    return result.valid ? [] : result.issues.map((issue) => issue.code);
}

describe('createGardenOccupancyIndex', () => {
    test('indexes rotated block spans and resolved structure footprints together', () => {
        const placedStructure = structureFromDocument(
            'shed',
            [footprintCell(0, 0), footprintCell(1, 0)],
            { anchorX: 4, anchorY: -3, rotation: 1 },
        );
        const index = createIndex({
            blocks: [block('long', 'Long_Block', 1)],
            stacks: [stack(-2, 5, 'long')],
            structures: [placedStructure],
        });

        assert.equal(
            getGardenOccupancyCell(index, { x: -2, y: 5 })?.blocks[0]?.blockId,
            'long',
        );
        assert.equal(
            getGardenOccupancyCell(index, { x: -2, y: 6 })?.blocks[0]?.blockId,
            'long',
        );
        assert.deepEqual(
            index.structuresById.get('shed')?.worldFootprint,
            getGardenStructureWorldFootprintCells(
                placedStructure.document,
                placedStructure.placement,
            ).map(({ x, y }) => ({ x, y })),
        );
        assert.deepEqual(
            getGardenOccupancyCell(index, { x: 4, y: -2 })?.structureIds,
            ['shed'],
        );
    });

    test('rejects duplicate stack coordinates and unknown block references', () => {
        const result = createGardenOccupancyIndex({
            blockDataByName,
            blocks: [block('grass')],
            stacks: [stack(0, 0, 'grass'), stack(0, 0, 'missing')],
            structures: [],
        });

        assert.equal(result.valid, false);
        assert.deepEqual(issueCodes(result).sort(), [
            'duplicate-stack-coordinate',
            'unknown-block-id',
        ]);
    });

    test('rejects duplicate block records and duplicate active placements', () => {
        const result = createGardenOccupancyIndex({
            blockDataByName,
            blocks: [block('grass'), block('grass')],
            stacks: [stack(0, 0, 'grass'), stack(1, 0, 'grass')],
            structures: [],
        });

        assert.equal(result.valid, false);
        assert.deepEqual(issueCodes(result).sort(), [
            'duplicate-block-id',
            'duplicate-block-placement',
        ]);
    });

    test('rejects duplicate structure identities and footprint cells', () => {
        const result = createGardenOccupancyIndex({
            blockDataByName,
            blocks: [],
            stacks: [],
            structures: [
                structureFromFootprint('shed', [
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                ]),
                structureFromFootprint('shed', [{ x: 1, y: 0 }]),
            ],
        });

        assert.equal(result.valid, false);
        assert.deepEqual(issueCodes(result).sort(), [
            'duplicate-structure-cell',
            'duplicate-structure-id',
        ]);
    });

    test('rejects invalid stack coordinates and invalid or empty footprints', () => {
        const result = createGardenOccupancyIndex({
            blockDataByName,
            blocks: [],
            stacks: [stack(0.5, 0)],
            structures: [
                structureFromFootprint('empty', []),
                structureFromFootprint('fractional', [{ x: 0, y: 0.5 }]),
            ],
        });

        assert.equal(result.valid, false);
        assert.deepEqual(issueCodes(result).sort(), [
            'empty-structure-footprint',
            'invalid-stack-coordinate',
            'invalid-structure-coordinate',
        ]);
    });

    test('can exclude an existing structure while building a move snapshot', () => {
        const index = createIndex({
            blocks: [],
            excludedStructureIds: new Set(['house']),
            stacks: [],
            structures: [
                structureFromFootprint('house', [{ x: 4, y: 6 }]),
                structureFromFootprint('barn', [{ x: 5, y: 6 }]),
            ],
        });

        assert.equal(index.structuresById.has('house'), false);
        assert.equal(getGardenOccupancyCell(index, { x: 4, y: 6 }), undefined);
        assert.deepEqual(
            getGardenOccupancyCell(index, { x: 5, y: 6 })?.structureIds,
            ['barn'],
        );
    });

    test('excludes moving blocks from support height and occupied cells', () => {
        const index = createIndex({
            blocks: [
                block('ground'),
                block('moving', 'Long_Block'),
                block('top'),
            ],
            excludedBlockIds: new Set(['moving']),
            stacks: [stack(0, 0, 'ground', 'moving', 'top')],
        });

        const anchorCell = getGardenOccupancyCell(index, { x: 0, y: 0 });
        assert.deepEqual(
            anchorCell?.blocks.map((candidate) => candidate.blockId),
            ['ground', 'top'],
        );
        assert.equal(anchorCell?.blocks[1]?.bottomHeight, 1);
        assert.equal(getGardenOccupancyCell(index, { x: 1, y: 0 }), undefined);
    });
});

describe('validateGardenStructurePlacement', () => {
    test('accepts level support at negative coordinates in all rotations', () => {
        const cells = [footprintCell(0, 0), footprintCell(1, 0)];
        const rotations: readonly GardenStructurePlacement['rotation'][] = [
            0, 1, 2, 3,
        ];

        for (const rotation of rotations) {
            const candidate = structureFromDocument('candidate', cells, {
                anchorX: -8,
                anchorY: -5,
                rotation,
            });
            const worldFootprint = getGardenStructureWorldFootprintCells(
                candidate.document,
                candidate.placement,
            );
            const blocks = worldFootprint.map((_, index) =>
                block(`ground-${rotation.toString()}-${index.toString()}`),
            );
            const stacks = worldFootprint.map((coordinate, index) =>
                stack(coordinate.x, coordinate.y, blocks[index]?.id ?? ''),
            );
            const validation = validateGardenStructurePlacement({
                candidate,
                index: createIndex({ blocks, stacks }),
            });

            assert.equal(
                validation.valid,
                true,
                validation.valid
                    ? undefined
                    : JSON.stringify(validation.issues),
            );
            if (validation.valid) {
                assert.equal(validation.supportHeight, 1);
                assert.deepEqual(
                    validation.worldFootprint,
                    worldFootprint.map(({ x, y }) => ({ x, y })),
                );
            }
        }
    });

    test('ignores its own persisted footprint while rejecting other structures', () => {
        const supports = [block('ground-a'), block('ground-b')];
        const stacks = [stack(2, 3, 'ground-a'), stack(3, 3, 'ground-b')];
        const persisted = structureFromFootprint('house', [
            { x: 2, y: 3 },
            { x: 3, y: 3 },
        ]);
        const index = createIndex({
            blocks: supports,
            stacks,
            structures: [
                persisted,
                structureFromFootprint('barn', [{ x: 3, y: 3 }]),
            ],
        });

        const conflicts = validateGardenStructurePlacement({
            candidate: persisted,
            index,
        });
        assert.equal(conflicts.valid, false);
        assert.deepEqual(issueCodes(conflicts), ['structure-overlap']);

        const explicitlyExcluded = validateGardenStructurePlacement({
            candidate: structureFromFootprint('draft-house', [
                { x: 2, y: 3 },
                { x: 3, y: 3 },
            ]),
            excludedStructureIds: new Set(['house', 'barn']),
            index,
        });
        assert.equal(explicitlyExcluded.valid, true);
    });

    test('rejects a footprint cell without support', () => {
        const index = createIndex({
            blocks: [block('ground')],
            stacks: [stack(0, 0, 'ground')],
        });
        const result = validateGardenStructurePlacement({
            candidate: structureFromFootprint('house', [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
            ]),
            index,
        });

        assert.deepEqual(issueCodes(result), ['missing-support']);
    });

    test('rejects water and swamp support', () => {
        for (const supportName of ['Block_Water', 'Block_Swamp']) {
            const index = createIndex({
                blocks: [block('support', supportName)],
                stacks: [stack(0, 0, 'support')],
            });
            const result = validateGardenStructurePlacement({
                candidate: structureFromFootprint('house', [{ x: 0, y: 0 }]),
                index,
            });

            assert.deepEqual(issueCodes(result), ['water-support']);
        }
    });

    test('rejects non-stackable support anywhere in a footprint cell', () => {
        const index = createIndex({
            blocks: [block('ground'), block('bed', 'Raised_Bed')],
            stacks: [stack(0, 0, 'ground', 'bed')],
        });
        const result = validateGardenStructurePlacement({
            candidate: structureFromFootprint('house', [{ x: 0, y: 0 }]),
            index,
        });

        assert.deepEqual(issueCodes(result), ['non-stackable-support']);
        if (!result.valid) {
            assert.equal(result.issues[0]?.blockId, 'bed');
        }
    });

    test('rejects uneven support heights', () => {
        const index = createIndex({
            blocks: [block('short'), block('tall', 'Block_Tall')],
            stacks: [stack(0, 0, 'short'), stack(1, 0, 'tall')],
        });
        const result = validateGardenStructurePlacement({
            candidate: structureFromFootprint('house', [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
            ]),
            index,
        });

        assert.deepEqual(issueCodes(result), ['uneven-support']);
        if (!result.valid) {
            assert.equal(result.issues[0]?.expectedSupportHeight, 1);
            assert.equal(result.issues[0]?.supportHeight, 2);
        }
    });

    test('fails closed when support catalogue data is unavailable', () => {
        const index = createIndex({
            blocks: [block('legacy', 'Legacy_Block')],
            stacks: [stack(0, 0, 'legacy')],
        });
        const result = validateGardenStructurePlacement({
            candidate: structureFromFootprint('house', [{ x: 0, y: 0 }]),
            index,
        });

        assert.deepEqual(issueCodes(result), ['unknown-support-data']);
    });

    test('treats covered-outdoor cells as supported occupancy cells', () => {
        const candidate = structureFromDocument('porch', [
            footprintCell(0, 0, 'covered-outdoor'),
        ]);
        const index = createIndex({
            blocks: [block('ground')],
            stacks: [stack(0, 0, 'ground')],
        });

        assert.equal(
            validateGardenStructurePlacement({ candidate, index }).valid,
            true,
        );
    });

    test('rejects invalid candidate footprint input before occupancy checks', () => {
        const index = createIndex({ blocks: [], stacks: [] });
        const duplicate = validateGardenStructurePlacement({
            candidate: structureFromFootprint('house', [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
            ]),
            index,
        });
        const empty = validateGardenStructurePlacement({
            candidate: structureFromFootprint('house', []),
            index,
        });

        assert.deepEqual(issueCodes(duplicate), ['duplicate-structure-cell']);
        assert.deepEqual(issueCodes(empty), ['empty-structure-footprint']);
    });
});

describe('validateGardenStructuresAfterMutation', () => {
    test('rejects removal of support beneath a persisted structure', () => {
        const structure = structureFromFootprint('house', [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
        ]);
        const before = createIndex({
            blocks: [block('ground-a'), block('ground-b')],
            stacks: [stack(0, 0, 'ground-a'), stack(1, 0, 'ground-b')],
            structures: [structure],
        });
        assert.deepEqual(validateGardenStructuresAfterMutation(before), {
            valid: true,
        });

        const after = createIndex({
            blocks: [block('ground-a'), block('ground-b')],
            stacks: [stack(0, 0, 'ground-a')],
            structures: [structure],
        });
        const validation = validateGardenStructuresAfterMutation(after);

        assert.equal(validation.valid, false);
        assert.deepEqual(issueCodes(validation), ['missing-support']);
        if (!validation.valid) {
            assert.equal(validation.issues[0]?.structureId, 'house');
            assert.deepEqual(validation.issues[0]?.coordinate, { x: 1, y: 0 });
        }
    });

    test('detects structure overlap in an authoritative candidate snapshot', () => {
        const index = createIndex({
            blocks: [block('ground')],
            stacks: [stack(0, 0, 'ground')],
            structures: [
                structureFromFootprint('house', [{ x: 0, y: 0 }]),
                structureFromFootprint('barn', [{ x: 0, y: 0 }]),
            ],
        });
        const validation = validateGardenStructuresAfterMutation(index);

        assert.equal(validation.valid, false);
        assert.deepEqual(issueCodes(validation), [
            'structure-overlap',
            'structure-overlap',
        ]);
    });

    test('can revalidate only structures affected by a support mutation', () => {
        const index = createIndex({
            blocks: [block('house-ground')],
            stacks: [stack(0, 0, 'house-ground')],
            structures: [
                structureFromFootprint('house', [{ x: 0, y: 0 }]),
                structureFromFootprint('barn', [{ x: 10, y: 10 }]),
            ],
        });
        const validation = validateGardenStructuresAfterMutation(index, {
            structureIds: new Set(['house']),
        });

        assert.deepEqual(validation, { valid: true });
    });
});
