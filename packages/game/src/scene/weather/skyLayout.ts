import {
    type CloudBandShape,
    resolveBandCover,
    resolveBandLimitAt,
    resolveCloudBandShape,
    resolveDeckAmount,
    resolveDeckLip,
} from './sky/cloudBand';

/**
 * Where sky props go (GAME_ART.md "Weather > Three layers"). Clouds live
 * only in the band across the top of the view (`sky/cloudBand.ts`, user
 * feedback 2026-11-24): this layout computes the band's lower limit per
 * screen column, reserves the band so swooshes and sky mist rolls keep to
 * the free sky below it, and hangs the storm bolt from the deck's lip. A
 * port of the target page's maths (`docs/game-party-style/weather-scene.html`:
 * `convexHull`, `rectHitsPolygon`, `findFreeSpot`, the band limit and the
 * bolt-anchor search). Pure functions of the view size, pixels per unit,
 * camera basis and footprint, so layouts are computed once per camera or
 * weather change, never per frame.
 *
 * View units: world units on the screen plane from the view centre, `u` to
 * the right and `v` up. Pixels are CSS pixels (`u × pixelsPerUnit`).
 */

export type ViewPoint = readonly [u: number, v: number];
export type ViewPolygon = readonly ViewPoint[];
/** An axis-aligned view rectangle: min u, min v, max u, max v. */
export type ViewRect = readonly [
    minU: number,
    minV: number,
    maxU: number,
    maxV: number,
];

export type Vec3Like = { x: number; y: number; z: number };

/** Orthonormal camera basis in world space (three.js camera axes). */
export type ViewBasis = {
    right: Vec3Like;
    up: Vec3Like;
    /** The direction the camera looks along. */
    forward: Vec3Like;
    /** A world point on the view axis: the view centre (the camera target). */
    origin: Vec3Like;
};

export type SkyView = {
    /** Half the view width and height in world units. */
    halfWidth: number;
    halfHeight: number;
    /** CSS pixels per world unit (the orthographic zoom). */
    pixelsPerUnit: number;
};

/**
 * What sky props must stay off: the terrain's convex hull and one convex
 * polygon per standing column, with bounds for a fast reject.
 */
export type SkyObstacles = {
    hull: ViewPolygon;
    hullBounds: ViewRect | null;
    columns: readonly ViewPolygon[];
    columnBounds: readonly ViewRect[];
};

/** Sky prop rules in pixels, shared by every sky prop. */
export const skyLayoutRules = {
    /** Clear space a sky prop keeps from the footprint and other props. */
    marginPx: 14,
    /** Extra vertical clearance for the bob. */
    bobMarginPx: 5,
    /**
     * World altitude the bolt and its glow take their depth from: in front
     * of the garden, since the band is drawn in screen space.
     */
    bandAltitude: 6.5,
    /**
     * Most of the view height the band may hang over the garden. Decision
     * D1 (provisional): the band may hang over the far edge of a garden that
     * fills the view, at most this share of the view height, translucent
     * there (`cloudBandRules.overGardenShare` holds the value).
     */
    bandMaxViewShare: 0.1,
    /** Bolt height in pixels in free sky, and the short one over the garden. */
    boltPx: 150,
    boltBandPx: 96,
    /**
     * With no free sky the short bolt may still hang over the garden's far
     * edge, but only inside the band's over-garden strip: its tip at most
     * this share of the view height below the garden's top in every screen
     * column it spans, and clear of every standing object. Where nothing
     * fits, the strike shows only the glow in the deck (no bolt). Raise it
     * to let the short bolt reach further over the garden; 0 never hangs a
     * bolt over the garden.
     */
    boltOverGardenShare: 0.1,
    /** Half the bolt's width as a share of its height (with lean). */
    boltHalfWidthShare: 0.32,
    /** Positions tried along the deck's lip for a bolt. */
    boltLipSteps: 40,
    /** The deck must show at least this much to hold a bolt. */
    boltDeckMin: 0.35,
    /** Width (px) of the stretch of deck a bolt hangs from (its glow). */
    boltDeckWidthPx: 300,
} as const;

/**
 * Bounding-box size of each sky prop form at width 1 (x), as width, height
 * and depth: the target's three signed-distance forms, the default for
 * `resolveSkyCloudUnitHalf` (mist rolls pass their own sizes).
 */
export const skyCloudVariantSizes: readonly (readonly [
    width: number,
    height: number,
    depth: number,
])[] = [
    [1, 0.3934983, 0.4343402],
    [1, 0.3353486, 0.3943397],
    [1, 0.3876715, 0.4202873],
];

