import {
    createSlugRandom,
    type SlugHabitatCandidate,
    type SlugSpawn,
    slugMaxGardenPopulation,
    slugSpawnCooldownMs,
} from './slugEcology';

export type SlugBehavior = 'creep' | 'feed' | 'pause' | 'seek-damp';
export type SlugLifecycle = 'active' | 'arriving' | 'departing';

export type SlugPopulationEntry = {
    lifecycle: SlugLifecycle;
    lifecycleStartedAtMs: number;
    spawn: SlugSpawn;
};

export type SlugPopulationState = {
    cooldownUntilById: Record<string, number>;
    entries: SlugPopulationEntry[];
};

export type SlugBehaviorDecision = {
    behavior: SlugBehavior;
    dwellSeconds: number;
    target: SlugHabitatCandidate;
};

export const slugArrivalDurationMs = 1_200;
export const slugDepartureDurationMs = 1_400;
export const slugCreepSpeedBlocksPerSecond = 0.04;

function horizontalDistance(
    left: Pick<SlugHabitatCandidate, 'x' | 'z'>,
    right: Pick<SlugHabitatCandidate, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

export function reconcileSlugPopulation({
    nowMs,
    plan,
    previous,
}: {
    nowMs: number;
    plan: SlugSpawn[];
    previous: SlugPopulationState;
}): SlugPopulationState {
    const desiredById = new Map(plan.map((spawn) => [spawn.id, spawn]));
    const cooldownUntilById = { ...previous.cooldownUntilById };
    const entries: SlugPopulationEntry[] = [];

    for (const previousEntry of previous.entries) {
        const desired = desiredById.get(previousEntry.spawn.id);
        if (previousEntry.lifecycle === 'departing') {
            desiredById.delete(previousEntry.spawn.id);
            if (
                nowMs - previousEntry.lifecycleStartedAtMs >=
                slugDepartureDurationMs
            ) {
                cooldownUntilById[previousEntry.spawn.id] =
                    nowMs + slugSpawnCooldownMs;
                continue;
            }
            entries.push(previousEntry);
            continue;
        }
        if (!desired) {
            entries.push({
                ...previousEntry,
                lifecycle: 'departing',
                lifecycleStartedAtMs: nowMs,
            });
            continue;
        }
        desiredById.delete(previousEntry.spawn.id);
        entries.push({
            lifecycle:
                previousEntry.lifecycle === 'arriving' &&
                nowMs - previousEntry.lifecycleStartedAtMs >=
                    slugArrivalDurationMs
                    ? 'active'
                    : previousEntry.lifecycle,
            lifecycleStartedAtMs: previousEntry.lifecycleStartedAtMs,
            spawn: desired,
        });
    }

    for (const spawn of desiredById.values()) {
        if (entries.length >= slugMaxGardenPopulation) {
            break;
        }
        if ((cooldownUntilById[spawn.id] ?? 0) > nowMs) {
            continue;
        }
        entries.push({
            lifecycle: 'arriving',
            lifecycleStartedAtMs: nowMs,
            spawn,
        });
    }

    for (const [id, cooldownUntil] of Object.entries(cooldownUntilById)) {
        if (cooldownUntil <= nowMs) {
            delete cooldownUntilById[id];
        }
    }

    return { cooldownUntilById, entries };
}

export function chooseSlugBehavior({
    current,
    habitat,
    seed,
}: {
    current: SlugHabitatCandidate;
    habitat: SlugHabitatCandidate[];
    seed: number;
}): SlugBehaviorDecision {
    const random = createSlugRandom(seed);
    const reachableRange = habitat.filter(
        (candidate) =>
            candidate.id !== current.id &&
            horizontalDistance(candidate, current) <= 6,
    );
    const wetter = reachableRange
        .filter((candidate) => candidate.moisture > current.moisture + 0.08)
        .sort(
            (left, right) =>
                right.moisture - left.moisture ||
                left.id.localeCompare(right.id),
        );

    if (wetter.length > 0 && random() < 0.72) {
        return {
            behavior: 'seek-damp',
            dwellSeconds: 0,
            target: wetter[Math.floor(random() * wetter.length)] ?? wetter[0],
        };
    }
    if (current.suitablePlantNearby && random() < 0.46) {
        return {
            behavior: 'feed',
            dwellSeconds: 6 + random() * 8,
            target: current,
        };
    }
    if (reachableRange.length > 0 && random() < 0.58) {
        return {
            behavior: 'creep',
            dwellSeconds: 0,
            target:
                reachableRange[Math.floor(random() * reachableRange.length)] ??
                reachableRange[0],
        };
    }
    return {
        behavior: 'pause',
        dwellSeconds: 5 + random() * 9,
        target: current,
    };
}

export function getSlugAnimationTargets({
    behavior,
    lifecycle,
    lifecycleProgress,
}: {
    behavior: SlugBehavior;
    lifecycle: SlugLifecycle;
    lifecycleProgress: number;
}) {
    const clampedProgress = Math.min(1, Math.max(0, lifecycleProgress));
    return {
        bodyWave: behavior === 'creep' || behavior === 'seek-damp' ? 1 : 0.18,
        feeding: behavior === 'feed' ? 1 : 0,
        feelers: behavior === 'pause' ? 0.62 : 1,
        visibility:
            lifecycle === 'arriving'
                ? clampedProgress
                : lifecycle === 'departing'
                  ? 1 - clampedProgress
                  : 1,
    };
}
