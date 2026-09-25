import { harvestWheelbarrow } from '@gredice/js/harvestWheelbarrow';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { useMemo } from 'react';
import { useBlockRotate } from '../src/hooks/useBlockRotate';
import {
    createMockGarden,
    currentGardenKeys,
    useCurrentGarden,
} from '../src/hooks/useCurrentGarden';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';

function RotationControls() {
    const { data: garden } = useCurrentGarden();
    const mutation = useBlockRotate();
    const block = garden?.stacks
        .flatMap((stack) => stack.blocks)
        .find((block) => block.id === 'barrow');
    return (
        <div>
            <button
                type="button"
                onClick={() =>
                    mutation.mutate({
                        blockId: 'barrow',
                        rotation: (block?.rotation ?? 0) + 1,
                    })
                }
            >
                Okreni kolica
            </button>
            <output data-testid="rotation">{block?.rotation}</output>
            <output data-testid="rotation-error">
                {mutation.error?.message}
            </output>
        </div>
    );
}

export function HarvestWheelbarrowRotationFixture({
    obstacle,
}: {
    obstacle?: 'crate' | 'raised';
}) {
    const storageKey = `wheelbarrow-rotation-${obstacle ?? 'clear'}`;
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
                                          name: harvestWheelbarrow.name,
                                          id: 'barrow',
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
                    <RotationControls />
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
