import type {
    GardenStructureCoordinate,
    GardenStructureDocumentV1,
    GardenStructureEdge,
    GardenStructureFootprintBounds,
    GardenStructureFootprintCell,
    GardenStructurePlacement,
    GardenStructureRotation,
} from './types';

export function gardenStructureCellKey(coordinate: GardenStructureCoordinate) {
    return `${coordinate.x}|${coordinate.y}`;
}

export function gardenStructureEdgeKey(edge: {
    from: GardenStructureCoordinate;
    direction: GardenStructureEdge['direction'];
}) {
    return `${gardenStructureCellKey(edge.from)}|${edge.direction}`;
}

export function getGardenStructureFootprintBounds(
    cells: readonly GardenStructureCoordinate[],
): GardenStructureFootprintBounds | null {
    const first = cells[0];
    if (!first) {
        return null;
    }

    let minX = first.x;
    let minY = first.y;
    let maxX = first.x;
    let maxY = first.y;

    for (const cell of cells.slice(1)) {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x);
        maxY = Math.max(maxY, cell.y);
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        depth: maxY - minY + 1,
    };
}

export function isGardenStructureFootprintConnected(
    cells: readonly GardenStructureCoordinate[],
) {
    const first = cells[0];
    if (!first) {
        return false;
    }

    const remaining = new Set(cells.map(gardenStructureCellKey));
    const queue = [first];
    remaining.delete(gardenStructureCellKey(first));

    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        if (!current) {
            continue;
        }

        for (const neighbor of [
            { x: current.x - 1, y: current.y },
            { x: current.x + 1, y: current.y },
            { x: current.x, y: current.y - 1 },
            { x: current.x, y: current.y + 1 },
        ]) {
            const key = gardenStructureCellKey(neighbor);
            if (!remaining.delete(key)) {
                continue;
            }
            queue.push(neighbor);
        }
    }

    return remaining.size === 0;
}

export function gardenStructureFootprintsEqual(
    left: readonly GardenStructureCoordinate[],
    right: readonly GardenStructureCoordinate[],
) {
    if (left.length !== right.length) {
        return false;
    }

    const leftKeys = new Set(left.map(gardenStructureCellKey));
    const rightKeys = new Set(right.map(gardenStructureCellKey));
    return (
        leftKeys.size === left.length &&
        rightKeys.size === right.length &&
        rightKeys.size === leftKeys.size &&
        [...rightKeys].every((key) => leftKeys.has(key))
    );
}

export function normalizeGardenStructureRotation(
    rotation: number,
): GardenStructureRotation {
    const normalized = ((Math.round(rotation) % 4) + 4) % 4;
    switch (normalized) {
        case 0:
            return 0;
        case 1:
            return 1;
        case 2:
            return 2;
        default:
            return 3;
    }
}

export function rotateGardenStructureCoordinate(
    coordinate: GardenStructureCoordinate,
    rotation: GardenStructureRotation,
): GardenStructureCoordinate {
    switch (rotation) {
        case 0:
            return coordinate;
        case 1:
            return { x: -coordinate.y, y: coordinate.x };
        case 2:
            return { x: -coordinate.x, y: -coordinate.y };
        case 3:
            return { x: coordinate.y, y: -coordinate.x };
    }
}

function rotateEdgeOnce(edge: GardenStructureEdge): GardenStructureEdge {
    const from = rotateGardenStructureCoordinate(edge.from, 1);

    if (edge.direction === 'north') {
        return { ...edge, from, direction: 'east' };
    }

    return {
        ...edge,
        from: { x: from.x, y: from.y + 1 },
        direction: 'north',
    };
}

function rotateEdge(
    edge: GardenStructureEdge,
    rotation: GardenStructureRotation,
) {
    let rotated = edge;
    for (let index = 0; index < rotation; index++) {
        rotated = rotateEdgeOnce(rotated);
    }
    return rotated;
}

function compareCoordinates(
    left: GardenStructureCoordinate,
    right: GardenStructureCoordinate,
) {
    return left.y - right.y || left.x - right.x;
}

function compareIdentifiers(left: string, right: string) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function shiftCoordinate(
    coordinate: GardenStructureCoordinate,
    offset: GardenStructureCoordinate,
) {
    return {
        x: coordinate.x + offset.x,
        y: coordinate.y + offset.y,
    };
}

