import { chestnutRoastingCart } from '@gredice/js/chestnutRoastingCart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { useMemo } from 'react';
import {
    createMockGarden,
    currentGardenKeys,
} from '../src/hooks/useCurrentGarden';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { ChestnutRoastingCartRotationControls } from './ChestnutRoastingCartRotationControls';

export function ChestnutRoastingCartRotationFixture({
    obstacle,
}: {
    obstacle?: 'crate' | 'raised';
}) {
    const storageKey = `chestnut-cart-rotation-${obstacle ?? 'clear'}`;
    const client = useMemo(() => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        queryClient.setQueryData(
            ['blocks', 'local'],
            getLocalSandboxBlockData(),
        );
        queryClient.setQueryData(
            currentGardenKeys('summer', 0, undefined, storageKey),
            {
                ...createMockGarden('summer', 'default'),
                id: 0,
                stacks: [0, 1].flatMap((x) =>
                    [0, 1].map((z) => ({
                        position: { x, y: 0, z },
                        blocks: [
                            {
                                name: 'Block_Grass',
                                id: `grass:${x}:${z}`,
                                rotation: 0,
                            },
                            ...(x === 0 && z === 0
                                ? [
                                      {
                                          name: chestnutRoastingCart.name,
                                          id: 'cart',
                                          rotation: 0,
                                      },
                                  ]
                                : []),
                            ...(x === 0 && z === 1 && obstacle
                                ? [
                                      {
                                          name:
                                              obstacle === 'crate'
                                                  ? 'HarvestCrate'
                                                  : 'Block_Grass',
                                          id: 'obstacle',
                                          rotation: 0,
                                      },
                                  ]
                                : []),
                        ],
                    })),
                ),
            },
        );
        return queryClient;
    }, [obstacle, storageKey]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                freezeTime: null,
                isMock: false,
                authenticatedGardenQueriesEnabled: false,
                localSandboxStorageKey: storageKey,
                winterMode: 'summer',
            }),
        [storageKey],
    );
    useDisposeGameStateStore(store);
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <ChestnutRoastingCartRotationControls />
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
