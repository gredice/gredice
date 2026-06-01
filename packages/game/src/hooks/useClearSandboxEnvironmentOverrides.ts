import { useEffect, useRef } from 'react';
import { useGameState } from '../useGameState';

type GardenEnvironmentMode = {
    id: number;
    isSandbox: boolean;
};

export function useClearSandboxEnvironmentOverrides(
    garden: GardenEnvironmentMode | null | undefined,
) {
    const previousGardenRef = useRef<GardenEnvironmentMode | null>(null);
    const clearEnvironmentOverrides = useGameState(
        (state) => state.clearEnvironmentOverrides,
    );
    const gardenId = garden?.id;
    const isSandbox = garden?.isSandbox;

    useEffect(() => {
        if (gardenId == null || isSandbox == null) {
            return;
        }

        const previousGarden = previousGardenRef.current;
        previousGardenRef.current = { id: gardenId, isSandbox };

        if (previousGarden?.isSandbox && !isSandbox) {
            clearEnvironmentOverrides();
        }
    }, [clearEnvironmentOverrides, gardenId, isSandbox]);
}
