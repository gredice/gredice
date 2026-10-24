import { useEffect, useState } from 'react';
import { AutumnSourcesProvider } from '../src/scene/AutumnSources';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { AutumnAudioSource } from './AutumnAudioSource';

export function AutumnAudioFixture({
    stage = 'midAutumn',
    wind = 0.7,
    enabled = true,
    hasTree = true,
}: {
    stage?: keyof ReturnType<typeof getSeasonDebugDates>;
    wind?: number;
    enabled?: boolean;
    hasTree?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: getSeasonDebugDates().midAutumn,
        }),
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        store.getState().setSceneDate(getSeasonDebugDates()[stage]);
    }, [store, stage]);
    const audio = store.getState().audio;
    return (
        <GameStateContext.Provider value={store}>
            <button
                type="button"
                onClick={() => audio.resume({ userActivation: true })}
            >
                Enable audio
            </button>
            <button
                type="button"
                onClick={() =>
                    audio.setMasterMuted(!audio.getState().master.isMuted)
                }
            >
                Toggle master
            </button>
            <button
                type="button"
                onClick={() =>
                    audio.setChannelMuted(
                        'ambient',
                        !audio.getState().ambient.isMuted,
                    )
                }
            >
                Toggle ambient
            </button>
            <AutumnSourcesProvider>
                <AutumnAudioSource
                    enabled={enabled}
                    hasTree={hasTree}
                    wind={wind}
                />
            </AutumnSourcesProvider>
        </GameStateContext.Provider>
    );
}