function lerp(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

/** View coordinates of a world point. */
export function worldToView(basis: ViewBasis, point: Vec3Like): ViewPoint {
    const x = point.x - basis.origin.x;
    const y = point.y - basis.origin.y;
    const z = point.z - basis.origin.z;
    return [
        x * basis.right.x + y * basis.right.y + z * basis.right.z,
        x * basis.up.x + y * basis.up.y + z * basis.up.z,
    ];
}

/**
 * The world point at a view spot and world altitude: the screen spot stays
 * put under the orthographic camera, the altitude only sets its depth. Like
 * the target's `screenToWorld`.
 */
export function viewToWorld<T extends Vec3Like>(
    basis: ViewBasis,
    u: number,
    v: number,
    altitude: number,
    out: T,
): T {
    const { forward, origin, right, up } = basis;
    const baseY = origin.y + u * right.y + v * up.y;
    const along =
        Math.abs(forward.y) > 1e-6 ? (altitude - baseY) / forward.y : 0;
    out.x = origin.x + u * right.x + v * up.x + along * forward.x;
    out.y = origin.y + u * right.y + v * up.y + along * forward.y;
    out.z = origin.z + u * right.z + v * up.z + along * forward.z;
    return out;
}

/**
 * Half extents on screen (view units) of a cloud of width 1 that yaws to
 * face the camera, so its width runs along the screen's right axis.
 */
export function resolveSkyCloudUnitHalf(
    basis: Pick<ViewBasis, 'forward' | 'up'>,
    sizes: readonly (readonly [
        number,
        number,
        number,
    ])[] = skyCloudVariantSizes,
): ViewPoint[] {
    const towardCameraLength = Math.hypot(basis.forward.x, basis.forward.z);
    const depthAlongUp =
        towardCameraLength > 1e-6
            ? Math.abs(
                  (-basis.forward.x * basis.up.x -
                      basis.forward.z * basis.up.z) /
                      towardCameraLength,
              )
            : 1;
    return sizes.map(([width, height, depth]) => [
        width / 2,
        (height / 2) * Math.abs(basis.up.y) + (depth / 2) * depthAlongUp,
    ]);
}

/** Andrew's monotone chain, as the target's `convexHull`. */
export function convexHull(points: readonly ViewPoint[]): ViewPoint[] {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: ViewPoint, a: ViewPoint, b: ViewPoint) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: ViewPoint[] = [];
    for (const point of sorted) {
        while (lower.length >= 2) {
            const a = lower[lower.length - 2];
            const b = lower[lower.length - 1];
            if (!a || !b || cross(a, b, point) > 0) break;
            lower.pop();
        }
        lower.push(point);
    }
    const upper: ViewPoint[] = [];
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
        const point = sorted[index];
        if (!point) continue;
        while (upper.length >= 2) {
            const a = upper[upper.length - 2];
            const b = upper[upper.length - 1];
            if (!a || !b || cross(a, b, point) > 0) break;
            upper.pop();
        }
        upper.push(point);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function polygonBounds(polygon: ViewPolygon): ViewRect | null {
    if (polygon.length === 0) {
        return null;
    }
    let minU = Number.POSITIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const [u, v] of polygon) {
        minU = Math.min(minU, u);
        minV = Math.min(minV, v);
        maxU = Math.max(maxU, u);
        maxV = Math.max(maxV, v);
    }
    return [minU, minV, maxU, maxV];
}

export function createSkyObstacles(
    hull: ViewPolygon,
    columns: readonly ViewPolygon[],
): SkyObstacles {
    const kept: ViewPolygon[] = [];
    const keptBounds: ViewRect[] = [];
    for (const column of columns) {
        const bounds = polygonBounds(column);
        if (bounds) {
            kept.push(column);
            keptBounds.push(bounds);
        }
    }
    return {
        hull,
        hullBounds: polygonBounds(hull),
        columns: kept,
        columnBounds: keptBounds,
    };
}

export const emptySkyObstacles: SkyObstacles = createSkyObstacles([], []);

