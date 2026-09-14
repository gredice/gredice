import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    calculateGardenStructurePriceDelta,
    createGardenStructureTemplateSeed,
    decodeGardenStructureDocument,
    type GardenStructureDocumentV1,
    type GardenStructureFootprintCell,
    type GardenStructureTemplateKey,
    gardenStructureFootprintsEqual,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxPayloadBytes,
    gardenStructureSchemaVersion,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureDocumentPrice,
    getGardenStructureFootprintBounds,
    getGardenStructureFootprintPrice,
    getGardenStructurePayloadByteLength,
    getGardenStructureWorldFootprintCells,
    normalizeGardenStructureDocument,
    rotateGardenStructureDocument,
    validateGardenStructureDocument,
} from './index';

function documentForCells(
    cells: readonly GardenStructureFootprintCell[],
): GardenStructureDocumentV1 {
    return {
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

function rectangleCells(width: number, depth: number) {
    const cells: GardenStructureFootprintCell[] = [];
    for (let y = 0; y < depth; y++) {
        for (let x = 0; x < width; x++) {
            cells.push({ x, y, spaceKind: 'interior' });
        }
    }
    return cells;
}

function validationCodes(value: unknown) {
    const result = decodeGardenStructureDocument(value);
    return result.valid ? [] : result.issues.map((issue) => issue.code);
}

describe('garden structure document validation', () => {
    test('accepts the fixed footprint limits and rejects values beyond them', () => {
        const oneHundredCells = validateGardenStructureDocument(
            documentForCells(rectangleCells(20, 5)),
        );
        assert.equal(oneHundredCells.valid, true);

        const oneHundredAndOne = documentForCells(
            Array.from(
                { length: gardenStructureMaxFootprintCells + 1 },
                (_, x) => ({ x, y: 0, spaceKind: 'interior' }),
            ),
        );
        assert.ok(
            validationCodes(oneHundredAndOne).includes('footprint-cell-limit'),
        );
        assert.ok(
            validationCodes(documentForCells(rectangleCells(21, 1))).includes(
                'footprint-side-limit',
            ),
        );
    });

    test('accepts orthogonally connected concave footprints', () => {
        const footprints: readonly (readonly GardenStructureFootprintCell[])[] =
            [
                [
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 0, y: 1, spaceKind: 'interior' },
                    { x: 0, y: 2, spaceKind: 'interior' },
                    { x: 1, y: 2, spaceKind: 'interior' },
                ],
                [
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 1, y: 0, spaceKind: 'interior' },
                    { x: 2, y: 0, spaceKind: 'interior' },
                    { x: 1, y: 1, spaceKind: 'interior' },
                ],
                [
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 0, y: 1, spaceKind: 'interior' },
                    { x: 1, y: 1, spaceKind: 'interior' },
                    { x: 2, y: 1, spaceKind: 'interior' },
                    { x: 2, y: 0, spaceKind: 'interior' },
                ],
            ];

        for (const footprint of footprints) {
            assert.equal(
                validateGardenStructureDocument(documentForCells(footprint))
                    .valid,
                true,
            );
        }
    });

    test('rejects diagonal-only connectivity and duplicate cells', () => {
        assert.ok(
            validationCodes(
                documentForCells([
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 1, y: 1, spaceKind: 'interior' },
                ]),
            ).includes('disconnected-footprint'),
        );
        assert.ok(
            validationCodes(
                documentForCells([
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 0, y: 0, spaceKind: 'covered-outdoor' },
                ]),
            ).includes('duplicate-footprint-cell'),
        );
    });

    test('allows a roofed covered-outdoor cell without walls or floor', () => {
        const result = validateGardenStructureDocument({
            ...documentForCells([{ x: 0, y: 0, spaceKind: 'covered-outdoor' }]),
            roofRegions: [
                {
                    id: 'porch-roof',
                    cells: [{ x: 0, y: 0 }],
                    styleId: 'roof.shed',
                    materialId: 'roof.clay',
                    rotation: 0,
                },
            ],
        });

        assert.equal(result.valid, true);
        if (result.valid) {
            assert.deepEqual(result.warnings, []);
        }
    });

    test('returns completeness warnings without rejecting a draft shell', () => {
        const result = validateGardenStructureDocument(
            documentForCells([
                { x: 0, y: 0, spaceKind: 'interior' },
                { x: 1, y: 0, spaceKind: 'covered-outdoor' },
            ]),
        );

        assert.equal(result.valid, true);
        if (result.valid) {
            assert.deepEqual(
                new Set(result.warnings.map((issue) => issue.code)),
                new Set([
                    'interior-without-floor',
                    'incomplete-interior-shell',
                    'covered-outdoor-without-roof',
                ]),
            );
        }
    });

    test('rejects unsupported versions and parts outside the footprint', () => {
        assert.ok(
            validationCodes({
                ...documentForCells([{ x: 0, y: 0, spaceKind: 'interior' }]),
                schemaVersion: 2,
            }).includes('unsupported-schema-version'),
        );

        assert.ok(
            validationCodes({
                ...documentForCells([{ x: 0, y: 0, spaceKind: 'interior' }]),
                floors: [
                    {
                        cell: { x: 4, y: 4 },
                        materialId: 'floor.timber',
                    },
                ],
            }).includes('part-outside-footprint'),
        );
    });

    test('rejects kit references through a renderer-free allowlist callback', () => {
        const house = createGardenStructureTemplateSeed('house').document;
        const checkedReferences: string[] = [];
        const result = validateGardenStructureDocument(house, {
            isReferenceAllowed: (reference) => {
                checkedReferences.push(`${reference.kind}:${reference.id}`);
                return !(
                    reference.id === 'window.house' &&
                    reference.edgeKind === 'window'
                );
            },
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.ok(
                result.issues.some(
                    (issue) =>
                        issue.code === 'invalid-part-reference' &&
                        issue.path.endsWith('.partId'),
                ),
            );
        }
        assert.ok(checkedReferences.includes('edge-part:window.house'));
        assert.ok(checkedReferences.includes('floor-material:floor.limestone'));
        assert.ok(checkedReferences.includes('roof-style:roof.gable'));
        assert.ok(checkedReferences.includes('prop-part:prop.table'));
    });

    test('keeps a stable version 1 fixture decodable for future migrations', () => {
        const versionOneFixture: unknown = JSON.parse(`{
            "schemaVersion": 1,
            "footprint": {"cells": [{"x": 8, "y": -3, "spaceKind": "covered-outdoor"}]},
            "floors": [],
            "edges": [],
            "roofRegions": [{
                "id": "fixture-roof",
                "cells": [{"x": 8, "y": -3}],
                "styleId": "roof.shed",
                "materialId": "roof.clay",
                "rotation": 0
            }],
            "props": []
        }`);
        const result = decodeGardenStructureDocument(versionOneFixture, {
            isReferenceAllowed: (reference) =>
                reference.id === 'roof.shed' || reference.id === 'roof.clay',
        });

        assert.equal(result.valid, true);
        if (result.valid) {
            assert.equal(result.document.schemaVersion, 1);
            assert.deepEqual(
                normalizeGardenStructureDocument(result.document).footprint
                    .cells,
                [{ x: 0, y: 0, spaceKind: 'covered-outdoor' }],
            );
        }
    });

    test('bounds validation output for hostile payloads', () => {
        const result = decodeGardenStructureDocument({
            ...documentForCells([{ x: 0, y: 0, spaceKind: 'interior' }]),
            edges: Array.from({ length: 1_000 }, () => null),
        });

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.ok(result.issues.length <= 64);
            assert.ok(
                result.issues.some((issue) => issue.code === 'too-many-items'),
            );
        }
    });

    test('does not let completeness warnings suppress a hard reference error', () => {
        const result = decodeGardenStructureDocument(
            {
                ...documentForCells(rectangleCells(20, 5)),
                props: [
                    {
                        id: 'unknown-prop',
                        partId: 'prop.not-in-kit',
                        x: 1,
                        y: 1,
                        rotation: 0,
                    },
                ],
            },
            { isReferenceAllowed: () => false },
        );

        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.ok(result.issues.length <= 64);
            assert.ok(
                result.issues.some(
                    (issue) => issue.code === 'invalid-part-reference',
                ),
            );
        }
    });

    test('rejects oversized and non-serializable documents before decoding', () => {
        const oversized = {
            ...documentForCells([{ x: 0, y: 0, spaceKind: 'interior' }]),
            ignored: 'x'.repeat(gardenStructureMaxPayloadBytes),
        };
        assert.ok(validationCodes(oversized).includes('payload-too-large'));

        const circular: Record<string, unknown> = {};
        circular.self = circular;
        assert.equal(getGardenStructurePayloadByteLength(circular), null);
        assert.ok(validationCodes(circular).includes('invalid-document'));
    });

    test('rejects unknown fields instead of silently accepting hidden data', () => {
        const document = {
            ...documentForCells([{ x: 0, y: 0, spaceKind: 'interior' }]),
            executableAssetUrl: 'https://example.invalid/model.glb',
        };

        assert.ok(validationCodes(document).includes('invalid-field'));
    });
});

