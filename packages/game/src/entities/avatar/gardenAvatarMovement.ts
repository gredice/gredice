import type {
    AnimalMovementCell,
    AnimalMovementSurface,
} from '../animals/animalMovementTerrain';

export type GardenAvatarPoint = {
    x: number;
    y: number;
    z: number;
};

export type GardenAvatarCollisionWorld = {
    blockedCells: AnimalMovementCell[];
    surfaces: AnimalMovementSurface[];
};

export const gardenAvatarRadius = 0.22;
export const gardenAvatarMaxStepHeight = 0.42;

const terrainHalfSize = 0.5;
const collisionEpsilon = 0.0001;
const maxMovementSubstep = 0.08;
const diagonalSample = gardenAvatarRadius * Math.SQRT1_2;
const collisionSamples = [
    { x: 0, z: 0 },
    { x: gardenAvatarRadius, z: 0 },
    { x: -gardenAvatarRadius, z: 0 },
    { x: 0, z: gardenAvatarRadius },
    { x: 0, z: -gardenAvatarRadius },
    { x: diagonalSample, z: diagonalSample },
    { x: diagonalSample, z: -diagonalSample },
    { x: -diagonalSample, z: diagonalSample },
    { x: -diagonalSample, z: -diagonalSample },
];

function cellKey(cell: Pick<AnimalMovementCell, 'x' | 'z'>) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

function getHighestSurfaceAt(
    position: Pick<GardenAvatarPoint, 'x' | 'z'>,
    surfaces: AnimalMovementSurface[],
) {
    let selected: AnimalMovementSurface | null = null;

    for (const surface of surfaces) {
        if (
            Math.abs(position.x - surface.x) <=
                terrainHalfSize + collisionEpsilon &&
            Math.abs(position.z - surface.z) <=
                terrainHalfSize + collisionEpsilon &&
            (!selected || surface.y > selected.y)
        ) {
            selected = surface;
        }
    }

    return selected;
}

function circleIntersectsCell(
    position: Pick<GardenAvatarPoint, 'x' | 'z'>,
    cell: AnimalMovementCell,
) {
    const dx = Math.max(Math.abs(position.x - cell.x) - terrainHalfSize, 0);
    const dz = Math.max(Math.abs(position.z - cell.z) - terrainHalfSize, 0);
    return (
        dx * dx + dz * dz <
        gardenAvatarRadius * gardenAvatarRadius - collisionEpsilon
    );
}

export function getGardenAvatarGroundY({
    currentGroundY,
    position,
    world,
}: {
    currentGroundY: number;
    position: Pick<GardenAvatarPoint, 'x' | 'z'>;
    world: GardenAvatarCollisionWorld;
}) {
    if (
        world.blockedCells.some((cell) => circleIntersectsCell(position, cell))
    ) {
        return null;
    }

    const sampleHeights: number[] = [];
    for (const sample of collisionSamples) {
        const surface = getHighestSurfaceAt(
            {
                x: position.x + sample.x,
                z: position.z + sample.z,
            },
            world.surfaces,
        );
        if (surface?.kind !== 'ground') {
            return null;
        }
        sampleHeights.push(surface.y);
    }

    const minHeight = Math.min(...sampleHeights);
    const maxHeight = Math.max(...sampleHeights);
    if (
        maxHeight - minHeight > gardenAvatarMaxStepHeight ||
        Math.abs(maxHeight - currentGroundY) > gardenAvatarMaxStepHeight
    ) {
        return null;
    }

    return maxHeight;
}

function tryMove(
    position: GardenAvatarPoint,
    x: number,
    z: number,
    world: GardenAvatarCollisionWorld,
) {
    const groundY = getGardenAvatarGroundY({
        currentGroundY: position.y,
        position: { x, z },
        world,
    });
    return groundY === null ? null : { x, y: groundY, z };
}

export function resolveGardenAvatarHorizontalMovement({
    deltaX,
    deltaZ,
    position,
    world,
}: {
    deltaX: number;
    deltaZ: number;
    position: GardenAvatarPoint;
    world: GardenAvatarCollisionWorld;
}) {
    const distance = Math.hypot(deltaX, deltaZ);
    const steps = Math.max(1, Math.ceil(distance / maxMovementSubstep));
    const stepX = deltaX / steps;
    const stepZ = deltaZ / steps;
    let current = { ...position };
    let collided = false;

    for (let step = 0; step < steps; step += 1) {
        const combined = tryMove(
            current,
            current.x + stepX,
            current.z + stepZ,
            world,
        );
        if (combined) {
            current = combined;
            continue;
        }

        collided = true;
        const xOnly = tryMove(current, current.x + stepX, current.z, world);
        const zOnly = tryMove(current, current.x, current.z + stepZ, world);

        if (xOnly && zOnly) {
            current = Math.abs(stepX) >= Math.abs(stepZ) ? xOnly : zOnly;
        } else if (xOnly) {
            current = xOnly;
        } else if (zOnly) {
            current = zOnly;
        }
    }

    return { collided, position: current };
}

