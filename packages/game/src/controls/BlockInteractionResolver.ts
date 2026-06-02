import { Box3, type Ray, Vector3 } from 'three';
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

const hitboxMin = new Vector3();
const hitboxMax = new Vector3();
const hitboxIntersection = new Vector3();
const hitboxBounds = new Box3();

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

export function resolveBlockInteractionLayerTarget(
    targets: BlockInteractionLayerTarget[],
    ray: Ray,
): ResolvedBlockInteractionLayerTarget | null {
    let resolvedTarget: BlockInteractionLayerTarget | null = null;
    let resolvedHitPoint: Vector3 | null = null;
    let resolvedDistanceSquared = Number.POSITIVE_INFINITY;

    for (const target of targets) {
        const footprint = getBlockInteractionRotatedHitboxFootprint(target);
        hitboxMin.set(
            target.stack.position.x - footprint.width / 2,
            target.stackHeight,
            target.stack.position.z - footprint.depth / 2,
        );
        hitboxMax.set(
            target.stack.position.x + footprint.width / 2,
            target.stackHeight + target.hitbox.height,
            target.stack.position.z + footprint.depth / 2,
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
