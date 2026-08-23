import type { BlockData } from '@gredice/client';
import { MathUtils, Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import {
    createGardenAvatarCollisionWorld,
    type GardenAvatarMovementSurface,
} from '../avatar/gardenAvatarMovement';
import { createBatRandom, hashBatSeed } from './batBehavior';

export type BatAvoidSphere = {
    center: { x: number; y: number; z: number };
    radius: number;
};

export type BatFlightBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export type BatFlightWorld = {
    bounds: BatFlightBounds;
    obstacles: GardenAvatarMovementSurface[];
};

export type BatFlightWaypoint = {
    id: string;
    kind: 'circle' | 'forage';
    position: Vector3;
};

export type BatHabitat = {
    center: Vector3;
    id: string;
    roost: Vector3;
    seed: number;
    waypoints: BatFlightWaypoint[];
    world: BatFlightWorld;
};

type BatCoverAnchor = {
    id: string;
    position: Vector3;
};

export const batFlightClearance = 0.44;
export const batMaxPathCandidateAttempts = 12;
export const batMinimumHabitatCells = 16;
const batMinimumHabitatSpan = 3;
const batMinimumWaypoints = 4;
const batWaypointCandidateAttempts = 28;
const batCoverClusterRadius = 7;
const batRoostClearance = batFlightClearance + 0.2;

const naturalBatCoverNames = new Set([
    'Bush',
    'DeadTreeTall',
    'Pine',
    'PineAdvent',
    'Tree',
]);

export function isNaturalBatCoverName(name: string) {
    return naturalBatCoverNames.has(name);
}

function createBounds(stacks: Stack[] | undefined): BatFlightBounds | null {
    if (!stacks || stacks.length < batMinimumHabitatCells) {
        return null;
    }
    const xValues = stacks.map((stack) => stack.position.x);
    const zValues = stacks.map((stack) => stack.position.z);
    const bounds = {
        maxX: Math.max(...xValues),
        maxZ: Math.max(...zValues),
        minX: Math.min(...xValues),
        minZ: Math.min(...zValues),
    };
    if (
        bounds.maxX - bounds.minX < batMinimumHabitatSpan ||
        bounds.maxZ - bounds.minZ < batMinimumHabitatSpan
    ) {
        return null;
    }
    return bounds;
}

export function createBatFlightWorld({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}): BatFlightWorld | null {
    const bounds = createBounds(stacks);
    if (!bounds) {
        return null;
    }
    const collisionWorld = createGardenAvatarCollisionWorld({
        blockData,
        stacks,
    });
    return {
        bounds,
        obstacles: collisionWorld.surfaces.filter(
            (surface) => surface.roamable === false,
        ),
    };
}

function localPoint(
    point: { x: number; y: number; z: number },
    obstacle: GardenAvatarMovementSurface,
) {
    const rotation = -(obstacle.rotation ?? 0);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = point.x - obstacle.x;
    const dz = point.z - obstacle.z;
    return {
        x: dx * cos - dz * sin,
        y: point.y,
        z: dx * sin + dz * cos,
    };
}

function pointInsideObstacle(
    point: { x: number; y: number; z: number },
    obstacle: GardenAvatarMovementSurface,
    clearance: number,
) {
    const local = localPoint(point, obstacle);
    const bottom = obstacle.bottomY ?? 0;
    return (
        Math.abs(local.x) <= (obstacle.halfWidth ?? 0.5) + clearance &&
        Math.abs(local.z) <= (obstacle.halfDepth ?? 0.5) + clearance &&
        local.y >= bottom - clearance &&
        local.y <= obstacle.y + clearance
    );
}

export function isBatPointClear(
    point: { x: number; y: number; z: number },
    world: BatFlightWorld,
    clearance = batFlightClearance,
) {
    return !world.obstacles.some((obstacle) =>
        pointInsideObstacle(point, obstacle, clearance),
    );
}

function segmentIntersectsBox(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    obstacle: GardenAvatarMovementSurface,
    clearance: number,
) {
    const start = localPoint(from, obstacle);
    const end = localPoint(to, obstacle);
    const minimum = {
        x: -(obstacle.halfWidth ?? 0.5) - clearance,
        y: (obstacle.bottomY ?? 0) - clearance,
        z: -(obstacle.halfDepth ?? 0.5) - clearance,
    };
    const maximum = {
        x: (obstacle.halfWidth ?? 0.5) + clearance,
        y: obstacle.y + clearance,
        z: (obstacle.halfDepth ?? 0.5) + clearance,
    };
    let enter = 0;
    let exit = 1;

    for (const axis of ['x', 'y', 'z'] as const) {
        const direction = end[axis] - start[axis];
        if (Math.abs(direction) < 0.000_001) {
            if (start[axis] < minimum[axis] || start[axis] > maximum[axis]) {
                return false;
            }
            continue;
        }
        const first = (minimum[axis] - start[axis]) / direction;
        const second = (maximum[axis] - start[axis]) / direction;
        enter = Math.max(enter, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
        if (enter > exit) {
            return false;
        }
    }
    return true;
}

function segmentIntersectsSphere(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    sphere: BatAvoidSphere,
    clearance: number,
) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const projection =
        lengthSquared <= 0.000_001
            ? 0
            : MathUtils.clamp(
                  ((sphere.center.x - from.x) * dx +
                      (sphere.center.y - from.y) * dy +
                      (sphere.center.z - from.z) * dz) /
                      lengthSquared,
                  0,
                  1,
              );
    const closestX = from.x + dx * projection;
    const closestY = from.y + dy * projection;
    const closestZ = from.z + dz * projection;
    const distanceX = closestX - sphere.center.x;
    const distanceY = closestY - sphere.center.y;
    const distanceZ = closestZ - sphere.center.z;
    const radius = sphere.radius + clearance;
    return (
        distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ <
        radius * radius
    );
}

export function isBatSegmentClear({
    avoid = [],
    clearance = batFlightClearance,
    from,
    to,
    world,
}: {
    avoid?: readonly BatAvoidSphere[];
    clearance?: number;
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    world: BatFlightWorld;
}) {
    return (
        !world.obstacles.some((obstacle) =>
            segmentIntersectsBox(from, to, obstacle, clearance),
        ) &&
        !avoid.some((sphere) =>
            segmentIntersectsSphere(from, to, sphere, clearance),
        )
    );
}

function createCoverAnchors({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}) {
    const anchors: BatCoverAnchor[] = [];
    for (const stack of stacks ?? []) {
        const cover = stack.blocks.findLast((block) =>
            isNaturalBatCoverName(block.name),
        );
        if (!cover) {
            continue;
        }
        anchors.push({
            id: cover.id,
            position: new Vector3(
                stack.position.x,
                getStackHeight(blockData, stack) + batRoostClearance,
                stack.position.z,
            ),
        });
    }
    return anchors.sort((left, right) => left.id.localeCompare(right.id));
}

function anchorDistanceSquared(left: BatCoverAnchor, right: BatCoverAnchor) {
    const x = left.position.x - right.position.x;
    const z = left.position.z - right.position.z;
    return x * x + z * z;
}

function selectHabitatAnchors(
    anchors: BatCoverAnchor[],
    bounds: BatFlightBounds,
) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const orderedAnchors = [...anchors].sort((left, right) => {
        const leftDistance =
            (left.position.x - centerX) ** 2 + (left.position.z - centerZ) ** 2;
        const rightDistance =
            (right.position.x - centerX) ** 2 +
            (right.position.z - centerZ) ** 2;
        return leftDistance - rightDistance || left.id.localeCompare(right.id);
    });
    const selected: BatCoverAnchor[] = [];
    const radiusSquared = batCoverClusterRadius * batCoverClusterRadius;
    for (const anchor of orderedAnchors) {
        if (
            selected.some(
                (candidate) =>
                    anchorDistanceSquared(candidate, anchor) <= radiusSquared,
            )
        ) {
            continue;
        }
        selected.push(anchor);
        if (selected.length >= 2) {
            break;
        }
    }
    return selected.length > 0 ? selected : orderedAnchors.slice(0, 1);
}

