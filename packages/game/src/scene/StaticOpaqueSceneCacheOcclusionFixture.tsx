'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type Group,
    type Mesh,
    MeshBasicMaterial,
    OrthographicCamera,
    PlaneGeometry,
    Vector3,
} from 'three';
import {
    readGameProfileMetadata,
    updateGameProfileMetadata,
} from './gameProfileMetadata';
import { useSceneRenderRequest, useSceneTimeInvalidation } from './SceneTime';
import { StaticOpaqueSceneCacheBoundary } from './StaticOpaqueSceneCache';

const backgroundColor = [255, 0, 0] as const;
const occluderColor = [0, 0, 255] as const;
const foregroundColor = [0, 255, 0] as const;
const colorChannelTolerance = 8;
const minimumMatchRatio = 0.96;
const maximumLeakRatio = 0.04;
const probeSize = 5;
const stableArmingHitCount = 12;
const settleHitCount = 1;
const verifiedHitCount = 3;

const anchorNdcX = 0.62;
const anchorNdcY = 0.65;
const backgroundProbeNdcX = 0.49;
const occludedProbeNdcX = 0.57;
const foregroundProbeNdcX = 0.68;
const backgroundWidthNdc = 0.32;
const occluderWidthNdc = 0.2;
const foregroundWidthNdc = 0.07;
const fixtureHeightNdc = 0.18;
const foregroundHeightNdc = 0.12;

type FixtureState = {
    armingCaptureCount: number | null;
    armingHitFrameCount: number | null;
    armingStableHitCount: number;
    backgroundWitnessMinimumMatchRatio: number;
    captureCountAtTransition: number | null;
    foregroundMinimumMatchRatio: number;
    hitFrameCountAtTransition: number | null;
    lastObservedHitFrameCount: number | null;
    occludedBackgroundLeakMaximumRatio: number;
    occluderMinimumMatchRatio: number;
    pass: boolean;
    phase: 'arming' | 'failed' | 'passed' | 'verifying';
    transitionCount: number;
    verifiedHitFrameCount: number;
};

function createFixtureState(): FixtureState {
    return {
        armingCaptureCount: null,
        armingHitFrameCount: null,
        armingStableHitCount: 0,
        backgroundWitnessMinimumMatchRatio: 1,
        captureCountAtTransition: null,
        foregroundMinimumMatchRatio: 1,
        hitFrameCountAtTransition: null,
        lastObservedHitFrameCount: null,
        occludedBackgroundLeakMaximumRatio: 0,
        occluderMinimumMatchRatio: 1,
        pass: false,
        phase: 'arming',
        transitionCount: 0,
        verifiedHitFrameCount: 0,
    };
}

function publishFixtureState(state: FixtureState) {
    updateGameProfileMetadata({
        staticOpaqueSceneCacheOcclusionBackgroundWitnessMinimumMatchRatio:
            state.backgroundWitnessMinimumMatchRatio,
        staticOpaqueSceneCacheOcclusionCaptureCountAtTransition:
            state.captureCountAtTransition,
        staticOpaqueSceneCacheOcclusionFixtureEnabled: true,
        staticOpaqueSceneCacheOcclusionFixturePass: state.pass,
        staticOpaqueSceneCacheOcclusionFixtureState: state.phase,
        staticOpaqueSceneCacheOcclusionForegroundMinimumMatchRatio:
            state.foregroundMinimumMatchRatio,
        staticOpaqueSceneCacheOcclusionHitFrameCountAtTransition:
            state.hitFrameCountAtTransition,
        staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio:
            state.occludedBackgroundLeakMaximumRatio,
        staticOpaqueSceneCacheOcclusionOccluderMinimumMatchRatio:
            state.occluderMinimumMatchRatio,
        staticOpaqueSceneCacheOcclusionTransitionCount: state.transitionCount,
        staticOpaqueSceneCacheOcclusionVerifiedHitFrameCount:
            state.verifiedHitFrameCount,
    });
}

