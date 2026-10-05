import { autumnSeed } from './autumnState';
import type { GameQualityProfileTier } from './gameQuality';

export const steamEmitterCaps = {
    low: 0,
    'auto-constrained': 0,
    medium: 4,
    high: 8,
    custom: 6,
} satisfies Record<GameQualityProfileTier, number>;
export const steamParticlesPerEmitter = 6;

export function resolveSteamStrength({
    enabled,
    reducedMotion,
    rain,
    snow,
}: {
    enabled: boolean;
    reducedMotion: boolean;
    rain: number;
    snow: number;
}) {
    if (
        !enabled ||
        reducedMotion ||
        !Number.isFinite(rain) ||
        !Number.isFinite(snow)
    )
        return 0;
    // Accumulated snow covers the cups; strong precipitation disperses the plume.
    if (snow >= 0.01 || rain >= 1.5) return 0;
    return 1 - Math.max(0, rain) * 0.4;
}

export function createSteamParticle(id: string, index: number) {
    return {
        phase:
            (index + autumnSeed(`${id}:steam:phase`)) /
            steamParticlesPerEmitter,
        duration: 2.4 + autumnSeed(`${id}:steam:duration`) * 0.8,
        angle: autumnSeed(`${id}:${index}:steam:angle`) * Math.PI * 2,
    };
}

/** Closed form: calendar date, frame history and mount order cannot change a still. */
export function sampleSteamParticle(
    particle: ReturnType<typeof createSteamParticle>,
    time: number,
    radius: number,
    windSpeed: number,
    windDirection: number,
) {
    const seconds = Number.isFinite(time) ? Math.max(0, time) : 0;
    const age = (seconds / particle.duration + particle.phase) % 1;
    const wind = Number.isFinite(windSpeed)
        ? Math.min(3, Math.max(0, windSpeed))
        : 0;
    const direction =
        ((Number.isFinite(windDirection) ? windDirection : 0) * Math.PI) / 180;
    const mouthRadius = Number.isFinite(radius)
        ? Math.min(0.04, Math.max(0, radius))
        : 0;
    const size = 0.024 + age * 0.055;
    const swirl = mouthRadius * 0.3 + age * 0.008;
    return {
        x:
            Math.sin(particle.angle + age * 5) * swirl +
            Math.sin(direction) * wind * age * 0.018,
        // Even the bottom of a billboard viewed edge-on stays above the mug rim.
        y: 0.012 + size / 2 + age * 0.23,
        z:
            Math.cos(particle.angle + age * 5) * swirl -
            Math.cos(direction) * wind * age * 0.018,
        size,
        opacity: Math.sin(Math.PI * age) ** 2 * 0.3,
    };
}
