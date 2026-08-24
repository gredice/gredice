import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import { getAnimalMovementSurfaceAt } from '../animals/animalMovementTerrain';
import {
    type CatPathCell,
    type CatPathPoint,
    type CatPathResult,
    findCatPath,
} from '../cats/catPathfinding';

export type SquirrelPathCell = CatPathCell;
export type SquirrelPathPoint = CatPathPoint;
export type SquirrelPathResult = CatPathResult;

const pathValidationStep = 0.14;
const squirrelMaximumStepHeight = 0.26;

function cellKey(cell: Pick<SquirrelPathCell, 'x' | 'z'>) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

function createStrictBlockedCells({
    blockedCells,
    surfaces,
}: {
    blockedCells: SquirrelPathCell[];
    surfaces: AnimalMovementSurface[];
}) {
    const groundCells = new Set(
        surfaces
            .filter((surface) => surface.kind === 'ground')
            .map((surface) => cellKey(surface)),
    );
    const xs = surfaces.map((surface) => Math.round(surface.x));
    const zs = surfaces.map((surface) => Math.round(surface.z));
    if (xs.length === 0 || zs.length === 0) {
        return blockedCells;
    }

    const minX = Math.min(...xs) - 1;
    const maxX = Math.max(...xs) + 1;
    const minZ = Math.min(...zs) - 1;
    const maxZ = Math.max(...zs) + 1;
    const blockedByKey = new Map(
        blockedCells.map((cell) => [cellKey(cell), cell]),
    );

    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            const key = cellKey({ x, z });
            if (!groundCells.has(key)) {
                blockedByKey.set(key, { x, z });
            }
        }
    }

    return Array.from(blockedByKey.values());
}

function isPathGroundSafe({
    blockedCells,
    points,
    surfaces,
}: {
    blockedCells: SquirrelPathCell[];
    points: SquirrelPathPoint[];
    surfaces: AnimalMovementSurface[];
}) {
    const blockedKeys = new Set(blockedCells.map(cellKey));
    let previousSurfaceY: number | null = null;

    for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        if (!from || !to) {
            continue;
        }
        const distance = Math.hypot(to.x - from.x, to.z - from.z);
        const steps = Math.max(1, Math.ceil(distance / pathValidationStep));

        for (let step = 0; step <= steps; step += 1) {
            const progress = step / steps;
            const position = {
                x: from.x + (to.x - from.x) * progress,
                z: from.z + (to.z - from.z) * progress,
            };
            const surface = getAnimalMovementSurfaceAt(position, surfaces);
            if (
                surface?.kind !== 'ground' ||
                (step > 0 &&
                    step < steps &&
                    blockedKeys.has(cellKey(position))) ||
                (previousSurfaceY !== null &&
                    Math.abs(surface.y - previousSurfaceY) >
                        squirrelMaximumStepHeight)
            ) {
                return false;
            }
            previousSurfaceY = surface.y;
        }
    }

    return true;
}

function canSquirrelTraverseEdge(
    from: SquirrelPathCell,
    to: SquirrelPathCell,
    surfaces: AnimalMovementSurface[],
) {
    const fromSurface = getAnimalMovementSurfaceAt(from, surfaces);
    const toSurface = getAnimalMovementSurfaceAt(to, surfaces);
    if (fromSurface?.kind !== 'ground' || toSurface?.kind !== 'ground') {
        return false;
    }

    return isPathGroundSafe({
        blockedCells: [],
        points: [
            { ...from, y: fromSurface.y },
            { ...to, y: toSurface.y },
        ],
        surfaces,
    });
}

export function findSquirrelPath({
    blockedCells,
    from,
    surfaces,
    to,
}: {
    blockedCells: SquirrelPathCell[];
    from: SquirrelPathPoint;
    surfaces: AnimalMovementSurface[];
    to: SquirrelPathPoint;
}): SquirrelPathResult {
    const strictBlockedCells = createStrictBlockedCells({
        blockedCells,
        surfaces,
    });
    const path = findCatPath({
        blockedCells: strictBlockedCells,
        canTraverseEdge: (edgeFrom, edgeTo) =>
            canSquirrelTraverseEdge(edgeFrom, edgeTo, surfaces),
        from,
        surfaces: surfaces
            .filter((surface) => surface.kind === 'ground')
            .map(({ x, y, z }) => ({ x, y, z })),
        to,
    });

    if (
        path.status === 'unreachable' ||
        isPathGroundSafe({
            blockedCells: strictBlockedCells,
            points: path.points,
            surfaces,
        })
    ) {
        return path;
    }

    return {
        ...path,
        distance: 0,
        points: [from],
        status: 'unreachable',
    };
}
