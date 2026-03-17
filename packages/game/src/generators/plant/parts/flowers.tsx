'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';

interface FlowersProps {
    seed: string;
    matrices: THREE.Matrix4[];
    color: string;
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

export function Flowers({ seed, matrices, color }: FlowersProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const swayUniforms = usePlantSway(`${seed}-flowers`, {
        amplitude: 0.14,
        speed: 1.6,
    });

    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) {
            return;
        }
        matrices.forEach((matrix, i) => {
            mesh.setMatrixAt(i, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = matrices.length;
    }, [matrices]);

    return (
        <instancedMesh
            ref={ref}
            args={[flowerGeometry, undefined, 5000]}
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
