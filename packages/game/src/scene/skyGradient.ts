import chroma from 'chroma-js';
import { Color } from 'three';
import { getGameBackgroundPalette } from './backgroundPalettes';
import {
    getVisualDaylightAmount,
    getVisualNightAmount,
    smoothstep,
    visualDayNightTimes,
} from './visualDayNight';

const currentBackgroundColorScale = chroma
    .scale([
        '#2D3947',
        '#6f8cac',
        '#BADDf6',
        '#F7F1DD',
        '#FAF4E2',
        '#f8b195',
        '#6c5b7b',
        '#2D3947',
    ])
    .domain([
        visualDayNightTimes.dawnNightEnd,
        visualDayNightTimes.sunrise,
        visualDayNightTimes.dayStart - 0.03,
        visualDayNightTimes.dayStart,
        visualDayNightTimes.lateDayStart,
        visualDayNightTimes.sunset,
        0.84,
        visualDayNightTimes.nightStart,
    ]);

const currentHemisphereSkyColorScale = chroma
    .scale([
        chroma.temperature(20000),
        chroma.temperature(2000),
        chroma.temperature(20000),
        chroma.temperature(20000),
        chroma.temperature(2000),
        chroma.temperature(20000),
    ])
    .domain([
        visualDayNightTimes.dawnNightEnd,
        visualDayNightTimes.dawnLightEnd,
        visualDayNightTimes.dayStart,
        visualDayNightTimes.lateDayStart,
        visualDayNightTimes.duskNightStart,
        visualDayNightTimes.nightStart,
    ]);

const neutralSkyTheme = {
    dayColor: '#E6F6FF',
    lightColor: '#FFF9EA',
    nightColor: '#2D3947',
};

export type SkyGradientWeather = {
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowy?: number;
    thundery?: number;
};

export type SkyBackgroundColors = {
    background: number[];
    hemisphereSkyColor: number[];
};

export type SkyGradientColors = {
    horizon: Color;
    lower: Color;
    moonGlow: Color;
    moonGlowIntensity: number;
    sunGlow: Color;
    sunGlowIntensity: number;
    upper: Color;
    zenith: Color;
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

function colorFromRgb(rgb: number[]) {
    return new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 'srgb');
}

function colorFromHex(hex: string) {
    return new Color(hex);
}

function shiftHsl(
    color: Color,
    {
        hueOffset = 0,
        lightnessOffset = 0,
        lightnessScale = 1,
        saturationScale = 1,
    }: {
        hueOffset?: number;
        lightnessOffset?: number;
        lightnessScale?: number;
        saturationScale?: number;
    },
) {
    const hsl = { h: 0, l: 0, s: 0 };
    color.getHSL(hsl);
    const hue = (hsl.h + hueOffset + 1) % 1;
    return new Color().setHSL(
        hue,
        clamp01(hsl.s * saturationScale),
        clamp01(hsl.l * lightnessScale + lightnessOffset),
    );
}

function applyWeatherTone(color: Color, weather: SkyGradientWeather) {
    const cloudy = clamp01(weather.cloudy ?? 0);
    const foggy = clamp01(weather.foggy ?? 0);
    const rainy = clamp01(weather.rainy ?? 0);
    const snowy = clamp01(weather.snowy ?? 0);
    const overcast = clamp01(cloudy + foggy * 0.7 + rainy * 0.25);
    const hsl = { h: 0, l: 0, s: 0 };
    color.getHSL(hsl);
    return new Color().setHSL(
        hsl.h,
        clamp01(hsl.s * (1 - overcast * 0.5) * (1 - snowy * 0.22)),
        clamp01(
            hsl.l * (1 - overcast * 0.08 - rainy * 0.06) +
                foggy * 0.045 +
                snowy * 0.035,
        ),
    );
}

function getTwilightAmount(timeOfDay: number) {
    const dawn =
        smoothstep(
            visualDayNightTimes.dawnNightEnd,
            visualDayNightTimes.sunrise,
            timeOfDay,
        ) *
        (1 -
            smoothstep(
                visualDayNightTimes.dawnLightEnd,
                visualDayNightTimes.dayStart,
                timeOfDay,
            ));
    const dusk =
        smoothstep(
            visualDayNightTimes.lateDayStart,
            visualDayNightTimes.sunset,
            timeOfDay,
        ) *
        (1 -
            smoothstep(
                visualDayNightTimes.duskNightStart,
                visualDayNightTimes.nightStart,
                timeOfDay,
            ));

    return Math.max(dawn, dusk);
}

