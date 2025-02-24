import { useLayoutEffect } from "react";
import { useGameState } from "../useGameState";

export function useGameTimeManager(freezeTime?: Date) {
    // Update current time every second
    const setCurrentTime = useGameState((state) => state.setCurrentTime);

    useLayoutEffect(() => {
        setCurrentTime(freezeTime ?? new Date());
        const interval = setInterval(() => {
            setCurrentTime(useGameState.getState().freezeTime ?? new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);
}