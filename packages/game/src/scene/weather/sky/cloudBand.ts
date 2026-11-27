import type { SkyObstacles } from '../skyLayout';

/*
 * The cloud band (GAME_ART.md "Weather > Clouds and overcast" and "The
 * cloud band", user feedback 2026-11-24): soft, misty clouds that live only
 * in a band across the top of the view, the continuous overcast deck and
 * the haze. A port of the revised target's maths (`band.part.js` and the
 * cloud part of `update()` in `docs/game-party-style/weather-scene.html`).
 *
 * Everything here is pure: the band's per-column limit is computed once per
 * layout (camera, viewport or weather change), the cloud positions once per
 * frame from how far the band has drifted. Pixels are CSS pixels from the
 * top-left corner of the view, y down, as in the target.
 */

/** Separate clouds the shader can draw at most (the high tier's cap). */
export const bandCloudCapacity = 10;
/** Soft lobes per cloud. */
export const bandCloudLobes = 12;
/** Screen columns the band's lower limit is sampled at. */
export const bandColumns = 48;

/** Rules in pixels and cover amounts, from the target. */
export const cloudBandRules = {
    /** Share of the view height the band takes: clear sky to full cover. */
    share: [0.3, 0.35],
    /** Most the band may hang over the garden: share of the view height. */
    overGardenShare: 0.1,
    /**
     * Band opacity where it hangs over the garden (decision D1): translucent
     * there, so roofs, trees and animals show through (the target: 0.55).
     */
    overGardenOpacity: 0.5,
    /** Columns the limit is eroded and smoothed over on each side. */
    limitReach: 7,
    /** The deck fades in over this cover range. */
    deckRamp: [0.62, 0.86],
    /** Thunder always has a deck to hang its bolt from. */
    thunderCover: 0.86,
    /** Strip the clouds drift along: wider than the view by this. */
    stripExtraPx: 620,
    stripMinPx: 900,
    stripOffsetPx: 310,
    /** Fade in or out over this long (reduced motion: the short one). */
    fadeSeconds: 1.5,
    reducedFadeSeconds: 0.25,
    /** A joining cloud grows from this share of its size. */
    growFrom: 0.86,
    /** A cloud joins over this much cover above its threshold. */
    joinRamp: 0.05,
    /** The rain and storm decks lean cooler and greyer (still light). */
    rainGrey: 0.22,
} as const;

/**
 * The order clouds join as cover grows: [cover threshold, start along the
 * strip (share), height in the band (0 high, 1 low)]. One to three up to
 * cover 0.3, more and grouping to 0.7, the deck from 0.8.
 */
export const bandCloudOrder: readonly (readonly [
    threshold: number,
    start: number,
    height: number,
])[] = [
    [0.05, 0.22, 0.55],
    [0.15, 0.72, 0.25],
    [0.25, 0.46, 0.9],
    [0.34, 0.95, 0.7],
    [0.42, 0.06, 0.2],
    [0.5, 0.6, 0.8],
    [0.58, 0.34, 0.35],
    [0.66, 0.84, 0.95],
    [0.72, 0.14, 0.75],
    [0.78, 0.53, 0.1],
];

export type BandCloudKind = 'cumulus' | 'strato' | 'fractus';
const bandCloudKinds: readonly BandCloudKind[] = [
    'cumulus',
    'strato',
    'fractus',
];

/** One lobe: centre x and y, radius x and y (local px, base at y = 0), weight. */
export type BandCloudLobe = readonly [
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    weight: number,
];

export type BandCloudShape = {
    kind: BandCloudKind;
    /** Width and height in px at scale 1. */
    width: number;
    height: number;
    lobes: BandCloudLobe[];
    /** Local bounds: min x, min y, max x, max y. */
    box: readonly [number, number, number, number];
    /** Start along the strip (share) and height in the band (0 to 1). */
    start: number;
    level: number;
    /** Opacity and tone offsets (±10%), drift speed (0.6 to 1.4×). */
    opacity: number;
    tone: number;
    speed: number;
    /** Shape-change phase in seconds. */
    phase: number;
    /** How much the soft edge frays (fractus most). */
    erosion: number;
};