function createWaypoints({
    anchor,
    seed,
    world,
}: {
    anchor: BatCoverAnchor;
    seed: number;
    world: BatFlightWorld;
}) {
    const random = createBatRandom(seed);
    const waypoints: BatFlightWaypoint[] = [];
    const spanX = world.bounds.maxX - world.bounds.minX;
    const spanZ = world.bounds.maxZ - world.bounds.minZ;
    const maximumRadius = Math.max(
        1.5,
        Math.min(4.5, spanX * 0.46, spanZ * 0.46),
    );
    const minimumAltitude = MathUtils.clamp(
        anchor.position.y * 0.55,
        1.45,
        2.05,
    );
    const circleDirection = random() < 0.5 ? -1 : 1;
    const circleStartAngle = random() * Math.PI * 2;

    for (
        let attempt = 0;
        attempt < batWaypointCandidateAttempts;
        attempt += 1
    ) {
        const angle =
            circleStartAngle +
            circleDirection * attempt * (0.48 + random() * 0.18);
        const radius = 1.2 + random() * Math.max(0.3, maximumRadius - 1.2);
        const candidate = new Vector3(
            MathUtils.clamp(
                anchor.position.x + Math.cos(angle) * radius,
                world.bounds.minX + 0.35,
                world.bounds.maxX - 0.35,
            ),
            minimumAltitude + random() * 1.25,
            MathUtils.clamp(
                anchor.position.z + Math.sin(angle) * radius,
                world.bounds.minZ + 0.35,
                world.bounds.maxZ - 0.35,
            ),
        );
        const previous = waypoints.at(-1)?.position ?? anchor.position;
        if (
            !isBatPointClear(candidate, world) ||
            !isBatSegmentClear({ from: previous, to: candidate, world }) ||
            waypoints.some(
                (waypoint) =>
                    waypoint.position.distanceToSquared(candidate) < 0.64,
            )
        ) {
            continue;
        }
        waypoints.push({
            id: `${anchor.id}:air:${attempt}`,
            kind: attempt % 3 === 0 ? 'forage' : 'circle',
            position: candidate,
        });
        if (waypoints.length >= 10) {
            break;
        }
    }
    return waypoints;
}

