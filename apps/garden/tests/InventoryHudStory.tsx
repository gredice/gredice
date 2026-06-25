import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { InventoryHud } from '../../../packages/game/src/hud/InventoryHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

type InventoryHudStoryOptions = {
    backpackItemAmount?: number;
    gardenBoxItemAmount?: number;
};

const mixedInventoryStoryOptions = {
    backpackItemAmount: 3,
    gardenBoxItemAmount: 29,
};

function createInventoryHudQueryClient({
    backpackItemAmount = 0,
    gardenBoxItemAmount = 2,
}: InventoryHudStoryOptions = {}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['inventory'], {
        items:
            backpackItemAmount > 0
                ? [
                      {
                          amount: backpackItemAmount,
                          entityId: '2',
                          entityTypeName: 'block',
                          name: 'Seed bag',
                      },
                  ]
                : [],
        gardenBoxes: [
            {
                blockId: 'garden-box-1',
                gardenId: 1,
                gardenName: 'Test garden',
                items:
                    gardenBoxItemAmount > 0
                        ? [
                              {
                                  amount: gardenBoxItemAmount,
                                  entityId: '1',
                                  entityTypeName: 'block',
                                  name: 'Bucket',
                              },
                          ]
                        : [],
            },
        ],
    });
    queryClient.setQueryData(['operations'], []);
    queryClient.setQueryData(['blocks'], []);

    return queryClient;
}

function InventoryHudTestProviders({
    children,
    inventoryOptions,
    searchParams,
}: PropsWithChildren<{
    inventoryOptions?: InventoryHudStoryOptions;
    searchParams?: string;
}>) {
    const queryClient = useMemo(
        () => createInventoryHudQueryClient(inventoryOptions),
        [inventoryOptions],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-05-13T12:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    {children}
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

export function InventoryHudClosedStory() {
    return (
        <InventoryHudTestProviders
            inventoryOptions={mixedInventoryStoryOptions}
        >
            <div className="relative h-screen w-screen p-8">
                <InventoryHud />
            </div>
        </InventoryHudTestProviders>
    );
}

export function InventoryHudGardenBoxesOpenStory() {
    return (
        <InventoryHudTestProviders searchParams="ruksak=true&ruksak-kartica=gardenBoxes">
            <div className="relative h-screen w-screen p-8">
                <InventoryHud />
            </div>
        </InventoryHudTestProviders>
    );
}
