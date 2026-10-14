import { Suspense, useMemo, useSyncExternalStore } from 'react';
import { useLiveTime } from '../hooks/useLiveTime';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { DistantBirdFlockMesh } from './DistantBirdFlockMesh';
import {
    resolveDistantBirdFlockBounds,
    resolveDistantBirdFlockCount,
} from './distantBirdFlock';
import type { GameQualityProfileTier } from './gameQuality';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(motionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
function getReducedMotion() {
    return window.matchMedia(motionQuery).matches;
}

export function DistantBirdFlocks({
    tier,
    stacks,
    gardenId,
    enabled = true,
    rain = 0,
    snow = 0,
    fog = 0,
    windSpeed = 0,
}: {
    tier: GameQualityProfileTier;
    stacks?: Stack[];
    gardenId?: number;
    enabled?: boolean;
    rain?: number;
    snow?: number;
    fog?: number;
    windSpeed?: number;
}) {
    const autumn = useGameState(
        (state) => state.seasonState.season === 'autumn',
    );
    const date = useLiveTime();
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const count = resolveDistantBirdFlockCount({
        tier,
        enabled: enabled && autumn,
        reducedMotion,
        rain,
        snow,
        fog,
        windSpeed,
    });
    const seed = `${gardenId ?? 0}:${date.toISOString().slice(0, 10)}`;
    const bounds = useMemo(
        () => resolveDistantBirdFlockBounds(stacks),
        [stacks],
    );
    return count > 0 ? (
        <Suspense fallback={null}>
            <DistantBirdFlockMesh count={count} seed={seed} bounds={bounds} />
        </Suspense>
    ) : null;
}
