'use client';

import type { PublicGardenResponse } from '@gredice/client';
import {
    defaultGameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import { cx } from '@gredice/ui/utils';
import {
    QueryClient,
    QueryClientProvider,
    useIsFetching,
} from '@tanstack/react-query';
import {
    type HTMLAttributes,
    type ReactNode,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Vector3 } from 'three';
import { BlockInteractionLayer } from '../controls/BlockInteractionLayer';
import { BlockInteractionRegistryProvider } from '../controls/BlockInteractionRegistry';
import { GameCameraRig } from '../controls/GameCameraRig';
import { Bees } from '../entities/bees/Bees';
import { Birds } from '../entities/birds/Birds';
import { Cats } from '../entities/cats/Cats';
import { Dogs } from '../entities/dogs/Dogs';
import { EntityFactory } from '../entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from '../entities/EntityInstances';
import { RaisedBedMulchOverlays } from '../entities/raisedBed/RaisedBedMulchOverlays';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { useBlockData } from '../hooks/useBlockData';
import { currentGardenKeys } from '../hooks/useCurrentGarden';
import { useDeferredSceneDetails } from '../hooks/useDeferredSceneDetails';
import { useGardensKeys } from '../hooks/useGardens';
import { useAllSorts } from '../hooks/usePlantSorts';
import { ParticleSystemProvider } from '../particles/ParticleSystem';
import { Environment } from '../scene/Environment';
import {
    type GameQualityProfile,
    gameQualityProfiles,
    resolveGameQualityProfile,
} from '../scene/gameQuality';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import type { GameLocation } from '../utils/timeOfDay';
import { PublicGardenCaptureProbe } from './PublicGardenCaptureProbe';
import { PublicGardenRaisedBedDetails } from './PublicGardenRaisedBedDetails';
import { PublicGardenRaisedBedInteractions } from './PublicGardenRaisedBedInteractions';
import { PublicGardenRaisedBedPicker } from './PublicGardenRaisedBedPicker';

export type PublicGardenBlock = Block;

export type PublicGardenStack = {
    x: number;
    y: number;
    blocks: PublicGardenBlock[];
};

export type PublicGardenDetail = Pick<
    PublicGardenResponse,
    | 'backgroundPalette'
    | 'farmId'
    | 'homeCamera'
    | 'id'
    | 'isPublic'
    | 'isSandbox'
    | 'latitude'
    | 'longitude'
    | 'name'
    | 'raisedBeds'
    | 'stacks'
    | 'updatedAt'
>;

type PublicGardenHomeCamera = NonNullable<PublicGardenDetail['homeCamera']>;

export type PublicGardenInitialView = {
    cameraPosition: Vector3;
    cameraTarget: Vector3;
    cameraZoom: number;
};

export type PublicGardenViewerProps = HTMLAttributes<HTMLDivElement> & {
    garden?: PublicGardenDetail;
    stacks?: PublicGardenStack[];
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    enableBlockGeometryMerging?: boolean;
    deferDetails?: boolean;
    className?: string;
    capture?: {
        key: string;
        onCapture: (blob: Blob) => void;
        onError: (error: Error) => void;
    };
};

const publicGardenCaptureQuality = {
    ...gameQualityProfiles.high,
    dpr: 1,
    shadowMapSize: 2048,
    tier: 'custom',
} satisfies GameQualityProfile;
const publicGardenCaptureSceneTimeSeconds = 2.5;

function getPublicGardenCaptureDate() {
    const now = new Date();
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10),
    );
}

export function normalizePublicGardenStacks(
    stacks: PublicGardenStack[],
): Stack[] {
    return stacks.map((stack) => ({
        position: new Vector3(stack.x, 0, stack.y),
        blocks: stack.blocks,
    }));
}

export function publicGardenStacksFromResponse(
    stacks: PublicGardenDetail['stacks'],
): PublicGardenStack[] {
    return Object.entries(stacks).flatMap(([x, rows]) =>
        Object.entries(rows).map(([y, blocks]) => ({
            x: Number(x),
            y: Number(y),
            blocks: blocks.map((block) => ({
                id: block.id,
                name: block.name,
                rotation: block.rotation ?? 0,
                variant: block.variant,
            })),
        })),
    );
}

