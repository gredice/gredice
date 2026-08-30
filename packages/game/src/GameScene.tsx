'use client';

import { getGardenStructurePayloadByteLength } from '@gredice/js/gardenStructures';
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
import type { GameCameraSnapshot } from './controls/GameCameraRigApi';
import { HudPlacementDragPreview } from './controls/HudPlacementDragPreview';
import { DetailedInspectionFarmer } from './entities/avatar/DetailedInspectionFarmer';
import { findDetailedInspectionFarmerTransform } from './entities/avatar/detailedInspectionFarmerPosition';
import { GardenAvatar } from './entities/avatar/GardenAvatar';
import type { GardenAvatarInteractionResult } from './entities/avatar/gardenAvatarInteractions';
import { mergeGardenAvatarCollisionWorlds } from './entities/avatar/gardenAvatarMovement';
import { Bats } from './entities/bats/Bats';
import { Bees } from './entities/bees/Bees';
import { Birds } from './entities/birds/Birds';
import { Butterflies } from './entities/butterflies/Butterflies';
import { Cats } from './entities/cats/Cats';
import { Dogs } from './entities/dogs/Dogs';
import { EntityFactory } from './entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from './entities/EntityInstances';
import {
    Chickens,
    Goats,
    LegacySheep,
    Piglets,
    Sheep,
} from './entities/farmAnimals/FarmAnimals';
import { isFenceGateBlockName } from './entities/fenceConnections';
import { getToggledFenceGateVariant } from './entities/fenceGateState';
import { Frogs } from './entities/frogs/Frogs';
import { PlacementGroundingShadows } from './entities/helpers/PlacementGroundingShadows';
import { Ladybugs } from './entities/ladybugs/Ladybugs';
import { HomeSpawnedPersistentPets } from './entities/persistentPets/HomeSpawnedPetActors';
import { RaisedBedMulchOverlays } from './entities/raisedBed/RaisedBedMulchOverlays';
import {
    SunflowerDropFlyAnimation,
    type SunflowerDropFlyOrigin,
    SunflowerDropReward,
} from './entities/SunflowerDropReward';
import { Slugs } from './entities/slugs/Slugs';
import { Squirrels } from './entities/squirrels/Squirrels';
import type { GameFeatureFlags } from './GameFlagsContext';
import { GameHud } from './GameHud';
import { useGameLoading } from './GameLoadingContext';
import styles from './GameScene.module.css';
import { GameSceneDetailContext } from './GameSceneDetailContext';
import { GardenPreviewCaptureController } from './GardenPreviewCaptureController';
import {
    getGardenSceneTransitionClassName,
    useGardenSceneTransition,
} from './GardenSceneTransition';
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
import { updateGameProfileMetadata } from './scene/gameProfileMetadata';
import {
    type GameQualityAutoProfileMetrics,
    type GameQualitySetting,
    type GameQualityTier,
    getGameQualityAutoProfileMetrics,
    resolveGameQualityProfile,
} from './scene/gameQuality';
import { Scene } from './scene/Scene';
import { StaticOpaqueSceneCacheOcclusionFixture } from './scene/StaticOpaqueSceneCacheOcclusionFixture';
import { GardenStructureSceneLayerDynamic } from './structures/GardenStructureSceneLayerDynamic';
import { GardenStructureVerticalSliceDynamic } from './structures/GardenStructureVerticalSliceDynamic';
import { createGardenStructureAvatarCollisionWorld } from './structures/gardenStructureAvatarCollision';
import { GardenStructurePlanCache } from './structures/gardenStructurePlanCache';
import {
    createGardenStructureSceneBaseHeightResolver,
    createGardenStructureSceneBuildPreviewCompileInput,
    createGardenStructureSceneFixtureBuildPreviewCompileInput,
    useGardenStructureSceneSnapshot,
} from './structures/gardenStructureScene';
import { resolveGardenStructureBuildCameraFrame } from './structures/structureBuildCamera';
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

