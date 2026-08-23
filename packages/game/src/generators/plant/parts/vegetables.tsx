'use client';

import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CSM from 'three-custom-shader-material';
import { usePlantSway } from '../hooks/usePlantSway';
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
    vegetableColorFragmentShader,
    vegetableColorVertexShader,
} from '../lib/plantVegetableMaterial';
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
    color: THREE.InstancedBufferAttribute;
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

function createCarrotGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.1 },
            { y: 0.05, radius: 0.32 },
            { y: 0.12, radius: 0.4 },
            { y: 0.28, radius: 0.36 },
            { y: 0.48, radius: 0.28 },
            { y: 0.68, radius: 0.18 },
            { y: 0.86, radius: 0.09 },
            { y: 1, radius: 0.035 },
            { y: 1.1, radius: 0 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.06,
            scaleY: 1.06,
        },
    );
}

function applyProduceBend(geometry: THREE.BufferGeometry, amount: number) {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    const position = geometry.getAttribute('position');
    if (!boundingBox || !position) {
        return geometry;
    }

    const minY = boundingBox.min.y;
    const height = Math.max(boundingBox.max.y - minY, 0.001);
    for (let index = 0; index < position.count; index += 1) {
        const t = (position.getY(index) - minY) / height;
        position.setX(index, position.getX(index) + amount * t * t);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return centerGeometry(geometry);
}

function mergeProduceGeometries(geometries: THREE.BufferGeometry[]) {
    const mergedGeometry =
        mergeGeometries(geometries) ?? new THREE.BufferGeometry();
    geometries.forEach((geometry) => {
        geometry.dispose();
    });
    return centerGeometry(mergedGeometry);
}

function createOnionGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.08 },
            { y: 0.06, radius: 0.16 },
            { y: 0.18, radius: 0.38 },
            { y: 0.42, radius: 0.52 },
            { y: 0.68, radius: 0.48 },
            { y: 0.88, radius: 0.28 },
            { y: 1, radius: 0.1 },
            { y: 1.06, radius: 0.02 },
        ],
        {
            scaleY: 0.86,
        },
    );
}

function createEggplantGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.04 },
            { y: 0.08, radius: 0.16 },
            { y: 0.22, radius: 0.3 },
            { y: 0.46, radius: 0.36 },
            { y: 0.7, radius: 0.28 },
            { y: 0.9, radius: 0.14 },
            { y: 1.04, radius: 0.03 },
            { y: 1.1, radius: 0 },
        ],
        {
            scaleY: 1.32,
        },
    );
}

function createCucumberGeometry() {
    return applyProduceBend(
        createLatheProduceGeometry(
            [
                { y: 0, radius: 0.04 },
                { y: 0.06, radius: 0.16 },
                { y: 0.22, radius: 0.22 },
                { y: 0.52, radius: 0.24 },
                { y: 0.82, radius: 0.2 },
                { y: 0.96, radius: 0.1 },
                { y: 1.04, radius: 0.02 },
            ],
            {
                ribCount: 8,
                ribStrength: 0.04,
                scaleY: 1.18,
            },
        ),
        0.12,
    );
}

function createZucchiniGeometry() {
    return applyProduceBend(
        createLatheProduceGeometry(
            [
                { y: 0, radius: 0.05 },
                { y: 0.08, radius: 0.14 },
                { y: 0.28, radius: 0.2 },
                { y: 0.58, radius: 0.24 },
                { y: 0.84, radius: 0.22 },
                { y: 0.98, radius: 0.12 },
                { y: 1.06, radius: 0.02 },
            ],
            {
                ribCount: 8,
                ribStrength: 0.035,
                scaleY: 1.28,
            },
        ),
        0.08,
    );
}

function createPumpkinGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.08 },
            { y: 0.08, radius: 0.32 },
            { y: 0.22, radius: 0.52 },
            { y: 0.48, radius: 0.6 },
            { y: 0.72, radius: 0.52 },
            { y: 0.9, radius: 0.3 },
            { y: 1, radius: 0.08 },
            { y: 1.04, radius: 0.02 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.14,
            scaleY: 0.72,
        },
    );
}

function createMelonGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.06 },
            { y: 0.1, radius: 0.3 },
            { y: 0.28, radius: 0.48 },
            { y: 0.5, radius: 0.54 },
            { y: 0.74, radius: 0.46 },
            { y: 0.92, radius: 0.26 },
            { y: 1.02, radius: 0.06 },
            { y: 1.06, radius: 0 },
        ],
        {
            ribCount: 10,
            ribStrength: 0.06,
            scaleY: 0.9,
        },
    );
}

function createBeetGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.12 },
            { y: 0.08, radius: 0.34 },
            { y: 0.22, radius: 0.44 },
            { y: 0.42, radius: 0.4 },
            { y: 0.64, radius: 0.26 },
            { y: 0.84, radius: 0.12 },
            { y: 1, radius: 0.04 },
            { y: 1.08, radius: 0 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.05,
            scaleY: 0.92,
        },
    );
}

function createRadishGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.1 },
            { y: 0.08, radius: 0.3 },
            { y: 0.22, radius: 0.36 },
            { y: 0.4, radius: 0.3 },
            { y: 0.62, radius: 0.16 },
            { y: 0.84, radius: 0.07 },
            { y: 1, radius: 0.03 },
            { y: 1.08, radius: 0 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.04,
            scaleY: 1.08,
        },
    );
}

function createTurnipGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.1 },
            { y: 0.08, radius: 0.34 },
            { y: 0.24, radius: 0.48 },
            { y: 0.46, radius: 0.5 },
            { y: 0.68, radius: 0.36 },
            { y: 0.86, radius: 0.16 },
            { y: 1, radius: 0.05 },
            { y: 1.08, radius: 0 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.045,
            scaleY: 0.78,
        },
    );
}

function createLeekGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.1 },
            { y: 0.12, radius: 0.13 },
            { y: 0.4, radius: 0.16 },
            { y: 0.72, radius: 0.2 },
            { y: 0.94, radius: 0.22 },
            { y: 1.04, radius: 0.1 },
            { y: 1.08, radius: 0.02 },
        ],
        {
            scaleY: 1.22,
        },
    );
}

function createKohlrabiGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.1 },
            { y: 0.1, radius: 0.34 },
            { y: 0.28, radius: 0.48 },
            { y: 0.5, radius: 0.5 },
            { y: 0.72, radius: 0.42 },
            { y: 0.9, radius: 0.22 },
            { y: 1.02, radius: 0.06 },
            { y: 1.08, radius: 0 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.05,
            scaleY: 0.88,
        },
    );
}

function createFennelGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.16 },
            { y: 0.1, radius: 0.36 },
            { y: 0.28, radius: 0.5 },
            { y: 0.5, radius: 0.46 },
            { y: 0.72, radius: 0.28 },
            { y: 0.9, radius: 0.12 },
            { y: 1.02, radius: 0.03 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.16,
            scaleY: 0.7,
        },
    );
}

function createOkraGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.03 },
            { y: 0.08, radius: 0.1 },
            { y: 0.28, radius: 0.16 },
            { y: 0.58, radius: 0.14 },
            { y: 0.84, radius: 0.08 },
            { y: 1, radius: 0.03 },
            { y: 1.06, radius: 0 },
        ],
        {
            ribCount: 8,
            ribStrength: 0.18,
            scaleY: 1.2,
        },
    );
}

function createArtichokeGeometry() {
    return createLatheProduceGeometry(
        [
            { y: 0, radius: 0.06 },
            { y: 0.1, radius: 0.22 },
            { y: 0.28, radius: 0.38 },
            { y: 0.5, radius: 0.4 },
            { y: 0.72, radius: 0.3 },
            { y: 0.9, radius: 0.14 },
            { y: 1.04, radius: 0.02 },
        ],
        {
            ribCount: 10,
            ribStrength: 0.12,
            scaleY: 1.12,
        },
    );
}

function createBeanpodGeometry() {
    return applyProduceBend(
        createLatheProduceGeometry(
            [
                { y: 0, radius: 0.02 },
                { y: 0.06, radius: 0.07 },
                { y: 0.28, radius: 0.09 },
                { y: 0.62, radius: 0.09 },
                { y: 0.9, radius: 0.06 },
                { y: 1.02, radius: 0.02 },
                { y: 1.06, radius: 0 },
            ],
            {
                scaleY: 1.16,
            },
        ),
        0.16,
    );
}

function createPeapodGeometry() {
    return applyProduceBend(
        createLatheProduceGeometry(
            [
                { y: 0, radius: 0.02 },
                { y: 0.08, radius: 0.08 },
                { y: 0.3, radius: 0.12 },
                { y: 0.52, radius: 0.11 },
                { y: 0.74, radius: 0.12 },
                { y: 0.92, radius: 0.07 },
                { y: 1.04, radius: 0.02 },
            ],
            {
                ribCount: 4,
                ribStrength: 0.12,
                scaleY: 1.08,
            },
        ),
        0.2,
    );
}

