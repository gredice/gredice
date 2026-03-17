'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CSM from 'three-custom-shader-material';
import { plantSwayVertexShader, usePlantSway } from '../hooks/usePlantSway';
import type { PlantDefinition } from '../lib/plant-definitions';

interface LeavesProps {
    seed: string;
    matrices: THREE.Matrix4[];
    colors: THREE.Color[];
    type: PlantDefinition['leaf']['type'];
}

const MAX_LEAF_INSTANCES = 10000;

const leafGeometries = {
    round: new THREE.CircleGeometry(1, 6),
    oval: (() => {
        const shape = new THREE.Shape();
        shape.ellipse(0, 0, 0.7, 1, 0, Math.PI * 2, false, 0);
        return new THREE.ShapeGeometry(shape);
    })(),
    heart: (() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.5);
        shape.bezierCurveTo(0, 0.5, -0.5, 1, -0.5, 0.5);
        shape.bezierCurveTo(-0.5, 0, 0, -0.5, 0, -0.5);
        shape.bezierCurveTo(0, -0.5, 0.5, 0, 0.5, 0.5);
        shape.bezierCurveTo(0.5, 1, 0, 0.5, 0, 0.5);
        return new THREE.ShapeGeometry(shape);
    })(),
    serrated: (() => {
        const shape = new THREE.Shape();
        const points = [];
        for (let i = 0; i <= 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = i % 2 === 0 ? 1 : 0.6;
            points.push(
                new THREE.Vector2(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                ),
            );
        }
        shape.setFromPoints(points);
        return new THREE.ShapeGeometry(shape);
    })(),
    compound: (() => {
        const group = new THREE.BufferGeometry();
        const positions = [];
        const indices = [];
        for (let i = 0; i < 5; i++) {
            const angle = (i / 4) * Math.PI - Math.PI / 2;
            const x = Math.sin(angle) * i * 0.15;
            const y = Math.cos(angle) * i * 0.15;
            const baseIndex = i * 7;
            for (let j = 0; j <= 6; j++) {
                const leafletAngle = (j / 6) * Math.PI * 2;
                positions.push(
                    x + Math.cos(leafletAngle) * 0.2,
                    y + Math.sin(leafletAngle) * 0.2,
                    0,
                );
            }
            for (let j = 1; j < 6; j++) {
                indices.push(baseIndex, baseIndex + j, baseIndex + j + 1);
            }
        }
        group.setIndex(indices);
        group.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        group.computeVertexNormals();
        return group;
    })(),
};

interface VeinStrip {
    length: number;
    rotation?: number;
    width?: number;
    x?: number;
    y?: number;
}

function createVeinGeometry(strips: VeinStrip[]) {
    const geometries = strips.map((strip) => {
        const geometry = new THREE.PlaneGeometry(
            strip.width ?? 0.035,
            strip.length,
        );
        geometry.rotateZ(strip.rotation ?? 0);
        geometry.translate(strip.x ?? 0, strip.y ?? 0, 0.012);
        return geometry;
    });

    const mergedGeometry =
        mergeGeometries(geometries) ?? new THREE.BufferGeometry();
    geometries.forEach((geometry) => {
        geometry.dispose();
    });
    return mergedGeometry;
}

const leafVeinGeometries = {
    round: createVeinGeometry([
        { length: 1.25, width: 0.06 },
        { length: 0.5, x: -0.17, y: 0.16, rotation: 0.92 },
        { length: 0.5, x: 0.17, y: 0.16, rotation: -0.92 },
        { length: 0.38, x: -0.15, y: -0.18, rotation: 1.08, width: 0.03 },
        { length: 0.38, x: 0.15, y: -0.18, rotation: -1.08, width: 0.03 },
    ]),
    oval: createVeinGeometry([
        { length: 1.45, width: 0.06 },
        { length: 0.58, x: -0.18, y: 0.2, rotation: 0.82 },
        { length: 0.58, x: 0.18, y: 0.2, rotation: -0.82 },
        { length: 0.46, x: -0.16, y: -0.1, rotation: 0.96, width: 0.03 },
        { length: 0.46, x: 0.16, y: -0.1, rotation: -0.96, width: 0.03 },
        { length: 0.3, x: -0.1, y: -0.38, rotation: 1.12, width: 0.025 },
        { length: 0.3, x: 0.1, y: -0.38, rotation: -1.12, width: 0.025 },
    ]),
    heart: createVeinGeometry([
        { length: 1.2, y: -0.02, width: 0.06 },
        { length: 0.62, x: -0.2, y: 0.18, rotation: 0.7, width: 0.032 },
        { length: 0.62, x: 0.2, y: 0.18, rotation: -0.7, width: 0.032 },
        { length: 0.44, x: -0.14, y: -0.14, rotation: 1.02, width: 0.03 },
        { length: 0.44, x: 0.14, y: -0.14, rotation: -1.02, width: 0.03 },
    ]),
    serrated: createVeinGeometry([
        { length: 1.36, width: 0.055 },
        { length: 0.56, x: -0.22, y: 0.24, rotation: 0.9, width: 0.03 },
        { length: 0.56, x: 0.22, y: 0.24, rotation: -0.9, width: 0.03 },
        { length: 0.48, x: -0.18, y: 0, rotation: 1.02, width: 0.028 },
        { length: 0.48, x: 0.18, y: 0, rotation: -1.02, width: 0.028 },
        { length: 0.4, x: -0.14, y: -0.24, rotation: 1.14, width: 0.026 },
        { length: 0.4, x: 0.14, y: -0.24, rotation: -1.14, width: 0.026 },
    ]),
    compound: createVeinGeometry([
        { length: 1.5, y: 0.02, width: 0.05 },
        { length: 0.34, x: -0.12, y: -0.28, rotation: 0.9, width: 0.028 },
        { length: 0.34, x: 0.12, y: -0.1, rotation: -0.95, width: 0.028 },
        { length: 0.34, x: -0.08, y: 0.1, rotation: 0.85, width: 0.028 },
        { length: 0.32, x: 0.12, y: 0.28, rotation: -0.8, width: 0.028 },
        { length: 0.28, x: -0.04, y: 0.46, rotation: 0.72, width: 0.024 },
    ]),
};

