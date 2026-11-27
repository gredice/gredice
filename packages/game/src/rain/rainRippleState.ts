import type { BlockData } from '@gredice/client';
import {
    getEffectiveGardenStackBlockHeight,
    getGardenBlockFootprintOffsets,
} from '@gredice/js/gardenBlocks';
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
import { rainSplashLook } from '../scene/Rain/rainParticles';
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

/*
 * Party-style splash rings (GAME_ART.md "Weather > Rain and heavy rain"):
 * light rings with a blue edge where drops land on ground or bed soil, never
 * on props. The rings are placed in the vertex shader from a list of
 * landing cells, so they land on grass too, where no per-block ripple ever
 * mounted. Water keeps its per-block ripples above.
 */

/** Flat terrain tops a drop can splash on (no slopes, water or snow). */
export const rainSplashTerrainNames: readonly string[] = [
    'Block_Grass',
    'Block_Ground',
    'Block_Dry_Ground',
    'Block_Sand',
    'Block_Gravel',
    'Block_Swamp_Ground',
    'Block_Polished_Stone',
    'Block_Stone',
];

/** Flat terrain tops render this far above their stack base. */
export const rainTerrainTopOffset = 0.4;

export const rainSplashCellRules = {
    /**
     * Rings land within this distance of a terrain cell's centre, so a full
     * ring (radius 0.12) stays 0.03 inside its own tile: never over the
     * island edge or onto a neighbouring tile where something stands.
     */
    terrainHalfExtent: 0.5 - rainSplashLook.radius - 0.03,
    /** Bed soil sits this far above the terrain top, inside the planks. */
    bedSoilHeight: 0.25,
    /** A full ring on bed soil reaches 0.42 from the centre, inside the planks. */
    bedHalfExtent: 0.3,
} as const;

export type RainSplashCell = {
    x: number;
    y: number;
    z: number;
    /** Rings land within ± this of the centre in x and z. */
    halfExtent: number;
    kind: 'ground' | 'bed';
};

function isRaisedBedBlockName(name: string) {
    return name.startsWith('Raised_Bed');
}

function blockHeightLookup(blockData: readonly BlockData[]) {
    const heights = new Map<string, number>();
    for (const block of blockData) {
        heights.set(
            block.information.name,
            Math.max(0, block.attributes.height ?? 0),
        );
    }
    return (name: string) => heights.get(name) ?? 0;
}

/**
 * Landing cells for splash rings: every exposed flat terrain top and the
 * soil of every raised bed; a cell where anything else stands (a plant,
 * animal home or item) gets none. Recompute when the stacks change.
 */
export function createRainSplashCells(
    stacks: readonly Stack[],
    blockData: readonly BlockData[],
): RainSplashCell[] {
    const heightOf = blockHeightLookup(blockData);
    const cells: RainSplashCell[] = [];
    for (const stack of stacks) {
        const { x, z } = stack.position;
        const blocks = stack.blocks;
        const top = blocks[blocks.length - 1];
        if (!top) continue;
        let height = stack.position.y;
        for (const [index, block] of blocks.entries()) {
            if (index === blocks.length - 1) break;
            height += getEffectiveGardenStackBlockHeight({
                blockHeight: heightOf(block.name),
                blockName: block.name,
                supportBlockName: blocks[index - 1]?.name,
            });
        }
        if (rainSplashTerrainNames.includes(top.name)) {
            cells.push({
                x,
                y: height + rainTerrainTopOffset,
                z,
                halfExtent: rainSplashCellRules.terrainHalfExtent,
                kind: 'ground',
            });
            continue;
        }
        const support = blocks[blocks.length - 2];
        if (
            isRaisedBedBlockName(top.name) &&
            support &&
            rainSplashTerrainNames.includes(support.name)
        ) {
            // `height` is the bed's base: the top of the terrain below it.
            const terrainTop =
                height - heightOf(support.name) + rainTerrainTopOffset;
            cells.push({
                x,
                y: terrainTop + rainSplashCellRules.bedSoilHeight,
                z,
                halfExtent: rainSplashCellRules.bedHalfExtent,
                kind: 'bed',
            });
        }
    }
    return cells;
}