function matchRatio(
    pixels: Uint8Array,
    expected: readonly [number, number, number],
) {
    let matches = 0;
    const pixelCount = pixels.length / 4;
    for (let offset = 0; offset < pixels.length; offset += 4) {
        const error = Math.max(
            Math.abs(pixels[offset] - expected[0]),
            Math.abs(pixels[offset + 1] - expected[1]),
            Math.abs(pixels[offset + 2] - expected[2]),
        );
        if (error <= colorChannelTolerance) {
            matches += 1;
        }
    }
    return matches / pixelCount;
}

function readProbe(
    context: WebGLRenderingContext | WebGL2RenderingContext,
    ndcX: number,
    ndcY: number,
) {
    const radius = Math.floor(probeSize / 2);
    const centerX = Math.round(
        ((ndcX + 1) / 2) * (context.drawingBufferWidth - 1),
    );
    const centerY = Math.round(
        ((ndcY + 1) / 2) * (context.drawingBufferHeight - 1),
    );
    const x = Math.max(
        0,
        Math.min(context.drawingBufferWidth - probeSize, centerX - radius),
    );
    const y = Math.max(
        0,
        Math.min(context.drawingBufferHeight - probeSize, centerY - radius),
    );
    const pixels = new Uint8Array(probeSize * probeSize * 4);
    context.readPixels(
        x,
        y,
        probeSize,
        probeSize,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixels,
    );
    return pixels;
}

function setTerminalState(state: FixtureState, pass: boolean) {
    state.pass = pass;
    state.phase = pass ? 'passed' : 'failed';
    publishFixtureState(state);
}

