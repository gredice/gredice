'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { usePlantSway } from '../hooks/usePlantSway';
import type { PlantStemSegment } from '../lib/buildPlantRenderData';
import type {
    PackedPlantBounds,
    PackedPlantStemInstances,
} from '../lib/packedPlantRenderData';
import type { PlantDefinition } from '../lib/plant-definitions';
import {
    createStemSurfaceUniforms,
    instancedStemSurfaceVertexShader,
    stemSurfaceFragmentShader,
} from '../lib/plant-stem-material';
import {
    applyPackedPlantBounds,
    copyPackedStaticInstancedAttribute,
    copyPackedStaticInstanceMatrices,
    createStaticInstancedBufferAttribute,
    finalizeStaticInstanceMatrixUpload,
    markStaticInstancedAttributeForUpload,
} from '../lib/plantInstanceBuffers';
import { resolvePlantPartCastShadow } from '../lib/plantPartRendering';
import {
    createPlantStemGeometryShell,
    disposePlantStemGeometryShell,
} from '../lib/plantStemGeometry';

interface StemsProps {
    bounds?: PackedPlantBounds;
    seed: string;
    segments?: PlantStemSegment[];
    packed?: PackedPlantStemInstances;
    stem: PlantDefinition['stem'];
    animate?: boolean;
    castShadow?: boolean;
    debugName?: string;
}

const EMPTY_STEM_SEGMENTS: PlantStemSegment[] = [];

export function Stems({
    bounds,
    seed,
    segments = EMPTY_STEM_SEGMENTS,
    packed,
    stem,
    animate = true,
    castShadow,
    debugName,
}: StemsProps) {
    const stemRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCount = packed?.count ?? segments.length;
    const instanceCapacity = instanceCount;
    const shouldCastShadow = resolvePlantPartCastShadow(castShadow);
    const swayUniforms = usePlantSway(`${seed}-stems`, {
        amplitude: 0.055,
        enabled: animate,
        speed: 1.1,
    });
    const stemSurfaceUniforms = useMemo(
        () => createStemSurfaceUniforms(stem),
        [stem],
    );
    const geometry = useMemo(() => createPlantStemGeometryShell(), []);
    const stemRadius = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 2),
        [instanceCapacity],
    );
    const swayPhase = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 1),
        [instanceCapacity],
    );
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes:
            stemRadius.array.byteLength + swayPhase.array.byteLength,
        kind: 'stem',
        liveCount: instanceCount,
        meshRef: stemRef,
    });

    useLayoutEffect(() => {
        const mesh = stemRef.current;
        if (!mesh) {
            return;
        }

        mesh.geometry.setAttribute('stemRadius', stemRadius);
        mesh.geometry.setAttribute('instanceSwayPhase', swayPhase);
        if (packed) {
            copyPackedStaticInstanceMatrices(
                mesh,
                packed.matrices,
                packed.count,
            );
            copyPackedStaticInstancedAttribute(
                stemRadius,
                packed.radii,
                packed.count,
            );
            copyPackedStaticInstancedAttribute(
                swayPhase,
                packed.swayPhases,
                packed.count,
            );
        } else {
            segments.forEach((segment, index) => {
                mesh.setMatrixAt(index, segment.matrix);
                stemRadius.setXY(index, segment.startRadius, segment.endRadius);
            });
            finalizeStaticInstanceMatrixUpload(mesh, segments.length);
            markStaticInstancedAttributeForUpload(stemRadius, segments.length);
            markStaticInstancedAttributeForUpload(swayPhase, segments.length);
        }
        if (bounds) {
            applyPackedPlantBounds(mesh, bounds);
        } else {
            mesh.computeBoundingBox();
            mesh.computeBoundingSphere();
        }
    }, [bounds, packed, segments, stemRadius, swayPhase]);

    useLayoutEffect(
        () => () => disposePlantStemGeometryShell(geometry),
        [geometry],
    );

    if (instanceCount === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={stemRef}
            name={debugName ?? `PlantStems:segments:${instanceCount}`}
            args={[geometry, undefined, instanceCapacity]}
            castShadow={shouldCastShadow}
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
