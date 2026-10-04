import { autumnSeed } from './autumnState';
import type { GameQualityProfileTier } from './gameQuality';

export const autumnLeafCaps = {
    low: 24,
    'auto-constrained': 40,
    medium: 80,
    high: 160,
    custom: 120,
} satisfies Record<GameQualityProfileTier, number>;

/** Reuse the caller's buffer and spread a capped pool across the visible source list. */
export function writeAutumnLeafSourceCounts(
    counts: number[],
    sources: number,
    perTree: number,
    capacity: number,
) {
    counts.length = sources;
    if (!sources) return counts;
    const total = Math.min(capacity, sources * perTree);
    counts.fill(Math.floor(total / sources));
    const extra = total % sources;
    for (let index = 0; index < extra; index++)
        counts[Math.floor((index * sources) / extra)]++;
    return counts;
}
export function resolveAutumnLeafCount(
    tier: GameQualityProfileTier,
    sources: number,
    intensity: number,
    wind: number,
    enabled = true,
) {
    if (!enabled || !Number.isFinite(intensity) || !Number.isFinite(wind))
        return 0;
    return Math.min(
        autumnLeafCaps[tier],
        Math.max(0, Math.floor(sources)) *
            Math.min(
                8,
                Math.ceil(
                    8 *
                        Math.min(1, Math.max(0, intensity)) *
                        (0.65 + Math.min(3, Math.max(0, wind)) * 0.12),
                ),
            ),
    );
}

export function createAutumnLeafDescriptor(id: string, index: number) {
    return {
        phase: autumnSeed(`${id}:${index}:phase`),
        x: (autumnSeed(`${id}:${index}:x`) - 0.5) * 0.9,
        z: (autumnSeed(`${id}:${index}:z`) - 0.5) * 0.9,
        rotation: autumnSeed(`${id}:${index}:rotation`) * Math.PI * 2,
        duration: 4 + autumnSeed(`${id}:${index}:duration`) * 3,
    };
}

/** Closed-form motion makes fixed-time captures independent of frame history. */
export function sampleAutumnLeaf(
    descriptor: ReturnType<typeof createAutumnLeafDescriptor>,
    time: number,
    windSpeed: number,
    windDirection: number,
    height = 1.75,
) {
    const wind = Number.isFinite(windSpeed)
        ? Math.min(3, Math.max(0, windSpeed))
        : 0;
    const direction =
        ((Number.isFinite(windDirection) ? windDirection : 0) * Math.PI) / 180;
    const age =
        (((Math.max(0, time) / descriptor.duration + descriptor.phase) % 1) +
            1) %
        1;
    const drift = age * wind * 0.65;
    return {
        x:
            descriptor.x +
            Math.sin(direction) * drift +
            Math.sin(age * 17 + descriptor.rotation) * 0.12,
        y: height * (1 - age),
        z:
            descriptor.z +
            -Math.cos(direction) * drift +
            Math.cos(age * 11 + descriptor.rotation) * 0.09,
        rotation: descriptor.rotation + age * 8,
        scale: Math.min(1, age * 12, (1 - age) * 10),
    };
}
