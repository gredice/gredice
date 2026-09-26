import { useCallback, useMemo, useState } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import { useSeasonState } from '../../hooks/useSeasonState';
import type { GameQualityProfile } from '../../scene/gameQuality';
import {
    useSceneDeadline,
    useSceneFixedTimeSeconds,
    useSceneRuntimeVisible,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { Hedgehog } from './Hedgehog';
import { createHedgehogHabitats } from './hedgehogHabitat';
import { hedgehogVisitLimits } from './hedgehogVisit';

export function Hedgehogs({
    stacks,
    gardenId,
    quality,
    weather,
}: {
    stacks: Stack[] | undefined;
    gardenId?: string | number;
    quality: GameQualityProfile;
    weather?: { rainy?: number | null; snowy?: number | null };
}) {
    const { data: blockData } = useBlockData();
    const season = useSeasonState();
    const visible = useSceneRuntimeVisible();
    const fixed = useSceneFixedTimeSeconds();
    const gameWeather = useGameState((state) => state.weather);
    const currentWeather = weather ?? gameWeather;
    const eligible =
        season.season === 'autumn' &&
        (currentWeather?.rainy ?? 0) < 0.2 &&
        (currentWeather?.snowy ?? 0) < 0.1;
    const habitats = useMemo(
        () =>
            eligible
                ? createHedgehogHabitats({
                      stacks,
                      blockData,
                      gardenSeed: String(gardenId ?? 'sandbox'),
                  })
                : [],
        [eligible, stacks, blockData, gardenId],
    );
    const [visit, setVisit] = useState({
        sequence: 0,
        cooling: false,
        deadline: 0,
    });
    const finish = useCallback(() => {
        setVisit((v) => ({
            sequence: v.sequence + 1,
            cooling: true,
            deadline: performance.now() + hedgehogVisitLimits.cooldownMs,
        }));
    }, []);
    useSceneDeadline({
        owner: 'fauna:hedgehogs:cooldown',
        enabled:
            visible &&
            visit.cooling &&
            habitats.length > 0 &&
            fixed === undefined,
        deadlineMs: visit.cooling ? visit.deadline : null,
        callback: () => setVisit((v) => ({ ...v, cooling: false })),
    });
    const habitat = habitats[0];
    if (!habitat || visit.cooling) return null;
    return (
        <Hedgehog
            key={`${habitat.id}:${habitat.revision}:${visit.sequence}`}
            habitat={habitat}
            sequence={visit.sequence}
            lowQuality={
                quality.tier === 'low' || quality.tier === 'auto-constrained'
            }
            onComplete={finish}
        />
    );
}
