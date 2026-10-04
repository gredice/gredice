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

function createSymmetricLeafGeometry(
    profile: readonly [height: number, halfWidth: number][],
) {
    return createPolygonGeometry([
        ...profile.map(
            ([height, halfWidth]) => [-halfWidth, height] as [number, number],
        ),
        ...[...profile]
            .reverse()
            .map(
                ([height, halfWidth]) =>
                    [halfWidth, height] as [number, number],
            ),
    ]);
}

function mergeLeafGeometries(geometries: THREE.BufferGeometry[]) {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    for (const geometry of geometries) {
        const position = geometry.getAttribute('position');
        if (!position) {
            geometry.dispose();
            continue;
        }

        for (let index = 0; index < position.count; index += 1) {
            positions.push(
                position.getX(index),
                position.getY(index),
                position.getZ(index),
            );
        }

        if (geometry.index) {
            for (let index = 0; index < geometry.index.count; index += 1) {
                indices.push(geometry.index.getX(index) + vertexOffset);
            }
        } else {
            for (let index = 0; index + 2 < position.count; index += 3) {
                indices.push(
                    vertexOffset + index,
                    vertexOffset + index + 1,
                    vertexOffset + index + 2,
                );
            }
        }

        vertexOffset += position.count;
        geometry.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    merged.setIndex(indices);
    merged.computeVertexNormals();
    return merged;
}

function createFeatheryLeaflet({
    dissected,
    halfWidth,
    length,
    originX,
    originY,
    side,
    tipLift,
}: {
    dissected: boolean;
    halfWidth: number;
    length: number;
    originX: number;
    originY: number;
    side: number;
    tipLift: number;
}) {
    const tipX = originX + side * length;
    const tipY = originY + tipLift;
    const outline: readonly [number, number][] = dissected
        ? [
              [originX, originY],
              [originX + side * length * 0.16, originY - halfWidth * 0.42],
              [originX + side * length * 0.3, originY - halfWidth * 0.1],
              [
                  originX + side * length * 0.56,
                  originY - halfWidth * 0.48 + tipLift * 0.32,
              ],
              [tipX, tipY],
              [
                  originX + side * length * 0.52,
                  originY + halfWidth * 0.5 + tipLift * 0.4,
              ],
              [originX + side * length * 0.28, originY + halfWidth * 0.12],
              [originX + side * length * 0.12, originY + halfWidth * 0.36],
          ]
        : [
              [originX, originY],
              [originX + side * length * 0.24, originY - halfWidth * 0.85],
              [
                  originX + side * length * 0.72,
                  originY - halfWidth * 0.28 + tipLift * 0.52,
              ],
              [tipX, tipY],
              [
                  originX + side * length * 0.58,
                  originY + halfWidth * 0.62 + tipLift * 0.42,
              ],
              [originX + side * length * 0.18, originY + halfWidth * 0.32],
          ];

    return createPolygonGeometry(outline);
}

function createFrondGeometry({
    dissected,
    leafletLengthScale = 0.84,
    leafletPairCount,
    leafletWidthRatio = 0.24,
    liftLeaflets,
}: {
    dissected: boolean;
    leafletLengthScale?: number;
    leafletPairCount: number;
    leafletWidthRatio?: number;
    liftLeaflets: boolean;
}) {
    const geometries: THREE.BufferGeometry[] = [
        createPolygonGeometry([
            [-0.03, -1],
            [-0.018, 0.76],
            [0, 1],
            [0.018, 0.76],
            [0.03, -1],
        ]),
        createPolygonGeometry([
            [-0.05, 0.7],
            [0, 1],
            [0.05, 0.7],
            [0, 0.58],
        ]),
    ];

    for (let pairIndex = 0; pairIndex < leafletPairCount; pairIndex += 1) {
        const t = (pairIndex + 0.42) / (leafletPairCount + 0.35);
        const y = -0.9 + t * 1.68;
        const length = leafletLengthScale * (1 - t * 0.56);
        const halfWidth = Math.max(0.055, length * leafletWidthRatio);
        const tipLift = length * 0.4;
        const zOffset = liftLeaflets
            ? (pairIndex % 2 === 0 ? 1 : -1) * 0.05 * (1 - t * 0.3)
            : 0;

        for (const side of [-1, 1]) {
            const leaflet = createFeatheryLeaflet({
                dissected,
                halfWidth,
                length,
                originX: side * 0.018,
                originY: y,
                side,
                tipLift,
            });
            if (zOffset !== 0) {
                leaflet.translate(0, 0, zOffset * side);
            }
            geometries.push(leaflet);
        }
    }

    return mergeLeafGeometries(geometries);
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
    compound: createFrondGeometry({
        dissected: true,
        leafletLengthScale: 0.62,
        leafletPairCount: 4,
        leafletWidthRatio: 0.46,
        liftLeaflets: true,
    }),
    ruffled: createSymmetricLeafGeometry([
        [-1, 0],
        [-0.82, 0.48],
        [-0.62, 0.38],
        [-0.42, 0.66],
        [-0.18, 0.52],
        [0.08, 0.72],
        [0.32, 0.5],
        [0.56, 0.62],
        [0.78, 0.34],
        [1, 0],
    ]),
    lobed: createSymmetricLeafGeometry([
        [-1, 0],
        [-0.74, 0.26],
        [-0.58, 0.58],
        [-0.36, 0.28],
        [-0.08, 0.72],
        [0.16, 0.3],
        [0.48, 0.6],
        [0.72, 0.26],
        [1, 0],
    ]),
    strap: createSymmetricLeafGeometry([
        [0, 0.05],
        [0.09, 0.18],
        [0.325, 0.2],
        [0.675, 0.2],
        [0.91, 0.16],
        [1, 0],
    ]),
    tubular: createSymmetricLeafGeometry([
        [0, 0.03],
        [0.12, 0.12],
        [0.88, 0.12],
        [1, 0.025],
    ]),
    lanceolate: createSymmetricLeafGeometry([
        [-1, 0],
        [-0.78, 0.22],
        [-0.35, 0.42],
        [0.1, 0.48],
        [0.52, 0.34],
        [0.82, 0.16],
        [1, 0],
    ]),
    trifoliate: createPolygonGeometry([
        [0, -0.72],
        [-0.18, -0.16],
        [-0.72, -0.3],
        [-0.92, 0.08],
        [-0.62, 0.44],
        [-0.18, 0.26],
        [-0.32, 0.78],
        [0, 1],
        [0.32, 0.78],
        [0.18, 0.26],
        [0.62, 0.44],
        [0.92, 0.08],
        [0.72, -0.3],
        [0.18, -0.16],
    ]),
    pinnate: createFrondGeometry({
        dissected: false,
        leafletLengthScale: 0.72,
        leafletPairCount: 5,
        leafletWidthRatio: 0.4,
        liftLeaflets: true,
    }),
    feathery: createFrondGeometry({
        dissected: true,
        leafletPairCount: 6,
        liftLeaflets: true,
    }),
    palmate: createPolygonGeometry([
        [0, -0.66],
        [-0.16, -0.08],
        [-0.7, -0.42],
        [-0.46, 0.02],
        [-0.98, 0.12],
        [-0.42, 0.3],
        [-0.62, 0.84],
        [-0.16, 0.42],
        [0, 1],
        [0.16, 0.42],
        [0.62, 0.84],
        [0.42, 0.3],
        [0.98, 0.12],
        [0.46, 0.02],
        [0.7, -0.42],
        [0.16, -0.08],
    ]),
};

/**
 * Low-cost silhouettes for leaves that are rendered on constrained devices.
 * Instance transforms, colors, sway, and exact organ-graph leaf counts stay
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
    compound: createFrondGeometry({
        dissected: false,
        leafletLengthScale: 0.62,
        leafletPairCount: 2,
        leafletWidthRatio: 0.46,
        liftLeaflets: false,
    }),
    ruffled: createSymmetricLeafGeometry([
        [-1, 0],
        [-0.58, 0.48],
        [-0.12, 0.6],
        [0.4, 0.52],
        [0.78, 0.3],
        [1, 0],
    ]),
    lobed: createSymmetricLeafGeometry([
        [-1, 0],
        [-0.58, 0.48],
        [-0.2, 0.3],
        [0.22, 0.54],
        [0.62, 0.28],
        [1, 0],
    ]),
    strap: createSymmetricLeafGeometry([
        [0, 0.04],
        [0.225, 0.18],
        [0.775, 0.18],
        [1, 0],
    ]),
    tubular: createSymmetricLeafGeometry([
        [0, 0.025],
        [0.225, 0.11],
        [0.775, 0.11],
        [1, 0.02],
    ]),
    lanceolate: createSymmetricLeafGeometry([
        [-1, 0],
        [-0.4, 0.4],
        [0.3, 0.42],
        [0.78, 0.18],
        [1, 0],
    ]),
    trifoliate: createPolygonGeometry([
        [0, -0.7],
        [-0.18, -0.1],
        [-0.82, -0.18],
        [-0.54, 0.4],
        [-0.18, 0.26],
        [0, 0.94],
        [0.18, 0.26],
        [0.54, 0.4],
        [0.82, -0.18],
        [0.18, -0.1],
    ]),
    pinnate: createFrondGeometry({
        dissected: false,
        leafletLengthScale: 0.72,
        leafletPairCount: 3,
        leafletWidthRatio: 0.4,
        liftLeaflets: false,
    }),
    feathery: createFrondGeometry({
        dissected: true,
        leafletPairCount: 3,
        liftLeaflets: false,
    }),
    palmate: createPolygonGeometry([
        [0, -0.62],
        [-0.18, -0.06],
        [-0.86, -0.28],
        [-0.44, 0.22],
        [-0.56, 0.78],
        [-0.14, 0.42],
        [0, 0.96],
        [0.14, 0.42],
        [0.56, 0.78],
        [0.44, 0.22],
        [0.86, -0.28],
        [0.18, -0.06],
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
