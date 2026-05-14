'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useMemo, useState } from 'react';
import * as THREE from 'three';

export type PlantLodLevel = 'near' | 'mid' | 'far';

const NEAR_THRESHOLD = 0.12;
const FAR_THRESHOLD = 0.045;
const HYSTERESIS = 0.012;

function resolveLodLevel(screenOccupancy: number): PlantLodLevel {
    if (screenOccupancy >= NEAR_THRESHOLD) {
        return 'near';
    }

    if (screenOccupancy >= FAR_THRESHOLD) {
        return 'mid';
    }

    return 'far';
}

function resolveLodLevelWithHysteresis(
    currentLevel: PlantLodLevel,
    screenOccupancy: number,
) {
    if (currentLevel === 'near') {
        if (screenOccupancy >= NEAR_THRESHOLD - HYSTERESIS) {
            return 'near';
        }
        return screenOccupancy >= FAR_THRESHOLD - HYSTERESIS ? 'mid' : 'far';
    }

    if (currentLevel === 'mid') {
        if (screenOccupancy >= NEAR_THRESHOLD + HYSTERESIS) {
            return 'near';
        }
        if (screenOccupancy < FAR_THRESHOLD - HYSTERESIS) {
            return 'far';
        }
        return 'mid';
    }

    if (screenOccupancy >= NEAR_THRESHOLD + HYSTERESIS) {
        return 'near';
    }

    return screenOccupancy >= FAR_THRESHOLD + HYSTERESIS ? 'mid' : 'far';
}

export function usePlantLod(
    objectRef: RefObject<THREE.Object3D | null>,
    approximatePlantHeight: number,
) {
    const camera = useThree((state) => state.camera);
    const viewport = useThree((state) => state.viewport);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const [lodLevel, setLodLevel] = useState<PlantLodLevel>(() =>
        resolveLodLevel(1),
    );

    useFrame(() => {
        const object = objectRef.current;
        if (!object) {
            return;
        }

        object.getWorldPosition(worldPosition);
        const currentViewport = viewport.getCurrentViewport(
            camera,
            worldPosition,
        );
        const viewportHeight = Math.max(currentViewport.height, 0.001);
        const screenOccupancy =
            Math.max(approximatePlantHeight, 0.25) / viewportHeight;
        const nextLevel = resolveLodLevelWithHysteresis(
            lodLevel,
            screenOccupancy,
        );

        if (nextLevel !== lodLevel) {
            setLodLevel(nextLevel);
        }
    });

    return lodLevel;
}
