import {
    type AutumnLeafBatchData,
    type AutumnTreeAnchor,
    getAutumnTreeInfluence,
} from '../../scene/autumnAccumulation';
import { autumnSeed } from '../../scene/autumnState';
import type { GameQualityProfileTier } from '../../scene/gameQuality';
import { getRaisedBedFootprintSegments } from '../../utils/raisedBedBlocks';
import type { EntityBlockInstance } from '../EntityInstancesBlock';
import { autumnLeafSurfaces } from './autumnLeafSurfaces';

export const autumnEntityCaps = {
    low: 24,
    'auto-constrained': 48,
    medium: 96,
    high: 160,
    custom: 128,
} satisfies Record<GameQualityProfileTier, number>;

export function createAutumnEntityBatches({
    instances,
    trees,
    amount,
    snow,
    tier,
    year,
    gardenId,
}: {
    instances: readonly EntityBlockInstance[];
    trees: readonly AutumnTreeAnchor[];
    amount: number;
    snow: number;
    tier: GameQualityProfileTier;
    year: number;
    gardenId: number | undefined;
}) {
    const batches = new Map<string, AutumnLeafBatchData>();
    if (![amount, snow].every(Number.isFinite)) return [];
    let total = 0;
    for (const instance of [...instances].sort((a, b) =>
        a.block.id.localeCompare(b.block.id),
    )) {
        const surfaces = autumnLeafSurfaces[instance.block.name];
        if (
            !surfaces ||
            instance.stack.blocks
                .slice(instance.blockIndex + 1)
                .some((block) => block.name.startsWith('Block_'))
        )
            continue;
        const influence = getAutumnTreeInfluence(
            instance.position[0],
            instance.position[2],
            trees,
        );
        const density =
            Math.min(1, Math.max(0, amount)) *
            influence *
            (1 - Math.min(1, Math.max(0, snow))) ** 2;
        const seed = `${gardenId}:${instance.block.id}:${year}`;
        const ordered = [...surfaces].sort(
            (a, b) =>
                autumnSeed(`${seed}:${a.id}`) - autumnSeed(`${seed}:${b.id}`),
        );
        const count = Math.round(ordered.length * density);
        const segments =
            instance.block.name === 'Raised_Bed'
                ? getRaisedBedFootprintSegments(instance.rotation)
                : [
                      {
                          blockIndex: 0,
                          offset: { x: 0, z: 0 },
                          shapeRotation: instance.rotation,
                      },
                  ];
        for (const segment of segments) {
            for (const surface of ordered.slice(0, count)) {
                if (total >= autumnEntityCaps[tier])
                    return [...batches.values()];
                const variant =
                    tier === 'low' || tier === 'auto-constrained'
                        ? 0
                        : Math.floor(
                              autumnSeed(`${seed}:${surface.id}:yaw`) * 2,
                          );
                const gradientX = surface.gradientX ?? 0;
                const gradientZ = surface.gradientZ ?? 0;
                const key = `${gradientX}:${gradientZ}:${variant}`;
                let batch = batches.get(key);
                if (!batch) {
                    batch = {
                        key,
                        gradientX,
                        gradientZ,
                        variant,
                        scale: 0.45,
                        instances: [],
                    };
                    batches.set(key, batch);
                }
                const [x, y, z] = surface.position;
                const angle = (segment.shapeRotation * Math.PI) / 2;
                batch.instances.push({
                    ...instance,
                    id: `${instance.id}:autumn:${segment.blockIndex}:${surface.id}`,
                    pickupOutlineVisible: false,
                    rotation: segment.shapeRotation,
                    position: [
                        instance.position[0] +
                            segment.offset.x +
                            x * Math.cos(angle) +
                            z * Math.sin(angle),
                        instance.position[1] + y + 0.006,
                        instance.position[2] +
                            segment.offset.z -
                            x * Math.sin(angle) +
                            z * Math.cos(angle),
                    ],
                });
                total++;
            }
        }
    }
    return [...batches.values()];
}
