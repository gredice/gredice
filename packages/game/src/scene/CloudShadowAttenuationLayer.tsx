'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    type MutableRefObject,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { CanvasTexture, ClampToEdgeWrapping, LinearFilter } from 'three';
import {
    type CloudShadowAttenuationConfig,
    type CloudShadowBounds,
    type CloudShadowMaterialLeaseMap,
    type CloudShadowProjection,
    type CloudShadowSample,
    getCloudShadowAttenuationMaterialCandidateRevision,
    getCloudShadowAttenuationMaterialUniforms,
    releaseCloudShadowAttenuationMaterials,
    resolveCloudShadowAttenuationActivation,
    resolveCloudShadowAttenuationUpdateTick,
    resolveCloudShadowMaskPlacement,
    syncCloudShadowAttenuationMaterials,
} from './cloudShadowAttenuation';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import type { GameCloudShadowMode } from './gameQuality';

const materialScanMs = 1_000;

type CloudShadowMaskSurface = {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: CanvasTexture;
};

function createCloudShadowMaskSurface(resolution: number) {
    if (typeof document === 'undefined' || resolution <= 0) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, resolution, resolution);

    const texture = new CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;

    return { canvas, context, texture };
}

function drawCloudShadowMask({
    bounds,
    cloudAlphaCanvas,
    projection,
    samples,
    surface,
}: {
    bounds: CloudShadowBounds;
    cloudAlphaCanvas: HTMLCanvasElement;
    projection: CloudShadowProjection;
    samples: readonly CloudShadowSample[];
    surface: CloudShadowMaskSurface;
}) {
    const { canvas, context } = surface;
    context.save();
    context.globalCompositeOperation = 'copy';
    context.globalAlpha = 1;
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const sample of samples) {
        if (sample.opacity <= 0.001) {
            continue;
        }

        const placement = resolveCloudShadowMaskPlacement({
            bounds,
            projection,
            resolution: canvas.width,
            sample,
        });
        context.save();
        context.globalAlpha = placement.alpha;
        context.translate(placement.x, placement.y);
        context.rotate(placement.rotation);
        context.drawImage(
            cloudAlphaCanvas,
            -placement.width / 2,
            -placement.height / 2,
            placement.width,
            placement.height,
        );
        context.restore();
    }
    context.restore();
    surface.texture.needsUpdate = true;
}

