import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    GardenStructureDocumentV1,
    GardenStructureFootprintCell,
    GardenStructureRotation,
    GardenStructureSpaceKind,
    GardenStructureValidationIssueCode,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureReferenceValidator,
    createGardenStructureTemplateSeed,
    gardenStructureEdgeKey,
    gardenStructureMaxIdentifierLength,
    gardenStructureSchemaVersion,
    normalizeGardenStructureDocument,
    validateGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import type {
    GardenStructureDocumentEditFailureReason,
    GardenStructureDocumentEditResult,
    GardenStructureDocumentEditValue,
} from './index';
import {
    addGardenStructureProp,
    deleteGardenStructureProp,
    duplicateGardenStructureProp,
    getCanonicalGardenStructureEdge,
    moveGardenStructureProp,
    removeGardenStructureEdgePart,
    removeGardenStructureFloorMaterial,
    removeGardenStructureRoofCoverage,
    rotateGardenStructureProp,
    setGardenStructureEdgePart,
    setGardenStructureFloorMaterial,
    setGardenStructureFootprintCellSpaceKind,
    setGardenStructureRoofCoverage,
} from './index';

const kit = { kitKey: 'gredice-buildings', kitVersion: '1' } as const;
const isReferenceAllowed = createGardenStructureReferenceValidator(
    kit.kitKey,
    kit.kitVersion,
);

if (!isReferenceAllowed) {
    throw new Error('Expected the version one structure kit in tests.');
}

function unwrap(
    result: GardenStructureDocumentEditResult,
): GardenStructureDocumentEditValue {
    if (!result.ok) {
        assert.fail(`${result.error.reason}: ${result.error.message}`);
    }
    return result.value;
}

function assertFailure(
    result: GardenStructureDocumentEditResult,
    reason: GardenStructureDocumentEditFailureReason,
    issueCode?: GardenStructureValidationIssueCode,
) {
    assert.equal(result.ok, false);
    if (result.ok) {
        return;
    }
    assert.equal(result.error.reason, reason);
    if (issueCode) {
        assert.ok(
            result.error.issues?.some((issue) => issue.code === issueCode),
            `Expected validation issue ${issueCode}`,
        );
    }
}

function blankDocument() {
    return createGardenStructureTemplateSeed('blank').document;
}

function assertValid(document: GardenStructureDocumentV1) {
    const validation = validateGardenStructureDocument(document, {
        isReferenceAllowed,
    });
    assert.equal(validation.valid, true);
}

function createHundredCellDocument() {
    const cells: GardenStructureFootprintCell[] = [];
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            cells.push({ x, y, spaceKind: 'interior' });
        }
    }
    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: [],
        edges: [],
        roofRegions: [],
        props: cells.map((cell, index) => ({
            id: `existing-prop-${(index + 1).toString()}`,
            partId: 'prop.table',
            x: cell.x,
            y: cell.y,
            rotation: 0,
        })),
    });
}

