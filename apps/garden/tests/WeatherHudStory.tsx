import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { WeatherHud } from '../../../packages/game/src/hud/WeatherHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const currentGarden = {
    id: 1,
    name: 'Test',
    isSandbox: false,
    createdAt: '2026-06-01T00:00:00.000Z',
};

function createWeatherHudQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(useGardensKeys, [currentGarden]);
    queryClient.setQueryData(currentGardenKeys('summer', currentGarden.id), {
        id: currentGarden.id,
        name: currentGarden.name,
        isSandbox: currentGarden.isSandbox,
        farmId: 1,
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    });
    queryClient.setQueryData(['weather', 'now', 1], {
        alerts: [],
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
            <NuqsTestingAdapter>
                <GameStateContext.Provider value={gameStore}>
                    {children}
                </GameStateContext.Provider>
            </NuqsTestingAdapter>
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