const gardenStructureCameraFocusAttemptLimit = 30;

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
    gardenStructureDebugFixture?: boolean;
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
    farmId,
    noControls,
    stack,
    stacks,
    weather,
    weatherDisabled,
}: {
    block: Block;
    farmId?: number | null;
    noControls: boolean | undefined;
    stack: Stack;
    stacks: Stack[];
    weather?: Partial<NonNullable<GameState['weather']>>;
    weatherDisabled: boolean;
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
            farmId={farmId}
            stacks={stacks}
            rotation={block.rotation}
            variant={block.variant}
            weather={weather}
            weatherDisabled={weatherDisabled}
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
    gardenStructureDebugFixture,
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
    const structureBuildSession = useGameState(
        (state) => state.structureBuildSession,
    );
    const setStructureBuildSession = useGameState(
        (state) => state.setStructureBuildSession,
    );
    const gameCamera = useGameState((state) => state.gameCamera);
    const structureCameraSnapshotRef = useRef<GameCameraSnapshot | null>(null);
    const structureCameraFrameSignatureRef = useRef<string | null>(null);
    const structurePlanCacheRef = useRef<GardenStructurePlanCache | null>(null);
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
    const gardenStructureVerticalSliceEnabled = Boolean(
        flags?.enableGardenBuildingSystemFlag,
    );
    const structureBuildActive = Boolean(
        gardenStructureVerticalSliceEnabled && structureBuildSession,
    );
    const { data: blockData } = useBlockData();
    const { data: gardenData, isLoading: gardenLoading } = useCurrentGarden();
    const { displayedGarden: transitionedGardenData, sceneVisible } =
        useGardenSceneTransition(gardenData);
    const garden = useSceneCurrentGarden(transitionedGardenData);
    const editedStructureId =
        structureBuildActive && structureBuildSession
            ? structureBuildSession.editor.origin.kind === 'saved-structure'
                ? structureBuildSession.editor.origin.structureId
                : structureBuildSession.editor.origin.draftId
            : null;
    const structureFixtureBundle = useMemo(() => {
        const editor = structureBuildSession?.editor;
        if (!gardenStructureVerticalSliceEnabled || !editor) {
            return null;
        }
        const cache =
            structurePlanCacheRef.current ?? new GardenStructurePlanCache();
        structurePlanCacheRef.current = cache;
        const structureId =
            editor.origin.kind === 'new-draft'
                ? editor.origin.draftId
                : editor.origin.structureId;
        const revision =
            editor.origin.kind === 'saved-structure'
                ? editor.origin.revision
                : editor.history.past.length + 1;
        const previewInput = {
            blockData,
            document: editor.snapshot.document,
            placement: editor.snapshot.placement,
            revision,
            stacks: garden?.stacks,
            structureId,
        };
        const compileInput =
            structureBuildSession.persistence === 'fixture'
                ? createGardenStructureSceneFixtureBuildPreviewCompileInput(
                      previewInput,
                  )
                : createGardenStructureSceneBuildPreviewCompileInput(
                      previewInput,
                  );
        if (!compileInput) {
            return null;
        }
        const startedAt = performance.now();
        const plan = cache.getOrCompile(compileInput);
        const cacheSnapshot = cache.snapshot();
        return {
            compileDurationMs: performance.now() - startedAt,
            documentPayloadBytes:
                getGardenStructurePayloadByteLength(editor.snapshot.document) ??
                0,
            plan,
            cacheSnapshot,
        };
    }, [
        blockData,
        garden?.stacks,
        gardenStructureVerticalSliceEnabled,
        structureBuildSession?.editor,
        structureBuildSession?.persistence,
    ]);
    const structureFixtureCollisionWorld = useMemo(
        () =>
            structureFixtureBundle
                ? createGardenStructureAvatarCollisionWorld(
                      structureFixtureBundle.plan,
                  )
                : undefined,
        [structureFixtureBundle],
    );
    useEffect(() => {
        updateGameProfileMetadata({
            gardenStructureCompileDurationMs:
                structureFixtureBundle?.compileDurationMs ?? 0,
            gardenStructureDocumentPayloadBytes:
                structureFixtureBundle?.documentPayloadBytes ?? 0,
            gardenStructurePlanCacheEstimatedBytes:
                structureFixtureBundle?.cacheSnapshot.estimatedBytes ?? 0,
            gardenStructurePlanCacheEvictionCount:
                structureFixtureBundle?.cacheSnapshot.evictionCount ?? 0,
            gardenStructurePlanCacheHitCount:
                structureFixtureBundle?.cacheSnapshot.hitCount ?? 0,
            gardenStructurePlanCacheMissCount:
                structureFixtureBundle?.cacheSnapshot.missCount ?? 0,
        });
    }, [structureFixtureBundle]);
    useEffect(() => {
        if (!gardenStructureVerticalSliceEnabled || !gameCamera) {
            return;
        }

        const publishCameraSnapshot = (snapshot: GameCameraSnapshot) => {
            updateGameProfileMetadata({
                gardenStructureCameraTargetX: snapshot.target[0],
                gardenStructureCameraTargetY: snapshot.target[1],
                gardenStructureCameraTargetZ: snapshot.target[2],
                gardenStructureCameraZoom: snapshot.zoom,
                gardenStructureCameraPositionX: snapshot.position[0],
                gardenStructureCameraPositionY: snapshot.position[1],
                gardenStructureCameraPositionZ: snapshot.position[2],
            });
        };

        return gameCamera.subscribe(publishCameraSnapshot);
    }, [gameCamera, gardenStructureVerticalSliceEnabled]);
    useEffect(() => {
        if (!gameCamera) {
            return;
        }

        if (structureBuildActive) {
            if (!structureFixtureBundle) {
                return;
            }
            if (!structureCameraSnapshotRef.current) {
                structureCameraSnapshotRef.current = gameCamera.getSnapshot();
            }
            let retryFrame: number | null = null;
            let retryFrameSignature: string | null = null;
            let focusAttemptCount = 0;
            const frameStructure = () => {
                const { worldBounds } = structureFixtureBundle.plan;
                const canvasBounds = gameCamera
                    .getDomElement()
                    ?.getBoundingClientRect();
                const frameSignature = [
                    structureFixtureBundle.plan.cacheKey,
                    canvasBounds?.width ?? 390,
                    canvasBounds?.height ?? 844,
                ].join(':');
                if (
                    structureCameraFrameSignatureRef.current === frameSignature
                ) {
                    return;
                }
                if (retryFrameSignature !== frameSignature) {
                    retryFrameSignature = frameSignature;
                    focusAttemptCount = 0;
                }
                if (
                    focusAttemptCount >= gardenStructureCameraFocusAttemptLimit
                ) {
                    return;
                }
                focusAttemptCount += 1;
                const cameraSnapshot = gameCamera.getSnapshot();
                const cameraOffset = [
                    cameraSnapshot.position[0] - cameraSnapshot.target[0],
                    cameraSnapshot.position[1] - cameraSnapshot.target[1],
                    cameraSnapshot.position[2] - cameraSnapshot.target[2],
                ] as const;
                const frame = resolveGardenStructureBuildCameraFrame({
                    cameraOffset,
                    depth: worldBounds.depth,
                    height: worldBounds.height,
                    viewportHeight: canvasBounds?.height ?? 844,
                    viewportWidth: canvasBounds?.width ?? 390,
                    width: worldBounds.width,
                });
                const structureCenter = new Vector3(
                    (worldBounds.minX + worldBounds.maxX) / 2,
                    (worldBounds.minHeight + worldBounds.maxHeight) / 2,
                    (worldBounds.minY + worldBounds.maxY) / 2,
                );
                const completeStructureFrame = () => {
                    structureCameraFrameSignatureRef.current = frameSignature;
                    focusAttemptCount = 0;
                    retryFrameSignature = null;
                    const points = [
                        [
                            worldBounds.minX,
                            worldBounds.minHeight,
                            worldBounds.minY,
                        ],
                        [
                            worldBounds.minX,
                            worldBounds.minHeight,
                            worldBounds.maxY,
                        ],
                        [
                            worldBounds.minX,
                            worldBounds.maxHeight,
                            worldBounds.minY,
                        ],
                        [
                            worldBounds.minX,
                            worldBounds.maxHeight,
                            worldBounds.maxY,
                        ],
                        [
                            worldBounds.maxX,
                            worldBounds.minHeight,
                            worldBounds.minY,
                        ],
                        [
                            worldBounds.maxX,
                            worldBounds.minHeight,
                            worldBounds.maxY,
                        ],
                        [
                            worldBounds.maxX,
                            worldBounds.maxHeight,
                            worldBounds.minY,
                        ],
                        [
                            worldBounds.maxX,
                            worldBounds.maxHeight,
                            worldBounds.maxY,
                        ],
                    ] as const;
                    const projected = points
                        .map(([x, y, z]) =>
                            gameCamera.projectToScreen(new Vector3(x, y, z)),
                        )
                        .filter(
                            (point): point is NonNullable<typeof point> =>
                                point !== null,
                        );
                    if (projected.length !== points.length) {
                        return;
                    }
                    const canvasLeft = canvasBounds?.left ?? 0;
                    const canvasTop = canvasBounds?.top ?? 0;
                    updateGameProfileMetadata({
                        gardenStructureProjectedBottom: Math.max(
                            ...projected.map((point) => point.y),
                        ),
                        gardenStructureProjectedLeft: Math.min(
                            ...projected.map((point) => point.x),
                        ),
                        gardenStructureProjectedRight: Math.max(
                            ...projected.map((point) => point.x),
                        ),
                        gardenStructureProjectedTop: Math.min(
                            ...projected.map((point) => point.y),
                        ),
                        gardenStructureVisibleBottom:
                            canvasTop + frame.visibleViewport.bottom,
                        gardenStructureVisibleLeft:
                            canvasLeft + frame.visibleViewport.left,
                        gardenStructureVisibleRight:
                            canvasLeft + frame.visibleViewport.right,
                        gardenStructureVisibleTop:
                            canvasTop + frame.visibleViewport.top,
                    });
                };
                updateGameProfileMetadata({
                    gardenStructureCameraMode: 'building',
                });
                gameCamera.focus(structureCenter, {
                    // Build Mode exclusively owns the overview camera. Apply
                    // its framing atomically so a slow avatar-camera handoff or
                    // demand-driven frame loop cannot leave the editor waiting
                    // for an animation that never starts.
                    immediate: true,
                    onComplete: completeStructureFrame,
                    screenPosition: frame.screenPosition,
                    zoom: frame.zoom,
                });
                // The stable API can briefly outlive the orthographic default
                // camera while the avatar camera unmounts. A rejected focus has
                // no completion callback, so retry without caching the frame.
                if (
                    structureCameraFrameSignatureRef.current !==
                        frameSignature &&
                    retryFrame === null &&
                    focusAttemptCount < gardenStructureCameraFocusAttemptLimit
                ) {
                    retryFrame = window.requestAnimationFrame(() => {
                        retryFrame = null;
                        frameStructure();
                    });
                }
            };
            frameStructure();
            const canvas = gameCamera.getDomElement();
            if (!canvas || typeof ResizeObserver === 'undefined') {
                return () => {
                    if (retryFrame !== null) {
                        window.cancelAnimationFrame(retryFrame);
                    }
                };
            }
            const observer = new ResizeObserver(frameStructure);
            observer.observe(canvas);
            return () => {
                observer.disconnect();
                if (retryFrame !== null) {
                    window.cancelAnimationFrame(retryFrame);
                }
            };
        }

        structureCameraFrameSignatureRef.current = null;
        const savedSnapshot = structureCameraSnapshotRef.current;
        if (!savedSnapshot) {
            return;
        }
        structureCameraSnapshotRef.current = null;
        updateGameProfileMetadata({
            gardenStructureCameraMode: 'restoring',
        });
        gameCamera.restore(savedSnapshot, {
            onComplete: () =>
                updateGameProfileMetadata({
                    gardenStructureCameraMode: 'browse',
                }),
        });
    }, [gameCamera, structureBuildActive, structureFixtureBundle]);
    useEffect(
        () => () => {
            const savedSnapshot = structureCameraSnapshotRef.current;
            if (savedSnapshot && gameCamera) {
                gameCamera.restore(savedSnapshot, { immediate: true });
                structureCameraSnapshotRef.current = null;
            }
        },
        [gameCamera],
    );
    useEffect(
        () => () => {
            structurePlanCacheRef.current?.clear();
        },
        [],
    );
    useEffect(() => {
        if (!gardenStructureVerticalSliceEnabled) {
            structurePlanCacheRef.current?.clear();
        }
    }, [gardenStructureVerticalSliceEnabled]);
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
            !gardenAvatarActive &&
            !structureBuildActive,
    );
    const adaptiveHighInteractionActive = useAdaptiveHighInteractionActivity(
        adaptiveHighEnabled || staticOpaqueCacheEnabled,
    );
    const [adaptiveHighProfile, setAdaptiveHighProfile] =
        useState<AdaptiveHighQualityLevelProfile>(adaptiveHighQualityLevels.L0);

    // Start non-critical metadata early, but don't block the first scene frame.
    const { isPending: isBlockVariantPending, mutate: updateBlockVariant } =
        useBlockVariant();
    const browseStructureRecords = useMemo(
        () =>
            garden?.structures.filter(
                (structure) => structure.id !== editedStructureId,
            ),
        [editedStructureId, garden?.structures],
    );
    const structureBaseHeightResolver = useMemo(
        () =>
            createGardenStructureSceneBaseHeightResolver({
                blockData,
                records: browseStructureRecords,
                stacks: garden?.stacks,
            }),
        [blockData, browseStructureRecords, garden?.stacks],
    );
    const savedStructureScene = useGardenStructureSceneSnapshot({
        gardenId: garden?.id,
        includeCollision: gardenAvatarEnabled,
        records: blockData ? browseStructureRecords : undefined,
        resolveBaseHeight: structureBaseHeightResolver,
    });
    const structureAvatarCollisionWorld = useMemo(() => {
        if (
            savedStructureScene.collisionWorld &&
            structureFixtureCollisionWorld
        ) {
            return mergeGardenAvatarCollisionWorlds(
                savedStructureScene.collisionWorld,
                structureFixtureCollisionWorld,
            );
        }
        return (
            savedStructureScene.collisionWorld ?? structureFixtureCollisionWorld
        );
    }, [savedStructureScene.collisionWorld, structureFixtureCollisionWorld]);
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
    useEffect(() => {
        if (!gardenStructureVerticalSliceEnabled && structureBuildSession) {
            setStructureBuildSession(null);
        }
    }, [
        gardenStructureVerticalSliceEnabled,
        setStructureBuildSession,
        structureBuildSession,
    ]);
    const isLoading = gardenLoading && transitionedGardenData === undefined;
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
            data-garden-structure-diagnostic-status={
                savedStructureScene.diagnostics.status
            }
            data-garden-structure-first-id={
                savedStructureScene.plan?.structures[0]?.structureId
            }
            data-garden-structure-collision-status={
                savedStructureScene.collisionWorld
                    ? 'ready'
                    : (garden?.structures?.length ?? 0) > 0
                      ? 'missing'
                      : 'empty'
            }
            data-garden-structure-rejected-count={
                savedStructureScene.diagnostics.rejectedRecordCount
            }
            data-garden-structure-rendered-count={
                savedStructureScene.plan?.structures.length ?? 0
            }
            data-garden-structure-warning-count={
                savedStructureScene.diagnostics.warningCount
            }
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
                    profileStats={Boolean(enableGameProfileController)}
                    fixedTimeSeconds={fixedTimeSeconds}
                    position={sceneCameraPosition}
                    quality={qualityProfile}
                    staticOpaqueCacheEnabled={staticOpaqueCacheEnabled}
                    zoom={sceneCameraZoom}
                    className={getGardenSceneTransitionClassName(
                        sceneVisible,
                        '!absolute',
                    )}
                    data-scene-garden-id={garden?.id}
                    data-scene-visible={sceneVisible}
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
                                                farmId={garden.farmId}
                                                noControls={
                                                    noControls ||
                                                    structureBuildActive
                                                }
                                                stack={stack}
                                                stacks={garden.stacks}
                                                weather={weather}
                                                weatherDisabled={
                                                    weatherDisabled
                                                }
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
                                {savedStructureScene.plan?.structures.length ? (
                                    <GardenStructureSceneLayerDynamic
                                        castShadows={
                                            qualityProfile.shadows &&
                                            zoom !== 'far'
                                        }
                                        renderProps={
                                            renderDetails && zoom !== 'far'
                                        }
                                        snapshot={savedStructureScene}
                                    />
                                ) : null}
                                {structureFixtureBundle ? (
                                    <GardenStructureVerticalSliceDynamic
                                        plan={structureFixtureBundle.plan}
                                    />
                                ) : null}
                                {renderDetails && zoom !== 'far' && (
                                    <Suspense fallback={null}>
                                        <SunflowerDropReward
                                            enabled={
                                                !isLocalSandbox &&
                                                !isMock &&
                                                !structureBuildActive
                                            }
                                            garden={garden}
                                            onClaimed={
                                                setSunflowerDropFlyOrigin
                                            }
                                        />
                                    </Suspense>
                                )}
                                <BlockInteractionLayer
                                    controlsEnabled={
                                        !noControls &&
                                        !gardenAvatarActive &&
                                        !structureBuildActive
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
                                        <Squirrels
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                        />
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
                                        <Bats
                                            farmId={garden?.farmId}
                                            gardenId={garden?.id}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
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
                                        <Goats
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                        <Sheep
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                        <LegacySheep
                                            farmId={garden?.farmId}
                                            stacks={garden?.stacks}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                        <HomeSpawnedPersistentPets
                                            stacks={garden?.stacks}
                                        />
                                    </Suspense>
                                )}
                                {gardenAvatarEnabled &&
                                    renderDetails &&
                                    zoom !== 'far' && (
                                        <Suspense fallback={null}>
                                            <GardenAvatar
                                                additionalCollisionWorld={
                                                    structureAvatarCollisionWorld
                                                }
                                                interactionDisabled={
                                                    structureBuildActive
                                                }
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
                                        <Ladybugs
                                            farmId={garden?.farmId}
                                            garden={garden}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                        <Slugs
                                            farmId={garden?.farmId}
                                            garden={garden}
                                            weather={weather}
                                            weatherDisabled={weatherDisabled}
                                        />
                                        <Butterflies
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
                                gestureResetKey={structureBuildActive}
                                initialPosition={sceneCameraPosition}
                                initialSnapshot={gardenHomeCamera}
                                initialTarget={sceneCameraTarget}
                                initialViewKey={gardenInitialViewKey}
                                initialZoom={sceneCameraZoom}
                                minZoom={structureBuildActive ? 8 : undefined}
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
                enabled={!isLocalSandbox && !isMock && !structureBuildActive}
                garden={garden}
            />
            {!hideHud && (
                <GameHud
                    debugHud={showDebugHud}
                    gardenStructureBuildEnabled={
                        gardenStructureVerticalSliceEnabled
                    }
                    gardenStructureDebugFixture={Boolean(
                        gardenStructureDebugFixture,
                    )}
                    gardenStructureDebugPlan={structureFixtureBundle?.plan}
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
