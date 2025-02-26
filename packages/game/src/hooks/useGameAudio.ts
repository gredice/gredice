import { useRef, useState } from "react";
import { useGameState } from "../useGameState";
import { audioConfig } from "../utils/audioConfig";

export function useGameAudio() {
    const { ambient, effects } = useGameState(state => state.audio);
    const mixers = [ambient, effects];
    const masterVolume = useRef(audioConfig().config.masterVolume);
    const masterIsMuted = useRef(audioConfig().config.masterIsMuted);

    function setVolume(value: number) {
        const oldVolume = masterVolume.current;
        masterVolume.current = value;
        mixers.forEach(mixer => mixer.setVolume((mixer.getState().volume / oldVolume) * value));
    }

    function setMuted(newMuted: boolean) {
        console.debug('Setting all mixers to muted:', newMuted);
        masterIsMuted.current = newMuted;
        mixers.forEach(mixer => mixer.setMuted(newMuted));
    }

    function refreshStateAfter(func: (...props: any) => Promise<any> | any) {
        return async (...props: any) => {
            await func(...props);
            const newState = getState();
            setState(newState);
            audioConfig().setConfig({
                masterVolume: newState.volume,
                masterIsMuted: newState.isMuted,
                ambientVolume: newState.ambient.volume,
                ambientIsMuted: newState.ambient.isMuted,
                effectsVolume: newState.effects.volume,
                effectsIsMuted: newState.effects.isMuted,
            });
        }
    }

    function getState() {
        return {
            isSuspended: mixers.some(mixer => mixer.getState().isSuspended),
            isMuted: masterIsMuted.current,
            setMuted: refreshStateAfter(setMuted),
            volume: masterVolume.current,
            setVolume: refreshStateAfter(setVolume),
            ambient: {
                isMuted: ambient.getState().isMuted,
                volume: ambient.getState().volume / masterVolume.current,
                setMuted: refreshStateAfter(ambient.setMuted),
                setVolume: refreshStateAfter((value) => ambient.setVolume(value * masterVolume.current)),
            },
            effects: {
                isMuted: effects.getState().isMuted,
                volume: effects.getState().volume / masterVolume.current,
                setMuted: refreshStateAfter(effects.setMuted),
                setVolume: refreshStateAfter((value) => effects.setVolume(value * masterVolume.current)),
            },
            resumeIfNeeded: refreshStateAfter(() => Promise.all(mixers.map(mixer => mixer.resumeContextIfNeeded()))),
        };
    }

    const [state, setState] = useState(getState());
    return state;
}