function getDuskAmount(timeOfDay: number) {
    return (
        smoothstep(
            visualDayNightTimes.lateDayStart,
            visualDayNightTimes.sunset,
            timeOfDay,
        ) *
        (1 -
            smoothstep(
                visualDayNightTimes.duskNightStart,
                visualDayNightTimes.nightStart,
                timeOfDay,
            ))
    );
}

function resolvePaletteTheme(backgroundPaletteIndex: number) {
    const palette = getGameBackgroundPalette(backgroundPaletteIndex);

    if (palette.kind === 'current') {
        return {
            day: colorFromHex(neutralSkyTheme.dayColor),
            light: colorFromHex(neutralSkyTheme.lightColor),
            night: colorFromHex(neutralSkyTheme.nightColor),
            upperDayBlend: 0.18,
            zenithDayBlend: 0.86,
        };
    }

    return {
        day: colorFromHex(palette.dayColor),
        light: colorFromHex(palette.lightColor),
        night: colorFromHex(palette.nightColor),
        upperDayBlend: 0.12,
        zenithDayBlend: 0.08,
    };
}

export function resolveThemedSkyBackgroundColors({
    backgroundPaletteIndex,
    timeOfDay,
}: {
    backgroundPaletteIndex: number;
    timeOfDay: number;
}): SkyBackgroundColors | null {
    const palette = getGameBackgroundPalette(backgroundPaletteIndex);

    if (palette.kind === 'current') {
        return null;
    }

    const daylight = getVisualDaylightAmount(timeOfDay);

    return {
        background: chroma
            .mix(palette.nightColor, palette.dayColor, daylight, 'rgb')
            .rgb(),
        hemisphereSkyColor: chroma
            .mix(palette.nightColor, palette.lightColor, daylight, 'rgb')
            .rgb(),
    };
}

export function resolveEnvironmentSkyBackgroundColors({
    backgroundPaletteIndex,
    timeOfDay,
}: {
    backgroundPaletteIndex: number;
    timeOfDay: number;
}): SkyBackgroundColors {
    const themedBackground = resolveThemedSkyBackgroundColors({
        backgroundPaletteIndex,
        timeOfDay,
    });

    if (themedBackground) {
        return themedBackground;
    }

    return {
        background: currentBackgroundColorScale(timeOfDay).rgb(),
        hemisphereSkyColor: currentHemisphereSkyColorScale(timeOfDay).rgb(),
    };
}

export function resolveSkyBackgroundColor({
    background,
    moonlitSkyScale,
    weather,
}: {
    background: number[];
    moonlitSkyScale: number;
    weather?: SkyGradientWeather | null;
}) {
    const color = colorFromRgb(background);
    const moonlitBackground = { h: 0, l: 0, s: 0 };
    color.getHSL(moonlitBackground);
    color.setHSL(
        moonlitBackground.h,
        moonlitBackground.s,
        moonlitBackground.l * moonlitSkyScale,
    );

    if (weather) {
        return applyWeatherTone(color, weather);
    }

    return color;
}