const leafColorVertexShader = /* glsl */ `
    attribute vec3 leafInstanceColor;
    varying vec3 vLeafInstanceColor;

    ${plantSwayVertexShader.replace(
        'void main() {',
        `
        void main() {
            vLeafInstanceColor = leafInstanceColor;
        `,
    )}
`;

const leafColorFragmentShader = /* glsl */ `
    varying vec3 vLeafInstanceColor;

    void main() {
        csm_DiffuseColor = vec4(vLeafInstanceColor, 1.0);
    }
`;

export function Leaves({ seed, matrices, colors, type }: LeavesProps) {
    const leafRef = useRef<THREE.InstancedMesh | null>(null);
    const veinRef = useRef<THREE.InstancedMesh | null>(null);
    const swayUniforms = usePlantSway(`${seed}-leaves`, {
        amplitude: 0.11,
        speed: 1.45,
    });
    const fallbackColor = useMemo(() => new THREE.Color('#ffffff'), []);
    const geometry = useMemo(
        () => (leafGeometries[type] || leafGeometries.round).clone(),
        [type],
    );
    const veinGeometry = useMemo(
        () => (leafVeinGeometries[type] || leafVeinGeometries.round).clone(),
        [type],
    );
    const veinColors = useMemo(
        () => colors.map((color) => color.clone().offsetHSL(0, -0.08, -0.2)),
        [colors],
    );
    const leafInstanceColor = useMemo(() => {
        const attribute = new THREE.InstancedBufferAttribute(
            new Float32Array(MAX_LEAF_INSTANCES * 3),
            3,
        );
        attribute.setUsage(THREE.DynamicDrawUsage);
        return attribute;
    }, []);
    const veinInstanceColor = useMemo(() => {
        const attribute = new THREE.InstancedBufferAttribute(
            new Float32Array(MAX_LEAF_INSTANCES * 3),
            3,
        );
        attribute.setUsage(THREE.DynamicDrawUsage);
        return attribute;
    }, []);

    useLayoutEffect(() => {
        const updateInstances = (
            mesh: THREE.InstancedMesh | null,
            instanceColors: THREE.Color[],
            colorAttribute: THREE.InstancedBufferAttribute,
        ) => {
            if (!mesh) {
                return;
            }

            mesh.geometry.setAttribute('leafInstanceColor', colorAttribute);
            matrices.forEach((matrix, i) => {
                mesh.setMatrixAt(i, matrix);
                const color = instanceColors[i] ?? fallbackColor;
                colorAttribute.setXYZ(i, color.r, color.g, color.b);
            });
            mesh.instanceMatrix.needsUpdate = true;
            colorAttribute.needsUpdate = true;
            if (!Array.isArray(mesh.material)) {
                mesh.material.needsUpdate = true;
            }
            mesh.count = matrices.length;
        };

        updateInstances(leafRef.current, colors, leafInstanceColor);
        updateInstances(veinRef.current, veinColors, veinInstanceColor);
    }, [
        colors,
        fallbackColor,
        leafInstanceColor,
        matrices,
        veinColors,
        veinInstanceColor,
    ]);

    useLayoutEffect(() => {
        return () => {
            geometry.dispose();
            veinGeometry.dispose();
        };
    }, [geometry, veinGeometry]);

    return (
        <group>
            <instancedMesh
                ref={leafRef}
                args={[geometry, undefined, MAX_LEAF_INSTANCES]}
                castShadow
            >
                <CSM
                    baseMaterial={THREE.MeshStandardMaterial}
                    vertexShader={leafColorVertexShader}
                    fragmentShader={leafColorFragmentShader}
                    uniforms={swayUniforms}
                    color="#ffffff"
                    side={THREE.DoubleSide}
                    roughness={0.6}
                />
            </instancedMesh>
            <instancedMesh
                ref={veinRef}
                args={[veinGeometry, undefined, MAX_LEAF_INSTANCES]}
                renderOrder={1}
            >
                <CSM
                    baseMaterial={THREE.MeshStandardMaterial}
                    vertexShader={leafColorVertexShader}
                    fragmentShader={leafColorFragmentShader}
                    uniforms={swayUniforms}
                    color="#ffffff"
                    side={THREE.DoubleSide}
                    roughness={0.75}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                />
            </instancedMesh>
        </group>
    );
}
