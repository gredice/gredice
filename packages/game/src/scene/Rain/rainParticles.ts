/*
 * Party-style rain (GAME_ART.md "Weather > Rain and heavy rain"). Drops are
 * slim pixel-sized streaks in a field sized to the view, so they keep their
 * pixel size, speed and density at any zoom and on any screen.
 */
export const rainDropLook = {
    /** Fall speed in world units per second at the reference zoom (750 px/s). */
    fallSpeed: 7.5,
    /** Extra fall speed in heavy rain (9 units per second, 900 px/s). */
    heavyFallSpeed: 1.5,
    /** Reduced motion: a slow, steady fall instead of no rain. */
    reducedMotionFallSpeed: 1.4,
    /** Speeds are given at this zoom (CSS pixels per world unit). */
    referencePixelsPerUnit: 100,
    /** Quad width in CSS pixels: wider than the streak, for smooth edges. */
    quadWidthPx: 5,
    /** Streak width at its rounded leading end: 2.5 px, 3 px in heavy rain. */
    coreWidthPx: 2.5,
    heavyCoreWidthPx: 0.5,
    /** Streak length in CSS pixels: 14 in rain, 18 in heavy rain. */
    lengthPx: 14,
    heavyLengthPx: 4,
    /** Each drop draws at an opacity in this range, so the garden shows through. */
    minOpacity: 0.55,
    maxOpacity: 0.75,
    /** No drops above this height over the ground; they fade in from 1.9. */
    cloudBaseHeight: 2.7,
    cloudFadeHeight: 1.9,
    /** The field is this many field scales tall and deep. */
    fieldHeight: 10,
    fieldDepth: 10,
} as const;

/**
 * The heavy look (longer, wider, faster streaks) ramps in from rainy 0.6 and
 * is complete at 0.8: heavy rain is rain at 0.8 or more.
 */
export const rainHeavinessRamp = { start: 0.6, full: 0.8 } as const;

