import { Color, Vector3 } from 'three';
import { defaultGameCameraPosition } from '../gameCamera';
import {
    type GameLightFrame,
    gameLightFrames,
    gameLightRig,
    gameNightLightRig,
    gameWeatherLightRig,
} from './gameArtStyle';
import { smoothstep } from './visualDayNight';

/**
 * Light rig for every time of day and weather, as pure functions so the rules
 * in GAME_ART.md can be tested: a warm key with cool shadows by day, bright
 * peach and lilac twilights, a light blue-violet night that keeps its colour,
 * and weather that tints instead of greying the garden.
 */

export type AtmosphereWeather = {
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowy?: number;
    thundery?: number;
    /** Damped storm amount of blended weather (`weatherBlend.ts`). */
    storm?: number;
};

/** Distance from the default camera to the point it looks at. */
const defaultCameraDistance = Math.hypot(...defaultGameCameraPosition);
/** Length of the vectors `altAzToScenePosition` returns. */
const keyLightDistance = Math.hypot(5, 20);

const nightKeyDirection = new Vector3(
    ...gameNightLightRig.keyDirection,
).normalize();

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

function srgbColor(hex: string) {
    return new Color(hex);
}

/**
 * How far the rig is from night toward day, 0 to 1. Unlike the separate
 * daylight and night amounts, the two weights always add up to one, so the
 * scene never dips darker between them.
 */
export function getAtmosphereDayAmount(timeOfDay: number) {
    return (
        smoothstep(0.15, 0.235, timeOfDay) *
        (1 - smoothstep(0.815, 0.885, timeOfDay))
    );
}

/** 1 around sunrise and sunset, 0 by full day and full night. */
export function getAtmosphereTwilightAmount(timeOfDay: number) {
    const dawn =
        smoothstep(0.15, 0.2, timeOfDay) *
        (1 - smoothstep(0.235, 0.29, timeOfDay));
    const dusk =
        smoothstep(0.74, 0.79, timeOfDay) *
        (1 - smoothstep(0.84, 0.885, timeOfDay));
    return Math.max(dawn, dusk);
}

export type AtmosphereLightFrame = {
    ambientColor: Color;
    ambientIntensity: number;
    groundColor: Color;
    hemisphereIntensity: number;
    keyColor: Color;
    keyIntensity: number;
    skyTint: Color;
    skyTintWeight: number;
};

function frameAt(index: number): GameLightFrame {
    const frame = gameLightFrames[index];
    if (!frame) {
        throw new Error(`Missing light frame ${index}`);
    }
    return frame;
}

/** The light rig at a visual time of day, before moon and weather. */
export function resolveAtmosphereLightFrame(
    timeOfDay: number,
): AtmosphereLightFrame {
    const time = ((timeOfDay % 1) + 1) % 1;
    let index = 0;
    while (
        index < gameLightFrames.length - 2 &&
        frameAt(index + 1).at <= time
    ) {
        index += 1;
    }
    const from = frameAt(index);
    const to = frameAt(index + 1);
    const amount = smoothstep(from.at, to.at, time);
    const lerpColor = (a: string, b: string) =>
        srgbColor(a).lerp(srgbColor(b), amount);
    return {
        ambientColor: lerpColor(from.ambientColor, to.ambientColor),
        ambientIntensity: mix(
            from.ambientIntensity,
            to.ambientIntensity,
            amount,
        ),
        groundColor: lerpColor(from.groundColor, to.groundColor),
        hemisphereIntensity: mix(
            from.hemisphereIntensity,
            to.hemisphereIntensity,
            amount,
        ),
        keyColor: lerpColor(from.keyColor, to.keyColor),
        keyIntensity: mix(from.keyIntensity, to.keyIntensity, amount),
        skyTint: lerpColor(from.skyTint, to.skyTint),
        skyTintWeight: mix(from.skyTintWeight, to.skyTintWeight, amount),
    };
}

/** Key colour of the sun as sRGB channels from 0 to 255. */
export function resolveSunColorRgb(timeOfDay: number) {
    const color = resolveAtmosphereLightFrame(timeOfDay).keyColor;
    const srgb = { r: 0, g: 0, b: 0 };
    color.getRGB(srgb, 'srgb');
    return [srgb.r, srgb.g, srgb.b].map((channel) =>
        Math.round(clamp01(channel) * 255),
    );
}