export function StaticOpaqueSceneCacheOcclusionFixture() {
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const [fixtureActive, setFixtureActive] = useState(true);
    const rootRef = useRef<Group>(null);
    const dynamicGroupRef = useRef<Group>(null);
    const backgroundRef = useRef<Mesh>(null);
    const occluderRef = useRef<Mesh>(null);
    const foregroundRef = useRef<Mesh>(null);
    const cameraScaleRef = useRef(new Vector3());
    const stateRef = useRef(createFixtureState());
    const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
    const backgroundMaterial = useMemo(() => {
        const material = new MeshBasicMaterial({ color: 0xff0000 });
        material.fog = false;
        material.toneMapped = false;
        return material;
    }, []);
    const occluderMaterial = useMemo(() => {
        const material = new MeshBasicMaterial({ color: 0x0000ff });
        material.fog = false;
        material.toneMapped = false;
        return material;
    }, []);
    const foregroundMaterial = useMemo(() => {
        const material = new MeshBasicMaterial({ color: 0x00ff00 });
        material.fog = false;
        material.toneMapped = false;
        return material;
    }, []);
    useSceneTimeInvalidation('profile-static-cache-occlusion', fixtureActive);
    const finishFixture = useCallback((pass: boolean) => {
        setTerminalState(stateRef.current, pass);
        setFixtureActive(false);
    }, []);

    useEffect(() => {
        publishFixtureState(stateRef.current);
        return () => {
            geometry.dispose();
            backgroundMaterial.dispose();
            occluderMaterial.dispose();
            foregroundMaterial.dispose();
            updateGameProfileMetadata({
                staticOpaqueSceneCacheOcclusionFixtureEnabled: false,
            });
        };
    }, [backgroundMaterial, foregroundMaterial, geometry, occluderMaterial]);

    useFrame(() => {
        const root = rootRef.current;
        const dynamicGroup = dynamicGroupRef.current;
        const background = backgroundRef.current;
        const occluder = occluderRef.current;
        const foreground = foregroundRef.current;
        if (!root || !dynamicGroup || !background || !occluder || !foreground) {
            return;
        }
        if (!(camera instanceof OrthographicCamera)) {
            finishFixture(false);
            return;
        }

        camera.updateWorldMatrix(true, false);
        camera.matrixWorld.decompose(
            root.position,
            root.quaternion,
            cameraScaleRef.current,
        );
        root.scale.set(1, 1, 1);

        const halfWidth = (camera.right - camera.left) / (2 * camera.zoom);
        const halfHeight = (camera.top - camera.bottom) / (2 * camera.zoom);
        const centerX = (camera.right + camera.left) / 2;
        const centerY = (camera.top + camera.bottom) / 2;
        const anchorX = centerX + anchorNdcX * halfWidth;
        const anchorY = centerY + anchorNdcY * halfHeight;
        background.position.set(anchorX, anchorY, -30);
        background.scale.set(
            backgroundWidthNdc * halfWidth,
            fixtureHeightNdc * halfHeight,
            1,
        );
        occluder.position.set(anchorX, anchorY, -20);
        occluder.scale.set(
            occluderWidthNdc * halfWidth,
            fixtureHeightNdc * halfHeight,
            1,
        );
        foreground.position.set(
            centerX + foregroundProbeNdcX * halfWidth,
            anchorY,
            -10,
        );
        foreground.scale.set(
            foregroundWidthNdc * halfWidth,
            foregroundHeightNdc * halfHeight,
            1,
        );

        const fixtureState = stateRef.current;
        dynamicGroup.position.x =
            fixtureState.phase === 'arming' ? halfWidth * 4 : 0;
        const profile = readGameProfileMetadata();
        if (fixtureState.phase !== 'arming') {
            return;
        }

        const captureCount = profile?.staticOpaqueSceneCacheCaptureCount;
        const hitFrameCount = profile?.staticOpaqueSceneCacheHitFrameCount;
        if (
            profile?.staticOpaqueSceneCacheSupported !== true ||
            profile.staticOpaqueSceneCacheState !== 'ready' ||
            typeof captureCount !== 'number' ||
            captureCount < 1 ||
            typeof hitFrameCount !== 'number'
        ) {
            fixtureState.armingCaptureCount = null;
            fixtureState.armingHitFrameCount = null;
            fixtureState.armingStableHitCount = 0;
            return;
        }

        if (fixtureState.armingCaptureCount !== captureCount) {
            fixtureState.armingCaptureCount = captureCount;
            fixtureState.armingHitFrameCount = hitFrameCount;
            fixtureState.armingStableHitCount = 0;
            return;
        }
        if (
            fixtureState.armingHitFrameCount === null ||
            hitFrameCount <= fixtureState.armingHitFrameCount
        ) {
            return;
        }

        fixtureState.armingStableHitCount +=
            hitFrameCount - fixtureState.armingHitFrameCount;
        fixtureState.armingHitFrameCount = hitFrameCount;
        if (fixtureState.armingStableHitCount >= stableArmingHitCount) {
            fixtureState.captureCountAtTransition = captureCount;
            fixtureState.hitFrameCountAtTransition = hitFrameCount;
            fixtureState.lastObservedHitFrameCount = hitFrameCount;
            fixtureState.phase = 'verifying';
            fixtureState.transitionCount += 1;
            dynamicGroup.position.x = 0;
            dynamicGroup.updateWorldMatrix(true, true);
            publishFixtureState(fixtureState);
            requestRender('profile-static-cache-occlusion-transition');
        }
    }, 0.5);

    useFrame(() => {
        const fixtureState = stateRef.current;
        if (fixtureState.phase !== 'verifying') {
            return;
        }

        const profile = readGameProfileMetadata();
        const captureCount = profile?.staticOpaqueSceneCacheCaptureCount;
        const hitFrameCount = profile?.staticOpaqueSceneCacheHitFrameCount;
        if (
            profile?.staticOpaqueSceneCacheSupported !== true ||
            profile.staticOpaqueSceneCacheState !== 'ready' ||
            typeof captureCount !== 'number' ||
            captureCount !== fixtureState.captureCountAtTransition
        ) {
            finishFixture(false);
            return;
        }
        if (
            typeof hitFrameCount !== 'number' ||
            hitFrameCount <=
                (fixtureState.lastObservedHitFrameCount ??
                    Number.NEGATIVE_INFINITY)
        ) {
            requestRender('profile-static-cache-occlusion-verify');
            return;
        }

        fixtureState.lastObservedHitFrameCount = hitFrameCount;
        const hitsAfterTransition =
            hitFrameCount - (fixtureState.hitFrameCountAtTransition ?? 0);
        if (hitsAfterTransition <= settleHitCount) {
            requestRender('profile-static-cache-occlusion-settle');
            return;
        }

        if (!gl.capabilities.isWebGL2) {
            finishFixture(false);
            return;
        }
        const context = gl.getContext();
        const backgroundPixels = readProbe(
            context,
            backgroundProbeNdcX,
            anchorNdcY,
        );
        const occludedPixels = readProbe(
            context,
            occludedProbeNdcX,
            anchorNdcY,
        );
        const foregroundPixels = readProbe(
            context,
            foregroundProbeNdcX,
            anchorNdcY,
        );
        fixtureState.backgroundWitnessMinimumMatchRatio = Math.min(
            fixtureState.backgroundWitnessMinimumMatchRatio,
            matchRatio(backgroundPixels, backgroundColor),
        );
        fixtureState.occluderMinimumMatchRatio = Math.min(
            fixtureState.occluderMinimumMatchRatio,
            matchRatio(occludedPixels, occluderColor),
        );
        fixtureState.foregroundMinimumMatchRatio = Math.min(
            fixtureState.foregroundMinimumMatchRatio,
            matchRatio(foregroundPixels, foregroundColor),
        );
        fixtureState.occludedBackgroundLeakMaximumRatio = Math.max(
            fixtureState.occludedBackgroundLeakMaximumRatio,
            matchRatio(occludedPixels, backgroundColor),
        );
        fixtureState.verifiedHitFrameCount += 1;
        publishFixtureState(fixtureState);

        if (fixtureState.verifiedHitFrameCount >= verifiedHitCount) {
            finishFixture(
                fixtureState.backgroundWitnessMinimumMatchRatio >=
                    minimumMatchRatio &&
                    fixtureState.occluderMinimumMatchRatio >=
                        minimumMatchRatio &&
                    fixtureState.foregroundMinimumMatchRatio >=
                        minimumMatchRatio &&
                    fixtureState.occludedBackgroundLeakMaximumRatio <=
                        maximumLeakRatio,
            );
            return;
        }
        requestRender('profile-static-cache-occlusion-verify');
    }, 2);

    return (
        <group ref={rootRef} name="ProfileStaticCacheOcclusionFixture">
            <StaticOpaqueSceneCacheBoundary
                contentKey="profile-static-cache-occlusion-v1"
                group="static-props"
                instanceCount={1}
                submissionCount={1}
                triangleCount={2}
            >
                <mesh
                    ref={occluderRef}
                    frustumCulled={false}
                    geometry={geometry}
                    material={occluderMaterial}
                    name="ProfileStaticCacheOccluder"
                    raycast={() => null}
                />
            </StaticOpaqueSceneCacheBoundary>
            <group
                ref={dynamicGroupRef}
                name="ProfileStaticCacheDynamicObjects"
            >
                <mesh
                    ref={backgroundRef}
                    frustumCulled={false}
                    geometry={geometry}
                    material={backgroundMaterial}
                    name="ProfileStaticCacheDynamicBackground"
                    raycast={() => null}
                />
                <mesh
                    ref={foregroundRef}
                    frustumCulled={false}
                    geometry={geometry}
                    material={foregroundMaterial}
                    name="ProfileStaticCacheDynamicForeground"
                    raycast={() => null}
                />
            </group>
        </group>
    );
}