function createWalkableSurfaceMap(world: GardenAvatarCollisionWorld) {
    const blockedKeys = new Set(world.blockedCells.map(cellKey));
    const surfaces = new Map<string, AnimalMovementSurface>();

    for (const surface of world.surfaces) {
        const key = cellKey(surface);
        if (
            surface.kind === 'ground' &&
            !blockedKeys.has(key) &&
            (!surfaces.has(key) ||
                (surfaces.get(key)?.y ?? Number.NEGATIVE_INFINITY) < surface.y)
        ) {
            surfaces.set(key, surface);
        }
    }

    return surfaces;
}

const neighborDirections = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: -1, z: -1 },
];

function canTraverse(
    from: AnimalMovementSurface,
    to: AnimalMovementSurface | undefined,
) {
    return (
        Boolean(to) &&
        Math.abs((to?.y ?? from.y) - from.y) <= gardenAvatarMaxStepHeight
    );
}

export function findGardenAvatarRoute({
    from,
    to,
    world,
}: {
    from: GardenAvatarPoint;
    to: GardenAvatarPoint;
    world: GardenAvatarCollisionWorld;
}) {
    const surfaces = createWalkableSurfaceMap(world);
    const startKey = cellKey(from);
    const targetKey = cellKey(to);
    const start = surfaces.get(startKey);
    const target = surfaces.get(targetKey);
    if (!start || !target) {
        return [from];
    }

    const open = [startKey];
    const visited = new Set([startKey]);
    const previous = new Map<string, string>();

    while (open.length > 0) {
        const currentKey = open.shift();
        if (!currentKey) {
            break;
        }
        if (currentKey === targetKey) {
            const routeKeys = [currentKey];
            let routeKey = currentKey;
            while (routeKey !== startKey) {
                const previousKey = previous.get(routeKey);
                if (!previousKey) {
                    return [from];
                }
                routeKeys.push(previousKey);
                routeKey = previousKey;
            }

            return routeKeys.reverse().map((key, index) => {
                const surface = surfaces.get(key);
                if (!surface || index === 0) {
                    return { ...from };
                }
                if (index === routeKeys.length - 1) {
                    return { ...to, y: surface.y };
                }
                return { x: surface.x, y: surface.y, z: surface.z };
            });
        }

        const current = surfaces.get(currentKey);
        if (!current) {
            continue;
        }

        for (const direction of neighborDirections) {
            const nextCell = {
                x: current.x + direction.x,
                z: current.z + direction.z,
            };
            const nextKey = cellKey(nextCell);
            const next = surfaces.get(nextKey);
            if (visited.has(nextKey) || !canTraverse(current, next)) {
                continue;
            }

            if (direction.x !== 0 && direction.z !== 0) {
                const sideX = surfaces.get(
                    cellKey({ x: current.x + direction.x, z: current.z }),
                );
                const sideZ = surfaces.get(
                    cellKey({ x: current.x, z: current.z + direction.z }),
                );
                if (
                    !canTraverse(current, sideX) ||
                    !canTraverse(current, sideZ)
                ) {
                    continue;
                }
            }

            visited.add(nextKey);
            previous.set(nextKey, currentKey);
            open.push(nextKey);
        }
    }

    return [from];
}

export function findGardenAvatarSpawnPoint(world: GardenAvatarCollisionWorld) {
    const surfaces = [...createWalkableSurfaceMap(world).values()];
    if (surfaces.length === 0) {
        return null;
    }

    const center = surfaces.reduce(
        (sum, surface) => ({
            x: sum.x + surface.x / surfaces.length,
            z: sum.z + surface.z / surfaces.length,
        }),
        { x: 0, z: 0 },
    );
    const candidates = surfaces
        .map((surface) => ({
            x: surface.x,
            y: surface.y,
            z: surface.z,
        }))
        .sort(
            (left, right) =>
                Math.hypot(left.x - center.x, left.z - center.z) -
                Math.hypot(right.x - center.x, right.z - center.z),
        );

    return (
        candidates.find(
            (candidate) =>
                getGardenAvatarGroundY({
                    currentGroundY: candidate.y,
                    position: candidate,
                    world,
                }) !== null,
        ) ?? null
    );
}
