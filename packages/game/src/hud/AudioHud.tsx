import { Mute, Volume2 } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useCallback } from 'react';
import { useGameAudio } from '../hooks/useGameAudio';

export function AudioHud() {
    const { isMuted, isSuspended, setMuted, resumeIfNeeded } = useGameAudio();

    const handleAudioToggle = useCallback(async () => {
        if (isSuspended) {
            await resumeIfNeeded();
            if (isMuted) {
                await setMuted(false);
            }
        } else {
            await setMuted(!isMuted);
        }
    }, [isSuspended, isMuted, resumeIfNeeded, setMuted]);

    // Show muted icon if either suspended or muted
    const shouldShowMuted = isMuted || isSuspended;

    return (
        <IconButton
            title={
                isSuspended
                    ? 'Kliknite da omogućite zvuk'
                    : isMuted
                      ? 'Uključi zvuk'
                      : 'Ugasi zvuk'
            }
            onClick={handleAudioToggle}
            variant="plain"
            className="pointer-events-auto hover:bg-muted"
        >
            {shouldShowMuted ? <Mute /> : <Volume2 />}
        </IconButton>
    );
}
