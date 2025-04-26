import { useInterval } from "@signalco/hooks/useInterval";
import { useGameState } from "../useGameState";

export function useGameTimeManager() {
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useInterval(() => {
        setCurrentTime(new Date());
    }, 1000);
}