import { IconButton } from "@signalco/ui-primitives/IconButton";
import { HudCard } from "./components/HudCard";
import { useGameState } from "../useGameState";
import { Edit, Check } from "@signalco/ui-icons";

export function GameModeHud() {
    const mode = useGameState((state) => state.mode);
    const setMode = useGameState((state) => state.setMode);

    return (
        <HudCard
            open
            position="floating"
            className="static">
            <IconButton
                variant="plain"
                className="rounded-full"
                title={mode !== 'edit' ? "Uredi vrt" : "Završi uređivanje"}
                onClick={() => setMode(mode !== 'edit' ? 'edit' : 'normal')}>
                {mode !== 'edit' ? <Edit /> : <Check className="text-green-600 !stroke-[3px]" />}
            </IconButton>
        </HudCard>
    )
}