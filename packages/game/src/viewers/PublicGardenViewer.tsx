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
    createContext,
    type HTMLAttributes,
    type ReactNode,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { type Group, Vector3 } from 'three';
import { BlockInteractionLayer } from '../controls/BlockInteractionLayer';
import { BlockInteractionRegistryProvider } from '../controls/BlockInteractionRegistry';
import {
    type GameCameraCloseupFocus,
    GameCameraRig,
} from '../controls/GameCameraRig';
import { GardenAvatar } from '../entities/avatar/GardenAvatar';
import { GardenVisitorAvatar } from '../entities/avatar/GardenVisitorAvatar';
import type { GardenAvatarInteractionResult } from '../entities/avatar/gardenAvatarInteractions';
import type { GardenAvatarPoint } from '../entities/avatar/gardenAvatarMovement';
import type { GardenVisitorPresenceController } from '../entities/avatar/gardenVisitorPresence';
import { Bats } from '../entities/bats/Bats';
import { Bees } from '../entities/bees/Bees';
import { Birds } from '../entities/birds/Birds';
import { Butterflies } from '../entities/butterflies/Butterflies';
import { Cats } from '../entities/cats/Cats';
import { Dogs } from '../entities/dogs/Dogs';
import { EntityFactory } from '../entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from '../entities/EntityInstances';
import { Chickens, Piglets, Sheep } from '../entities/farmAnimals/FarmAnimals';
import { Frogs } from '../entities/frogs/Frogs';
import { Ladybugs } from '../entities/ladybugs/Ladybugs';
import { RaisedBedMulchOverlays } from '../entities/raisedBed/RaisedBedMulchOverlays';
import { Slugs } from '../entities/slugs/Slugs';
import { Squirrels } from '../entities/squirrels/Squirrels';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { useBlockData } from '../hooks/useBlockData';
import { currentGardenKeys } from '../hooks/useCurrentGarden';
import { useDeferredSceneDetails } from '../hooks/useDeferredSceneDetails';
import { useGardensKeys } from '../hooks/useGardens';
import { useAllSorts } from '../hooks/usePlantSorts';
import { GardenAvatarHud } from '../hud/GardenAvatarHud';
import { ParticleSystemProvider } from '../particles/ParticleSystem';
import { Environment } from '../scene/Environment';
import {
    type GameQualityProfile,
    gameQualityProfiles,
    resolveGameQualityProfile,
} from '../scene/gameQuality';
import { Scene } from '../scene/Scene';
import { GardenStructureSceneLayerDynamic } from '../structures/GardenStructureSceneLayerDynamic';
import {
    createGardenStructureSceneBaseHeightResolver,
    type GardenStructureSceneDiagnosticStatus,
    useGardenStructureSceneSnapshot,
} from '../structures/gardenStructureScene';
import type { GardenStructureHorizontalBounds } from '../structures/structurePlanTypes';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    type GardenAvatarView,
    useDisposeGameStateStore,
    useGameState,
} from '../useGameState';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import {
    createDateForGameTimeOfDay,
    defaultGameLocation,
    type GameLocation,
} from '../utils/timeOfDay';
import { PublicGardenBlockInteractions } from './PublicGardenBlockInteractions';
import {
    type PublicGardenCaptureOutput,
    PublicGardenCaptureProbe,
} from './PublicGardenCaptureProbe';
import { PublicGardenRaisedBedDetails } from './PublicGardenRaisedBedDetails';
import { PublicGardenRaisedBedInteractions } from './PublicGardenRaisedBedInteractions';
import { PublicGardenRaisedBedPicker } from './PublicGardenRaisedBedPicker';
import type { PublicGardenRaisedBed } from './publicGardenRaisedBedDetailsModel';

export type PublicGardenBlock = Block;

const PublicGardenVisualOccludersContext = createContext<Group | null>(null);

export function usePublicGardenVisualOccluders() {
    return useContext(PublicGardenVisualOccludersContext);
}

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
    | 'structures'
    | 'updatedAt'
>;

type PublicGardenHomeCamera = NonNullable<PublicGardenDetail['homeCamera']>;

export type PublicGardenInitialView = {
    cameraPosition: Vector3;
    cameraTarget: Vector3;
    cameraZoom: number;
};

export type PublicGardenCaptureViewport = {
    height: number;
    width: number;
};

export type PublicGardenCapturePhase = 'morning' | 'day' | 'evening' | 'night';

type PublicGardenStructureFramingEntry = Readonly<{
    footprint: Readonly<{
        bounds: GardenStructureHorizontalBounds;
    }>;
    structureId: string;
}>;

