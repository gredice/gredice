import type { BlockData } from '@gredice/client';
import type { Ray, Vector3 } from 'three';
import { createBlockInteractionTargetKey } from '../../controls/BlockInteractionRegistry';
import {
    type BlockInteractionLayerTarget,
    getBlockInteractionRotatedHitboxFootprint,
    resolveBlockInteractionLayerTarget,
} from '../../controls/BlockInteractionResolver';
import type { Stack } from '../../types/Stack';
import type { AnimalPresenceEntry } from '../../useGameState';
import { getBlockHitboxSize } from '../../utils/blockHitbox';
import { getBlockDataByName, getStackHeight } from '../../utils/getStackHeight';
import { gardenAvatarRadius } from './gardenAvatarMovement';

export const gardenAvatarInteractionRange = 3.2;
export const gardenAvatarAnimalPetRange = 2.4;
export const gardenAvatarBeachBallKickDistance = 0.66;

const gardenAvatarWorldInteractionBlockNames = new Set([
    'BeachBall',
    'BeachChair',
    'GardenBox',
    'WoodenBench',
    'WoodenSign',
]);

const cactusBlockNames = new Set([
    'CactusBarrel',
    'CactusColumnCluster',
    'CactusPricklyPear',
]);

export type GardenAvatarBlockInteractionTarget = BlockInteractionLayerTarget;

export type GardenAvatarSeatPose = {
    blockId: string;
    exitX: number;
    exitZ: number;
    x: number;
    y: number;
    yaw: number;
    z: number;
};

export function isGardenAvatarSeatBlockName(blockName: string) {
    return blockName === 'BeachChair' || blockName === 'WoodenBench';
}

export function isGardenAvatarCactusBlockName(blockName: string) {
    return cactusBlockNames.has(blockName);
}

export function getGardenAvatarBlockInteractionTargets({
    blockData,
    interactiveBlockIds,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    interactiveBlockIds?: ReadonlySet<string>;
    stacks: Stack[] | undefined;
}) {
    return (stacks ?? []).flatMap((stack) =>
        stack.blocks.flatMap((block, blockIndex) => {
            if (
                !gardenAvatarWorldInteractionBlockNames.has(block.name) &&
                !cactusBlockNames.has(block.name) &&
                !interactiveBlockIds?.has(block.id)
            ) {
                return [];
            }

            return [
                {
                    block,
                    blockIndex,
                    hitbox: getBlockHitboxSize(
                        getBlockDataByName(blockData, block.name),
                    ),
                    key: createBlockInteractionTargetKey({
                        blockId: block.id,
                        blockIndex,
                        stackPosition: stack.position,
                    }),
                    stack,
                    stackHeight: getStackHeight(blockData, stack, block),
                } satisfies GardenAvatarBlockInteractionTarget,
            ];
        }),
    );
}

export function resolveAimedGardenAvatarBlock({
    actorPosition,
    ray,
    targets,
}: {
    actorPosition: Pick<Vector3, 'x' | 'y' | 'z'>;
    ray: Ray;
    targets: GardenAvatarBlockInteractionTarget[];
}) {
    const resolved = resolveBlockInteractionLayerTarget(
        targets.filter(
            (target) => !isGardenAvatarCactusBlockName(target.block.name),
        ),
        ray,
    );
    if (!resolved) {
        return null;
    }

    return Math.hypot(
        resolved.hitPoint.x - actorPosition.x,
        resolved.hitPoint.y - actorPosition.y,
        resolved.hitPoint.z - actorPosition.z,
    ) <= gardenAvatarInteractionRange
        ? resolved.target
        : null;
}

