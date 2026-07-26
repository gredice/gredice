import * as THREE from 'three';
import type { GameQualityProfileTier } from '../../../scene/gameQuality';
import type { PlantDefinition } from './plant-definitions';

export type PlantLeafGeometryDetail = 'compact' | 'full';
export type PlantLeafType = PlantDefinition['leaf']['type'];

function createPolygonGeometry(points: readonly [number, number][]) {
    const [firstPoint, ...remainingPoints] = points;
    if (!firstPoint) {
        throw new TypeError('Leaf polygon requires at least one point');
    }

    const shape = new THREE.Shape();
    shape.moveTo(...firstPoint);
    remainingPoints.forEach((point) => {
        shape.lineTo(...point);
    });
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
}

const fullLeafGeometries: Record<PlantLeafType, THREE.BufferGeometry> = {
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
        for (let index = 0; index <= 12; index += 1) {
            const angle = (index / 12) * Math.PI * 2;
            const radius = index % 2 === 0 ? 1 : 0.6;
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
        for (let index = 0; index < 5; index += 1) {
            const angle = (index / 4) * Math.PI - Math.PI / 2;
            const x = Math.sin(angle) * index * 0.15;
            const y = Math.cos(angle) * index * 0.15;
            const baseIndex = index * 7;
            for (let pointIndex = 0; pointIndex <= 6; pointIndex += 1) {
                const leafletAngle = (pointIndex / 6) * Math.PI * 2;
                positions.push(
                    x + Math.cos(leafletAngle) * 0.2,
                    y + Math.sin(leafletAngle) * 0.2,
                    0,
                );
            }
            for (let pointIndex = 1; pointIndex < 6; pointIndex += 1) {
                indices.push(
                    baseIndex,
                    baseIndex + pointIndex,
                    baseIndex + pointIndex + 1,
                );
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

/**
 * Low-cost silhouettes for leaves that are rendered on constrained devices.
 * Instance transforms, colors, sway, and exact L-system leaf counts stay
 * unchanged; only sub-pixel outline detail is removed.
 */
const compactLeafGeometries: Record<PlantLeafType, THREE.BufferGeometry> = {
    round: new THREE.CircleGeometry(1, 4),
    oval: createPolygonGeometry([
        [0, 1],
        [-0.58, 0.52],
        [-0.7, 0],
        [-0.58, -0.52],
        [0, -1],
        [0.58, -0.52],
        [0.7, 0],
        [0.58, 0.52],
    ]),
    heart: createPolygonGeometry([
        [0, -0.5],
        [-0.46, 0.04],
        [-0.48, 0.52],
        [-0.24, 0.76],
        [0, 0.5],
        [0.24, 0.76],
        [0.48, 0.52],
        [0.46, 0.04],
    ]),
    serrated: createPolygonGeometry([
        [1, 0],
        [0.42, 0.72],
        [0, 1],
        [-0.42, 0.72],
        [-1, 0],
        [-0.42, -0.72],
        [0, -1],
        [0.42, -0.72],
    ]),
    compound: createPolygonGeometry([
        [0, 0.82],
        [-0.22, 0.42],
        [-0.52, 0.5],
        [-0.24, 0.12],
        [-0.48, -0.12],
        [-0.12, -0.18],
        [0, -0.62],
        [0.12, -0.18],
        [0.48, -0.12],
        [0.24, 0.12],
        [0.52, 0.5],
        [0.22, 0.42],
    ]),
};

export function resolvePlantLeafGeometryDetail(
    qualityTier: GameQualityProfileTier,
): PlantLeafGeometryDetail {
    return qualityTier === 'low' || qualityTier === 'auto-constrained'
        ? 'compact'
        : 'full';
}

export function getPlantLeafGeometry(
    type: PlantLeafType,
    detail: PlantLeafGeometryDetail,
) {
    return detail === 'compact'
        ? compactLeafGeometries[type]
        : fullLeafGeometries[type];
}

export function getPlantLeafGeometryTriangleCount(
    type: PlantLeafType,
    detail: PlantLeafGeometryDetail,
) {
    const geometry = getPlantLeafGeometry(type, detail);
    return geometry.index
        ? geometry.index.count / 3
        : geometry.getAttribute('position').count / 3;
}
