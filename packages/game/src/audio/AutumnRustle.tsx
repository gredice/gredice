import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAutumnState } from '../hooks/useAutumnState';
import { useSeasonState } from '../hooks/useSeasonState';
import { useAutumnSources } from '../scene/AutumnSources';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { useGameState } from '../useGameState';
import {
    autumnRustleFadeSeconds,
    resolveAutumnRustleTarget,
} from './autumnRustleState';

export function AutumnRustle({
    windSpeed,
    enabled,
}: {
    windSpeed: number;
    enabled: boolean;
}) {
    const audio = useGameState((state) => state.audio);
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const state = useSyncExternalStore(
        audio.subscribe,
        audio.getState,
        audio.getState,
    );
    const loop = audio.ambient.useMusic(
        `${appBaseUrl}/assets/sounds/autumn-leaf-rustle-v1.wav`,
        { volume: 0, silentFailure: true },
    );
    const autumn = useAutumnState();
    const { season } = useSeasonState();
    const hasTrees = useAutumnSources().length > 0;
    const previousGain = useRef(0);
    const audible =
        enabled &&
        !state.isBackgrounded &&
        !state.master.isMuted &&
        !state.ambient.isMuted &&
        state.master.volume > 0 &&
        state.ambient.volume > 0;
    useEffect(() => {
        const target = resolveAutumnRustleTarget({
            windSpeed,
            season,
            autumn,
            hasTrees,
            enabled: audible,
            previousGain: previousGain.current,
        });
        previousGain.current = target;
        if (audible) loop.setTargetVolume(target, autumnRustleFadeSeconds);
        else loop.stop();
        updateGameProfileMetadata({ autumnRustleTargetGain: target });
    }, [
        audible,
        windSpeed,
        season,
        autumn,
        hasTrees,
        loop.setTargetVolume,
        loop.stop,
    ]);
    useEffect(
        () => () => {
            loop.stop();
            updateGameProfileMetadata({ autumnRustleTargetGain: 0 });
        },
        [loop.stop],
    );
    return null;
}
