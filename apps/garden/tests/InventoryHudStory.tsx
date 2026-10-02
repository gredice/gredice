import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { currentAccountKeys } from '../../../packages/game/src/hooks/useCurrentAccount';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { InventoryHud } from '../../../packages/game/src/hud/InventoryHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

type InventoryHudStoryOptions = {
    storedPackUnits?: boolean;
    backpackItemAmount?: number;
    gardenBoxItemAmount?: number;
    includePlantSort?: boolean;
};

const mixedInventoryStoryOptions = {
    backpackItemAmount: 3,
    gardenBoxItemAmount: 29,
};

function createInventoryHudQueryClient({
    storedPackUnits = false,
    backpackItemAmount = 0,
    gardenBoxItemAmount = 2,
    includePlantSort = false,
}: InventoryHudStoryOptions = {}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['inventory'], {
        items:
            backpackItemAmount > 0 || includePlantSort
                ? [
                      ...(includePlantSort
                          ? [
                                {
                                    amount: 1,
                                    entityId: '101',
                                    entityTypeName: 'plantSort',
                                    name: 'Cherry rajčica',
                                },
                            ]
                          : []),
                      ...(backpackItemAmount > 0
                          ? [
                                {
                                    amount: backpackItemAmount,
                                    entityId: '2',
                                    entityTypeName: 'block',
                                    name: 'Seed bag',
                                },
                            ]
                          : []),
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
    if (storedPackUnits) {
        const garden = {
            id: 1,
            name: 'Test garden',
            isSandbox: false,
            isPublic: false,
            stacks: [],
            raisedBeds: [],
            location: { lat: 45.8, lon: 16 },
            backgroundPalette: 'default',
        };
        queryClient.setQueryData(currentAccountKeys, { id: 'pack-account' });
        queryClient.setQueryData(useGardensKeys, [garden]);
        queryClient.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId: 'pack-account',
                name: 'Moj račun',
                isCurrent: true,
                gardens: [garden],
            },
        ]);
        queryClient.setQueryData(currentGardenKeys('summer', 1), garden);
        queryClient.setQueryData(['inventory'], {
            items: [],
            gardenBoxes: [
                {
                    blockId: 'garden-box-1',
                    gardenId: 1,
                    gardenName: 'Test garden',
                    items: [
                        {
                            entityId: '1',
                            entityTypeName: 'block',
                            amount: 1,
                            name: 'Bucket',
                        },
                        ...[1, 2].map((unitOrdinal) => ({
                            entityId: '1',
                            entityTypeName: 'block',
                            amount: 1,
                            name: 'Bucket',
                            packUnit: {
                                purchaseId:
                                    '12345678-1234-4234-8234-123456789012',
                                lineId: 'bucket',
                                unitOrdinal,
                            },
                            blockId: `stored-block-${unitOrdinal}`,
                            variant: null,
                        })),
                    ],
                },
            ],
        });
    }
    queryClient.setQueryData(['operations'], []);
    queryClient.setQueryData(['blocks'], []);
    queryClient.setQueryData(
        ['sorts'],
        includePlantSort
            ? [
                  {
                      id: 101,
                      image: {
                          cover: {
                              url: 'https://cdn.gredice.com/cherry-tomato.webp',
                          },
                      },
                      information: { name: 'Cherry rajčica' },
                  },
              ]
            : [],
    );

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

export function InventoryHudBackpackOpenStory() {
    return (
        <InventoryHudTestProviders
            inventoryOptions={{ includePlantSort: true }}
            searchParams="ruksak=true"
        >
            <div className="relative h-screen w-screen p-8">
                <InventoryHud />
            </div>
        </InventoryHudTestProviders>
    );
}

/** Mirrors the avatar walk-through, where the modal opens without a HUD shell. */
export function InventoryHudTriggerlessStory() {
    return (
        <InventoryHudTestProviders searchParams="ruksak=true&ruksak-kartica=gardenBoxes">
            <div className="relative h-screen w-screen p-8">
                <InventoryHud hideTrigger />
            </div>
        </InventoryHudTestProviders>
    );
}

export function InventoryHudStoredPacksStory() {
    return (
        <InventoryHudTestProviders
            inventoryOptions={{ storedPackUnits: true }}
            searchParams="ruksak=true&ruksak-kartica=gardenBoxes"
        >
            <div className="relative h-screen w-screen p-8">
                <InventoryHud />
            </div>
        </InventoryHudTestProviders>
    );
}
