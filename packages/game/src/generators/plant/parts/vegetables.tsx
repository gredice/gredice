'use client';

import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { VegetableType } from '../lib/plant-definitions';

export interface VegetableData {
    matrix: THREE.Matrix4;
    type: VegetableType;
    growth: number;
}

interface VegetablesProps {
    vegetables: VegetableData[];
}

const vegetableGeometries: Record<string, THREE.BufferGeometry> = {
    tomato: new THREE.SphereGeometry(0.5, 12, 8),
    cucumber: new THREE.CylinderGeometry(0.2, 0.2, 1, 8),
    bellpepper: new THREE.SphereGeometry(
        0.5,
        12,
        8,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.9,
    ),
    carrot: new THREE.ConeGeometry(0.4, 1, 8),
    onion: new THREE.SphereGeometry(0.5, 12, 8),
};

const vegetableMaterials: Record<string, THREE.MeshStandardMaterial> = {
    tomato: new THREE.MeshStandardMaterial({
        color: '#ff4500',
        roughness: 0.5,
    }),
    cucumber: new THREE.MeshStandardMaterial({
        color: '#2e591a',
        roughness: 0.6,
    }),
    bellpepper: new THREE.MeshStandardMaterial({
        color: '#d42a00',
        roughness: 0.4,
    }),
    carrot: new THREE.MeshStandardMaterial({
        color: '#ff8c00',
        roughness: 0.7,
    }),
    onion: new THREE.MeshStandardMaterial({ color: '#d1b28a', roughness: 0.8 }),
};

export function Vegetables({ vegetables }: VegetablesProps) {
    const instances = useMemo(() => {
        const instanceMap: Record<
            string,
            {
                data: VegetableData[];
                ref: React.RefObject<THREE.InstancedMesh | null>;
            }
        > = {};
        for (const veg of vegetables) {
            if (!instanceMap[veg.type]) {
                instanceMap[veg.type] = {
                    data: [],
                    ref: React.createRef<THREE.InstancedMesh>(),
                };
            }
            instanceMap[veg.type].data.push(veg);
        }
        return Object.entries(instanceMap);
    }, [vegetables]);

    // Create temporary objects to avoid creating new ones in the render loop
    const tempPosition = useMemo(() => new THREE.Vector3(), []);
    const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const tempScale = useMemo(() => new THREE.Vector3(), []);
    const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

    useLayoutEffect(() => {
        for (const [, group] of instances) {
            if (group.ref.current) {
                group.data.forEach((veg, i) => {
                    const { matrix, growth } = veg;
                    // Decompose the vegetable's base matrix into position, rotation, and scale
                    matrix.decompose(tempPosition, tempQuaternion, tempScale);

                    // Apply the current growth factor to the scale
                    tempScale.multiplyScalar(growth);

                    // Recompose the matrix with the new, grown scale
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);

                    // Update the instance in the InstancedMesh
                    group.ref.current?.setMatrixAt(i, tempMatrix);
                });
                group.ref.current.instanceMatrix.needsUpdate = true;
                group.ref.current.count = group.data.length;
            }
        }
    }, [instances, tempPosition, tempQuaternion, tempScale, tempMatrix]);

    return (
        <group>
            {instances.map(([type, group]) => (
                <instancedMesh
                    key={type}
                    ref={group.ref}
                    args={[
                        vegetableGeometries[type],
                        vegetableMaterials[type],
                        group.data.length,
                    ]}
                    castShadow
                />
            ))}
        </group>
    );
}