export type PublicGardenCapture = {
    fitGarden?: boolean;
    fitGardenPadding?: number;
    key: string;
    onCapture: (blob: Blob) => void;
    onError: (error: Error) => void;
    output?: PublicGardenCaptureOutput;
    phase?: PublicGardenCapturePhase;
    transparent?: boolean;
};

export type PublicGardenSelectedBlockFocus = GameCameraCloseupFocus;

export type PublicGardenViewerProps = HTMLAttributes<HTMLDivElement> & {
    garden?: PublicGardenDetail;
    stacks?: PublicGardenStack[];
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    cameraMinZoom?: number;
    fixedTime?: Date;
    initialView?: PublicGardenInitialView;
    interactiveBlockIds?: ReadonlySet<string>;
    localVisitorActivationRequest?: number;
    localVisitorSpawnPoint?: Pick<GardenAvatarPoint, 'x' | 'z'>;
    selectedBlockId?: string | null;
    selectedBlockFocus?: PublicGardenSelectedBlockFocus;
    onSelectBlock?: (blockId: string) => void;
    onLocalVisitorViewChange?: (view: GardenAvatarView) => void;
    onSceneContextLost?: () => void;
    onSceneReady?: () => void;
    noControls?: boolean;
    noSound?: boolean;
    noWeather?: boolean;
    overlayChildren?: ReactNode;
    renderDetails?: boolean;
    renderGroundDecorations?: boolean;
    sceneChildren?: ReactNode;
    deferDetails?: boolean;
    className?: string;
    capture?: PublicGardenCapture;
    visitorPresence?: GardenVisitorPresenceController;
};

const publicGardenCaptureQuality = {
    ...gameQualityProfiles.high,
    dpr: 1,
    shadowMapSize: 2048,
    tier: 'custom',
} satisfies GameQualityProfile;
const publicGardenCaptureSceneTimeSeconds = 2.5;

const publicGardenWallpaperCaptureQuality = {
    ...gameQualityProfiles.high,
    dpr: 1,
    shadowMapSize: 4096,
    tier: 'custom',
} satisfies GameQualityProfile;

function PublicGardenSceneReady({ onReady }: { onReady: () => void }) {
    useEffect(() => {
        onReady();
    }, [onReady]);

    return null;
}

function PublicGardenAvatarViewReporter({
    onChange,
}: {
    onChange: (view: GardenAvatarView) => void;
}) {
    const view = useGameState((state) => state.gardenAvatarView);

    useEffect(() => {
        onChange(view);
    }, [onChange, view]);

    return null;
}

const publicGardenCaptureTimeOfDay = {
    morning: 0.22,
    day: 0.5,
    evening: 0.79,
    night: 0.94,
} satisfies Record<PublicGardenCapturePhase, number>;

function getPublicGardenCaptureDate() {
    const now = new Date();
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10),
    );
}

