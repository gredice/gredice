/**
 * One wind scale for every weather consumer (GAME_ART.md "Weather > Wind"):
 * the API wind class, 0 to 4, from the blended live or override weather.
 * Clouds, rain slant, snow drift, plant sway, leaves, swooshes and audio all
 * read the class through these helpers instead of their own divisors.
 */

export const windClassMax = 4;

/** Wind classes at which the visible wind effects start. */
export const windClassThresholds = {
    /** Rain falls straight below this class. */
    rainSlant: 0.05,
    /** Leaves tumble from here: (class − 0.8) × 3.2. */
    leaves: 0.8,
    /** Swooshes draw from here: 1 + 1.3 × (class − 1.3). */
    swooshes: 1.3,
    /** Swoosh opacity reaches full at this class. */
    swooshesFull: 2.4,
} as const;

/** Reduced-motion scales (GAME_ART.md "Weather > Reduced motion"). */
export const windReducedMotion = {
    rainSlant: 0.2,
    sway: 0.3,
    cloudShadowSpeed: 0.4,
} as const;

/**
 * Live wind sways plants and drifts clouds, gently (decision D4, provisional).
 * One place to change how strongly a full class-4 gale sways plants.
 */
export const windSwayAtFullClass = 1;

type WindWeather = {
    windSpeed?: number | null;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
    return clamp(value, 0, 1);
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function finiteOr(value: number | null | undefined, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

/** Wind class 0 to 4 of blended weather (`windSpeed` is the API class). */
export function resolveWindClass(weather: WindWeather | null | undefined) {
    return clamp(finiteOr(weather?.windSpeed, 0), 0, windClassMax);
}

/**
 * Sideways rain speed in world units per second: (0.45 + 0.75 × class),
 * none in still air, 20% under reduced motion.
 */
export function resolveRainSlant(windClass: number, reducedMotion = false) {
    if (windClass <= windClassThresholds.rainSlant) {
        return 0;
    }
    return (
        (0.45 + 0.75 * windClass) *
        (reducedMotion ? windReducedMotion.rainSlant : 1)
    );
}

/** Snow drift with the wind in world units per second: 0.08 + 0.26 × class. */
export function resolveSnowDrift(windClass: number) {
    return 0.08 + 0.26 * Math.max(0, windClass);
}

/**
 * Plant lean and sway, 0 to 1, in proportion to the class; 30% under
 * reduced motion. Multiply by each plant's own sway amplitude.
 */
export function resolveWindSway(windClass: number, reducedMotion = false) {
    return (
        clamp01(windClass / windClassMax) *
        windSwayAtFullClass *
        (reducedMotion ? windReducedMotion.sway : 1)
    );
}

/**
 * Tumbling wind leaves: (class − 0.8) × 3.2 up to the tier cap. None in snow
 * (snowy above 0.3) and none under reduced motion.
 */
export function resolveWindLeafCount(
    windClass: number,
    {
        cap,
        reducedMotion = false,
        snowy = 0,
    }: { cap: number; reducedMotion?: boolean; snowy?: number },
) {
    if (reducedMotion || snowy > 0.3) {
        return 0;
    }
    return Math.min(
        Math.max(0, cap),
        Math.round(Math.max(0, windClass - windClassThresholds.leaves) * 3.2),
    );
}

/** Wind swooshes from class 1.3: 1 + 1.3 × (class − 1.3), up to the cap. */
export function resolveWindSwooshCount(windClass: number, cap: number) {
    if (windClass < windClassThresholds.swooshes) {
        return 0;
    }
    return Math.min(
        Math.max(0, cap),
        Math.round(1 + (windClass - windClassThresholds.swooshes) * 1.3),
    );
}

/**
 * Swoosh opacity, 0 to 1: rises from class 1.3 to 2.4, faded by snow and by
 * rain (× (1 − 0.6 × rainy)).
 */
export function resolveWindSwooshAmount(
    windClass: number,
    { rainy = 0, snowy = 0 }: { rainy?: number; snowy?: number } = {},
) {
    return (
        smoothstep(
            windClassThresholds.swooshes,
            windClassThresholds.swooshesFull,
            windClass,
        ) *
        (1 - clamp01(snowy)) *
        (1 - 0.6 * clamp01(rainy))
    );
}

/** Sideways cloud drift in pixels: ±16 px, 15% more per wind class. */
export function resolveCloudDriftPx(windClass: number) {
    return 16 * (1 + 0.15 * Math.max(0, windClass));
}

/**
 * Cloud shadow speed in world units per second: (0.16 + 0.05 × class),
 * 0.6× under full overcast, 40% under reduced motion.
 */
export function resolveCloudShadowSpeed(
    windClass: number,
    {
        overcast = 0,
        reducedMotion = false,
    }: { overcast?: number; reducedMotion?: boolean } = {},
) {
    const overcastScale = 1 + (0.6 - 1) * clamp01(overcast);
    return (
        (0.16 + 0.05 * Math.max(0, windClass)) *
        overcastScale *
        (reducedMotion ? windReducedMotion.cloudShadowSpeed : 1)
    );
}

const compassDegrees: Record<string, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
};

/**
 * Wind direction in degrees from a compass string (live API) or a number
 * (overrides). Unknown or missing directions are north (0), as in
 * `Environment`.
 */
export function resolveWindDirectionDegrees(
    direction: string | number | null | undefined,
) {
    if (typeof direction === 'number') {
        return Number.isFinite(direction) ? ((direction % 360) + 360) % 360 : 0;
    }
    return direction ? (compassDegrees[direction] ?? 0) : 0;
}

/**
 * Unit vector in world XZ that the wind blows along, with the same
 * convention as `Snow/snowParticles.ts`: x = sin(direction),
 * z = −cos(direction).
 */
export function resolveWindVector(degrees: number) {
    const radians = (degrees * Math.PI) / 180;
    return { x: Math.sin(radians), z: -Math.cos(radians) };
}

/**
 * Cloud drift (GAME_ART.md "Weather > Clouds and overcast" and "Cloud
 * shadows"; user feedback 2026-11-26: the clouds and their shadows moved
 * different ways). One drift for the band clouds, the overcast deck and the
 * cloud shadows.
 */
export const cloudDriftRules = {
    /**
     * Screen px per second the band drifts per world unit per second of
     * the shadows: a third of the default zoom's 100 px per unit, so the
     * far clouds in the band pass slower than the shadows under the near
     * ones. Keeps the band's partly cloudy pace (7 px/s at class 1).
     */
    bandPxPerUnit: 100 / 3,
    /**
     * The wind blows to the left of the screen when its dot with the view's
     * right axis is below this; straight into or out of the view reads as
     * right, as the swooshes and leaves read it.
     */
    leftBelow: -0.05,
} as const;

/**
 * The side of the screen the wind blows toward: 1 right, −1 left. The view's
 * right axis is a world direction (`ViewBasis.right`); only its XZ counts.
 */
export function resolveWindScreenSide(
    wind: { x: number; z: number },
    right: { x: number; z: number },
): 1 | -1 {
    return wind.x * right.x + wind.z * right.z < cloudDriftRules.leftBelow
        ? -1
        : 1;
}

export type CloudDrift = {
    /** Screen side every cloud layer drifts toward: 1 right, −1 left. */
    side: 1 | -1;
    /**
     * Unit XZ ground axis the shadows travel along: the view's right axis
     * (sideways on screen), or the wind without an orthographic view.
     */
    axisX: number;
    axisZ: number;
    /** Shadow travel along the axis, world units per second (signed). */
    groundPerSecond: number;
    /** Band clouds and deck along screen x, CSS px per second (signed). */
    bandPxPerSecond: number;
};

/**
 * The one cloud drift the band and the shadows read. The band can only
 * move sideways on screen, so the wind counts as the side of the screen it
 * blows toward (as for rain slant, swooshes and leaves), and the shadows
 * run along the ground axis that is sideways on screen, toward the same
 * side, at every turn of the view. One speed drives both: the shadows'
 * (`resolveCloudShadowSpeed`, 40% under reduced motion), and the band's
 * `cloudDriftRules.bandPxPerUnit` share of it on screen (no band drift
 * under reduced motion). Without an orthographic view (the avatar views,
 * where the band is off) the shadows follow the wind.
 */
export function resolveCloudDrift({
    overcast = 0,
    reducedMotion = false,
    right,
    windClass,
    windDirection,
}: {
    /** `resolveCloudShadowOvercast(cloudy)`, 0 to 1. */
    overcast?: number;
    reducedMotion?: boolean;
    /** The view's right axis in world space; null without a view. */
    right: { x: number; z: number } | null | undefined;
    windClass: number;
    /** Degrees (`resolveWindDirectionDegrees`). */
    windDirection: number;
}): CloudDrift {
    const wind = resolveWindVector(windDirection);
    const speed = resolveCloudShadowSpeed(windClass, { overcast });
    const groundScale = reducedMotion ? windReducedMotion.cloudShadowSpeed : 1;
    const length = right ? Math.hypot(right.x, right.z) : 0;
    if (!right || length < 1e-3) {
        return {
            side: 1,
            axisX: wind.x,
            axisZ: wind.z,
            groundPerSecond: speed * groundScale,
            bandPxPerSecond: 0,
        };
    }
    const side = resolveWindScreenSide(wind, right);
    return {
        side,
        axisX: right.x / length,
        axisZ: right.z / length,
        groundPerSecond: side * speed * groundScale,
        bandPxPerSecond: reducedMotion
            ? 0
            : side * speed * cloudDriftRules.bandPxPerUnit,
    };
}

/** How far a drift has gone, for `stepCloudDriftTravel`. */
export type CloudDriftTravel = {
    travel: number;
    seconds: number;
    live: boolean;
};

export function createCloudDriftTravel(): CloudDriftTravel {
    return { travel: 0, seconds: 0, live: false };
}

/**
 * Distance a drift has travelled by scene time `seconds` at `rate` per
 * second. A frozen clock (`fixedTimeSeconds`) and the first live frame put
 * it at rate × seconds, so captures stay deterministic; after that it adds
 * up frame by frame, so a turn of the view (the side flips), a wind or cover
 * change (the speed changes) or reduced motion change only how the clouds
 * move on, never where they are. Writes `state`; returns the travel.
 */
export function stepCloudDriftTravel(
    state: CloudDriftTravel,
    seconds: number,
    rate: number,
    frozen: boolean,
) {
    if (frozen || !state.live) {
        state.travel = rate * seconds;
        state.live = !frozen;
    } else {
        state.travel += rate * Math.max(0, seconds - state.seconds);
    }
    state.seconds = seconds;
    return state.travel;
}
