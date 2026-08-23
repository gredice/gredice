'use client';

import { cx } from '@gredice/ui/utils';
import {
    type HTMLAttributes,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Vector3 } from 'three';
import { BlockInteractionLayer } from './controls/BlockInteractionLayer';
import { BlockInteractionRegistryProvider } from './controls/BlockInteractionRegistry';
import { GameCameraRig } from './controls/GameCameraRig';
import { HudPlacementDragPreview } from './controls/HudPlacementDragPreview';
import { DetailedInspectionFarmer } from './entities/avatar/DetailedInspectionFarmer';
import { findDetailedInspectionFarmerTransform } from './entities/avatar/detailedInspectionFarmerPosition';
import { GardenAvatar } from './entities/avatar/GardenAvatar';
import type { GardenAvatarInteractionResult } from './entities/avatar/gardenAvatarInteractions';
import { Bees } from './entities/bees/Bees';
import { Birds } from './entities/birds/Birds';
import { Cats } from './entities/cats/Cats';
import { Dogs } from './entities/dogs/Dogs';
import { EntityFactory } from './entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from './entities/EntityInstances';
import { Chickens, Piglets } from './entities/farmAnimals/FarmAnimals';
import { isFenceGateBlockName } from './entities/fenceConnections';
import { getToggledFenceGateVariant } from './entities/fenceGateState';
import { Frogs } from './entities/frogs/Frogs';
import { PlacementGroundingShadows } from './entities/helpers/PlacementGroundingShadows';
import { RaisedBedMulchOverlays } from './entities/raisedBed/RaisedBedMulchOverlays';
import {
    SunflowerDropFlyAnimation,
    type SunflowerDropFlyOrigin,
    SunflowerDropReward,
} from './entities/SunflowerDropReward';
import type { GameFeatureFlags } from './GameFlagsContext';
import { GameHud } from './GameHud';
import { useGameLoading } from './GameLoadingContext';
import styles from './GameScene.module.css';
import { GameSceneDetailContext } from './GameSceneDetailContext';
import { GardenPreviewCaptureController } from './GardenPreviewCaptureController';
import {
    defaultGameCameraPosition,
    defaultGameCameraZoom,
    farGameCameraZoom,
} from './gameCamera';
import { detailedInspectionFarmerMessage } from './hooks/detailedRaisedBedInspectionReports';
import { useBlockData } from './hooks/useBlockData';
import { useBlockVariant } from './hooks/useBlockVariant';
import { useClearSandboxEnvironmentOverrides } from './hooks/useClearSandboxEnvironmentOverrides';
import { type CurrentGarden, useCurrentGarden } from './hooks/useCurrentGarden';
import { useDeferredSceneDetails } from './hooks/useDeferredSceneDetails';
import {
    type DetailedRaisedBedInspectionReport,
    useDetailedRaisedBedInspectionReports,
    useMarkDetailedRaisedBedInspectionReportsSeen,
} from './hooks/useDetailedRaisedBedInspectionReports';
import { useFocusPlacedBlock } from './hooks/useFocusPlacedBlock';
import { useSceneCurrentGarden } from './hooks/useSceneCurrentGarden';
import { useSyncGardenBackgroundPalette } from './hooks/useSyncGardenBackgroundPalette';
import { useWeatherNow } from './hooks/useWeatherNow';
import { DebugHud } from './hud/DebugHud';
import { DetailedRaisedBedInspectionModal } from './hud/DetailedRaisedBedInspectionModal';
import { RaisedBedNotificationBubbles } from './hud/RaisedBedNotificationBubbles';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { PlacementGrid } from './indicators/PlacementGrid';
import { isOperationVisualRewardDebugProfile } from './operationVisualRewardDebugProfile';
import { ParticleSystemProvider } from './particles/ParticleSystem';
import {
    type AdaptiveHighQualityLevelProfile,
    adaptiveHighQualityLevels,
} from './scene/adaptiveHighQuality';
import { Environment } from './scene/Environment';
import {
    type GameQualityAutoProfileMetrics,
    type GameQualitySetting,
    type GameQualityTier,
    getGameQualityAutoProfileMetrics,
    resolveGameQualityProfile,
} from './scene/gameQuality';
import { Scene } from './scene/Scene';
import { StaticOpaqueSceneCacheOcclusionFixture } from './scene/StaticOpaqueSceneCacheOcclusionFixture';
import type { Block } from './types/Block';
import type { Stack } from './types/Stack';
import {
    formatBlockPlacementDropAnimationRenderIdentity,
    type GameState,
    getBlockPlacementDropAnimationRenderIdForBlockId,
    type MockGardenProfile,
    useGameState,
    useGameStateStore,
    type WinterMode,
} from './useGameState';
import { useRaisedBedCloseup } from './useRaisedBedCloseup';
import { useWoodenSignParam } from './useUrlState';

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    zoom?: 'far' | 'normal';
    cameraPosition?: [x: number, y: number, z: number];

    // Demo purposes only
    freezeTime?: Date;
    fixedTimeSeconds?: number;
    dayNightCycleDisabled?: boolean;
    noBackground?: boolean;
    noControls?: boolean;
    hideHud?: boolean;
    suppressOpeningHud?: boolean;
    debugHud?: boolean;
    noWeather?: boolean;
    noSound?: boolean;
    mockGarden?: boolean;
    mockGardenProfile?: MockGardenProfile;
    localSandboxStorageKey?: string;
    localSandboxInitialStacks?: Stack[];
    winterMode?: WinterMode;
    weather?: Partial<GameState['weather']>;
    deferDetails?: boolean;
    renderDetails?: boolean;
    quality?: GameQualityTier;
    initialQualitySetting?: GameQualitySetting;

    // Development purposes
    adaptiveHighQuality?: boolean;
    enableGameProfileController?: boolean;
    enableStaticOpaqueSceneCacheOcclusionFixture?: boolean;
    flags?: GameFeatureFlags;
    staticOpaqueSceneCache?: boolean;
};

