import { gardenPackInventoryKeys } from '@gredice/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useEffect, useMemo } from 'react';
import { currentAccountKeys } from '../../../packages/game/src/hooks/useCurrentAccount';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { InventoryHud } from '../../../packages/game/src/hud/InventoryHud';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../../../packages/game/src/useGameState';
import { createOwnedGardenPackFixture } from '../../../packages/game/tests/ownedGardenPackFixture';

export function GardenPackInventoryStory({
    rollout = true,
    sandbox = false,
    anonymous = false,
    seed = true,
    placementFailure = false,
}: {
    rollout?: boolean;
    sandbox?: boolean;
    anonymous?: boolean;
    seed?: boolean;
    placementFailure?: boolean;
}) {
    const queryClient = useMemo(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        client.setQueryData(
            ['currentUser'],
            anonymous ? null : { id: 'pack-user' },
        );
        client.setQueryData(currentAccountKeys, { id: 'pack-account' });
        const garden = {
            id: 1,
            name: 'Moj vrt',
            isSandbox: sandbox,
            isPublic: false,
            stacks: [],
            raisedBeds: [],
            location: { lat: 45.8, lon: 16 },
            backgroundPalette: 'default',
        };
        client.setQueryData(useGardensKeys, [garden]);
        client.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId: 'pack-account',
                name: 'Moj račun',
                isCurrent: true,
                gardens: [garden],
            },
        ]);
        client.setQueryData(currentGardenKeys('summer', 1), garden);
        client.setQueryData(['inventory'], { items: [], gardenBoxes: [] });
        client.setQueryData(['operations'], []);
        client.setQueryData(['sorts'], []);
        const blocks = getLocalSandboxBlockData().map((block) =>
            block.information.name === 'HarvestPumpkinSquatOrange'
                ? {
                      ...block,
                      id: 801,
                      prices: { ...block.prices, sunflowers: 0 },
                  }
                : block,
        );
        client.setQueryData(['blocks'], blocks);
        if (seed) {
            const partial = createOwnedGardenPackFixture();
            const unopened = {
                ...createOwnedGardenPackFixture('purchase-repeat'),
                state: 'unopened',
                remainingQuantity: 3,
                lines: [
                    {
                        ...partial.lines[0],
                        remainingQuantity: 3,
                        availableUnitOrdinals: [1, 2, 3],
                    },
                ],
            };
            const exhausted = {
                ...createOwnedGardenPackFixture('purchase-exhausted'),
                state: 'exhausted',
                remainingQuantity: 0,
                lines: [
                    {
                        ...partial.lines[0],
                        remainingQuantity: 0,
                        availableUnitOrdinals: [],
                    },
                ],
            };
            const missing = {
                ...createOwnedGardenPackFixture('purchase-missing'),
                lines: [{ ...partial.lines[0], modelName: 'MissingModel' }],
            };
            client.setQueryData(
                [...gardenPackInventoryKeys.all, 'pack-user', 'pack-account'],
                {
                    pages: [
                        {
                            enabled: true,
                            accountId: 'pack-account',
                            purchases: [partial, unopened, exhausted, missing],
                            hasMore: false,
                            nextCursor: null,
                        },
                    ],
                    pageParams: [null],
                },
            );
        }
        return client;
    }, [anonymous, sandbox, seed]);
    useEffect(() => {
        const switchAccount = () => {
            queryClient.setQueryData(currentAccountKeys, { id: 'account-two' });
            queryClient.setQueryData(gardenAccountGroupsKeys, [
                {
                    accountId: 'account-two',
                    name: 'Drugi račun',
                    isCurrent: true,
                    gardens: [{ id: 1, isSandbox: false }],
                },
            ]);
        };
        window.addEventListener('test-pack-account-switch', switchAccount);
        return () =>
            window.removeEventListener(
                'test-pack-account-switch',
                switchAccount,
            );
    }, [queryClient]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                freezeTime: null,
                isMock: false,
                winterMode: 'summer',
                gardenPacksEnabled: rollout,
            }),
        [rollout],
    );
    useDisposeGameStateStore(store);
    return (
        <NuqsTestingAdapter
            hasMemory
            searchParams="ruksak=true&ruksak-kartica=gardenPacks"
        >
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={store}>
                    <div className="h-screen w-screen">
                        <InventoryHud
                            packPlacement={
                                placementFailure
                                    ? {
                                          isPending: false,
                                          error: null,
                                          place: async (unit) => {
                                              window.dispatchEvent(
                                                  new CustomEvent(
                                                      'test-pack-placement',
                                                      { detail: unit },
                                                  ),
                                              );
                                              throw new Error(
                                                  'Fixture placement rejected',
                                              );
                                          },
                                      }
                                    : undefined
                            }
                        />
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