/** The target's seeded random generator. */
export function mulberry32(seed: number) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

/**
 * One seeded cloud: a cumulus (flat ragged base row, irregular dome and
 * small turrets), a stratocumulus (wide, flat, lumpy layer) or a fractus
 * (a few torn, thin pieces), with thin wisps trailing off its sides.
 */
export function createBandCloudShape(index: number, seed = 1): BandCloudShape {
    const r = mulberry32(seed * 7331 + index * 389 + 11);
    const kind = bandCloudKinds[(index + seed) % 3] ?? 'cumulus';
    const lobes: BandCloudLobe[] = [];
    let width: number;
    let height: number;
    if (kind === 'cumulus') {
        width = lerp(250, 460, r());
        height = width * lerp(0.4, 0.5, r());
        const baseCount = 3;
        for (let k = 0; k < baseCount; k += 1) {
            const f = (k + 0.5) / baseCount;
            lobes.push([
                lerp(-0.34, 0.34, f) * width + (r() - 0.5) * 0.06 * width,
                -0.22 * height,
                lerp(0.19, 0.26, r()) * width,
                lerp(0.3, 0.38, r()) * height,
                lerp(0.8, 1, r()),
            ]);
        }
        const peak = (r() - 0.5) * 0.3;
        const domeCount = 4 + Math.floor(r() * 2);
        for (let k = 0; k < domeCount; k += 1) {
            const xn =
                lerp(-0.3, 0.3, (k + 0.5) / domeCount) + (r() - 0.5) * 0.1;
            const profile = Math.max(0, 1 - ((xn - peak) / 0.5) ** 2);
            const radius =
                lerp(0.11, 0.21, profile) * width * lerp(0.85, 1.15, r());
            const top = -height * lerp(0.5, 1, profile) * lerp(0.86, 1, r());
            lobes.push([
                xn * width,
                top + radius * 0.9,
                radius,
                radius * lerp(0.8, 1, r()),
                lerp(0.8, 1.05, r()),
            ]);
        }
        // Small turrets sunk into the dome: an irregular, cauliflower top.
        const turretCount = 1 + Math.floor(r() * 2);
        const dome = lobes.slice(baseCount);
        for (let k = 0; k < turretCount; k += 1) {
            const [dx, dy, dr] = dome[Math.floor(r() * dome.length)] ?? [
                0, 0, 0,
            ];
            const angle = lerp(-1.1, 1.1, r());
            const radius = lerp(0.45, 0.6, r()) * dr;
            lobes.push([
                dx + Math.sin(angle) * dr * 0.75,
                dy - Math.cos(angle) * dr * 0.75,
                radius,
                radius * 0.9,
                lerp(0.75, 0.95, r()),
            ]);
        }
    } else if (kind === 'strato') {
        width = lerp(340, 520, r());
        height = width * lerp(0.25, 0.33, r());
        const count = 6 + Math.floor(r() * 3);
        for (let k = 0; k < count; k += 1) {
            const xn = lerp(-0.4, 0.4, (k + 0.5) / count) + (r() - 0.5) * 0.06;
            const end = 1 - Math.abs(xn) / 0.5;
            const radiusX = lerp(0.09, 0.15, r()) * width;
            const radiusY = lerp(0.4, 0.6, r()) * height * lerp(0.65, 1, end);
            lobes.push([
                xn * width,
                -radiusY * lerp(0.75, 1, r()),
                radiusX,
                radiusY,
                lerp(0.75, 1, r()),
            ]);
        }
        const turretCount = 1 + Math.floor(r() * 2);
        for (let k = 0; k < turretCount; k += 1) {
            const radius = lerp(0.07, 0.11, r()) * width;
            lobes.push([
                (r() - 0.5) * 0.5 * width,
                -height + radius,
                radius,
                radius * 0.85,
                lerp(0.7, 0.9, r()),
            ]);
        }
    } else {
        width = lerp(180, 300, r());
        height = width * lerp(0.25, 0.32, r());
        const count = 4 + Math.floor(r() * 3);
        for (let k = 0; k < count; k += 1) {
            const xn =
                lerp(-0.36, 0.36, (k + 0.5) / count) + (r() - 0.5) * 0.12;
            lobes.push([
                xn * width,
                -height * lerp(0.35, 0.65, r()),
                lerp(0.12, 0.2, r()) * width,
                lerp(0.32, 0.5, r()) * height,
                lerp(0.6, 0.85, r()),
            ]);
        }
    }
    // Thin wisps trailing off one or both sides.
    const wispCount = r() < 0.3 ? 0 : r() < 0.6 ? 1 : 2;
    let side = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < wispCount && lobes.length < bandCloudLobes; k += 1) {
        lobes.push([
            side * lerp(0.42, 0.58, r()) * width,
            -height * lerp(0.12, 0.35, r()),
            lerp(0.2, 0.3, r()) * width,
            lerp(0.035, 0.055, r()) * width,
            lerp(0.28, 0.4, r()),
        ]);
        side = -side;
    }
    lobes.length = Math.min(lobes.length, bandCloudLobes);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const [x, y, radiusX, radiusY] of lobes) {
        minX = Math.min(minX, x - radiusX * 1.08);
        minY = Math.min(minY, y - radiusY * 1.08);
        maxX = Math.max(maxX, x + radiusX * 1.08);
    }
    const order = bandCloudOrder[index] ?? [1, 0, 0.5];
    return {
        kind,
        width,
        height,
        lobes,
        box: [minX, minY, maxX, 0.25 * height],
        start: order[1] + (r() - 0.5) * 0.06,
        level: order[2],
        opacity: lerp(0.9, 1.1, r()),
        tone: lerp(-0.1, 0.1, r()),
        speed: lerp(0.6, 1.4, r()),
        phase: r() * 60,
        erosion: kind === 'fractus' ? 1.5 : kind === 'strato' ? 1.1 : 0.9,
    };
}

