'use client';

import { useContext, useEffect, useRef } from 'react';
import type { PointLight } from 'three';
import {
    type GardenEmissiveMaterialRef,
    useGardenLightRegistry,
} from '../../scene/GardenLightProvider';
import { EntityPreviewContext } from './EntityPreviewContext';
import {
    resolveGardenNightLightEmissivePeakIntensity,
    resolveGardenNightLightIntensity,
} from './nightGardenLight';

const emptyEmissiveMaterialRefs: readonly GardenEmissiveMaterialRef[] = [];

export function GardenNightLight({
    color,
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
    decay?: number;
    distance: number;
    emissiveBaseIntensity?: number;
    emissiveMaterialRefs?: readonly GardenEmissiveMaterialRef[];
    emissivePeakIntensity: number;
    lightIntensity: number;
    lightKey: string;
    position: readonly [number, number, number];
}) {
    const preview = useContext(EntityPreviewContext);
    const registry = useGardenLightRegistry();
    const lightRef = useRef<PointLight>(null);

    useEffect(() => {
        if (preview) return;
        return registry.register({
            emissiveBaseIntensity,
            emissiveMaterialRefs,
            emissivePeakIntensity: resolveGardenNightLightEmissivePeakIntensity(
                emissivePeakIntensity,
            ),
            key: lightKey,
            lightIntensity: resolveGardenNightLightIntensity(lightIntensity),
            lightRef,
        });
    }, [
        preview,
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
