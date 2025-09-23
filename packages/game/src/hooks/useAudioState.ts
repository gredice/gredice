import { useCallback, useEffect, useState } from 'react';
import { audioConfig } from '../utils/audioConfig';

/**
 * A more React-like audio state management hook that separates
 * concerns and provides a cleaner API for audio management.
 */

export interface AudioState {
    masterVolume: number;
    masterIsMuted: boolean;
    ambientVolume: number;
    ambientIsMuted: boolean;
    effectsVolume: number;
    effectsIsMuted: boolean;
    isSuspended: boolean;
}

export interface AudioActions {
    setMasterVolume: (volume: number) => void;
    setMasterMuted: (muted: boolean) => void;
    setAmbientVolume: (volume: number) => void;
    setAmbientMuted: (muted: boolean) => void;
    setEffectsVolume: (volume: number) => void;
    setEffectsMuted: (muted: boolean) => void;
    resumeAudio: () => Promise<void>;
    resetToDefaults: () => void;
}

export interface UseAudioStateReturn extends AudioState, AudioActions {}

/**
 * Custom hook for managing audio state in a React-friendly way.
 * Provides a clean separation between state and actions.
 */
export function useAudioState(): UseAudioStateReturn {
    // Initialize state from audio config
    const [state, setState] = useState<AudioState>(() => {
        const config = audioConfig().config;
        return {
            masterVolume: config.masterVolume,
            masterIsMuted: config.masterIsMuted,
            ambientVolume: config.ambientVolume / config.masterVolume,
            ambientIsMuted: config.ambientIsMuted,
            effectsVolume: config.effectsVolume / config.masterVolume,
            effectsIsMuted: config.effectsIsMuted,
            isSuspended: false, // Will be updated by polling
        };
    });

    // Actions
    const setMasterVolume = useCallback((volume: number) => {
        setState((prev) => ({ ...prev, masterVolume: volume }));
    }, []);

    const setMasterMuted = useCallback((muted: boolean) => {
        setState((prev) => ({ ...prev, masterIsMuted: muted }));
    }, []);

    const setAmbientVolume = useCallback((volume: number) => {
        setState((prev) => ({ ...prev, ambientVolume: volume }));
    }, []);

    const setAmbientMuted = useCallback((muted: boolean) => {
        setState((prev) => ({ ...prev, ambientIsMuted: muted }));
    }, []);

    const setEffectsVolume = useCallback((volume: number) => {
        setState((prev) => ({ ...prev, effectsVolume: volume }));
    }, []);

    const setEffectsMuted = useCallback((muted: boolean) => {
        setState((prev) => ({ ...prev, effectsIsMuted: muted }));
    }, []);

    const resumeAudio = useCallback(async () => {
        // This will be implemented to work with the mixer system
        console.log('Resume audio called');
    }, []);

    const resetToDefaults = useCallback(() => {
        setState({
            masterVolume: 0.5,
            masterIsMuted: false,
            ambientVolume: 0.5,
            ambientIsMuted: false,
            effectsVolume: 0.5,
            effectsIsMuted: false,
            isSuspended: false,
        });
    }, []);

    // Save to config when state changes
    useEffect(() => {
        audioConfig().setConfig({
            masterVolume: state.masterVolume,
            masterIsMuted: state.masterIsMuted,
            ambientVolume: state.ambientVolume * state.masterVolume,
            ambientIsMuted: state.ambientIsMuted,
            effectsVolume: state.effectsVolume * state.masterVolume,
            effectsIsMuted: state.effectsIsMuted,
        });
    }, [state]);

    return {
        ...state,
        setMasterVolume,
        setMasterMuted,
        setAmbientVolume,
        setAmbientMuted,
        setEffectsVolume,
        setEffectsMuted,
        resumeAudio,
        resetToDefaults,
    };
}
