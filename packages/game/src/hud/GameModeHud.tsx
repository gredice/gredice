import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useEffect } from 'react';
import { ShovelIcon } from '../icons/Shovel';
import { useGameState } from '../useGameState';
import { useGameModeParam } from '../useUrlState';
import { HudCard } from './components/HudCard';

export function GameModeHud() {
    const [isEditMode, setIsEditMode] = useGameModeParam();
    const mode = useGameState((state) => state.mode);
    const setMode = useGameState((state) => state.setMode);

    // Sync URL param to game state
    useEffect(() => {
        const gameMode = isEditMode ? 'edit' : 'normal';
        if (gameMode !== mode) {
            setMode(gameMode);
        }
    }, [isEditMode, mode, setMode]);

    const handleToggleMode = () => {
        const newEditMode = !isEditMode;
        setIsEditMode(newEditMode);
        setMode(newEditMode ? 'edit' : 'normal');
    };

    return (
        <HudCard open position="floating" className="static p-0.5">
            <IconButton
                variant="plain"
                className="rounded-full size-10"
                title={!isEditMode ? 'Uredi vrt' : 'Završi uređivanje'}
                onClick={handleToggleMode}
            >
                {!isEditMode ? (
                    <ShovelIcon className="shrink-0 !stroke-[1.4px]" />
                ) : (
                    <Check className="text-green-600 !stroke-[3px] shrink-0" />
                )}
            </IconButton>
        </HudCard>
    );
}
