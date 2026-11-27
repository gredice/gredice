import { Color, SRGBColorSpace } from 'three';
import {
    getAtmosphereDayAmount,
    getAtmosphereTwilightAmount,
} from '../atmosphereLighting';

/**
 * Weather colour roles (GAME_ART.md "Weather > Colour roles"). Weather props
 * are unlit: their shaders write these colours and take no scene light, so
 * weather stays light at every time of day and never changes the static
 * cache's lighting. Every weather renderer takes its colours from here.
 *
 * Each role has a value at midday, sunset and night; dawn and dusk blend the
 * neighbouring sets with the light rig's own day and twilight weights.
 */
export type WeatherRoleTime = 'midday' | 'sunset' | 'night';

/** A cloud body: the lit top and the shaded underside. */
type CloudToneHex = readonly [lit: string, shade: string];

export type WeatherRoleSet = {
    cloudFair: CloudToneHex;
    cloudOvercast: CloudToneHex;
    cloudRain: CloudToneHex;
    cloudStorm: CloudToneHex;
    cloudSnow: CloudToneHex;
    cloudRim: string;
    /** Storm sky gradient, top to bottom. */
    stormSky: readonly [top: string, middle: string, bottom: string];
    /** Multiplies the light under a cloud shadow; a shadow never goes darker. */
    cloudShadowTint: string;
    /** Share of the shadow tint a cloud shadow applies, before weather. */
    cloudShadowStrength: number;
    mist: string;
    mistLow: string;
    /** Raindrop leading end (the brighter, rounded end) and body. */
    rainHead: string;
    rainTail: string;
    splashRing: string;
    splashRingEdge: string;
    puddleDeep: string;
    puddleLight: string;
    flakeCore: string;
    flakeEdge: string;
    iconFlakeFace: string;
    iconFlakeRim: string;
    iconFlakeGlint: string;
    windSwoosh: string;
    boltFace: string;
    boltSide: string;
    boltLight: string;
    boltGlow: string;
};

/** The GAME_ART role table, as on-screen sRGB hex. */
export const weatherRoleSets = {
    midday: {
        cloudFair: ['#f8f6ff', '#c4cbf5'],
        cloudOvercast: ['#eceafd', '#a6acec'],
        cloudRain: ['#e4e6fd', '#9ca6ea'],
        cloudStorm: ['#ddd6fb', '#968ce2'],
        cloudSnow: ['#f2f5ff', '#b6c4f2'],
        cloudRim: '#fbfaff',
        stormSky: ['#8a84de', '#aca6ee', '#dcd4f8'],
        cloudShadowTint: '#c3c9f8',
        cloudShadowStrength: 0.85,
        mist: '#e3defc',
        mistLow: '#c4c2f4',
        rainHead: '#a2dcff',
        rainTail: '#2f9aff',
        splashRing: '#f2faff',
        splashRingEdge: '#4fb2ff',
        puddleDeep: '#5ab8ff',
        puddleLight: '#bfe6ff',
        flakeCore: '#fbfcff',
        flakeEdge: '#b4cbf6',
        iconFlakeFace: '#8fd6fa',
        iconFlakeRim: '#4aa6ee',
        iconFlakeGlint: '#e2f6ff',
        windSwoosh: '#fbfcff',
        boltFace: '#ffd31c',
        boltSide: '#ffb300',
        boltLight: '#fff3a6',
        boltGlow: '#fff2d0',
    },
    sunset: {
        cloudFair: ['#ffeee2', '#d7abd8'],
        cloudOvercast: ['#f6e4ee', '#b8a0dc'],
        cloudRain: ['#efe0f0', '#aa9cdc'],
        cloudStorm: ['#e8d8f4', '#9e88d8'],
        cloudSnow: ['#fbeef4', '#c8b2e2'],
        cloudRim: '#fff6ea',
        stormSky: ['#8e82d6', '#b49ad2', '#e8c8cc'],
        cloudShadowTint: '#d4c2f2',
        cloudShadowStrength: 0.7,
        mist: '#f8dcea',
        mistLow: '#e6c4dc',
        rainHead: '#b4d4ff',
        rainTail: '#4f94f8',
        splashRing: '#fff6f6',
        splashRingEdge: '#6aa6ff',
        puddleDeep: '#8f9ff0',
        puddleLight: '#f6d2dc',
        flakeCore: '#fff8f4',
        flakeEdge: '#d2bfee',
        iconFlakeFace: '#9cd4fa',
        iconFlakeRim: '#6a9cee',
        iconFlakeGlint: '#f4f0ff',
        windSwoosh: '#fff8f2',
        boltFace: '#ffd31c',
        boltSide: '#ffb300',
        boltLight: '#fff3a6',
        boltGlow: '#fff2d8',
    },
    night: {
        cloudFair: ['#cbcaf8', '#8f92de'],
        cloudOvercast: ['#c6c2f4', '#8a86d8'],
        cloudRain: ['#c0c0f4', '#8488da'],
        cloudStorm: ['#bcb2f2', '#7e72d2'],
        cloudSnow: ['#d4d6fa', '#9aa2e6'],
        cloudRim: '#e2e2ff',
        stormSky: ['#574bb6', '#6a62c8', '#887ed4'],
        cloudShadowTint: '#c2c4f6',
        cloudShadowStrength: 0.5,
        mist: '#b2b0f0',
        mistLow: '#9796e2',
        rainHead: '#e0f2ff',
        rainTail: '#a8dcff',
        splashRing: '#e4f2ff',
        splashRingEdge: '#9ed2ff',
        puddleDeep: '#7d84e4',
        puddleLight: '#c6ccff',
        flakeCore: '#f2f3ff',
        flakeEdge: '#a6b0f0',
        iconFlakeFace: '#a6dcff',
        iconFlakeRim: '#6c8cec',
        iconFlakeGlint: '#eef6ff',
        windSwoosh: '#dcdeff',
        boltFace: '#ffd31c',
        boltSide: '#ffb300',
        boltLight: '#fff3a6',
        boltGlow: '#fff2d0',
    },
} as const satisfies Record<WeatherRoleTime, WeatherRoleSet>;