export function resolveSkyGradientColors({
    backgroundColor,
    backgroundPaletteIndex,
    moonlight,
    timeOfDay,
    weather,
}: {
    backgroundColor: Color;
    backgroundPaletteIndex: number;
    moonlight: number;
    timeOfDay: number;
    weather?: SkyGradientWeather | null;
}): SkyGradientColors {
    const theme = resolvePaletteTheme(backgroundPaletteIndex);
    const daylight = getVisualDaylightAmount(timeOfDay);
    const night = getVisualNightAmount(timeOfDay);
    const twilight = getTwilightAmount(timeOfDay);
    const dusk = getDuskAmount(timeOfDay);
    const cloudy = clamp01(weather?.cloudy ?? 0);
    const foggy = clamp01(weather?.foggy ?? 0);
    const rainy = clamp01(weather?.rainy ?? 0);
    const snowy = clamp01(weather?.snowy ?? 0);
    const storm = clamp01(rainy + (weather?.thundery ?? 0) * 0.35);
    const overcast = clamp01(cloudy + foggy * 0.7 + rainy * 0.25);
    const visibleMoonlight = clamp01(moonlight);
    const twilightWarmth = dusk > 0.5 ? '#ff9f7c' : '#ffd59c';
    const nightFloorDarkening = Math.max(
        night,
        smoothstep(
            visualDayNightTimes.sunset,
            visualDayNightTimes.nightStart,
            timeOfDay,
        ),
    );

    const base = backgroundColor.clone();
    const zenith = shiftHsl(base, {
        hueOffset: night > 0 ? 0.025 : -0.018 * daylight,
        lightnessOffset: -0.012 * daylight - 0.04 * night,
        lightnessScale: 0.96 - twilight * 0.04 - night * 0.08,
        saturationScale: 0.86 + twilight * 0.22 + night * 0.12,
    })
        .lerp(theme.night, night * 0.2)
        .lerp(theme.day, daylight * theme.zenithDayBlend)
        .lerp(colorFromHex('#4d5f83'), night * visibleMoonlight * 0.13);

    const upper = base
        .clone()
        .lerp(zenith, 0.36)
        .lerp(theme.day, daylight * theme.upperDayBlend)
        .lerp(colorFromHex('#6f8fb7'), night * visibleMoonlight * 0.08);

    const horizon = shiftHsl(base, {
        lightnessOffset: 0.035 + daylight * 0.035 - nightFloorDarkening * 0.07,
        saturationScale: 1.02 + twilight * 0.2,
    })
        .lerp(
            theme.light,
            (0.28 + daylight * 0.16) * (1 - nightFloorDarkening * 0.82),
        )
        .lerp(colorFromHex(twilightWarmth), twilight * 0.35)
        .lerp(theme.night, nightFloorDarkening * 0.34 + night * 0.2)
        .lerp(colorFromHex('#9fb4d4'), night * visibleMoonlight * 0.05);

    const lower = horizon
        .clone()
        .lerp(theme.night, nightFloorDarkening * 0.62 + night * 0.2)
        .lerp(zenith, nightFloorDarkening * 0.06);

    const weatherTone = {
        cloudy: overcast,
        foggy,
        rainy: storm,
        snowy,
    };

    const sunGlow = colorFromHex('#fff1bd')
        .lerp(theme.light, daylight * 0.08)
        .lerp(colorFromHex(twilightWarmth), twilight * 0.34)
        .lerp(colorFromHex('#e7eefc'), night * 0.24);
    const moonGlow = colorFromHex('#d9e8ff')
        .lerp(theme.light, 0.18)
        .lerp(colorFromHex('#f2f1e9'), daylight * 0.28);

    return {
        zenith: applyWeatherTone(zenith, weatherTone),
        upper: applyWeatherTone(upper, weatherTone),
        horizon: applyWeatherTone(horizon, weatherTone),
        lower: applyWeatherTone(lower, weatherTone),
        sunGlow: applyWeatherTone(sunGlow, weatherTone),
        sunGlowIntensity:
            (0.26 + daylight * 0.22 + twilight * 0.26) *
            (1 - overcast * 0.72) *
            (1 - storm * 0.2),
        moonGlow: applyWeatherTone(moonGlow, weatherTone),
        moonGlowIntensity:
            night *
            (0.035 + visibleMoonlight * 0.13) *
            (1 - overcast * 0.68) *
            (1 - storm * 0.15),
    };
}

export function cloneSkyGradientColors(
    gradient: SkyGradientColors,
): SkyGradientColors {
    return {
        horizon: gradient.horizon.clone(),
        lower: gradient.lower.clone(),
        moonGlow: gradient.moonGlow.clone(),
        moonGlowIntensity: gradient.moonGlowIntensity,
        sunGlow: gradient.sunGlow.clone(),
        sunGlowIntensity: gradient.sunGlowIntensity,
        upper: gradient.upper.clone(),
        zenith: gradient.zenith.clone(),
    };
}

export function lerpSkyGradientColors(
    current: SkyGradientColors,
    target: SkyGradientColors,
    amount: number,
) {
    current.zenith.lerp(target.zenith, amount);
    current.upper.lerp(target.upper, amount);
    current.horizon.lerp(target.horizon, amount);
    current.lower.lerp(target.lower, amount);
    current.sunGlow.lerp(target.sunGlow, amount);
    current.moonGlow.lerp(target.moonGlow, amount);
    current.sunGlowIntensity = mix(
        current.sunGlowIntensity,
        target.sunGlowIntensity,
        amount,
    );
    current.moonGlowIntensity = mix(
        current.moonGlowIntensity,
        target.moonGlowIntensity,
        amount,
    );

    return current;
}
