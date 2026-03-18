'use client';

import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CSM from 'three-custom-shader-material';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';
import type { VegetableType } from '../lib/plant-definitions';

export interface VegetableData {
    matrix: THREE.Matrix4;
    type: VegetableType;
    growth: number;
}

interface VegetablesProps {
    seed: string;
    vegetables: VegetableData[];
}

interface VegetableInstanceGroup {
    type: VegetableType;
    data: VegetableData[];
    ref: React.RefObject<THREE.InstancedMesh | null>;
}

interface LatheProducePoint {
    radius: number;
    y: number;
}

interface LatheProduceOptions {
    ribCount?: number;
    ribStrength?: number;
    scaleY?: number;
}

function centerGeometry(geometry: THREE.BufferGeometry) {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    if (!boundingBox) {
        return geometry;
    }

    geometry.translate(0, -(boundingBox.max.y + boundingBox.min.y) / 2, 0);
    return geometry;
}

function applyRadialRibbing(
    geometry: THREE.BufferGeometry,
    ribCount: number,
    ribStrength: number,
) {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    const position = geometry.getAttribute('position');

    if (!boundingBox || !position) {
        return geometry;
    }

    const halfHeight = Math.max(
        (boundingBox.max.y - boundingBox.min.y) / 2,
        0.001,
    );
    for (let index = 0; index < position.count; index++) {
        const x = position.getX(index);
        const y = position.getY(index);
        const z = position.getZ(index);
        const radialDistance = Math.hypot(x, z);

        if (radialDistance === 0) {
            continue;
        }

        const theta = Math.atan2(z, x);
        const heightFade = Math.max(0, 1 - (Math.abs(y) / halfHeight) ** 1.35);
        const radialScale =
            1 + Math.sin(theta * ribCount) * ribStrength * heightFade;

        position.setXYZ(index, x * radialScale, y, z * radialScale);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

function createLatheProduceGeometry(
    profile: LatheProducePoint[],
    options: LatheProduceOptions = {},
) {
    const geometry = new THREE.LatheGeometry(
        profile.map((point) => new THREE.Vector2(point.radius, point.y)),
        24,
    );

    centerGeometry(geometry);

    if (options.scaleY) {
        geometry.scale(1, options.scaleY, 1);
    }

    if (options.ribCount && options.ribStrength) {
        applyRadialRibbing(geometry, options.ribCount, options.ribStrength);
    }

    geometry.computeVertexNormals();
    return geometry;
}

function createTomatoGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.05 },
            { y: 0.08, radius: 0.3 },
            { y: 0.22, radius: 0.5 },
            { y: 0.44, radius: 0.58 },
            { y: 0.64, radius: 0.55 },
            { y: 0.82, radius: 0.38 },
            { y: 0.95, radius: 0.14 },
            { y: 1, radius: 0.04 },
        ],
        {
            ribCount: 5,
            ribStrength: 0.08,
            scaleY: 0.82,
        },
    );
}

function createBellPepperGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.03 },
            { y: 0.08, radius: 0.18 },
            { y: 0.2, radius: 0.36 },
            { y: 0.42, radius: 0.52 },
            { y: 0.62, radius: 0.48 },
            { y: 0.8, radius: 0.4 },
            { y: 0.95, radius: 0.24 },
            { y: 1.08, radius: 0.08 },
            { y: 1.14, radius: 0.02 },
        ],
        {
            ribCount: 4,
            ribStrength: 0.15,
            scaleY: 0.98,
        },
    );
}

function mergeProduceGeometries(geometries: THREE.BufferGeometry[]) {
    const mergedGeometry =
        mergeGeometries(geometries) ?? new THREE.BufferGeometry();
    geometries.forEach((geometry) => {
        geometry.dispose();
    });
    return centerGeometry(mergedGeometry);
}

function createStrawberryGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.03 },
            { y: 0.08, radius: 0.2 },
            { y: 0.22, radius: 0.32 },
            { y: 0.42, radius: 0.42 },
            { y: 0.62, radius: 0.38 },
            { y: 0.82, radius: 0.26 },
            { y: 1.02, radius: 0.12 },
            { y: 1.16, radius: 0.03 },
        ],
        {
            scaleY: 1.06,
        },
    );
}

function createBlueberryClusterGeometry() {
    const berryOffsets = [
        { x: 0, y: 0.12, z: 0, radius: 0.22 },
        { x: 0.18, y: 0.02, z: 0.05, radius: 0.2 },
        { x: -0.18, y: 0.02, z: -0.04, radius: 0.2 },
        { x: 0.08, y: -0.12, z: -0.16, radius: 0.19 },
        { x: -0.08, y: -0.12, z: 0.16, radius: 0.19 },
        { x: 0, y: -0.02, z: 0.18, radius: 0.18 },
    ];
    const geometries = berryOffsets.map((berry) => {
        const geometry = new THREE.SphereGeometry(berry.radius, 10, 8);
        geometry.translate(berry.x, berry.y, berry.z);
        return geometry;
    });

    return mergeProduceGeometries(geometries);
}

function createRaspberryGeometry() {
    const berryOffsets = [
        { x: 0, y: 0.28, z: 0, radius: 0.14 },
        { x: 0.12, y: 0.16, z: 0.08, radius: 0.13 },
        { x: -0.12, y: 0.16, z: -0.06, radius: 0.13 },
        { x: 0.14, y: 0.02, z: -0.1, radius: 0.125 },
        { x: -0.14, y: 0.02, z: 0.1, radius: 0.125 },
        { x: 0, y: 0.02, z: 0.16, radius: 0.125 },
        { x: 0, y: -0.12, z: 0, radius: 0.13 },
        { x: 0.12, y: -0.1, z: 0.08, radius: 0.12 },
        { x: -0.12, y: -0.1, z: -0.08, radius: 0.12 },
        { x: 0.08, y: -0.24, z: -0.08, radius: 0.11 },
        { x: -0.08, y: -0.24, z: 0.08, radius: 0.11 },
        { x: 0, y: -0.26, z: 0, radius: 0.11 },
    ];
    const geometries = berryOffsets.map((berry) => {
        const geometry = new THREE.SphereGeometry(berry.radius, 8, 7);
        geometry.scale(1, 1.08, 1);
        geometry.translate(berry.x, berry.y, berry.z);
        return geometry;
    });

    return mergeProduceGeometries(geometries);
}

const vegetableGeometries: Record<VegetableType, THREE.BufferGeometry> = {
    strawberry: createStrawberryGeometry(),
    blueberry: createBlueberryClusterGeometry(),
    raspberry: createRaspberryGeometry(),
    tomato: createTomatoGeometry(),
    cucumber: new THREE.CylinderGeometry(0.2, 0.2, 1, 8),
    bellpepper: createBellPepperGeometry(),
    carrot: new THREE.ConeGeometry(0.4, 1, 8),
    onion: new THREE.SphereGeometry(0.5, 12, 8),
    eggplant: new THREE.CapsuleGeometry(0.24, 0.55, 4, 8),
    zucchini: new THREE.CylinderGeometry(0.16, 0.2, 1.15, 8),
    pumpkin: new THREE.SphereGeometry(0.6, 12, 10),
    melon: new THREE.SphereGeometry(0.56, 12, 10),
    beet: new THREE.SphereGeometry(0.42, 12, 8),
    radish: new THREE.ConeGeometry(0.28, 0.72, 8),
    turnip: new THREE.SphereGeometry(0.46, 12, 8),
    garlic: new THREE.SphereGeometry(0.36, 12, 8),
    leek: new THREE.CylinderGeometry(0.16, 0.18, 1.05, 8),
    broccoli: new THREE.SphereGeometry(0.5, 12, 10),
    cauliflower: new THREE.SphereGeometry(0.52, 12, 10),
    cabbage: new THREE.SphereGeometry(0.56, 12, 10),
    beanpod: new THREE.CylinderGeometry(0.08, 0.08, 1, 8),
    peapod: new THREE.CylinderGeometry(0.09, 0.09, 0.92, 8),
    artichoke: new THREE.ConeGeometry(0.38, 0.82, 10),
    okra: new THREE.CylinderGeometry(0.09, 0.14, 0.92, 8),
    fennel: new THREE.SphereGeometry(0.44, 12, 8),
    kohlrabi: new THREE.SphereGeometry(0.46, 12, 8),
};

