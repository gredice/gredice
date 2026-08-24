import * as SunCalc from 'suncalc';

export const publicEnvironmentWeatherKinds = [
    'live',
    'clear',
    'cloudy',
    'rain',
    'snow',
    'fog',
    'storm',
] as const;

export type PublicEnvironmentWeatherKind =
    (typeof publicEnvironmentWeatherKinds)[number];

export function isPublicEnvironmentWeatherKind(
    value: string,
): value is PublicEnvironmentWeatherKind {
    return publicEnvironmentWeatherKinds.some((kind) => kind === value);
}

export type PublicEnvironmentWeather = {
    cloudy: number;
    foggy: number;
    rainy: number;
    snowy: number;
    thundery: number;
};

export type PublicEnvironmentCelestialBody = {
    altitude: number;
    azimuth: number;
    left: number;
    top: number;
    visible: boolean;
};

export type PublicEnvironmentSnapshot = {
    dark: boolean;
    horizon: string;
    lower: string;
    moon: PublicEnvironmentCelestialBody & {
        brightLimbAngle: number;
        illuminationPath: string;
        phase: number;
    };
    nightAmount: number;
    sun: PublicEnvironmentCelestialBody;
    themeHue: number;
    upper: string;
    zenith: string;
};

export const publicEnvironmentDefaultLocation = {
    lat: 45.739,
    lon: 16.572,
};

export const clearPublicEnvironmentWeather: PublicEnvironmentWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
};

export const publicEnvironmentWeatherPresets: Record<
    Exclude<PublicEnvironmentWeatherKind, 'live'>,
    PublicEnvironmentWeather
> = {
    clear: clearPublicEnvironmentWeather,
    cloudy: {
        cloudy: 0.82,
        foggy: 0.08,
        rainy: 0,
        snowy: 0,
        thundery: 0,
    },
    rain: {
        cloudy: 0.9,
        foggy: 0.12,
        rainy: 0.78,
        snowy: 0,
        thundery: 0,
    },
    snow: {
        cloudy: 0.78,
        foggy: 0.12,
        rainy: 0,
        snowy: 0.9,
        thundery: 0,
    },
    fog: {
        cloudy: 0.45,
        foggy: 0.9,
        rainy: 0,
        snowy: 0,
        thundery: 0,
    },
    storm: {
        cloudy: 1,
        foggy: 0.2,
        rainy: 1,
        snowy: 0,
        thundery: 1,
    },
};

type Rgb = readonly [number, number, number];

type SkyPalette = {
    horizon: Rgb;
    hue: number;
    lower: Rgb;
    upper: Rgb;
    zenith: Rgb;
};

const nightPalette: SkyPalette = {
    zenith: [6, 15, 31],
    upper: [18, 35, 62],
    horizon: [60, 57, 91],
    lower: [24, 31, 47],
    hue: 218,
};

const dawnPalette: SkyPalette = {
    zenith: [68, 91, 137],
    upper: [120, 138, 177],
    horizon: [249, 174, 139],
    lower: [255, 218, 164],
    hue: 30,
};

const dayPalette: SkyPalette = {
    zenith: [86, 165, 218],
    upper: [142, 204, 235],
    horizon: [220, 235, 231],
    lower: [246, 235, 205],
    hue: 202,
};

