'use client';

import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CSM from 'three-custom-shader-material';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';
import type {
    PackedPlantBounds,
    PackedPlantVegetableInstances,
} from '../lib/packedPlantRenderData';
import type { VegetableType } from '../lib/plant-definitions';
import { generatedPlantInstanceBufferMetrics } from '../lib/plantInstanceBufferMetrics';
import {
    applyPackedPlantBounds,
    copyPackedStaticInstancedAttribute,
    copyPackedStaticInstanceMatrices,
    createPlantGeometryShell,
    createStaticInstancedBufferAttribute,
    disposePlantGeometryShell,
    finalizeStaticInstanceMatrixUpload,
    markStaticInstancedAttributeForUpload,
} from '../lib/plantInstanceBuffers';
import { resolvePlantPartCastShadow } from '../lib/plantPartRendering';
import {
    type VegetableData,
    vegetableMaterialProps,
} from '../lib/vegetableRenderMetadata';

interface VegetablesProps {
    bounds?: PackedPlantBounds;
    seed: string;
    vegetables?: VegetableData[];
    packed?: PackedPlantVegetableInstances[];
    animate?: boolean;
    castShadow?: boolean;
}

interface VegetableInstanceGroup {
    type: VegetableType;
    count: number;
    data?: VegetableData[];
    geometry: THREE.BufferGeometry;
    packed?: PackedPlantVegetableInstances;
    ref: React.RefObject<THREE.InstancedMesh | null>;
    swayPhase: THREE.InstancedBufferAttribute;
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
const EMPTY_PACKED_VEGETABLES: PackedPlantVegetableInstances[] = [];
const EMPTY_VEGETABLES: VegetableData[] = [];

export function Vegetables({
    bounds,
    seed,
    vegetables = EMPTY_VEGETABLES,
    packed = EMPTY_PACKED_VEGETABLES,
    animate = true,
    castShadow,
}: VegetablesProps) {
    const shouldCastShadow = resolvePlantPartCastShadow(castShadow);
    const swayUniforms = usePlantSway(`${seed}-vegetables`, {
        amplitude: 0.08,
        enabled: animate,
        speed: 1.15,
    });
    const instances = useMemo(() => {
        if (packed.length > 0) {
            return packed.map(
                (data): VegetableInstanceGroup => ({
                    count: data.count,
                    geometry: createPlantGeometryShell(
                        vegetableGeometries[data.type],
                    ),
                    packed: data,
                    ref: React.createRef<THREE.InstancedMesh>(),
                    swayPhase: createStaticInstancedBufferAttribute(
                        data.count,
                        1,
                    ),
                    type: data.type,
                }),
            );
        }

        const instanceMap = new Map<
            VegetableType,
            {
                type: VegetableType;
                count: number;
                data: VegetableData[];
            }
        >();

        for (const veg of vegetables) {
            const group = instanceMap.get(veg.type);
            if (group?.data) {
                group.data.push(veg);
                group.count += 1;
                continue;
            }

            instanceMap.set(veg.type, {
                type: veg.type,
                count: 1,
                data: [veg],
            });
        }

        return Array.from(
            instanceMap.values(),
            (group): VegetableInstanceGroup => ({
                ...group,
                geometry: createPlantGeometryShell(
                    vegetableGeometries[group.type],
                ),
                ref: React.createRef<THREE.InstancedMesh>(),
                swayPhase: createStaticInstancedBufferAttribute(group.count, 1),
            }),
        );
    }, [packed, vegetables]);
    const instanceCount = useMemo(
        () => instances.reduce((total, group) => total + group.count, 0),
        [instances],
    );

    // Create temporary objects to avoid creating new ones in the render loop
    const tempPosition = useMemo(() => new THREE.Vector3(), []);
    const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const tempScale = useMemo(() => new THREE.Vector3(), []);
    const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

    useLayoutEffect(() => {
        const unregisterAllocations: Array<() => void> = [];

        for (const group of instances) {
            const mesh = group.ref.current;
            if (!mesh) {
                continue;
            }

            mesh.geometry.setAttribute('instanceSwayPhase', group.swayPhase);
            const packedGrowthIsBaked = group.packed?.growth.every(
                (growth) => growth === 1,
            );
            if (group.packed && packedGrowthIsBaked) {
                copyPackedStaticInstanceMatrices(
                    mesh,
                    group.packed.matrices,
                    group.packed.count,
                );
                copyPackedStaticInstancedAttribute(
                    group.swayPhase,
                    group.packed.swayPhases,
                    group.packed.count,
                );
            } else if (group.packed) {
                for (let index = 0; index < group.packed.count; index += 1) {
                    tempMatrix.fromArray(group.packed.matrices, index * 16);
                    tempMatrix.decompose(
                        tempPosition,
                        tempQuaternion,
                        tempScale,
                    );
                    tempScale.multiplyScalar(group.packed.growth[index] ?? 1);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    mesh.setMatrixAt(index, tempMatrix);
                }
                finalizeStaticInstanceMatrixUpload(mesh, group.packed.count);
                copyPackedStaticInstancedAttribute(
                    group.swayPhase,
                    group.packed.swayPhases,
                    group.packed.count,
                );
            } else {
                group.data?.forEach((veg, index) => {
                    const { matrix, growth } = veg;
                    matrix.decompose(tempPosition, tempQuaternion, tempScale);
                    tempScale.multiplyScalar(growth);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    mesh.setMatrixAt(index, tempMatrix);
                });
                finalizeStaticInstanceMatrixUpload(mesh, group.count);
                markStaticInstancedAttributeForUpload(
                    group.swayPhase,
                    group.count,
                );
            }
            if (bounds) {
                applyPackedPlantBounds(mesh, bounds);
            } else {
                mesh.computeBoundingBox();
                mesh.computeBoundingSphere();
            }
            unregisterAllocations.push(
                generatedPlantInstanceBufferMetrics.register({
                    allocatedBytes:
                        mesh.instanceMatrix.array.byteLength +
                        group.swayPhase.array.byteLength,
                    capacity: mesh.instanceMatrix.count,
                    kind: 'vegetable',
                    liveCount: group.count,
                }),
            );
        }

        return () => {
            unregisterAllocations.forEach((unregister) => {
                unregister();
            });
        };
    }, [
        bounds,
        instances,
        tempPosition,
        tempQuaternion,
        tempScale,
        tempMatrix,
    ]);

    useLayoutEffect(
        () => () => {
            instances.forEach((group) => {
                disposePlantGeometryShell(
                    group.geometry,
                    vegetableGeometries[group.type],
                );
            });
        },
        [instances],
    );

    if (instanceCount === 0) {
        return null;
    }

    return (
        <group>
            {instances.map((group) => (
                <instancedMesh
                    key={group.type}
                    ref={group.ref}
                    args={[group.geometry, undefined, group.count]}
                    castShadow={shouldCastShadow}
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
