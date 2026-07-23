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
}

const leafGeometries = {
    round: new THREE.CircleGeometry(1, 6),
    oval: (() => {
        const shape = new THREE.Shape();
        shape.ellipse(0, 0, 0.7, 1, 0, Math.PI * 2, false, 0);
        return new THREE.ShapeGeometry(shape);
    })(),
    heart: (() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.5);
        shape.bezierCurveTo(0, 0.5, -0.5, 1, -0.5, 0.5);
        shape.bezierCurveTo(-0.5, 0, 0, -0.5, 0, -0.5);
        shape.bezierCurveTo(0, -0.5, 0.5, 0, 0.5, 0.5);
        shape.bezierCurveTo(0.5, 1, 0, 0.5, 0, 0.5);
        return new THREE.ShapeGeometry(shape);
    })(),
    serrated: (() => {
        const shape = new THREE.Shape();
        const points = [];
        for (let i = 0; i <= 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = i % 2 === 0 ? 1 : 0.6;
            points.push(
                new THREE.Vector2(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                ),
            );
        }
        shape.setFromPoints(points);
        return new THREE.ShapeGeometry(shape);
    })(),
    compound: (() => {
        const group = new THREE.BufferGeometry();
        const positions = [];
        const indices = [];
        for (let i = 0; i < 5; i++) {
            const angle = (i / 4) * Math.PI - Math.PI / 2;
            const x = Math.sin(angle) * i * 0.15;
            const y = Math.cos(angle) * i * 0.15;
            const baseIndex = i * 7;
            for (let j = 0; j <= 6; j++) {
                const leafletAngle = (j / 6) * Math.PI * 2;
                positions.push(
                    x + Math.cos(leafletAngle) * 0.2,
                    y + Math.sin(leafletAngle) * 0.2,
                    0,
                );
            }
            for (let j = 1; j < 6; j++) {
                indices.push(baseIndex, baseIndex + j, baseIndex + j + 1);
            }
        }
        group.setIndex(indices);
        group.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        group.computeVertexNormals();
        return group;
    })(),
};
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
    const sourceGeometry = leafGeometries[type] || leafGeometries.round;
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
            name={debugName ?? `PlantLeaves:${type}:count:${instanceCount}`}
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