type WeatherRoleColorKey = {
    [Key in keyof WeatherRoleSet]: WeatherRoleSet[Key] extends string
        ? Key
        : never;
}[keyof WeatherRoleSet];

const singleColorRoles = [
    'cloudRim',
    'cloudShadowTint',
    'mist',
    'mistLow',
    'rainHead',
    'rainTail',
    'splashRing',
    'splashRingEdge',
    'puddleDeep',
    'puddleLight',
    'flakeCore',
    'flakeEdge',
    'iconFlakeFace',
    'iconFlakeRim',
    'iconFlakeGlint',
    'windSwoosh',
    'boltFace',
    'boltSide',
    'boltLight',
    'boltGlow',
] as const satisfies readonly WeatherRoleColorKey[];

export type WeatherRoleTimeWeights = Record<WeatherRoleTime, number>;

/** How much a weather tone moves the cloud body toward it, 0 to 1. */
export type WeatherToneWeights = {
    overcast: number;
    rain: number;
    snow: number;
    storm: number;
};

export type WeatherRoleBlend = {
    cloudy?: number;
    rainy?: number;
    snowy?: number;
    /** The damped storm amount (`resolveWeatherStorm`), not `thundery`. */
    storm?: number;
};

/**
 * Colours are `THREE.Color` in the working (linear) colour space. An unlit
 * `ShaderMaterial` with `toneMapped: false` that ends with
 * `#include <colorspace_fragment>` shows each one as its exact role hex.
 */
export type ResolvedWeatherRoles = {
    [Key in (typeof singleColorRoles)[number]]: Color;
} & {
    time: WeatherRoleTimeWeights;
    tone: WeatherToneWeights;
    /** Cloud body after the weather tone: lit top and shaded underside. */
    cloudLit: Color;
    cloudShade: Color;
    stormSky: [top: Color, middle: Color, bottom: Color];
    cloudShadowStrength: number;
};

