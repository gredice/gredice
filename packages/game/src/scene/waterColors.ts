import { Color } from 'three';
import { getNightAmount } from './moonlight';

export type WaterEnvironmentWeather = {
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowy?: number;
};

export type WaterColors = {
    deep: string;
    shallow: string;
    foam: string;
};

export const defaultWaterColors: WaterColors = {
    deep: '#8fcfc4',
    shallow: '#d6eee3',
    foam: '#f8fff8',
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function twilightAmount(timeOfDay: number) {
    const sunrise = 1 - smoothstep(0.025, 0.07, Math.abs(timeOfDay - 0.235));
    const sunset = 1 - smoothstep(0.015, 0.065, Math.abs(timeOfDay - 0.765));
    return Math.max(sunrise, sunset);
}

function weatherReflectionAmount(weather: WaterEnvironmentWeather | undefined) {
    if (!weather) {
        return 0;
    }

    return clamp01(
        (weather.cloudy ?? 0) * 0.75 +
            (weather.foggy ?? 0) * 0.65 +
            (weather.rainy ?? 0) * 0.25 +
            (weather.snowy ?? 0) * 0.35,
    );
}

function toHex(color: Color) {
    return `#${color.getHexString()}`;
}

function mixColor(from: string, to: Color, amount: number) {
    return new Color(from).lerp(to, clamp01(amount));
}

export function resolveWaterColors({
    skyColor,
    timeOfDay,
    weather,
}: {
    skyColor: Color;
    timeOfDay: number;
    weather?: WaterEnvironmentWeather;
}): WaterColors {
    const night = getNightAmount(timeOfDay);
    const twilight = twilightAmount(timeOfDay);
    const weatherReflection = weatherReflectionAmount(weather);
    const skyInfluence = clamp01(
        0.14 + night * 0.58 + twilight * 0.24 + weatherReflection * 0.34,
    );

    return {
        deep: toHex(mixColor(defaultWaterColors.deep, skyColor, skyInfluence)),
        shallow: toHex(
            mixColor(
                defaultWaterColors.shallow,
                skyColor,
                skyInfluence * 0.82 + night * 0.12,
            ),
        ),
        foam: toHex(
            mixColor(
                defaultWaterColors.foam,
                skyColor,
                skyInfluence * 0.72 + night * 0.1 + weatherReflection * 0.1,
            ),
        ),
    };
}
