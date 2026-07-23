'use client';

import { type RefObject, useLayoutEffect } from 'react';
import type * as THREE from 'three';
import {
    generatedPlantInstanceBufferMetrics,
    type PlantInstanceBufferKind,
} from '../lib/plantInstanceBufferMetrics';

export function usePlantInstanceBufferMetrics({
    extraAllocatedBytes = 0,
    kind,
    liveCount,
    meshRef,
}: {
    extraAllocatedBytes?: number;
    kind: PlantInstanceBufferKind;
    liveCount: number;
    meshRef: RefObject<THREE.InstancedMesh | null>;
}) {
    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        return generatedPlantInstanceBufferMetrics.register({
            allocatedBytes:
                mesh.instanceMatrix.array.byteLength + extraAllocatedBytes,
            capacity: mesh.instanceMatrix.count,
            kind,
            liveCount,
        });
    }, [extraAllocatedBytes, kind, liveCount, meshRef]);
}
