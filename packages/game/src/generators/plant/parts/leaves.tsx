'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
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
    const swayUniforms = usePlantSway(`${seed}-leaves`, {
        amplitude: 0.11,
        speed: 1.45,
    });
    const fallbackColor = useMemo(() => new THREE.Color('#ffffff'), []);
    const geometry = useMemo(
        () => (leafGeometries[type] || leafGeometries.round).clone(),
        [type],
    );
    const leafInstanceColor = useMemo(() => {
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
    }, [colors, fallbackColor, leafInstanceColor, matrices]);

    useLayoutEffect(() => {
        return () => {
            geometry.dispose();
        };
    }, [geometry]);

    return (
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
    );
}