const duskPalette: SkyPalette = {
    zenith: [42, 49, 87],
    upper: [112, 79, 124],
    horizon: [231, 133, 112],
    lower: [248, 177, 116],
    hue: 326,
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const amount = clamp01((value - edge0) / (edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
}

function mixNumber(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
    return [
        mixNumber(from[0], to[0], amount),
        mixNumber(from[1], to[1], amount),
        mixNumber(from[2], to[2], amount),
    ];
}

function mixHue(from: number, to: number, amount: number) {
    const delta = ((to - from + 540) % 360) - 180;
    return (from + delta * amount + 360) % 360;
}

function mixPalette(from: SkyPalette, to: SkyPalette, amount: number) {
    return {
        zenith: mixRgb(from.zenith, to.zenith, amount),
        upper: mixRgb(from.upper, to.upper, amount),
        horizon: mixRgb(from.horizon, to.horizon, amount),
        lower: mixRgb(from.lower, to.lower, amount),
        hue: mixHue(from.hue, to.hue, amount),
    } satisfies SkyPalette;
}

function weatherTone(color: Rgb, weather: PublicEnvironmentWeather): Rgb {
    const overcast = clamp01(
        weather.cloudy +
            weather.foggy * 0.72 +
            weather.rainy * 0.3 +
            weather.thundery * 0.35,
    );
    const luminance = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
    const gray: Rgb = [luminance, luminance, luminance];
    let toned = mixRgb(color, gray, overcast * 0.46);
    const stormDarkening = weather.rainy * 0.12 + weather.thundery * 0.16;
    toned = mixRgb(toned, [16, 26, 39], clamp01(stormDarkening));
    toned = mixRgb(toned, [239, 245, 247], weather.foggy * 0.22);
    toned = mixRgb(toned, [236, 244, 249], weather.snowy * 0.2);
    return toned;
}

function rgbToCss(color: Rgb) {
    return `rgb(${color.map((channel) => Math.round(channel)).join(' ')})`;
}

function resolveBaseSkyPalette(date: Date, sunAltitude: number) {
    const morning = date.getHours() < 12;

    if (morning) {
        if (sunAltitude < -10) return nightPalette;
        if (sunAltitude < -1) {
            return mixPalette(
                nightPalette,
                dawnPalette,
                smoothstep(-10, -1, sunAltitude),
            );
        }
        if (sunAltitude < 12) {
            return mixPalette(
                dawnPalette,
                dayPalette,
                smoothstep(-1, 12, sunAltitude),
            );
        }
        return dayPalette;
    }

    if (sunAltitude >= 12) return dayPalette;
    if (sunAltitude >= -1) {
        return mixPalette(
            duskPalette,
            dayPalette,
            smoothstep(-1, 12, sunAltitude),
        );
    }
    if (sunAltitude >= -10) {
        return mixPalette(
            nightPalette,
            duskPalette,
            smoothstep(-10, -1, sunAltitude),
        );
    }
    return nightPalette;
}

function celestialPosition(altitude: number, azimuth: number) {
    return {
        altitude,
        azimuth,
        left: clamp01((azimuth - 45) / 270) * 100,
        top: 78 - Math.sin((Math.max(0, altitude) * Math.PI) / 180) * 64,
        visible: altitude >= -1,
    } satisfies PublicEnvironmentCelestialBody;
}

export function createMoonIlluminationPath(phase: number, samples = 40) {
    const normalizedPhase = ((phase % 1) + 1) % 1;
    const waxing = normalizedPhase <= 0.5;
    const terminatorScale = waxing
        ? Math.cos(normalizedPhase * Math.PI * 2)
        : -Math.cos(normalizedPhase * Math.PI * 2);
    const points: Array<readonly [number, number]> = [];

    for (let index = 0; index <= samples; index += 1) {
        const normalizedY = -1 + (index / samples) * 2;
        const radius = Math.sqrt(Math.max(0, 1 - normalizedY ** 2));
        const normalizedX = waxing ? terminatorScale * radius : -radius;
        points.push([50 + normalizedX * 50, 50 + normalizedY * 50]);
    }

    for (let index = samples; index >= 0; index -= 1) {
        const normalizedY = -1 + (index / samples) * 2;
        const radius = Math.sqrt(Math.max(0, 1 - normalizedY ** 2));
        const normalizedX = waxing ? radius : terminatorScale * radius;
        points.push([50 + normalizedX * 50, 50 + normalizedY * 50]);
    }

    return `${points
        .map(
            ([x, y], index) =>
                `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`,
        )
        .join(' ')} Z`;
}

export function parsePublicEnvironmentWeather(
    value: unknown,
): PublicEnvironmentWeather | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const readIntensity = (key: keyof PublicEnvironmentWeather) => {
        const intensity = Reflect.get(value, key);
        return typeof intensity === 'number' && Number.isFinite(intensity)
            ? clamp01(intensity)
            : 0;
    };

    return {
        cloudy: readIntensity('cloudy'),
        foggy: readIntensity('foggy'),
        rainy: readIntensity('rainy'),
        snowy: readIntensity('snowy'),
        thundery: readIntensity('thundery'),
    };
}

export function resolvePublicEnvironmentSnapshot({
    date,
    weather,
}: {
    date: Date;
    weather: PublicEnvironmentWeather;
}): PublicEnvironmentSnapshot {
    const { lat, lon } = publicEnvironmentDefaultLocation;
    const sunPosition = SunCalc.getPosition(date, lat, lon);
    const moonPosition = SunCalc.getMoonPosition(date, lat, lon);
    const moonIllumination = SunCalc.getMoonIllumination(date);
    const palette = resolveBaseSkyPalette(date, sunPosition.altitude);
    const nightAmount = 1 - smoothstep(-9, 1, sunPosition.altitude);
    const weatherHueShift =
        weather.snowy * 6 - weather.rainy * 5 - weather.thundery * 5;

    return {
        dark: sunPosition.altitude < -4,
        horizon: rgbToCss(weatherTone(palette.horizon, weather)),
        lower: rgbToCss(weatherTone(palette.lower, weather)),
        moon: {
            ...celestialPosition(moonPosition.altitude, moonPosition.azimuth),
            brightLimbAngle:
                90 + moonIllumination.angle - moonPosition.parallacticAngle,
            illuminationPath: createMoonIlluminationPath(
                moonIllumination.phase,
            ),
            phase: moonIllumination.phase,
        },
        nightAmount,
        sun: celestialPosition(sunPosition.altitude, sunPosition.azimuth),
        themeHue: Math.round((palette.hue + weatherHueShift + 360) % 360),
        upper: rgbToCss(weatherTone(palette.upper, weather)),
        zenith: rgbToCss(weatherTone(palette.zenith, weather)),
    };
}
