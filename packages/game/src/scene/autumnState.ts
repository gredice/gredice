import { SeededRNG } from '../generators/plant/lib/rng';
import type { SeasonState } from './seasonState';

function smooth(start: number, end: number, value: number) {
    const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
}

/** Calendar-only curves. Weather changes motion/layering, never these values. */
export function getAutumnState({ season, progress }: SeasonState) {
    const p = Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0;
    if (season === 'autumn') {
        return {
            foliageColorProgress: smooth(0, 0.8, p),
            leafRetention: 1 - 0.92 * smooth(0.12, 0.85, p),
            fallingLeafIntensity:
                smooth(0.05, 0.35, p) * (1 - smooth(0.6, 0.95, p)),
            settledLeafAmount: 0.85 * smooth(0.1, 0.85, p),
        };
    }
    if (season === 'winter') {
        return {
            foliageColorProgress: 1,
            leafRetention: 0.08,
            fallingLeafIntensity: 0,
            settledLeafAmount: 0.85 - 0.75 * smooth(0, 1, p),
        };
    }
    if (season === 'spring') {
        const growth = smooth(0, 0.65, p);
        return {
            foliageColorProgress: 1 - growth,
            leafRetention: 0.08 + 0.92 * growth,
            fallingLeafIntensity: 0,
            settledLeafAmount: 0.1 * (1 - smooth(0, 0.4, p)),
        };
    }
    return {
        foliageColorProgress: 0,
        leafRetention: 1,
        fallingLeafIntensity: 0,
        settledLeafAmount: 0,
    };
}

export type AutumnState = ReturnType<typeof getAutumnState>;

/** Stable placement variation using the same generator as ground decorations. */
export function autumnSeed(id: string) {
    return new SeededRNG(id).nextFloat();
}
