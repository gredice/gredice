'use client';

import {
    Canvas,
    type Vector3 as FiberVector3,
    useFrame,
    useThree,
} from '@react-three/fiber';
import {
    type HTMLAttributes,
    type PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import {
    Material,
    type Object3D,
    PCFShadowMap,
    type WebGLRendererParameters,
} from 'three';
import { ActorGroundingShadowProvider } from '../entities/animals/ActorGroundingShadows';
import {
    HoverOutlineEffect,
    HoverOutlineProvider,
} from '../entities/helpers/HoverOutline';
import { useOptionalGameState } from '../useGameState';
import { AdaptiveHighQualityController } from './AdaptiveHighQualityController';
import {
    type AdaptiveHighQualityLevelProfile,
    adaptiveHighQualityLevels,
} from './adaptiveHighQuality';
import { GardenLightProvider } from './GardenLightProvider';
import {
    createRuntimeFrameLoopProfileTelemetry,
    readGameProfileMetadata,
    updateGameProfileMetadata,
} from './gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from './gameQuality';
import { subscribeToRendererContextLoss } from './RendererContextLossReporter';
import { createRendererStatsPublisher } from './rendererStats';
import {
    SceneTimeProvider,
    sceneFrameRates,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from './SceneTime';
import { StaticOpaqueSceneCacheProvider } from './StaticOpaqueSceneCache';
import { WeatherSurfaceUniformProvider } from './WeatherSurfaceUniformProvider';

export type SceneProps = HTMLAttributes<HTMLDivElement> &
    PropsWithChildren<{
        adaptiveHighEnabled?: boolean;
        adaptiveHighInteractionActive?: boolean;
        adaptiveHighProfile?: AdaptiveHighQualityLevelProfile;
        adaptiveHighProfileControlEnabled?: boolean;
        baseFramesPerSecond?: number;
        continuousRenderLeasesEnabled?: boolean;
        debugStats?: boolean;
        fixedTimeSeconds?: number;
        onAdaptiveHighProfileChange?: (
            profile: AdaptiveHighQualityLevelProfile,
        ) => void;
        onContextLost?: () => void;
        pixelRatio?: number;
        position: FiberVector3;
        profileStats?: boolean;
        quality?: GameQualityProfile;
        rendererOptions?: WebGLRendererParameters;
        staticOpaqueCacheEnabled?: boolean;
        suspendWhenOffscreen?: boolean;
        zoom: number;
    }>;

const rendererStatsUpdateMs = 500;
const wireframeOverrideRefreshMs = 250;

type WireframeMaterial = Material & { wireframe: boolean };
type WireframeMaterialState = {
    material: WireframeMaterial;
    wireframe: boolean;
};

function isMaterial(value: unknown): value is Material {
    return value instanceof Material;
}

function isWireframeMaterial(
    material: Material,
): material is WireframeMaterial {
    return 'wireframe' in material && typeof material.wireframe === 'boolean';
}

function getObjectMaterials(object: Object3D) {
    if (!('material' in object)) {
        return [];
    }

    const { material } = object;
    if (Array.isArray(material)) {
        return material.filter(isMaterial);
    }

    return isMaterial(material) ? [material] : [];
}

function applyWireframeOverride(
    scene: Object3D,
    previousStates: Map<string, WireframeMaterialState>,
) {
    scene.traverse((object) => {
        for (const material of getObjectMaterials(object)) {
            if (!isWireframeMaterial(material)) {
                continue;
            }

            if (!previousStates.has(material.uuid)) {
                previousStates.set(material.uuid, {
                    material,
                    wireframe: material.wireframe,
                });
            }

            if (!material.wireframe) {
                material.wireframe = true;
                material.needsUpdate = true;
            }
        }
    });
}

function restoreWireframeOverride(
    previousStates: Map<string, WireframeMaterialState>,
) {
    for (const { material, wireframe } of previousStates.values()) {
        if (material.wireframe !== wireframe) {
            material.wireframe = wireframe;
            material.needsUpdate = true;
        }
    }

    previousStates.clear();
}

function RendererStatsReporter() {
    const lastUpdateRef = useRef(0);
    const publisherRef = useRef<ReturnType<
        typeof createRendererStatsPublisher
    > | null>(null);

    useEffect(() => {
        const publisher = createRendererStatsPublisher({
            publish: updateGameProfileMetadata,
            readCurrentReceipt: () =>
                readGameProfileMetadata()?.rendererStatsReceiptCount,
        });
        publisherRef.current = publisher;
        return () => {
            publisher.dispose();
            if (publisherRef.current === publisher) {
                publisherRef.current = null;
            }
        };
    }, []);

    useFrame(({ gl }) => {
        const now = performance.now();
        if (now - lastUpdateRef.current < rendererStatsUpdateMs) {
            return;
        }

        lastUpdateRef.current = now;
        publisherRef.current?.schedule(gl);
    });

    return null;
}

function SceneWireframeMode({ enabled }: { enabled: boolean }) {
    const scene = useThree((state) => state.scene);
    const previousStatesRef = useRef(new Map<string, WireframeMaterialState>());
    const lastApplyRef = useRef(0);
    const requestRender = useSceneRenderRequest();
    useSceneTimeInvalidation(
        'wireframe-debug',
        enabled,
        1_000 / wireframeOverrideRefreshMs,
    );

    const applyOverride = useCallback(() => {
        applyWireframeOverride(scene, previousStatesRef.current);
    }, [scene]);

    useEffect(() => {
        const previousStates = previousStatesRef.current;

        if (!enabled) {
            const hadOverrides = previousStates.size > 0;
            restoreWireframeOverride(previousStates);
            if (hadOverrides) {
                requestRender('wireframe-debug-disabled');
            }
            return;
        }

        applyOverride();
        requestRender('wireframe-debug-enabled');
        return () => {
            restoreWireframeOverride(previousStates);
            requestRender('wireframe-debug-disabled');
        };
    }, [applyOverride, enabled, requestRender]);

    useFrame(() => {
        if (enabled) {
            const now = performance.now();
            if (now - lastApplyRef.current < wireframeOverrideRefreshMs) {
                return;
            }

            lastApplyRef.current = now;
            applyOverride();
        }
    });

    return null;
}

function SceneDebugName() {
    const scene = useThree((state) => state.scene);

    useEffect(() => {
        scene.name = 'GrediceGameScene';
    }, [scene]);

    return null;
}

export function Scene({
    adaptiveHighEnabled = false,
    adaptiveHighInteractionActive = false,
    adaptiveHighProfile = adaptiveHighQualityLevels.L0,
    adaptiveHighProfileControlEnabled = false,
    baseFramesPerSecond,
    children,
    continuousRenderLeasesEnabled,
    debugStats,
    fixedTimeSeconds,
    onAdaptiveHighProfileChange,
    onContextLost,
    pixelRatio,
    position,
    profileStats = false,
    quality,
    rendererOptions,
    staticOpaqueCacheEnabled = false,
    suspendWhenOffscreen,
    zoom,
    ...rest
}: SceneProps) {
    const contextLossCallbackRef = useRef(onContextLost);
    const contextLossCleanupRef = useRef<(() => void) | null>(null);
    const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        contextLossCleanupRef.current?.();
        contextLossCleanupRef.current = null;
        if (!canvas || !contextLossCallbackRef.current) {
            return;
        }
        contextLossCleanupRef.current = subscribeToRendererContextLoss({
            eventTarget: canvas,
            onContextLost: () => contextLossCallbackRef.current?.(),
        });
    }, []);

    useEffect(
        () => () => {
            contextLossCleanupRef.current?.();
            contextLossCleanupRef.current = null;
        },
        [],
    );

    useEffect(() => {
        contextLossCallbackRef.current = onContextLost;
    }, [onContextLost]);

    const qualityProfile = quality ?? resolveGameQualityProfile();
    const adaptiveHighActive =
        adaptiveHighEnabled && qualityProfile.tier === 'high';
    const effectiveDprCap = adaptiveHighActive
        ? adaptiveHighProfile.dpr
        : qualityProfile.dpr;
    const ambientFramesPerSecond =
        baseFramesPerSecond ??
        (adaptiveHighActive
            ? adaptiveHighProfile.ambientFramesPerSecond
            : sceneFrameRates.ambient);
    const runtimeFrameLoop = useMemo(
        () =>
            profileStats ? createRuntimeFrameLoopProfileTelemetry() : undefined,
        [profileStats],
    );
    const wireframeDebugVisible = useOptionalGameState(
        (state) => state.wireframeDebugVisible,
        false,
    );
    const staticOpaqueCacheActive =
        staticOpaqueCacheEnabled && qualityProfile.tier === 'high';
    const staticOpaqueCacheQualityKey = [
        qualityProfile.cloudShadowMode,
        qualityProfile.dpr,
        qualityProfile.shadowMapSize,
        qualityProfile.shadows ? 1 : 0,
        qualityProfile.tier,
    ].join('|');

    useEffect(() => {
        updateGameProfileMetadata({
            dprCap: effectiveDprCap,
            groundDecorationDensity: qualityProfile.groundDecorationDensity,
            qualityTier: qualityProfile.tier,
            shadowMapSize: qualityProfile.shadowMapSize,
            shadowsEnabled: qualityProfile.shadows,
            snowOverlayMinCoverage: qualityProfile.snowOverlayMinCoverage,
        });
    }, [effectiveDprCap, qualityProfile]);

    useEffect(() => {
        if (!runtimeFrameLoop) {
            return;
        }

        updateGameProfileMetadata({ runtimeFrameLoop });
        return () => {
            if (
                readGameProfileMetadata()?.runtimeFrameLoop === runtimeFrameLoop
            ) {
                updateGameProfileMetadata({ runtimeFrameLoop: undefined });
            }
        };
    }, [runtimeFrameLoop]);

    return (
        <Canvas
            orthographic
            dpr={pixelRatio ?? [1, effectiveDprCap]}
            gl={rendererOptions}
            shadows={
                qualityProfile.shadows
                    ? {
                          type: PCFShadowMap,
                          enabled: true,
                      }
                    : false
            }
            camera={{
                position,
                zoom,
                far: 10000,
                near: 0.01,
            }}
            {...rest}
            frameloop="demand"
            ref={handleCanvasRef}
        >
            <SceneTimeProvider
                ambientFramesPerSecond={ambientFramesPerSecond}
                // An explicit override retains the compatibility heartbeat for
                // isolated consumers. Normal scenes are semantic-owner only.
                baseFramesPerSecond={baseFramesPerSecond ?? 0}
                continuousRenderLeasesEnabled={continuousRenderLeasesEnabled}
                fixedTimeSeconds={fixedTimeSeconds}
                runtimeFrameLoop={runtimeFrameLoop}
                suspendWhenOffscreen={suspendWhenOffscreen}
            >
                <GardenLightProvider qualityTier={qualityProfile.tier}>
                    <AdaptiveHighQualityController
                        effectiveDprCeiling={qualityProfile.dpr}
                        enabled={adaptiveHighActive}
                        interactionActive={adaptiveHighInteractionActive}
                        onProfileChange={
                            onAdaptiveHighProfileChange ?? (() => undefined)
                        }
                        profileControlEnabled={
                            adaptiveHighActive &&
                            adaptiveHighProfileControlEnabled
                        }
                    />
                    <WeatherSurfaceUniformProvider>
                        <StaticOpaqueSceneCacheProvider
                            enabled={staticOpaqueCacheActive}
                            interactionActive={adaptiveHighInteractionActive}
                            qualityKey={staticOpaqueCacheQualityKey}
                            wireframe={Boolean(
                                debugStats && wireframeDebugVisible,
                            )}
                        >
                            <ActorGroundingShadowProvider
                                enabled={qualityProfile.shadows}
                            >
                                <HoverOutlineProvider>
                                    <SceneDebugName />
                                    {(debugStats || profileStats) && (
                                        <RendererStatsReporter />
                                    )}
                                    <SceneWireframeMode
                                        enabled={Boolean(
                                            debugStats && wireframeDebugVisible,
                                        )}
                                    />
                                    {children}
                                    <HoverOutlineEffect />
                                </HoverOutlineProvider>
                            </ActorGroundingShadowProvider>
                        </StaticOpaqueSceneCacheProvider>
                    </WeatherSurfaceUniformProvider>
                </GardenLightProvider>
            </SceneTimeProvider>
        </Canvas>
    );
}
