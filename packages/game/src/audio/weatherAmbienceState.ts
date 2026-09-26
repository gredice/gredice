import type { EnvironmentWeather } from '../scene/weatherBlend';

// Exponential time constants: ~95% settled after three constants.
export const weatherAudioFadeSeconds = 0.8;
export const debugWeatherAudioFadeSeconds = 0.2;

function unit(value = 0) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function smooth(from: number, to: number, value: number) {
    const amount = unit((value - from) / (to - from));
    return amount * amount * (3 - 2 * amount);
}

/** Targets are instantaneous; only mixer gains are blended, independently of visuals. */
export function resolveWeatherAmbience(
    timeOfDay: number,
    weather: EnvironmentWeather | undefined,
) {
    const time = unit(timeOfDay);
    const morning = smooth(0.13, 0.17, time) * (1 - smooth(0.28, 0.32, time));
    const day = smooth(0.28, 0.32, time) * (1 - smooth(0.78, 0.82, time));
    const night = 1 - morning - day;
    const rain = unit(weather?.rainy);
    const snow = unit(weather?.snowy);
    const coverage = unit((weather?.snowAccumulation ?? 0) / 30);
    // Retain the garden bed through storms; snow gently muffles it.
    const bed = 0.65 * (1 - rain * 0.55) * (1 - Math.max(snow, coverage) * 0.3);
    const wetDay = smooth(0, 0.35, rain);
    const medium = smooth(0.3, 0.65, rain);
    const heavy = smooth(0.65, 1, rain);
    const rainGain = 0.55 * smooth(0, 1, rain);

    return [
        { name: 'Morning 01', gain: morning * bed },
        { name: 'Day Birds 01', gain: day * bed * (1 - wetDay) },
        { name: 'Night 01', gain: night * bed },
        { name: 'Day Rain 01', gain: day * bed * wetDay },
        { name: 'Mod Rain Light 01', gain: rainGain * (1 - medium) },
        { name: 'Mod Rain Medium 01', gain: rainGain * medium * (1 - heavy) },
        { name: 'Rain Heavy 01', gain: rainGain * heavy },
    ];
}
