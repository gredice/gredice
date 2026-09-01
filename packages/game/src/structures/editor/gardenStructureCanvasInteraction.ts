import type {
    GardenStructureCoordinate,
    GardenStructureDocumentV1,
    GardenStructurePlacement,
    GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import {
    gardenStructureCellKey,
    gardenStructureEdgeKey,
    gardenStructureMaxCoordinateMagnitude,
    getGardenStructureAdjacentCells,
    getGardenStructureFootprintBounds,
    rotateGardenStructureCoordinate,
} from '@gredice/js/gardenStructures';
import {
    type GardenStructureCanonicalEdge,
    type GardenStructureCellSide,
    getCanonicalGardenStructureEdge,
} from './gardenStructureDocumentEdits';

const sides = ['N', 'E', 'S', 'W'] satisfies readonly GardenStructureCellSide[];

export type GardenStructureCanvasEdge = Readonly<{
    cell: GardenStructureCoordinate;
    side: GardenStructureCellSide;
}>;

export type GardenStructureCanvasEdgeChainFailureReason =
    | 'not-collinear'
    | 'outside-footprint';

export type GardenStructureCanvasEdgeChainResult =
    | Readonly<{
          ok: true;
          edges: readonly GardenStructureCanvasEdge[];
      }>
    | Readonly<{
          ok: false;
          reason: GardenStructureCanvasEdgeChainFailureReason;
      }>;

function normalizedInverseRotation(rotation: GardenStructureRotation) {
    switch (rotation) {
        case 0:
            return 0;
        case 1:
            return 3;
        case 2:
            return 2;
        case 3:
            return 1;
    }
}

function withoutNegativeZero(value: number) {
    return Object.is(value, -0) ? 0 : value;
}

function rotatedFootprintMinimum(
    document: GardenStructureDocumentV1,
    rotation: GardenStructureRotation,
) {
    const bounds = getGardenStructureFootprintBounds(
        document.footprint.cells.map((cell) =>
            rotateGardenStructureCoordinate(cell, rotation),
        ),
    );
    return bounds ? { x: bounds.minX, y: bounds.minY } : null;
}

/** Maps a world-grid cell back to the canonical local document coordinate. */
export function gardenStructureWorldCellToLocal({
    document,
    placement,
    world,
}: {
    document: GardenStructureDocumentV1;
    placement: GardenStructurePlacement;
    world: GardenStructureCoordinate;
}): GardenStructureCoordinate | null {
    const minimum = rotatedFootprintMinimum(document, placement.rotation);
    if (!minimum) {
        return null;
    }
    const local = rotateGardenStructureCoordinate(
        {
            x: world.x - placement.anchorX + minimum.x,
            y: world.y - placement.anchorY + minimum.y,
        },
        normalizedInverseRotation(placement.rotation),
    );
    return {
        x: withoutNegativeZero(local.x),
        y: withoutNegativeZero(local.y),
    };
}

/** Maps a local point (integer or fractional) to the horizontal world plane. */
export function gardenStructureLocalPointToWorld({
    document,
    local,
    placement,
}: {
    document: GardenStructureDocumentV1;
    local: GardenStructureCoordinate;
    placement: GardenStructurePlacement;
}): GardenStructureCoordinate | null {
    const minimum = rotatedFootprintMinimum(document, placement.rotation);
    if (!minimum) {
        return null;
    }
    const rotated = rotateGardenStructureCoordinate(local, placement.rotation);
    return {
        x: withoutNegativeZero(rotated.x - minimum.x + placement.anchorX),
        y: withoutNegativeZero(rotated.y - minimum.y + placement.anchorY),
    };
}

function rotatedSide(
    side: GardenStructureCellSide,
    quarterTurns: GardenStructureRotation,
) {
    const index = sides.indexOf(side);
    return sides[(index + quarterTurns) % sides.length] ?? side;
}

function oppositeSide(side: GardenStructureCellSide) {
    return rotatedSide(side, 2);
}

function adjacentWorldCell(
    cell: GardenStructureCoordinate,
    side: GardenStructureCellSide,
) {
    switch (side) {
        case 'N':
            return { x: cell.x, y: cell.y - 1 };
        case 'E':
            return { x: cell.x + 1, y: cell.y };
        case 'S':
            return { x: cell.x, y: cell.y + 1 };
        case 'W':
            return { x: cell.x - 1, y: cell.y };
    }
}

function footprintContains(
    document: GardenStructureDocumentV1,
    cell: GardenStructureCoordinate,
) {
    const key = gardenStructureCellKey(cell);
    return document.footprint.cells.some(
        (candidate) => gardenStructureCellKey(candidate) === key,
    );
}

/** Resolves the nearest editable local edge from a horizontal world point. */
export function getGardenStructureCanvasEdgeAtWorldPoint({
    document,
    placement,
    world,
}: {
    document: GardenStructureDocumentV1;
    placement: GardenStructurePlacement;
    world: GardenStructureCoordinate;
}): GardenStructureCanvasEdge | null {
    const worldCell = { x: Math.round(world.x), y: Math.round(world.y) };
    const offsetX = world.x - worldCell.x;
    const offsetY = world.y - worldCell.y;
    const worldSide: GardenStructureCellSide =
        Math.abs(offsetX) > Math.abs(offsetY)
            ? offsetX < 0
                ? 'W'
                : 'E'
            : offsetY < 0
              ? 'N'
              : 'S';
    const localCell = gardenStructureWorldCellToLocal({
        document,
        placement,
        world: worldCell,
    });
    const localSide = rotatedSide(
        worldSide,
        normalizedInverseRotation(placement.rotation),
    );
    if (localCell && footprintContains(document, localCell)) {
        return { cell: localCell, side: localSide };
    }

    const neighbor = adjacentWorldCell(worldCell, worldSide);
    const localNeighbor = gardenStructureWorldCellToLocal({
        document,
        placement,
        world: neighbor,
    });
    return localNeighbor && footprintContains(document, localNeighbor)
        ? { cell: localNeighbor, side: oppositeSide(localSide) }
        : null;
}

export function getGardenStructureCanvasEdgeWorldMidpoint({
    document,
    edge,
    placement,
}: {
    document: GardenStructureDocumentV1;
    edge: GardenStructureCanvasEdge;
    placement: GardenStructurePlacement;
}) {
    const offset: Readonly<Record<GardenStructureCellSide, [number, number]>> =
        {
            N: [0, -0.5],
            E: [0.5, 0],
            S: [0, 0.5],
            W: [-0.5, 0],
        };
    const [x, y] = offset[edge.side];
    return gardenStructureLocalPointToWorld({
        document,
        local: { x: edge.cell.x + x, y: edge.cell.y + y },
        placement,
    });
}

/** Integer Bresenham path used to coalesce fast pointer movement. */
export function getCoalescedGardenStructureGridStroke(
    from: GardenStructureCoordinate,
    to: GardenStructureCoordinate,
) {
    if (
        !Number.isSafeInteger(from.x) ||
        !Number.isSafeInteger(from.y) ||
        !Number.isSafeInteger(to.x) ||
        !Number.isSafeInteger(to.y) ||
        Math.abs(from.x) > gardenStructureMaxCoordinateMagnitude ||
        Math.abs(from.y) > gardenStructureMaxCoordinateMagnitude ||
        Math.abs(to.x) > gardenStructureMaxCoordinateMagnitude ||
        Math.abs(to.y) > gardenStructureMaxCoordinateMagnitude
    ) {
        return [];
    }
    const cells: GardenStructureCoordinate[] = [];
    let x = from.x;
    let y = from.y;
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);
    const stepX = from.x < to.x ? 1 : -1;
    const stepY = from.y < to.y ? 1 : -1;
    let error = deltaX - deltaY;
    const maximumCellCount = Math.max(deltaX, deltaY) + 1;

    for (let cellIndex = 0; cellIndex < maximumCellCount; cellIndex += 1) {
        cells.push({ x, y });
        if (x === to.x && y === to.y) {
            return cells;
        }
        const doubledError = error * 2;
        if (doubledError > -deltaY) {
            error -= deltaY;
            x += stepX;
        }
        if (doubledError < deltaX) {
            error += deltaX;
            y += stepY;
        }
    }
    return [];
}

