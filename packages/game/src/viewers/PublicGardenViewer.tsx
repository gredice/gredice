'use client';

import type { PublicGardenResponse } from '@gredice/client';
import {
    defaultGameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import { cx } from '@gredice/ui/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { useBlockData } from '../hooks/useBlockData';
import { currentGardenKeys } from '../hooks/useCurrentGarden';
import { useDeferredSceneDetails } from '../hooks/useDeferredSceneDetails';
import { useGardensKeys } from '../hooks/useGardens';
import { ParticleSystemProvider } from '../particles/ParticleSystem';
import { Environment } from '../scene/Environment';
import { resolveGameQualityProfile } from '../scene/gameQuality';
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
import { PublicGardenRaisedBedDetails } from './PublicGardenRaisedBedDetails';
import { PublicGardenRaisedBedInteractions } from './PublicGardenRaisedBedInteractions';
import { PublicGardenRaisedBedPicker } from './PublicGardenRaisedBedPicker';

export type PublicGardenBlock = Block;

export type PublicGardenStack = {
    x: number;
    y: number;
    blocks: PublicGardenBlock[];
};

export type PublicGardenDetail = PublicGardenResponse;

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
};

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
    enableBlockGeometryMerging,
    initialView,
    className,
    garden,
    gardenCacheReady,
    normalizedStacks,
    onSelectRaisedBedBlock,
    renderDetails,
}: {
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
    const qualityProfile = useMemo(() => resolveGameQualityProfile(), []);
    const renderLivingDetails = renderDetails && gardenCacheReady;

    return (
        <div className={cx('relative h-full w-full', className)}>
            {blockDataLoaded && gardenCacheReady ? (
                <Scene
                    position={initialView.cameraPosition}
                    quality={qualityProfile}
                    zoom={initialView.cameraZoom}
                    className="h-full w-full"
                >
                    <ParticleSystemProvider>
                        <BlockInteractionRegistryProvider>
                            <Environment
                                noSound
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
                                    <PublicGardenRaisedBedInteractions
                                        onSelect={onSelectRaisedBedBlock}
                                        stacks={normalizedStacks}
                                    />
                                    <BlockInteractionLayer
                                        controlsEnabled
                                        stacks={normalizedStacks}
                                    />
                                    {renderLivingDetails && (
                                        <Suspense fallback={null}>
                                            <Birds stacks={normalizedStacks} />
                                        </Suspense>
                                    )}
                                    {renderLivingDetails && (
                                        <Suspense fallback={null}>
                                            <Cats
                                                farmId={garden?.farmId}
                                                stacks={normalizedStacks}
                                            />
                                        </Suspense>
                                    )}
                                    {renderLivingDetails && (
                                        <Suspense fallback={null}>
                                            <Dogs
                                                farmId={garden?.farmId}
                                                stacks={normalizedStacks}
                                            />
                                        </Suspense>
                                    )}
                                    {renderLivingDetails && garden && (
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
                                controlsEnabled
                                initialSnapshot={
                                    garden?.homeCamera ?? undefined
                                }
                                initialTarget={initialView.cameraTarget}
                                initialViewKey={garden?.id ?? 'stacks'}
                            />
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
    spriteBaseUrl,
    enableBlockGeometryMerging = false,
    deferDetails = true,
    garden,
    stacks,
    className,
}: PublicGardenViewerProps) {
    const resolvedAppBaseUrl = appBaseUrl || 'https://vrt.gredice.com';
    const resolvedSpriteBaseUrl = spriteBaseUrl ?? resolvedAppBaseUrl;
    const initialTimeLocation = publicGardenTimeLocation(garden);
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: resolvedAppBaseUrl,
            spriteBaseUrl: resolvedSpriteBaseUrl,
            freezeTime: null,
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
                <GameSceneDetailContext.Provider value={{ renderDetails }}>
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
                                {gameGarden ? (
                                    <PublicGardenRaisedBedPicker
                                        onSelect={openRaisedBed}
                                        raisedBeds={selectableRaisedBeds}
                                    />
                                ) : null}
                                {selectedRaisedBed ? (
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