/** Every cloud the band can show, seeded once. */
export function createBandCloudShapes(seed = 1) {
    return Array.from({ length: bandCloudCapacity }, (_, index) =>
        createBandCloudShape(index, seed),
    );
}

/**
 * Cloud cover the band draws: thunder always has the deck to hang its bolt
 * from (GAME_ART: "Thunder with little cloud still shows a cloud for it").
 * Band clouds drift, so only the deck's lip can hold a fixed anchor.
 * `storm` is 0 to 1: the thunder flag (1 while it thunders) or the damped
 * storm amount.
 */
export function resolveBandCover(cloudy: number, storm: number) {
    return Math.max(
        clamp01(cloudy),
        cloudBandRules.thunderCover * clamp01(storm),
    );
}

/** How much of the overcast deck shows, 0 to 1. */
export function resolveDeckAmount(cover: number) {
    return smoothstep(
        cloudBandRules.deckRamp[0],
        cloudBandRules.deckRamp[1],
        cover,
    );
}

/**
 * The haze toward the cloud tone at the top of the view: up to about 14%
 * at the band under full cover, gone by mid-screen (the shader fades it).
 */
export function resolveCloudHaze(cover: number) {
    return (
        smoothstep(0.05, 0.3, cover) *
        lerp(0.05, 0.14, smoothstep(0.3, 0.86, cover))
    );
}

/** Where the deck's soft lower edge starts fading (px above the limit). */
export function resolveDeckFade(limitPx: number) {
    return Math.min(80, Math.max(34, 0.42 * limitPx));
}

/** The deck's mean lip at a column limit: a little inside its soft edge. */
export function resolveDeckLip(limitPx: number) {
    return limitPx - 0.8 * resolveDeckFade(limitPx);
}

export type CloudBandShape = {
    /** View size in CSS px. */
    widthPx: number;
    heightPx: number;
    /** Cover and deck amount the shape was made for. */
    cover: number;
    deck: number;
    /** The band's depth without a garden in the way (px). */
    sharePx: number;
    /** The band's lower limit per screen column (px from the top). */
    limitsPx: number[];
    /**
     * Top of the garden per screen column (px from the top), Infinity where
     * no garden is under that column.
     */
    gardenTopPx: number[];
    maxLimitPx: number;
    minLimitPx: number;
    /** How far the band hangs over the garden at most (px). */
    overGardenPx: number;
};

