import type { Vector3 } from 'three';
import {
    type AnimalMovementCell,
    type AnimalMovementSurface,
    getAnimalMovementSurfaceAt,
} from '../animals/animalMovementTerrain';
import {
    type CatPathCell,
    type CatPathResult,
    findCatPath,
} from '../cats/catPathfinding';

const rabbitPathSampleStep = 0.12;
const minimumFleeDistanceGain = 0.35;

export type RabbitNavigationPoint = {
    x: number;
    y: number;
    z: number;
};

function horizontalDistance(
    left: Pick<RabbitNavigationPoint, 'x' | 'z'>,
    right: Pick<RabbitNavigationPoint, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function groundCells(surfaces: AnimalMovementSurface[]): CatPathCell[] {
    return surfaces
        .filter((surface) => surface.kind === 'ground')
        .map(({ x, z }) => ({ x: Math.round(x), z: Math.round(z) }));
}

function pathStaysOnGround(
    points: RabbitNavigationPoint[],
    surfaces: AnimalMovementSurface[],
) {
    for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        if (!from || !to) {
            continue;
        }

        const distance = horizontalDistance(from, to);
        const steps = Math.max(1, Math.ceil(distance / rabbitPathSampleStep));
        for (let step = 0; step <= steps; step += 1) {
            const progress = step / steps;
            const surface = getAnimalMovementSurfaceAt(
                {
                    x: from.x + (to.x - from.x) * progress,
                    z: from.z + (to.z - from.z) * progress,
                },
                surfaces,
            );
            if (surface?.kind !== 'ground') {
                return false;
            }
        }
    }

    return true;
}

function unreachablePath(
    base: CatPathResult,
    from: RabbitNavigationPoint,
): CatPathResult {
    return {
        ...base,
        distance: 0,
        points: [from],
        status: 'unreachable',
    };
}

export function findRabbitPath({
    blockedCells,
    from,
    groundSurfaces,
    to,
}: {
    blockedCells: AnimalMovementCell[];
    from: RabbitNavigationPoint;
    groundSurfaces: AnimalMovementSurface[];
    to: RabbitNavigationPoint;
}) {
    const targetCell = `${Math.round(to.x)}:${Math.round(to.z)}`;
    const startCell = `${Math.round(from.x)}:${Math.round(from.z)}`;
    const targetIsBlocked = blockedCells.some(
        (cell) => `${Math.round(cell.x)}:${Math.round(cell.z)}` === targetCell,
    );
    const targetSurface = getAnimalMovementSurfaceAt(to, groundSurfaces);
    const path = findCatPath({
        blockedCells,
        from,
        surfaces: groundSurfaces,
        to,
        walkableCells: groundCells(groundSurfaces),
    });

    if (
        (targetIsBlocked && targetCell !== startCell) ||
        targetSurface?.kind !== 'ground' ||
        path.status === 'unreachable' ||
        !pathStaysOnGround(path.points, groundSurfaces)
    ) {
        return unreachablePath(path, from);
    }

    return path;
}

export function findRabbitFleePath({
    avatar,
    blockedCells,
    candidates,
    from,
    groundSurfaces,
    home,
    homeRange,
}: {
    avatar: Pick<Vector3, 'x' | 'z'>;
    blockedCells: AnimalMovementCell[];
    candidates: RabbitNavigationPoint[];
    from: RabbitNavigationPoint;
    groundSurfaces: AnimalMovementSurface[];
    home: Pick<Vector3, 'x' | 'z'>;
    homeRange: number;
}) {
    const currentAvatarDistance = horizontalDistance(from, avatar);
    const rankedCandidates = candidates
        .filter(
            (candidate) =>
                horizontalDistance(candidate, home) <= homeRange &&
                horizontalDistance(candidate, avatar) >=
                    currentAvatarDistance + minimumFleeDistanceGain,
        )
        .sort(
            (left, right) =>
                horizontalDistance(right, avatar) -
                horizontalDistance(left, avatar),
        );

    for (const candidate of rankedCandidates) {
        const path = findRabbitPath({
            blockedCells,
            from,
            groundSurfaces,
            to: candidate,
        });
        if (path.status !== 'unreachable') {
            return path;
        }
    }

    return null;
}
