import { useEffect, useState } from 'react';
import { useGameState } from '../useGameState';

export function useLiveTime() {
    const freezeTime = useGameState((state) => state.freezeTime);
    const [now, setNow] = useState(() => freezeTime ?? new Date());
    useEffect(() => {
        if (freezeTime) {
            setNow(freezeTime);
            return;
        }
        const tick = () => setNow(new Date());
        let intervalId: ReturnType<typeof setInterval> | undefined;
        const timeoutId = setTimeout(
            () => {
                tick();
                intervalId = setInterval(tick, 60_000);
            },
            60_000 - (Date.now() % 60_000),
        );
        return () => {
            clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, [freezeTime]);
    return now;
}
