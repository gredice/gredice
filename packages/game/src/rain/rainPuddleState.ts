import type { BlockData } from '@gredice/client';
import { getEffectiveGardenStackBlockHeight } from '@gredice/js/gardenBlocks';
import { autumnSeed } from '../scene/autumnState';
import type { Stack } from '../types/Stack';
import { rainTerrainTopOffset } from './rainRippleState';

/**
 * Toy puddles (GAME_ART.md "Weather > Rain and heavy rain"): flat one-piece
 * shapes on path and bare soil only, never on grass, beds or snow, about one
 * for every four path tiles, up to the tier cap.
 */

/** Path and bare-soil tops a puddle may lie on. */
export const rainPuddleSurfaceNames: readonly string[] = [
    'Block_Ground',
    'Block_Dry_Ground',
    'Block_Sand',
    'Block_Gravel',
    'Block_Polished_Stone',
    'Block_Swamp_Ground',
];

export const rainPuddleRules = {
    /** About one puddle for this many path tiles. */
    tilesPerPuddle: 4,
    /** Long half-axis range in world units (0.2 to 0.6 long). */
    minHalfLength: 0.14,
    maxHalfLength: 0.3,
    /** Short axis as a share of the long one. */
    minAspect: 0.6,
    maxAspect: 0.76,
    /** Clearance from the tile edge, so a puddle never reaches grass. */
    edgeMargin: 0.06,
    /** Puddles sit this far above the path top. */
    lift: 0.006,
    /** Outline harmonics (second and third), together at most 10%. */
    outlineSecond: 0.06,
    outlineThird: 0.04,
    outlineWobble: 0.1,
    /** Two ripple rings per puddle every this many seconds. */
    rippleSeconds: 0.9,
    /**
     * Beside a bed, plant, animal or item a puddle keeps to the far side of
     * its tile. Diagonal neighbours count this much of a side neighbour.
     */
    diagonalAwayWeight: 0.35,
    /** Longest half-axis of a puddle that stays centred between props. */
    boxedInMaxHalfLength: 0.2,
    /**
     * Extra clearance on a side whose neighbour is not path or bare soil:
     * the grass bank blends into the path tile there.
     */
    bankMargin: 0.12,
} as const;

export type RainPuddleSite = {
    id: string;
    x: number;
    y: number;
    z: number;
    /** Half size across and along, in world units, at full growth. */
    halfWidth: number;
    halfLength: number;
    /** Yaw in radians. */
    rotation: number;
    /** Outline phase (two harmonics). */
    seed: number;
};

type PathCell = {
    x: number;
    z: number;
    top: number;
    /** Neighbouring path tiles (4-connected), 0 to 4. */
    neighbours: number;
    /** A bed, plant, animal or item stands on a neighbouring tile. */
    besideStanding: boolean;
    /**
     * Direction the puddle moves on its tile, away from what stands beside
     * it, never toward a side neighbour where something stands; (0, 0)
     * keeps it centred.
     */
    awayX: number;
    awayZ: number;
    id: string;
};

function isPuddleSurface(name: string) {
    return rainPuddleSurfaceNames.includes(name);
}

/**
 * Path tiles that can hold a puddle: the stack's top block is a path or
 * bare-soil block, so nothing stands on it.
 */
