import { Mute, Volume2 } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useGameAudio } from '../hooks/useGameAudio';

export function AudioHud() {
    const { isMuted, isSuspended, setMuted, resumeIfNeeded } = useGameAudio();

    return (
        <IconButton
            title="Upali/ugasi zvuk"
            onClick={() =>
                isSuspended ? resumeIfNeeded() : setMuted(!isMuted)
            }
            variant="plain"
            className="pointer-events-auto hover:bg-muted"
        >
            {isMuted || isSuspended ? <Mute /> : <Volume2 />}
        </IconButton>
    );
}
