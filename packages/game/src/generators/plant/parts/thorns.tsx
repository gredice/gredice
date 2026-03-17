'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';

interface ThornsProps {
    seed: string;
    matrices: THREE.Matrix4[];
    color: string;
}

const thornGeometry = new THREE.ConeGeometry(0.14, 1, 6);
thornGeometry.translate(0, 0.5, 0);

export function Thorns({ seed, matrices, color }: ThornsProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const swayUniforms = usePlantSway(`${seed}-thorns`, {
        amplitude: 0.045,
        speed: 1.1,
    });

    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) {
            return;
        }

        matrices.forEach((matrix, index) => {
            mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = matrices.length;
    }, [matrices]);

    return (
        <instancedMesh
            ref={ref}
            args={[thornGeometry, undefined, 6000]}
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
