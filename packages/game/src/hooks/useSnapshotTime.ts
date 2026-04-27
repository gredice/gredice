import { useState } from 'react';
import { useGameState } from '../useGameState';

export function useSnapshotTime() {
    const freezeTime = useGameState((state) => state.freezeTime);
    const [snapshot] = useState(() => new Date());
    return freezeTime ?? snapshot;
}