export function getPublicGardenRaisedBedsWithBlocks<
    TRaisedBed extends { blockId?: string | null },
>(raisedBeds: TRaisedBed[], stacks: Stack[]) {
    const renderedBlockIds = new Set(
        stacks.flatMap((stack) => stack.blocks.map((block) => block.id)),
    );

    return raisedBeds.filter(
        (raisedBed) =>
            typeof raisedBed.blockId === 'string' &&
            renderedBlockIds.has(raisedBed.blockId),
    );
}

export function getPublicGardenStacksCenter(stacks: Stack[]) {
    if (stacks.length === 0) {
        return new Vector3(0, 0, 0);
    }

    const bounds = stacks.reduce(
        (acc, stack) => ({
            maxX: Math.max(acc.maxX, stack.position.x),
            maxZ: Math.max(acc.maxZ, stack.position.z),
            minX: Math.min(acc.minX, stack.position.x),
            minZ: Math.min(acc.minZ, stack.position.z),
        }),
        {
            maxX: Number.NEGATIVE_INFINITY,
            maxZ: Number.NEGATIVE_INFINITY,
            minX: Number.POSITIVE_INFINITY,
            minZ: Number.POSITIVE_INFINITY,
        },
    );

    return new Vector3(
        (bounds.minX + bounds.maxX) / 2,
        0,
        (bounds.minZ + bounds.maxZ) / 2,
    );
}

export function getPublicGardenInitialView({
    homeCamera,
    stacks,
}: {
    homeCamera?: PublicGardenHomeCamera | null;
    stacks: Stack[];
}): PublicGardenInitialView {
    if (homeCamera) {
        return {
            cameraPosition: new Vector3(...homeCamera.position),
            cameraTarget: new Vector3(...homeCamera.target),
            cameraZoom: homeCamera.zoom,
        };
    }

    const sceneCenter = getPublicGardenStacksCenter(stacks);

    return {
        cameraPosition: new Vector3(
            sceneCenter.x - 100,
            sceneCenter.y + 100,
            sceneCenter.z - 100,
        ),
        cameraTarget: sceneCenter,
        cameraZoom: 90,
    };
}

function normalizePublicGardenBackgroundPalette(value: unknown) {
    return isGameBackgroundPaletteKey(value)
        ? value
        : defaultGameBackgroundPaletteKey;
}

function getPublicGardenCacheKey(garden: PublicGardenDetail | undefined) {
    if (!garden) {
        return 'stacks-only';
    }

    return `${garden.id.toString()}:${garden.updatedAt ?? ''}`;
}

function publicGardenForGameState(
    garden: PublicGardenDetail,
    normalizedStacks: Stack[],
) {
    return {
        id: garden.id,
        name: garden.name,
        isSandbox: garden.isSandbox,
        isPublic: garden.isPublic,
        backgroundPalette: normalizePublicGardenBackgroundPalette(
            garden.backgroundPalette,
        ),
        homeCamera: garden.homeCamera ?? null,
        farmId: garden.farmId,
        stacks: normalizedStacks,
        location: {
            lat: garden.latitude,
            lon: garden.longitude,
        },
        raisedBeds: garden.raisedBeds,
    };
}

function publicGardenTimeLocation(
    garden: PublicGardenDetail | undefined,
): GameLocation | undefined {
    if (!garden) {
        return undefined;
    }

    if (
        !Number.isFinite(garden.latitude) ||
        !Number.isFinite(garden.longitude)
    ) {
        return undefined;
    }

    return {
        lat: garden.latitude,
        lon: garden.longitude,
    };
}

