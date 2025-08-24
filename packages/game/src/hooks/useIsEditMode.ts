import { useGameState } from '../useGameState';

export function useIsEditMode() {
    return useGameState((state) => state.mode) === 'edit';
}
