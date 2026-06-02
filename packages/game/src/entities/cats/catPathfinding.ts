export type CatPathCell = {
    x: number;
    z: number;
};

export type CatPathPoint = CatPathCell & {
    y: number;
};

export type CatPathSurface = CatPathPoint;

export type CatPathStatus = 'direct' | 'path' | 'fallback';

export type CatPathResult = {
    blockedCellCount: number;
    distance: number;
    points: CatPathPoint[];
    startCell: CatPathCell;
    status: CatPathStatus;
    targetCell: CatPathCell;
    visitedCellCount: number;
};

type SearchNode = {
    cell: CatPathCell;
    costFromStart: number;
    estimatedTotalCost: number;
    previousKey: string | null;
};

const diagonalCost = Math.SQRT2;
const directPathSampleStep = 0.18;
const cardinalDirections = [
    { x: 1, z: 0, cost: 1 },
    { x: -1, z: 0, cost: 1 },
    { x: 0, z: 1, cost: 1 },
    { x: 0, z: -1, cost: 1 },
];
const diagonalDirections = [
    { x: 1, z: 1, cost: diagonalCost },
    { x: 1, z: -1, cost: diagonalCost },
    { x: -1, z: 1, cost: diagonalCost },
    { x: -1, z: -1, cost: diagonalCost },
];
const searchDirections = [...cardinalDirections, ...diagonalDirections];

function cellKey(cell: CatPathCell) {
    return `${cell.x}:${cell.z}`;
}

function roundCell(point: Pick<CatPathPoint, 'x' | 'z'>): CatPathCell {
    return {
        x: Math.round(point.x),
        z: Math.round(point.z),
    };
}

function horizontalDistance(
    left: Pick<CatPathPoint, 'x' | 'z'>,
    right: Pick<CatPathPoint, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function pointDistance(left: CatPathPoint, right: CatPathPoint) {
    return horizontalDistance(left, right);
}

function pathDistance(points: CatPathPoint[]) {
    let distance = 0;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (!previous || !current) {
            continue;
        }
        distance += pointDistance(previous, current);
    }
    return distance;
}

function createSurfaceMap(
    surfaces: CatPathSurface[],
    from: CatPathPoint,
    to: CatPathPoint,
) {
    const surfaceByKey = new Map<string, CatPathSurface>();

    for (const surface of surfaces) {
        surfaceByKey.set(cellKey(roundCell(surface)), surface);
    }

    const startCell = roundCell(from);
    const targetCell = roundCell(to);
    if (!surfaceByKey.has(cellKey(startCell))) {
        surfaceByKey.set(cellKey(startCell), {
            x: startCell.x,
            y: from.y,
            z: startCell.z,
        });
    }
    if (!surfaceByKey.has(cellKey(targetCell))) {
        surfaceByKey.set(cellKey(targetCell), {
            x: targetCell.x,
            y: to.y,
            z: targetCell.z,
        });
    }

    return surfaceByKey;
}

function isSameCell(left: CatPathCell, right: CatPathCell) {
    return left.x === right.x && left.z === right.z;
}

function isTemporarilyAllowedCell(
    cell: CatPathCell,
    startCell: CatPathCell,
    targetCell: CatPathCell,
) {
    return isSameCell(cell, startCell) || isSameCell(cell, targetCell);
}

function canWalkCell({
    blockedKeys,
    cell,
    startCell,
    surfaceByKey,
    targetCell,
}: {
    blockedKeys: Set<string>;
    cell: CatPathCell;
    startCell: CatPathCell;
    surfaceByKey: Map<string, CatPathSurface>;
    targetCell: CatPathCell;
}) {
    const key = cellKey(cell);
    if (!surfaceByKey.has(key)) {
        return false;
    }

    return (
        !blockedKeys.has(key) ||
        isTemporarilyAllowedCell(cell, startCell, targetCell)
    );
}

function directPathCrossesBlockedCell({
    blockedKeys,
    from,
    startCell,
    targetCell,
    to,
}: {
    blockedKeys: Set<string>;
    from: CatPathPoint;
    startCell: CatPathCell;
    targetCell: CatPathCell;
    to: CatPathPoint;
}) {
    const distance = horizontalDistance(from, to);
    const steps = Math.max(1, Math.ceil(distance / directPathSampleStep));

    for (let step = 1; step < steps; step += 1) {
        const progress = step / steps;
        const cell = roundCell({
            x: from.x + (to.x - from.x) * progress,
            z: from.z + (to.z - from.z) * progress,
        });

        if (
            !isTemporarilyAllowedCell(cell, startCell, targetCell) &&
            blockedKeys.has(cellKey(cell))
        ) {
            return true;
        }
    }

    return false;
}

