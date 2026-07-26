'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { usePlantSway } from '../hooks/usePlantSway';
import type {
    PackedPlantBounds,
    PackedPlantLeafInstances,
} from '../lib/packedPlantRenderData';
import type { PlantDefinition } from '../lib/plant-definitions';
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
import {
    getPlantLeafGeometry,
    type PlantLeafGeometryDetail,
} from '../lib/plantLeafGeometry';
import {
    leafColorFragmentShader,
    leafColorVertexShader,
} from '../lib/plantLeafMaterial';
import { resolvePlantPartCastShadow } from '../lib/plantPartRendering';

interface LeavesProps {
    bounds?: PackedPlantBounds;
    seed: string;
    matrices?: THREE.Matrix4[];
    colors?: THREE.Color[];
    packed?: PackedPlantLeafInstances;
    type: PlantDefinition['leaf']['type'];
    animate?: boolean;
    castShadow?: boolean;
    debugName?: string;
    geometryDetail?: PlantLeafGeometryDetail;
}

const EMPTY_LEAF_COLORS: THREE.Color[] = [];
const EMPTY_LEAF_MATRICES: THREE.Matrix4[] = [];

export function Leaves({
    bounds,
    seed,
    matrices = EMPTY_LEAF_MATRICES,
    colors = EMPTY_LEAF_COLORS,
    packed,
    type,
    animate = true,
    castShadow,
    debugName,
    geometryDetail = 'full',
}: LeavesProps) {
    const leafRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCount = packed?.count ?? matrices.length;
    const instanceCapacity = instanceCount;
    const shouldCastShadow = resolvePlantPartCastShadow(castShadow);
    const swayUniforms = usePlantSway(`${seed}-leaves`, {
        amplitude: 0.11,
        enabled: animate,
        speed: 1.45,
    });
    const fallbackColor = useMemo(() => new THREE.Color('#ffffff'), []);
    const sourceGeometry = getPlantLeafGeometry(type, geometryDetail);
    const geometry = useMemo(
        () => createPlantGeometryShell(sourceGeometry),
        [sourceGeometry],
    );
    const leafInstanceColor = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 3),
        [instanceCapacity],
    );
    const swayPhase = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 1),
        [instanceCapacity],
    );
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes:
            leafInstanceColor.array.byteLength + swayPhase.array.byteLength,
        kind: 'leaf',
        liveCount: instanceCount,
        meshRef: leafRef,
    });

    useLayoutEffect(() => {
        const updateInstances = (
            mesh: THREE.InstancedMesh | null,
            instanceColors: THREE.Color[],
            colorAttribute: THREE.InstancedBufferAttribute,
        ) => {
            if (!mesh) {
                return;
            }

            mesh.geometry.setAttribute('leafInstanceColor', colorAttribute);
            mesh.geometry.setAttribute('instanceSwayPhase', swayPhase);
            if (packed) {
                copyPackedStaticInstanceMatrices(
                    mesh,
                    packed.matrices,
                    packed.count,
                );
                copyPackedStaticInstancedAttribute(
                    colorAttribute,
                    packed.colors,
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
                    const color = instanceColors[i] ?? fallbackColor;
                    colorAttribute.setXYZ(i, color.r, color.g, color.b);
                });
                finalizeStaticInstanceMatrixUpload(mesh, matrices.length);
                markStaticInstancedAttributeForUpload(
                    colorAttribute,
                    matrices.length,
                );
                markStaticInstancedAttributeForUpload(
                    swayPhase,
                    matrices.length,
                );
            }
            if (bounds) {
                applyPackedPlantBounds(mesh, bounds);
            } else {
                mesh.computeBoundingBox();
                mesh.computeBoundingSphere();
            }
        };

        updateInstances(leafRef.current, colors, leafInstanceColor);
    }, [
        bounds,
        colors,
        fallbackColor,
        leafInstanceColor,
        matrices,
        packed,
        swayPhase,
    ]);

    useLayoutEffect(() => {
        return () => {
            disposePlantGeometryShell(geometry, sourceGeometry);
        };
    }, [geometry, sourceGeometry]);

    if (instanceCount === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={leafRef}
            name={
                debugName ??
                `PlantLeaves:${type}:${geometryDetail}:count:${instanceCount}`
            }
            args={[geometry, undefined, instanceCapacity]}
            castShadow={shouldCastShadow}
        >
            <CSM
                baseMaterial={THREE.MeshStandardMaterial}
                vertexShader={leafColorVertexShader}
                fragmentShader={leafColorFragmentShader}
                uniforms={swayUniforms}
                color="#ffffff"
                side={THREE.DoubleSide}
                roughness={0.6}
            />
        </instancedMesh>
    );
}
