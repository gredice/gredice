import { useMemo, useSyncExternalStore } from 'react';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import { SeasonDateControl } from '../../../packages/game/src/hud/components/SeasonDateControl';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

export function SeasonDateControlFixture({
    enabled = true,
}: {
    enabled?: boolean;
}) {
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                freezeTime: new Date(2024, 5, 21, 18, 30),
            }),
        [],
    );
    const frozenDate = useSyncExternalStore(
        store.subscribe,
        () => store.getState().freezeTime,
    );
    return (
        <GameFlagsContext.Provider value={{ enableDebugHudFlag: enabled }}>
            <GameStateContext.Provider value={store}>
                <div className="max-w-sm space-y-4 p-4">
                    <SeasonDateControl />
                    <button
                        type="button"
                        onClick={() => store.getState().setFreezeTime(null)}
                    >
                        Reset time
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            store
                                .getState()
                                .setFreezeTime(new Date(2024, 1, 29, 22, 15))
                        }
                    >
                        External leap date
                    </button>
                    <output
                        data-clock={
                            frozenDate
                                ? `${frozenDate.getHours()}:${frozenDate.getMinutes()}`
                                : 'live'
                        }
                        aria-label="Clock"
                    />
                </div>
            </GameStateContext.Provider>
        </GameFlagsContext.Provider>
    );
}