function heuristic(left: CatPathCell, right: CatPathCell) {
    const dx = Math.abs(left.x - right.x);
    const dz = Math.abs(left.z - right.z);
    const diagonal = Math.min(dx, dz);
    const straight = Math.max(dx, dz) - diagonal;
    return diagonal * diagonalCost + straight;
}

function canWalkDiagonal({
    blockedKeys,
    cell,
    direction,
    startCell,
    surfaceByKey,
    targetCell,
}: {
    blockedKeys: Set<string>;
    cell: CatPathCell;
    direction: CatPathCell;
    startCell: CatPathCell;
    surfaceByKey: Map<string, CatPathSurface>;
    targetCell: CatPathCell;
}) {
    if (direction.x === 0 || direction.z === 0) {
        return true;
    }

    return (
        canWalkCell({
            blockedKeys,
            cell: { x: cell.x + direction.x, z: cell.z },
            startCell,
            surfaceByKey,
            targetCell,
        }) &&
        canWalkCell({
            blockedKeys,
            cell: { x: cell.x, z: cell.z + direction.z },
            startCell,
            surfaceByKey,
            targetCell,
        })
    );
}

function findLowestCostOpenNode(
    openKeys: Set<string>,
    nodesByKey: Map<string, SearchNode>,
) {
    let selectedNode: SearchNode | null = null;
    let selectedKey: string | null = null;

    for (const key of openKeys) {
        const node = nodesByKey.get(key);
        if (!node) {
            continue;
        }

        if (
            !selectedNode ||
            node.estimatedTotalCost < selectedNode.estimatedTotalCost ||
            (node.estimatedTotalCost === selectedNode.estimatedTotalCost &&
                node.costFromStart < selectedNode.costFromStart)
        ) {
            selectedNode = node;
            selectedKey = key;
        }
    }

    return selectedNode && selectedKey
        ? { key: selectedKey, node: selectedNode }
        : null;
}

function reconstructPath(
    targetKey: string,
    nodesByKey: Map<string, SearchNode>,
) {
    const cells: CatPathCell[] = [];
    let currentKey: string | null = targetKey;

    while (currentKey) {
        const node = nodesByKey.get(currentKey);
        if (!node) {
            break;
        }

        cells.push(node.cell);
        currentKey = node.previousKey;
    }

    return cells.reverse();
}

function findCellPath({
    blockedKeys,
    startCell,
    surfaceByKey,
    targetCell,
}: {
    blockedKeys: Set<string>;
    startCell: CatPathCell;
    surfaceByKey: Map<string, CatPathSurface>;
    targetCell: CatPathCell;
}) {
    const startKey = cellKey(startCell);
    const targetKey = cellKey(targetCell);
    const openKeys = new Set([startKey]);
    const closedKeys = new Set<string>();
    const nodesByKey = new Map<string, SearchNode>([
        [
            startKey,
            {
                cell: startCell,
                costFromStart: 0,
                estimatedTotalCost: heuristic(startCell, targetCell),
                previousKey: null,
            },
        ],
    ]);

    while (openKeys.size > 0) {
        const current = findLowestCostOpenNode(openKeys, nodesByKey);
        if (!current) {
            break;
        }

        if (current.key === targetKey) {
            return {
                cells: reconstructPath(current.key, nodesByKey),
                visitedCellCount: closedKeys.size + 1,
            };
        }

        openKeys.delete(current.key);
        closedKeys.add(current.key);

        for (const direction of searchDirections) {
            const neighborCell = {
                x: current.node.cell.x + direction.x,
                z: current.node.cell.z + direction.z,
            };
            const neighborKey = cellKey(neighborCell);

            if (closedKeys.has(neighborKey)) {
                continue;
            }

            if (
                !canWalkCell({
                    blockedKeys,
                    cell: neighborCell,
                    startCell,
                    surfaceByKey,
                    targetCell,
                }) ||
                !canWalkDiagonal({
                    blockedKeys,
                    cell: current.node.cell,
                    direction,
                    startCell,
                    surfaceByKey,
                    targetCell,
                })
            ) {
                continue;
            }

            const candidateCost = current.node.costFromStart + direction.cost;
            const existingNode = nodesByKey.get(neighborKey);
            if (existingNode && candidateCost >= existingNode.costFromStart) {
                continue;
            }

            nodesByKey.set(neighborKey, {
                cell: neighborCell,
                costFromStart: candidateCost,
                estimatedTotalCost:
                    candidateCost + heuristic(neighborCell, targetCell),
                previousKey: current.key,
            });
            openKeys.add(neighborKey);
        }
    }

    return {
        cells: null,
        visitedCellCount: closedKeys.size,
    };
}