describe('garden structure topology', () => {
    test('normalizes coordinates and ordering deterministically', () => {
        const normalized = normalizeGardenStructureDocument(
            documentForCells([
                { x: 5, y: 8, spaceKind: 'interior' },
                { x: 4, y: 8, spaceKind: 'interior' },
                { x: 4, y: 7, spaceKind: 'interior' },
            ]),
        );

        assert.deepEqual(normalized.footprint.cells, [
            { x: 0, y: 0, spaceKind: 'interior' },
            { x: 0, y: 1, spaceKind: 'interior' },
            { x: 1, y: 1, spaceKind: 'interior' },
        ]);
        assert.deepEqual(
            getGardenStructureFootprintBounds(normalized.footprint.cells),
            { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 2, depth: 2 },
        );
    });

    test('returns to the same normalized document after four quarter turns', () => {
        const original = createGardenStructureTemplateSeed('house').document;
        const rotated = rotateGardenStructureDocument(
            rotateGardenStructureDocument(
                rotateGardenStructureDocument(
                    rotateGardenStructureDocument(original, 1),
                    1,
                ),
                1,
            ),
            1,
        );

        assert.deepEqual(rotated, original);
    });

    test('maps local y to the second horizontal world-grid axis', () => {
        const worldCells = getGardenStructureWorldFootprintCells(
            documentForCells(rectangleCells(2, 1)),
            { anchorX: 10, anchorY: -3, rotation: 1 },
        );

        assert.deepEqual(
            worldCells.map(({ x, y }) => ({ x, y })),
            [
                { x: 10, y: -3 },
                { x: 10, y: -2 },
            ],
        );
    });

    test('compares normalized footprint coordinates independent of order', () => {
        assert.equal(
            gardenStructureFootprintsEqual(
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                [
                    { x: 1, y: 0 },
                    { x: 0, y: 0 },
                ],
            ),
            true,
        );
        assert.equal(
            gardenStructureFootprintsEqual(
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                ],
            ),
            false,
        );
        assert.equal(
            gardenStructureFootprintsEqual(
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                ],
                [
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                ],
            ),
            false,
        );
    });

    test('normalizes Unicode identifiers with locale-independent code-unit order', () => {
        const document = documentForCells(rectangleCells(2, 1));
        const normalized = normalizeGardenStructureDocument({
            ...document,
            props: [
                {
                    id: 'ä-part',
                    partId: 'prop.table',
                    x: 0,
                    y: 0,
                    rotation: 0,
                },
                {
                    id: 'z-part',
                    partId: 'prop.table',
                    x: 1,
                    y: 0,
                    rotation: 0,
                },
            ],
        });

        assert.deepEqual(
            normalized.props.map((prop) => prop.id),
            ['z-part', 'ä-part'],
        );
    });
});

