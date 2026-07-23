'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';
import { finalizeStaticInstanceMatrixUpload } from '../lib/plantInstanceBuffers';

interface ThornsProps {
    seed: string;
    matrices: THREE.Matrix4[];
    color: string;
    animate?: boolean;
}

const thornGeometry = new THREE.ConeGeometry(0.14, 1, 6);
thornGeometry.translate(0, 0.5, 0);

export function Thorns({ seed, matrices, color, animate = true }: ThornsProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = matrices.length;
    const swayUniforms = usePlantSway(`${seed}-thorns`, {
        amplitude: 0.045,
        enabled: animate,
        speed: 1.1,
    });
    usePlantInstanceBufferMetrics({
        kind: 'thorn',
        liveCount: matrices.length,
        meshRef: ref,
    });

    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) {
            return;
        }

        matrices.forEach((matrix, index) => {
            mesh.setMatrixAt(index, matrix);
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
            args={[thornGeometry, undefined, instanceCapacity]}
            castShadow
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
