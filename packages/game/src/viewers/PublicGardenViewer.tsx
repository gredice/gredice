'use client';

import type { PublicGardenResponse } from '@gredice/client';
import {
    defaultGameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import { cx } from '@gredice/ui/utils';
import { OrbitControls } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    type HTMLAttributes,
    type ReactNode,
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { MOUSE, Vector3 } from 'three';
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

export type PublicGardenBlock = Block;

export type PublicGardenStack = {
    x: number;
    y: number;
    blocks: PublicGardenBlock[];
};

export type PublicGardenDetail = PublicGardenResponse;

export type PublicGardenViewerProps = HTMLAttributes<HTMLDivElement> & {
    garden?: PublicGardenDetail;
    stacks?: PublicGardenStack[];
    appBaseUrl?: string;
    spriteBaseUrl?: string;
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
        farmId: garden.farmId,
        stacks: normalizedStacks,
        location: {
            lat: garden.latitude,
            lon: garden.longitude,
        },
        raisedBeds: garden.raisedBeds,
    };
}

function PublicGardenScene({
    cameraPosition,
    className,
    garden,
    gardenCacheReady,
    normalizedStacks,
    renderDetails,
    sceneCenter,
}: {
    cameraPosition: Vector3;
    className?: string;
    garden?: ReturnType<typeof publicGardenForGameState>;
    gardenCacheReady: boolean;
    normalizedStacks: Stack[];
    renderDetails: boolean;
    sceneCenter: Vector3;
}) {
    const blockDataQuery = useBlockData();
    const blockDataLoaded = Boolean(blockDataQuery.data);
    const qualityProfile = useMemo(() => resolveGameQualityProfile(), []);
    const renderLivingDetails = renderDetails && gardenCacheReady;

    return (
        <div className={cx('relative h-full w-full', className)}>
            {blockDataLoaded && gardenCacheReady ? (
                <Scene
                    position={cameraPosition}
                    quality={qualityProfile}
                    zoom={90}
                    className="h-full w-full"
                >
                    <ParticleSystemProvider>
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
                                            noRenderInView={instancedBlockNames}
                                            noControl
                                        />
                                    )),
                                )}
                                <EntityInstances
                                    quality={qualityProfile}
                                    renderGroundDecorations={
                                        renderLivingDetails
                                    }
                                    stacks={normalizedStacks}
                                    renderDetails={renderLivingDetails}
                                />
                                {renderLivingDetails && (
                                    <Suspense fallback={null}>
                                        <Birds stacks={normalizedStacks} />
                                    </Suspense>
                                )}
                                {renderLivingDetails && (
                                    <Suspense fallback={null}>
                                        <Cats stacks={normalizedStacks} />
                                    </Suspense>
                                )}
                                {renderLivingDetails && (
                                    <Suspense fallback={null}>
                                        <Dogs stacks={normalizedStacks} />
                                    </Suspense>
                                )}
                                {renderLivingDetails && garden && (
                                    <Suspense fallback={null}>
                                        <Bees
                                            garden={garden}
                                            groundDecorationDensity={
                                                qualityProfile.groundDecorationDensity
                                            }
                                        />
                                    </Suspense>
                                )}
                            </group>
                        </Suspense>
                        <OrbitControls
                            enableDamping
                            enableRotate={false}
                            screenSpacePanning={false}
                            enablePan
                            minZoom={50}
                            maxZoom={500}
                            target={sceneCenter}
                            mouseButtons={{
                                LEFT: MOUSE.PAN,
                                MIDDLE: MOUSE.DOLLY,
                                RIGHT: MOUSE.PAN,
                            }}
                        />
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
    deferDetails = true,
    garden,
    stacks,
    className,
}: PublicGardenViewerProps) {
    const resolvedAppBaseUrl = appBaseUrl || 'https://vrt.gredice.com';
    const resolvedSpriteBaseUrl = spriteBaseUrl ?? resolvedAppBaseUrl;
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: resolvedAppBaseUrl,
            spriteBaseUrl: resolvedSpriteBaseUrl,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: false,
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
    const sceneCenter = useMemo(
        () => getPublicGardenStacksCenter(normalizedStacks),
        [normalizedStacks],
    );
    const cameraPosition = useMemo(
        () =>
            new Vector3(
                sceneCenter.x - 100,
                sceneCenter.y + 100,
                sceneCenter.z - 100,
            ),
        [sceneCenter],
    );
    const renderDetails = useDeferredSceneDetails(deferDetails);
    const cacheKey = getPublicGardenCacheKey(garden);

    useEffect(() => {
        storeRef.current
            ?.getState()
            .setBackgroundPaletteKey(gameGarden?.backgroundPalette);
    }, [gameGarden?.backgroundPalette]);

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
                            <PublicGardenScene
                                cameraPosition={cameraPosition}
                                className={className}
                                garden={gameGarden}
                                gardenCacheReady={gardenCacheReady}
                                normalizedStacks={normalizedStacks}
                                renderDetails={renderDetails}
                                sceneCenter={sceneCenter}
                            />
                        )}
                    </SeedPublicGardenQueryCache>
                </GameSceneDetailContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
