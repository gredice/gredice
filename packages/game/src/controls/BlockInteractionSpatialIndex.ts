import { Box3, Vector3 } from 'three';
import type { GardenSpatialIndex } from '../spatial/GardenSpatialIndex';
import {
    type BlockInteractionLayerTarget,
    getBlockInteractionHitboxCenter,
    getBlockInteractionRotatedHitboxFootprint,
} from './BlockInteractionResolver';

const boundsByTarget = new WeakMap<BlockInteractionLayerTarget, Box3>();

/** Synchronize only changed bounds; unchanged chunks keep their entries. */
export function syncBlockInteractionSpatialIndex(
    index: GardenSpatialIndex<BlockInteractionLayerTarget>,
    targets: readonly BlockInteractionLayerTarget[],
) {
    if (index.version === 0) index.metrics.rebuilds++;
    const keys = new Set<string>();
    targets.forEach((target, order) => {
        keys.add(target.key);
        let bounds = boundsByTarget.get(target);
        if (!bounds) {
            const footprint = getBlockInteractionRotatedHitboxFootprint(target);
            const center = getBlockInteractionHitboxCenter(target);
            bounds = new Box3(
                new Vector3(
                    center.x - footprint.width / 2,
                    target.stackHeight,
                    center.z - footprint.depth / 2,
                ),
                new Vector3(
                    center.x + footprint.width / 2,
                    target.stackHeight + target.hitbox.height,
                    center.z + footprint.depth / 2,
                ),
            );
            boundsByTarget.set(target, bounds);
        }
        index.upsert({ bounds, key: target.key, order, value: target });
    });
    for (const key of index.keys()) if (!keys.has(key)) index.remove(key);
}