type GameSceneInnerProps = Omit<GameSceneProps, 'initialQualitySetting'>;
const adaptiveHighInteractionHoldMs = 350;

function useAutoQualityProfileMetrics(enabled: boolean) {
    const [metrics, setMetrics] = useState<
        GameQualityAutoProfileMetrics | undefined
    >(getGameQualityAutoProfileMetrics);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        let resolutionQuery: MediaQueryList | undefined;
        const refresh = () => setMetrics(getGameQualityAutoProfileMetrics());
        const handleResolutionChange = () => {
            refresh();
            subscribeResolutionChange();
        };
        const subscribeResolutionChange = () => {
            resolutionQuery?.removeEventListener(
                'change',
                handleResolutionChange,
            );

            if (typeof window.matchMedia !== 'function') {
                resolutionQuery = undefined;
                return;
            }

            resolutionQuery = window.matchMedia(
                `(resolution: ${window.devicePixelRatio || 1}dppx)`,
            );
            resolutionQuery.addEventListener('change', handleResolutionChange);
        };

        subscribeResolutionChange();
        window.addEventListener('resize', refresh);
        window.addEventListener('orientationchange', refresh);

        return () => {
            resolutionQuery?.removeEventListener(
                'change',
                handleResolutionChange,
            );
            window.removeEventListener('resize', refresh);
            window.removeEventListener('orientationchange', refresh);
        };
    }, [enabled]);

    return metrics;
}

