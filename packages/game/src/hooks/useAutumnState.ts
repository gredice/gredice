import { getAutumnState } from '../scene/autumnState';
import { defaultSeasonState } from '../scene/seasonState';
import { useOptionalGameState } from '../useGameState';

const fallback = getAutumnState(defaultSeasonState);

export function useAutumnState() {
    return useOptionalGameState((state) => state.autumnState, fallback);
}