export function CloudShadowAttenuation({
    bounds,
    cloudAlphaCanvas,
    config,
    mode,
    projection,
    samplesRef,
    strength,
}: {
    bounds: CloudShadowBounds;
    cloudAlphaCanvas: HTMLCanvasElement;
    config: CloudShadowAttenuationConfig;
    mode: GameCloudShadowMode;
    projection: CloudShadowProjection;
    samplesRef: MutableRefObject<CloudShadowSample[]>;
    strength: number;
}) {
    const scene = useThree((state) => state.scene);
    const [activated, setActivated] = useState(() =>
        resolveCloudShadowAttenuationActivation({
            activated: false,
            strength,
        }),
    );
    const surfaceResolution =
        activated && config.enabled ? config.maskResolution : 0;
    const surface = useMemo(
        () => createCloudShadowMaskSurface(surfaceResolution),
        [surfaceResolution],
    );
    const leasesRef = useRef<CloudShadowMaterialLeaseMap>(new Map());
    const attenuationActiveRef = useRef(false);
    const nextMaterialScanAtRef = useRef(0);
    const materialCandidateRevisionRef = useRef(-1);
    const nextUpdateAtRef = useRef(0);
    const forceUpdateRef = useRef(true);
    const updateCountRef = useRef(0);
    const uniforms = getCloudShadowAttenuationMaterialUniforms();
    const materialIntegrationEnabled =
        activated && config.enabled && surface !== null;
    const maskInvalidationKey = [
        bounds.maxX,
        bounds.maxZ,
        bounds.minX,
        bounds.minZ,
        cloudAlphaCanvas.width,
        cloudAlphaCanvas.height,
        projection.x,
        projection.z,
        surface?.texture.uuid ?? 'none',
    ].join('|');

    useEffect(() => {
        if (
            resolveCloudShadowAttenuationActivation({
                activated,
                strength,
            }) !== activated
        ) {
            setActivated(true);
        }
    }, [activated, strength]);

    useEffect(() => {
        void maskInvalidationKey;
        forceUpdateRef.current = true;
        nextUpdateAtRef.current = 0;
    }, [maskInvalidationKey]);

    useEffect(() => {
        return () => {
            surface?.texture.dispose();
        };
    }, [surface]);

    useEffect(() => {
        updateGameProfileMetadata({
            cloudAttenuationMaskResolution: materialIntegrationEnabled
                ? config.maskResolution
                : 0,
            cloudAttenuationUpdateCount: updateCountRef.current,
            cloudAttenuationUpdateMs: materialIntegrationEnabled
                ? config.updateMs
                : 0,
        });
    }, [config.maskResolution, config.updateMs, materialIntegrationEnabled]);

    useLayoutEffect(() => {
        const leases = leasesRef.current;
        const materialCount = syncCloudShadowAttenuationMaterials({
            enabled: materialIntegrationEnabled,
            leases,
            root: scene,
            uniforms,
        });
        updateGameProfileMetadata({
            cloudAttenuationMaterialCount: materialCount,
        });
        materialCandidateRevisionRef.current =
            getCloudShadowAttenuationMaterialCandidateRevision();

        return () => {
            releaseCloudShadowAttenuationMaterials(leases);
            updateGameProfileMetadata({
                cloudAttenuationMaterialCount: 0,
            });
        };
    }, [materialIntegrationEnabled, scene, uniforms]);

    useEffect(
        () => () => {
            updateGameProfileMetadata({
                cloudAttenuationMaskResolution: 0,
                cloudAttenuationUpdateCount: 0,
                cloudAttenuationUpdateMs: 0,
            });
        },
        [],
    );

    useFrame(() => {
        if (!activated) {
            return;
        }

        const attenuationActive =
            materialIntegrationEnabled &&
            strength > 0.001 &&
            samplesRef.current.some((sample) => sample.opacity > 0.001);
        if (attenuationActive && !attenuationActiveRef.current) {
            forceUpdateRef.current = true;
            nextUpdateAtRef.current = 0;
        }
        attenuationActiveRef.current = attenuationActive;

        uniforms.bounds.value.set(
            bounds.minX,
            bounds.minZ,
            1 / Math.max(0.001, bounds.maxX - bounds.minX),
            1 / Math.max(0.001, bounds.maxZ - bounds.minZ),
        );
        uniforms.hardness.value = mode === 'hard' ? 1 : 0;
        uniforms.map.value = surface?.texture ?? null;
        uniforms.projection.value.set(projection.x, projection.z);
        uniforms.strength.value = attenuationActive ? strength : 0;

        const now = performance.now();
        const materialCandidateRevision =
            getCloudShadowAttenuationMaterialCandidateRevision();
        if (
            materialCandidateRevision !==
                materialCandidateRevisionRef.current ||
            now >= nextMaterialScanAtRef.current
        ) {
            materialCandidateRevisionRef.current = materialCandidateRevision;
            nextMaterialScanAtRef.current = now + materialScanMs;
            const materialCount = syncCloudShadowAttenuationMaterials({
                enabled: materialIntegrationEnabled,
                leases: leasesRef.current,
                root: scene,
                uniforms,
            });
            updateGameProfileMetadata({
                cloudAttenuationMaterialCount: materialCount,
            });
        }

        if (!surface) {
            return;
        }

        const tick = resolveCloudShadowAttenuationUpdateTick({
            enabled: attenuationActive,
            force: forceUpdateRef.current,
            nextUpdateAt: nextUpdateAtRef.current,
            now,
            updateMs: config.updateMs,
        });
        nextUpdateAtRef.current = tick.nextUpdateAt;
        if (!tick.shouldUpdate) {
            return;
        }

        forceUpdateRef.current = false;
        drawCloudShadowMask({
            bounds,
            cloudAlphaCanvas,
            projection,
            samples: samplesRef.current,
            surface,
        });
        updateCountRef.current += 1;
        updateGameProfileMetadata({
            cloudAttenuationUpdateCount: updateCountRef.current,
        });
    });

    return null;
}
