import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameState } from '../useGameState';
import { audioConfig } from '../utils/audioConfig';

export function useGameAudio() {
    const { ambient, effects } = useGameState((state) => state.audio);
    const mixers = useMemo(() => [ambient, effects], [ambient, effects]);

    // Use React state instead of refs for values that need to trigger re-renders
    const [masterVolume, setMasterVolumeState] = useState(
        () => audioConfig().config.masterVolume,
    );
    const [masterIsMuted, setMasterIsMutedState] = useState(
        () => audioConfig().config.masterIsMuted,
    );

    // Track ambient and effects state in React state for UI updates
    const [ambientVolume, setAmbientVolumeState] = useState(() => {
        const config = audioConfig().config;
        return config.ambientVolume / config.masterVolume;
    });
    const [ambientIsMuted, setAmbientIsMutedState] = useState(
        () => audioConfig().config.ambientIsMuted,
    );
    const [effectsVolume, setEffectsVolumeState] = useState(() => {
        const config = audioConfig().config;
        return config.effectsVolume / config.masterVolume;
    });
    const [effectsIsMuted, setEffectsIsMutedState] = useState(
        () => audioConfig().config.effectsIsMuted,
    );

    // Track suspension state to trigger re-renders
    const [isSuspended, setIsSuspendedState] = useState(() =>
        mixers.some((mixer) => mixer.getState().isSuspended),
    );

    const setVolume = useCallback(
        (value: number) => {
            const oldVolume = masterVolume;
            setMasterVolumeState(value);
            mixers.forEach((mixer) => {
                mixer.setVolume((mixer.getState().volume / oldVolume) * value);
            });
        },
        [mixers, masterVolume],
    );

    const setMuted = useCallback(
        (newMuted: boolean) => {
            console.debug('Setting all mixers to muted:', newMuted);
            setMasterIsMutedState(newMuted);
            mixers.forEach((mixer) => {
                mixer.setMuted(newMuted);
            });
        },
        [mixers],
    );

    const updateConfig = useCallback(() => {
        audioConfig().setConfig({
            masterVolume: masterVolume,
            masterIsMuted: masterIsMuted,
            ambientVolume: ambientVolume * masterVolume,
            ambientIsMuted: ambientIsMuted,
            effectsVolume: effectsVolume * masterVolume,
            effectsIsMuted: effectsIsMuted,
        });
    }, [
        masterVolume,
        masterIsMuted,
        ambientVolume,
        ambientIsMuted,
        effectsVolume,
        effectsIsMuted,
    ]);

    const wrappedSetVolume = useCallback(
        async (value: number) => {
            setVolume(value);
            updateConfig();
        },
        [setVolume, updateConfig],
    );

    const wrappedSetMuted = useCallback(
        async (newMuted: boolean) => {
            setMuted(newMuted);
            updateConfig();
        },
        [setMuted, updateConfig],
    );

    const ambientSetMuted = useCallback(
        async (muted: boolean) => {
            ambient.setMuted(muted);
            setAmbientIsMutedState(muted);
            updateConfig();
        },
        [ambient, updateConfig],
    );

    const ambientSetVolume = useCallback(
        async (value: number) => {
            ambient.setVolume(value * masterVolume);
            setAmbientVolumeState(value);
            updateConfig();
        },
        [ambient, updateConfig, masterVolume],
    );

    const effectsSetMuted = useCallback(
        async (muted: boolean) => {
            effects.setMuted(muted);
            setEffectsIsMutedState(muted);
            updateConfig();
        },
        [effects, updateConfig],
    );

    const effectsSetVolume = useCallback(
        async (value: number) => {
            effects.setVolume(value * masterVolume);
            setEffectsVolumeState(value);
            updateConfig();
        },
        [effects, updateConfig, masterVolume],
    );

    const resumeIfNeeded = useCallback(async () => {
        console.debug('Attempting to resume audio context...');
        await Promise.all(mixers.map((mixer) => mixer.resumeContextIfNeeded()));

        // Check if audio was successfully resumed
        const currentlySuspended = mixers.some(
            (mixer) => mixer.getState().isSuspended,
        );
        setIsSuspendedState(currentlySuspended);

        if (!currentlySuspended) {
            // After resuming, restore the mixer states to match our React state
            console.debug('Audio resumed, restoring mixer states:', {
                masterVolume,
                masterIsMuted,
                ambientVolume,
                ambientIsMuted,
                effectsVolume,
                effectsIsMuted,
            });

            // Restore master mute state
            mixers.forEach((mixer) => {
                mixer.setMuted(masterIsMuted);
            });

            // Restore individual mixer states
            ambient.setMuted(ambientIsMuted);
            effects.setMuted(effectsIsMuted);

            // Restore volumes (ambient and effects volumes are relative to master)
            ambient.setVolume(ambientVolume * masterVolume);
            effects.setVolume(effectsVolume * masterVolume);
        }

        updateConfig();
    }, [
        mixers,
        updateConfig,
        masterVolume,
        masterIsMuted,
        ambientVolume,
        ambientIsMuted,
        effectsVolume,
        effectsIsMuted,
        ambient,
        effects,
    ]);

    // Sync React state with mixer state when audio context changes
    useEffect(() => {
        const currentlySuspended = mixers.some(
            (mixer) => mixer.getState().isSuspended,
        );

        if (currentlySuspended !== isSuspended) {
            setIsSuspendedState(currentlySuspended);
        }

        if (!currentlySuspended) {
            // When audio becomes available, check if our React state matches mixer state
            const ambientMixerState = ambient.getState();
            const effectsMixerState = effects.getState();

            const ambientActualVolume = ambientMixerState.volume / masterVolume;
            const effectsActualVolume = effectsMixerState.volume / masterVolume;

            // Only update React state if there's a significant difference
            if (
                Math.abs(ambientActualVolume - ambientVolume) > 0.01 ||
                ambientMixerState.isMuted !== ambientIsMuted
            ) {
                console.debug('Syncing ambient state from mixer:', {
                    reactVolume: ambientVolume,
                    mixerVolume: ambientActualVolume,
                    reactMuted: ambientIsMuted,
                    mixerMuted: ambientMixerState.isMuted,
                });
                setAmbientVolumeState(ambientActualVolume);
                setAmbientIsMutedState(ambientMixerState.isMuted);
            }

            if (
                Math.abs(effectsActualVolume - effectsVolume) > 0.01 ||
                effectsMixerState.isMuted !== effectsIsMuted
            ) {
                console.debug('Syncing effects state from mixer:', {
                    reactVolume: effectsVolume,
                    mixerVolume: effectsActualVolume,
                    reactMuted: effectsIsMuted,
                    mixerMuted: effectsMixerState.isMuted,
                });
                setEffectsVolumeState(effectsActualVolume);
                setEffectsIsMutedState(effectsMixerState.isMuted);
            }
        }
    }, [
        mixers,
        ambient,
        effects,
        masterVolume,
        ambientVolume,
        ambientIsMuted,
        effectsVolume,
        effectsIsMuted,
        isSuspended,
    ]);

    // Poll for suspension state changes (since mixers don't emit events)
    useEffect(() => {
        const interval = setInterval(() => {
            const currentlySuspended = mixers.some(
                (mixer) => mixer.getState().isSuspended,
            );
            if (currentlySuspended !== isSuspended) {
                console.debug('Suspension state changed:', currentlySuspended);
                setIsSuspendedState(currentlySuspended);
            }
        }, 250); // Poll every 250ms for more responsive UI updates

        return () => clearInterval(interval);
    }, [mixers, isSuspended]);

    // Create the state object with stable references
    const state = {
        isSuspended: isSuspended,
        isMuted: masterIsMuted,
        setMuted: wrappedSetMuted,
        volume: masterVolume,
        setVolume: wrappedSetVolume,
        ambient: {
            isMuted: ambientIsMuted,
            volume: ambientVolume,
            setMuted: ambientSetMuted,
            setVolume: ambientSetVolume,
        },
        effects: {
            isMuted: effectsIsMuted,
            volume: effectsVolume,
            setMuted: effectsSetMuted,
            setVolume: effectsSetVolume,
        },
        resumeIfNeeded,
    };

    return state;
}
