'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlantDefinition } from '../lib/plant-definitions';

interface LeavesProps {
    matrices: THREE.Matrix4[];
    color: string;
    type: PlantDefinition['leaf']['type'];
}

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

export function Leaves({ matrices, color, type }: LeavesProps) {
    const ref = useRef<THREE.InstancedMesh>(null!);
    const material = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                color,
                side: THREE.DoubleSide,
                roughness: 0.6,
            }),
        [color],
    );
    const geometry = useMemo(
        () => leafGeometries[type] || leafGeometries.round,
        [type],
    );

    useLayoutEffect(() => {
        matrices.forEach((matrix, i) => {
            ref.current.setMatrixAt(i, matrix);
        });
        ref.current.instanceMatrix.needsUpdate = true;
        ref.current.count = matrices.length;
    }, [matrices]);

    return (
        <instancedMesh
            ref={ref}
            args={[geometry, material, 10000]}
            castShadow
        />
    );
}