export function resolveAimedGardenAvatarAnimal({
    actorPosition,
    entries,
    now,
    ray,
}: {
    actorPosition: Pick<Vector3, 'x' | 'y' | 'z'>;
    entries: AnimalPresenceEntry[];
    now: number;
    ray: Ray;
}) {
    return (
        entries
            .filter(
                (entry) =>
                    (entry.species === 'Cat' || entry.species === 'Dog') &&
                    now - entry.updatedAt <= 3.5 &&
                    Math.hypot(
                        entry.position.x - actorPosition.x,
                        entry.position.y - actorPosition.y,
                        entry.position.z - actorPosition.z,
                    ) <= gardenAvatarAnimalPetRange,
            )
            .map((entry) => {
                const center = {
                    x: entry.position.x,
                    y:
                        entry.position.y +
                        (entry.species === 'Dog' ? 0.42 : 0.3),
                    z: entry.position.z,
                };
                const alongRay =
                    (center.x - ray.origin.x) * ray.direction.x +
                    (center.y - ray.origin.y) * ray.direction.y +
                    (center.z - ray.origin.z) * ray.direction.z;
                const closest = ray.at(
                    Math.max(0, alongRay),
                    ray.direction.clone(),
                );
                return {
                    alongRay,
                    distanceToRay: Math.hypot(
                        closest.x - center.x,
                        closest.y - center.y,
                        closest.z - center.z,
                    ),
                    entry,
                };
            })
            .filter(
                (candidate) =>
                    candidate.alongRay >= 0 && candidate.distanceToRay <= 0.42,
            )
            .sort((left, right) => left.alongRay - right.alongRay)[0]?.entry ??
        null
    );
}

export function getGardenAvatarForwardDirection(yaw: number) {
    return {
        x: -Math.sin(yaw),
        z: -Math.cos(yaw),
    };
}

export function getGardenAvatarSeatPose(
    target: GardenAvatarBlockInteractionTarget,
): GardenAvatarSeatPose | null {
    if (!isGardenAvatarSeatBlockName(target.block.name)) {
        return null;
    }

    const yaw = target.block.rotation * (Math.PI / 2);
    const forward = getGardenAvatarForwardDirection(yaw);
    const config =
        target.block.name === 'BeachChair'
            ? { offset: -0.04, seatHeight: 0.3 }
            : { offset: 0, seatHeight: 0.29 };
    const exitDistance = target.hitbox.depth / 2 + gardenAvatarRadius + 0.1;

    return {
        blockId: target.block.id,
        exitX: target.stack.position.x + forward.x * exitDistance,
        exitZ: target.stack.position.z + forward.z * exitDistance,
        x: target.stack.position.x + forward.x * config.offset,
        y: target.stackHeight + config.seatHeight,
        yaw,
        z: target.stack.position.z + forward.z * config.offset,
    };
}

function circleIntersectsTarget(
    position: Pick<Vector3, 'x' | 'z'>,
    radius: number,
    target: GardenAvatarBlockInteractionTarget,
) {
    const footprint = getBlockInteractionRotatedHitboxFootprint(target);
    const dx = Math.max(
        Math.abs(position.x - target.stack.position.x) - footprint.width / 2,
        0,
    );
    const dz = Math.max(
        Math.abs(position.z - target.stack.position.z) - footprint.depth / 2,
        0,
    );
    return dx * dx + dz * dz <= radius * radius;
}

export function findGardenAvatarCactusContact({
    position,
    targets,
}: {
    position: Pick<Vector3, 'x' | 'z'>;
    targets: GardenAvatarBlockInteractionTarget[];
}) {
    return (
        targets.find(
            (target) =>
                isGardenAvatarCactusBlockName(target.block.name) &&
                circleIntersectsTarget(position, 0.24, target),
        ) ?? null
    );
}

export function getGardenAvatarCactusBounceDirection({
    attemptedDirection,
    cactus,
    position,
}: {
    attemptedDirection: { x: number; z: number };
    cactus: GardenAvatarBlockInteractionTarget;
    position: Pick<Vector3, 'x' | 'z'>;
}) {
    let x = position.x - cactus.stack.position.x;
    let z = position.z - cactus.stack.position.z;
    const distance = Math.hypot(x, z);
    if (distance <= 0.0001) {
        x = -attemptedDirection.x;
        z = -attemptedDirection.z;
    } else {
        x /= distance;
        z /= distance;
    }

    return { x, z };
}