export function getPublicGardenCapturePhaseDate(
    phase: PublicGardenCapturePhase,
    location: GameLocation,
) {
    const referenceDate = new Date(2026, 5, 21, 12, 0, 0, 0);
    return createDateForGameTimeOfDay(
        referenceDate,
        publicGardenCaptureTimeOfDay[phase],
        location,
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
                message: block.message,
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

type PublicGardenPlanarBounds = Readonly<{
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
}>;

function getPublicGardenPlanarBounds(
    stacks: Stack[],
    structureBounds?: GardenStructureHorizontalBounds | null,
): PublicGardenPlanarBounds | null {
    const bounds = stacks.reduce(
        (acc, stack) => ({
            maxX: Math.max(acc.maxX, stack.position.x + 0.5),
            maxZ: Math.max(acc.maxZ, stack.position.z + 0.5),
            minX: Math.min(acc.minX, stack.position.x - 0.5),
            minZ: Math.min(acc.minZ, stack.position.z - 0.5),
        }),
        {
            maxX: structureBounds?.maxX ?? Number.NEGATIVE_INFINITY,
            maxZ: structureBounds?.maxY ?? Number.NEGATIVE_INFINITY,
            minX: structureBounds?.minX ?? Number.POSITIVE_INFINITY,
            minZ: structureBounds?.minY ?? Number.POSITIVE_INFINITY,
        },
    );

    return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minZ)
        ? bounds
        : null;
}

export function getPublicGardenStacksCenter(
    stacks: Stack[],
    structureBounds?: GardenStructureHorizontalBounds | null,
) {
    const bounds = getPublicGardenPlanarBounds(stacks, structureBounds);
    if (!bounds) {
        return new Vector3(0, 0, 0);
    }

    return new Vector3(
        (bounds.minX + bounds.maxX) / 2,
        0,
        (bounds.minZ + bounds.maxZ) / 2,
    );
}

export function getPublicGardenInitialView({
    homeCamera,
    stacks,
    structureBounds,
}: {
    homeCamera?: PublicGardenHomeCamera | null;
    stacks: Stack[];
    structureBounds?: GardenStructureHorizontalBounds | null;
}): PublicGardenInitialView {
    if (homeCamera) {
        return {
            cameraPosition: new Vector3(...homeCamera.position),
            cameraTarget: new Vector3(...homeCamera.target),
            cameraZoom: homeCamera.zoom,
        };
    }

    const sceneCenter = getPublicGardenStacksCenter(stacks, structureBounds);

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

export function getPublicGardenCaptureInitialView({
    minimumZoom = 24,
    stacks,
    structureBounds,
    viewport,
}: {
    minimumZoom?: number;
    stacks: Stack[];
    structureBounds?: GardenStructureHorizontalBounds | null;
    viewport: PublicGardenCaptureViewport;
}): PublicGardenInitialView {
    const initialView = getPublicGardenInitialView({
        stacks,
        structureBounds,
    });
    const bounds = getPublicGardenPlanarBounds(stacks, structureBounds);
    if (!bounds || viewport.width < 1 || viewport.height < 1) {
        return initialView;
    }
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    const combinedSpan = spanX + spanZ;

    // The camera views the ground plane at an isometric angle. These
    // projected spans include room for block overhangs and tall plants so
    // compact, elongated, and square gardens stay inside the wallpaper.
    const projectedWidth = combinedSpan / Math.sqrt(2) + 4;
    const projectedHeight = combinedSpan / Math.sqrt(6) + 8;
    const fittedZoom = Math.min(
        viewport.width / projectedWidth,
        viewport.height / projectedHeight,
    );

    return {
        ...initialView,
        cameraZoom: Math.max(minimumZoom, Math.min(180, fittedZoom)),
    };
}

export function resolvePublicGardenSceneInitialView({
    captureFitGarden,
    captureViewport,
    initialView,
    resolveStructureFraming,
    stacks,
    structureBounds,
}: {
    captureFitGarden: boolean;
    captureViewport?: PublicGardenCaptureViewport;
    initialView: PublicGardenInitialView;
    resolveStructureFraming: boolean;
    stacks: Stack[];
    structureBounds?: GardenStructureHorizontalBounds | null;
}) {
    if (!resolveStructureFraming) {
        return initialView;
    }

    if (captureFitGarden && captureViewport) {
        return getPublicGardenCaptureInitialView({
            stacks,
            structureBounds,
            viewport: captureViewport,
        });
    }

    return getPublicGardenInitialView({
        stacks,
        structureBounds,
    });
}

export function getPublicGardenStructureInitialViewKey({
    gardenId,
    structures,
}: {
    gardenId?: number | string | null;
    structures: readonly PublicGardenStructureFramingEntry[];
}) {
    const gardenKey = gardenId == null ? 'stacks' : gardenId.toString();
    const footprintKey = structures
        .map(({ footprint, structureId }) => {
            const { maxX, maxY, minX, minY } = footprint.bounds;
            return `${structureId}:${minX},${minY},${maxX},${maxY}`;
        })
        .sort()
        .join('|');

    return `${gardenKey}:structure-footprints:${footprintKey || 'none'}`;
}

export function isPublicGardenStructureCaptureReady({
    diagnosticStatus,
    hasPlan,
    rejectedRecordCount,
    rendererReady,
    savedStructureCount,
}: {
    diagnosticStatus: GardenStructureSceneDiagnosticStatus;
    hasPlan: boolean;
    rejectedRecordCount: number;
    rendererReady: boolean;
    savedStructureCount: number;
}) {
    return (
        savedStructureCount === 0 ||
        (hasPlan &&
            rendererReady &&
            rejectedRecordCount === 0 &&
            (diagnosticStatus === 'ready' ||
                diagnosticStatus === 'rendered-with-diagnostics'))
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
        homeCamera: garden.homeCamera ?? null,
        farmId: garden.farmId,
        stacks: normalizedStacks,
        structures: garden.structures,
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

export function shouldRenderPublicGardenGroundDecorations(
    renderDetails: boolean,
    renderGroundDecorations: boolean | undefined,
) {
    return renderGroundDecorations ?? renderDetails;
}

function PublicGardenScene({
    cameraMinZoom,
    capture,
    initialView,
    className,
    garden,
    gardenCacheReady,
    interactiveBlockIds,
    initialSnapshot,
    loadPlantSorts,
    localVisitorActivationRequest,
    localVisitorSpawnPoint,
    noControls,
    noSound,
    noWeather,
    normalizedStacks,
    onAvatarInteractBlock,
    onSelectBlock,
    onSelectRaisedBedBlock,
    onSceneContextLost,
    onSceneReady,
    renderDetails,
    renderGroundDecorations,
    resolveStructureFraming,
    sceneChildren,
    selectedBlockFocus,
    visitorPresence,
}: {
    cameraMinZoom?: number;
    capture?: PublicGardenViewerProps['capture'];
    initialView: PublicGardenInitialView;
    className?: string;
    garden?: ReturnType<typeof publicGardenForGameState>;
    gardenCacheReady: boolean;
    interactiveBlockIds?: ReadonlySet<string>;
    initialSnapshot?: PublicGardenHomeCamera;
    loadPlantSorts: boolean;
    localVisitorActivationRequest?: number;
    localVisitorSpawnPoint?: Pick<GardenAvatarPoint, 'x' | 'z'>;
    noControls: boolean;
    noSound: boolean;
    noWeather: boolean;
    normalizedStacks: Stack[];
    onAvatarInteractBlock?: (blockId: string) => void;
    onSelectBlock?: (blockId: string) => void;
    onSelectRaisedBedBlock: (blockId: string) => void;
    onSceneContextLost?: () => void;
    onSceneReady?: () => void;
    renderDetails: boolean;
    renderGroundDecorations?: boolean;
    resolveStructureFraming: boolean;
    sceneChildren?: ReactNode;
    selectedBlockFocus?: PublicGardenSelectedBlockFocus;
    visitorPresence?: GardenVisitorPresenceController;
}) {
    const blockDataQuery = useBlockData();
    const blockDataLoaded = Boolean(blockDataQuery.data);
    const structureBaseHeightResolver = useMemo(
        () =>
            createGardenStructureSceneBaseHeightResolver({
                blockData: blockDataQuery.data,
                records: garden?.structures,
                stacks: normalizedStacks,
            }),
        [blockDataQuery.data, garden?.structures, normalizedStacks],
    );
    const structureScene = useGardenStructureSceneSnapshot({
        gardenId: garden?.id,
        includeCollision: Boolean(visitorPresence),
        records: blockDataLoaded ? garden?.structures : undefined,
        resolveBaseHeight: structureBaseHeightResolver,
    });
    const savedStructureCount = garden?.structures?.length ?? 0;
    const structureBounds = structureScene.plan?.worldBounds;
    const resolvedInitialView = useMemo(
        () =>
            resolvePublicGardenSceneInitialView({
                captureFitGarden: Boolean(capture?.fitGarden),
                captureViewport:
                    capture?.fitGarden &&
                    capture.output?.width &&
                    capture.output.height
                        ? {
                              height: capture.output.height,
                              width: capture.output.width,
                          }
                        : undefined,
                initialView,
                resolveStructureFraming,
                stacks: normalizedStacks,
                structureBounds,
            }),
        [
            capture?.fitGarden,
            capture?.output?.height,
            capture?.output?.width,
            initialView,
            normalizedStacks,
            resolveStructureFraming,
            structureBounds,
        ],
    );
    const initialViewKey = resolveStructureFraming
        ? getPublicGardenStructureInitialViewKey({
              gardenId: garden?.id,
              structures: structureScene.plan?.structures ?? [],
          })
        : (garden?.id ?? 'stacks');
    const structurePlanKey = structureScene.plan?.cacheKey ?? null;
    const [readyStructurePlanKey, setReadyStructurePlanKey] = useState<
        string | null
    >(null);
    const structureRendererReady =
        structurePlanKey !== null && readyStructurePlanKey === structurePlanKey;
    const markStructureRendererReady = useCallback(() => {
        if (structurePlanKey !== null) {
            setReadyStructurePlanKey(structurePlanKey);
        }
    }, [structurePlanKey]);
    const structureCaptureReady = isPublicGardenStructureCaptureReady({
        diagnosticStatus: structureScene.diagnostics.status,
        hasPlan: structureScene.plan !== null,
        rejectedRecordCount: structureScene.diagnostics.rejectedRecordCount,
        rendererReady: structureRendererReady,
        savedStructureCount,
    });
    const plantSortsQuery = useAllSorts(loadPlantSorts);
    const plantSortsLoaded = Boolean(plantSortsQuery.data);
    const fetchingQueryCount = useIsFetching();
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);
    const gardenAvatarActive =
        Boolean(visitorPresence) && gardenAvatarView !== 'overview';
    const qualityProfile = useMemo(
        () =>
            capture?.output
                ? publicGardenWallpaperCaptureQuality
                : capture
                  ? publicGardenCaptureQuality
                  : resolveGameQualityProfile(),
        [capture],
    );
    const renderLivingDetails = renderDetails && gardenCacheReady;
    const renderTransientDetails = renderLivingDetails && !capture;
    const [visualOccluders, setVisualOccluders] = useState<Group | null>(null);
    const interactWithAvatarBlock = useCallback(
        (block: Block): GardenAvatarInteractionResult => {
            if (!onAvatarInteractBlock) {
                return 'ignored';
            }
            onAvatarInteractBlock(block.id);
            // Selecting a block opens the offer modal on top of the scene, so
            // the cursor has to come back.
            return 'opened-ui';
        },
        [onAvatarInteractBlock],
    );

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
            data-public-garden-capture-structures-ready={
                capture ? structureCaptureReady : undefined
            }
            data-public-garden-sound={noSound ? 'disabled' : 'enabled'}
            data-garden-structure-collision-status={
                structureScene.collisionWorld
                    ? 'ready'
                    : savedStructureCount > 0
                      ? 'missing'
                      : 'empty'
            }
            data-garden-structure-diagnostic-status={
                structureScene.diagnostics.status
            }
            data-garden-structure-rejected-count={
                structureScene.diagnostics.rejectedRecordCount
            }
            data-garden-structure-rendered-count={
                structureScene.plan?.structures.length ?? 0
            }
            data-garden-structure-first-id={
                structureScene.plan?.structures[0]?.structureId
            }
            data-garden-structure-warning-count={
                structureScene.diagnostics.warningCount
            }
        >
            {blockDataLoaded ? (
                <Scene
                    baseFramesPerSecond={capture ? 0 : undefined}
                    fixedTimeSeconds={
                        capture
                            ? publicGardenCaptureSceneTimeSeconds
                            : undefined
                    }
                    pixelRatio={capture ? 1 : undefined}
                    position={resolvedInitialView.cameraPosition}
                    quality={qualityProfile}
                    onContextLost={onSceneContextLost}
                    rendererOptions={
                        capture
                            ? {
                                  alpha: Boolean(capture.transparent),
                                  antialias: true,
                                  powerPreference: 'high-performance',
                                  precision: 'highp',
                                  preserveDrawingBuffer: true,
                              }
                            : undefined
                    }
                    suspendWhenOffscreen={!capture}
                    zoom={resolvedInitialView.cameraZoom}
                    className="h-full w-full"
                >
                    <ParticleSystemProvider>
                        <BlockInteractionRegistryProvider>
                            <Environment
                                celestialOffsetMultiplier={
                                    capture && !capture.transparent
                                        ? 0.72
                                        : undefined
                                }
                                noBackground={Boolean(capture?.transparent)}
                                noSound={noSound}
                                noWeather={Boolean(capture) || noWeather}
                                quality={qualityProfile}
                                weather={undefined}
                            />
                            <Suspense fallback={null}>
                                <PublicGardenVisualOccludersContext.Provider
                                    value={visualOccluders}
                                >
                                    <group name="PublicGardenScene:Entities">
                                        {/* DOM signs raycast only visible scene
                                            content; invisible interaction
                                            receivers remain sibling targets. */}
                                        <group
                                            ref={setVisualOccluders}
                                            name="PublicGardenScene:VisualOccluders"
                                        >
                                            {normalizedStacks.map((stack) =>
                                                stack.blocks.map((block) => (
                                                    <EntityFactory
                                                        key={`${stack.position.x}|${stack.position.z}|${block.id}-${block.name}`}
                                                        name={block.name}
                                                        stack={stack}
                                                        block={block}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                        rotation={
                                                            block.rotation
                                                        }
                                                        variant={block.variant}
                                                        noRenderInView={
                                                            instancedBlockNames
                                                        }
                                                        noControl
                                                    />
                                                )),
                                            )}
                                            <EntityInstances
                                                farmId={garden?.farmId}
                                                quality={qualityProfile}
                                                renderGroundDecorations={shouldRenderPublicGardenGroundDecorations(
                                                    renderLivingDetails,
                                                    renderGroundDecorations,
                                                )}
                                                stacks={normalizedStacks}
                                                renderDetails={
                                                    renderLivingDetails
                                                }
                                            />
                                            {structureScene.plan?.structures
                                                .length ? (
                                                <GardenStructureSceneLayerDynamic
                                                    castShadows={
                                                        qualityProfile.shadows &&
                                                        !capture?.transparent
                                                    }
                                                    renderProps={
                                                        renderLivingDetails
                                                    }
                                                    onRendererReady={
                                                        markStructureRendererReady
                                                    }
                                                    snapshot={structureScene}
                                                />
                                            ) : null}
                                            {sceneChildren}
                                            {onSceneReady ? (
                                                <PublicGardenSceneReady
                                                    onReady={onSceneReady}
                                                />
                                            ) : null}
                                            {renderLivingDetails && garden ? (
                                                <Suspense fallback={null}>
                                                    <RaisedBedMulchOverlays
                                                        quality={qualityProfile}
                                                    />
                                                </Suspense>
                                            ) : null}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Birds
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Squirrels
                                                        farmId={garden?.farmId}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Frogs
                                                        gardenId={garden?.id}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Bats
                                                        farmId={garden?.farmId}
                                                        gardenId={garden?.id}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Cats
                                                        farmId={garden?.farmId}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Dogs
                                                        farmId={garden?.farmId}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails && (
                                                <Suspense fallback={null}>
                                                    <Chickens
                                                        farmId={garden?.farmId}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                    <Piglets
                                                        farmId={garden?.farmId}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                    <Sheep
                                                        farmId={garden?.farmId}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                </Suspense>
                                            )}
                                            {renderTransientDetails &&
                                                garden && (
                                                    <Suspense fallback={null}>
                                                        <Bees
                                                            farmId={
                                                                garden.farmId
                                                            }
                                                            garden={garden}
                                                            groundDecorationDensity={
                                                                qualityProfile.groundDecorationDensity
                                                            }
                                                        />
                                                        <Ladybugs
                                                            farmId={
                                                                garden.farmId
                                                            }
                                                            garden={garden}
                                                        />
                                                        <Butterflies
                                                            farmId={
                                                                garden.farmId
                                                            }
                                                            garden={garden}
                                                            groundDecorationDensity={
                                                                qualityProfile.groundDecorationDensity
                                                            }
                                                        />
                                                    </Suspense>
                                                )}
                                            {renderTransientDetails &&
                                                garden && (
                                                    <Suspense fallback={null}>
                                                        <Slugs
                                                            farmId={
                                                                garden.farmId
                                                            }
                                                            garden={garden}
                                                            weatherDisabled={
                                                                noWeather
                                                            }
                                                        />
                                                    </Suspense>
                                                )}
                                            {visitorPresence ? (
                                                <Suspense fallback={null}>
                                                    <GardenAvatar
                                                        additionalCollisionWorld={
                                                            structureScene.collisionWorld
                                                        }
                                                        activationRequest={
                                                            localVisitorActivationRequest
                                                        }
                                                        initialSpawnPoint={
                                                            localVisitorSpawnPoint
                                                        }
                                                        interactiveBlockIds={
                                                            interactiveBlockIds
                                                        }
                                                        key={
                                                            visitorPresence.localVisitorId
                                                        }
                                                        onPresenceChange={
                                                            visitorPresence.onLocalPresenceChange
                                                        }
                                                        onInteractBlock={
                                                            interactWithAvatarBlock
                                                        }
                                                        roamSeed={
                                                            visitorPresence.localVisitorId
                                                        }
                                                        showActivationPrompt={
                                                            localVisitorActivationRequest ===
                                                            undefined
                                                        }
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                    {visitorPresence.visitors.map(
                                                        (visitor) => (
                                                            <GardenVisitorAvatar
                                                                key={visitor.id}
                                                                presence={
                                                                    visitor
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                </Suspense>
                                            ) : null}
                                        </group>
                                        {!capture &&
                                        !gardenAvatarActive &&
                                        !noControls ? (
                                            <>
                                                {interactiveBlockIds?.size &&
                                                onSelectBlock ? (
                                                    <PublicGardenBlockInteractions
                                                        blockIds={
                                                            interactiveBlockIds
                                                        }
                                                        onSelect={onSelectBlock}
                                                        stacks={
                                                            normalizedStacks
                                                        }
                                                    />
                                                ) : null}
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
                                    </group>
                                </PublicGardenVisualOccludersContext.Provider>
                            </Suspense>
                            <GameCameraRig
                                closeupFocus={selectedBlockFocus}
                                minZoom={cameraMinZoom}
                                controlsEnabled={
                                    !capture &&
                                    !gardenAvatarActive &&
                                    !noControls
                                }
                                initialPosition={
                                    resolvedInitialView.cameraPosition
                                }
                                initialSnapshot={initialSnapshot}
                                initialTarget={resolvedInitialView.cameraTarget}
                                initialViewKey={initialViewKey}
                                initialZoom={resolvedInitialView.cameraZoom}
                            />
                            {capture ? (
                                <PublicGardenCaptureProbe
                                    key={capture.key}
                                    enabled={
                                        renderLivingDetails &&
                                        plantSortsLoaded &&
                                        structureCaptureReady
                                    }
                                    fitSceneObjectName={
                                        capture.fitGarden
                                            ? 'PublicGardenScene:Entities'
                                            : undefined
                                    }
                                    fitScenePadding={capture.fitGardenPadding}
                                    onCapture={capture.onCapture}
                                    onError={capture.onError}
                                    output={capture.output}
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

function PublicGardenInteractiveOverlays({
    onCloseRaisedBed,
    onSelectRaisedBed,
    raisedBeds,
    selectedRaisedBed,
    visitorPresenceEnabled,
}: {
    onCloseRaisedBed: () => void;
    onSelectRaisedBed: (raisedBedId: number) => void;
    raisedBeds: PublicGardenRaisedBed[];
    selectedRaisedBed: PublicGardenRaisedBed | undefined;
    visitorPresenceEnabled: boolean;
}) {
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);
    if (visitorPresenceEnabled && gardenAvatarView !== 'overview') {
        return <GardenAvatarHud />;
    }

    return (
        <>
            <PublicGardenRaisedBedPicker
                onSelect={onSelectRaisedBed}
                raisedBeds={raisedBeds}
            />
            {selectedRaisedBed ? (
                <PublicGardenRaisedBedDetails
                    key={selectedRaisedBed.id}
                    onClose={onCloseRaisedBed}
                    raisedBed={selectedRaisedBed}
                />
            ) : null}
        </>
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
    cameraMinZoom,
    capture,
    spriteBaseUrl,
    deferDetails = true,
    fixedTime,
    garden,
    initialView: initialViewOverride,
    interactiveBlockIds,
    localVisitorActivationRequest,
    localVisitorSpawnPoint,
    noControls = false,
    noSound = true,
    noWeather = false,
    overlayChildren,
    onLocalVisitorViewChange,
    onSelectBlock,
    onSceneContextLost,
    onSceneReady,
    renderDetails: renderDetailsOverride,
    renderGroundDecorations,
    sceneChildren,
    selectedBlockId,
    selectedBlockFocus,
    stacks,
    className,
    visitorPresence,
}: PublicGardenViewerProps) {
    const resolvedAppBaseUrl = appBaseUrl ?? 'https://vrt.gredice.com';
    const resolvedSpriteBaseUrl = spriteBaseUrl ?? resolvedAppBaseUrl;
    const initialTimeLocation = publicGardenTimeLocation(garden);
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: resolvedAppBaseUrl,
            authenticatedGardenQueriesEnabled: false,
            spriteBaseUrl: resolvedSpriteBaseUrl,
            dayNightCycleDisabled: capture?.phase ? false : undefined,
            freezeTime:
                fixedTime ??
                (capture
                    ? capture.phase
                        ? getPublicGardenCapturePhaseDate(
                              capture.phase,
                              initialTimeLocation ?? defaultGameLocation,
                          )
                        : getPublicGardenCaptureDate()
                    : null),
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
    const initialView = useMemo(() => {
        if (initialViewOverride) {
            return initialViewOverride;
        }

        if (
            capture?.fitGarden &&
            capture.output?.width &&
            capture.output.height
        ) {
            return getPublicGardenCaptureInitialView({
                stacks: normalizedStacks,
                viewport: {
                    height: capture.output.height,
                    width: capture.output.width,
                },
            });
        }

        return getPublicGardenInitialView({
            homeCamera: capture?.fitGarden ? null : garden?.homeCamera,
            stacks: normalizedStacks,
        });
    }, [
        capture?.fitGarden,
        capture?.output?.height,
        capture?.output?.width,
        garden?.homeCamera,
        initialViewOverride,
        normalizedStacks,
    ]);
    const resolveStructureFraming =
        !initialViewOverride &&
        (Boolean(capture?.fitGarden) || !garden?.homeCamera);
    const deferredRenderDetails = useDeferredSceneDetails(deferDetails);
    const renderDetails = renderDetailsOverride ?? deferredRenderDetails;
    const loadPlantSorts = renderDetailsOverride !== false || Boolean(capture);
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

    const openInteractiveBlock = useCallback(
        (blockId: string) => {
            if (!interactiveBlockIds?.has(blockId)) {
                return;
            }

            const block = normalizedStacks
                .flatMap((stack) => stack.blocks)
                .find((candidate) => candidate.id === blockId);
            if (!block) {
                return;
            }

            onSelectBlock?.(blockId);
            storeRef.current?.getState().setView({
                view: 'closeup',
                block,
            });
        },
        [interactiveBlockIds, normalizedStacks, onSelectBlock],
    );

    useEffect(() => {
        if (selectedBlockId === undefined) {
            return;
        }

        if (
            selectedBlockId === null ||
            !interactiveBlockIds?.has(selectedBlockId)
        ) {
            storeRef.current?.getState().setView({ view: 'normal' });
            return;
        }

        const block = normalizedStacks
            .flatMap((stack) => stack.blocks)
            .find((candidate) => candidate.id === selectedBlockId);
        storeRef.current
            ?.getState()
            .setView(block ? { view: 'closeup', block } : { view: 'normal' });
    }, [interactiveBlockIds, normalizedStacks, selectedBlockId]);

    useEffect(() => {
        storeRef.current
            ?.getState()
            .setBackgroundPaletteKey(gameGarden?.backgroundPalette);
    }, [gameGarden?.backgroundPalette]);

    useEffect(() => {
        if (gameGarden?.id === undefined) {
            setSelectedRaisedBedId(null);
            if (selectedBlockId === undefined || selectedBlockId === null) {
                storeRef.current?.getState().setView({ view: 'normal' });
            }
            storeRef.current?.getState().setGardenAvatarView('overview');
            return;
        }

        setSelectedRaisedBedId(null);
        if (selectedBlockId === undefined || selectedBlockId === null) {
            storeRef.current?.getState().setView({ view: 'normal' });
        }
        storeRef.current?.getState().setGardenAvatarView('overview');
    }, [gameGarden?.id, selectedBlockId]);

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
                                    cameraMinZoom={cameraMinZoom}
                                    capture={capture}
                                    className="size-full"
                                    garden={gameGarden}
                                    gardenCacheReady={gardenCacheReady}
                                    initialView={initialView}
                                    interactiveBlockIds={interactiveBlockIds}
                                    initialSnapshot={
                                        initialViewOverride ||
                                        capture?.fitGarden
                                            ? undefined
                                            : (garden?.homeCamera ?? undefined)
                                    }
                                    loadPlantSorts={loadPlantSorts}
                                    localVisitorActivationRequest={
                                        localVisitorActivationRequest
                                    }
                                    localVisitorSpawnPoint={
                                        localVisitorSpawnPoint
                                    }
                                    noControls={noControls}
                                    noSound={Boolean(capture) || noSound}
                                    noWeather={noWeather}
                                    normalizedStacks={normalizedStacks}
                                    onAvatarInteractBlock={onSelectBlock}
                                    onSelectBlock={openInteractiveBlock}
                                    onSelectRaisedBedBlock={
                                        openRaisedBedByBlockId
                                    }
                                    onSceneContextLost={onSceneContextLost}
                                    onSceneReady={onSceneReady}
                                    renderDetails={renderDetails}
                                    renderGroundDecorations={
                                        renderGroundDecorations
                                    }
                                    resolveStructureFraming={
                                        resolveStructureFraming
                                    }
                                    sceneChildren={sceneChildren}
                                    selectedBlockFocus={selectedBlockFocus}
                                    visitorPresence={visitorPresence}
                                />
                                {gameGarden && !capture && !noControls ? (
                                    <PublicGardenInteractiveOverlays
                                        onCloseRaisedBed={closeRaisedBed}
                                        onSelectRaisedBed={openRaisedBed}
                                        raisedBeds={selectableRaisedBeds}
                                        selectedRaisedBed={selectedRaisedBed}
                                        visitorPresenceEnabled={Boolean(
                                            visitorPresence,
                                        )}
                                    />
                                ) : null}
                                {onLocalVisitorViewChange ? (
                                    <PublicGardenAvatarViewReporter
                                        onChange={onLocalVisitorViewChange}
                                    />
                                ) : null}
                                {overlayChildren}
                            </div>
                        )}
                    </SeedPublicGardenQueryCache>
                </GameSceneDetailContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