export function normalizeGardenStructureDocument(
    document: GardenStructureDocumentV1,
): GardenStructureDocumentV1 {
    const bounds = getGardenStructureFootprintBounds(document.footprint.cells);
    const offset = bounds
        ? { x: -bounds.minX, y: -bounds.minY }
        : { x: 0, y: 0 };

    return {
        ...document,
        footprint: {
            cells: document.footprint.cells
                .map((cell) => ({ ...cell, ...shiftCoordinate(cell, offset) }))
                .sort(compareCoordinates),
        },
        floors: document.floors
            .map((floor) => ({
                ...floor,
                cell: shiftCoordinate(floor.cell, offset),
            }))
            .sort((left, right) => compareCoordinates(left.cell, right.cell)),
        edges: document.edges
            .map((edge) => ({
                ...edge,
                from: shiftCoordinate(edge.from, offset),
            }))
            .sort(
                (left, right) =>
                    compareCoordinates(left.from, right.from) ||
                    compareIdentifiers(left.direction, right.direction) ||
                    compareIdentifiers(left.id, right.id),
            ),
        roofRegions: document.roofRegions
            .map((region) => ({
                ...region,
                cells: region.cells
                    .map((cell) => shiftCoordinate(cell, offset))
                    .sort(compareCoordinates),
            }))
            .sort((left, right) => compareIdentifiers(left.id, right.id)),
        props: document.props
            .map((prop) => ({
                ...prop,
                x: prop.x + offset.x,
                y: prop.y + offset.y,
            }))
            .sort((left, right) => compareIdentifiers(left.id, right.id)),
    };
}

export function rotateGardenStructureDocument(
    document: GardenStructureDocumentV1,
    rotation: GardenStructureRotation,
): GardenStructureDocumentV1 {
    if (rotation === 0) {
        return normalizeGardenStructureDocument(document);
    }

    return normalizeGardenStructureDocument({
        ...document,
        footprint: {
            cells: document.footprint.cells.map((cell) => ({
                ...cell,
                ...rotateGardenStructureCoordinate(cell, rotation),
            })),
        },
        floors: document.floors.map((floor) => ({
            ...floor,
            cell: rotateGardenStructureCoordinate(floor.cell, rotation),
        })),
        edges: document.edges.map((edge) => rotateEdge(edge, rotation)),
        roofRegions: document.roofRegions.map((region) => ({
            ...region,
            cells: region.cells.map((cell) =>
                rotateGardenStructureCoordinate(cell, rotation),
            ),
            rotation: normalizeGardenStructureRotation(
                region.rotation + rotation,
            ),
        })),
        props: document.props.map((prop) => {
            const coordinate = rotateGardenStructureCoordinate(prop, rotation);
            return {
                ...prop,
                ...coordinate,
                rotation: normalizeGardenStructureRotation(
                    prop.rotation + rotation,
                ),
            };
        }),
    });
}

export function getGardenStructureWorldFootprintCells(
    document: GardenStructureDocumentV1,
    placement: GardenStructurePlacement,
): readonly GardenStructureFootprintCell[] {
    const rotated = rotateGardenStructureDocument(document, placement.rotation);

    return rotated.footprint.cells.map((cell) => ({
        ...cell,
        x: cell.x + placement.anchorX,
        y: cell.y + placement.anchorY,
    }));
}

export function getGardenStructureAdjacentCells(
    edge: Pick<GardenStructureEdge, 'from' | 'direction'>,
): readonly [GardenStructureCoordinate, GardenStructureCoordinate] {
    if (edge.direction === 'north') {
        return [edge.from, { x: edge.from.x, y: edge.from.y - 1 }];
    }

    return [edge.from, { x: edge.from.x + 1, y: edge.from.y }];
}

export function getGardenStructurePerimeterEdgeKeys(
    cell: GardenStructureCoordinate,
) {
    return {
        north: gardenStructureEdgeKey({ from: cell, direction: 'north' }),
        east: gardenStructureEdgeKey({ from: cell, direction: 'east' }),
        south: gardenStructureEdgeKey({
            from: { x: cell.x, y: cell.y + 1 },
            direction: 'north',
        }),
        west: gardenStructureEdgeKey({
            from: { x: cell.x - 1, y: cell.y },
            direction: 'east',
        }),
    };
}