export function createBatHabitats({
    blockData,
    seedKey,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    seedKey: number | string;
    stacks: Stack[] | undefined;
}) {
    const world = createBatFlightWorld({ blockData, stacks });
    if (!world) {
        return [];
    }
    const anchors = selectHabitatAnchors(
        createCoverAnchors({ blockData, stacks }),
        world.bounds,
    );
    return anchors.flatMap((anchor, habitatIndex) => {
        const seed = hashBatSeed(seedKey, anchor.id, habitatIndex);
        const waypoints = createWaypoints({ anchor, seed, world });
        if (waypoints.length < batMinimumWaypoints) {
            return [];
        }
        const center = new Vector3(anchor.position.x, 0, anchor.position.z);
        for (const waypoint of waypoints) {
            center.x += waypoint.position.x;
            center.z += waypoint.position.z;
        }
        center.x /= waypoints.length + 1;
        center.z /= waypoints.length + 1;
        center.y =
            waypoints.reduce(
                (total, waypoint) => total + waypoint.position.y,
                anchor.position.y,
            ) /
            (waypoints.length + 1);
        return [
            {
                center,
                id: `environment-bat:${anchor.id}`,
                roost: anchor.position,
                seed,
                waypoints,
                world,
            } satisfies BatHabitat,
        ];
    });
}

export function chooseBatWaypoint({
    avoid,
    current,
    habitat,
    random,
    startIndex,
}: {
    avoid: readonly BatAvoidSphere[];
    current: { x: number; y: number; z: number };
    habitat: BatHabitat;
    random: () => number;
    startIndex: number;
}) {
    if (habitat.waypoints.length === 0) {
        return null;
    }
    const stride = 1 + Math.floor(random() * (habitat.waypoints.length - 1));
    for (
        let attempt = 0;
        attempt <
        Math.min(batMaxPathCandidateAttempts, habitat.waypoints.length);
        attempt += 1
    ) {
        const index =
            (startIndex + attempt * stride + habitat.waypoints.length) %
            habitat.waypoints.length;
        const waypoint = habitat.waypoints[index];
        if (
            waypoint &&
            isBatSegmentClear({
                avoid,
                from: current,
                to: waypoint.position,
                world: habitat.world,
            })
        ) {
            return { index, waypoint };
        }
    }
    return null;
}

export function createBatAvoidanceWaypoint({
    current,
    habitat,
    seed,
    threat,
}: {
    current: { x: number; y: number; z: number };
    habitat: BatHabitat;
    seed: number;
    threat: BatAvoidSphere;
}) {
    let awayX = current.x - threat.center.x;
    let awayZ = current.z - threat.center.z;
    const length = Math.hypot(awayX, awayZ);
    if (length < 0.001) {
        const angle = (seed % 360) * (Math.PI / 180);
        awayX = Math.cos(angle);
        awayZ = Math.sin(angle);
    } else {
        awayX /= length;
        awayZ /= length;
    }
    const candidate = new Vector3(
        MathUtils.clamp(
            current.x + awayX * 1.45,
            habitat.world.bounds.minX + 0.35,
            habitat.world.bounds.maxX - 0.35,
        ),
        Math.max(current.y + 0.48, threat.center.y + threat.radius + 0.4),
        MathUtils.clamp(
            current.z + awayZ * 1.45,
            habitat.world.bounds.minZ + 0.35,
            habitat.world.bounds.maxZ - 0.35,
        ),
    );
    return isBatPointClear(candidate, habitat.world) &&
        isBatSegmentClear({
            from: current,
            to: candidate,
            world: habitat.world,
        })
        ? candidate
        : null;
}