/** Cloud, fog and rain summed into one cover, before clamping. */
function sumOvercast(weather: AtmosphereWeather | null | undefined) {
    return (
        (weather?.cloudy ?? 0) +
        (weather?.foggy ?? 0) * 0.7 +
        (weather?.rainy ?? 0) * 0.25
    );
}

/** Cloud and fog cover in one number, as the sky gradient uses it. */
export function resolveOvercast(weather: AtmosphereWeather | null | undefined) {
    return clamp01(sumOvercast(weather));
}

type CurvePoints = readonly (readonly [number, number])[];

/**
 * Tangents of a monotone cubic through `points` (Fritsch and Carlson), so
 * the curve never overshoots between its control points.
 */
function resolveMonotoneTangents(points: CurvePoints) {
    const secants: number[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const [x0, y0] = points[index] ?? [0, 0];
        const [x1, y1] = points[index + 1] ?? [1, 0];
        secants.push(x1 > x0 ? (y1 - y0) / (x1 - x0) : 0);
    }
    const tangents = points.map((_, index) => {
        const before = secants[index - 1];
        const after = secants[index];
        if (before === undefined) return after ?? 0;
        if (after === undefined) return before;
        return before * after <= 0 ? 0 : (before + after) / 2;
    });
    secants.forEach((secant, index) => {
        if (secant === 0) {
            tangents[index] = 0;
            tangents[index + 1] = 0;
            return;
        }
        const alpha = (tangents[index] ?? 0) / secant;
        const beta = (tangents[index + 1] ?? 0) / secant;
        const length = Math.hypot(alpha, beta);
        if (length > 3) {
            tangents[index] = (3 * alpha * secant) / length;
            tangents[index + 1] = (3 * beta * secant) / length;
        }
    });
    return tangents;
}

/** Evaluates a monotone cubic through `points` (sorted by x). */
export function sampleMonotoneCurve(
    points: CurvePoints,
    tangents: readonly number[],
    x: number,
) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return 0;
    if (x <= first[0]) return first[1];
    if (x >= last[0]) return last[1];
    let index = 0;
    while (index < points.length - 2 && (points[index + 1]?.[0] ?? 1) <= x) {
        index += 1;
    }
    const [x0, y0] = points[index] ?? first;
    const [x1, y1] = points[index + 1] ?? last;
    const width = x1 - x0;
    const t = (x - x0) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    const value =
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * width * (tangents[index] ?? 0) +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * width * (tangents[index + 1] ?? 0);
    // Clamped to the segment, so a flat segment is exactly flat.
    return Math.min(Math.max(y0, y1), Math.max(Math.min(y0, y1), value));
}

const coverDimmingTangents = resolveMonotoneTangents(
    gameWeatherLightRig.coverDimming.points,
);

/**
 * Share of today's cloud, rain and storm light the island takes at a cloud
 * cover, 0 to 1: exactly 1 from 0.75 up (`gameWeatherLightRig.coverDimming`).
 */
export function resolveCoverDimmingShare(cloudy: number) {
    return sampleMonotoneCurve(
        gameWeatherLightRig.coverDimming.points,
        coverDimmingTangents,
        clamp01(cloudy),
    );
}

/**
 * Share of today's weather light the island takes, 0 to 1 (GAME_ART.md
 * "Weather > Clouds and overcast"): the cover curve scales every term that
 * cloud, rain and storm put on the garden (key loss, fill boost, lavender
 * fill and ground tint, the cast-shadow fade) and the fog, depth fog and
 * ground mist that come with them. Fog that is its own weather, not brought
 * by rain, snow or thunder, holds the share at 1, so fog and mist days keep
 * their light. Exactly 1 from cloud cover 0.75 up.
 */
export function resolveWeatherCoverDimming(
    weather: AtmosphereWeather | null | undefined,
) {
    const share = resolveCoverDimmingShare(weather?.cloudy ?? 0);
    const precipitation = clamp01(
        Math.max(
            weather?.rainy ?? 0,
            weather?.snowy ?? 0,
            weather?.storm ?? weather?.thundery ?? 0,
        ),
    );
    const [holdFrom, holdTo] = gameWeatherLightRig.coverDimming.ownFogHold;
    const ownFogHold = smoothstep(
        holdFrom,
        holdTo,
        clamp01(weather?.foggy ?? 0) * (1 - precipitation),
    );
    // Written as `1 - loss`, so a full share or a full hold gives exactly 1
    // and full cover or a fog day reproduces today's numbers bit for bit.
    return 1 - (1 - share) * (1 - ownFogHold);
}

