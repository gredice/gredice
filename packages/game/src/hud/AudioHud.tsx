import { IconButton } from "@signalco/ui-primitives/IconButton";
import { useGameAudio } from "../hooks/useGameAudio";
import { Volume2, Mute } from "@signalco/ui-icons";

export function AudioHud() {
    const { isMuted, isSuspended, setMuted, resumeIfNeeded } = useGameAudio();

    return (
        <IconButton
            title="Upali/ugasi zvuk"
            onClick={() => isSuspended ? resumeIfNeeded() : setMuted(!isMuted)}
            variant="plain"
            className='pointer-events-auto hover:bg-muted'>
            {(isMuted || isSuspended) ? <Mute /> : <Volume2 />}
        </IconButton>
    )
}