function PublicGardenScene({
    capture,
    enableBlockGeometryMerging,
    initialView,
    className,
    garden,
    gardenCacheReady,
    normalizedStacks,
    onSelectRaisedBedBlock,
    renderDetails,
}: {
    capture?: PublicGardenViewerProps['capture'];
    enableBlockGeometryMerging: boolean;
    initialView: PublicGardenInitialView;
    className?: string;
    garden?: ReturnType<typeof publicGardenForGameState>;
    gardenCacheReady: boolean;
    normalizedStacks: Stack[];
    onSelectRaisedBedBlock: (blockId: string) => void;
    renderDetails: boolean;
}) {
    const blockDataQuery = useBlockData();
    const blockDataLoaded = Boolean(blockDataQuery.data);
    const plantSortsQuery = useAllSorts();
    const plantSortsLoaded = Boolean(plantSortsQuery.data);
    const fetchingQueryCount = useIsFetching();
    const qualityProfile = useMemo(
        () =>
            capture ? publicGardenCaptureQuality : resolveGameQualityProfile(),
        [capture],
    );
    const renderLivingDetails = renderDetails && gardenCacheReady;
    const renderTransientDetails = renderLivingDetails && !capture;

    return (
        <div
            className={cx('relative h-full w-full', className)}
            data-public-garden-capture-blocks-ready={
                capture ? blockDataLoaded : undefined
            }
            data-public-garden-capture-cache-ready={
                capture ? gardenCacheReady : undefined
            }
            data-public-garden-capture-fetching={
                capture ? fetchingQueryCount : undefined
            }
            data-public-garden-capture-plants-ready={
                capture ? plantSortsLoaded : undefined
            }
        >
            {blockDataLoaded && gardenCacheReady ? (
                <Scene
                    fixedTimeSeconds={
                        capture
                            ? publicGardenCaptureSceneTimeSeconds
                            : undefined
                    }
                    pixelRatio={capture ? 1 : undefined}
                    position={initialView.cameraPosition}
                    quality={qualityProfile}
                    rendererOptions={
                        capture ? { preserveDrawingBuffer: true } : undefined
                    }
                    zoom={initialView.cameraZoom}
                    className="h-full w-full"
                >
                    <ParticleSystemProvider>
                        <BlockInteractionRegistryProvider>
                            <Environment
                                noSound
                                noWeather={Boolean(capture)}
                                quality={qualityProfile}
                                weather={undefined}
                            />
                            <Suspense fallback={null}>
                                <group name="PublicGardenScene:Entities">
                                    {normalizedStacks.map((stack) =>
                                        stack.blocks.map((block) => (
                                            <EntityFactory
                                                key={`${stack.position.x}|${stack.position.z}|${block.id}-${block.name}`}
                                                name={block.name}
                                                stack={stack}
                                                block={block}
                                                stacks={normalizedStacks}
                                                rotation={block.rotation}
                                                variant={block.variant}
                                                noRenderInView={
                                                    instancedBlockNames
                                                }
                                                noControl
                                            />
                                        )),
                                    )}
                                    <EntityInstances
                                        enableBlockGeometryMerging={
                                            enableBlockGeometryMerging
                                        }
                                        farmId={garden?.farmId}
                                        quality={qualityProfile}
                                        renderGroundDecorations={
                                            renderLivingDetails
                                        }
                                        stacks={normalizedStacks}
                                        renderDetails={renderLivingDetails}
                                    />
                                    {renderLivingDetails && garden ? (
                                        <Suspense fallback={null}>
                                            <RaisedBedMulchOverlays
                                                quality={qualityProfile}
                                            />
                                        </Suspense>
                                    ) : null}
                                    {!capture ? (
                                        <>
                                            <PublicGardenRaisedBedInteractions
                                                onSelect={
                                                    onSelectRaisedBedBlock
                                                }
                                                stacks={normalizedStacks}
                                            />
                                            <BlockInteractionLayer
                                                controlsEnabled
                                                stacks={normalizedStacks}
                                            />
                                        </>
                                    ) : null}
                                    {renderTransientDetails && (
                                        <Suspense fallback={null}>
                                            <Birds stacks={normalizedStacks} />
                                        </Suspense>
                                    )}
                                    {renderTransientDetails && (
                                        <Suspense fallback={null}>
                                            <Cats
                                                farmId={garden?.farmId}
                                                stacks={normalizedStacks}
                                            />
                                        </Suspense>
                                    )}
                                    {renderTransientDetails && (
                                        <Suspense fallback={null}>
                                            <Dogs
                                                farmId={garden?.farmId}
                                                stacks={normalizedStacks}
                                            />
                                        </Suspense>
                                    )}
                                    {renderTransientDetails && garden && (
                                        <Suspense fallback={null}>
                                            <Bees
                                                farmId={garden.farmId}
                                                garden={garden}
                                                groundDecorationDensity={
                                                    qualityProfile.groundDecorationDensity
                                                }
                                            />
                                        </Suspense>
                                    )}
                                </group>
                            </Suspense>
                            <GameCameraRig
                                controlsEnabled={!capture}
                                initialPosition={initialView.cameraPosition}
                                initialSnapshot={
                                    garden?.homeCamera ?? undefined
                                }
                                initialTarget={initialView.cameraTarget}
                                initialViewKey={garden?.id ?? 'stacks'}
                                initialZoom={initialView.cameraZoom}
                            />
                            {capture ? (
                                <PublicGardenCaptureProbe
                                    key={capture.key}
                                    enabled={
                                        renderLivingDetails && plantSortsLoaded
                                    }
                                    onCapture={capture.onCapture}
                                    onError={capture.onError}
                                    queriesIdle={fetchingQueryCount === 0}
                                />
                            ) : null}
                        </BlockInteractionRegistryProvider>
                    </ParticleSystemProvider>
                </Scene>
            ) : (
                <div className="h-full w-full bg-[#d9f2dc]" />
            )}
        </div>
    );
}

