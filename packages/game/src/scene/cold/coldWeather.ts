import { autumnSeed } from '../autumnState';
import type { GameQualityProfileTier } from '../gameQuality';
import type { EnvironmentWeather } from '../weatherBlend';

export const breathCaps = {
    low: 0,
    'auto-constrained': 0,
    medium: 4,
    high: 8,
    custom: 6,
} satisfies Record<GameQualityProfileTier, number>;

export type ColdWeatherInput = Pick<
    EnvironmentWeather,
    | 'temperature'
    | 'isStale'
    | 'source'
    | 'rainy'
    | 'snowy'
    | 'snowAccumulation'
>;

/** Presentation thresholds, not a plant-health or physical frost model. */
export function resolveColdWeather(
    weather: ColdWeatherInput | undefined,
    tier: GameQualityProfileTier,
    enabled = true,
) {
    const temperature = weather?.temperature;
    if (
        !enabled ||
        breathCaps[tier] === 0 ||
        temperature == null ||
        !Number.isFinite(temperature) ||
        weather?.isStale ||
        weather?.source === 'fallback' ||
        ![
            weather?.rainy ?? 0,
            weather?.snowy ?? 0,
            weather?.snowAccumulation ?? 0,
        ].every(Number.isFinite)
    )
        return { frost: 0, breath: 0 };

    // Rain washes the thin treatment away; existing snow takes precedence.
    const rain = Math.max(0, weather?.rainy ?? 0);
    const snow = Math.max(
        0,
        weather?.snowy ?? 0,
        (weather?.snowAccumulation ?? 0) / 3,
    );
    return {
        frost:
            Math.min(1, Math.max(0, -temperature / 4)) *
            Math.max(0, 1 - rain * 5) *
            Math.max(0, 1 - snow),
        breath: Math.min(1, Math.max(0, (5 - temperature) / 7)),
    };
}

export function getBreathCycle(id: string, time: number) {
    const period = 6 + autumnSeed(`${id}:period`) * 4;
    const age =
        (((time + autumnSeed(`${id}:phase`) * period) % period) + period) %
        period;
    const progress = Math.min(1, age / 1.5);
    return {
        progress,
        opacity: age < 1.5 ? Math.sin(progress * Math.PI) * 0.22 : 0,
        size: 0.08 + progress * 0.23,
    };
}
