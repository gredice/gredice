'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { usePlantSway } from '../hooks/usePlantSway';
import type { PlantStemSegment } from '../lib/buildPlantRenderData';
import type { PlantDefinition } from '../lib/plant-definitions';
import {
    createStemSurfaceUniforms,
    instancedStemSurfaceVertexShader,
    stemSurfaceFragmentShader,
} from '../lib/plant-stem-material';
import {
    createStaticInstancedBufferAttribute,
    finalizeStaticInstanceMatrixUpload,
    markStaticInstancedAttributeForUpload,
} from '../lib/plantInstanceBuffers';

interface StemsProps {
    seed: string;
    segments: PlantStemSegment[];
    stem: PlantDefinition['stem'];
    animate?: boolean;
    debugName?: string;
}

const STEM_RADIAL_SEGMENTS = 5;

function createStemSegmentGeometry() {
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let ringIndex = 0; ringIndex <= 1; ringIndex += 1) {
        const y = ringIndex;

        for (
            let radialIndex = 0;
            radialIndex <= STEM_RADIAL_SEGMENTS;
            radialIndex += 1
        ) {
            const angle = (radialIndex / STEM_RADIAL_SEGMENTS) * Math.PI * 2;
            const x = Math.cos(angle);
            const z = Math.sin(angle);

            vertices.push(x, y, z);
            normals.push(x, 0, z);
        }
    }

    const ringSize = STEM_RADIAL_SEGMENTS + 1;
    for (
        let radialIndex = 0;
        radialIndex < STEM_RADIAL_SEGMENTS;
        radialIndex += 1
    ) {
        const a = radialIndex;
        const b = ringSize + radialIndex;
        const c = radialIndex + 1;
        const d = ringSize + radialIndex + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setIndex(indices);
    return geometry;
}

export function Stems({
    seed,
    segments,
    stem,
    animate = true,
    debugName,
}: StemsProps) {
    const stemRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = segments.length;
    const swayUniforms = usePlantSway(`${seed}-stems`, {
        amplitude: 0.055,
        enabled: animate,
        speed: 1.1,
    });
    const stemSurfaceUniforms = useMemo(
        () => createStemSurfaceUniforms(stem),
        [stem],
    );
    const geometry = useMemo(() => createStemSegmentGeometry(), []);
    const stemRadius = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 2),
        [instanceCapacity],
    );
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes: stemRadius.array.byteLength,
        kind: 'stem',
        liveCount: segments.length,
        meshRef: stemRef,
    });

    useLayoutEffect(() => {
        const mesh = stemRef.current;
        if (!mesh) {
            return;
        }

        mesh.geometry.setAttribute('stemRadius', stemRadius);
        segments.forEach((segment, index) => {
            mesh.setMatrixAt(index, segment.matrix);
            stemRadius.setXY(index, segment.startRadius, segment.endRadius);
        });
        finalizeStaticInstanceMatrixUpload(mesh, segments.length);
        markStaticInstancedAttributeForUpload(stemRadius, segments.length);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [segments, stemRadius]);

    useLayoutEffect(() => () => geometry.dispose(), [geometry]);

    if (segments.length === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={stemRef}
            name={debugName ?? `PlantStems:segments:${segments.length}`}
            args={[geometry, undefined, instanceCapacity]}
            castShadow
        >
            <CSM
                baseMaterial={THREE.MeshStandardMaterial}
                vertexShader={instancedStemSurfaceVertexShader}
                fragmentShader={stemSurfaceFragmentShader}
                uniforms={{
                    ...swayUniforms,
                    ...stemSurfaceUniforms,
                }}
                color={stem.color}
                roughness={0.8}
                metalness={0.2}
            />
        </instancedMesh>
    );
}
