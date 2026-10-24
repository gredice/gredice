import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useEffect, useMemo, useState } from 'react';
import {
    currentAccountKeys,
    type useCurrentAccount,
} from '../../../packages/game/src/hooks/useCurrentAccount';
import {
    type CurrentGarden,
    currentGardenKeys,
} from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { AutumnActivityHud } from '../../../packages/game/src/hud/AutumnActivityHud';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../../../packages/game/src/useGameState';
import {
    autumnActivityAccountA,
    autumnActivityAccountB,
} from '../../../packages/game/tests/autumnActivityFixture';

export function AutumnActivityStory({
    rollout = true,
    packs = true,
    anonymous = false,
    sandbox = false,
    mock = false,
}: {
    rollout?: boolean;
    packs?: boolean;
    anonymous?: boolean;
    sandbox?: boolean;
    mock?: boolean;
}) {
    const [mounted, setMounted] = useState(true);
    const client = useMemo(() => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        const garden: CurrentGarden = {
            id: 1,
            name: 'Testni vrt',
            isSandbox: sandbox,
            isPublic: false,
            homeCamera: null,
            backgroundPalette: 'current',
            location: { lat: 45.8, lon: 16 },
            raisedBeds: [],
            stacks: [],
        };
        queryClient.setQueryData(
            ['currentUser'],
            anonymous ? null : { id: 'activity-user' },
        );
        const account = {
            id: autumnActivityAccountA,
            timeZone: 'Europe/Zagreb',
            createdAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
            sunflowers: { amount: 0, history: [] },
        } satisfies NonNullable<ReturnType<typeof useCurrentAccount>['data']>;
        queryClient.setQueryData(currentAccountKeys, account);
        queryClient.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId: account.id,
                name: 'Testni račun',
                isCurrent: true,
                gardens: [garden],
            },
        ]);
        queryClient.setQueryData(useGardensKeys, [garden]);
        queryClient.setQueryData(currentGardenKeys('summer', 1), garden);
        return queryClient;
    }, [anonymous, sandbox]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                freezeTime: null,
                isMock: mock,
                winterMode: 'summer',
                autumnActivityEnabled: rollout,
                gardenPacksEnabled: packs,
            }),
        [rollout, packs, mock],
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        const switchAccount = (event: Event) => {
            if (!(event instanceof CustomEvent)) return;
            const id =
                event.detail === 'B'
                    ? autumnActivityAccountB
                    : autumnActivityAccountA;
            const account =
                client.getQueryData<
                    NonNullable<ReturnType<typeof useCurrentAccount>['data']>
                >(currentAccountKeys);
            if (account)
                client.setQueryData(currentAccountKeys, { ...account, id });
            const garden = client.getQueryData<CurrentGarden>(
                currentGardenKeys('summer', 1),
            );
            if (!garden) return;
            client.setQueryData(gardenAccountGroupsKeys, [
                {
                    accountId: id,
                    name: 'Testni račun',
                    isCurrent: true,
                    gardens: [garden],
                },
            ]);
        };
        window.addEventListener('test-activity-account', switchAccount);
        return () =>
            window.removeEventListener('test-activity-account', switchAccount);
    }, [client]);
    return (
        <NuqsTestingAdapter hasMemory>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div className="min-h-screen p-3">
                        {mounted && <AutumnActivityHud />}
                        <button
                            type="button"
                            onClick={() => setMounted((value) => !value)}
                        >
                            {mounted
                                ? 'Odmontiraj album'
                                : 'Ponovno montiraj album'}
                        </button>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
