import { useMemo } from 'react';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import { TimeDisplay } from '../../../packages/game/src/hud/components/TimeDisplay';
import {
    createGameState,
    GameStateContext,
    useGameState,
} from '../../../packages/game/src/useGameState';

function TimeDisplayStatus() {
    const freezeTime = useGameState((state) => state.freezeTime);
    const timeOfDay = useGameState((state) => state.timeOfDay);

    return (
        <div className="mt-4 grid gap-1 rounded-md border bg-background p-3 text-xs">
            <output data-testid="time-display-freeze-time">
                {freezeTime?.toISOString() ?? ''}
            </output>
            <output data-testid="time-display-timeofday">
                {timeOfDay.toFixed(3)}
            </output>
        </div>
    );
}

export function TimeDisplayStory({ debug = false }: { debug?: boolean }) {
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date(2026, 5, 21, 12, 0, 0),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );
    const flags = useMemo(() => ({ enableDebugHudFlag: debug }), [debug]);

    return (
        <GameStateContext.Provider value={gameStore}>
            <GameFlagsContext.Provider value={flags}>
                <div className="w-[22rem]">
                    <TimeDisplay />
                    <TimeDisplayStatus />
                </div>
            </GameFlagsContext.Provider>
        </GameStateContext.Provider>
    );
}
