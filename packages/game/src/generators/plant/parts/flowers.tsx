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
import type { PlantFlowerForm } from '../lib/plant-definitions';
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
    form: PlantFlowerForm;
    animate?: boolean;
    castShadow?: boolean;
}

function createFlowerShapeGeometry(points: readonly [number, number][]) {
    const [firstPoint, ...remainingPoints] = points;
    if (!firstPoint) {
        throw new TypeError('Flower geometry requires at least one point');
    }

    const shape = new THREE.Shape();
    shape.moveTo(...firstPoint);
    remainingPoints.forEach((point) => {
        shape.lineTo(...point);
    });
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
}

function createPetalGeometry(petals: number, innerRadius: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i < petals * 2; i++) {
        const angle = (i / (petals * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? innerRadius : 1;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(shape);
}

const flowerGeometries: Record<PlantFlowerForm, THREE.BufferGeometry> = {
    cluster: new THREE.CircleGeometry(1, 8),
    pea: createFlowerShapeGeometry([
        [0, -0.8],
        [-0.42, -0.3],
        [-0.86, 0.15],
        [-0.62, 0.7],
        [0, 0.48],
        [0.62, 0.7],
        [0.86, 0.15],
        [0.42, -0.3],
    ]),
    'pom-pom': createPetalGeometry(10, 0.72),
    spike: createFlowerShapeGeometry([
        [0, -1.2],
        [-0.34, -0.35],
        [-0.28, 0.68],
        [0, 1.2],
        [0.28, 0.68],
        [0.34, -0.35],
    ]),
    star: createPetalGeometry(5, 0.4),
    umbel: createPetalGeometry(7, 0.55),
};
const EMPTY_FLOWER_MATRICES: THREE.Matrix4[] = [];

export function Flowers({
    bounds,
    seed,
    matrices = EMPTY_FLOWER_MATRICES,
    packed,
    color,
    form,
    animate = true,
    castShadow,
}: FlowersProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const instanceCount = packed?.count ?? matrices.length;
    const instanceCapacity = instanceCount;
    const shouldCastShadow = resolvePlantPartCastShadow(castShadow);
    const flowerGeometry = flowerGeometries[form];
    const geometry = useMemo(
        () => createPlantGeometryShell(flowerGeometry),
        [flowerGeometry],
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
        [flowerGeometry, geometry],
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
