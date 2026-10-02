import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useEffect, useMemo } from 'react';
import { currentAccountKeys } from '../../../packages/game/src/hooks/useCurrentAccount';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { GardenPackStorefrontHud } from '../../../packages/game/src/hud/GardenPackStorefrontHud';
import { InventoryHud } from '../../../packages/game/src/hud/InventoryHud';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../../../packages/game/src/useGameState';
import { createGardenPackOfferFixture } from '../../../packages/game/tests/gardenPackStorefrontFixture';
import { GardenPackPurchaseProbe } from './GardenPackPurchaseProbe';

export function GardenPackStorefrontStory({
    preflightProbe = false,
    balance = 123,
    rollout = true,
    sandbox = false,
    anonymous = false,
}: {
    preflightProbe?: boolean;
    balance?: number;
    rollout?: boolean;
    sandbox?: boolean;
    anonymous?: boolean;
}) {
    const client = useMemo(() => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        queryClient.setQueryData(
            ['currentUser'],
            anonymous ? null : { id: 'pack-user' },
        );
        queryClient.setQueryData(currentAccountKeys, {
            id: 'pack-account',
            sunflowers: { amount: balance },
        });
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
        const offer = createGardenPackOfferFixture();
        queryClient.setQueryData(
            ['blocks'],
            getLocalSandboxBlockData().map((block) => {
                const line = offer.lines.find(
                    (line) => line.modelName === block.information.name,
                );
                return line
                    ? {
                          ...block,
                          id: Number(line.entityId),
                          information: {
                              ...block.information,
                              label: line.label,
                          },
                          prices: { ...block.prices, sunflowers: 5 },
                      }
                    : block;
            }),
        );
        queryClient.setQueryData(['inventory'], { items: [], gardenBoxes: [] });
        queryClient.setQueryData(['operations'], []);
        queryClient.setQueryData(['sorts'], []);
        return queryClient;
    }, [balance, anonymous, sandbox]);
    useEffect(() => {
        const switchAccount = () => {
            client.setQueryData(currentAccountKeys, {
                id: 'account-two',
                sunflowers: { amount: 123 },
            });
            client.setQueryData(gardenAccountGroupsKeys, [
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
    }, [client]);
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
        <NuqsTestingAdapter hasMemory>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div className="h-screen w-screen">
                        {preflightProbe ? (
                            <GardenPackPurchaseProbe />
                        ) : (
                            <GardenPackStorefrontHud />
                        )}
                        <InventoryHud />
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