function SeedPublicGardenQueryCache({
    cacheKey,
    children,
    client,
    garden,
}: {
    cacheKey: string;
    children: (gardenCacheReady: boolean) => ReactNode;
    client: QueryClient;
    garden?: ReturnType<typeof publicGardenForGameState>;
}) {
    const [seededCacheKey, setSeededCacheKey] = useState<string | null>(
        garden ? null : cacheKey,
    );

    useEffect(() => {
        if (!garden) {
            setSeededCacheKey(cacheKey);
            return;
        }

        client.setQueryData(useGardensKeys, [
            {
                id: garden.id,
                name: garden.name,
                isSandbox: garden.isSandbox,
                isPublic: garden.isPublic,
            },
        ]);
        client.setQueryData(
            currentGardenKeys('summer', garden.id, undefined, undefined),
            garden,
        );
        setSeededCacheKey(cacheKey);
    }, [cacheKey, client, garden]);

    return children(seededCacheKey === cacheKey);
}

export function PublicGardenViewer({
    appBaseUrl,
    capture,
    spriteBaseUrl,
    enableBlockGeometryMerging = false,
    deferDetails = true,
    garden,
    stacks,
    className,
}: PublicGardenViewerProps) {
    const resolvedAppBaseUrl = appBaseUrl ?? 'https://vrt.gredice.com';
    const resolvedSpriteBaseUrl = spriteBaseUrl ?? resolvedAppBaseUrl;
    const initialTimeLocation = publicGardenTimeLocation(garden);
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: resolvedAppBaseUrl,
            spriteBaseUrl: resolvedSpriteBaseUrl,
            freezeTime: capture ? getPublicGardenCaptureDate() : null,
            isMock: false,
            timeLocation: initialTimeLocation,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    const clientRef = useRef<QueryClient>(null);
    if (!clientRef.current) {
        clientRef.current = new QueryClient();
    }
    useEffect(() => {
        const client = clientRef.current;
        return () => client?.clear();
    }, []);
    const publicStacks = useMemo(
        () =>
            garden
                ? publicGardenStacksFromResponse(garden.stacks)
                : (stacks ?? []),
        [garden, stacks],
    );
    const normalizedStacks = useMemo(
        () => normalizePublicGardenStacks(publicStacks),
        [publicStacks],
    );
    const gameGarden = useMemo(
        () =>
            garden
                ? publicGardenForGameState(garden, normalizedStacks)
                : undefined,
        [garden, normalizedStacks],
    );
    const selectableRaisedBeds = useMemo(
        () =>
            gameGarden
                ? getPublicGardenRaisedBedsWithBlocks(
                      gameGarden.raisedBeds,
                      normalizedStacks,
                  )
                : [],
        [gameGarden, normalizedStacks],
    );
    const initialView = useMemo(
        () =>
            getPublicGardenInitialView({
                homeCamera: garden?.homeCamera,
                stacks: normalizedStacks,
            }),
        [garden?.homeCamera, normalizedStacks],
    );
    const renderDetails = useDeferredSceneDetails(deferDetails);
    const cacheKey = getPublicGardenCacheKey(garden);
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<
        number | null
    >(null);
    const selectedRaisedBed = gameGarden?.raisedBeds.find(
        (raisedBed) => raisedBed.id === selectedRaisedBedId,
    );

    const openRaisedBed = useCallback(
        (raisedBedId: number) => {
            if (!gameGarden) {
                return;
            }

            const raisedBed = gameGarden.raisedBeds.find(
                (candidate) => candidate.id === raisedBedId,
            );
            if (!raisedBed?.blockId) {
                return;
            }

            const block = gameGarden.stacks
                .flatMap((stack) => stack.blocks)
                .find((candidate) => candidate.id === raisedBed.blockId);
            if (!block) {
                return;
            }

            setSelectedRaisedBedId(raisedBed.id);
            storeRef.current?.getState().setView({
                view: 'closeup',
                block,
            });
        },
        [gameGarden],
    );

    const openRaisedBedByBlockId = useCallback(
        (blockId: string) => {
            const raisedBed = findRaisedBedByBlockId(gameGarden, blockId);
            if (raisedBed) {
                openRaisedBed(raisedBed.id);
            }
        },
        [gameGarden, openRaisedBed],
    );

    const closeRaisedBed = useCallback(() => {
        setSelectedRaisedBedId(null);
        storeRef.current?.getState().setView({ view: 'normal' });
    }, []);

    useEffect(() => {
        storeRef.current
            ?.getState()
            .setBackgroundPaletteKey(gameGarden?.backgroundPalette);
    }, [gameGarden?.backgroundPalette]);

    useEffect(() => {
        if (gameGarden?.id === undefined) {
            setSelectedRaisedBedId(null);
            storeRef.current?.getState().setView({ view: 'normal' });
            return;
        }

        setSelectedRaisedBedId(null);
        storeRef.current?.getState().setView({ view: 'normal' });
    }, [gameGarden?.id]);

    return (
        <QueryClientProvider client={clientRef.current}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameSceneDetailContext.Provider
                    value={{
                        includePendingCartPlants: false,
                        renderDetails,
                    }}
                >
                    <SeedPublicGardenQueryCache
                        cacheKey={cacheKey}
                        client={clientRef.current}
                        garden={gameGarden}
                    >
                        {(gardenCacheReady) => (
                            <div
                                className={cx(
                                    'relative h-full w-full',
                                    className,
                                )}
                            >
                                <PublicGardenScene
                                    capture={capture}
                                    className="size-full"
                                    enableBlockGeometryMerging={
                                        enableBlockGeometryMerging
                                    }
                                    garden={gameGarden}
                                    gardenCacheReady={gardenCacheReady}
                                    initialView={initialView}
                                    normalizedStacks={normalizedStacks}
                                    onSelectRaisedBedBlock={
                                        openRaisedBedByBlockId
                                    }
                                    renderDetails={renderDetails}
                                />
                                {gameGarden && !capture ? (
                                    <PublicGardenRaisedBedPicker
                                        onSelect={openRaisedBed}
                                        raisedBeds={selectableRaisedBeds}
                                    />
                                ) : null}
                                {selectedRaisedBed && !capture ? (
                                    <PublicGardenRaisedBedDetails
                                        key={selectedRaisedBed.id}
                                        onClose={closeRaisedBed}
                                        raisedBed={selectedRaisedBed}
                                    />
                                ) : null}
                            </div>
                        )}
                    </SeedPublicGardenQueryCache>
                </GameSceneDetailContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
