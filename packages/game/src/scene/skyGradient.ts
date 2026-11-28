import chroma from 'chroma-js';
import { Color } from 'three';
import { getGameBackgroundPalette } from './backgroundPalettes';
import { gameNightLightRig } from './gameArtStyle';
import { getSolarEclipseVisualScales } from './solarEclipse';
import {
    getVisualDaylightAmount,
    getVisualNightAmount,
    smoothstep,
    visualDayNightTimes,
} from './visualDayNight';
import {
    resolveWeatherRoleTimeWeights,
    weatherRoleSets,
} from './weather/weatherRoles';

// A light party sky at every hour (GAME_ART.md "Time of day and seasons"):
// lilac before dawn, coral, peach and gold at sunrise, clear blue by day,
// gold and coral at sunset, rose and lilac at dusk and a light blue-violet
// at night. The night stop is lighter than it shows: moonlight scales the
// lightness of the night sky (`moonlight.ts`). Stops mix in LCH, which keeps
// the chroma between neighbouring hues, except the pale gold to blue steps
// of the morning and evening, which mix in Lab: an LCH path from gold to
// blue passes through mint green.
const nightBackgroundColor = '#5e64d0';

type SkyBackgroundStop = {
    at: number;
    color: string;
    /** How this stop mixes into the next one. */
    mode?: 'lab' | 'lch';
};

const currentBackgroundStops: readonly SkyBackgroundStop[] = [
    { at: visualDayNightTimes.dawnNightEnd, color: nightBackgroundColor },
    { at: 0.17, color: '#a69ae6' },
    { at: 0.19, color: '#f4a0a6' },
    { at: 0.205, color: '#ffb890' },
    { at: 0.22, color: '#ffd290' },
    { at: 0.237, color: '#fbe8c8', mode: 'lab' },
    { at: 0.255, color: '#c4e4ff' },
    { at: visualDayNightTimes.dayStart, color: '#9fdaff' },
    { at: visualDayNightTimes.lateDayStart, color: '#a9deff', mode: 'lab' },
    { at: 0.77, color: '#fde6c0' },
    { at: 0.785, color: '#ffc690' },
    { at: visualDayNightTimes.sunset, color: '#ffa088' },
    { at: 0.815, color: '#ef98b2' },
    { at: 0.84, color: '#a68ce0' },
    { at: visualDayNightTimes.nightStart, color: nightBackgroundColor },
];

function resolveCurrentBackgroundColor(timeOfDay: number) {
    const first = currentBackgroundStops[0];
    const last = currentBackgroundStops[currentBackgroundStops.length - 1];
    if (!first || !last || timeOfDay <= first.at) {
        return chroma(nightBackgroundColor).rgb();
    }
    for (let index = 1; index < currentBackgroundStops.length; index += 1) {
        const from = currentBackgroundStops[index - 1];
        const to = currentBackgroundStops[index];
        if (from && to && timeOfDay <= to.at) {
            return chroma
                .mix(
                    from.color,
                    to.color,
                    (timeOfDay - from.at) / (to.at - from.at),
                    from.mode ?? 'lch',
                )
                .rgb();
        }
    }
    return chroma(last.color).rgb();
}