function useAdaptiveHighInteractionActivity(enabled: boolean) {
    const gameStateStore = useGameStateStore();
    const placementActive = useGameState(
        (state) =>
            enabled &&
            (state.isDragging ||
                state.pickupBlock !== null ||
                state.activeDragPreview !== null ||
                state.hudPlacementDrag !== null ||
                Object.keys(state.blockPlacementDropAnimations).length > 0),
    );
    const [cameraActive, setCameraActive] = useState(false);
    const cameraActiveRef = useRef(false);
    const cameraActivityTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) {
            if (cameraActivityTimeoutRef.current !== null) {
                window.clearTimeout(cameraActivityTimeoutRef.current);
                cameraActivityTimeoutRef.current = null;
            }
            cameraActiveRef.current = false;
            setCameraActive(false);
            return;
        }

        let previousCameraVersion =
            gameStateStore.getState().gameCameraSnapshot?.version ?? null;
        const unsubscribe = gameStateStore.subscribe((state) => {
            const cameraVersion = state.gameCameraSnapshot?.version ?? null;
            if (
                previousCameraVersion === null ||
                cameraVersion === null ||
                cameraVersion === previousCameraVersion
            ) {
                previousCameraVersion = cameraVersion;
                return;
            }
            previousCameraVersion = cameraVersion;

            if (!cameraActiveRef.current) {
                cameraActiveRef.current = true;
                setCameraActive(true);
            }
            if (cameraActivityTimeoutRef.current !== null) {
                window.clearTimeout(cameraActivityTimeoutRef.current);
            }
            cameraActivityTimeoutRef.current = window.setTimeout(() => {
                cameraActivityTimeoutRef.current = null;
                cameraActiveRef.current = false;
                setCameraActive(false);
            }, adaptiveHighInteractionHoldMs);
        });

        return () => {
            unsubscribe();
            if (cameraActivityTimeoutRef.current !== null) {
                window.clearTimeout(cameraActivityTimeoutRef.current);
                cameraActivityTimeoutRef.current = null;
            }
            cameraActiveRef.current = false;
        };
    }, [enabled, gameStateStore]);

    useEffect(
        () => () => {
            if (cameraActivityTimeoutRef.current !== null) {
                window.clearTimeout(cameraActivityTimeoutRef.current);
            }
        },
        [],
    );

    return enabled && (placementActive || cameraActive);
}