/**
 * The band's lower limit per screen column: the top 30% of the view (35%
 * under full cover), and no more than 10% of the view height below the
 * garden footprint's top in that column (a tree, the far rim). Eroded, then
 * smoothed, so it never passes the raw limit.
 */
export function resolveCloudBandShape({
    cover,
    halfHeight,
    halfWidth,
    obstacles,
    pixelsPerUnit,
}: {
    cover: number;
    halfHeight: number;
    halfWidth: number;
    obstacles: Pick<SkyObstacles, 'columns' | 'columnBounds' | 'hull'>;
    pixelsPerUnit: number;
}): CloudBandShape {
    const widthPx = 2 * halfWidth * pixelsPerUnit;
    const heightPx = 2 * halfHeight * pixelsPerUnit;
    const deck = resolveDeckAmount(cover);
    const sharePx =
        lerp(cloudBandRules.share[0], cloudBandRules.share[1], deck) * heightPx;
    const polygons = [obstacles.hull, ...obstacles.columns];
    const bounds = [null, ...obstacles.columnBounds];
    const gardenTopPx: number[] = [];
    for (let column = 0; column < bandColumns; column += 1) {
        const u = -halfWidth + ((column + 0.5) / bandColumns) * 2 * halfWidth;
        let top = Number.NEGATIVE_INFINITY;
        polygons.forEach((polygon, index) => {
            const box = bounds[index];
            if (box && (u < box[0] || u > box[2] || box[3] <= top)) return;
            for (let k = 0; k < polygon.length; k += 1) {
                const a = polygon[k];
                const b = polygon[(k + 1) % polygon.length];
                if (!a || !b) continue;
                const [u0, v0] = a;
                const [u1, v1] = b;
                if ((u0 - u) * (u1 - u) > 0 || u0 === u1) continue;
                top = Math.max(top, v0 + ((u - u0) / (u1 - u0)) * (v1 - v0));
            }
        });
        gardenTopPx.push(
            top > Number.NEGATIVE_INFINITY
                ? Math.max(0, (halfHeight - top) * pixelsPerUnit)
                : Number.POSITIVE_INFINITY,
        );
    }
    const overGarden = cloudBandRules.overGardenShare * heightPx;
    const raw = gardenTopPx.map((top) => Math.min(sharePx, top + overGarden));
    const reach = cloudBandRules.limitReach;
    const eroded = raw.map((_, column) =>
        Math.min(...raw.slice(Math.max(0, column - reach), column + reach + 1)),
    );
    const limitsPx = eroded.map((_, column) => {
        const window = eroded.slice(
            Math.max(0, column - reach + 1),
            column + reach,
        );
        return window.reduce((sum, value) => sum + value, 0) / window.length;
    });
    let overGardenPx = 0;
    limitsPx.forEach((limit, column) => {
        const top = gardenTopPx[column] ?? Number.POSITIVE_INFINITY;
        if (top < Number.POSITIVE_INFINITY) {
            overGardenPx = Math.max(overGardenPx, limit - top);
        }
    });
    return {
        widthPx,
        heightPx,
        cover,
        deck,
        sharePx,
        limitsPx,
        gardenTopPx,
        maxLimitPx: Math.max(...limitsPx),
        minLimitPx: Math.min(...limitsPx),
        overGardenPx: Math.max(0, overGardenPx),
    };
}

/** The band's lower limit at a screen x (px), between column samples. */
export function resolveBandLimitAt(shape: CloudBandShape, xPx: number) {
    const f = Math.min(
        bandColumns - 1,
        Math.max(0, (xPx / Math.max(1, shape.widthPx)) * bandColumns - 0.5),
    );
    const c0 = Math.floor(f);
    const c1 = Math.min(bandColumns - 1, c0 + 1);
    return lerp(shape.limitsPx[c0] ?? 0, shape.limitsPx[c1] ?? 0, f - c0);
}

function minBandLimit(shape: CloudBandShape, x0: number, x1: number) {
    let lowest = Number.POSITIVE_INFINITY;
    for (let x = Math.max(0, x0); x <= Math.min(shape.widthPx, x1); x += 8) {
        lowest = Math.min(lowest, resolveBandLimitAt(shape, x));
    }
    return lowest === Number.POSITIVE_INFINITY ? shape.sharePx : lowest;
}

