import type { BlockData } from '@gredice/client';
import type { Stack } from '../../types/Stack';
import {
    createGardenAvatarCollisionWorld,
    findGardenAvatarRoute,
    findGardenAvatarSpawnPoint,
    type GardenAvatarCollisionWorld,
    type GardenAvatarPoint,
    getGardenAvatarRoamTargets,
} from './gardenAvatarMovement';

export type DetailedInspectionFarmerTransform = {
    patrolRoute: GardenAvatarPoint[];
    position: [x: number, y: number, z: number];
    rotationY: number;
    world: GardenAvatarCollisionWorld;
};

const inspectionFarmerPatrolRadius = 2.5;

function horizontalDistance(left: GardenAvatarPoint, right: GardenAvatarPoint) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function sameHorizontalPoint(
    left: GardenAvatarPoint,
    right: GardenAvatarPoint,
) {
    return left.x === right.x && left.z === right.z;
}

function createDetailedInspectionFarmerPatrolRoute({
    center,
    spawn,
    targets,
    world,
}: {
    center: GardenAvatarPoint;
    spawn: GardenAvatarPoint;
    targets: GardenAvatarPoint[];
    world: GardenAvatarCollisionWorld;
}) {
    const nearbyTargets = targets
        .filter(
            (target) =>
                horizontalDistance(target, center) <=
                inspectionFarmerPatrolRadius,
        )
        .sort(
            (left, right) =>
                Math.atan2(left.z - center.z, left.x - center.x) -
                Math.atan2(right.z - center.z, right.x - center.x),
        );
    const spawnIndex = nearbyTargets.findIndex((target) =>
        sameHorizontalPoint(target, spawn),
    );
    const orderedTargets =
        spawnIndex <= 0
            ? nearbyTargets
            : [
                  ...nearbyTargets.slice(spawnIndex),
                  ...nearbyTargets.slice(0, spawnIndex),
              ];
    const route = [spawn];
    let current = spawn;

    for (const target of [...orderedTargets.slice(1), spawn]) {
        if (sameHorizontalPoint(current, target)) {
            continue;
        }

        const segment = findGardenAvatarRoute({
            from: current,
            to: target,
            world,
        });
        const destination = segment.at(-1);
        if (!destination || !sameHorizontalPoint(destination, target)) {
            continue;
        }

        route.push(...segment.slice(1));
        current = destination;
    }

    return route;
}

export function findDetailedInspectionFarmerTransform({
    blockData,
    stacks,
    targetBlockId,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
    targetBlockId: string | null | undefined;
}): DetailedInspectionFarmerTransform | null {
    if (!blockData?.length || !stacks?.length) {
        return null;
    }

    const world = createGardenAvatarCollisionWorld({ blockData, stacks });
    const targetStack = stacks?.find((stack) =>
        stack.blocks.some((block) => block.id === targetBlockId),
    );
    const fallback = findGardenAvatarSpawnPoint(world);
    if (!targetStack) {
        return fallback
            ? {
                  patrolRoute: [fallback],
                  position: [fallback.x, fallback.y, fallback.z],
                  rotationY: 0,
                  world,
              }
            : null;
    }

    const roamTargets = getGardenAvatarRoamTargets(world);
    const targetPosition = {
        x: targetStack.position.x,
        y: targetStack.position.y,
        z: targetStack.position.z,
    };
    const walkableCandidate = roamTargets
        .map((point) => ({
            distance: horizontalDistance(point, targetPosition),
            point,
        }))
        .sort((left, right) => left.distance - right.distance)[0]?.point;
    const spawn = walkableCandidate ?? fallback;
    if (!spawn) {
        return null;
    }

    return {
        patrolRoute: createDetailedInspectionFarmerPatrolRoute({
            center: targetPosition,
            spawn,
            targets: roamTargets,
            world,
        }),
        position: [spawn.x, spawn.y, spawn.z],
        rotationY: Math.atan2(
            targetStack.position.x - spawn.x,
            targetStack.position.z - spawn.z,
        ),
        world,
    };
}
