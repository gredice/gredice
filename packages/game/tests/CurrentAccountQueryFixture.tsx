import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createGameState, GameStateContext } from '../src/useGameState';
import { CurrentAccountQueryProbe } from './CurrentAccountQueryProbe';

export function CurrentAccountQueryFixture({
    authenticated = true,
    enabled = true,
    withGameState = true,
}: {
    authenticated?: boolean;
    enabled?: boolean;
    withGameState?: boolean;
}) {
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                authenticatedGardenQueriesEnabled: authenticated,
                freezeTime: null,
                isMock: true,
            }),
        [authenticated],
    );
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={withGameState ? store : null}>
                <CurrentAccountQueryProbe enabled={enabled} />
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