// The hemisphere sky is the cool fill. It stays cool all day: the warmth of
// sunrise and sunset belongs to the key light, and an orange fill turned
// every green olive. Lavender at twilight, blue-violet at night.
const currentHemisphereSkyColorScale = chroma
    .scale([
        gameNightLightRig.skyColor,
        '#c0b4ff',
        chroma.temperature(20000),
        chroma.temperature(20000),
        '#b0a0ff',
        gameNightLightRig.skyColor,
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
    // A clear blue overhead that pales toward the horizon.
    dayColor: '#55BBFF',
    lightColor: '#DDF4FF',
    // Deep but saturated indigo that the night zenith leans toward.
    nightColor: '#2f3488',
};

/** Violet glow along the horizon at night, so the floor of the sky stays light. */
const nightHorizonGlow = '#8f88e6';
/** Periwinkle that turns the top of a sunrise or dusk sky lilac. */
const twilightZenith = '#8fa0ec';

export type SkyGradientWeather = {
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowy?: number;
    thundery?: number;
    /**
     * Damped storm amount (`weatherBlend.ts`); the violet storm sky follows
     * it. Without it the discrete `thundery` flag stands in.
     */
    storm?: number;
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

/**
 * Mixes two colours in LCH. A linear RGB mix of a blue sky and a peach
 * horizon passes through grey; LCH keeps the chroma.
 */
function mixLch(from: Color, to: Color, amount: number) {
    return colorFromHex(
        chroma
            .mix(
                `#${from.getHexString()}`,
                `#${to.getHexString()}`,
                clamp01(amount),
                'lch',
            )
            .hex(),
    );
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

function applyWeatherTone(
    color: Color,
    weather: SkyGradientWeather,
    night = 0,
    twilight = 0,
) {
    const cloudy = clamp01(weather.cloudy ?? 0);
    const foggy = clamp01(weather.foggy ?? 0);
    const rainy = clamp01(weather.rainy ?? 0);
    const snowy = clamp01(weather.snowy ?? 0);
    const overcast = clamp01(cloudy + foggy * 0.7 + rainy * 0.25);
    const hsl = { h: 0, l: 0, s: 0 };
    // Cloud, rain and fog move the sky toward periwinkle and keep some of
    // its saturation, so bad weather reads blue-violet rather than grey.
    // The night sky keeps more of it: it is already lighter than a real
    // night, and losing saturation there turns it grey-lavender.
    // At sunrise and sunset it keeps most of it too and leans pink-lilac:
    // periwinkle over the coral horizon mixed to a dusty beige.
    const dusk = clamp01(twilight) * (1 - clamp01(night));
    const saturationKeep =
        1 -
        Math.max(
            clamp01(night) * nightWeatherSaturationRelief,
            dusk * twilightWeatherSaturationRelief,
        );
    // By night the cloud tint is a saturated violet, not a light periwinkle
    // (the target's overcast night stops), so an overcast night stays
    // blue-violet instead of greying out.
    color
        .clone()
        .lerp(
            overcastSkyTint
                .clone()
                .lerp(nightOvercastSkyTint, clamp01(night))
                .lerp(twilightOvercastSkyTint, dusk),
            overcast * (0.2 + twilightOvercastTintGain * dusk),
        )
        .getHSL(hsl);
    return new Color().setHSL(
        hsl.h,
        clamp01(
            hsl.s *
                (1 - overcast * 0.3 * saturationKeep) *
                (1 - snowy * 0.15 * saturationKeep),
        ),
        clamp01(
            hsl.l * (1 - overcast * 0.08 - rainy * 0.06) +
                foggy * 0.03 +
                snowy * 0.025,
        ),
    );
}

const overcastSkyTint = new Color('#9fa8ec');
const nightOvercastSkyTint = new Color('#6c70cf');
/**
 * Overcast and rain at sunrise and sunset: the sky under the deck leans
 * pink-lilac (the target's `#eac4cd`), not dusty beige.
 */
const twilightOvercastSkyTint = new Color('#e88fd6');
const twilightOvercastTintGain = 0.3;
/** Share of the weather saturation loss the night sky is spared. */
const nightWeatherSaturationRelief = 0.65;
/** Share of the weather saturation loss sunrise and sunset are spared. */
const twilightWeatherSaturationRelief = 0.85;

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
        background: resolveCurrentBackgroundColor(timeOfDay),
        hemisphereSkyColor: currentHemisphereSkyColorScale(timeOfDay).rgb(),
    };
}

export function resolveSkyBackgroundColor({
    background,
    moonlitSkyScale,
}: {
    background: number[];
    moonlitSkyScale: number;
    /**
     * @deprecated Ignored. The base stays untoned: the sky gradient applies
     * the weather tone once (it used to be applied twice by day, here and
     * on every gradient band).
     */
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

    return color;
}

/**
 * The storm sky stops (GAME_ART.md "Weather > Colour roles": storm sky, top
 * to bottom) at a time of day, as linear colours.
 */
export function resolveStormSkyStops(timeOfDay: number) {
    const time = resolveWeatherRoleTimeWeights(timeOfDay);
    return [0, 1, 2].map((index) => {
        const mixed = new Color(0, 0, 0);
        for (const key of ['midday', 'sunset', 'night'] as const) {
            const stop = weatherRoleSets[key].stormSky[index];
            if (!stop) continue;
            mixed.add(new Color(stop).multiplyScalar(time[key]));
        }
        return mixed;
    });
}

/** How far the sky moves toward the storm stops at full storm. */
export const stormSkyWeight = 0.9;

export function resolveSkyGradientColors({
    backgroundColor,
    backgroundPaletteIndex,
    moonlight,
    solarEclipseObscuration = 0,
    timeOfDay,
    weather,
}: {
    backgroundColor: Color;
    backgroundPaletteIndex: number;
    moonlight: number;
    solarEclipseObscuration?: number;
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
    const stormSky = clamp01(weather?.storm ?? weather?.thundery ?? 0);
    const overcast = clamp01(cloudy + foggy * 0.7 + rainy * 0.25);
    const visibleMoonlight = clamp01(moonlight);
    const eclipseObscuration = clamp01(solarEclipseObscuration);
    const eclipseScales = getSolarEclipseVisualScales(eclipseObscuration);
    const eclipseSkyColor = colorFromHex('#26364d');
    const applyEclipseTone = (color: Color) =>
        color
            .lerp(eclipseSkyColor, eclipseObscuration * 0.18)
            .multiplyScalar(eclipseScales.sky);
    // Peach-pink at sunrise, coral at sunset. Both stay saturated where they
    // meet the blue, so the horizon never mixes to grey.
    const twilightWarmth = dusk > 0.5 ? '#ff9f7c' : '#ffb39a';
    const nightFloorDarkening = Math.max(
        night,
        smoothstep(
            visualDayNightTimes.sunset,
            visualDayNightTimes.nightStart,
            timeOfDay,
        ),
    );

    const base = backgroundColor.clone();
    // The top of a sunrise or dusk sky turns lilac above the warm horizon.
    // An RGB mix of peach and periwinkle is grey, so it mixes in LCH.
    const zenith = mixLch(
        shiftHsl(base, {
            hueOffset: night > 0 ? 0.025 : -0.018 * daylight,
            lightnessOffset: -0.012 * daylight - 0.015 * night,
            lightnessScale: 0.96 - twilight * 0.04 - night * 0.04,
            saturationScale: 0.86 + twilight * 0.22 + night * 0.12,
        }).lerp(theme.night, night * 0.12),
        colorFromHex(twilightZenith),
        twilight * 0.55,
    )
        .lerp(theme.day, daylight * theme.zenithDayBlend)
        .lerp(colorFromHex('#5a5fa8'), night * visibleMoonlight * 0.13);

    const upper = mixLch(base, zenith, 0.36)
        .lerp(theme.day, daylight * theme.upperDayBlend)
        .lerp(colorFromHex('#7a85cc'), night * visibleMoonlight * 0.08);

    // The horizon stays the lightest band at every hour: warm at sunrise
    // and sunset, a violet glow at night.
    const horizon = mixLch(
        shiftHsl(base, {
            lightnessOffset: 0.035 + daylight * 0.035 + night * 0.03,
            saturationScale: 1.02 + twilight * 0.2,
        }).lerp(
            theme.light,
            (0.28 + daylight * 0.16) *
                (1 - nightFloorDarkening * 0.82) *
                (1 - twilight * 0.7),
        ),
        colorFromHex(twilightWarmth),
        twilight * 0.55,
    )
        .lerp(colorFromHex(nightHorizonGlow), night * 0.3)
        .lerp(theme.night, nightFloorDarkening * 0.1)
        .lerp(colorFromHex('#a4b0e8'), night * visibleMoonlight * 0.05);

    const lower = horizon
        .clone()
        .lerp(theme.night, nightFloorDarkening * 0.24)
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

    // Between strikes a storm reads violet, not as heavy rain (GAME_ART.md
    // "Weather > Storm and lightning"); the tint follows the damped storm.
    const [stormTop, stormMiddle, stormBottom] =
        resolveStormSkyStops(timeOfDay);
    const toStorm = (color: Color, stop: Color | undefined) =>
        stop && stormSky > 0
            ? color.lerp(stop, stormSky * stormSkyWeight)
            : color;

    return {
        zenith: applyEclipseTone(
            toStorm(
                applyWeatherTone(zenith, weatherTone, night, twilight),
                stormTop,
            ),
        ),
        upper: applyEclipseTone(
            toStorm(
                applyWeatherTone(upper, weatherTone, night, twilight),
                stormTop && stormMiddle
                    ? stormTop.clone().lerp(stormMiddle, 0.5)
                    : undefined,
            ),
        ),
        horizon: applyEclipseTone(
            toStorm(
                applyWeatherTone(horizon, weatherTone, night, twilight),
                stormMiddle,
            ),
        ),
        lower: applyEclipseTone(
            toStorm(
                applyWeatherTone(lower, weatherTone, night, twilight),
                stormBottom,
            ),
        ),
        sunGlow: applyWeatherTone(sunGlow, weatherTone),
        // A strong midday glow reads as haze over the blue sky, so the glow
        // is mostly kept for sunrise and sunset.
        sunGlowIntensity:
            (0.26 - daylight * 0.14 + twilight * 0.3) *
            (1 - overcast * 0.72) *
            (1 - storm * 0.2) *
            eclipseScales.sunGlow,
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

export function resolveGroundViewSkyGradientColors(
    gradient: SkyGradientColors,
): SkyGradientColors {
    const groundColor = gradient.lower;

    return {
        horizon: groundColor.clone(),
        lower: groundColor.clone(),
        moonGlow: gradient.moonGlow.clone(),
        moonGlowIntensity: 0,
        sunGlow: gradient.sunGlow.clone(),
        sunGlowIntensity: 0,
        upper: groundColor.clone(),
        zenith: groundColor.clone(),
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

function isColorWithinEpsilon(current: Color, target: Color, epsilon: number) {
    return (
        Math.abs(current.r - target.r) <= epsilon &&
        Math.abs(current.g - target.g) <= epsilon &&
        Math.abs(current.b - target.b) <= epsilon
    );
}

export function isSkyGradientWithinEpsilon(
    current: SkyGradientColors,
    target: SkyGradientColors,
    epsilon: number,
) {
    return (
        isColorWithinEpsilon(current.zenith, target.zenith, epsilon) &&
        isColorWithinEpsilon(current.upper, target.upper, epsilon) &&
        isColorWithinEpsilon(current.horizon, target.horizon, epsilon) &&
        isColorWithinEpsilon(current.lower, target.lower, epsilon) &&
        isColorWithinEpsilon(current.sunGlow, target.sunGlow, epsilon) &&
        isColorWithinEpsilon(current.moonGlow, target.moonGlow, epsilon) &&
        Math.abs(current.sunGlowIntensity - target.sunGlowIntensity) <=
            epsilon &&
        Math.abs(current.moonGlowIntensity - target.moonGlowIntensity) <=
            epsilon
    );
}
