import { useCallback, useSyncExternalStore } from 'react';
import { useGameState } from '../useGameState';

export function useGameAudio() {
    const audio = useGameState((state) => state.audio);
    const state = useSyncExternalStore(
        audio.subscribe,
        audio.getState,
        audio.getState,
    );

    const setVolume = useCallback(
        async (volume: number) => audio.setMasterVolume(volume),
        [audio],
    );
    const setMuted = useCallback(
        async (muted: boolean) => audio.setMasterMuted(muted),
        [audio],
    );
    const resumeIfNeeded = useCallback(() => audio.resume(), [audio]);

    const setAmbientVolume = useCallback(
        async (volume: number) => audio.setChannelVolume('ambient', volume),
        [audio],
    );
    const setAmbientMuted = useCallback(
        async (muted: boolean) => audio.setChannelMuted('ambient', muted),
        [audio],
    );
    const setEffectsVolume = useCallback(
        async (volume: number) => audio.setChannelVolume('effects', volume),
        [audio],
    );
    const setEffectsMuted = useCallback(
        async (muted: boolean) => audio.setChannelMuted('effects', muted),
        [audio],
    );
    const setMusicVolume = useCallback(
        async (volume: number) => audio.setChannelVolume('music', volume),
        [audio],
    );
    const setMusicMuted = useCallback(
        async (muted: boolean) => audio.setChannelMuted('music', muted),
        [audio],
    );

    return {
        isSuspended: state.isSuspended,
        isBackgrounded: state.isBackgrounded,
        isMuted: state.master.isMuted,
        setMuted,
        volume: state.master.volume,
        setVolume,
        ambient: {
            isMuted: state.ambient.isMuted,
            volume: state.ambient.volume,
            setMuted: setAmbientMuted,
            setVolume: setAmbientVolume,
        },
        effects: {
            isMuted: state.effects.isMuted,
            volume: state.effects.volume,
            setMuted: setEffectsMuted,
            setVolume: setEffectsVolume,
        },
        music: {
            isMuted: state.music.isMuted,
            volume: state.music.volume,
            setMuted: setMusicMuted,
            setVolume: setMusicVolume,
        },
        resumeIfNeeded,
    };
}
