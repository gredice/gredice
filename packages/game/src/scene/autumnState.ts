import { SeededRNG } from '../generators/plant/lib/rng';
import {
    getSeasonLengthDays,
    getSeasonState,
    type SeasonState,
} from './seasonState';

// Summer and autumn have the same calendar length in leap and common years.
// Start foliage yellowing on August 22 without moving the other season effects.
const summerDays = getSeasonLengthDays('summer', 2000);
const autumnDays = getSeasonLengthDays('autumn', 2000);
const yellowingStart = getSeasonState(new Date(2001, 7, 22)).progress;
const yellowingLeadDays = (1 - yellowingStart) * summerDays;
// Spring progress by which canopies are fully green again, about ten days.
const springGreeningEnd = 0.11;
// How far a spring canopy leans toward the spring green role (GAME_ART
// "Seasonal roles"). Kept partial: the full role has the lawn's hue, so a
// canopy at this share reads fresh and light, near the canopy highlight, but
// still apart from the grass.
const springFreshnessPeak = 0.35;

function foliageColorProgress(daysSinceAutumnStart: number) {
    return smooth(-yellowingLeadDays, autumnDays * 0.8, daysSinceAutumnStart);
}

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
            foliageColorProgress: foliageColorProgress(p * autumnDays),
            leafRetention: 1 - 0.92 * smooth(0.12, 0.85, p),
            fallingLeafIntensity:
                smooth(0.05, 0.35, p) * (1 - smooth(0.6, 0.95, p)),
            settledLeafAmount: 0.85 * smooth(0.1, 0.85, p),
            springFreshness: 0,
        };
    }
    if (season === 'winter') {
        return {
            foliageColorProgress: 1,
            leafRetention: 0.08,
            fallingLeafIntensity: 0,
            settledLeafAmount: 0.85 - 0.75 * smooth(0, 1, p),
            springFreshness: 0,
        };
    }
    if (season === 'spring') {
        const growth = smooth(0, 0.65, p);
        return {
            // Winter's leftover leaves turn green in the first days of
            // spring, so regrowing canopies are fresh green, never autumn
            // orange (GAME_ART "Time of day and seasons").
            foliageColorProgress: 1 - smooth(0, springGreeningEnd, p),
            leafRetention: 0.08 + 0.92 * growth,
            fallingLeafIntensity: 0,
            settledLeafAmount: 0.1 * (1 - smooth(0, 0.4, p)),
            // New leaves are a lighter, fresher green that matures into the
            // summer canopy green by the end of spring.
            springFreshness:
                springFreshnessPeak *
                smooth(0, springGreeningEnd, p) *
                (1 - smooth(0.5, 1, p)),
        };
    }
    return {
        foliageColorProgress: foliageColorProgress((p - 1) * summerDays),
        leafRetention: 1,
        fallingLeafIntensity: 0,
        settledLeafAmount: 0,
        springFreshness: 0,
    };
}

export type AutumnState = ReturnType<typeof getAutumnState>;

/** Stable placement variation using the same generator as ground decorations. */
export function autumnSeed(id: string) {
    return new SeededRNG(id).nextFloat();
}
