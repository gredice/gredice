'use client';

import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
    buildRaisedBedPlantShadowProxyMatrices,
    createRaisedBedPlantShadowProxyGeometry,
    createRaisedBedPlantShadowProxyMaterial,
    GENERATED_PLANT_SHADOW_LAYER,
    type RaisedBedPlantShadowProxySource,
} from './plantShadowProxy';

const shadowProxyGeometry = createRaisedBedPlantShadowProxyGeometry();
const shadowProxyMaterial = createRaisedBedPlantShadowProxyMaterial();

export function RaisedBedPlantShadowProxy({
    plants,
}: {
    plants: readonly RaisedBedPlantShadowProxySource[];
}) {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const gl = useThree((state) => state.gl);
    const invalidate = useThree((state) => state.invalidate);
    const matrices = useMemo(
        () => buildRaisedBedPlantShadowProxyMatrices(plants),
        [plants],
    );

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        mesh.layers.set(GENERATED_PLANT_SHADOW_LAYER);
        matrices.forEach((matrix, index) => {
            mesh.setMatrixAt(index, matrix);
        });
        mesh.count = matrices.length;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, matrices.length * 16);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        gl.shadowMap.needsUpdate = true;
        invalidate();

        return () => {
            gl.shadowMap.needsUpdate = true;
            invalidate();
        };
    }, [gl, invalidate, matrices]);

    if (matrices.length === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={meshRef}
            name={`RaisedBedPlantShadowProxy:count:${matrices.length}`}
            args={[shadowProxyGeometry, shadowProxyMaterial, matrices.length]}
            castShadow
        />
    );
}
