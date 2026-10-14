import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import { BlockInteractionRegistryProvider } from '../src/controls/BlockInteractionRegistry';
import { GameCameraRig } from '../src/controls/GameCameraRig';
import { CosmeticLeafRaking } from '../src/cosmeticLeafRaking/CosmeticLeafRaking';
import { EntityFactory } from '../src/entities/EntityFactory';
import { currentAccountKeys } from '../src/hooks/useCurrentAccount';
import {
    type CurrentGarden,
    currentGardenKeys,
} from '../src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../src/hooks/useGardens';
import { LeafRakingHud } from '../src/hud/LeafRakingHud';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { ParticleSystemProvider } from '../src/particles/ParticleSystem';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { LeafRakingProbe } from './LeafRakingProbe';

const initialGarden: CurrentGarden = {
    id: 631,
    name: 'Leaf fixture',
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
                { id: 'grass-rake', name: 'Block_Grass', rotation: 0 },
                { id: 'rake', name: 'LeafRake', rotation: 1 },
            ],
        },
        {
            position: { x: 1.5, y: 0, z: 0 },
            blocks: [
                { id: 'grass-pile', name: 'Block_Grass', rotation: 0 },
                { id: 'pile', name: 'AutumnLeafPileCrescent', rotation: 2 },
            ],
        },
    ],
};
export function LeafRakingFixture({
    mounted = true,
    fixedTimeSeconds,
}: {
    mounted?: boolean;
    fixedTimeSeconds?: number;
}) {
    const [garden, setGarden] = useState(initialGarden);
    const [report, setReport] = useState('');
    const client = useMemo(() => {
        const value = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        value.setQueryData(currentAccountKeys, null);
        value.setQueryData(useGardensKeys, [initialGarden]);
        value.setQueryData(gardenAccountGroupsKeys, [
            { accountId: 'local', isCurrent: true, gardens: [initialGarden] },
        ]);
        value.setQueryData(
            currentGardenKeys('summer', initialGarden.id),
            initialGarden,
        );
        value.setQueryData(['blocks'], getLocalSandboxBlockData());
        value.setQueryData(['sorts'], []);
        value.setQueryData(['operations'], []);
        return value;
    }, []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: window.location.origin,
                authenticatedGardenQueriesEnabled: false,
                isMock: false,
                freezeTime: new Date('2026-10-15T13:00:00Z'),
                dayNightCycleDisabled: true,
                initialQualitySetting: 'low',
            }),
        [],
    );
    useDisposeGameStateStore(store);
    const controller = store.getState().cosmeticLeafRaking;
    const snapshot = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
    );
    const stacks = garden.stacks.map((stack) => ({
        ...stack,
        position: new Vector3(
            stack.position.x,
            stack.position.y,
            stack.position.z,
        ),
    }));
    function replaceGarden(next: CurrentGarden) {
        setGarden(next);
        client.setQueryData(useGardensKeys, [next]);
        client.setQueryData(gardenAccountGroupsKeys, [
            { accountId: 'local', isCurrent: true, gardens: [next] },
        ]);
        client.setQueryData(currentGardenKeys('summer', next.id), next);
    }
    return (
        <NuqsTestingAdapter hasMemory>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 700,
                            height: 470,
                            position: 'relative',
                        }}
                    >
                        {mounted && (
                            <Scene
                                position={[-8, 8, -8]}
                                zoom={105}
                                fixedTimeSeconds={fixedTimeSeconds}
                                quality={gameQualityProfiles.low}
                                staticOpaqueCacheEnabled={false}
                            >
                                <ambientLight intensity={1.8} />
                                <directionalLight
                                    position={[5, 10, -5]}
                                    intensity={2}
                                />
                                <ParticleSystemProvider>
                                    <BlockInteractionRegistryProvider>
                                        <GameCameraRig controlsEnabled />
                                        <CosmeticLeafRaking />
                                        <Suspense fallback={null}>
                                            {stacks.flatMap((stack) =>
                                                stack.blocks.map((block) => (
                                                    <EntityFactory
                                                        key={block.id}
                                                        name={block.name}
                                                        block={block}
                                                        stack={stack}
                                                        rotation={
                                                            block.rotation ?? 0
                                                        }
                                                        weatherDisabled
                                                    />
                                                )),
                                            )}
                                        </Suspense>
                                        <LeafRakingProbe onSample={setReport} />
                                    </BlockInteractionRegistryProvider>
                                </ParticleSystemProvider>
                            </Scene>
                        )}
                        <div
                            style={{ position: 'absolute', bottom: 0, left: 0 }}
                        >
                            <LeafRakingHud />
                        </div>
                    </div>
                    <output data-testid="raking-report">{report}</output>
                    <output data-testid="raking-state">
                        {JSON.stringify(snapshot)}
                    </output>
                    <output data-testid="raking-garden">
                        {JSON.stringify(garden)}
                    </output>
                    <button
                        type="button"
                        onClick={() =>
                            store
                                .getState()
                                .setPickupBlock(
                                    initialGarden.stacks[0]?.blocks[1] ?? null,
                                )
                        }
                    >
                        Enter drag
                    </button>
                    <button
                        type="button"
                        onClick={() => store.getState().setPickupBlock(null)}
                    >
                        Finish drag
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            client.setQueryData(currentAccountKeys, {
                                id: 'new-owner',
                            })
                        }
                    >
                        Switch account
                    </button>
                    <button
                        type="button"
                        onClick={() => replaceGarden({ ...garden, id: 632 })}
                    >
                        Switch garden
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            replaceGarden({
                                ...garden,
                                stacks: garden.stacks.map((stack) => ({
                                    ...stack,
                                    blocks: stack.blocks.slice(0, 1),
                                })),
                            })
                        }
                    >
                        Remove targets
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            store.getState().audio.setMasterMuted(false);
                            store.getState().audio.ambient.setMuted(false);
                            void store.getState().audio.resume();
                        }}
                    >
                        Allow audio
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            store.getState().audio.setMasterMuted(true)
                        }
                    >
                        Mute master
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            store.getState().audio.ambient.setMuted(true)
                        }
                    >
                        Mute ambient
                    </button>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