export const vegetableMaterialProps: Record<
    VegetableType,
    { color: string; roughness: number }
> = {
    strawberry: { color: '#cf3f4c', roughness: 0.52 },
    blueberry: { color: '#5366bd', roughness: 0.58 },
    raspberry: { color: '#c33b62', roughness: 0.5 },
    tomato: { color: '#ff4500', roughness: 0.5 },
    cucumber: { color: '#2e591a', roughness: 0.6 },
    bellpepper: { color: '#d42a00', roughness: 0.4 },
    carrot: { color: '#e56a1f', roughness: 0.7 },
    onion: { color: '#d1b28a', roughness: 0.8 },
    eggplant: { color: '#5f3478', roughness: 0.45 },
    zucchini: { color: '#3f6a2a', roughness: 0.6 },
    pumpkin: { color: '#d8771e', roughness: 0.72 },
    melon: { color: '#a7bf69', roughness: 0.7 },
    beet: { color: '#8c2444', roughness: 0.6 },
    radish: { color: '#d04258', roughness: 0.6 },
    turnip: { color: '#d7d0b0', roughness: 0.7 },
    garlic: { color: '#efe7d1', roughness: 0.8 },
    leek: { color: '#d9e1b7', roughness: 0.75 },
    broccoli: { color: '#3f7c2c', roughness: 0.85 },
    cauliflower: { color: '#e7e2c8', roughness: 0.86 },
    cabbage: { color: '#7faa55', roughness: 0.8 },
    beanpod: { color: '#4e8a34', roughness: 0.65 },
    peapod: { color: '#6aa848', roughness: 0.62 },
    artichoke: { color: '#6f8c4d', roughness: 0.78 },
    okra: { color: '#73984e', roughness: 0.68 },
    fennel: { color: '#d6e5a3', roughness: 0.75 },
    kohlrabi: { color: '#9fc46f', roughness: 0.74 },
};

export function Vegetables({ seed, vegetables }: VegetablesProps) {
    const swayUniforms = usePlantSway(`${seed}-vegetables`, {
        amplitude: 0.08,
        speed: 1.15,
    });
    const instances = useMemo(() => {
        const instanceMap = new Map<VegetableType, VegetableInstanceGroup>();

        for (const veg of vegetables) {
            const group = instanceMap.get(veg.type);
            if (group) {
                group.data.push(veg);
                continue;
            }

            instanceMap.set(veg.type, {
                type: veg.type,
                data: [veg],
                ref: React.createRef<THREE.InstancedMesh>(),
            });
        }

        return Array.from(instanceMap.values());
    }, [vegetables]);

    // Create temporary objects to avoid creating new ones in the render loop
    const tempPosition = useMemo(() => new THREE.Vector3(), []);
    const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const tempScale = useMemo(() => new THREE.Vector3(), []);
    const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

    useLayoutEffect(() => {
        for (const group of instances) {
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
            {instances.map((group) => (
                <instancedMesh
                    key={group.type}
                    ref={group.ref}
                    args={[
                        vegetableGeometries[group.type],
                        undefined,
                        group.data.length,
                    ]}
                    castShadow
                >
                    <CSM
                        baseMaterial={THREE.MeshStandardMaterial}
                        vertexShader={plantSwayVertexShader}
                        uniforms={swayUniforms}
                        color={vegetableMaterialProps[group.type].color}
                        roughness={vegetableMaterialProps[group.type].roughness}
                    />
                </instancedMesh>
            ))}
        </group>
    );
}