function canvasEdgeFromCanonical(
    document: GardenStructureDocumentV1,
    edge: GardenStructureCanonicalEdge,
): GardenStructureCanvasEdge | null {
    const [first, second] = getGardenStructureAdjacentCells(edge);
    if (footprintContains(document, first)) {
        return {
            cell: first,
            side: edge.direction === 'north' ? 'N' : 'E',
        };
    }
    if (!footprintContains(document, second)) {
        return null;
    }
    return {
        cell: second,
        side: edge.direction === 'north' ? 'S' : 'W',
    };
}

/** Builds one inclusive, orthogonal edge chain with no gaps outside footprint. */
export function getGardenStructureCanvasEdgeChain(
    document: GardenStructureDocumentV1,
    start: GardenStructureCanvasEdge,
    end: GardenStructureCanvasEdge,
): GardenStructureCanvasEdgeChainResult {
    const canonicalStart = getCanonicalGardenStructureEdge(
        start.cell,
        start.side,
    );
    const canonicalEnd = getCanonicalGardenStructureEdge(end.cell, end.side);
    if (
        canonicalStart.direction !== canonicalEnd.direction ||
        (canonicalStart.direction === 'north' &&
            canonicalStart.from.y !== canonicalEnd.from.y) ||
        (canonicalStart.direction === 'east' &&
            canonicalStart.from.x !== canonicalEnd.from.x)
    ) {
        return { ok: false, reason: 'not-collinear' };
    }

    const canonicalEdges: GardenStructureCanonicalEdge[] = [];
    if (canonicalStart.direction === 'north') {
        const minimum = Math.min(canonicalStart.from.x, canonicalEnd.from.x);
        const maximum = Math.max(canonicalStart.from.x, canonicalEnd.from.x);
        for (let x = minimum; x <= maximum; x += 1) {
            canonicalEdges.push({
                direction: 'north',
                from: { x, y: canonicalStart.from.y },
            });
        }
    } else {
        const minimum = Math.min(canonicalStart.from.y, canonicalEnd.from.y);
        const maximum = Math.max(canonicalStart.from.y, canonicalEnd.from.y);
        for (let y = minimum; y <= maximum; y += 1) {
            canonicalEdges.push({
                direction: 'east',
                from: { x: canonicalStart.from.x, y },
            });
        }
    }

    const resolved = canonicalEdges.map((edge) =>
        canvasEdgeFromCanonical(document, edge),
    );
    if (resolved.some((edge) => edge === null)) {
        return { ok: false, reason: 'outside-footprint' };
    }
    return {
        ok: true,
        edges: resolved.filter(
            (edge): edge is GardenStructureCanvasEdge => edge !== null,
        ),
    };
}

export function getGardenStructureCanvasEditableEdges(
    document: GardenStructureDocumentV1,
) {
    const byKey = new Map<string, GardenStructureCanvasEdge>();
    for (const cell of document.footprint.cells) {
        for (const side of sides) {
            const edge = { cell: { x: cell.x, y: cell.y }, side };
            const key = gardenStructureEdgeKey(
                getCanonicalGardenStructureEdge(edge.cell, edge.side),
            );
            if (!byKey.has(key)) {
                byKey.set(key, edge);
            }
        }
    }
    return [...byKey.values()];
}
