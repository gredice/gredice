import { gardenPackInventoryKeys } from '@gredice/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { BlockInteractionRegistryProvider } from '../src/controls/BlockInteractionRegistry';
import { EntityFactory } from '../src/entities/EntityFactory';
import { currentAccountKeys } from '../src/hooks/useCurrentAccount';
import { currentGardenKeys } from '../src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../src/hooks/useGardens';
import { GardenPackInventoryPurchase } from '../src/hud/GardenPackInventoryPurchase';
import { PackLayoutPreviewHud } from '../src/hud/PackLayoutPreviewHud';
import { PackLayoutPreviewScene } from '../src/packLayouts/PackLayoutPreviewScene';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import {
    createPackLayoutFixtureBlocks,
    createPackLayoutFixtureGarden,
    createPackLayoutFixtureLayout,
    createPackLayoutFixturePack,
    packLayoutFixtureAccountId,
    packLayoutFixtureUserId,
} from './ownedPackLayoutFixture';
import { PackLayoutPreviewProbe } from './PackLayoutPreviewProbe';

export function PackLayoutPreviewFixture({
    collision = false,
    missing = false,
    unavailable = false,
    mounted = true,
}: {
    collision?: boolean;
    missing?: boolean;
    unavailable?: boolean;
    mounted?: boolean;
}) {
    const [report, setReport] = useState('');
    const [showInventory, setShowInventory] = useState(true);
    const blocks = useMemo(() => createPackLayoutFixtureBlocks(), []);
    const pack = useMemo(() => createPackLayoutFixturePack(blocks), [blocks]);
    const garden = useMemo(() => {
        const result = createPackLayoutFixtureGarden();
        if (collision)
            result.stacks
                .find(
                    (stack) => stack.position.x === 0 && stack.position.z === 0,
                )
                ?.blocks.push({
                    id: 'obstacle',
                    name: 'LeafRake',
                    rotation: 0,
                });
        return result;
    }, [collision]);
    const queryClient = useMemo(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        client.setQueryData(['currentUser'], { id: packLayoutFixtureUserId });
        client.setQueryData(currentAccountKeys, {
            id: packLayoutFixtureAccountId,
            sunflowers: { amount: 50 },
        });
        client.setQueryData(useGardensKeys, [garden]);
        client.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId: packLayoutFixtureAccountId,
                isCurrent: true,
                gardens: [garden],
            },
        ]);
        client.setQueryData(currentGardenKeys('summer', garden.id), garden);
        client.setQueryData(
            ['blocks'],
            unavailable
                ? blocks.filter(
                      (block) => block.information.name !== 'FallenLog',
                  )
                : blocks,
        );
        client.setQueryData(['sorts'], []);
        client.setQueryData(['operations'], []);
        const layout = createPackLayoutFixtureLayout(pack);
        if (missing) layout.availableUnits = [];
        client.setQueryData(
            [
                'garden-pack-layouts',
                packLayoutFixtureUserId,
                packLayoutFixtureAccountId,
                pack.purchaseId,
            ],
            {
                enabled: true,
                accountId: packLayoutFixtureAccountId,
                purchaseId: pack.purchaseId,
                layouts: [layout],
            },
        );
        client.setQueryData(
            [
                ...gardenPackInventoryKeys.all,
                packLayoutFixtureUserId,
                packLayoutFixtureAccountId,
            ],
            {
                pages: [
                    {
                        enabled: true,
                        accountId: packLayoutFixtureAccountId,
                        purchases: [pack],
                        hasMore: false,
                        nextCursor: null,
                    },
                ],
                pageParams: [null],
            },
        );
        return client;
    }, [garden, blocks, pack, missing, unavailable]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: window.location.origin,
                isMock: false,
                authenticatedGardenQueriesEnabled: true,
                gardenPacksEnabled: true,
                freezeTime: new Date('2026-10-15T12:00:00Z'),
                dayNightCycleDisabled: true,
                initialQualitySetting: 'low',
            }),
        [],
    );
    useDisposeGameStateStore(store);
    return (
        <NuqsTestingAdapter hasMemory>
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={store}>
                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 700,
                            height: 650,
                        }}
                    >
                        {mounted && (
                            <Scene
                                position={[-8, 8, -8]}
                                zoom={65}
                                quality={gameQualityProfiles.low}
                                staticOpaqueCacheEnabled={false}
                            >
                                <ambientLight intensity={2} />
                                <directionalLight
                                    position={[5, 10, -5]}
                                    intensity={2}
                                />
                                <BlockInteractionRegistryProvider>
                                    <PackLayoutPreviewScene />
                                    <Suspense fallback={null}>
                                        {garden.stacks.map((stack) => (
                                            <EntityFactory
                                                key={stack.blocks[0]?.id}
                                                name="Block_Grass"
                                                block={
                                                    stack.blocks[0] ?? {
                                                        id: 'ground',
                                                        name: 'Block_Grass',
                                                        rotation: 0,
                                                    }
                                                }
                                                stack={{
                                                    ...stack,
                                                    position: new Vector3(
                                                        stack.position.x,
                                                        0,
                                                        stack.position.z,
                                                    ),
                                                }}
                                                rotation={0}
                                                noControl
                                                weatherDisabled
                                            />
                                        ))}
                                    </Suspense>
                                    <PackLayoutPreviewProbe
                                        onSample={setReport}
                                    />
                                </BlockInteractionRegistryProvider>
                            </Scene>
                        )}
                        {mounted && <PackLayoutPreviewHud />}
                    </div>
                    {showInventory && (
                        <GardenPackInventoryPurchase
                            pack={pack}
                            blockData={
                                unavailable
                                    ? blocks.filter(
                                          (block) =>
                                              block.information.name !==
                                              'FallenLog',
                                      )
                                    : blocks
                            }
                            placement={{
                                place: async () => {},
                                isPending: false,
                                error: null,
                            }}
                            previewLayouts
                            onPlaced={() => setShowInventory(false)}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setShowInventory(true)}
                    >
                        Otvori paket
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            queryClient.setQueryData(currentAccountKeys, {
                                id: '50000000-0000-4000-8000-000000000009',
                                sunflowers: { amount: 0 },
                            })
                        }
                    >
                        Promijeni račun
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            queryClient.setQueryData(currentAccountKeys, {
                                id: packLayoutFixtureAccountId,
                                sunflowers: { amount: 50 },
                            })
                        }
                    >
                        Vrati račun
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            queryClient.setQueryData(
                                currentGardenKeys('summer', garden.id),
                                {
                                    ...garden,
                                    stacks: [
                                        ...garden.stacks,
                                        {
                                            position: { x: 5, y: 0, z: 5 },
                                            blocks: [
                                                {
                                                    id: 'new-block',
                                                    name: 'LeafRake',
                                                    rotation: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            )
                        }
                    >
                        Promijeni vrt
                    </button>
                    <output data-testid="layout-report">{report}</output>
                    <output data-testid="layout-garden">
                        {JSON.stringify(
                            queryClient.getQueryData(
                                currentGardenKeys('summer', garden.id),
                            ),
                        )}
                    </output>
                    <output data-testid="layout-pack">
                        {JSON.stringify(pack)}
                    </output>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
