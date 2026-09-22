import {
    type AutumnLeafBatchData,
    type AutumnTreeAnchor,
    autumnGroundCaps,
    getAutumnTreeInfluence,
    resolveSettledLeafCount,
} from '../../scene/autumnAccumulation';
import { autumnSeed } from '../../scene/autumnState';
import type { GameQualityProfileTier } from '../../scene/gameQuality';
import type { Stack } from '../../types/Stack';
import type { EntityBlockInstance } from '../EntityInstancesBlock';
import { getSlopedGroundNormalizedHeight } from '../groundSurfaceHeight';
import { getGroundDecorationBlocks } from './groundDecorationBlocks';
import {
    groundDecorationOptions,
    resolveGroundDecorationSurface,
} from './groundDecorationConfig';

export function getAutumnGroundBlocks(stacks: Stack[] | undefined) {
    return getGroundDecorationBlocks(stacks).filter(
        ({ stack, blockIndex }) =>
            !stack.blocks
                .slice(blockIndex + 1)
                .some(
                    (block) =>
                        block.name.startsWith('Block_') ||
                        block.name.startsWith('Raised_Bed'),
                ),
    );
}

export function createAutumnGroundBatches({
    instances,
    trees,
    amount,
    snow,
    tier,
    year,
    gardenId,
    windDirection,
    windSpeed,
}: {
    instances: EntityBlockInstance[];
    trees: readonly AutumnTreeAnchor[];
    amount: number;
    snow: number;
    tier: GameQualityProfileTier;
    year: number;
    gardenId: number | undefined;
    windDirection?: number;
    windSpeed?: number;
}) {
    const batches = new Map<string, AutumnLeafBatchData>();
    let total = 0;
    for (const instance of [...instances].sort((a, b) =>
        a.block.id.localeCompare(b.block.id),
    )) {
        const surface = resolveGroundDecorationSurface(instance.block.name);
        if (!surface) continue;
        const influence = getAutumnTreeInfluence(
            instance.position[0],
            instance.position[2],
            trees,
            windDirection,
            windSpeed,
        );
        const count = resolveSettledLeafCount(amount, influence, snow);
        const nearbyIds = trees
            .filter(
                (tree) =>
                    Math.hypot(
                        tree.x - instance.position[0],
                        tree.z - instance.position[2],
                    ) < 4,
            )
            .map((tree) => tree.id)
            .sort()
            .join(':');
        const seed = `${gardenId}:${instance.block.id}:${year}:${nearbyIds}`;
        const options = groundDecorationOptions[surface];
        for (
            let index = 0;
            index < count && total < autumnGroundCaps[tier];
            index++, total++
        ) {
            const x = (autumnSeed(`${seed}:${index}:x`) - 0.5) * 0.72;
            const z = (autumnSeed(`${seed}:${index}:z`) - 0.5) * 0.72;
            const height = (px: number, pz: number) =>
                getSlopedGroundNormalizedHeight(instance.block.name, px, pz) ??
                1;
            const gradientX =
                Math.round(
                    (height(x + 0.001, z) - height(x - 0.001, z)) * 2000,
                ) / 10;
            const gradientZ =
                Math.round(
                    (height(x, z + 0.001) - height(x, z - 0.001)) * 2000,
                ) / 10;
            const variants =
                tier === 'low' || tier === 'auto-constrained' ? 1 : 4;
            const variant = Math.floor(
                autumnSeed(`${seed}:${index}:yaw`) * variants,
            );
            const key = `${gradientX}:${gradientZ}:${variant}`;
            let batch = batches.get(key);
            if (!batch) {
                batch = { key, gradientX, gradientZ, variant, instances: [] };
                batches.set(key, batch);
            }
            const angle = (instance.rotation * Math.PI) / 2;
            // Sprite grass roots sit below the top; flat leaf clusters sit on the actual 0.2 mesh surface.
            batch.instances.push({
                ...instance,
                id: `${instance.id}:leaf:${index}`,
                pickupOutlineVisible: false,
                position: [
                    instance.position[0] +
                        x * Math.cos(angle) +
                        z * Math.sin(angle),
                    instance.position[1] +
                        0.2 +
                        (height(x, z) - 1) * options.angleLiftPerUnit +
                        0.012,
                    instance.position[2] -
                        x * Math.sin(angle) +
                        z * Math.cos(angle),
                ],
            });
        }
        if (total >= autumnGroundCaps[tier]) break;
    }
    return [...batches.values()];
}
