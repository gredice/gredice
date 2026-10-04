import { defaultSeasonState } from '../scene/seasonState';
import { useOptionalGameState } from '../useGameState';

/**
 * Read the shared time-of-year state. Seasonal effects use this instead of
 * reading `new Date()` themselves so a frozen debug date keeps every effect on
 * the same clock as the lighting.
 */
export function useSeasonState() {
    return useOptionalGameState(
        (state) => state.seasonState,
        defaultSeasonState,
    );
}
