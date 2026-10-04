'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';
import type {
    PackedPlantBounds,
    PackedPlantMatrixInstances,
} from '../lib/packedPlantRenderData';
import {
    applyPackedPlantBounds,
    copyPackedStaticInstancedAttribute,
    copyPackedStaticInstanceMatrices,
    createPlantGeometryShell,
    createStaticInstancedBufferAttribute,
    disposePlantGeometryShell,
    finalizeStaticInstanceMatrixUpload,
    markStaticInstancedAttributeForUpload,
} from '../lib/plantInstanceBuffers';
import { resolvePlantPartCastShadow } from '../lib/plantPartRendering';

interface ThornsProps {
    bounds?: PackedPlantBounds;
    seed: string;
    matrices?: THREE.Matrix4[];
    packed?: PackedPlantMatrixInstances;
    color: string;
    animate?: boolean;
    castShadow?: boolean;
}

const thornGeometry = new THREE.ConeGeometry(0.14, 1, 6);
thornGeometry.translate(0, 0.5, 0);
const EMPTY_THORN_MATRICES: THREE.Matrix4[] = [];

export function Thorns({
    bounds,
    seed,
    matrices = EMPTY_THORN_MATRICES,
    packed,
    color,
    animate = true,
    castShadow,
}: ThornsProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const instanceCount = packed?.count ?? matrices.length;
    const instanceCapacity = instanceCount;
    const shouldCastShadow = resolvePlantPartCastShadow(castShadow);
    const geometry = useMemo(() => createPlantGeometryShell(thornGeometry), []);
    const swayPhase = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 1),
        [instanceCapacity],
    );
    const swayUniforms = usePlantSway(`${seed}-thorns`, {
        amplitude: 0.045,
        enabled: animate,
        speed: 1.1,
    });
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes: swayPhase.array.byteLength,
        kind: 'thorn',
        liveCount: instanceCount,
        meshRef: ref,
    });

    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) {
            return;
        }

        mesh.geometry.setAttribute('instanceSwayPhase', swayPhase);
        if (packed) {
            copyPackedStaticInstanceMatrices(
                mesh,
                packed.matrices,
                packed.count,
            );
            copyPackedStaticInstancedAttribute(
                swayPhase,
                packed.swayPhases,
                packed.count,
            );
        } else {
            matrices.forEach((matrix, index) => {
                mesh.setMatrixAt(index, matrix);
            });
            finalizeStaticInstanceMatrixUpload(mesh, matrices.length);
            markStaticInstancedAttributeForUpload(swayPhase, matrices.length);
        }
        if (bounds) {
            applyPackedPlantBounds(mesh, bounds);
        } else {
            mesh.computeBoundingBox();
            mesh.computeBoundingSphere();
        }
    }, [bounds, matrices, packed, swayPhase]);

    useLayoutEffect(
        () => () => disposePlantGeometryShell(geometry, thornGeometry),
        [geometry],
    );

    if (instanceCount === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={ref}
            args={[geometry, undefined, instanceCapacity]}
            castShadow={shouldCastShadow}
        >
            <CSM
                baseMaterial={THREE.MeshStandardMaterial}
                vertexShader={plantSwayVertexShader}
                uniforms={swayUniforms}
                color={color}
                roughness={0.78}
            />
        </instancedMesh>
    );
}