/**
 * Fog as the island takes it, 0 to 1: the fog a storm or a shower brings
 * follows the cover curve, fog of its own keeps all of it. The ground mist,
 * the back haze and the mist rolls (and the sky the rolls reserve) all read
 * this one amount, so a low-cover storm never keeps storm-fog rolls at the
 * rim after its ground mist has gone.
 */
export function resolveIslandFoggy(
    weather: AtmosphereWeather | null | undefined,
) {
    return (weather?.foggy ?? 0) * resolveWeatherCoverDimming(weather);
}

/** `resolveOvercast` as the island takes it, at a cover share. */
export function resolveIslandOvercast(
    weather: AtmosphereWeather | null | undefined,
    coverShare: number,
) {
    return clamp01(sumOvercast(weather) * coverShare);
}

/**
 * How much of the key comes from the night side of the rig, where a visible
 * moon can steer it. Zero by day, so the key never jumps.
 */
export function getMoonKeyAmount(timeOfDay: number) {
    return 1 - getAtmosphereDayAmount(timeOfDay);
}

/**
 * Horizontal unit direction from the garden toward the camera at a world
 * rotation step, as `GameCameraRig` places the camera: the default camera
 * position turned by a quarter turn per step.
 */
export function getCameraHorizontalDirection(worldRotation: number) {
    const [x, , z] = defaultGameCameraPosition;
    const azimuth = Math.atan2(x, z) + worldRotation * (Math.PI / 2);
    return new Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
}

/**
 * Quarter turns of a camera around the garden, counted like `worldRotation`,
 * from the direction the camera looks in. The camera rig can be reset to a
 * saved view without `worldRotation` following, so the key light follows
 * the camera itself. Null for a camera looking straight down.
 */
export function getCameraQuarterTurns(viewDirection: Vector3) {
    const x = -viewDirection.x;
    const z = -viewDirection.z;
    if (Math.hypot(x, z) < 1e-3) {
        return null;
    }
    const [defaultX, , defaultZ] = defaultGameCameraPosition;
    const turns = Math.round(
        (Math.atan2(x, z) - Math.atan2(defaultX, defaultZ)) / (Math.PI / 2),
    );
    return ((turns % 4) + 4) % 4;
}

/**
 * Mirrors a light that comes from behind the garden, as the camera sees it,
 * to the camera's side of the garden, keeping its height and its left or
 * right. A key from behind leaves both visible sides of every block in shade
 * (GAME_ART.md asks for a lit and a shaded side), throws its shadows across
 * the front of the props and shines a bright glare off every top face.
 */
export function foldLightTowardCamera(
    direction: Vector3,
    cameraHorizontal: Vector3,
) {
    const facing =
        direction.x * cameraHorizontal.x + direction.z * cameraHorizontal.z;
    const result = direction.clone();
    if (facing >= 0) {
        return result;
    }
    return result.addScaledVector(cameraHorizontal, -2 * facing);
}

/**
 * Returns the unit light direction with its elevation (y) kept between
 * `minElevation` and `maxElevation`, turned only up or down so it keeps its
 * compass direction. A light from straight above has no compass direction
 * and leans toward +x.
 */
export function liftLightDirection(
    direction: Vector3,
    minElevation: number,
    maxElevation = 1,
) {
    const result = direction.clone();
    if (result.lengthSq() < 1e-8) {
        result.set(0, 1, 0);
    }
    result.normalize();
    const elevation = Math.min(maxElevation, Math.max(minElevation, result.y));
    if (elevation === result.y) {
        return result;
    }
    const horizontal = Math.hypot(result.x, result.z);
    const targetHorizontal = Math.sqrt(1 - elevation * elevation);
    if (horizontal < 1e-6) {
        return result.set(targetHorizontal, elevation, 0);
    }
    const scale = targetHorizontal / horizontal;
    return result.set(result.x * scale, elevation, result.z * scale);
}

