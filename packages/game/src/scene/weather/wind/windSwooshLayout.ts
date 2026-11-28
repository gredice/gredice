import {
    rectIsFree,
    type SkyObstacles,
    type SkyView,
    type ViewRect,
} from '../skyLayout';

/**
 * Wind swooshes (GAME_ART.md "Weather > Wind"): a 190 px ribbon that ends in
 * a curl, drawn on along its length over 2.6 s while it drifts 60 px
 * downwind, then a 0.9 s rest. Free sky only; one may blow in from beyond a
 * side edge. A port of the target page's swoosh loop; pure, so a frozen
 * clock always shows the same swooshes.
 */
export const windSwooshRules = {
    /** Ribbon length on screen in pixels, at any zoom. */
    lengthPx: 190,
    /** Length of the ribbon geometry, without its curl. */
    geometryLength: 1.4,
    lifeSeconds: 2.6,
    restSeconds: 0.9,
    /** Drift downwind over one life, in pixels (none under reduced motion). */
    travelPx: 60,
    /** Clear space from the garden and other sky props. */
    marginPx: 14,
    /**
     * Spots tried per swoosh and cycle: the first beside the garden at mid
     * height (the target's), the rest anywhere, so a narrow phone view
     * still finds its gaps. Runs once per cycle, not per frame.
     */
    tries: 48,
    besideGardenTries: 10,
    /** How far past a side edge a swoosh may start (shares of its scale). */
    behindEdge: 0.6,
    aheadEdge: 0.3,
} as const;

