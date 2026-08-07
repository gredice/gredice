import { useEffect } from 'react';
import type { GameBackgroundPaletteKey } from '../scene/backgroundPalettes';
import { useGameState } from '../useGameState';

export function useSyncGardenBackgroundPalette(
    backgroundPalette: GameBackgroundPaletteKey | null | undefined,
) {
    const setBackgroundPaletteKey = useGameState(
        (state) => state.setBackgroundPaletteKey,
    );

    useEffect(() => {
        if (backgroundPalette) {
            setBackgroundPaletteKey(backgroundPalette);
        }
    }, [backgroundPalette, setBackgroundPaletteKey]);
}