/**
 * A key that comes in low lights a top face with only part of its
 * intensity. Make up part of that loss so the tops stay close to midday.
 */
export function getKeyElevationCompensation(elevation: number) {
    const reference = gameLightRig.keyReferenceElevation;
    if (elevation >= reference) {
        return 1;
    }
    return (
        (reference / Math.max(elevation, 0.05)) **
        gameLightRig.keyLowElevationCompensation
    );
}

export type AtmosphereLightingInput = {
    /** Hemisphere sky colour from the sky palette for this time of day. */
    hemisphereSkyColor: Color;
    /** Sky background colour, after moonlight and weather. */
    backgroundColor: Color;
    /** Visible moonlight, 0 to 1: illumination times height above horizon. */
    moonlight: number;
    /** Scene position of the moon, or null when it is not needed. */
    moonPosition: Vector3 | null;
    solarEclipseScales: { ambient: number; direct: number };
    sunPosition: Vector3;
    timeOfDay: number;
    weather: AtmosphereWeather | null | undefined;
    /** Quarter turns of the camera around the garden (`worldRotation`). */
    worldRotation?: number;
    /**
     * Share of the weather light the island takes, 0 to 1; by default the
     * cover curve of `weather` (`resolveWeatherCoverDimming`).
     */
    coverShare?: number;
};

export type AtmosphereLighting = {
    ambient: { color: Color; intensity: number };
    hemisphere: { color: Color; groundColor: Color; intensity: number };
    key: {
        color: Color;
        intensity: number;
        position: Vector3;
        /** Share of the shadow strength the key light casts, 0 to 1. */
        shadowVisibility: number;
    };
};