function collectPathCells(
    stacks: readonly Stack[],
    blockData: readonly BlockData[],
    gardenId: number | undefined,
) {
    const heights = new Map<string, number>();
    for (const block of blockData) {
        heights.set(
            block.information.name,
            Math.max(0, block.attributes.height ?? 0),
        );
    }
    const cells = new Map<string, PathCell>();
    const standing = new Set<string>();
    for (const stack of stacks) {
        const top = stack.blocks[stack.blocks.length - 1];
        if (top && !top.name.startsWith('Block_')) {
            standing.add(`${stack.position.x}:${stack.position.z}`);
        }
    }
    for (const stack of stacks) {
        const top = stack.blocks[stack.blocks.length - 1];
        if (!top || !isPuddleSurface(top.name)) continue;
        let base = stack.position.y;
        for (const [index, block] of stack.blocks.entries()) {
            if (index === stack.blocks.length - 1) break;
            base += getEffectiveGardenStackBlockHeight({
                blockHeight: heights.get(block.name) ?? 0,
                blockName: block.name,
                supportBlockName: stack.blocks[index - 1]?.name,
            });
        }
        const key = `${stack.position.x}:${stack.position.z}`;
        cells.set(key, {
            x: stack.position.x,
            z: stack.position.z,
            top: base + rainTerrainTopOffset,
            neighbours: 0,
            besideStanding: false,
            awayX: 0,
            awayZ: 0,
            id: `${gardenId ?? 'garden'}:${top.id}:puddle`,
        });
    }
    for (const cell of cells.values()) {
        const standsAt = (dx: number, dz: number) =>
            standing.has(`${cell.x + dx}:${cell.z + dz}`);
        let awayX = 0;
        let awayZ = 0;
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dz = -1; dz <= 1; dz += 1) {
                if ((dx !== 0 || dz !== 0) && standsAt(dx, dz)) {
                    const weight =
                        dx !== 0 && dz !== 0
                            ? rainPuddleRules.diagonalAwayWeight
                            : 1;
                    cell.besideStanding = true;
                    awayX -= dx * weight;
                    awayZ -= dz * weight;
                }
            }
        }
        // Never toward a side neighbour where something stands: the puddle
        // would hide behind it or read as lying under it.
        if (standsAt(Math.sign(awayX), 0)) awayX = 0;
        if (standsAt(0, Math.sign(awayZ))) awayZ = 0;
        const away = Math.hypot(awayX, awayZ);
        cell.awayX = away > 1e-6 ? awayX / away : 0;
        cell.awayZ = away > 1e-6 ? awayZ / away : 0;
        let neighbours = 0;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ] as const) {
            const next = cells.get(`${cell.x + dx}:${cell.z + dz}`);
            if (next && Math.abs(next.top - cell.top) < 0.01) neighbours += 1;
        }
        cell.neighbours = neighbours;
    }
    return [...cells.values()];
}

/**
 * Puddle sites for a garden: one for about every four path tiles, at most
 * `cap`, spread so no two share a tile or touch neighbouring tiles when
 * there is room. Tiles inside a path (more path neighbours) come first and
 * hold the larger puddles; a tile at the path's edge holds a small one near
 * its centre, so a puddle never reaches the grass. Stable for a garden, and
 * a lower tier's sites are the first of a higher tier's.
 */
