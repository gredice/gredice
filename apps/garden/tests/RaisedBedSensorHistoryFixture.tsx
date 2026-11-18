import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RaisedBedSensorInfo } from '../../../packages/game/src/hud/raisedBed/RaisedBedSensorInfo';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

export function RaisedBedSensorHistoryFixture() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: false,
                        staleTime: Infinity,
                        refetchOnReconnect: 'always',
                    },
                },
            }),
    );
    const [gameState] = useState(() =>
        createGameState({
            freezeTime: null,
            isMock: true,
            winterMode: 'summer',
            appBaseUrl: 'http://localhost',
        }),
    );
    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={gameState}>
                <RaisedBedSensorInfo gardenId={85} raisedBedId={188} />
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
