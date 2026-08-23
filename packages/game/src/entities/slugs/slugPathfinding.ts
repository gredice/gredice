export type SlugPathCell = {
    id: string;
    moisture: number;
    x: number;
    y: number;
    z: number;
};

export type SlugPathResult = {
    distance: number;
    points: SlugPathCell[];
    status: 'path' | 'same-cell' | 'unreachable';
    visitedCellCount: number;
};

type SearchNode = {
    cell: SlugPathCell;
    costFromStart: number;
    estimatedTotalCost: number;
    previousKey: string | null;
};

const maxVisitedCells = 256;
const cardinalDirections = [
    { cost: 1, x: 1, z: 0 },
    { cost: 1, x: -1, z: 0 },
    { cost: 1, x: 0, z: 1 },
    { cost: 1, x: 0, z: -1 },
];
const diagonalDirections = [
    { cost: Math.SQRT2, x: 1, z: 1 },
    { cost: Math.SQRT2, x: 1, z: -1 },
    { cost: Math.SQRT2, x: -1, z: 1 },
    { cost: Math.SQRT2, x: -1, z: -1 },
];

function cellKey(cell: Pick<SlugPathCell, 'x' | 'z'>) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

function horizontalDistance(
    left: Pick<SlugPathCell, 'x' | 'z'>,
    right: Pick<SlugPathCell, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function canTraverseDiagonal({
    cell,
    direction,
    habitatByKey,
}: {
    cell: SlugPathCell;
    direction: (typeof diagonalDirections)[number];
    habitatByKey: Map<string, SlugPathCell>;
}) {
    return (
        habitatByKey.has(cellKey({ x: cell.x + direction.x, z: cell.z })) &&
        habitatByKey.has(cellKey({ x: cell.x, z: cell.z + direction.z }))
    );
}

function reconstructPath(
    finalNode: SearchNode,
    nodesByKey: Map<string, SearchNode>,
) {
    const points: SlugPathCell[] = [];
    let node: SearchNode | undefined = finalNode;

    while (node) {
        points.push(node.cell);
        node = node.previousKey ? nodesByKey.get(node.previousKey) : undefined;
    }

    return points.reverse();
}

export function findSlugPath({
    habitat,
    start,
    target,
}: {
    habitat: SlugPathCell[];
    start: Pick<SlugPathCell, 'x' | 'z'>;
    target: Pick<SlugPathCell, 'x' | 'z'>;
}): SlugPathResult {
    const habitatByKey = new Map(
        habitat.map((cell) => [cellKey(cell), cell] as const),
    );
    const startKey = cellKey(start);
    const targetKey = cellKey(target);
    const startCell = habitatByKey.get(startKey);
    const targetCell = habitatByKey.get(targetKey);

    if (!startCell || !targetCell) {
        return {
            distance: 0,
            points: [],
            status: 'unreachable',
            visitedCellCount: 0,
        };
    }
    if (startKey === targetKey) {
        return {
            distance: 0,
            points: [startCell],
            status: 'same-cell',
            visitedCellCount: 1,
        };
    }

    const startNode: SearchNode = {
        cell: startCell,
        costFromStart: 0,
        estimatedTotalCost: horizontalDistance(startCell, targetCell),
        previousKey: null,
    };
    const nodesByKey = new Map([[startKey, startNode]]);
    const open = [startNode];
    const closed = new Set<string>();

    while (open.length > 0 && closed.size < maxVisitedCells) {
        open.sort(
            (left, right) =>
                left.estimatedTotalCost - right.estimatedTotalCost ||
                cellKey(left.cell).localeCompare(cellKey(right.cell)),
        );
        const current = open.shift();
        if (!current) {
            break;
        }
        const currentKey = cellKey(current.cell);
        if (closed.has(currentKey)) {
            continue;
        }
        closed.add(currentKey);

        if (currentKey === targetKey) {
            const points = reconstructPath(current, nodesByKey);
            return {
                distance: points.reduce((total, point, index) => {
                    const previous = points[index - 1];
                    return previous
                        ? total + horizontalDistance(previous, point)
                        : total;
                }, 0),
                points,
                status: 'path',
                visitedCellCount: closed.size,
            };
        }

        for (const direction of [
            ...cardinalDirections,
            ...diagonalDirections,
        ]) {
            if (
                Math.abs(direction.x) === 1 &&
                Math.abs(direction.z) === 1 &&
                !canTraverseDiagonal({
                    cell: current.cell,
                    direction,
                    habitatByKey,
                })
            ) {
                continue;
            }
            const nextKey = cellKey({
                x: current.cell.x + direction.x,
                z: current.cell.z + direction.z,
            });
            const nextCell = habitatByKey.get(nextKey);
            if (!nextCell || closed.has(nextKey)) {
                continue;
            }
            const moisturePreferenceCost = (1 - nextCell.moisture) * 0.12;
            const nextCost =
                current.costFromStart + direction.cost + moisturePreferenceCost;
            const existing = nodesByKey.get(nextKey);
            if (existing && existing.costFromStart <= nextCost) {
                continue;
            }
            const nextNode: SearchNode = {
                cell: nextCell,
                costFromStart: nextCost,
                estimatedTotalCost:
                    nextCost + horizontalDistance(nextCell, targetCell),
                previousKey: currentKey,
            };
            nodesByKey.set(nextKey, nextNode);
            open.push(nextNode);
        }
    }

    return {
        distance: 0,
        points: [],
        status: 'unreachable',
        visitedCellCount: closed.size,
    };
}
