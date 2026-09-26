import type { BlockData } from '@gredice/client';
import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { autumnSeed } from '../scene/autumnState';
import type { GameQualityProfileTier } from '../scene/gameQuality';
import type { Stack } from '../types/Stack';

// Flat surfaces with an existing rain overlay and a top at local y=0.2.
export const rainRippleSurfaceNames = ['Block_Sand', 'Block_Swamp_Ground'];
export const rainRippleCaps = {
    low: 0,
    'auto-constrained': 0,
    medium: 24,
    high: 48,
    custom: 32,
} satisfies Record<GameQualityProfileTier, number>;

export type RainRippleAnchor = {
    id: string;
    position: [number, number, number];
    phase: number;
    period: number;
    radius: number;
};

/** Conservative cover mask: occupied footprints plus clearance for overhangs. */
export function getRainCoveredCells(
    stacks: readonly Stack[],
    blockData: readonly BlockData[],
) {
    const covered = new Set<string>();
    const definitions = new Map(
        blockData.map((block) => [block.information.name, block]),
    );
    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.name.startsWith('Block_')) continue;
            const clearance = /^(Tree|Pine|Palm|Shade|BeachUmbrella)/.test(
                block.name,
            )
                ? 2
                : 1;
            for (const offset of getGardenBlockFootprintOffsets(
                definitions.get(block.name),
                block.rotation,
            )) {
                for (let x = -clearance; x <= clearance; x++) {
                    for (let z = -clearance; z <= clearance; z++) {
                        covered.add(
                            `${stack.position.x + offset.x + x}:${stack.position.z + offset.y + z}`,
                        );
                    }
                }
            }
        }
    }
    return covered;
}

export function createRainRippleAnchors({
    instances,
    coveredCells,
    gardenId,
    tier,
}: {
    instances: readonly EntityBlockInstance[];
    coveredCells: ReadonlySet<string>;
    gardenId: number | undefined;
    tier: GameQualityProfileTier;
}): RainRippleAnchor[] {
    const capacity = rainRippleCaps[tier];
    if (!capacity) return [];
    // One site per exposed block. Stable ranking avoids bias to stack order and
    // ensures a lower quality tier is a subset of the higher tier.
    return instances
        .filter(
            ({ block, blockIndex, stack, pickupOutlineVisible }) =>
                rainRippleSurfaceNames.includes(block.name) &&
                blockIndex === stack.blocks.length - 1 &&
                !pickupOutlineVisible &&
                !coveredCells.has(`${stack.position.x}:${stack.position.z}`),
        )
        .map((instance) => ({
            instance,
            id: `${gardenId}:${instance.block.id}:rain-ripple`,
        }))
        .sort(
            (a, b) =>
                autumnSeed(a.id) - autumnSeed(b.id) || a.id.localeCompare(b.id),
        )
        .slice(0, capacity)
        .map(({ instance, id }) => {
            const x = (autumnSeed(`${id}:x`) - 0.5) * 0.44;
            const z = (autumnSeed(`${id}:z`) - 0.5) * 0.44;
            const angle = (instance.rotation * Math.PI) / 2;
            return {
                id,
                position: [
                    instance.position[0] +
                        x * Math.cos(angle) +
                        z * Math.sin(angle),
                    instance.position[1] + 0.204,
                    instance.position[2] -
                        x * Math.sin(angle) +
                        z * Math.cos(angle),
                ],
                phase: autumnSeed(`${id}:phase`),
                period: 1.1 + autumnSeed(`${id}:period`) * 0.8,
                radius: 0.07 + autumnSeed(`${id}:radius`) * 0.04,
            };
        });
}

export function rainRipplesEnabled({
    enabled,
    reducedMotion,
    snow,
    tier,
}: {
    enabled: boolean;
    reducedMotion: boolean;
    snow: number;
    tier: GameQualityProfileTier;
}) {
    return (
        enabled &&
        !reducedMotion &&
        Number.isFinite(snow) &&
        snow < 0.01 &&
        rainRippleCaps[tier] > 0
    );
}