function clamp01(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

type Rgb = [number, number, number];

const parsedHex = new Map<string, Rgb>();

function srgbChannels(hex: string): Rgb {
    const cached = parsedHex.get(hex);
    if (cached) {
        return cached;
    }
    const value = Number.parseInt(hex.slice(1), 16);
    const rgb: Rgb = [
        ((value >> 16) & 255) / 255,
        ((value >> 8) & 255) / 255,
        (value & 255) / 255,
    ];
    parsedHex.set(hex, rgb);
    return rgb;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
    const t = clamp01(amount);
    return [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
    ];
}

function toColor(rgb: Rgb) {
    return new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
}

/**
 * Weights of the midday, sunset and night sets at a visual time of day,
 * from the light rig: night is the rig's night share, and twilight (dawn and
 * dusk) moves the day share toward the warm sunset set. They add up to one.
 */
export function resolveWeatherRoleTimeWeights(
    timeOfDay: number,
): WeatherRoleTimeWeights {
    const day = clamp01(getAtmosphereDayAmount(timeOfDay));
    const twilight = clamp01(getAtmosphereTwilightAmount(timeOfDay));
    return {
        midday: day * (1 - twilight),
        sunset: day * twilight,
        night: 1 - day,
    };
}

/**
 * How far the cloud body moves toward each weather tone, as the target's
 * `cloudTone`: overcast from cloudy 0.3 to 0.9, rain at 90%, snow at 120%
 * (clamped) and the damped storm amount. The tones apply in that order.
 */
export function resolveWeatherToneWeights(
    blend: WeatherRoleBlend,
): WeatherToneWeights {
    return {
        overcast: smoothstep(0.3, 0.9, blend.cloudy ?? 0),
        rain: clamp01((blend.rainy ?? 0) * 0.9),
        snow: clamp01((blend.snowy ?? 0) * 1.2),
        storm: clamp01(blend.storm ?? 0),
    };
}

function mixTimes(
    time: WeatherRoleTimeWeights,
    pick: (set: WeatherRoleSet) => string,
): Rgb {
    const midday = srgbChannels(pick(weatherRoleSets.midday));
    const sunset = srgbChannels(pick(weatherRoleSets.sunset));
    const night = srgbChannels(pick(weatherRoleSets.night));
    const channel = (index: 0 | 1 | 2) =>
        midday[index] * time.midday +
        sunset[index] * time.sunset +
        night[index] * time.night;
    return [channel(0), channel(1), channel(2)];
}

/**
 * Every weather colour at a time of day and weather blend. Call it when the
 * time of day or the blended amounts change, not every frame.
 */
export function resolveWeatherRoles(
    timeOfDay: number,
    blend: WeatherRoleBlend,
): ResolvedWeatherRoles {
    const time = resolveWeatherRoleTimeWeights(timeOfDay);
    const tone = resolveWeatherToneWeights(blend);

    const cloudTone = (index: 0 | 1) => {
        let rgb = mixTimes(time, (set) => set.cloudFair[index]);
        rgb = mixRgb(
            rgb,
            mixTimes(time, (set) => set.cloudOvercast[index]),
            tone.overcast,
        );
        rgb = mixRgb(
            rgb,
            mixTimes(time, (set) => set.cloudRain[index]),
            tone.rain,
        );
        rgb = mixRgb(
            rgb,
            mixTimes(time, (set) => set.cloudSnow[index]),
            tone.snow,
        );
        rgb = mixRgb(
            rgb,
            mixTimes(time, (set) => set.cloudStorm[index]),
            tone.storm,
        );
        return toColor(rgb);
    };

    const single = (key: (typeof singleColorRoles)[number]) =>
        toColor(mixTimes(time, (set) => set[key]));

    return {
        cloudRim: single('cloudRim'),
        cloudShadowTint: single('cloudShadowTint'),
        mist: single('mist'),
        mistLow: single('mistLow'),
        rainHead: single('rainHead'),
        rainTail: single('rainTail'),
        splashRing: single('splashRing'),
        splashRingEdge: single('splashRingEdge'),
        puddleDeep: single('puddleDeep'),
        puddleLight: single('puddleLight'),
        flakeCore: single('flakeCore'),
        flakeEdge: single('flakeEdge'),
        iconFlakeFace: single('iconFlakeFace'),
        iconFlakeRim: single('iconFlakeRim'),
        iconFlakeGlint: single('iconFlakeGlint'),
        windSwoosh: single('windSwoosh'),
        boltFace: single('boltFace'),
        boltSide: single('boltSide'),
        boltLight: single('boltLight'),
        boltGlow: single('boltGlow'),
        time,
        tone,
        cloudLit: cloudTone(0),
        cloudShade: cloudTone(1),
        stormSky: [
            toColor(mixTimes(time, (set) => set.stormSky[0])),
            toColor(mixTimes(time, (set) => set.stormSky[1])),
            toColor(mixTimes(time, (set) => set.stormSky[2])),
        ],
        cloudShadowStrength:
            weatherRoleSets.midday.cloudShadowStrength * time.midday +
            weatherRoleSets.sunset.cloudShadowStrength * time.sunset +
            weatherRoleSets.night.cloudShadowStrength * time.night,
    };
}
