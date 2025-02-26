import { IconButton } from "@signalco/ui-primitives/IconButton";
import { useGameAudio } from "../hooks/useGameAudio";
import { Volume2, VolumeX } from "lucide-react";

export function AudioHud() {
    const { isMuted, isSuspended, setMuted, resumeIfNeeded } = useGameAudio();

    return (
        <IconButton
            title="Upali/ugasi zvuk"
            onClick={() => isSuspended ? resumeIfNeeded() : setMuted(!isMuted)}
            variant="plain"
            className='pointer-events-auto hover:bg-muted'>
            {(isMuted || isSuspended) ? <VolumeX /> : <Volume2 />}
        </IconButton>
    )
}