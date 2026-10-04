'use client';

import { useGameState } from '../useGameState';

export function PlacementGrid() {
    const isPlacementActive = useGameState(
        (state) =>
            Boolean(state.pickupBlock) ||
            Boolean(state.activeDragPreview) ||
            Boolean(state.hudPlacementDrag),
    );
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;

    if (!isPlacementActive) {
        return null;
    }

    return (
        <gridHelper
            name="Interaction:PlacementGrid"
            args={[
                100,
                100,
                isDay ? '#fffdf2' : '#7e889e',
                isDay ? '#f0ebd5' : '#4f555c',
            ]}
            position={[0.5, 0, 0.5]}
        />
    );
}
