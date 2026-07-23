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

interface FlowersProps {
    bounds?: PackedPlantBounds;
    seed: string;
    matrices?: THREE.Matrix4[];
    packed?: PackedPlantMatrixInstances;
    color: string;
    animate?: boolean;
    castShadow?: boolean;
}

const flowerGeometry = (() => {
    const shape = new THREE.Shape();
    const petals = 5;
    for (let i = 0; i < petals * 2; i++) {
        const angle = (i / (petals * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? 0.4 : 1;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(shape);
})();
const EMPTY_FLOWER_MATRICES: THREE.Matrix4[] = [];

export function Flowers({
    bounds,
    seed,
    matrices = EMPTY_FLOWER_MATRICES,
    packed,
    color,
    animate = true,
    castShadow,
}: FlowersProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const instanceCount = packed?.count ?? matrices.length;
    const instanceCapacity = instanceCount;
    const shouldCastShadow = resolvePlantPartCastShadow(castShadow);
    const geometry = useMemo(
        () => createPlantGeometryShell(flowerGeometry),
        [],
    );
    const swayPhase = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 1),
        [instanceCapacity],
    );
    const swayUniforms = usePlantSway(`${seed}-flowers`, {
        amplitude: 0.14,
        enabled: animate,
        speed: 1.6,
    });
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes: swayPhase.array.byteLength,
        kind: 'flower',
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
            matrices.forEach((matrix, i) => {
                mesh.setMatrixAt(i, matrix);
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
        () => () => disposePlantGeometryShell(geometry, flowerGeometry),
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
                baseMaterial={THREE.MeshBasicMaterial}
                vertexShader={plantSwayVertexShader}
                uniforms={swayUniforms}
                color={color}
                side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
}
