'use client';

import { useContext, useEffect, useRef } from 'react';
import type { PointLight } from 'three';
import {
    type GardenEmissiveMaterialRef,
    useGardenLightRegistry,
} from '../../scene/GardenLightProvider';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import { EntityPreviewContext } from './EntityPreviewContext';
import {
    resolveGardenNightLightEmissivePeakIntensity,
    resolveGardenNightLightIntensity,
} from './nightGardenLight';

const emptyEmissiveMaterialRefs: readonly GardenEmissiveMaterialRef[] = [];

export function GardenNightLight({
    color,
    glowAmountOverride,
    decay = 1.8,
    distance,
    emissiveBaseIntensity = 0.2,
    emissiveMaterialRefs = emptyEmissiveMaterialRefs,
    emissivePeakIntensity,
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
    lightIntensity: number;
    lightKey: string;
    position: readonly [number, number, number];
}) {
    const requestRender = useSceneRenderRequest();
    const preview = useContext(EntityPreviewContext);
    const registry = useGardenLightRegistry();
    const lightRef = useRef<PointLight>(null);

    useEffect(() => {
        if (preview) return;
        const unregister = registry.register({
            glowAmountOverride,
            emissiveBaseIntensity,
            emissiveMaterialRefs,
            emissivePeakIntensity: resolveGardenNightLightEmissivePeakIntensity(
                emissivePeakIntensity,
            ),
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
        lightIntensity,
        lightKey,
        registry,
    ]);

    if (preview) return null;
    return (
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
    );
}