describe('garden structure templates', () => {
    const templateKeys: readonly GardenStructureTemplateKey[] = [
        'barn',
        'house',
        'greenhouse',
        'blank',
    ];

    test('expands every starter template through the same contract', () => {
        for (const templateKey of templateKeys) {
            const seed = createGardenStructureTemplateSeed(templateKey);
            const result = validateGardenStructureDocument(seed.document);
            assert.equal(result.valid, true, templateKey);
            assert.equal(seed.kitKey, 'gredice-buildings');
            assert.equal(seed.kitVersion, '1');
        }
    });

    test('keeps the house porch roofed, open, floorless, and billable', () => {
        const house = createGardenStructureTemplateSeed('house').document;
        const porchCells = house.footprint.cells.filter(
            (cell) => cell.spaceKind === 'covered-outdoor',
        );
        const floorKeys = new Set(
            house.floors.map(
                (floor) =>
                    `${floor.cell.x.toString()}|${floor.cell.y.toString()}`,
            ),
        );
        const roofKeys = new Set(
            house.roofRegions.flatMap((region) =>
                region.cells.map(
                    (cell) => `${cell.x.toString()}|${cell.y.toString()}`,
                ),
            ),
        );

        assert.equal(porchCells.length, 3);
        for (const cell of porchCells) {
            const key = `${cell.x.toString()}|${cell.y.toString()}`;
            assert.equal(floorKeys.has(key), false);
            assert.equal(roofKeys.has(key), true);
        }
        assert.equal(
            getGardenStructureDocumentPrice(house),
            house.footprint.cells.length * gardenStructureSunflowerPricePerCell,
        );
        assert.ok(
            house.edges.some(
                (edge) => edge.id === 'partition-door' && edge.kind === 'door',
            ),
        );
        assert.equal(
            house.edges.filter((edge) => edge.id.startsWith('partition-wall-'))
                .length,
            2,
        );
    });
});

