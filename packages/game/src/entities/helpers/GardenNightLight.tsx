'use client';

import { useContext, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, type PointLight, type Sprite } from 'three';
import {
    type GardenEmissiveMaterialRef,
    useGardenLightRegistry,
} from '../../scene/GardenLightProvider';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import { EntityPreviewContext } from './EntityPreviewContext';
import { getGardenLightHaloTexture } from './gardenLightHalo';
import {
    resolveGardenNightLightEmissivePeakIntensity,
    resolveGardenNightLightIntensity,
} from './nightGardenLight';

const emptyEmissiveMaterialRefs: readonly GardenEmissiveMaterialRef[] = [];

/** Default glow sprite: about a third of a tile across at full night. */
const defaultHalo = { opacity: 0.55, size: 0.6 } as const;

export function GardenNightLight({
    color,
    glowAmountOverride,
    decay = 1.8,
    distance,
    emissiveBaseIntensity = 0.2,
    emissiveMaterialRefs = emptyEmissiveMaterialRefs,
    emissivePeakIntensity,
    halo = defaultHalo,
    lightIntensity,
    lightKey,
    position,
}: {
    color: string;
    glowAmountOverride?: 0 | 1;
    decay?: number;
    distance: number;
    emissiveBaseIntensity?: number;
    emissiveMaterialRefs?: readonly GardenEmissiveMaterialRef[];
    emissivePeakIntensity: number;
    /**
     * Soft additive glow around the source at night, or false for none.
     * `size` is its width in tiles, `opacity` its strength at full night.
     */
    halo?: false | { opacity: number; size: number };
    lightIntensity: number;
    lightKey: string;
    position: readonly [number, number, number];
}) {
    const requestRender = useSceneRenderRequest();
    const preview = useContext(EntityPreviewContext);
    const registry = useGardenLightRegistry();
    const lightRef = useRef<PointLight>(null);
    const haloRef = useRef<Sprite>(null);
    const haloOpacity = halo ? halo.opacity : 0;
    const haloRegistration = useMemo(
        () =>
            haloOpacity > 0
                ? { opacity: haloOpacity, ref: haloRef }
                : undefined,
        [haloOpacity],
    );

    useEffect(() => {
        if (preview) return;
        const unregister = registry.register({
            glowAmountOverride,
            emissiveBaseIntensity,
            emissiveMaterialRefs,
            emissivePeakIntensity: resolveGardenNightLightEmissivePeakIntensity(
                emissivePeakIntensity,
            ),
            halo: haloRegistration,
            key: lightKey,
            lightIntensity: resolveGardenNightLightIntensity(lightIntensity),
            lightRef,
        });
        if (glowAmountOverride !== undefined)
            requestRender('pumpkin-trail-light', 2);
        return unregister;
    }, [
        preview,
        glowAmountOverride,
        requestRender,
        emissiveBaseIntensity,
        emissiveMaterialRefs,
        emissivePeakIntensity,
        haloRegistration,
        lightIntensity,
        lightKey,
        registry,
    ]);

    if (preview) return null;
    return (
        <>
            {halo ? (
                <sprite
                    name={`GardenLightHalo:${lightKey}`}
                    position={position}
                    ref={haloRef}
                    renderOrder={2}
                    scale={halo.size}
                    visible={false}
                >
                    <spriteMaterial
                        blending={AdditiveBlending}
                        color={color}
                        depthWrite={false}
                        fog={false}
                        map={getGardenLightHaloTexture()}
                        opacity={0}
                        transparent
                    />
                </sprite>
            ) : null}
            <pointLight
                castShadow={false}
                color={color}
                decay={decay}
                distance={distance}
                intensity={0}
                name={`GardenLight:${lightKey}`}
                position={position}
                ref={lightRef}
                visible={false}
            />
        </>
    );
}
