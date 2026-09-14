import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructurePlacement,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureEditorOccupancyIndex,
    type GardenStructurePlacementBlockData,
    type GardenStructurePlacementOccupancyGarden,
    validateGardenStructureEditorPlacementOccupancy,
} from './gardenStructurePlacementOccupancy';

const document = createGardenStructureTemplateSeed('blank').document;
const placement = { anchorX: 0, anchorY: 0, rotation: 0 } as const;

function catalogBlock(
    name: string,
    stackable: boolean,
): GardenStructurePlacementBlockData {
    return {
        attributes: { height: 1, stackable },
        information: { name },
    };
}

function createStacks(width: number, depth: number, blockName = 'Block_Grass') {
    return Array.from({ length: width }, (_, x) =>
        Array.from({ length: depth }, (_, z) => ({
            blocks: [
                {
                    id: `${blockName}-${x.toString()}-${z.toString()}`,
                    name: blockName,
                    rotation: 0,
                },
            ],
            position: { x, z },
        })),
    ).flat();
}

function garden(
    stacks: GardenStructurePlacementOccupancyGarden['stacks'],
    structures: GardenStructurePlacementOccupancyGarden['structures'] = [],
): GardenStructurePlacementOccupancyGarden {
    return { stacks, structures };
}

function validate({
    blockData = [catalogBlock('Block_Grass', true)],
    candidateId = 'draft-1',
    candidatePlacement = placement,
    currentGarden = garden(createStacks(2, 2)),
}: Readonly<{
    blockData?: readonly GardenStructurePlacementBlockData[] | null;
    candidateId?: string;
    candidatePlacement?: GardenStructurePlacement;
    currentGarden?: GardenStructurePlacementOccupancyGarden | null;
}> = {}) {
    return validateGardenStructureEditorPlacementOccupancy({
        candidateDocument: document,
        candidateId,
        candidatePlacement,
        occupancy: createGardenStructureEditorOccupancyIndex({
            blockData,
            garden: currentGarden,
        }),
    });
}

describe('garden structure editor placement occupancy', () => {
    test('accepts level, unoccupied support stacks', () => {
        assert.deepEqual(validate(), { valid: true });
    });

    test('rejects overlap with an existing structure', () => {
        const result = validate({
            candidatePlacement: { anchorX: 1, anchorY: 0, rotation: 0 },
            currentGarden: garden(createStacks(3, 2), [
                {
                    anchorX: 0,
                    anchorY: 0,
                    document,
                    id: 'structure-1',
                    rotation: 0,
                },
            ]),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(result.reason, 'placement-conflict');
            assert.ok(
                result.issues.some(
                    (issue) => issue.code === 'structure-overlap',
                ),
            );
        }
    });

    test('rejects non-stackable raised-bed support', () => {
        const result = validate({
            blockData: [catalogBlock('Raised_Bed', false)],
            currentGarden: garden(createStacks(2, 2, 'Raised_Bed')),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.ok(
                result.issues.some(
                    (issue) => issue.code === 'non-stackable-support',
                ),
            );
        }
    });

    test('excludes the saved structure itself while editing its placement', () => {
        assert.deepEqual(
            validate({
                candidateId: 'structure-1',
                currentGarden: garden(createStacks(2, 2), [
                    {
                        anchorX: 0,
                        anchorY: 0,
                        document,
                        id: 'structure-1',
                        rotation: 0,
                    },
                ]),
            }),
            { valid: true },
        );
    });

    test('fails closed while catalogue or garden data is unavailable', () => {
        assert.deepEqual(validate({ blockData: null }), {
            issues: [],
            reason: 'catalog-unavailable',
            valid: false,
        });
        assert.deepEqual(validate({ currentGarden: null }), {
            issues: [],
            reason: 'catalog-unavailable',
            valid: false,
        });
    });

    test('fails closed for missing catalogue entries and inconsistent garden state', () => {
        const unknownSupport = validate({ blockData: [] });
        assert.equal(unknownSupport.valid, false);
        if (!unknownSupport.valid) {
            assert.equal(unknownSupport.reason, 'invalid-garden-state');
        }

        const duplicateBlockIdStacks = createStacks(2, 2).map((stack) => ({
            ...stack,
            blocks: stack.blocks.map((block) => ({
                ...block,
                id: 'duplicate-block',
            })),
        }));
        const inconsistent = validate({
            currentGarden: garden(duplicateBlockIdStacks),
        });
        assert.equal(inconsistent.valid, false);
        if (!inconsistent.valid) {
            assert.equal(inconsistent.reason, 'invalid-garden-state');
        }
    });

    test('rejects malformed catalogue attributes and duplicate names', () => {
        const missingAttributes = validate({
            blockData: [{ information: { name: 'Block_Grass' } }],
        });
        assert.equal(missingAttributes.valid, false);
        if (!missingAttributes.valid) {
            assert.equal(missingAttributes.reason, 'invalid-garden-state');
        }

        const nonFiniteHeight = validate({
            blockData: [
                {
                    attributes: { height: Number.NaN, stackable: true },
                    information: { name: 'Block_Grass' },
                },
            ],
        });
        assert.equal(nonFiniteHeight.valid, false);

        const duplicateName = validate({
            blockData: [
                catalogBlock('Block_Grass', true),
                catalogBlock('Block_Grass', true),
            ],
        });
        assert.equal(duplicateName.valid, false);
        if (!duplicateName.valid) {
            assert.equal(duplicateName.reason, 'duplicate-catalog-name');
        }
    });

    test('caps spans before indexing and rejects unknown blocks outside the candidate', () => {
        const oversizedSpan = validate({
            blockData: [
                {
                    attributes: {
                        height: 1,
                        spanWidth: 65,
                        stackable: true,
                    },
                    information: { name: 'Block_Grass' },
                },
            ],
        });
        assert.equal(oversizedSpan.valid, false);
        if (!oversizedSpan.valid) {
            assert.equal(oversizedSpan.reason, 'invalid-garden-state');
        }

        const unknownAwayFromCandidate = validate({
            currentGarden: garden([
                ...createStacks(2, 2),
                {
                    blocks: [
                        {
                            id: 'unknown-away',
                            name: 'NoSuchBlock',
                            rotation: 0,
                        },
                    ],
                    position: { x: 50, z: 50 },
                },
            ]),
        });
        assert.equal(unknownAwayFromCandidate.valid, false);
        if (!unknownAwayFromCandidate.valid) {
            assert.equal(
                unknownAwayFromCandidate.reason,
                'invalid-garden-state',
            );
        }
    });
});
