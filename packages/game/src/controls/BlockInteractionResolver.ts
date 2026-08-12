import { Box3, type Object3D, type Ray, Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

export type BlockInteractionLayerTarget = {
    block: Block;
    blockIndex: number;
    hitbox: {
        depth: number;
        height: number;
        width: number;
    };
    key: string;
    stack: Stack;
    stackHeight: number;
};

export type ResolvedBlockInteractionLayerTarget = {
    hitPoint: Vector3;
    target: BlockInteractionLayerTarget;
};

export type BlockInteractionLayerBounds = {
    centerX: number;
    centerY: number;
    centerZ: number;
    depth: number;
    height: number;
    width: number;
};

type BlockInteractionEventIntersection = {
    distance: number;
    object: Object3D;
};

const hitboxMin = new Vector3();
const hitboxMax = new Vector3();
const hitboxIntersection = new Vector3();
const hitboxBounds = new Box3();
const closerIntersectionEpsilon = 0.0001;

export const blockInteractionPassthroughUserDataKey =
    'blockInteractionPassthrough';

function isBlockInteractionPassthrough(object: Object3D) {
    let candidate: Object3D | null = object;
    while (candidate) {
        if (
            candidate.userData[blockInteractionPassthroughUserDataKey] === true
        ) {
            return true;
        }
        candidate = candidate.parent;
    }

    return false;
}

export function getBlockInteractionRotatedHitboxFootprint(
    target: BlockInteractionLayerTarget,
) {
    const rotation = ((Math.round(target.block.rotation) % 2) + 2) % 2;

    return rotation === 1
        ? {
              depth: target.hitbox.width,
              width: target.hitbox.depth,
          }
        : {
              depth: target.hitbox.depth,
              width: target.hitbox.width,
          };
}

export function getBlockInteractionHitboxCenter(
    target: BlockInteractionLayerTarget,
) {
    const center = {
        x: target.stack.position.x,
        z: target.stack.position.z,
    };

    if (target.block.name !== 'Block_Stone_Stairs_Half') {
        return center;
    }

    // The half stair occupies local Z=-0.5..0 instead of straddling the tile
    // center. Rotate that local center with the model so the shared instanced
    // interaction layer follows the visible edge at every quarter turn.
    const angle = target.block.rotation * (Math.PI / 2);
    const localZ = -0.25;
    const offsetX = Math.sin(angle) * localZ;
    const offsetZ = Math.cos(angle) * localZ;
    return {
        x: center.x + (Math.abs(offsetX) < 1e-12 ? 0 : offsetX),
        z: center.z + (Math.abs(offsetZ) < 1e-12 ? 0 : offsetZ),
    };
}

export function getBlockInteractionLayerBounds(
    targets: BlockInteractionLayerTarget[],
): BlockInteractionLayerBounds {
    if (targets.length === 0) {
        return {
            centerX: 0,
            centerY: 0.5,
            centerZ: 0,
            depth: 1,
            height: 1,
            width: 1,
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const target of targets) {
        const footprint = getBlockInteractionRotatedHitboxFootprint(target);
        const center = getBlockInteractionHitboxCenter(target);
        minX = Math.min(minX, center.x - footprint.width / 2);
        maxX = Math.max(maxX, center.x + footprint.width / 2);
        minY = Math.min(minY, target.stackHeight);
        maxY = Math.max(maxY, target.stackHeight + target.hitbox.height);
        minZ = Math.min(minZ, center.z - footprint.depth / 2);
        maxZ = Math.max(maxZ, center.z + footprint.depth / 2);
    }

    const margin = 0.05;

    return {
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        centerZ: (minZ + maxZ) / 2,
        depth: Math.max(maxZ - minZ + margin * 2, 1),
        height: Math.max(maxY - minY + margin * 2, 0.1),
        width: Math.max(maxX - minX + margin * 2, 1),
    };
}

export function resolveBlockInteractionLayerTarget(
    targets: BlockInteractionLayerTarget[],
    ray: Ray,
): ResolvedBlockInteractionLayerTarget | null {
    let resolvedTarget: BlockInteractionLayerTarget | null = null;
    let resolvedHitPoint: Vector3 | null = null;
    let resolvedDistanceSquared = Number.POSITIVE_INFINITY;

    for (const target of targets) {
        const footprint = getBlockInteractionRotatedHitboxFootprint(target);
        const center = getBlockInteractionHitboxCenter(target);
        hitboxMin.set(
            center.x - footprint.width / 2,
            target.stackHeight,
            center.z - footprint.depth / 2,
        );
        hitboxMax.set(
            center.x + footprint.width / 2,
            target.stackHeight + target.hitbox.height,
            center.z + footprint.depth / 2,
        );
        hitboxBounds.set(hitboxMin, hitboxMax);

        const hit = ray.intersectBox(hitboxBounds, hitboxIntersection);
        if (!hit) {
            continue;
        }

        const distanceSquared = ray.origin.distanceToSquared(hit);
        if (!resolvedTarget || distanceSquared < resolvedDistanceSquared) {
            resolvedTarget = target;
            resolvedHitPoint = hit.clone();
            resolvedDistanceSquared = distanceSquared;
        }
    }

    return resolvedTarget && resolvedHitPoint
        ? {
              hitPoint: resolvedHitPoint,
              target: resolvedTarget,
          }
        : null;
}

export function hasCloserNonLayerIntersection({
    intersections,
    layerObject,
    ray,
    resolvedHitPoint,
}: {
    intersections: readonly BlockInteractionEventIntersection[];
    layerObject: Object3D;
    ray: Ray;
    resolvedHitPoint: Vector3;
}) {
    const resolvedDistance = ray.origin.distanceTo(resolvedHitPoint);

    return intersections.some(
        (intersection) =>
            intersection.object !== layerObject &&
            !isBlockInteractionPassthrough(intersection.object) &&
            intersection.distance + closerIntersectionEpsilon <
                resolvedDistance,
    );
}