/** Strict overlap of two rectangles (touching edges do not overlap). */
export function rectsOverlap(a: ViewRect, b: ViewRect) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function boundsTouch(a: ViewRect, b: ViewRect) {
    return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

/** Separating-axis test between a rectangle and a convex polygon. */
export function rectHitsPolygon(rect: ViewRect, polygon: ViewPolygon) {
    if (polygon.length === 0) {
        return false;
    }
    const corners: ViewPoint[] = [
        [rect[0], rect[1]],
        [rect[2], rect[1]],
        [rect[2], rect[3]],
        [rect[0], rect[3]],
    ];
    for (const shape of [corners, polygon]) {
        for (let index = 0; index < shape.length; index += 1) {
            const a = shape[index];
            const b = shape[(index + 1) % shape.length];
            if (!a || !b) continue;
            const axisU = b[1] - a[1];
            const axisV = a[0] - b[0];
            let minA = Number.POSITIVE_INFINITY;
            let maxA = Number.NEGATIVE_INFINITY;
            let minB = Number.POSITIVE_INFINITY;
            let maxB = Number.NEGATIVE_INFINITY;
            for (const point of corners) {
                const d = point[0] * axisU + point[1] * axisV;
                minA = Math.min(minA, d);
                maxA = Math.max(maxA, d);
            }
            for (const point of polygon) {
                const d = point[0] * axisU + point[1] * axisV;
                minB = Math.min(minB, d);
                maxB = Math.max(maxB, d);
            }
            if (maxA < minB || maxB < minA) return false;
        }
    }
    return true;
}

/** Whether a rectangle is off the footprint and off every placed prop. */
export function rectIsFree(
    rect: ViewRect,
    obstacles: SkyObstacles,
    placed: readonly ViewRect[],
) {
    if (
        obstacles.hullBounds &&
        boundsTouch(rect, obstacles.hullBounds) &&
        rectHitsPolygon(rect, obstacles.hull)
    ) {
        return false;
    }
    for (let index = 0; index < obstacles.columns.length; index += 1) {
        const bounds = obstacles.columnBounds[index];
        const column = obstacles.columns[index];
        if (
            bounds &&
            column &&
            boundsTouch(rect, bounds) &&
            rectHitsPolygon(rect, column)
        ) {
            return false;
        }
    }
    for (const other of placed) {
        if (rectsOverlap(rect, other)) return false;
    }
    return true;
}

/**
 * A spot for a sky prop of half size (hu, hv) near (u0, v0): off the
 * footprint and other props, never cut by the top edge, cut by at most a
 * quarter of its width at a side and a fifth of its height at the bottom.
 * Tries the preferred spot, then moves outward from the view centre, then
 * sideways and vertically. Null when there is no free sky.
 */
export function findFreeSpot(
    u0: number,
    v0: number,
    hu: number,
    hv: number,
    placed: readonly ViewRect[],
    view: Pick<SkyView, 'halfHeight' | 'halfWidth'>,
    pad: readonly [number, number],
    obstacles: SkyObstacles,
): ViewPoint | null {
    const [padU, padV] = pad;
    const minU = -view.halfWidth + hu * 0.5;
    const maxU = view.halfWidth - hu * 0.5;
    const minV = -view.halfHeight + hv * 0.6;
    const maxV = view.halfHeight - hv - padV;
    if (minU > maxU || minV > maxV) return null;
    const length = Math.hypot(u0, v0) || 1;
    const signU = Math.sign(u0) || 1;
    const signV = Math.sign(v0) || 1;
    const directions: ViewPoint[] = [
        [u0 / length, v0 / length],
        [signU, 0],
        [0, signV],
        [0, -signV],
    ];
    const step = Math.max(0.08, hv * 0.25);
    for (const [du, dv] of directions) {
        let lastU = Number.NaN;
        let lastV = Number.NaN;
        for (let k = 0; k < 40; k += 1) {
            const u = Math.min(maxU, Math.max(minU, u0 + du * step * k));
            const v = Math.min(maxV, Math.max(minV, v0 + dv * step * k));
            // Both coordinates only move outward until they clamp, so once
            // a step repeats the last spot, every later step does too.
            if (u === lastU && v === lastV) break;
            lastU = u;
            lastV = v;
            const rect: ViewRect = [
                u - hu - padU,
                v - hv - padV,
                u + hu + padU,
                v + hv + padV,
            ];
            if (rectIsFree(rect, obstacles, placed)) return [u, v];
        }
    }
    return null;
}

export type SkyBandPlacement = {
    /** Index in `SkyLayout.band`. */
    index: number;
    variant: number;
    /** Centre in view units. */
    u: number;
    v: number;
    /** Width in world units. */
    width: number;
    /** Half extents on screen in view units. */
    halfU: number;
    halfV: number;
    altitude: number;
    /** The screen rectangle, without padding. */
    rect: ViewRect;
    /** Always true: a stretch exists only for a bolt. */
    wanted: boolean;
};

/**
 * Where a bolt hangs: from the overcast deck's lower edge (thunder always
 * brings the deck), on the stretch of band `band` in `SkyLayout.band`.
 */
export type SkyBoltAnchor = {
    kind: 'band';
    side: 0 | 1;
    /** The band stretch (`SkyLayout.band`) the bolt hangs from. */
    band: number;
    /** Root of the bolt on the deck's lip, in view units. */
    rootU: number;
    rootV: number;
    /** +1 when the root is right of centre, −1 when left. */
    out: 1 | -1;
    /** 150 px in free sky below the lip, else 96 px. */
    heightPx: number;
    /**
     * No free sky below the lip anywhere: the short bolt hangs over the
     * garden's far edge (the one allowed exception), or only the deck
     * glows (`bolt` false).
     */
    overGarden: boolean;
    /**
     * False when no bolt fits anywhere (a garden that fills the view): the
     * strike shows only the warm glow in the deck at the root.
     */
    bolt: boolean;
    /** Hangs from the overcast deck (always, while it thunders). */
    deck: boolean;
};

export type SkyLayoutInput = {
    view: SkyView;
    obstacles: SkyObstacles;
    /** Blended cloud cover, 0 to 1. */
    cloudy: number;
    /** Wind class, 0 to 4 (`resolveWindClass`). */
    windClass: number;
    /** Thunder is on: the band shows its deck and the bolt gets anchors. */
    thunder: boolean;
};

export type SkyLayout = {
    /** The band stretches the bolt anchors hang from, by `anchor.band`. */
    band: SkyBandPlacement[];
    /** Cloud cover the band draws (thunder lifts it to the deck). */
    cover: number;
    /** The band: its lower limit per screen column, the deck amount. */
    cloudBand: CloudBandShape;
    /** Space taken by the band, padded: later sky props avoid it. */
    placed: ViewRect[];
    /** Padding a sky prop keeps: [sideways incl. drift, vertical]. */
    pad: readonly [number, number];
    /** Sideways drift amplitude in view units. */
    drift: number;
    /** Where a bolt hangs for a strike on side 0 (left) and 1 (right). */
    boltAnchors: readonly [SkyBoltAnchor | null, SkyBoltAnchor | null];
    /**
     * Screen space the bolts take (padded), so swooshes and sky mist rolls
     * keep clear of them as of every sky prop. Also in `placed`.
     */
    boltRects: ViewRect[];
};

/** First cover at which a band cloud shows. */
const firstCloudCover = 0.05;

export function layoutSky({
    cloudy,
    obstacles,
    thunder,
    view,
    windClass,
}: SkyLayoutInput): SkyLayout {
    const { halfHeight, halfWidth, pixelsPerUnit } = view;
    const rules = skyLayoutRules;
    const px = (pixels: number) => pixels / pixelsPerUnit;

    const drift = px(16 * (1 + 0.15 * Math.max(0, windClass)));
    const pad: readonly [number, number] = [
        px(rules.marginPx) + drift,
        px(rules.marginPx + rules.bobMarginPx),
    ];

    // ---- the band: clouds and the deck own the top of the view
    const cover = resolveBandCover(cloudy, thunder ? 1 : 0);
    const cloudBand = resolveCloudBandShape({
        cover,
        halfHeight,
        halfWidth,
        obstacles,
        pixelsPerUnit,
    });
    const placed: ViewRect[] = [];
    if (cover >= firstCloudCover && cloudBand.maxLimitPx > 0) {
        placed.push([
            -2 * halfWidth,
            halfHeight - px(cloudBand.maxLimitPx),
            2 * halfWidth,
            2 * halfHeight,
        ]);
    }

    // ---- bolt anchors: thunder always has the deck to hang from
    const band: SkyBandPlacement[] = [];
    // Standing objects only: the over-garden bolt may cross bare terrain.
    const columnObstacles: SkyObstacles = {
        hull: [],
        hullBounds: null,
        columns: obstacles.columns,
        columnBounds: obstacles.columnBounds,
    };
    const boltAnchors: [SkyBoltAnchor | null, SkyBoltAnchor | null] = [
        null,
        null,
    ];
    const boltRects: ViewRect[] = [];
    if (thunder && resolveDeckAmount(cover) > rules.boltDeckMin) {
        for (const side of [0, 1] as const) {
            const anchor = findDeckAnchor(side);
            boltAnchors[side] = anchor;
            if (!anchor.bolt) continue;
            const height = px(anchor.heightPx);
            const rect: ViewRect = [
                anchor.rootU - rules.boltHalfWidthShare * height - pad[0],
                anchor.rootV - height - pad[1],
                anchor.rootU + rules.boltHalfWidthShare * height + pad[0],
                anchor.rootV,
            ];
            boltRects.push(rect);
            placed.push(rect);
        }
    }

    /** The deck's lip at a view u, as a view v. */
    function lipAt(u: number) {
        const limit = resolveBandLimitAt(
            cloudBand,
            (u + halfWidth) * pixelsPerUnit,
        );
        return halfHeight - px(resolveDeckLip(limit));
    }

    function hostFor(side: 0 | 1, rootU: number, rootV: number) {
        const halfU = px(rules.boltDeckWidthPx) / 2;
        const halfV = Math.max(px(1), (halfHeight - rootV) / 2);
        band.push({
            index: band.length,
            variant: side,
            u: rootU,
            v: rootV + halfV,
            width: 2 * halfU,
            halfU,
            halfV,
            altitude: rules.bandAltitude,
            rect: [rootU - halfU, rootV, rootU + halfU, halfHeight],
            wanted: true,
        });
        return band.length - 1;
    }

    // Slides along the deck's lip from the strike's side inward to the
    // first spot where the whole bolt hangs in free sky.
    function tryLip(side: 0 | 1, height: number) {
        const half = 0.34 * height + px(rules.marginPx);
        const lo = -halfWidth + half + 0.1 * halfWidth;
        const hi = halfWidth - half - 0.1 * halfWidth;
        if (lo > hi) return null;
        for (let step = 0; step <= rules.boltLipSteps; step += 1) {
            const t = step / rules.boltLipSteps;
            const rootU = side === 0 ? lerp(lo, hi, t) : lerp(hi, lo, t);
            const rootV = lipAt(rootU);
            if (rootV - height < -halfHeight) continue;
            const rect: ViewRect = [
                rootU - rules.boltHalfWidthShare * height,
                rootV - height,
                rootU + rules.boltHalfWidthShare * height,
                rootV,
            ];
            if (rectIsFree(rect, obstacles, [])) return { rootU, rootV };
        }
        return null;
    }

    function findDeckAnchor(side: 0 | 1): SkyBoltAnchor {
        for (const heightPx of [rules.boltPx, rules.boltBandPx]) {
            const spot = tryLip(side, px(heightPx));
            if (!spot) continue;
            return {
                kind: 'band',
                side,
                band: hostFor(side, spot.rootU, spot.rootV),
                rootU: spot.rootU,
                rootV: spot.rootV,
                out: spot.rootU < 0 ? -1 : 1,
                heightPx,
                overGarden: false,
                bolt: true,
                deck: true,
            };
        }
        // No free sky at all: a short bolt over the garden's far edge, on
        // the strike's half of the view, where its tip stays inside the
        // band's over-garden strip and it crosses no standing object.
        const height = px(rules.boltBandPx);
        const reach = rules.boltHalfWidthShare * height;
        const stripPx =
            rules.boltOverGardenShare * 2 * halfHeight * pixelsPerUnit;
        let found: number | null = null;
        let best = Number.NEGATIVE_INFINITY;
        for (let step = 0; step <= rules.boltLipSteps; step += 1) {
            const t = step / rules.boltLipSteps;
            const u = (side === 0 ? -1 : 1) * lerp(0.15, 0.8, t) * halfWidth;
            const tipV = lipAt(u) - height;
            if (tipV < -halfHeight) continue;
            const tipPx = (halfHeight - tipV) * pixelsPerUnit;
            let clearance = Number.POSITIVE_INFINITY;
            cloudBand.gardenTopPx.forEach((top, column) => {
                const columnU =
                    -halfWidth +
                    ((column + 0.5) / cloudBand.gardenTopPx.length) *
                        2 *
                        halfWidth;
                if (Math.abs(columnU - u) <= reach) {
                    clearance = Math.min(clearance, top + stripPx - tipPx);
                }
            });
            if (clearance < 0 || clearance <= best + 1e-6) continue;
            const rect: ViewRect = [u - reach, tipV, u + reach, lipAt(u)];
            if (!rectIsFree(rect, columnObstacles, [])) continue;
            best = clearance;
            found = u;
        }
        // Nothing fits: the deck still glows on the strike's side.
        const rootU = found ?? (side === 0 ? -0.5 : 0.5) * halfWidth;
        const rootV = lipAt(rootU);
        return {
            kind: 'band',
            side,
            band: hostFor(side, rootU, rootV),
            rootU,
            rootV,
            out: rootU < 0 ? -1 : 1,
            heightPx: rules.boltBandPx,
            overGarden: true,
            bolt: found !== null,
            deck: true,
        };
    }

    return {
        band,
        cover,
        cloudBand,
        placed,
        pad,
        drift,
        boltAnchors,
        boltRects,
    };
}
