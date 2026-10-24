import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneDeadline,
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { Squirrel } from './Squirrel';
import { squirrelCachingEnabled } from './squirrelCaching';
import { createSquirrelHabitats } from './squirrelHabitat';
import {
    createSquirrelSpawnPlan,
    getSquirrelCooldownRemainingMs,
    reconcileSquirrelCooldowns,
    type SquirrelSpawnCooldown,
} from './squirrelSpawning';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(reducedMotionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
function getReducedMotion() {
    return window.matchMedia(reducedMotionQuery).matches;
}

export function Squirrels({
    seasonalEffectsEnabled = true,
    farmId,
    stacks,
}: {
    seasonalEffectsEnabled?: boolean;
    farmId?: number | null;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const fixedTime = useSceneFixedTimeSeconds();
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const season = useGameState((state) => state.seasonState.season);
    const weatherAllowsCaching = useGameState((state) =>
        squirrelCachingEnabled({
            season: state.seasonState.season,
            rain: state.rainSurfaceIntensity,
            snow: state.snowCoverage,
            reducedMotion: false,
            enabled: !state.weatherVisualizationDisabled,
        }),
    );
    const cachingEnabled =
        seasonalEffectsEnabled && !reducedMotion && weatherAllowsCaching;
    const gardenSeed =
        farmId === null || farmId === undefined
            ? 'local-sandbox'
            : `farm-${farmId.toString()}`;
    const habitats = useMemo(
        () => createSquirrelHabitats({ blockData, gardenSeed, stacks }),
        [blockData, gardenSeed, stacks],
    );
    const habitatById = useMemo(
        () => new Map(habitats.map((habitat) => [habitat.id, habitat])),
        [habitats],
    );
    const [cooldowns, setCooldowns] = useState(
        () => new Map<string, SquirrelSpawnCooldown>(),
    );
    const [now, setNow] = useState(Date.now);
    const spawnPlan = useMemo(
        () =>
            createSquirrelSpawnPlan({
                cooldowns,
                gardenSeed,
                habitats,
                now,
            }),
        [cooldowns, gardenSeed, habitats, now],
    );
    useSceneTimeInvalidation(
        'fauna:squirrels',
        spawnPlan.length > 0 && fixedTime === undefined && !reducedMotion,
        sceneFrameRates.ambient,
    );

    useEffect(() => {
        setCooldowns((current) =>
            reconcileSquirrelCooldowns({
                cooldowns: current,
                habitats,
            }),
        );
    }, [habitats]);

    const nextCooldownDelayMs = useMemo(() => {
        let nextDelay = Number.POSITIVE_INFINITY;
        for (const habitat of habitats) {
            const remaining = getSquirrelCooldownRemainingMs({
                cooldown: cooldowns.get(habitat.id),
                now,
            });
            if (remaining > 0) {
                nextDelay = Math.min(nextDelay, remaining);
            }
        }
        return Number.isFinite(nextDelay) ? Math.max(25, nextDelay + 1) : null;
    }, [cooldowns, habitats, now]);
    const cooldownDeadlineMs = useMemo(
        () =>
            nextCooldownDelayMs === null
                ? null
                : globalThis.performance.now() + nextCooldownDelayMs,
        [nextCooldownDelayMs],
    );
    useSceneDeadline({
        callback: () => setNow(Date.now()),
        deadlineMs: cooldownDeadlineMs,
        owner: 'fauna:squirrels:cooldown',
    });

    const handleDespawn = useCallback((habitatId: string) => {
        const despawnedAt = Date.now();
        setCooldowns((current) => {
            const next = new Map(current);
            const previous = next.get(habitatId);
            next.set(habitatId, {
                lastDespawnedAt: despawnedAt,
                spawnSequence: (previous?.spawnSequence ?? 0) + 1,
            });
            return next;
        });
        setNow(despawnedAt);
    }, []);

    return (
        <>
            {spawnPlan.map((spawn) => {
                const habitat = habitatById.get(spawn.habitatId);
                if (!habitat) {
                    return null;
                }
                return (
                    <Squirrel
                        cachingEnabled={cachingEnabled}
                        reducedMotion={reducedMotion}
                        habitat={habitat}
                        key={`${habitat.id}:${habitat.revisionKey}:${spawn.spawnSequence.toString()}:${fixedTime ?? 'live'}:${season}`}
                        onDespawn={handleDespawn}
                        spawnSequence={spawn.spawnSequence}
                    />
                );
            })}
        </>
    );
}
