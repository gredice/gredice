import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { WeatherHud } from '../../../packages/game/src/hud/WeatherHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

function createWeatherHudQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['weather', 'now'], {
        cloudy: 0.1,
        foggy: 0,
        measuredTemperature: 20,
        rain: 0,
        snowAccumulation: 0,
        snowy: 0,
        symbol: 1,
        temperature: 20,
        thundery: 0,
        windDirection: 'N',
        windSpeed: 1,
    });
    queryClient.setQueryData(['weather', 'forecast'], []);

    return queryClient;
}

function WeatherHudTestProviders({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createWeatherHudQueryClient(), []);
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-06-01T17:06:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={gameStore}>
                {children}
            </GameStateContext.Provider>
        </ReactQuery.QueryClientProvider>
    );
}

export function WeatherHudTimePopoverStory() {
    return (
        <WeatherHudTestProviders>
            <div className="relative h-screen w-screen overflow-hidden">
                <div className="absolute right-2 top-2">
                    <WeatherHud />
                </div>
            </div>
        </WeatherHudTestProviders>
    );
}
