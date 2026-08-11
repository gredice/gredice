'use client';

import { useEffect, useRef } from 'react';
import type { PointLight } from 'three';
import {
    type GardenEmissiveMaterialRef,
    useGardenLightRegistry,
} from '../../scene/GardenLightProvider';

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
    const registry = useGardenLightRegistry();
    const lightRef = useRef<PointLight>(null);

    useEffect(
        () =>
            registry.register({
                emissiveBaseIntensity,
                emissiveMaterialRefs,
                emissivePeakIntensity,
                key: lightKey,
                lightIntensity,
                lightRef,
            }),
        [
            emissiveBaseIntensity,
            emissiveMaterialRefs,
            emissivePeakIntensity,
            lightIntensity,
            lightKey,
            registry,
        ],
    );

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