describe('garden structure pricing', () => {
    test('prices footprint cells at the fixed version 1 rate', () => {
        assert.equal(getGardenStructureFootprintPrice(1), 50);
        assert.equal(getGardenStructureFootprintPrice(25), 1_250);
        assert.equal(getGardenStructureFootprintPrice(100), 5_000);
    });

    test('debits expansion and adds it to refundable principal', () => {
        assert.deepEqual(
            calculateGardenStructurePriceDelta({
                persistedCellCount: 4,
                candidateCellCount: 7,
                refundablePrincipal: 200,
            }),
            {
                cellDelta: 3,
                debit: 150,
                refund: 0,
                nextRefundablePrincipal: 350,
            },
        );
    });

    test('bounds shrink and demolition refunds by paid principal', () => {
        assert.deepEqual(
            calculateGardenStructurePriceDelta({
                persistedCellCount: 10,
                candidateCellCount: 5,
                refundablePrincipal: 120,
            }),
            {
                cellDelta: -5,
                debit: 0,
                refund: 120,
                nextRefundablePrincipal: 0,
            },
        );
        assert.deepEqual(
            calculateGardenStructurePriceDelta({
                persistedCellCount: 5,
                candidateCellCount: 0,
                refundablePrincipal: 250,
            }),
            {
                cellDelta: -5,
                debit: 0,
                refund: 250,
                nextRefundablePrincipal: 0,
            },
        );
    });

    test('keeps equal-area reshapes and complimentary records currency-free', () => {
        assert.deepEqual(
            calculateGardenStructurePriceDelta({
                persistedCellCount: 8,
                candidateCellCount: 8,
                refundablePrincipal: 400,
            }),
            {
                cellDelta: 0,
                debit: 0,
                refund: 0,
                nextRefundablePrincipal: 400,
            },
        );
        assert.deepEqual(
            calculateGardenStructurePriceDelta({
                persistedCellCount: 8,
                candidateCellCount: 3,
                refundablePrincipal: 0,
            }),
            {
                cellDelta: -5,
                debit: 0,
                refund: 0,
                nextRefundablePrincipal: 0,
            },
        );
    });

    test('rejects invalid principal and count inputs', () => {
        assert.throws(
            () =>
                calculateGardenStructurePriceDelta({
                    persistedCellCount: 2,
                    candidateCellCount: 1,
                    refundablePrincipal: 101,
                }),
            /exceeds the persisted footprint value/u,
        );
        assert.throws(() => getGardenStructureFootprintPrice(-1), RangeError);
        assert.throws(
            () => getGardenStructureFootprintPrice(Number.MAX_SAFE_INTEGER, 2),
            RangeError,
        );
    });
});
