import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureDocumentV1,
    type GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureOverview2DSummaries,
    getGardenStructureOverview3DHref,
} from './gardenStructureOverview2D';

function structureRecord({
    document = createGardenStructureTemplateSeed('house').document,
    id = 'structure-1',
    rotation = 0,
    templateKey = 'house',
}: {
    document?: GardenStructureDocumentV1 | unknown;
    id?: string;
    rotation?: number;
    templateKey?: GardenStructureTemplateKey;
} = {}) {
    return {
        anchorX: 7,
        anchorY: -4,
        document,
        id,
        isDeleted: false,
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        revision: 3,
        rotation,
        templateKey,
    };
}

function openDocument(
    cells: GardenStructureDocumentV1['footprint']['cells'],
    roofCells: readonly { x: number; y: number }[] = [],
): GardenStructureDocumentV1 {
    return {
        schemaVersion: 1,
        footprint: { cells },
        floors: [],
        edges: [],
        roofRegions:
            roofCells.length > 0
                ? [
                      {
                          id: 'roof-main',
                          cells: roofCells,
                          styleId: 'roof.shed',
                          materialId: 'roof.clay',
                          rotation: 0,
                      },
                  ]
                : [],
        props: [],
    };
}

function coordinateKeys(cells: readonly Readonly<{ x: number; y: number }>[]) {
    return cells.map((cell) => `${cell.x.toString()}:${cell.y.toString()}`);
}

test('rotates an asymmetric footprint exactly and keeps world anchors deterministic', () => {
    const document = openDocument([
        { x: 0, y: 0, spaceKind: 'interior' },
        { x: 0, y: 1, spaceKind: 'interior' },
        { x: 0, y: 2, spaceKind: 'interior' },
        { x: 1, y: 2, spaceKind: 'interior' },
    ]);
    const [summary] = createGardenStructureOverview2DSummaries([
        structureRecord({ document, rotation: 1 }),
    ]);

    assert.ok(summary);
    assert.equal(summary.width, 3);
    assert.equal(summary.depth, 2);
    assert.deepEqual(coordinateKeys(summary.cells), [
        '0:0',
        '1:0',
        '2:0',
        '0:1',
    ]);
    assert.deepEqual(
        summary.cells.map(({ worldX, worldY }) => [worldX, worldY]),
        [
            [7, -4],
            [8, -4],
            [9, -4],
            [7, -3],
        ],
    );
});

test('preserves visible gaps in connected L and U footprints', () => {
    const lDocument = openDocument([
        { x: 0, y: 0, spaceKind: 'interior' },
        { x: 0, y: 1, spaceKind: 'interior' },
        { x: 0, y: 2, spaceKind: 'interior' },
        { x: 1, y: 2, spaceKind: 'interior' },
    ]);
    const uDocument = openDocument([
        { x: 0, y: 0, spaceKind: 'interior' },
        { x: 2, y: 0, spaceKind: 'interior' },
        { x: 0, y: 1, spaceKind: 'interior' },
        { x: 2, y: 1, spaceKind: 'interior' },
        { x: 0, y: 2, spaceKind: 'interior' },
        { x: 1, y: 2, spaceKind: 'interior' },
        { x: 2, y: 2, spaceKind: 'interior' },
    ]);
    const summaries = createGardenStructureOverview2DSummaries([
        structureRecord({ document: uDocument, id: 'u-shape' }),
        structureRecord({ document: lDocument, id: 'l-shape' }),
    ]);

    const [lShape, uShape] = summaries;
    assert.ok(lShape);
    assert.ok(uShape);
    assert.deepEqual(coordinateKeys(lShape.cells), [
        '0:0',
        '0:1',
        '0:2',
        '1:2',
    ]);
    assert.deepEqual(coordinateKeys(uShape.cells), [
        '0:0',
        '2:0',
        '0:1',
        '2:1',
        '0:2',
        '1:2',
        '2:2',
    ]);
    assert.equal(
        uShape.cells.some((cell) => cell.x === 1 && cell.y === 0),
        false,
    );
    assert.equal(
        uShape.cells.some((cell) => cell.x === 1 && cell.y === 1),
        false,
    );
});

test('describes a roof-only covered-outdoor porch without inventing a floor', () => {
    const house = createGardenStructureTemplateSeed('house');
    const [summary] = createGardenStructureOverview2DSummaries([
        structureRecord({ document: house.document }),
    ]);

    assert.ok(summary);
    const porchCells = summary.cells.filter(
        (cell) => cell.spaceKind === 'covered-outdoor',
    );
    assert.equal(porchCells.length, 3);
    assert.ok(porchCells.every((cell) => cell.roofed));
    assert.ok(porchCells.every((cell) => !cell.hasFloor));
    assert.equal(summary.interiorCellCount, 9);
    assert.equal(summary.coveredOutdoorCellCount, 3);
    assert.equal(summary.roofedCellCount, 12);
});

test('omits malformed, unknown-kit, deleted, and duplicate records', () => {
    const valid = structureRecord({ id: 'valid-house' });
    const summaries = createGardenStructureOverview2DSummaries([
        valid,
        { ...structureRecord({ id: 'bad-document' }), document: {} },
        { ...structureRecord({ id: 'unknown-kit' }), kitVersion: '404' },
        { ...structureRecord({ id: 'deleted' }), isDeleted: true },
        {
            ...structureRecord({ id: 'ambiguous-delete-state' }),
            deleted: true,
        },
        structureRecord({ id: 'duplicate' }),
        structureRecord({ id: 'duplicate' }),
        structureRecord({ id: 'ambiguous' }),
        { ...structureRecord({ id: 'ambiguous' }), document: {} },
        structureRecord({ id: 'bad-rotation', rotation: 4 }),
    ]);

    assert.deepEqual(
        summaries.map((summary) => summary.id),
        ['valid-house'],
    );
});

test('returns a stable empty result without processing content for gardens without structures', () => {
    const first = createGardenStructureOverview2DSummaries([]);
    const second = createGardenStructureOverview2DSummaries([]);

    assert.equal(first, second);
    assert.deepEqual(first, []);
});

test('preserves garden context plus selected structure and 2D return intent in the 3D handoff', () => {
    const href = getGardenStructureOverview3DHref(
        [
            ['gardenId', '42'],
            ['existing', 'kept'],
        ],
        'structure-7',
    );
    const url = new URL(href, 'https://vrt.gredice.com');

    assert.equal(url.pathname, '/');
    assert.equal(url.searchParams.get('gardenId'), '42');
    assert.equal(url.searchParams.get('existing'), 'kept');
    assert.equal(url.searchParams.get('gardenStructureId'), 'structure-7');
    assert.equal(url.searchParams.get('gardenStructureReturnView'), '2d');
});
