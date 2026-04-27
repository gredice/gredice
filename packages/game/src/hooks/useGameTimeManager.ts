import { useEffect } from 'react';
import { useGameState } from '../useGameState';

export function useGameTimeManager() {
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useEffect(() => {
        const tick = () => setCurrentTime(new Date());
        let intervalId: ReturnType<typeof setInterval> | undefined;
        const timeoutId = setTimeout(() => {
            tick();
            intervalId = setInterval(tick, 60_000);
        }, 60_000 - (Date.now() % 60_000));
        return () => {
            clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, [setCurrentTime]);
}