export function resolveAtmosphereLighting({
    backgroundColor,
    hemisphereSkyColor,
    moonlight,
    moonPosition,
    solarEclipseScales,
    sunPosition,
    timeOfDay,
    weather,
    worldRotation = 0,
    coverShare = resolveWeatherCoverDimming(weather),
}: AtmosphereLightingInput): AtmosphereLighting {
    const frame = resolveAtmosphereLightFrame(timeOfDay);
    const day = getAtmosphereDayAmount(timeOfDay);
    const night = 1 - day;
    // Lower cloud cover keeps more of the clear-day light: cloud, rain and
    // the fog a storm brings follow the cover curve (`coverShare`).
    const cloudy = clamp01(weather?.cloudy ?? 0) * coverShare;
    const foggy = clamp01(weather?.foggy ?? 0) * coverShare;
    const overcast = resolveIslandOvercast(weather, coverShare);
    // At night cloud takes less of the key and adds less fill: the night
    // fill alone flattened the garden into pink and mint
    // (`cloudNightScale`).
    const cloudNight = mix(gameWeatherLightRig.cloudNightScale, 1, day);
    const cloudLight = cloudy * cloudNight;
    // The fill boost keeps the cloud's night glow at lower cover
    // (`coverDimming.nightFillHold`); by day it follows the cover curve.
    // Written as `1 - loss`, so a full share stays exactly 1.
    const fillShare =
        1 -
        (1 - coverShare) *
            (1 - night * gameWeatherLightRig.coverDimming.nightFillHold);
    const fillCloud = clamp01(weather?.cloudy ?? 0) * fillShare * cloudNight;
    const fillFog = clamp01(weather?.foggy ?? 0) * fillShare;

    // Key light: the sun by day; by night a fixed key, steered toward the
    // moon while it is up. Directions are weighted so the key moves
    // smoothly through twilight, kept high enough to light the tops and low
    // enough to light one side, then folded to the camera's side of the
    // garden.
    const moonAmount = moonPosition
        ? clamp01(moonlight) * getMoonKeyAmount(timeOfDay)
        : 0;
    const nightDirection = nightKeyDirection
        .clone()
        .lerp(
            moonPosition?.clone().normalize() ?? nightKeyDirection,
            moonAmount,
        );
    const sunDirection = sunPosition.clone().normalize();
    const weightedDirection = sunDirection
        .multiplyScalar(day)
        .addScaledVector(nightDirection, night);
    const keyDirection = foldLightTowardCamera(
        liftLightDirection(
            weightedDirection.lengthSq() > 1e-6
                ? weightedDirection
                : nightKeyDirection,
            gameLightRig.keyMinElevation,
            gameLightRig.keyMaxElevation,
        ),
        getCameraHorizontalDirection(worldRotation),
    );
    const weatherKeyScale = Math.max(
        gameWeatherLightRig.keyWeatherFloor,
        clamp01(
            1 -
                cloudLight * gameWeatherLightRig.keyCloudLoss -
                foggy * gameWeatherLightRig.keyFogLoss,
        ),
    );
    const keyIntensity =
        (frame.keyIntensity + moonAmount * gameNightLightRig.moonKeyBoost) *
        getKeyElevationCompensation(keyDirection.y) *
        weatherKeyScale *
        mix(1, solarEclipseScales.direct, day);
    const keyColor = frame.keyColor
        .clone()
        .lerp(srgbColor(gameNightLightRig.moonColor), moonAmount * 0.6);

    // Hemisphere fill: the palette sky moved toward the frame's tint, over a
    // warm bounce by day and a violet one by night. Cloud cover tints it
    // periwinkle and brightens it to make up for the lost key.
    const skyColor = hemisphereSkyColor
        .clone()
        .lerp(frame.skyTint, frame.skyTintWeight)
        .lerp(
            srgbColor(gameWeatherLightRig.overcastSkyColor),
            overcast * gameWeatherLightRig.overcastSkyWeight,
        );
    const groundColor = frame.groundColor
        .clone()
        .lerp(
            backgroundColor.clone().multiplyScalar(gameLightRig.groundSkyScale),
            gameLightRig.groundBackgroundWeight * day,
        )
        .lerp(
            srgbColor(gameWeatherLightRig.overcastGroundColor),
            overcast * gameWeatherLightRig.overcastGroundWeight,
        );
    const fillScale =
        (1 +
            fillCloud * gameWeatherLightRig.cloudFillBoost +
            fillFog * gameWeatherLightRig.fogFillBoost) *
        mix(1, solarEclipseScales.ambient, day);

    return {
        ambient: {
            color: frame.ambientColor
                .clone()
                .lerp(
                    srgbColor(gameWeatherLightRig.overcastSkyColor),
                    overcast * gameWeatherLightRig.overcastSkyWeight,
                ),
            intensity: frame.ambientIntensity * fillScale,
        },
        hemisphere: {
            color: skyColor,
            groundColor,
            intensity: frame.hemisphereIntensity * fillScale,
        },
        key: {
            color: keyColor,
            intensity: keyIntensity,
            position: keyDirection.multiplyScalar(keyLightDistance),
            shadowVisibility:
                mix(gameLightRig.nightShadowVisibility, 1, day) *
                (1 -
                    getAtmosphereTwilightAmount(timeOfDay) *
                        gameLightRig.twilightShadowSoftening),
        },
    };
}

export type AtmosphereFog = { color: Color; far: number; near: number };

/**
 * How much longer the depth fog's ramp is than the light rig's span (WP4).
 * The ground mist's back haze softens the top of the view by screen height,
 * the same at any garden size (GAME_ART.md "Weather > Fog and mist"), so the
 * depth fog steps back to a light, nearly even tint: the same share at the
 * garden centre, but a farm's back no longer fogs over with its depth.
 */
export const atmosphereFogDepthSpanScale = 4;

/**
 * Fog that takes the colour of the sky at the horizon and thickens only a
 * little toward the back of the garden, so fogged props fade into the
 * background instead of turning grey. Null when there is no fog.
 */
export function resolveAtmosphereFog({
    cameraDistance = defaultCameraDistance,
    foggy,
    horizonColor,
}: {
    cameraDistance?: number;
    foggy: number;
    horizonColor: Color;
}): AtmosphereFog | null {
    const amount = clamp01(foggy);
    if (amount <= 0) {
        return null;
    }
    const span = gameWeatherLightRig.fogDepthSpan * atmosphereFogDepthSpanScale;
    const centerAmount = gameWeatherLightRig.fogCenterAmount * amount ** 0.8;
    const near = cameraDistance - centerAmount * span;
    return {
        color: horizonColor
            .clone()
            .lerp(
                srgbColor(gameWeatherLightRig.fogTint),
                gameWeatherLightRig.fogTintWeight,
            ),
        far: near + span,
        near,
    };
}
