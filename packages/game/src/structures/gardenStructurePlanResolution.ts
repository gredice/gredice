import {
    compilePreparedGardenStructurePlan,
    prepareGardenStructurePlanCompilation,
} from './compileGardenStructurePlan';
import type { GardenStructurePlanCache } from './gardenStructurePlanCache';
import type {
    GardenStructureCompileInput,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

export type GardenStructurePlanResolution = Readonly<{
    cacheOutcome: 'hit' | 'miss';
    compileDurationMs: number;
    lookupDurationMs: number;
    plan: GardenStructureSemanticPlan;
}>;

/**
 * Prepares exactly once so cache lookup and a miss compile share validation,
 * canonicalization, and keying work. When measured, lookup includes all hot
 * path preparation and miss duration includes that lookup plus core compile.
 */
export function resolveGardenStructurePlanWithCache({
    cache,
    input,
    measureDurations = false,
    now = () => performance.now(),
}: Readonly<{
    cache: GardenStructurePlanCache;
    input: GardenStructureCompileInput;
    measureDurations?: boolean;
    now?: () => number;
}>): GardenStructurePlanResolution {
    const resolutionStartedAt = measureDurations ? now() : 0;
    const preparation = prepareGardenStructurePlanCompilation(input);
    const cached = cache.get(preparation.cacheKey);
    const lookupDurationMs = measureDurations
        ? Math.max(0, now() - resolutionStartedAt)
        : 0;
    if (cached) {
        return {
            cacheOutcome: 'hit',
            compileDurationMs: 0,
            lookupDurationMs,
            plan: cached,
        };
    }

    const plan = compilePreparedGardenStructurePlan(preparation);
    const compileDurationMs = measureDurations
        ? Math.max(0, now() - resolutionStartedAt)
        : 0;
    if (plan.cacheKey !== preparation.cacheKey) {
        throw new Error('Structure compiler returned an unexpected cache key.');
    }
    cache.set(plan);
    return {
        cacheOutcome: 'miss',
        compileDurationMs,
        lookupDurationMs,
        plan,
    };
}