/** The target's hash: a stable 0..1 value per number. */
export function swooshHash(n: number) {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

export type SwooshCycle = {
    /** Cycle number of this swoosh; a new cycle picks a new spot. */
    cycle: number;
    /** Share of its life drawn, 0 to 1; 1 or more while it rests. */
    progress: number;
};

/** Where swoosh `index` is in its draw-and-rest cycle at time `t`. */
export function resolveSwooshCycle(
    t: number,
    index: number,
    seed = 1,
): SwooshCycle {
    const period = windSwooshRules.lifeSeconds + windSwooshRules.restSeconds;
    const cyc = t / period + index * 0.37 + swooshHash(index + seed * 3.1);
    const cycle = Math.floor(cyc);
    return {
        cycle,
        progress: ((cyc - cycle) * period) / windSwooshRules.lifeSeconds,
    };
}

/** Scene seconds when cycle `cycle` of swoosh `index` starts drawing. */
export function resolveSwooshCycleStart(
    cycle: number,
    index: number,
    seed = 1,
) {
    const period = windSwooshRules.lifeSeconds + windSwooshRules.restSeconds;
    return (cycle - index * 0.37 - swooshHash(index + seed * 3.1)) * period;
}

/** World units per ribbon-geometry unit at a zoom. */
export function resolveSwooshScale(pixelsPerUnit: number) {
    return (
        windSwooshRules.lengthPx /
        Math.max(1e-6, pixelsPerUnit) /
        windSwooshRules.geometryLength
    );
}

/**
 * The screen rectangle a swoosh at (u, v) sweeps over its life, padded by
 * the margin. `flip` is −1 when the wind blows to the screen's left: the
 * ribbon is mirrored and drifts left.
 */
export function resolveSwooshRect(
    u: number,
    v: number,
    scale: number,
    travel: number,
    margin: number,
    flip: 1 | -1,
): ViewRect {
    const behind = 0.7 * scale + margin;
    const ahead = 0.85 * scale + travel + margin;
    const minV = v - 0.15 * scale - margin;
    const maxV = v + 0.35 * scale + margin;
    return flip === 1
        ? [u - behind, minV, u + ahead, maxV]
        : [u - ahead, minV, u + behind, maxV];
}

export type SwooshSpotInput = {
    index: number;
    cycle: number;
    seed?: number;
    view: SkyView;
    obstacles: SkyObstacles;
    /** Clouds, band and other sky props, padded. */
    placed: readonly ViewRect[];
    /** Rectangles of swooshes placed before this one. */
    taken: readonly ViewRect[];
    flip: 1 | -1;
    reducedMotion: boolean;
};

export type SwooshSpot = {
    /** Start of the ribbon's centre in view units. */
    u: number;
    v: number;
    rect: ViewRect;
};

/**
 * A free-sky spot for one swoosh cycle: first beside the garden at mid
 * height, where a swoosh reads as wind blowing past, then anywhere free.
 * Null when no free sky fits it this cycle (it skips the cycle).
 */
export function findSwooshSpot({
    cycle,
    flip,
    index,
    obstacles,
    placed,
    reducedMotion,
    seed = 1,
    taken,
    view,
}: SwooshSpotInput): SwooshSpot | null {
    const { halfHeight, halfWidth, pixelsPerUnit } = view;
    const scale = resolveSwooshScale(pixelsPerUnit);
    const travel = reducedMotion ? 0 : windSwooshRules.travelPx / pixelsPerUnit;
    const margin = windSwooshRules.marginPx / pixelsPerUnit;
    const others = placed.concat(taken);
    for (let k = 0; k < windSwooshRules.tries; k += 1) {
        const hu = swooshHash(cycle * 7.13 + index * 13.37 + k * 1.71 + seed);
        const hv = swooshHash(
            cycle * 3.77 + index * 5.91 + k * 2.39 + seed * 0.7,
        );
        const side = (index + cycle + k) % 2 ? 1 : -1;
        // Spots in "downwind is right" space, mirrored for a left wind.
        const downwindU =
            k < windSwooshRules.besideGardenTries
                ? side * (0.5 + 0.42 * hu) * halfWidth - 0.4 * scale
                : (hu * 2 - 1) * halfWidth * 0.92;
        const v =
            k < windSwooshRules.besideGardenTries
                ? (hv * 1.2 - 0.45) * halfHeight
                : (hv * 2 - 1) * halfHeight * 0.88;
        const u = flip * downwindU;
        const rect = resolveSwooshRect(u, v, scale, travel, margin, flip);
        const behindLimit = windSwooshRules.behindEdge * scale;
        const aheadLimit = windSwooshRules.aheadEdge * scale;
        const fitsSides =
            flip === 1
                ? rect[0] >= -halfWidth - behindLimit &&
                  rect[2] <= halfWidth + aheadLimit
                : rect[2] <= halfWidth + behindLimit &&
                  rect[0] >= -halfWidth - aheadLimit;
        if (!fitsSides || rect[1] < -halfHeight || rect[3] > halfHeight) {
            continue;
        }
        if (!rectIsFree(rect, obstacles, others)) continue;
        return { u, v, rect };
    }
    return null;
}

/** Downwind on screen: +1 right, −1 left, from the wind's world vector. */
export function resolveSwooshFlip(
    wind: { x: number; z: number },
    right: { x: number; z: number },
): 1 | -1 {
    const along = wind.x * right.x + wind.z * right.z;
    return along < -0.05 ? -1 : 1;
}

/** A swoosh drawing on screen: its cycle, when the cycle started, its spot. */
export type DrawingSwoosh = {
    index: number;
    cycle: number;
    /** Scene seconds when this cycle started drawing. */
    start: number;
    spot: SwooshSpot;
};

/**
 * The swooshes drawing at scene time `t`, earlier swooshes taking their
 * space first. `spotFor` finds a cycle's free-sky spot (the renderer caches
 * it per cycle). An empty list means nothing is on screen, so the layer
 * holds no render lease (plan rule: a layer with nothing visible holds none).
 */
export function resolveDrawingSwooshes(
    t: number,
    count: number,
    spotFor: (
        index: number,
        cycle: number,
        taken: readonly ViewRect[],
    ) => SwooshSpot | null,
    seed = 1,
): DrawingSwoosh[] {
    const shown: DrawingSwoosh[] = [];
    const taken: ViewRect[] = [];
    for (let index = 0; index < count; index += 1) {
        const { cycle, progress } = resolveSwooshCycle(t, index, seed);
        if (progress >= 1) continue;
        const spot = spotFor(index, cycle, taken);
        if (!spot) continue;
        taken.push(spot.rect);
        shown.push({
            index,
            cycle,
            start: resolveSwooshCycleStart(cycle, index, seed),
            spot,
        });
    }
    return shown;
}

/**
 * Cycles looked ahead per swoosh for the next one with free sky; with none
 * in that window (a farm or phone view that the garden fills) the layer
 * looks again when it ends, about half a minute later.
 */
export const swooshLookAheadCycles = 8;

export type NextSwooshInput = Omit<
    SwooshSpotInput,
    'cycle' | 'index' | 'taken'
> & {
    /** Scene seconds now. */
    t: number;
    /** Swooshes the wind and tier allow. */
    count: number;
};

/**
 * When the next swoosh starts drawing after `t`: the earliest cycle start,
 * up to `swooshLookAheadCycles` ahead per swoosh, whose cycle finds a spot
 * in free sky. `found` false gives the time to look again instead. Runs
 * once per quiet spell, never per frame.
 */
export function findNextSwooshStart({
    count,
    seed = 1,
    t,
    ...spotInput
}: NextSwooshInput): { time: number; found: boolean } {
    let best = Number.POSITIVE_INFINITY;
    let horizon = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
        const { cycle } = resolveSwooshCycle(t, index, seed);
        for (let ahead = 1; ahead <= swooshLookAheadCycles; ahead += 1) {
            const start = resolveSwooshCycleStart(cycle + ahead, index, seed);
            if (start >= best) break;
            const spot = findSwooshSpot({
                ...spotInput,
                cycle: cycle + ahead,
                index,
                seed,
                taken: [],
            });
            if (spot) {
                best = start;
                break;
            }
        }
        horizon = Math.min(
            horizon,
            resolveSwooshCycleStart(cycle + swooshLookAheadCycles, index, seed),
        );
    }
    if (best < Number.POSITIVE_INFINITY) return { time: best, found: true };
    const period = windSwooshRules.lifeSeconds + windSwooshRules.restSeconds;
    return {
        time: Number.isFinite(horizon)
            ? horizon
            : t + swooshLookAheadCycles * period,
        found: false,
    };
}