export function createRainPuddleSites({
    blockData,
    cap,
    gardenId,
    stacks,
}: {
    blockData: readonly BlockData[];
    cap: number;
    gardenId: number | undefined;
    stacks: readonly Stack[];
}): RainPuddleSite[] {
    const limit = Math.max(0, Math.floor(cap));
    if (limit === 0) return [];
    const cells = collectPathCells(stacks, blockData, gardenId);
    const pathTiles = new Set(cells.map((cell) => `${cell.x}:${cell.z}`));
    const wanted = Math.min(
        limit,
        Math.ceil(cells.length / rainPuddleRules.tilesPerPuddle),
    );
    if (wanted === 0) return [];

    const ranked = cells
        .map((cell) => ({ cell, rank: autumnSeed(`${cell.id}:rank`) }))
        .sort(
            (a, b) =>
                b.cell.neighbours - a.cell.neighbours ||
                a.rank - b.rank ||
                a.cell.id.localeCompare(b.cell.id),
        )
        .map(({ cell }) => cell);

    const chosen: PathCell[] = [];
    const isApart = (cell: PathCell, gap: number) =>
        chosen.every(
            (other) =>
                Math.max(
                    Math.abs(other.x - cell.x),
                    Math.abs(other.z - cell.z),
                ) >= gap,
        );
    // Spread puddles out and keep them off tiles beside beds, plants,
    // animals and items (they would read as lying under them); relax both
    // only when the path has no other room.
    for (const [gap, allowStanding] of [
        [2, false],
        [1, false],
        [1, true],
    ] as const) {
        for (const cell of ranked) {
            if (chosen.length >= wanted) break;
            if (
                !chosen.includes(cell) &&
                (allowStanding || !cell.besideStanding) &&
                isApart(cell, gap)
            ) {
                chosen.push(cell);
            }
        }
    }

    const rules = rainPuddleRules;
    return chosen.map((cell) => {
        const inner = cell.neighbours >= 3;
        const sizeSeed = autumnSeed(`${cell.id}:size`);
        const boxedIn =
            cell.besideStanding && cell.awayX === 0 && cell.awayZ === 0;
        const maxHalf = boxedIn
            ? rules.boxedInMaxHalfLength
            : cell.besideStanding
              ? 0.24
              : inner
                ? rules.maxHalfLength
                : cell.neighbours === 2
                  ? 0.27
                  : 0.2;
        const halfLength =
            rules.minHalfLength + (maxHalf - rules.minHalfLength) * sizeSeed;
        const aspect =
            rules.minAspect +
            (rules.maxAspect - rules.minAspect) *
                autumnSeed(`${cell.id}:aspect`);
        // Keep the whole outline (with its wobble) on the tile.
        const reach =
            0.5 - rules.edgeMargin - halfLength * (1 + rules.outlineWobble);
        const offset = (key: string) =>
            reach > 0 ? (autumnSeed(`${cell.id}:${key}`) - 0.5) * 2 * reach : 0;
        // Beside a bed, plant or item, the puddle keeps to the far side of
        // its tile, so it never reads as lying under them; boxed in between
        // them, it stays centred and small.
        // Toward a side that is not path or bare soil, it keeps clear of the
        // grass bank as well.
        const limit = (dx: number, dz: number) =>
            Math.max(
                0,
                reach -
                    (pathTiles.has(`${cell.x + dx}:${cell.z + dz}`)
                        ? 0
                        : rules.bankMargin),
            );
        const clampSide = (value: number, dx: number, dz: number) =>
            Math.min(limit(dx, dz), Math.max(-limit(-dx, -dz), value));
        const placeX = clampSide(
            cell.besideStanding ? cell.awayX * Math.max(0, reach) : offset('x'),
            1,
            0,
        );
        const placeZ = clampSide(
            cell.besideStanding ? cell.awayZ * Math.max(0, reach) : offset('z'),
            0,
            1,
        );
        return {
            id: cell.id,
            x: cell.x + placeX,
            y: cell.top + rules.lift,
            z: cell.z + placeZ,
            halfWidth: halfLength * aspect,
            halfLength,
            rotation: autumnSeed(`${cell.id}:rotation`) * Math.PI,
            seed: autumnSeed(`${cell.id}:outline`) * 6.28,
        };
    });
}

function clampUnit(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clampUnit((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

/**
 * Ground wetness, 0 to 1, from the eased rain amount: any rain wets the
 * ground to at least 0.55 and heavy rain to 1, as in the target
 * (0.55 + 0.45 × rain). The same curve runs in the puddle shader.
 */
export function resolveRainGroundWetness(easedRain: number) {
    const rain = clampUnit(easedRain);
    return clampUnit(0.55 * smoothstep(0, 0.12, rain) + 0.45 * rain);
}

/**
 * How much the puddles show, 0 to 1: they appear as the ground wetness
 * passes 0.25 to 0.85 and fade as snow cover grows.
 */
export function resolveRainPuddleAmount(wetness: number, snowCover: number) {
    return (
        smoothstep(0.25, 0.85, clampUnit(wetness)) * (1 - clampUnit(snowCover))
    );
}

/** Puddle size, 0.55 to 1 of full, growing as wetness passes 0.4 to 1. */
export function resolveRainPuddleGrowth(wetness: number) {
    return 0.55 + 0.45 * smoothstep(0.4, 1, clampUnit(wetness));
}

/** Ripple strength in puddles, 0 to 1: rings while rainy passes 0.05 to 0.4. */
export function resolveRainPuddleRipples(rainy: number) {
    return smoothstep(0.05, 0.4, clampUnit(rainy));
}
