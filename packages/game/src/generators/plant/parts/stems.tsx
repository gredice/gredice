'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantSway } from '../hooks/usePlantSway';
import type { PlantStemSegment } from '../lib/buildPlantRenderData';
import type { PlantDefinition } from '../lib/plant-definitions';
import {
    createStemSurfaceUniforms,
    instancedStemSurfaceVertexShader,
    stemSurfaceFragmentShader,
} from '../lib/plant-stem-material';

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
    const instanceCapacity = Math.max(segments.length, 1);
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
    const stemRadius = useMemo(() => {
        const attribute = new THREE.InstancedBufferAttribute(
            new Float32Array(instanceCapacity * 2),
            2,
        );
        attribute.setUsage(THREE.DynamicDrawUsage);
        return attribute;
    }, [instanceCapacity]);

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
        mesh.count = segments.length;
        mesh.visible = segments.length > 0;
        mesh.instanceMatrix.needsUpdate = true;
        stemRadius.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();

        if (!Array.isArray(mesh.material)) {
            mesh.material.needsUpdate = true;
        }
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
