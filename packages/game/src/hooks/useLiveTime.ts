import { useSyncExternalStore } from 'react';
import { useGameState } from '../useGameState';
import {
    getLiveTimeServerSnapshot,
    getLiveTimeSnapshot,
    subscribeLiveTime,
} from './liveTimeStore';

const subscribeFrozenTime = () => () => {};

export function useLiveTime() {
    const freezeTime = useGameState((state) => state.freezeTime);
    const liveTime = useSyncExternalStore(
        freezeTime ? subscribeFrozenTime : subscribeLiveTime,
        getLiveTimeSnapshot,
        getLiveTimeServerSnapshot,
    );

    return freezeTime ?? liveTime;
}
