'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface FlowersProps {
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

export function Flowers({ matrices, color }: FlowersProps) {
    const ref = useRef<THREE.InstancedMesh | null>(null);
    const material = useMemo(
        () => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
        [color],
    );

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
            args={[flowerGeometry, material, 5000]}
            castShadow
        />
    );
}