describe('garden structure semantic document edits', () => {
    test('maps N/E/S/W selections onto canonical north/east edge slots', () => {
        const cell = { x: 2, y: 3 };
        assert.deepEqual(getCanonicalGardenStructureEdge(cell, 'N'), {
            from: { x: 2, y: 3 },
            direction: 'north',
        });
        assert.deepEqual(getCanonicalGardenStructureEdge(cell, 'E'), {
            from: { x: 2, y: 3 },
            direction: 'east',
        });
        assert.deepEqual(getCanonicalGardenStructureEdge(cell, 'S'), {
            from: { x: 2, y: 4 },
            direction: 'north',
        });
        assert.deepEqual(getCanonicalGardenStructureEdge(cell, 'W'), {
            from: { x: 1, y: 3 },
            direction: 'east',
        });
        assert.equal(
            gardenStructureEdgeKey(getCanonicalGardenStructureEdge(cell, 'E')),
            gardenStructureEdgeKey(
                getCanonicalGardenStructureEdge({ x: 3, y: 3 }, 'W'),
            ),
        );
        assert.equal(
            gardenStructureEdgeKey(getCanonicalGardenStructureEdge(cell, 'S')),
            gardenStructureEdgeKey(
                getCanonicalGardenStructureEdge({ x: 2, y: 4 }, 'N'),
            ),
        );
    });

    test('changes only a footprint cell space intent and keeps all coordinates and unrelated parts', () => {
        const document = createGardenStructureTemplateSeed('house').document;
        const sourceJson = JSON.stringify(document);
        const beforeCoordinates = document.footprint.cells.map(({ x, y }) => ({
            x,
            y,
        }));

        const result = unwrap(
            setGardenStructureFootprintCellSpaceKind({
                document,
                kit,
                cell: { x: 0, y: 0 },
                spaceKind: 'covered-outdoor',
            }),
        );

        assert.deepEqual(
            result.document.footprint.cells.map(({ x, y }) => ({ x, y })),
            beforeCoordinates,
        );
        assert.equal(
            result.document.footprint.cells.find(
                (cell) => cell.x === 0 && cell.y === 0,
            )?.spaceKind,
            'covered-outdoor',
        );
        assert.deepEqual(result.document.floors, document.floors);
        assert.deepEqual(result.document.edges, document.edges);
        assert.deepEqual(result.document.roofRegions, document.roofRegions);
        assert.deepEqual(result.document.props, document.props);
        assert.equal(JSON.stringify(document), sourceJson);
        assertValid(result.document);

        assertFailure(
            setGardenStructureFootprintCellSpaceKind({
                document: result.document,
                kit,
                cell: { x: 0, y: 0 },
                spaceKind: 'covered-outdoor',
            }),
            'no-change',
        );
    });

    test('sets, replaces, and removes one normalized floor material', () => {
        const document = {
            ...blankDocument(),
            footprint: {
                cells: [...blankDocument().footprint.cells].reverse(),
            },
        };
        const added = unwrap(
            setGardenStructureFloorMaterial({
                document,
                kit,
                cell: { x: 1, y: 0 },
                materialId: 'floor.stone',
            }),
        );
        assert.deepEqual(added.document.floors, [
            { cell: { x: 1, y: 0 }, materialId: 'floor.stone' },
        ]);
        assert.deepEqual(
            added.document.footprint.cells,
            blankDocument().footprint.cells,
        );

        const replaced = unwrap(
            setGardenStructureFloorMaterial({
                document: added.document,
                kit,
                cell: { x: 1, y: 0 },
                materialId: 'floor.timber',
            }),
        );
        assert.deepEqual(replaced.document.floors, [
            { cell: { x: 1, y: 0 }, materialId: 'floor.timber' },
        ]);

        const removed = unwrap(
            removeGardenStructureFloorMaterial({
                document: replaced.document,
                kit,
                cell: { x: 1, y: 0 },
            }),
        );
        assert.deepEqual(removed.document.floors, []);
        assertValid(removed.document);
        assertFailure(
            removeGardenStructureFloorMaterial({
                document: removed.document,
                kit,
                cell: { x: 1, y: 0 },
            }),
            'item-not-found',
        );
        assertFailure(
            setGardenStructureFloorMaterial({
                document: removed.document,
                kit,
                cell: { x: 1, y: 0 },
                materialId: 'floor.unknown',
            }),
            'unsupported-reference',
            'invalid-part-reference',
        );
    });

    test('sets wall, door, and window replacements in one edge slot while preserving its ID', () => {
        const document = blankDocument();
        const wall = unwrap(
            setGardenStructureEdgePart({
                document,
                kit,
                cell: { x: 0, y: 0 },
                side: 'E',
                kind: 'wall',
                partId: 'wall.plaster',
            }),
        );
        assert.equal(wall.itemId, 'edge-1');
        assert.equal(wall.document.edges.length, 1);

        const door = unwrap(
            setGardenStructureEdgePart({
                document: wall.document,
                kit,
                cell: { x: 1, y: 0 },
                side: 'W',
                kind: 'door',
                partId: 'door.house-open',
            }),
        );
        assert.equal(door.itemId, wall.itemId);
        assert.deepEqual(door.document.edges[0], {
            id: 'edge-1',
            from: { x: 0, y: 0 },
            direction: 'east',
            kind: 'door',
            partId: 'door.house-open',
        });

        const window = unwrap(
            setGardenStructureEdgePart({
                document: door.document,
                kit,
                cell: { x: 0, y: 0 },
                side: 'E',
                kind: 'window',
                partId: 'window.house',
            }),
        );
        assert.equal(window.itemId, wall.itemId);
        assert.equal(window.document.edges[0]?.kind, 'window');

        const second = unwrap(
            setGardenStructureEdgePart({
                document: window.document,
                kit,
                cell: { x: 0, y: 0 },
                side: 'N',
                kind: 'wall',
                partId: 'wall.timber',
            }),
        );
        assert.equal(second.itemId, 'edge-2');
        assert.equal(
            new Set(second.document.edges.map((edge) => edge.id)).size,
            2,
        );
        assert.ok(
            second.document.edges.every(
                (edge) => edge.id.length <= gardenStructureMaxIdentifierLength,
            ),
        );

        const removed = unwrap(
            removeGardenStructureEdgePart({
                document: second.document,
                kit,
                cell: { x: 1, y: 0 },
                side: 'W',
            }),
        );
        assert.equal(removed.itemId, wall.itemId);
        assert.equal(removed.document.edges.length, 1);
        assertValid(removed.document);
    });

    test('rejects an edge part whose kit kind is incompatible', () => {
        assertFailure(
            setGardenStructureEdgePart({
                document: blankDocument(),
                kit,
                cell: { x: 0, y: 0 },
                side: 'N',
                kind: 'door',
                partId: 'wall.timber',
            }),
            'unsupported-reference',
            'invalid-part-reference',
        );
    });

    test('sets, replaces, splits, and removes selected-cell roof coverage without overlap', () => {
        const document = normalizeGardenStructureDocument({
            ...blankDocument(),
            roofRegions: [
                {
                    id: 'roof-main',
                    cells: [
                        { x: 0, y: 0 },
                        { x: 1, y: 0 },
                    ],
                    styleId: 'roof.gable',
                    materialId: 'roof.clay',
                    rotation: 0,
                },
            ],
        });
        const sourceJson = JSON.stringify(document);

        const split = unwrap(
            setGardenStructureRoofCoverage({
                document,
                kit,
                cell: { x: 0, y: 0 },
                styleId: 'roof.shed',
                materialId: 'roof.clay',
                rotation: 1,
            }),
        );
        assert.equal(split.itemId, 'roof-1');
        assert.deepEqual(
            split.document.roofRegions.find(
                (region) => region.id === 'roof-main',
            )?.cells,
            [{ x: 1, y: 0 }],
        );
        assert.deepEqual(
            split.document.roofRegions.find((region) => region.id === 'roof-1'),
            {
                id: 'roof-1',
                cells: [{ x: 0, y: 0 }],
                styleId: 'roof.shed',
                materialId: 'roof.clay',
                rotation: 1,
            },
        );
        assert.equal(JSON.stringify(document), sourceJson);
        assertValid(split.document);

        const replaced = unwrap(
            setGardenStructureRoofCoverage({
                document: split.document,
                kit,
                cell: { x: 0, y: 0 },
                styleId: 'roof.gable',
                materialId: 'roof.clay',
                rotation: 2,
            }),
        );
        assert.equal(replaced.itemId, 'roof-1');
        assert.equal(
            replaced.document.roofRegions.find(
                (region) => region.id === 'roof-1',
            )?.rotation,
            2,
        );

        const removed = unwrap(
            removeGardenStructureRoofCoverage({
                document: replaced.document,
                kit,
                cell: { x: 0, y: 0 },
            }),
        );
        assert.equal(removed.itemId, 'roof-1');
        assert.deepEqual(removed.document.roofRegions, [
            {
                id: 'roof-main',
                cells: [{ x: 1, y: 0 }],
                styleId: 'roof.gable',
                materialId: 'roof.clay',
                rotation: 0,
            },
        ]);
        assertValid(removed.document);
    });

    test('adds single-cell roof coverage and enforces style/material compatibility', () => {
        const added = unwrap(
            setGardenStructureRoofCoverage({
                document: blankDocument(),
                kit,
                cell: { x: 1, y: 1 },
                styleId: 'roof.gable',
                materialId: 'roof.clay',
                rotation: 3,
            }),
        );
        assert.equal(added.itemId, 'roof-1');
        assertValid(added.document);

        assertFailure(
            setGardenStructureRoofCoverage({
                document: blankDocument(),
                kit,
                cell: { x: 1, y: 1 },
                styleId: 'roof.gable',
                materialId: 'roof.greenhouse-panel',
                rotation: 0,
            }),
            'unsupported-reference',
            'invalid-part-reference',
        );
    });

    test('runs the complete prop lifecycle with deterministic unique bounded IDs', () => {
        const document = blankDocument();
        const sourceJson = JSON.stringify(document);
        const first = unwrap(
            addGardenStructureProp({
                document,
                kit,
                cell: { x: 0, y: 0 },
                partId: 'prop.table',
                rotation: 0,
            }),
        );
        assert.equal(first.itemId, 'prop-1');
        assert.equal(JSON.stringify(document), sourceJson);

        const moved = unwrap(
            moveGardenStructureProp({
                document: first.document,
                kit,
                propId: 'prop-1',
                cell: { x: 1, y: 0 },
            }),
        );
        assert.deepEqual(moved.document.props[0], {
            id: 'prop-1',
            partId: 'prop.table',
            x: 1,
            y: 0,
            rotation: 0,
        });

        const rotated = unwrap(
            rotateGardenStructureProp({
                document: moved.document,
                kit,
                propId: 'prop-1',
                rotation: 3,
            }),
        );
        assert.equal(rotated.document.props[0]?.rotation, 3);

        const duplicated = unwrap(
            duplicateGardenStructureProp({
                document: rotated.document,
                kit,
                propId: 'prop-1',
                cell: { x: 0, y: 1 },
            }),
        );
        assert.equal(duplicated.itemId, 'prop-2');
        assert.deepEqual(
            duplicated.document.props.find((prop) => prop.id === 'prop-2'),
            {
                id: 'prop-2',
                partId: 'prop.table',
                x: 0,
                y: 1,
                rotation: 3,
            },
        );
        assert.equal(
            new Set(duplicated.document.props.map((prop) => prop.id)).size,
            2,
        );
        assert.ok(
            duplicated.document.props.every(
                (prop) => prop.id.length <= gardenStructureMaxIdentifierLength,
            ),
        );

        const deleted = unwrap(
            deleteGardenStructureProp({
                document: duplicated.document,
                kit,
                propId: 'prop-1',
            }),
        );
        assert.equal(deleted.itemId, 'prop-1');
        assert.deepEqual(
            deleted.document.props.map((prop) => prop.id),
            ['prop-2'],
        );
        assertValid(deleted.document);
    });

    test('rejects prop overlap, unsupported references, missing items, and invalid targets', () => {
        const occupied = unwrap(
            addGardenStructureProp({
                document: blankDocument(),
                kit,
                cell: { x: 0, y: 0 },
                partId: 'prop.table',
                rotation: 0,
            }),
        ).document;

        assertFailure(
            addGardenStructureProp({
                document: occupied,
                kit,
                cell: { x: 0, y: 0 },
                partId: 'prop.planter',
                rotation: 0,
            }),
            'overlap',
            'overlapping-prop',
        );
        assertFailure(
            duplicateGardenStructureProp({
                document: occupied,
                kit,
                propId: 'prop-1',
                cell: { x: 0, y: 0 },
            }),
            'overlap',
            'overlapping-prop',
        );
        assertFailure(
            addGardenStructureProp({
                document: blankDocument(),
                kit,
                cell: { x: 0, y: 0 },
                partId: 'prop.unknown',
                rotation: 0,
            }),
            'unsupported-reference',
            'invalid-part-reference',
        );
        assertFailure(
            addGardenStructureProp({
                document: blankDocument(),
                kit,
                cell: { x: 0, y: 0 },
                partId: 'prop.table',
                rotation: 0,
                variantId: 'variant.unknown',
            }),
            'unsupported-reference',
            'invalid-part-reference',
        );
        assertFailure(
            moveGardenStructureProp({
                document: occupied,
                kit,
                propId: 'missing-prop',
                cell: { x: 1, y: 0 },
            }),
            'item-not-found',
        );
        assertFailure(
            moveGardenStructureProp({
                document: occupied,
                kit,
                propId: 'prop-1',
                cell: { x: 4, y: 4 },
            }),
            'cell-not-found',
        );
        assertFailure(
            setGardenStructureFloorMaterial({
                document: blankDocument(),
                kit,
                cell: { x: 1_001, y: 0 },
                materialId: 'floor.stone',
            }),
            'invalid-target',
        );
    });

    test('rejects the 101st prop through the shared document limit', () => {
        assertFailure(
            addGardenStructureProp({
                document: createHundredCellDocument(),
                kit,
                cell: { x: 0, y: 0 },
                partId: 'prop.workbench',
                rotation: 0,
            }),
            'limit-exceeded',
            'too-many-items',
        );
    });

    test('fails closed for unknown kits, invalid source documents, and invalid runtime values', () => {
        assertFailure(
            setGardenStructureFloorMaterial({
                document: blankDocument(),
                kit: { kitKey: 'unknown-kit', kitVersion: '1' },
                cell: { x: 0, y: 0 },
                materialId: 'floor.stone',
            }),
            'unsupported-kit',
        );

        const overlappingRoofDocument: GardenStructureDocumentV1 = {
            ...blankDocument(),
            roofRegions: [
                {
                    id: 'roof-a',
                    cells: [{ x: 0, y: 0 }],
                    styleId: 'roof.gable',
                    materialId: 'roof.clay',
                    rotation: 0,
                },
                {
                    id: 'roof-b',
                    cells: [{ x: 0, y: 0 }],
                    styleId: 'roof.shed',
                    materialId: 'roof.clay',
                    rotation: 0,
                },
            ],
        };
        assertFailure(
            removeGardenStructureRoofCoverage({
                document: overlappingRoofDocument,
                kit,
                cell: { x: 0, y: 0 },
            }),
            'invalid-document',
            'overlapping-roof-region',
        );

        assertFailure(
            setGardenStructureFootprintCellSpaceKind({
                document: blankDocument(),
                kit,
                cell: { x: 0, y: 0 },
                spaceKind: 'unsupported-space' as GardenStructureSpaceKind,
            }),
            'invalid-result',
            'invalid-field',
        );
        assertFailure(
            rotateGardenStructureProp({
                document: unwrap(
                    addGardenStructureProp({
                        document: blankDocument(),
                        kit,
                        cell: { x: 0, y: 0 },
                        partId: 'prop.table',
                        rotation: 0,
                    }),
                ).document,
                kit,
                propId: 'prop-1',
                rotation: 4 as GardenStructureRotation,
            }),
            'invalid-result',
            'invalid-field',
        );
    });
});
