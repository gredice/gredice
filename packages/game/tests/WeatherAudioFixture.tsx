import { useState } from 'react';
import { WeatherAmbience } from '../src/audio/WeatherAmbience';
import type { EnvironmentWeather } from '../src/scene/weatherBlend';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';

export function WeatherAudioFixture({
    weather = { rainy: 0.5 },
    timeOfDay = 0.5,
    enabled = true,
    debug = true,
}: {
    weather?: EnvironmentWeather;
    timeOfDay?: number;
    enabled?: boolean;
    debug?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({ appBaseUrl: '', isMock: true, freezeTime: null }),
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
        </GameStateContext.Provider>
    );
}