function createCabbageGeometry() {
    const leafOffsets = [
        { x: 0, y: 0.02, z: 0, radius: 0.42, flatten: 0.62 },
        { x: 0.08, y: -0.04, z: 0.06, radius: 0.4, flatten: 0.58 },
        { x: -0.07, y: 0.04, z: -0.05, radius: 0.39, flatten: 0.6 },
        { x: 0.04, y: 0.08, z: -0.08, radius: 0.36, flatten: 0.54 },
        { x: -0.06, y: -0.06, z: 0.07, radius: 0.35, flatten: 0.52 },
        { x: 0, y: 0, z: 0, radius: 0.3, flatten: 0.7 },
    ];
    const geometries = leafOffsets.map((leaf, index) => {
        const geometry = new THREE.SphereGeometry(leaf.radius, 10, 8);
        geometry.scale(1.12, leaf.flatten, 1.12);
        geometry.rotateY(index * 0.7);
        geometry.translate(leaf.x, leaf.y, leaf.z);
        return geometry;
    });

    return mergeProduceGeometries(geometries);
}

function createProduceClusterGeometry({
    count,
    flatten,
    radius,
    spread,
}: {
    count: number;
    flatten: number;
    radius: number;
    spread: number;
}) {
    const geometries: THREE.BufferGeometry[] = [];
    for (let index = 0; index < count; index += 1) {
        const t = index / Math.max(count - 1, 1);
        const y = (0.5 - t) * 0.22;
        const ringRadius = Math.sin(t * Math.PI * 0.82) * spread;
        const angle = index * 2.399;
        const geometry = new THREE.SphereGeometry(
            radius * (0.28 - t * 0.08),
            8,
            6,
        );
        geometry.scale(1, flatten, 1);
        geometry.translate(
            Math.cos(angle) * ringRadius,
            y,
            Math.sin(angle) * ringRadius,
        );
        geometries.push(geometry);
    }

    return mergeProduceGeometries(geometries);
}

function createGarlicGeometry() {
    const cloveCount = 6;
    const geometries = Array.from({ length: cloveCount }, (_, index) => {
        const angle = (index / cloveCount) * Math.PI * 2;
        const geometry = new THREE.SphereGeometry(0.2, 8, 6);
        geometry.scale(0.62, 1.12, 0.5);
        geometry.rotateY(angle);
        geometry.translate(
            Math.cos(angle) * 0.14,
            0.02,
            Math.sin(angle) * 0.14,
        );
        return geometry;
    });
    const neck = new THREE.SphereGeometry(0.12, 8, 6);
    neck.scale(0.7, 0.55, 0.7);
    neck.translate(0, -0.16, 0);
    geometries.push(neck);

    return mergeProduceGeometries(geometries);
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
    cucumber: createCucumberGeometry(),
    bellpepper: createBellPepperGeometry(),
    carrot: createCarrotGeometry(),
    onion: createOnionGeometry(),
    eggplant: createEggplantGeometry(),
    zucchini: createZucchiniGeometry(),
    pumpkin: createPumpkinGeometry(),
    melon: createMelonGeometry(),
    beet: createBeetGeometry(),
    radish: createRadishGeometry(),
    turnip: createTurnipGeometry(),
    garlic: createGarlicGeometry(),
    leek: createLeekGeometry(),
    broccoli: createProduceClusterGeometry({
        count: 16,
        flatten: 0.82,
        radius: 0.5,
        spread: 0.34,
    }),
    cauliflower: createProduceClusterGeometry({
        count: 16,
        flatten: 0.78,
        radius: 0.52,
        spread: 0.36,
    }),
    cabbage: createCabbageGeometry(),
    beanpod: createBeanpodGeometry(),
    peapod: createPeapodGeometry(),
    artichoke: createArtichokeGeometry(),
    okra: createOkraGeometry(),
    fennel: createFennelGeometry(),
    kohlrabi: createKohlrabiGeometry(),
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
                    color: createStaticInstancedBufferAttribute(data.count, 3),
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
                color: createStaticInstancedBufferAttribute(group.count, 3),
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
            mesh.geometry.setAttribute('vegetableInstanceColor', group.color);
            if (group.packed) {
                copyPackedStaticInstancedAttribute(
                    group.color,
                    group.packed.colors,
                    group.packed.count,
                );
            }
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
                    const { color, matrix, growth } = veg;
                    matrix.decompose(tempPosition, tempQuaternion, tempScale);
                    tempScale.multiplyScalar(growth);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    mesh.setMatrixAt(index, tempMatrix);
                    group.color.setXYZ(index, color.r, color.g, color.b);
                });
                finalizeStaticInstanceMatrixUpload(mesh, group.count);
                markStaticInstancedAttributeForUpload(group.color, group.count);
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
                        group.color.array.byteLength +
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
                        fragmentShader={vegetableColorFragmentShader}
                        vertexShader={vegetableColorVertexShader}
                        uniforms={swayUniforms}
                        color="#ffffff"
                        roughness={vegetableMaterialProps[group.type].roughness}
                    />
                </instancedMesh>
            ))}
        </group>
    );
}
