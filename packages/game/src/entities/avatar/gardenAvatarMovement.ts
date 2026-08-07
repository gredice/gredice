import type { BlockData } from '@gredice/client';
import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import type { Stack } from '../../types/Stack';
import { getStackBlockHeight } from '../../utils/stackHeightCore';
import type {
    AnimalMovementCell,
    AnimalMovementSurface,
} from '../animals/animalMovementTerrain';
import {
    isAnimalGroundBlockName,
    isAnimalWaterBlockName,
} from '../animals/animalMovementTerrain';
import { findCatPath } from '../cats/catPathfinding';

export type GardenAvatarPoint = {
    x: number;
    y: number;
    z: number;
};

export type GardenAvatarCollisionWorld = {
    blockedCells: AnimalMovementCell[];
    surfaces: GardenAvatarMovementSurface[];
};

export type GardenAvatarMovementSurface = AnimalMovementSurface & {
    bottomY?: number;
    halfDepth?: number;
    halfWidth?: number;
    roamable?: boolean;
    roamBlockedCells?: AnimalMovementCell[];
    rotation?: number;
};

export const gardenAvatarRadius = 0.18;
export const gardenAvatarStandingCollisionHeight = 1.32;
export const gardenAvatarCrouchingCollisionHeight = 0.78;
export const gardenAvatarMaxStepHeight = 0.42;
export const gardenAvatarMaxJumpClimbHeight = 0.95;

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
    surfaces: GardenAvatarMovementSurface[],
    currentGroundY: number,
    collisionHeight: number,
) {
    let selected: GardenAvatarMovementSurface | null = null;

    for (const surface of surfaces) {
        const rotation = surface.rotation ?? 0;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const dx = position.x - surface.x;
        const dz = position.z - surface.z;
        const localX = dx * cos + dz * sin;
        const localZ = -dx * sin + dz * cos;
        const insideSurface =
            Math.abs(localX) <=
                (surface.halfWidth ?? terrainHalfSize) + collisionEpsilon &&
            Math.abs(localZ) <=
                (surface.halfDepth ?? terrainHalfSize) + collisionEpsilon;
        const clearsOverhead =
            surface.bottomY === undefined ||
            surface.bottomY <= currentGroundY + collisionHeight;

        if (
            insideSurface &&
            clearsOverhead &&
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

function circleIntersectsSurface(
    position: Pick<GardenAvatarPoint, 'x' | 'z'>,
    surface: GardenAvatarMovementSurface,
) {
    const rotation = surface.rotation ?? 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = position.x - surface.x;
    const dz = position.z - surface.z;
    const localX = dx * cos + dz * sin;
    const localZ = -dx * sin + dz * cos;
    const halfWidth = surface.halfWidth ?? terrainHalfSize;
    const halfDepth = surface.halfDepth ?? terrainHalfSize;
    const closestX = Math.min(Math.max(localX, -halfWidth), halfWidth);
    const closestZ = Math.min(Math.max(localZ, -halfDepth), halfDepth);
    const distanceX = localX - closestX;
    const distanceZ = localZ - closestZ;

    return (
        distanceX * distanceX + distanceZ * distanceZ <=
        gardenAvatarRadius * gardenAvatarRadius + collisionEpsilon
    );
}

export function getGardenAvatarCeilingY({
    collisionHeight,
    position,
    world,
}: {
    collisionHeight: number;
    position: GardenAvatarPoint;
    world: GardenAvatarCollisionWorld;
}) {
    let ceilingY: number | null = null;

    for (const surface of world.surfaces) {
        if (
            surface.bottomY === undefined ||
            surface.bottomY <=
                position.y + collisionHeight + collisionEpsilon ||
            !circleIntersectsSurface(position, surface)
        ) {
            continue;
        }

        const candidate = surface.bottomY - collisionHeight;
        ceilingY =
            ceilingY === null ? candidate : Math.min(ceilingY, candidate);
    }

    return ceilingY;
}

export function getGardenAvatarGroundY({
    collisionHeight = gardenAvatarStandingCollisionHeight,
    currentGroundY,
    maxStepHeight = gardenAvatarMaxStepHeight,
    position,
    world,
}: {
    collisionHeight?: number;
    currentGroundY: number;
    maxStepHeight?: number;
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
            currentGroundY,
            collisionHeight,
        );
        sampleHeights.push(surface?.y ?? 0);
    }

    const maxHeight = Math.max(...sampleHeights);
    if (maxHeight - currentGroundY > maxStepHeight) {
        return null;
    }

    return maxHeight;
}

function tryMove(
    position: GardenAvatarPoint,
    x: number,
    z: number,
    world: GardenAvatarCollisionWorld,
    maxStepHeight: number,
    collisionHeight: number,
) {
    const groundY = getGardenAvatarGroundY({
        collisionHeight,
        currentGroundY: position.y,
        maxStepHeight,
        position: { x, z },
        world,
    });
    return groundY === null ? null : { x, y: groundY, z };
}

export function resolveGardenAvatarHorizontalMovement({
    collisionHeight = gardenAvatarStandingCollisionHeight,
    deltaX,
    deltaZ,
    maxStepHeight = gardenAvatarMaxStepHeight,
    position,
    world,
}: {
    collisionHeight?: number;
    deltaX: number;
    deltaZ: number;
    maxStepHeight?: number;
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
            maxStepHeight,
            collisionHeight,
        );
        if (combined) {
            current = combined;
            continue;
        }

        collided = true;
        const xOnly = tryMove(
            current,
            current.x + stepX,
            current.z,
            world,
            maxStepHeight,
            collisionHeight,
        );
        const zOnly = tryMove(
            current,
            current.x,
            current.z + stepZ,
            world,
            maxStepHeight,
            collisionHeight,
        );

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

const narrowAvatarCollisionFootprints: Record<
    string,
    { depth: number; width: number }
> = {
    BirdHouse: { depth: 0.34, width: 0.34 },
    DeadTreeTall: { depth: 0.3, width: 0.42 },
    PalmTree: { depth: 0.34, width: 0.34 },
    Pine: { depth: 0.42, width: 0.42 },
    PineAdvent: { depth: 0.42, width: 0.42 },
    ShovelSmall: { depth: 0.14, width: 0.24 },
    Tree: { depth: 0.42, width: 0.42 },
};

function positiveDimension(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}

function getAvatarCollisionFootprint(block: BlockData | undefined) {
    const fallbackWidth = positiveDimension(block?.attributes.spanWidth, 0.68);
    const fallbackDepth = positiveDimension(block?.attributes.spanDepth, 0.68);
    const narrow = block
        ? narrowAvatarCollisionFootprints[block.information.name]
        : undefined;

    return {
        depth: Math.min(
            positiveDimension(block?.attributes.hitboxDepth, fallbackDepth),
            narrow?.depth ?? Number.POSITIVE_INFINITY,
        ),
        width: Math.min(
            positiveDimension(block?.attributes.hitboxWidth, fallbackWidth),
            narrow?.width ?? Number.POSITIVE_INFINITY,
        ),
    };
}

function getAvatarCollisionPlacement({
    block,
    rotation,
    stack,
}: {
    block: BlockData | undefined;
    rotation: number;
    stack: Stack;
}) {
    const offsets = getGardenBlockFootprintOffsets(block, rotation);
    const center = offsets.reduce(
        (sum, offset) => ({
            x: sum.x + offset.x / offsets.length,
            z: sum.z + offset.y / offsets.length,
        }),
        { x: 0, z: 0 },
    );

    return {
        roamBlockedCells: offsets.map((offset) => ({
            x: stack.position.x + offset.x,
            z: stack.position.z + offset.y,
        })),
        x: stack.position.x + center.x,
        z: stack.position.z + center.z,
    };
}

export function createGardenAvatarCollisionWorld({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}): GardenAvatarCollisionWorld {
    const blockDataByName = new Map(
        blockData?.map((block) => [block.information.name, block]) ?? [],
    );
    const surfaces: GardenAvatarMovementSurface[] = [];

    for (const stack of stacks ?? []) {
        let stackHeight = 0;
        let waterSupportY: number | null = null;

        for (const [blockIndex, block] of stack.blocks.entries()) {
            const bottomY = stackHeight;
            stackHeight += getStackBlockHeight(
                blockData,
                stack,
                block,
                blockIndex,
            );

            if (isAnimalWaterBlockName(block.name)) {
                waterSupportY ??= bottomY;
                surfaces.push({
                    bottomY: waterSupportY,
                    halfDepth: terrainHalfSize,
                    halfWidth: terrainHalfSize,
                    kind: 'water',
                    roamable: false,
                    roamBlockedCells: [
                        { x: stack.position.x, z: stack.position.z },
                    ],
                    rotation: 0,
                    x: stack.position.x,
                    y: waterSupportY,
                    z: stack.position.z,
                });
                continue;
            }

            waterSupportY = null;
            const isTerrain = isAnimalGroundBlockName(block.name);
            const blockDefinition = blockDataByName.get(block.name);
            const footprint = isTerrain
                ? { depth: 1, width: 1 }
                : getAvatarCollisionFootprint(blockDefinition);
            const placement = isTerrain
                ? {
                      roamBlockedCells: undefined,
                      x: stack.position.x,
                      z: stack.position.z,
                  }
                : getAvatarCollisionPlacement({
                      block: blockDefinition,
                      rotation: block.rotation,
                      stack,
                  });
            surfaces.push({
                bottomY,
                halfDepth: footprint.depth / 2,
                halfWidth: footprint.width / 2,
                kind: 'ground',
                roamable: isTerrain,
                roamBlockedCells: placement.roamBlockedCells,
                rotation: block.rotation * (Math.PI / 2),
                x: placement.x,
                y: stackHeight,
                z: placement.z,
            });
        }
    }

    return {
        blockedCells: [],
        surfaces,
    };
}

export function getGardenAvatarRoamBlockedCells(
    world: GardenAvatarCollisionWorld,
) {
    const blocked = new Map<string, AnimalMovementCell>();
    const cells = [
        ...world.blockedCells,
        ...world.surfaces
            .filter((surface) => surface.roamable === false)
            .flatMap((surface) => surface.roamBlockedCells ?? [surface]),
    ];

    for (const cell of cells) {
        const rounded = { x: Math.round(cell.x), z: Math.round(cell.z) };
        blocked.set(cellKey(rounded), rounded);
    }

    return [...blocked.values()];
}

function createWalkableSurfaceMap(world: GardenAvatarCollisionWorld) {
    const blockedKeys = new Set(
        getGardenAvatarRoamBlockedCells(world).map(cellKey),
    );
    const surfaces = new Map<string, AnimalMovementSurface>();

    for (const surface of world.surfaces) {
        const key = cellKey(surface);
        if (
            surface.kind === 'ground' &&
            surface.roamable !== false &&
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
    let startKey = cellKey(from);
    const targetKey = cellKey(to);
    let start = surfaces.get(startKey);
    const target = surfaces.get(targetKey);
    let reentryRoute: GardenAvatarPoint[] | null = null;

    if (!start) {
        const candidates = [...surfaces.values()]
            .filter(
                (surface) =>
                    getGardenAvatarGroundY({
                        currentGroundY: from.y,
                        position: surface,
                        world,
                    }) !== null,
            )
            .sort(
                (left, right) =>
                    Math.hypot(left.x - from.x, left.z - from.z) -
                    Math.hypot(right.x - from.x, right.z - from.z),
            );
        const blockedCells = getGardenAvatarRoamBlockedCells(world);

        for (const candidate of candidates) {
            const target = {
                x: candidate.x,
                y: candidate.y,
                z: candidate.z,
            };
            const reentry = findCatPath({
                blockedCells,
                from,
                surfaces: [target],
                to: target,
            });
            if (reentry.status === 'unreachable') {
                continue;
            }

            start = candidate;
            startKey = cellKey(start);
            reentryRoute = reentry.points;
            break;
        }
    }

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

            const route = routeKeys.reverse().map((key, index) => {
                const surface = surfaces.get(key);
                if (!surface) {
                    return { ...from };
                }
                if (index === 0) {
                    return reentryRoute
                        ? { x: surface.x, y: surface.y, z: surface.z }
                        : { ...from };
                }
                if (index === routeKeys.length - 1) {
                    return { ...to, y: surface.y };
                }
                return { x: surface.x, y: surface.y, z: surface.z };
            });
            return reentryRoute
                ? [...reentryRoute.slice(0, -1), ...route]
                : route;
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
