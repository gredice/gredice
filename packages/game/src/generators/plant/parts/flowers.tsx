'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';
import { finalizeStaticInstanceMatrixUpload } from '../lib/plantInstanceBuffers';

interface FlowersProps {
    seed: string;
    matrices: THREE.Matrix4[];
    color: string;
    animate?: boolean;
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

export function Flowers({
    seed,
    matrices,
    color,
    animate = true,
}: FlowersProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = matrices.length;
    const swayUniforms = usePlantSway(`${seed}-flowers`, {
        amplitude: 0.14,
        enabled: animate,
        speed: 1.6,
    });
    usePlantInstanceBufferMetrics({
        kind: 'flower',
        liveCount: matrices.length,
        meshRef: ref,
    });

    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) {
            return;
        }
        matrices.forEach((matrix, i) => {
            mesh.setMatrixAt(i, matrix);
        });
        finalizeStaticInstanceMatrixUpload(mesh, matrices.length);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [matrices]);

    if (matrices.length === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={ref}
            args={[flowerGeometry, undefined, instanceCapacity]}
            castShadow
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