/** Whether cloud `index` wants to show at this cover, 0 to 1 (continuous). */
export function resolveBandCloudWant({
    cap,
    cover,
    index,
    thunder,
}: {
    cap: number;
    cover: number;
    index: number;
    thunder: boolean;
}) {
    const order = bandCloudOrder[index];
    if (!order || index >= cap) return 0;
    if (index === 0 && thunder) return 1;
    return smoothstep(order[0], order[0] + cloudBandRules.joinRamp, cover);
}

/**
 * Steps a cloud's presence toward what it wants: a straight ramp over
 * 1.5 s (250 ms under reduced motion), eased when drawn. No overshoot.
 */
export function stepBandCloudPresence(
    presence: number,
    want: number,
    deltaSeconds: number,
    { frozen, reducedMotion }: { frozen: boolean; reducedMotion: boolean },
) {
    if (frozen) return want;
    const fade = reducedMotion
        ? cloudBandRules.reducedFadeSeconds
        : cloudBandRules.fadeSeconds;
    const step = Math.max(0, deltaSeconds) / fade;
    return presence + Math.max(-step, Math.min(step, want - presence));
}

/** A drawn cloud: its base centre (px), scale and opacity. */
export type BandCloudPlacement = {
    x: number;
    base: number;
    scale: number;
    alpha: number;
};

/**
 * Where a cloud is once the band has drifted `travelPx`: it drifts along a
 * strip wider than the view at its own share of the band's speed, toward
 * the side the band drifts (`resolveCloudDrift`, shared with the cloud
 * shadows), and wraps round off-screen; its soft, ragged underside ends
 * inside the band where it is. Scattered clouds keep clear of the garden
 * when they can still show most of their height; under the deck they gather
 * along its lower edge as its lower masses.
 */
export function placeBandCloud(
    cloud: BandCloudShape,
    shape: CloudBandShape,
    {
        presence,
        reducedMotion,
        travelPx,
    }: {
        presence: number;
        reducedMotion: boolean;
        /**
         * How far the band has drifted along screen x, px at its base speed,
         * signed (`resolveCloudDrift`, `stepCloudDriftTravel`).
         */
        travelPx: number;
    },
): BandCloudPlacement | null {
    const p = smoothstep(0, 1, presence);
    if (p < 0.004) return null;
    const sizeScale = Math.min(
        1,
        Math.max(0.72, 0.6 + (0.4 * shape.maxLimitPx) / 240),
    );
    const scale =
        sizeScale * (reducedMotion ? 1 : lerp(cloudBandRules.growFrom, 1, p));
    const strip =
        Math.max(shape.widthPx, cloudBandRules.stripMinPx) +
        cloudBandRules.stripExtraPx;
    const x =
        ((((cloud.start * strip + travelPx * cloud.speed) % strip) + strip) %
            strip) -
        cloudBandRules.stripOffsetPx;
    const x0 = x + cloud.box[0] * scale;
    const x1 = x + cloud.box[2] * scale;
    const limit = minBandLimit(shape, x0, x1);
    let lowest = limit - 0.2 * cloud.height * scale;
    let gardenTop = Number.POSITIVE_INFINITY;
    for (let column = 0; column < bandColumns; column += 1) {
        const cx = ((column + 0.5) / bandColumns) * shape.widthPx;
        if (cx >= x0 && cx <= x1) {
            gardenTop = Math.min(
                gardenTop,
                shape.gardenTopPx[column] ?? Number.POSITIVE_INFINITY,
            );
        }
    }
    if (gardenTop - 8 >= 0.6 * cloud.height * scale) {
        lowest = lerp(Math.min(lowest, gardenTop - 8), lowest, shape.deck);
    }
    // Whole clouds where the band is deep enough; tall ones run off the
    // top edge.
    const highest = Math.min(
        lowest,
        Math.max(cloud.height * scale + 8, 0.45 * limit),
    );
    const base = lerp(
        lerp(highest, lowest, cloud.level),
        lowest - 0.1 * limit * (1 - cloud.level),
        shape.deck,
    );
    return { x, base, scale, alpha: p * cloud.opacity };
}
