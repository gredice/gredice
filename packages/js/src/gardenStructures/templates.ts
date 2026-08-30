import {
    gardenStructureCellKey,
    gardenStructureEdgeKey,
    normalizeGardenStructureDocument,
} from './topology';
import type {
    GardenStructureDocumentV1,
    GardenStructureEdge,
    GardenStructureFootprintCell,
    GardenStructureTemplateKey,
    GardenStructureTemplateSeed,
} from './types';
import { gardenStructureSchemaVersion } from './types';

const kitKey = 'gredice-buildings';
const kitVersion = '1';

function rectangleCells(
    width: number,
    depth: number,
    spaceKind: GardenStructureFootprintCell['spaceKind'],
) {
    const cells: GardenStructureFootprintCell[] = [];
    for (let y = 0; y < depth; y++) {
        for (let x = 0; x < width; x++) {
            cells.push({ x, y, spaceKind });
        }
    }
    return cells;
}

function rectanglePerimeterEdges({
    width,
    depth,
    partId,
}: {
    width: number;
    depth: number;
    partId: string;
}) {
    const edges: GardenStructureEdge[] = [];

    for (let x = 0; x < width; x++) {
        edges.push({
            id: `edge-north-${x.toString()}`,
            from: { x, y: 0 },
            direction: 'north',
            partId,
            kind: 'wall',
        });
        edges.push({
            id: `edge-south-${x.toString()}`,
            from: { x, y: depth },
            direction: 'north',
            partId,
            kind: 'wall',
        });
    }

    for (let y = 0; y < depth; y++) {
        edges.push({
            id: `edge-west-${y.toString()}`,
            from: { x: -1, y },
            direction: 'east',
            partId,
            kind: 'wall',
        });
        edges.push({
            id: `edge-east-${y.toString()}`,
            from: { x: width - 1, y },
            direction: 'east',
            partId,
            kind: 'wall',
        });
    }

    return edges;
}

function replaceEdge(
    edges: readonly GardenStructureEdge[],
    replacement: GardenStructureEdge,
) {
    const replacementKey = gardenStructureEdgeKey(replacement);
    return edges.map((edge) =>
        gardenStructureEdgeKey(edge) === replacementKey ? replacement : edge,
    );
}

function floorCells(
    cells: readonly GardenStructureFootprintCell[],
    materialId: string,
) {
    return cells.map((cell) => ({
        cell: { x: cell.x, y: cell.y },
        materialId,
    }));
}

function barnDocument(): GardenStructureDocumentV1 {
    const cells = rectangleCells(4, 3, 'interior');
    let edges = rectanglePerimeterEdges({
        width: 4,
        depth: 3,
        partId: 'wall.timber',
    });
    edges = replaceEdge(edges, {
        id: 'door-main',
        from: { x: 1, y: 3 },
        direction: 'north',
        partId: 'door.timber-wide-open',
        kind: 'door',
    });

    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: floorCells(cells, 'floor.timber'),
        edges,
        roofRegions: [
            {
                id: 'roof-main',
                cells,
                styleId: 'roof.gable',
                materialId: 'roof.clay',
                rotation: 0,
            },
        ],
        props: [
            {
                id: 'prop-workbench',
                partId: 'prop.workbench',
                x: 0,
                y: 1,
                rotation: 1,
            },
        ],
    });
}

function houseDocument(): GardenStructureDocumentV1 {
    const interior = rectangleCells(3, 3, 'interior');
    const porch = rectangleCells(3, 1, 'covered-outdoor').map((cell) => ({
        ...cell,
        y: cell.y + 3,
    }));
    const footprint = [...interior, ...porch];
    let edges = rectanglePerimeterEdges({
        width: 3,
        depth: 3,
        partId: 'wall.plaster',
    });
    edges = replaceEdge(edges, {
        id: 'door-main',
        from: { x: 1, y: 3 },
        direction: 'north',
        partId: 'door.house-open',
        kind: 'door',
    });
    edges = replaceEdge(edges, {
        id: 'window-north',
        from: { x: 0, y: 0 },
        direction: 'north',
        partId: 'window.house',
        kind: 'window',
    });
    edges = replaceEdge(edges, {
        id: 'window-east',
        from: { x: 2, y: 1 },
        direction: 'east',
        partId: 'window.house',
        kind: 'window',
    });
    edges.push(
        {
            id: 'partition-wall-north',
            from: { x: 0, y: 0 },
            direction: 'east',
            partId: 'wall.plaster',
            kind: 'wall',
        },
        {
            id: 'partition-door',
            from: { x: 0, y: 1 },
            direction: 'east',
            partId: 'door.house-open',
            kind: 'door',
        },
        {
            id: 'partition-wall-south',
            from: { x: 0, y: 2 },
            direction: 'east',
            partId: 'wall.plaster',
            kind: 'wall',
        },
    );

    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells: footprint },
        floors: floorCells(interior, 'floor.limestone'),
        edges,
        roofRegions: [
            {
                id: 'roof-house',
                cells: interior,
                styleId: 'roof.gable',
                materialId: 'roof.clay',
                rotation: 0,
            },
            {
                id: 'roof-porch',
                cells: porch,
                styleId: 'roof.shed',
                materialId: 'roof.clay',
                rotation: 0,
            },
        ],
        props: [
            {
                id: 'prop-table',
                partId: 'prop.table',
                x: 1,
                y: 1,
                rotation: 0,
            },
        ],
    });
}

function greenhouseDocument(): GardenStructureDocumentV1 {
    const cells = rectangleCells(3, 4, 'interior');
    let edges = rectanglePerimeterEdges({
        width: 3,
        depth: 4,
        partId: 'wall.greenhouse-panel',
    });
    edges = replaceEdge(edges, {
        id: 'door-main',
        from: { x: 1, y: 4 },
        direction: 'north',
        partId: 'door.greenhouse-open',
        kind: 'door',
    });

    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: floorCells(cells, 'floor.stone'),
        edges,
        roofRegions: [
            {
                id: 'roof-main',
                cells,
                styleId: 'roof.greenhouse-gable',
                materialId: 'roof.greenhouse-panel',
                rotation: 0,
            },
        ],
        props: [
            {
                id: 'prop-planter-west',
                partId: 'prop.planter',
                x: 0,
                y: 1,
                rotation: 0,
            },
            {
                id: 'prop-planter-east',
                partId: 'prop.planter',
                x: 2,
                y: 2,
                rotation: 0,
            },
        ],
    });
}

function blankDocument(): GardenStructureDocumentV1 {
    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells: rectangleCells(2, 2, 'interior') },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    });
}

export function createGardenStructureTemplateSeed(
    templateKey: GardenStructureTemplateKey,
): GardenStructureTemplateSeed {
    let document: GardenStructureDocumentV1;
    switch (templateKey) {
        case 'barn':
            document = barnDocument();
            break;
        case 'house':
            document = houseDocument();
            break;
        case 'greenhouse':
            document = greenhouseDocument();
            break;
        case 'blank':
            document = blankDocument();
            break;
    }

    return { templateKey, kitKey, kitVersion, document };
}

export function getGardenStructureTemplateFootprintKeys(
    templateKey: GardenStructureTemplateKey,
) {
    return createGardenStructureTemplateSeed(
        templateKey,
    ).document.footprint.cells.map(gardenStructureCellKey);
}
