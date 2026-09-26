import { useEffect } from 'react';
import { useGameState } from '../useGameState';

/** Stable registration: changing a target never replaces the decoded loop. */
export function AmbientAudioLayer({
    src,
    target,
    fadeSeconds,
    enabled,
}: {
    src: string;
    target: number;
    fadeSeconds: number;
    enabled: boolean;
}) {
    const ambient = useGameState((state) => state.audio.ambient);
    const { setTargetVolume, stop } = ambient.useMusic(src, {
        volume: 0,
        silentFailure: true,
    });
    useEffect(() => {
        // Hidden scenes and explicit sound disablement must stop immediately.
        if (enabled) setTargetVolume(target, fadeSeconds);
        else stop();
    }, [enabled, target, fadeSeconds, setTargetVolume, stop]);
    return null;
}
