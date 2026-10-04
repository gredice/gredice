import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useEffect, useMemo, useState } from 'react';
import { GameScene } from '../../../packages/game/src/GameScene';
import {
    currentAccountKeys,
    type useCurrentAccount,
} from '../../../packages/game/src/hooks/useCurrentAccount';
import {
    type CurrentGarden,
    currentGardenKeys,
} from '../../../packages/game/src/hooks/useCurrentGarden';
import { detailedRaisedBedInspectionReportsQueryKey } from '../../../packages/game/src/hooks/useDetailedRaisedBedInspectionReports';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { AutumnPhotoHud } from '../../../packages/game/src/hud/AutumnPhotoHud';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../../../packages/game/src/useGameState';

const initialGarden: CurrentGarden = {
    id: 421,
    name: 'PRIVATE CUSTOMER GARDEN',
    isSandbox: true,
    isPublic: false,
    homeCamera: null,
    backgroundPalette: 'golden',
    location: { lat: 45.8, lon: 16 },
    raisedBeds: [],
    stacks: [
        {
            position: { x: 0, y: 0, z: 0 },
            blocks: [
                { id: 'private-ground', name: 'Block_Grass', rotation: 0 },
                {
                    id: 'private-pumpkin',
                    name: 'HarvestPumpkinSquatOrange',
                    rotation: 0,
                },
            ],
        },
        {
            position: { x: 1, y: 0, z: 0 },
            blocks: [
                { id: 'private-sign-ground', name: 'Block_Grass', rotation: 0 },
                {
                    id: 'private-sign',
                    name: 'WoodenSign',
                    rotation: 0,
                    message: 'PRIVATE SIGN NOTE',
                },
            ],
        },
    ],
};
type FixtureAccount = NonNullable<ReturnType<typeof useCurrentAccount>['data']>;
const fixtureAccount = {
    id: 'own-account',
    timeZone: 'Europe/Zagreb',
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
    sunflowers: { amount: 0, history: [] },
} satisfies FixtureAccount;

export function AutumnPhotoStory({
    privateOwner,
}: {
    privateOwner?: 'current' | 'other';
}) {
    const fixtureGarden = useMemo(
        () => ({ ...initialGarden, isSandbox: !privateOwner }),
        [privateOwner],
    );
    const queryClient = useMemo(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        client.setQueryData<FixtureAccount | null>(
            currentAccountKeys,
            privateOwner ? fixtureAccount : null,
        );
        client.setQueryData(useGardensKeys, [fixtureGarden]);
        client.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId:
                    privateOwner === 'other'
                        ? 'different-owner'
                        : privateOwner
                          ? 'own-account'
                          : 'anonymous',
                isCurrent: privateOwner !== 'other',
                gardens: [fixtureGarden],
            },
        ]);
        client.setQueryData(
            currentGardenKeys('summer', fixtureGarden.id),
            fixtureGarden,
        );
        client.setQueryData(
            detailedRaisedBedInspectionReportsQueryKey(fixtureGarden.id),
            { reports: [] },
        );
        client.setQueryData(['blocks'], getLocalSandboxBlockData());
        client.setQueryData(['sorts'], []);
        client.setQueryData(['operations'], []);
        return client;
    }, [fixtureGarden, privateOwner]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: window.location.origin,
                spriteBaseUrl: window.location.origin,
                authenticatedGardenQueriesEnabled: Boolean(privateOwner),
                isMock: false,
                freezeTime: new Date('2026-10-15T16:30:00Z'),
                dayNightCycleDisabled: false,
                winterMode: 'summer',
                initialQualitySetting: 'low',
            }),
        [privateOwner],
    );
    useDisposeGameStateStore(store);
    const [snapshot, setSnapshot] = useState(
        store.getState().gameCameraSnapshot,
    );
    useEffect(
        () => store.subscribe((state) => setSnapshot(state.gameCameraSnapshot)),
        [store],
    );
    return (
        <NuqsTestingAdapter hasMemory>
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={store}>
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 800,
                            height: 500,
                            position: 'relative',
                        }}
                    >
                        <GameScene
                            hideHud
                            noWeather
                            noSound
                            renderDetails={false}
                            quality="low"
                            staticOpaqueSceneCache={false}
                        />
                    </div>
                    <AutumnPhotoHud />
                    <button
                        type="button"
                        onClick={() => {
                            const camera = store.getState().gameCamera;
                            if (!camera) return;
                            const snapshot = camera.getSnapshot();
                            camera.restore(
                                { ...snapshot, position: [100, 100, -100] },
                                { immediate: true },
                            );
                        }}
                    >
                        Select rotated view
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const garden = {
                                ...fixtureGarden,
                                stacks: fixtureGarden.stacks.slice(0, 1),
                            };
                            queryClient.setQueryData(
                                currentGardenKeys('summer', fixtureGarden.id),
                                garden,
                            );
                        }}
                    >
                        Select one-block scene
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            queryClient.setQueryData<FixtureAccount>(
                                currentAccountKeys,
                                {
                                    ...fixtureAccount,
                                    id: 'other-owner',
                                },
                            )
                        }
                    >
                        Switch fixture account
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            store
                                .getState()
                                .setFreezeTime(new Date('2026-11-02T12:00:00Z'))
                        }
                    >
                        Change scene date
                    </button>
                    <output data-testid="photo-privacy">
                        {JSON.stringify({
                            isPublic: queryClient.getQueryData<CurrentGarden>(
                                currentGardenKeys('summer', fixtureGarden.id),
                            )?.isPublic,
                        })}
                    </output>
                    <output data-testid="photo-camera">
                        {JSON.stringify(snapshot)}
                    </output>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
