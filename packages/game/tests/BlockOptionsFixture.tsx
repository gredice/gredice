import type { BlockData } from '@gredice/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { Vector3 } from 'three';
import { BlockOptionsHud } from '../src/blockOptions/BlockOptionsHud';
import { BlockOptionsScene } from '../src/blockOptions/BlockOptionsScene';
import { BlockInteractionLayer } from '../src/controls/BlockInteractionLayer';
import { BlockInteractionRegistryProvider } from '../src/controls/BlockInteractionRegistry';
import { GameCameraRig } from '../src/controls/GameCameraRig';
import { HudPlacementDragPreview } from '../src/controls/HudPlacementDragPreview';
import { EntityInstances } from '../src/entities/EntityInstances';
import { Sheep } from '../src/entities/farmAnimals/FarmAnimals';
import { RetainedEntityChunks } from '../src/entities/RetainedEntityChunks';
import {
    gameHudBottomBarClassName,
    gameHudBottomControlsClassName,
    gameHudBottomItemsClassName,
} from '../src/GameHud';
import { defaultGameCameraPosition } from '../src/gameCamera';
import { useBlockData } from '../src/hooks/useBlockData';
import {
    currentAccountKeys,
    useCurrentAccount,
} from '../src/hooks/useCurrentAccount';
import {
    currentGardenKeys,
    useCurrentGarden,
} from '../src/hooks/useCurrentGarden';
import { queryKey as currentUserQueryKeys } from '../src/hooks/useCurrentUser';
import { useFocusPlacedBlock } from '../src/hooks/useFocusPlacedBlock';
import { gardenAccountGroupsKeys } from '../src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../src/hooks/useGardens';
import { useSceneCurrentGarden } from '../src/hooks/useSceneCurrentGarden';
import {
    type ShoppingCartData,
    type ShoppingCartItemData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from '../src/hooks/useShoppingCart';
import { PlacementGrid } from '../src/indicators/PlacementGrid';
import { localSandboxGardenId } from '../src/localSandboxGarden';
import { ParticleSystemProvider } from '../src/particles/ParticleSystem';
import { useRetainedGardenScene } from '../src/scene/compiler/useRetainedGardenScene';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { SceneBlockDataProvider } from '../src/scene/SceneBlockDataProvider';
import type { GardenStack } from '../src/types/Stack';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { BlockOptionsProbe } from './BlockOptionsProbe';
import {
    type BlockOptionsFixtureViewport,
    blockOptionsFixtureAccountId,
    blockOptionsFixtureDayTime,
    blockOptionsFixtureGardenId,
    blockOptionsFixtureLocalSandboxKey,
    blockOptionsFixtureStageSizes,
    blockOptionsFixtureUserId,
    createBlockOptionsFixtureBlockData,
    createBlockOptionsFixtureGarden,
    createBlockOptionsFixtureStacks,
} from './blockOptionsFixtureData';

const entitiesRootName = 'BlockOptionsFixture:Entities';
const instancedRootName = 'BlockOptionsFixture:Instances';
const cameraZoomByViewport: Record<BlockOptionsFixtureViewport, number> = {
    desktop: 65,
    phone: 50,
};

type FixtureAccount = NonNullable<ReturnType<typeof useCurrentAccount>['data']>;
// A stable default, so the seeded query client is not rebuilt on re-render.
const noCartItems: ShoppingCartItemData[] = [];

export type BlockOptionsFixtureProps = {
    /** Garden seed: the stacks to place instead of the default garden. */
    stacks?: GardenStack[];
    /** Block catalogue; defaults to `createBlockOptionsFixtureBlockData()`. */
    blockData?: BlockData[];
    /** Account sunflower balance (what the server debits). */
    sunflowers?: number;
    /** Sunflowers the shopping cart holds; the HUD shows balance − cart. */
    cartSunflowers?: number;
    /** Shopping cart items (raised-bed removal counts the matching ones). */
    cartItems?: ShoppingCartItemData[];
    /** The garden is a sandbox garden: free blocks, Obriši instead of Recikliraj. */
    sandbox?: boolean;
    /**
     * The local sandbox (no account, garden kept in `localStorage`); the
     * game's own local block data is used unless `blockData` is given.
     */
    localSandbox?: boolean;
    /** Stage size and camera zoom: 960 × 640 desktop or 360 × 740 phone. */
    viewport?: BlockOptionsFixtureViewport;
    /** Frozen game time (ISO); defaults to a summer morning. */
    time?: string;
    /** Stand-in HUD regions the pop-up must avoid (default true). */
    hud?: boolean;
    /**
     * Mount the game's sheep for `SheepFold` blocks (default false). Each
     * sheep is a `PickableGroup` handle for its fold (`blockProxy`).
     */
    sheep?: boolean;
    /**
     * Publish the scene's runtime frame loop (render leases) to
     * `window.__grediceGameProfile` (default false).
     */
    profileStats?: boolean;
    /**
     * Mount `BlockOptionsScene` and `BlockOptionsHud` (default true). False
     * is the game with its HUD hidden (`hideHud`), e.g. the signed-out
     * garden: block controls work but no pop-up can be shown.
     */
    blockOptionsUi?: boolean;
};

/**
 * Browser fixture for the block options pop-up and Expand (spec §14.3): a
 * seeded query cache, a game store, the real garden scene with per-entity
 * and instanced block controls, the camera rig, `BlockOptionsScene` in the
 * Canvas and `BlockOptionsHud` beside it, plus `BlockOptionsProbe`
 * (`window.__blockOptionsProbe`).
 *
 * The real `GameHud` is not mounted; stand-in regions with the same data
 * attributes take its place so HUD obstacle measuring works.
 */
export function BlockOptionsFixture({
    stacks,
    blockData,
    sunflowers = 1000,
    cartSunflowers = 0,
    cartItems = noCartItems,
    sandbox = false,
    localSandbox = false,
    viewport = 'desktop',
    time = blockOptionsFixtureDayTime,
    hud = true,
    sheep = false,
    profileStats = false,
    blockOptionsUi = true,
}: BlockOptionsFixtureProps) {
    const garden = useMemo(
        () =>
            createBlockOptionsFixtureGarden({
                sandbox,
                stacks: stacks ?? createBlockOptionsFixtureStacks(),
            }),
        [sandbox, stacks],
    );
    const gardenQueryKey = useMemo(
        () =>
            localSandbox
                ? currentGardenKeys(
                      'summer',
                      localSandboxGardenId,
                      undefined,
                      blockOptionsFixtureLocalSandboxKey,
                  )
                : currentGardenKeys('summer', blockOptionsFixtureGardenId),
        [localSandbox],
    );
    const queryClient = useMemo(() => {
        const client = new QueryClient({
            defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
                mutations: { retry: false },
            },
        });
        // Public directories the scene reads (plant sorts, operations).
        client.setQueryData(['sorts'], []);
        client.setQueryData(['operations'], []);
        if (localSandbox) {
            // The game loads the local garden and block data itself.
            if (blockData) {
                client.setQueryData(['blocks', 'local'], blockData);
            }
            return client;
        }

        const account = {
            id: blockOptionsFixtureAccountId,
            timeZone: 'Europe/Zagreb',
            createdAt: '2026-05-01T08:00:00Z',
            updatedAt: '2026-05-01T08:00:00Z',
            sunflowers: { amount: sunflowers, history: [] },
        } satisfies FixtureAccount;
        const cart = {
            id: 1,
            accountId: blockOptionsFixtureAccountId,
            status: 'new',
            isDeleted: false,
            createdAt: '2026-06-01T08:00:00Z',
            updatedAt: '2026-06-01T08:00:00Z',
            items: cartItems,
            notes: [],
            total: 0,
            totalSunflowers: cartSunflowers,
            allowPurchase: true,
            hasDeliverableItems: false,
        } satisfies ShoppingCartData;
        client.setQueryData(currentUserQueryKeys.currentUser, {
            id: blockOptionsFixtureUserId,
        });
        client.setQueryData(currentAccountKeys, account);
        client.setQueryData(useShoppingCartQueryKey, cart);
        client.setQueryData(useGardensKeys, [garden]);
        client.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId: blockOptionsFixtureAccountId,
                isCurrent: true,
                gardens: [garden],
            },
        ]);
        client.setQueryData(gardenQueryKey, garden);
        client.setQueryData(
            ['blocks'],
            blockData ?? createBlockOptionsFixtureBlockData(),
        );
        // No live weather for the fixture's farm (`useWeatherNow`).
        client.setQueryData(['weather', 'now', null], null);
        return client;
    }, [
        blockData,
        cartItems,
        cartSunflowers,
        garden,
        gardenQueryKey,
        localSandbox,
        sunflowers,
    ]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: window.location.origin,
                spriteBaseUrl: window.location.origin,
                isMock: false,
                authenticatedGardenQueriesEnabled: !localSandbox,
                freezeTime: new Date(time),
                dayNightCycleDisabled: false,
                initialQualitySetting: 'low',
                winterMode: 'summer',
                ...(localSandbox
                    ? {
                          localSandboxStorageKey:
                              blockOptionsFixtureLocalSandboxKey,
                          localSandboxInitialStacks: garden.stacks.map(
                              (stack) => ({
                                  blocks: stack.blocks,
                                  position: new Vector3(
                                      stack.position.x,
                                      stack.position.y,
                                      stack.position.z,
                                  ),
                              }),
                          ),
                      }
                    : {}),
            }),
        [garden, localSandbox, time],
    );
    useDisposeGameStateStore(store);
    const stageSize = blockOptionsFixtureStageSizes[viewport];

    return (
        <NuqsTestingAdapter hasMemory>
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-block-options-fixture={viewport}
                        style={{
                            position: 'relative',
                            width: stageSize.width,
                            height: stageSize.height,
                            overflow: 'hidden',
                            background:
                                'linear-gradient(180deg, #cfe7f5 0%, #eef6e4 100%)',
                        }}
                    >
                        <BlockOptionsFixtureScene
                            blockOptionsUi={blockOptionsUi}
                            gardenQueryKey={gardenQueryKey}
                            profileStats={profileStats}
                            sheep={sheep}
                            viewport={viewport}
                        />
                        {hud ? (
                            <BlockOptionsFixtureHudRegions
                                economy={!sandbox && !localSandbox}
                            />
                        ) : null}
                        {blockOptionsUi ? <BlockOptionsHud /> : null}
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

function BlockOptionsFixtureScene({
    blockOptionsUi,
    gardenQueryKey,
    profileStats,
    sheep,
    viewport,
}: {
    blockOptionsUi: boolean;
    gardenQueryKey: readonly unknown[];
    profileStats: boolean;
    sheep: boolean;
    viewport: BlockOptionsFixtureViewport;
}) {
    // GameScene runs these hooks; the fixture mounts the same scene parts
    // in the same order (grid, drag preview, block options, entities,
    // instances, interaction layer, camera rig).
    useFocusPlacedBlock();
    const { data: blockData } = useBlockData();
    const { data: gardenData } = useCurrentGarden();
    const garden = useSceneCurrentGarden(gardenData);
    const retainedScene = useRetainedGardenScene(garden?.stacks, blockData);
    const cameraPosition = useMemo(
        () => new Vector3(...defaultGameCameraPosition),
        [],
    );
    const zoom = cameraZoomByViewport[viewport];

    return (
        <SceneBlockDataProvider data={blockData}>
            <Scene
                position={cameraPosition}
                zoom={zoom}
                profileStats={profileStats}
                quality={gameQualityProfiles.low}
                staticOpaqueCacheEnabled={false}
            >
                <ambientLight intensity={2} />
                <directionalLight position={[5, 10, -5]} intensity={2} />
                <ParticleSystemProvider>
                    <BlockInteractionRegistryProvider>
                        <PlacementGrid />
                        <HudPlacementDragPreview />
                        {blockOptionsUi ? <BlockOptionsScene /> : null}
                        <group name={entitiesRootName}>
                            <RetainedEntityChunks
                                scene={retainedScene}
                                farmId={garden?.farmId}
                                noControl={false}
                                weatherDisabled
                            />
                        </group>
                        {sheep ? (
                            <Sheep
                                farmId={garden?.farmId}
                                stacks={retainedScene.stacks}
                                weatherDisabled
                            />
                        ) : null}
                        <group name={instancedRootName}>
                            <EntityInstances
                                farmId={garden?.farmId}
                                quality={gameQualityProfiles.low}
                                renderGroundDecorations={false}
                                stacks={retainedScene.stacks}
                            />
                        </group>
                        <BlockInteractionLayer
                            scene={retainedScene}
                            controlsEnabled
                            sharedControllerEnabled
                            stacks={retainedScene.stacks}
                        />
                        <GameCameraRig
                            controlsEnabled
                            initialPosition={cameraPosition}
                            initialZoom={zoom}
                        />
                        <BlockOptionsProbe
                            entitiesRootName={entitiesRootName}
                            gardenQueryKey={gardenQueryKey}
                            instancedRootName={instancedRootName}
                        />
                    </BlockInteractionRegistryProvider>
                </ParticleSystemProvider>
            </Scene>
        </SceneBlockDataProvider>
    );
}

const standInStyle: CSSProperties = {
    alignItems: 'center',
    background: 'rgb(255 255 255 / 0.88)',
    border: '1px solid rgb(41 37 36 / 0.16)',
    borderRadius: 12,
    boxShadow: '0 2px 0 rgb(41 37 36 / 0.12)',
    boxSizing: 'border-box',
    color: '#44403c',
    display: 'flex',
    fontSize: 12,
    fontWeight: 600,
    justifyContent: 'center',
    pointerEvents: 'auto',
};

function StandIn({
    width,
    height,
    round = false,
    children,
}: {
    width: number | string;
    height: number;
    round?: boolean;
    children?: ReactNode;
}) {
    return (
        <div
            style={{
                ...standInStyle,
                borderRadius: round ? 9999 : standInStyle.borderRadius,
                height,
                width,
            }}
        >
            {children}
        </div>
    );
}

function SunflowersStandIn() {
    const { data: account } = useCurrentAccount();
    const { data: cart } = useShoppingCart();
    const amount = account?.sunflowers.amount;
    // The figure SunflowersHud shows: the balance minus the cart (OPEN-4).
    const balance =
        typeof amount === 'number'
            ? amount - (cart?.totalSunflowers ?? 0)
            : null;

    return (
        <StandIn width={112} height={40} round>
            <span data-block-options-fixture-balance={balance ?? ''}>
                🌻 {balance ?? '…'}
            </span>
        </StandIn>
    );
}

/**
 * Stand-ins for the `GameHud` regions the pop-up avoids (`data-game-hud-*`),
 * sized like the real controls. The regions use `GameHud`'s own layout
 * classes, so they stack on phones and spread out on wide screens as the
 * game does.
 */
function BlockOptionsFixtureHudRegions({ economy }: { economy: boolean }) {
    return (
        <div aria-hidden="true">
            <div
                data-game-hud-top-left
                className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex flex-col items-start gap-2"
            >
                <StandIn width={196} height={44} round>
                    Vrt
                </StandIn>
                <StandIn width={92} height={40}>
                    Alati
                </StandIn>
            </div>
            <div
                data-game-hud-top-right
                className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] flex items-end flex-col-reverse gap-1 md:flex-row md:gap-2"
            >
                <StandIn width={64} height={40} round>
                    Vrijeme
                </StandIn>
                {economy ? <SunflowersStandIn /> : null}
            </div>
            {economy ? (
                <div
                    data-game-hud-bottom-right
                    className="pointer-events-none absolute right-[calc(var(--game-safe-area-right,0px)+0.5rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] z-40"
                >
                    <StandIn width={56} height={56} round>
                        💬
                    </StandIn>
                </div>
            ) : null}
            <div className={gameHudBottomBarClassName}>
                <div
                    data-game-hud-bottom-controls
                    className={gameHudBottomControlsClassName}
                    style={{ gap: 4 }}
                >
                    {['Kamera', 'Zvuk', 'Foto', 'Pomoć'].map((label) => (
                        <StandIn key={label} width={40} height={40} round>
                            {label.slice(0, 1)}
                        </StandIn>
                    ))}
                </div>
                <div
                    data-game-hud-bottom-items
                    className={gameHudBottomItemsClassName}
                    style={{ paddingBottom: 8 }}
                >
                    <StandIn width="min(320px, calc(100% - 144px))" height={72}>
                        Predmeti
                    </StandIn>
                </div>
            </div>
        </div>
    );
}
