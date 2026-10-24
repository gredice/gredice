import { useState } from 'react';
import { WeatherAmbience } from '../src/audio/WeatherAmbience';
import { WindAmbience } from '../src/audio/WindAmbience';
import { AutumnSourcesProvider } from '../src/scene/AutumnSources';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import type { EnvironmentWeather } from '../src/scene/weatherBlend';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { AutumnAudioSource } from './AutumnAudioSource';

export function WeatherAudioFixture({
    weather = { rainy: 0.5 },
    timeOfDay = 0.5,
    enabled = true,
    debug = true,
    withLeaves = false,
}: {
    weather?: EnvironmentWeather;
    timeOfDay?: number;
    enabled?: boolean;
    debug?: boolean;
    withLeaves?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: getSeasonDebugDates().midAutumn,
        }),
    );
    useDisposeGameStateStore(store);
    const audio = store.getState().audio;
    return (
        <GameStateContext.Provider value={store}>
            <button
                type="button"
                onClick={() => audio.resume({ userActivation: true })}
            >
                Enable audio
            </button>
            <WeatherAmbience
                weather={weather}
                timeOfDay={timeOfDay}
                enabled={enabled}
                debug={debug}
            />
            <WindAmbience
                windSpeed={weather.windSpeed ?? 0}
                rainIntensity={weather.rainy ?? 0}
                enabled={enabled}
                debug={debug}
            />
            {withLeaves && (
                <AutumnSourcesProvider>
                    <AutumnAudioSource
                        enabled={enabled}
                        hasTree
                        wind={weather.windSpeed ?? 0}
                    />
                </AutumnSourcesProvider>
            )}
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
            <button
                type="button"
                onClick={() => {
                    audio.setMasterVolume(0.2);
                    audio.setChannelVolume('ambient', 0.3);
                }}
            >
                Quiet volumes
            </button>
        </GameStateContext.Provider>
    );
}