function clampUnit(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clampUnit((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

/** How heavy the rain is, 0 to 1: smoothstep(0.6, 0.8, rainy). */
export function resolveRainHeaviness(rainy: number) {
    return smoothstep(
        rainHeavinessRamp.start,
        rainHeavinessRamp.full,
        clampUnit(rainy),
    );
}

/**
 * The drop field for a view of half size (halfWidth, halfHeight) in world
 * units: the field scale (half height over 4, clamped), and the box it
 * wraps drops in, as wide as the view, 10 scales tall and deep.
 */
export function resolveRainField(halfWidth: number, halfHeight: number) {
    const scale = Math.min(2.4, Math.max(0.35, halfHeight / 4));
    return {
        scale,
        width: 2 * Math.max(0, halfWidth) + 1.5 * scale,
        height: rainDropLook.fieldHeight * scale,
        depth: rainDropLook.fieldDepth * scale,
    };
}

/**
 * The drop field in the third- and first-person avatar views (perspective):
 * a box in front of the camera, from just under the ground to the cloud
 * base, so every drop falls where the camera looks instead of half behind
 * it or under the ground. Sizes in world units; `lift` is the box centre
 * over the ground and `bottomFade` the fade over its lowest units, so a
 * drop past the island edge never pops out.
 */
export const rainAvatarField = {
    width: 14,
    height: 3,
    depth: 9,
    lift: 1.2,
    bottomFade: 0.4,
} as const;

/**
 * Fall speed at the reference zoom, in world units per second: 7.5 in rain,
 * up to 9 in heavy rain, 1.4 under reduced motion. The slant comes from
 * `resolveRainSlant` (wind class) and is passed in.
 */
export function resolveRainDropFallSpeed(
    rainy: number,
    reducedMotion: boolean,
) {
    if (reducedMotion) {
        return rainDropLook.reducedMotionFallSpeed;
    }
    return (
        rainDropLook.fallSpeed +
        rainDropLook.heavyFallSpeed * resolveRainHeaviness(rainy)
    );
}

/**
 * Drop size in CSS pixels: a 5 px quad holding a streak 2.5 px wide and
 * 14 px long in rain, 3 px wide and 18 px long in heavy rain.
 */
export function resolveRainDropSizePx(rainy: number) {
    const heavy = resolveRainHeaviness(rainy);
    return {
        quadWidthPx: rainDropLook.quadWidthPx,
        coreWidthPx:
            rainDropLook.coreWidthPx + rainDropLook.heavyCoreWidthPx * heavy,
        lengthPx: rainDropLook.lengthPx + rainDropLook.heavyLengthPx * heavy,
    };
}

/**
 * How much of their opacity the drops show, 0 to 1, faded in from rainy
 * 0.03 to 0.25. Each drop then draws at 0.55 to 0.75 of it.
 */
export function resolveRainDropOpacity(rainy: number) {
    return smoothstep(0.03, 0.25, clampUnit(rainy));
}

/** Splash rings: radius in world units, life in seconds. */
export const rainSplashLook = {
    radius: 0.12,
    lifeSeconds: 0.45,
    /**
     * Most rings at once per landing cell: the target's 29 heavy-rain rings
     * fall on about 18 open ground tiles (1.6 a tile), so a small garden
     * gets about the same ring density instead of all 29 crowded onto a few
     * tiles.
     */
    ringsPerLandingCell: 2,
} as const;

/** Splash rings at once for a garden with `landingCells` cells. */
export function limitRainSplashCount(count: number, landingCells: number) {
    return Math.min(
        Math.max(0, Math.round(count)),
        Math.round(
            Math.max(0, landingCells) * rainSplashLook.ringsPerLandingCell,
        ),
    );
}

/**
 * Splash rings at once: the tier's heavy-rain count (29 / 14 / 0) ×
 * rainy^1.2, none under reduced motion or below rainy 0.05.
 */
export function resolveRainSplashCount(
    splashRings: number,
    rainy: number,
    reducedMotion: boolean,
) {
    const amount = clampUnit(rainy);
    if (reducedMotion || amount < 0.05) {
        return 0;
    }
    return Math.round(Math.max(0, splashRings) * amount ** 1.2);
}

/** Splash ring opacity: faded in from rainy 0.05 to 0.3. */
export function resolveRainSplashOpacity(rainy: number) {
    return smoothstep(0.05, 0.3, clampUnit(rainy));
}

/**
 * Wrap lengths of the normalised motion offsets: every drop's speed step
 * (0.85 to 1.15 in 0.05 steps) turns 20 fall lengths into whole wraps, and
 * the wind moves every drop at the same speed.
 */
export const rainMotionWrap = { fall: 20, wind: 1 } as const;

/**
 * Advances a normalised motion offset (in field lengths) by velocity ×
 * elapsed seconds and wraps it, so a speed change rebases the offset
 * instead of making the drops jump.
 */
export function advanceRainMotionOffset(
    offset: number,
    velocity: number,
    elapsedSeconds: number,
    wrap: number,
) {
    const length = Math.max(0.001, Math.abs(wrap));
    const next =
        (Number.isFinite(offset) ? offset : 0) +
        (Number.isFinite(velocity) ? velocity : 0) *
            Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
    return ((next % length) + length) % length;
}

/**
 * Normalised drop motion for a view: the fall in field heights per second
 * and the wind in field widths per second. Speeds are given at the
 * reference zoom (100 px per unit) and scale with the units per pixel, so
 * rain falls at 750 px/s (900 in heavy rain) at any zoom and on any screen
 * height, while the field itself is sized to cover the view.
 */
export function resolveRainDropMotion({
    avatar = false,
    fallSpeed,
    halfHeight,
    halfWidth,
    pixelsPerUnit,
    slant,
}: {
    /**
     * The perspective avatar views: the `rainAvatarField` box, and speeds
     * in world units per second (there is no zoom).
     */
    avatar?: boolean;
    /** Fall speed at the reference zoom (`resolveRainDropFallSpeed`). */
    fallSpeed: number;
    halfHeight: number;
    halfWidth: number;
    /** CSS pixels per world unit (the camera zoom). */
    pixelsPerUnit: number;
    /** Signed sideways speed at the reference zoom (`resolveRainSlant`). */
    slant: number;
}) {
    const field = avatar
        ? rainAvatarField
        : resolveRainField(halfWidth, halfHeight);
    const speedScale = avatar
        ? 1
        : rainDropLook.referencePixelsPerUnit / Math.max(1e-6, pixelsPerUnit);
    return {
        fallVelocity: (fallSpeed * speedScale) / field.height,
        windVelocity: (slant * speedScale) / field.width,
    };
}
