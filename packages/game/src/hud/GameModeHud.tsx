import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useEffect } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { ShovelIcon } from '../icons/Shovel';
import { useGameState } from '../useGameState';
import { useGameModeParam } from '../useUrlState';
import { HudCard } from './components/HudCard';

export function GameModeHud() {
    const [isEditMode, setIsEditMode] = useGameModeParam();
    const { track } = useGameAnalytics();
    const mode = useGameState((state) => state.mode);
    const view = useGameState((state) => state.view);
    const setMode = useGameState((state) => state.setMode);

    // Sync URL param to game state
    useEffect(() => {
        const gameMode = isEditMode ? 'edit' : 'normal';
        if (gameMode !== mode) {
            setMode(gameMode);
        }
    }, [isEditMode, mode, setMode]);

    if (view === 'closeup') {
        return null;
    }

    const handleToggleMode = () => {
        const newEditMode = !isEditMode;
        track('game_mode_changed', {
            mode: newEditMode ? 'edit' : 'normal',
        });
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