function simplifyCellPath(cells: CatPathCell[]) {
    if (cells.length <= 2) {
        return cells;
    }

    const simplified: CatPathCell[] = [];
    let previousDirection: CatPathCell | null = null;

    for (let index = 0; index < cells.length; index += 1) {
        const previous = cells[index - 1];
        const current = cells[index];
        const next = cells[index + 1];
        if (!current) {
            continue;
        }

        if (!previous || !next) {
            simplified.push(current);
            continue;
        }

        const direction = {
            x: Math.sign(current.x - previous.x),
            z: Math.sign(current.z - previous.z),
        };
        const nextDirection = {
            x: Math.sign(next.x - current.x),
            z: Math.sign(next.z - current.z),
        };
        if (
            !previousDirection ||
            direction.x !== previousDirection.x ||
            direction.z !== previousDirection.z ||
            direction.x !== nextDirection.x ||
            direction.z !== nextDirection.z
        ) {
            simplified.push(current);
        }
        previousDirection = direction;
    }

    return simplified;
}

function pointForCell(
    cell: CatPathCell,
    surfaceByKey: Map<string, CatPathSurface>,
) {
    const surface = surfaceByKey.get(cellKey(cell));
    return {
        x: cell.x,
        y: surface?.y ?? 0,
        z: cell.z,
    };
}

function cellsToPoints({
    cells,
    from,
    surfaceByKey,
    to,
}: {
    cells: CatPathCell[];
    from: CatPathPoint;
    surfaceByKey: Map<string, CatPathSurface>;
    to: CatPathPoint;
}) {
    const points: CatPathPoint[] = [from];
    const simplifiedCells = simplifyCellPath(cells);

    for (let index = 1; index < simplifiedCells.length - 1; index += 1) {
        const cell = simplifiedCells[index];
        if (cell) {
            points.push(pointForCell(cell, surfaceByKey));
        }
    }

    points.push(to);
    return points;
}

export function findCatPath({
    blockedCells,
    from,
    surfaces,
    to,
}: {
    blockedCells: CatPathCell[];
    from: CatPathPoint;
    surfaces: CatPathSurface[];
    to: CatPathPoint;
}): CatPathResult {
    const startCell = roundCell(from);
    const targetCell = roundCell(to);
    const surfaceByKey = createSurfaceMap(surfaces, from, to);
    const blockedKeys = new Set(blockedCells.map(cellKey));
    const blockedCellCount = blockedKeys.size;
    const directPoints = [from, to];

    if (
        isSameCell(startCell, targetCell) ||
        !directPathCrossesBlockedCell({
            blockedKeys,
            from,
            startCell,
            targetCell,
            to,
        })
    ) {
        return {
            blockedCellCount,
            distance: pathDistance(directPoints),
            points: directPoints,
            startCell,
            status: 'direct',
            targetCell,
            visitedCellCount: 0,
        };
    }

    const cellPath = findCellPath({
        blockedKeys,
        startCell,
        surfaceByKey,
        targetCell,
    });
    if (!cellPath.cells) {
        return {
            blockedCellCount,
            distance: pathDistance(directPoints),
            points: directPoints,
            startCell,
            status: 'fallback',
            targetCell,
            visitedCellCount: cellPath.visitedCellCount,
        };
    }

    const pathPoints = cellsToPoints({
        cells: cellPath.cells,
        from,
        surfaceByKey,
        to,
    });

    return {
        blockedCellCount,
        distance: pathDistance(pathPoints),
        points: pathPoints,
        startCell,
        status: 'path',
        targetCell,
        visitedCellCount: cellPath.visitedCellCount,
    };
}
