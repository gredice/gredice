import type { BlockData } from '@gredice/client';
import type { Stack } from '../../types/Stack';
import {
    createGardenAvatarCollisionWorld,
    findGardenAvatarSpawnPoint,
    getGardenAvatarGroundY,
    getGardenAvatarRoamBlockedCells,
} from './gardenAvatarMovement';

export type DetailedInspectionFarmerTransform = {
    position: [x: number, y: number, z: number];
    rotationY: number;
};

function gridCellKey(point: { x: number; z: number }) {
    return `${Math.round(point.x).toString()}:${Math.round(point.z).toString()}`;
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
    const world = createGardenAvatarCollisionWorld({ blockData, stacks });
    const targetStack = stacks?.find((stack) =>
        stack.blocks.some((block) => block.id === targetBlockId),
    );
    const fallback = findGardenAvatarSpawnPoint(world);
    if (!targetStack) {
        return fallback
            ? {
                  position: [fallback.x, fallback.y, fallback.z],
                  rotationY: 0,
              }
            : null;
    }

    const blockedCellKeys = new Set(
        getGardenAvatarRoamBlockedCells(world).map(gridCellKey),
    );

    const walkableCandidate = world.surfaces
        .filter(
            (surface) =>
                surface.kind === 'ground' &&
                surface.roamable !== false &&
                !blockedCellKeys.has(gridCellKey(surface)),
        )
        .map((surface) => ({
            distance: Math.hypot(
                surface.x - targetStack.position.x,
                surface.z - targetStack.position.z,
            ),
            point: {
                x: surface.x,
                y: surface.y,
                z: surface.z,
            },
        }))
        .sort((left, right) => left.distance - right.distance)
        .find(
            ({ point }) =>
                getGardenAvatarGroundY({
                    currentGroundY: point.y,
                    position: point,
                    world,
                }) !== null,
        )?.point;
    const spawn = walkableCandidate ?? fallback;
    if (!spawn) {
        return null;
    }

    return {
        position: [spawn.x, spawn.y, spawn.z],
        rotationY: Math.atan2(
            targetStack.position.x - spawn.x,
            targetStack.position.z - spawn.z,
        ),
    };
}
