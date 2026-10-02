import type { BlockData } from '@gredice/client';
import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { getWaterBlockDepthAtLocalPosition } from '../entities/waterBlockDepth';
import {
    defaultWaterBlockVisualHeight,
    waterBlockBottomOverlap,
} from '../entities/waterBlockGeometry';
import { getWaterBlockVerticalRange } from '../entities/waterBlockHeight';
import { isWaterBlockName, waterBlockNames } from '../entities/waterBlockNames';
import { autumnSeed } from '../scene/autumnState';
import type { GameQualityProfileTier } from '../scene/gameQuality';
import type { Stack } from '../types/Stack';

// These flat assets all render a top 0.4 above their stack base, despite
// different GLB origins (grass/sand +0.2, dirt +1, polished stone +0).
const groundRippleOpacity: Readonly<Record<string, number>> = {
    Block_Sand: 0.38,
    Block_Swamp_Ground: 0.38,
    Block_Grass: 0.22,
    Block_Ground: 0.3,
    Block_Dry_Ground: 0.22,
    Block_Polished_Stone: 0.42,
};
export const rainRippleSurfaceNames = [
    ...Object.keys(groundRippleOpacity),
    ...waterBlockNames,
];
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
    water: boolean;
    opacity: number;
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
    blockData,
    gardenId,
    tier,
}: {
    instances: readonly EntityBlockInstance[];
    coveredCells: ReadonlySet<string>;
    blockData: BlockData[];
    gardenId: number | undefined;
    tier: GameQualityProfileTier;
}): RainRippleAnchor[] {
    const capacity = rainRippleCaps[tier];
    if (!capacity) return [];
    // One site per exposed block. Stable ranking avoids bias to stack order and
    // ensures a lower quality tier is a subset of the higher tier.
    const candidates = instances
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
        );
    const anchors: RainRippleAnchor[] = [];
    for (const { instance, id } of candidates) {
        if (anchors.length === capacity) break;
        const water = isWaterBlockName(instance.block.name);
        const radius = (water ? 0.1 : 0.07) + autumnSeed(`${id}:radius`) * 0.04;
        const surfaceY = water
            ? getWaterBlockVerticalRange({
                  block: instance.block,
                  stack: instance.stack,
                  blockData,
              })?.max
            : instance.stackHeight + 0.4;
        if (surfaceY === undefined) continue;
        const angle = (instance.rotation * Math.PI) / 2;
        // Retry only at shorelines. The ring's bounding square must fit on
        // exposed water, including rotated angle/corner fill blocks.
        for (let attempt = 0; attempt < (water ? 8 : 1); attempt++) {
            const suffix = attempt ? `:${attempt}` : '';
            const x = (autumnSeed(`${id}:x${suffix}`) - 0.5) * 0.44;
            const z = (autumnSeed(`${id}:z${suffix}`) - 0.5) * 0.44;
            const localX = x * Math.cos(angle) + z * Math.sin(angle);
            const localZ = -x * Math.sin(angle) + z * Math.cos(angle);
            if (
                water &&
                ![-radius, radius].every((dx) =>
                    [-radius, radius].every(
                        (dz) =>
                            getWaterBlockDepthAtLocalPosition({
                                block: instance.block,
                                stack: instance.stack,
                                blockData,
                                localX: localX + dx,
                                localZ: localZ + dz,
                            }) >
                            (waterBlockBottomOverlap + 0.004) /
                                defaultWaterBlockVisualHeight,
                    ),
                )
            )
                continue;
            anchors.push({
                id,
                position: [
                    instance.position[0] + localX,
                    surfaceY + 0.004,
                    instance.position[2] + localZ,
                ],
                phase: autumnSeed(`${id}:phase`),
                period: 1.1 + autumnSeed(`${id}:period`) * 0.8,
                radius,
                water,
                opacity: water
                    ? instance.block.name === 'Block_Swamp_Water'
                        ? 0.36
                        : 0.55
                    : groundRippleOpacity[instance.block.name],
            });
            break;
        }
    }
    return anchors;
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
