import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    type GardenOccupancyStorageBlockLike,
    type GardenOccupancyStorageStackLike,
    type GardenOccupancyStorageStructureLike,
    gardenOccupancyServiceMaxIssues,
    validatePersistedStructuresAfterBlockMutation,
    validateStructureCandidateAgainstGarden,
} from './gardenOccupancyService';

const blockData = [
    {
        information: { name: 'Block_Grass' },
        attributes: { height: 1, stackable: true },
    },
    {
        information: { name: 'Crate' },
        attributes: { height: 1, stackable: false },
    },
    {
        information: { name: 'Block_Water' },
        attributes: { height: 1, stackable: true },
    },
    {
        information: { name: 'Long_Grass' },
        attributes: {
            height: 1,
            spanDepth: 1,
            spanWidth: 2,
            stackable: true,
        },
    },
];

function structureDocument(...cells: readonly [number, number][]) {
    return {
        schemaVersion: 1,
        footprint: {
            cells: cells.map(([x, y]) => ({
                spaceKind: 'interior',
                x,
                y,
            })),
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

function structure(
    id: string,
    cells: readonly [number, number][] = [[0, 0]],
    placement: { anchorX: number; anchorY: number; rotation: number } = {
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
    },
) {
    return {
        ...placement,
        document: structureDocument(...cells),
        id,
    };
}

function gardenSnapshot({
    blocks = [],
    stacks = [],
    structures = [],
}: {
    blocks?: readonly GardenOccupancyStorageBlockLike[];
    stacks?: readonly GardenOccupancyStorageStackLike[];
    structures?: readonly GardenOccupancyStorageStructureLike[];
} = {}) {
    return { blocks, stacks, structures };
}

function issueCodes(
    result:
        | ReturnType<typeof validatePersistedStructuresAfterBlockMutation>
        | ReturnType<typeof validateStructureCandidateAgainstGarden>,
) {
    return result.valid ? [] : result.error.issues.map((issue) => issue.code);
}

describe('validateStructureCandidateAgainstGarden', () => {
    test('adapts storage rows and validates a rotated candidate with self-exclusion', () => {
        const persisted = structure(
            'house',
            [
                [0, 0],
                [1, 0],
            ],
            { anchorX: 4, anchorY: 5, rotation: 1 },
        );
        const result = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: persisted,
            snapshot: gardenSnapshot({
                blocks: [{ id: 'ground', name: 'Long_Grass', rotation: 1 }],
                stacks: [{ blocks: ['ground'], positionX: 4, positionY: 5 }],
                structures: [persisted],
            }),
        });

        assert.equal(result.valid, true);
        if (result.valid) {
            assert.equal(result.supportHeight, 1);
            assert.deepEqual(result.worldFootprint, [
                { x: 4, y: 5 },
                { x: 4, y: 6 },
            ]);
        }
    });

    test('treats nullable optional directory placement fields as absent', () => {
        const nullableBlockData = [
            {
                information: { name: 'Block_Nullable' },
                attributes: {
                    height: 1,
                    placeableOnWater: null,
                    spanDepth: null,
                    spanWidth: null,
                    stackable: true,
                },
            },
        ];
        const result = validateStructureCandidateAgainstGarden({
            blockData: nullableBlockData,
            candidate: structure('house'),
            snapshot: gardenSnapshot({
                blocks: [{ id: 'ground', name: 'Block_Nullable' }],
                stacks: [{ blocks: ['ground'], positionX: 0, positionY: 0 }],
            }),
        });

        assert.equal(result.valid, true);
        if (result.valid) {
            assert.equal(result.supportHeight, 1);
        }
    });

    test('supports excluding moving blocks and existing structure footprints', () => {
        const snapshot = gardenSnapshot({
            blocks: [
                { id: 'ground', name: 'Block_Grass', rotation: 0 },
                { id: 'crate', name: 'Crate', rotation: 0 },
            ],
            stacks: [
                {
                    blocks: ['ground', 'crate'],
                    positionX: 0,
                    positionY: 0,
                },
            ],
            structures: [structure('old-house')],
        });
        const blocked = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('replacement'),
            snapshot,
        });
        const excluded = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('replacement'),
            excludedBlockIds: new Set(['crate']),
            excludedStructureIds: new Set(['old-house']),
            snapshot,
        });

        assert.equal(blocked.valid, false);
        assert.deepEqual(issueCodes(blocked).sort(), [
            'non-stackable-support',
            'structure-overlap',
        ]);
        assert.equal(excluded.valid, true);
        if (excluded.valid) {
            assert.equal(excluded.supportHeight, 1);
        }
    });

    test('returns a 409 conflict for missing, water, and uneven support', () => {
        const result = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('house', [
                [0, 0],
                [1, 0],
                [2, 0],
            ]),
            snapshot: gardenSnapshot({
                blocks: [
                    { id: 'ground', name: 'Block_Grass' },
                    { id: 'water', name: 'Block_Water' },
                    { id: 'top', name: 'Block_Grass' },
                ],
                stacks: [
                    {
                        blocks: ['ground', 'top'],
                        positionX: 0,
                        positionY: 0,
                    },
                    { blocks: ['water'], positionX: 1, positionY: 0 },
                ],
            }),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(result.error.status, 409);
            assert.equal(result.error.code, 'GARDEN_OCCUPANCY_CONFLICT');
            assert.equal(result.error.message.length < 100, true);
        }
        assert.deepEqual(issueCodes(result).sort(), [
            'missing-support',
            'uneven-support',
            'water-support',
        ]);
    });

    test('fails closed on malformed documents, catalogue rows, and unknown block names', () => {
        const invalidDocument = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: {
                ...structure('house'),
                document: { schemaVersion: 99 },
            },
            snapshot: gardenSnapshot(),
        });
        const duplicateCatalog = validateStructureCandidateAgainstGarden({
            blockData: [...blockData, blockData[0]],
            candidate: structure('house'),
            snapshot: gardenSnapshot(),
        });
        const unknownBlock = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('house'),
            snapshot: gardenSnapshot({
                blocks: [{ id: 'mystery', name: 'Missing_Block' }],
            }),
        });

        for (const result of [
            invalidDocument,
            duplicateCatalog,
            unknownBlock,
        ]) {
            assert.equal(result.valid, false);
            if (!result.valid) {
                assert.equal(result.error.status, 400);
                assert.equal(
                    result.error.code,
                    'GARDEN_OCCUPANCY_INVALID_INPUT',
                );
            }
        }
        assert.equal(
            issueCodes(invalidDocument).includes('unsupported-schema-version'),
            true,
        );
        assert.deepEqual(issueCodes(duplicateCatalog), [
            'duplicate-directory-block-name',
        ]);
        assert.deepEqual(issueCodes(unknownBlock), ['unknown-block-name']);
    });

    test('rejects duplicate coordinates and unknown or duplicate active block ids', () => {
        const result = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('house'),
            snapshot: gardenSnapshot({
                blocks: [
                    { id: 'ground', name: 'Block_Grass' },
                    { id: 'ground', name: 'Block_Grass' },
                ],
                stacks: [
                    { blocks: ['ground'], positionX: 0, positionY: 0 },
                    {
                        blocks: ['ground', 'missing'],
                        positionX: 0,
                        positionY: 0,
                    },
                ],
            }),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(result.error.status, 409);
            assert.equal(result.error.code, 'GARDEN_OCCUPANCY_INVALID_STATE');
        }
        assert.deepEqual(issueCodes(result).sort(), [
            'duplicate-block-id',
            'duplicate-block-placement',
            'duplicate-stack-coordinate',
            'unknown-block-id',
        ]);
    });

    test('rejects duplicate structures and unknown movement exclusions', () => {
        const duplicateStructure = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('candidate'),
            snapshot: gardenSnapshot({
                structures: [structure('house'), structure('house')],
            }),
        });
        const unknownExclusions = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('candidate'),
            excludedBlockIds: new Set(['missing-block']),
            excludedStructureIds: new Set(['missing-structure']),
            snapshot: gardenSnapshot(),
        });

        assert.equal(duplicateStructure.valid, false);
        if (!duplicateStructure.valid) {
            assert.equal(duplicateStructure.error.status, 409);
            assert.equal(
                duplicateStructure.error.code,
                'GARDEN_OCCUPANCY_INVALID_STATE',
            );
        }
        assert.deepEqual(issueCodes(duplicateStructure), [
            'duplicate-structure-id',
        ]);

        assert.equal(unknownExclusions.valid, false);
        if (!unknownExclusions.valid) {
            assert.equal(unknownExclusions.error.status, 400);
        }
        assert.deepEqual(issueCodes(unknownExclusions).sort(), [
            'unknown-excluded-block-id',
            'unknown-excluded-structure-id',
        ]);
    });

    test('bounds issue output and does not return raw shared messages', () => {
        const stacks = Array.from(
            { length: gardenOccupancyServiceMaxIssues + 10 },
            () => ({ blocks: ['ground'], positionX: 0, positionY: 0 }),
        );
        const result = validateStructureCandidateAgainstGarden({
            blockData,
            candidate: structure('house'),
            snapshot: gardenSnapshot({
                blocks: [{ id: 'ground', name: 'Block_Grass' }],
                stacks,
            }),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(
                result.error.issues.length,
                gardenOccupancyServiceMaxIssues,
            );
            assert.equal(result.error.truncated, true);
            assert.equal(
                Object.hasOwn(result.error.issues[0] ?? {}, 'message'),
                false,
            );
        }
    });
});

