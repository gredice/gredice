import { useEffect } from 'react';
import { useGameState } from '../useGameState';
import type { GameLocation } from '../utils/timeOfDay';
import { useLiveTime } from './useLiveTime';

export function useSyncGameTime(location: GameLocation) {
    const currentTime = useLiveTime();
    const syncTimeOfDay = useGameState((state) => state.syncTimeOfDay);

    useEffect(() => {
        syncTimeOfDay(location, currentTime);
    }, [currentTime, location, syncTimeOfDay]);

    return currentTime;
}
