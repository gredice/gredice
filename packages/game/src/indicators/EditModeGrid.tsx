'use client';

import { useIsEditMode } from '../hooks/useIsEditMode';
import { useGameState } from '../useGameState';

export function EditModeGrid() {
    const isEditMode = useIsEditMode();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;

    if (!isEditMode) {
        return null;
    }

    return (
        <gridHelper
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