describe('createGardenOccupancyIndexFromStorageSnapshot', () => {
    test('exposes combined block and structure cells for placement search', () => {
        const result = createGardenOccupancyIndexFromStorageSnapshot({
            blockData,
            snapshot: gardenSnapshot({
                blocks: [{ id: 'ground', name: 'Block_Grass' }],
                stacks: [{ blocks: ['ground'], positionX: 4, positionY: -2 }],
                structures: [
                    structure('house', [[0, 0]], {
                        anchorX: 4,
                        anchorY: -2,
                        rotation: 0,
                    }),
                ],
            }),
        });

        assert.equal(result.valid, true);
        if (result.valid) {
            const cell = result.index.cells.get('4|-2');
            assert.deepEqual(cell?.structureIds, ['house']);
            assert.deepEqual(
                cell?.blocks.map((block) => block.blockId),
                ['ground'],
            );
        }
    });
});

describe('validatePersistedStructuresAfterBlockMutation', () => {
    test('rejects removal of support beneath a persisted structure', () => {
        const result = validatePersistedStructuresAfterBlockMutation({
            blockData,
            snapshot: gardenSnapshot({
                blocks: [{ id: 'ground', name: 'Block_Grass' }],
                stacks: [{ blocks: ['ground'], positionX: 0, positionY: 0 }],
                structures: [
                    structure('house', [
                        [0, 0],
                        [1, 0],
                    ]),
                ],
            }),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(result.error.status, 409);
            assert.equal(result.error.code, 'GARDEN_OCCUPANCY_CONFLICT');
        }
        assert.deepEqual(issueCodes(result), ['missing-support']);
    });

    test('can validate only affected structures and rejects unknown selections', () => {
        const snapshot = gardenSnapshot({
            blocks: [{ id: 'ground', name: 'Block_Grass' }],
            stacks: [{ blocks: ['ground'], positionX: 0, positionY: 0 }],
            structures: [
                structure('house'),
                structure('unsupported-barn', [[0, 0]], {
                    anchorX: 10,
                    anchorY: 10,
                    rotation: 0,
                }),
            ],
        });
        const selected = validatePersistedStructuresAfterBlockMutation({
            affectedStructureIds: new Set(['house']),
            blockData,
            snapshot,
        });
        const unknown = validatePersistedStructuresAfterBlockMutation({
            affectedStructureIds: new Set(['missing']),
            blockData,
            snapshot,
        });

        assert.deepEqual(selected, { valid: true });
        assert.equal(unknown.valid, false);
        if (!unknown.valid) {
            assert.equal(unknown.error.status, 400);
        }
        assert.deepEqual(issueCodes(unknown), [
            'unknown-affected-structure-id',
        ]);
    });

    test('fails closed on malformed persisted structure documents', () => {
        const result = validatePersistedStructuresAfterBlockMutation({
            blockData,
            snapshot: gardenSnapshot({
                structures: [
                    { ...structure('house'), document: { schemaVersion: 1 } },
                ],
            }),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(result.error.status, 400);
            assert.equal(result.error.code, 'GARDEN_OCCUPANCY_INVALID_INPUT');
        }
        assert.equal(issueCodes(result).includes('invalid-field'), true);
    });
});