function GameSceneEntitySlot({
    block,
    noControls,
    stack,
    stacks,
}: {
    block: Block;
    noControls: boolean | undefined;
    stack: Stack;
    stacks: Stack[];
}) {
    const placementDropAnimationRenderId = useGameState((state) =>
        getBlockPlacementDropAnimationRenderIdForBlockId(
            state.blockPlacementDropAnimations,
            block.id,
        ),
    );
    const renderIdentity = formatBlockPlacementDropAnimationRenderIdentity(
        block.id,
        placementDropAnimationRenderId,
    );
    const entityFactory = (
        <EntityFactory
            name={block.name}
            stack={stack}
            block={block}
            stacks={stacks}
            rotation={block.rotation}
            variant={block.variant}
            noRenderInView={instancedBlockNames}
            noControl={noControls}
        />
    );

    return (
        <Suspense key={renderIdentity} fallback={null}>
            {entityFactory}
        </Suspense>
    );
}
export function GameScene({
    cameraPosition = defaultGameCameraPosition,
    zoom = 'normal',
    noControls,
    noWeather,
    noBackground,
    noSound,
    hideHud,
    suppressOpeningHud,
    className,
    flags,
    debugHud,
    quality,
    weather,
    deferDetails,
    renderDetails: renderDetailsOverride,
    adaptiveHighQuality = true,
    enableGameProfileController,
    enableStaticOpaqueSceneCacheOcclusionFixture,
    fixedTimeSeconds,
    staticOpaqueSceneCache = true,
    ...rest
}: GameSceneInnerProps) {
    useFocusPlacedBlock();
    useRaisedBedCloseup();
    const weatherVisualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const isMock = useGameState((state) => state.isMock);
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);
    const setGardenAvatarView = useGameState(
        (state) => state.setGardenAvatarView,
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const [, setWoodenSignParam] = useWoodenSignParam();
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const gameQualitySetting = useGameState(
        (state) => state.gameQualitySetting,
    );
    const gameQualityCustomProfile = useGameState(
        (state) => state.gameQualityCustomProfile,
    );
    const weatherDisabled = noWeather || weatherVisualizationDisabled;
    const gardenAvatarEnabled = Boolean(flags?.enableGardenAvatarFlag);
    const gardenAvatarActive =
        gardenAvatarEnabled && gardenAvatarView !== 'overview';
    const deferredRenderDetails = useDeferredSceneDetails(deferDetails);
    const renderDetails = renderDetailsOverride ?? deferredRenderDetails;
    const isOperationRewardDebug =
        isMock && isOperationVisualRewardDebugProfile(mockGardenProfile);
    const shouldRenderRaisedBedMulchOverlays =
        !isLocalSandbox &&
        renderDetails &&
        (zoom !== 'far' || isOperationRewardDebug);
    const [sunflowerDropFlyOrigin, setSunflowerDropFlyOrigin] =
        useState<SunflowerDropFlyOrigin | null>(null);
    const detailedInspectionReportsQuery =
        useDetailedRaisedBedInspectionReports();
    const markDetailedInspectionReportsSeen =
        useMarkDetailedRaisedBedInspectionReportsSeen();
    const [openedDetailedInspection, setOpenedDetailedInspection] = useState<{
        gardenId: number;
        reports: DetailedRaisedBedInspectionReport[];
    } | null>(null);
    const autoQualityProfileMetrics = useAutoQualityProfileMetrics(
        quality === undefined && gameQualitySetting === 'auto',
    );
    const qualityProfile = useMemo(() => {
        return resolveGameQualityProfile(
            quality ?? gameQualitySetting,
            gameQualityCustomProfile,
            autoQualityProfileMetrics,
        );
    }, [
        autoQualityProfileMetrics,
        gameQualityCustomProfile,
        gameQualitySetting,
        quality,
    ]);
    const adaptiveHighEnabled = Boolean(
        adaptiveHighQuality &&
            qualityProfile.tier === 'high' &&
            (quality === 'high' ||
                (quality === undefined && gameQualitySetting === 'high')),
    );
    const staticOpaqueCacheEnabled = Boolean(
        staticOpaqueSceneCache &&
            qualityProfile.tier === 'high' &&
            !gardenAvatarActive,
    );
    const adaptiveHighInteractionActive = useAdaptiveHighInteractionActivity(
        adaptiveHighEnabled || staticOpaqueCacheEnabled,
    );
    const [adaptiveHighProfile, setAdaptiveHighProfile] =
        useState<AdaptiveHighQualityLevelProfile>(adaptiveHighQualityLevels.L0);

    // Start non-critical metadata early, but don't block the first scene frame.
    const { data: blockData } = useBlockData();
    const { data: gardenData, isLoading: gardenLoading } = useCurrentGarden();
    const { isPending: isBlockVariantPending, mutate: updateBlockVariant } =
        useBlockVariant();
    const garden = useSceneCurrentGarden(gardenData);
    const fenceGateBlockIds = useMemo(
        () =>
            new Set(
                (garden?.stacks ?? []).flatMap((stack) =>
                    stack.blocks.flatMap((block) =>
                        isFenceGateBlockName(block.name) ? [block.id] : [],
                    ),
                ),
            ),
        [garden?.stacks],
    );
    const detailedInspectionReports =
        detailedInspectionReportsQuery.data?.reports;
    const detailedInspectionMessage = useMemo(
        () =>
            detailedInspectionFarmerMessage(
                detailedInspectionReports?.map(
                    (report) => report.notificationId,
                ) ?? [],
            ),
        [detailedInspectionReports],
    );
    const detailedInspectionFirstReport = detailedInspectionReports?.[0];
    const detailedInspectionTargetRaisedBedId =
        detailedInspectionFirstReport?.raisedBedId;
    const detailedInspectionTargetBlockId = garden?.raisedBeds.find(
        (raisedBed) => raisedBed.id === detailedInspectionTargetRaisedBedId,
    )?.blockId;
    const detailedInspectionFarmerTransform = useMemo(
        () =>
            findDetailedInspectionFarmerTransform({
                blockData,
                stacks: garden?.stacks,
                targetBlockId: detailedInspectionTargetBlockId,
            }),
        [blockData, detailedInspectionTargetBlockId, garden?.stacks],
    );
    const openedDetailedInspectionForCurrentGarden =
        openedDetailedInspection?.gardenId === garden?.id
            ? openedDetailedInspection
            : null;
    const gardenInitialViewKey = garden?.id ?? 'default';
    const gardenInitialHomeCameraRef = useRef<{
        key: string | number;
        homeCamera: CurrentGarden['homeCamera'];
    } | null>(null);
    if (gardenInitialHomeCameraRef.current?.key !== gardenInitialViewKey) {
        gardenInitialHomeCameraRef.current = {
            key: gardenInitialViewKey,
            homeCamera: garden?.homeCamera ?? null,
        };
    }
    const gardenHomeCamera =
        gardenInitialHomeCameraRef.current.homeCamera ?? undefined;
    const sceneCameraPosition = useMemo(
        () => new Vector3(...(gardenHomeCamera?.position ?? cameraPosition)),
        [cameraPosition, gardenHomeCamera],
    );
    const sceneCameraTarget = useMemo(
        () =>
            gardenHomeCamera
                ? new Vector3(...gardenHomeCamera.target)
                : undefined,
        [gardenHomeCamera],
    );
    const sceneCameraZoom =
        gardenHomeCamera?.zoom ??
        (zoom === 'far' ? farGameCameraZoom : defaultGameCameraZoom);
    const gardenBackgroundPalette = garden?.backgroundPalette;
    useClearSandboxEnvironmentOverrides(garden);
    useSyncGardenBackgroundPalette(gardenBackgroundPalette);
    useWeatherNow(
        !isLocalSandbox && !weatherDisabled && !weather && garden !== undefined,
        garden?.farmId,
    );
    useEffect(() => {
        if (!gardenAvatarEnabled && gardenAvatarView !== 'overview') {
            setGardenAvatarView('overview');
        }
    }, [gardenAvatarEnabled, gardenAvatarView, setGardenAvatarView]);
    const isLoading = gardenLoading;
    const interactWithAvatarBlock = useCallback(
        (block: Block): GardenAvatarInteractionResult => {
            if (isFenceGateBlockName(block.name)) {
                if (!isBlockVariantPending) {
                    updateBlockVariant({
                        blockId: block.id,
                        variant: getToggledFenceGateVariant(block),
                    });
                }
                return 'handled';
            }
            if (block.name === 'GardenBox' && !isLocalSandbox) {
                setOpenGardenBoxBlockId(block.id);
                return 'opened-ui';
            }
            if (block.name === 'WoodenSign') {
                setWoodenSignParam(block.id);
                return 'opened-ui';
            }
            return 'ignored';
        },
        [
            isLocalSandbox,
            isBlockVariantPending,
            setOpenGardenBoxBlockId,
            setWoodenSignParam,
            updateBlockVariant,
        ],
    );

    const loadingContext = useGameLoading();
    useEffect(() => {
        loadingContext?.setIsReady(!isLoading);
        return () => {
            loadingContext?.setIsReady(false);
        };
    }, [isLoading, loadingContext]);

    if (isLoading) {
        return loadingContext ? null : <GardenLoadingIndicator />;
    }

    const showDebugHud = debugHud ?? Boolean(flags?.enableDebugHudFlag);

    function markDetailedInspectionSeen(
        inspection: NonNullable<
            typeof openedDetailedInspectionForCurrentGarden
        >,
    ) {
        markDetailedInspectionReportsSeen.mutate({
            gardenId: inspection.gardenId,
            notificationIds: inspection.reports.map(
                (report) => report.notificationId,
            ),
        });
    }

    function openDetailedInspectionReports() {
        if (!garden || !detailedInspectionReports?.length) {
            return;
        }

        const inspection = {
            gardenId: garden.id,
            reports: detailedInspectionReports,
        };
        markDetailedInspectionReportsSeen.reset();
        setOpenedDetailedInspection(inspection);
        markDetailedInspectionSeen(inspection);
    }

    return (
        <div
            className={cx(
                styles.interactionSurface,
                'animate-in duration-1000 fade-in',
                className,
            )}
            {...rest}
        >
            <GameSceneDetailContext.Provider
                value={{ includePendingCartPlants: true, renderDetails }}
            >
                <Scene
                    adaptiveHighEnabled={adaptiveHighEnabled}
                    adaptiveHighInteractionActive={
                        adaptiveHighInteractionActive
                    }
                    adaptiveHighProfileControlEnabled={Boolean(
                        enableGameProfileController && adaptiveHighEnabled,
                    )}
                    adaptiveHighProfile={adaptiveHighProfile}
                    onAdaptiveHighProfileChange={setAdaptiveHighProfile}
                    debugStats={showDebugHud}
                    fixedTimeSeconds={fixedTimeSeconds}
                    position={sceneCameraPosition}
                    quality={qualityProfile}
                    staticOpaqueCacheEnabled={staticOpaqueCacheEnabled}
                    zoom={sceneCameraZoom}
                    className="!absolute"
                >
                    <ParticleSystemProvider>
                        <BlockInteractionRegistryProvider>
                            <PlacementGrid />
                            {!hideHud ? <HudPlacementDragPreview /> : null}
                            <Environment
                                cloudShadowUpdateMs={
                                    adaptiveHighEnabled
                                        ? adaptiveHighProfile.cloudShadowUpdateMs
                                        : undefined
                                }
                                noBackground={noBackground}
                                noWeather={weatherDisabled}
                                noSound={noSound}
                                quality={qualityProfile}
                                weather={weather}
                            />
                            {enableStaticOpaqueSceneCacheOcclusionFixture &&
                            staticOpaqueCacheEnabled ? (
                                <StaticOpaqueSceneCacheOcclusionFixture />
                            ) : null}
                            <PlacementGroundingShadows
                                stacks={garden?.stacks}
                            />
                            <group name="GameScene:Entities">
                                {garden?.stacks.map((stack) =>
                                    stack.blocks?.map((block, i) => {
                                        if (
                                            instancedBlockNames.includes(
                                                block.name,
                                            )
                                        ) {
                                            return null;
                                        }

                                        const slotKey = `${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.name}-${i}`;
                                        return (
                                            <GameSceneEntitySlot
                                                key={slotKey}
                                                block={block}
                                                noControls={noControls}
                                                stack={stack}
                                                stacks={garden.stacks}
                                            />
                                        );
                                    }),
                                )}
                                {shouldRenderRaisedBedMulchOverlays && (
                                    <Suspense fallback={null}>
                                        <RaisedBedMulchOverlays
                                            quality={qualityProfile}
                                        />
                                    </Suspense>
                                )}
                                <EntityInstances
                                    farmId={garden?.farmId}
                                    quality={qualityProfile}
                                    renderGroundDecorations={
                                        renderDetails && zoom !== 'far'
                                    }
                                    stacks={garden?.stacks}
                                    renderDetails={renderDetails}
                                    weather={weather}
                                />
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <SunflowerDropReward
                                            enabled={!isLocalSandbox && !isMock}
                                            garden={garden}
                                            onClaimed={
                                                setSunflowerDropFlyOrigin
                                            }
                                        />
                                    </Suspense>
                                )}
                                <BlockInteractionLayer
                                    controlsEnabled={
                                        !noControls && !gardenAvatarActive
                                    }
                                    sharedControllerEnabled
                                    stacks={garden?.stacks}
                                />
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <Birds stacks={garden?.stacks} />
                                    </Suspense>
                                )}
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <Frogs
                                            gardenId={garden?.id}
                                            stacks={garden?.stacks}
                                        />
                                    </Suspense>
                                )}
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <Cats
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                    </Suspense>
                                )}
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <Dogs
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                    </Suspense>
                                )}
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <Chickens
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                        <Piglets
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                    </Suspense>
                                )}
                                {gardenAvatarEnabled &&
                                    renderDetails &&
                                    zoom !== 'far' && (
                                        <Suspense fallback={null}>
                                            <GardenAvatar
                                                interactiveBlockIds={
                                                    fenceGateBlockIds
                                                }
                                                onInteractBlock={
                                                    interactWithAvatarBlock
                                                }
                                                stacks={garden?.stacks}
                                            />
                                        </Suspense>
                                    )}
                                {!hideHud &&
                                    renderDetails &&
                                    zoom !== 'far' &&
                                    !openedDetailedInspectionForCurrentGarden &&
                                    detailedInspectionFirstReport &&
                                    detailedInspectionMessage &&
                                    detailedInspectionFarmerTransform && (
                                        <Suspense fallback={null}>
                                            <DetailedInspectionFarmer
                                                id={
                                                    detailedInspectionFirstReport.notificationId
                                                }
                                                message={
                                                    detailedInspectionMessage
                                                }
                                                onOpen={
                                                    openDetailedInspectionReports
                                                }
                                                transform={
                                                    detailedInspectionFarmerTransform
                                                }
                                            />
                                        </Suspense>
                                    )}
                                {!hideHud &&
                                    renderDetails &&
                                    zoom !== 'far' &&
                                    !openedDetailedInspectionForCurrentGarden && (
                                        <RaisedBedNotificationBubbles
                                            blockData={blockData}
                                            garden={garden}
                                        />
                                    )}
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <Bees
                                            farmId={garden?.farmId}
                                            garden={garden}
                                            groundDecorationDensity={
                                                qualityProfile.groundDecorationDensity
                                            }
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                    </Suspense>
                                )}
                            </group>
                            <GameCameraRig
                                controlsEnabled={
                                    !noControls && !gardenAvatarActive
                                }
                                initialPosition={sceneCameraPosition}
                                initialSnapshot={gardenHomeCamera}
                                initialTarget={sceneCameraTarget}
                                initialViewKey={gardenInitialViewKey}
                                initialZoom={sceneCameraZoom}
                            />
                        </BlockInteractionRegistryProvider>
                    </ParticleSystemProvider>
                </Scene>
            </GameSceneDetailContext.Provider>
            {!hideHud && openedDetailedInspectionForCurrentGarden ? (
                <DetailedRaisedBedInspectionModal
                    dismissError={
                        markDetailedInspectionReportsSeen.error instanceof Error
                            ? markDetailedInspectionReportsSeen.error
                            : null
                    }
                    dismissPending={markDetailedInspectionReportsSeen.isPending}
                    onClose={() => setOpenedDetailedInspection(null)}
                    onRetryDismiss={() => {
                        markDetailedInspectionReportsSeen.reset();
                        markDetailedInspectionSeen(
                            openedDetailedInspectionForCurrentGarden,
                        );
                    }}
                    open
                    reports={openedDetailedInspectionForCurrentGarden.reports}
                />
            ) : null}
            <GardenPreviewCaptureController
                enabled={!isLocalSandbox && !isMock}
                garden={garden}
            />
            {!hideHud && (
                <GameHud
                    debugHud={showDebugHud}
                    noWeather={noWeather}
                    suppressOpeningHud={suppressOpeningHud}
                />
            )}
            {hideHud && showDebugHud && <DebugHud />}
            {sunflowerDropFlyOrigin && (
                <SunflowerDropFlyAnimation
                    origin={sunflowerDropFlyOrigin}
                    onDone={() => setSunflowerDropFlyOrigin(null)}
                />
            )}
        </div>
    );
}
