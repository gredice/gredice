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

/**
 * A rounded leaf outline from a radial profile: `radius(angle)` is sampled
 * all the way round, with the angle measured from the leaf tip (+y). The
 * outline is then fitted into the given bounds, so a reshaped silhouette
 * keeps the footprint its instances were placed for.
 */
function createRadialLeafGeometry({
    bounds,
    radius,
    samples,
}: {
    bounds: { maxX: number; maxY: number; minY: number };
    radius: (angle: number) => number;
    samples: number;
}) {
    const points: [number, number][] = [];
    for (let index = 0; index < samples; index += 1) {
        const angle = -Math.PI + (index / samples) * Math.PI * 2;
        const length = radius(angle);
        points.push([Math.sin(angle) * length, Math.cos(angle) * length]);
    }
    const maxX = Math.max(...points.map(([x]) => Math.abs(x)));
    const ys = points.map(([, y]) => y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return createPolygonGeometry(
        points.map(([x, y]) => [
            (x / maxX) * bounds.maxX,
            bounds.minY +
                ((y - minY) / (maxY - minY)) * (bounds.maxY - bounds.minY),
        ]),
    );
}

/** Soft lobes: 1 at a lobe tip, 0 in the rounded sinus between two lobes. */
function softLobes(angle: number, lobeCount: number, roundness = 0.7) {
    return (0.5 + 0.5 * Math.cos(angle * lobeCount)) ** roundness;
}

/**
 * Bends a flat leaf's normals into a gentle dome, so each leaf shades from
 * its middle to its rim like a cupped toy leaf instead of showing one flat
 * colour. It moves no vertex and adds no triangle.
 */
function applyLeafDomeNormals(geometry: THREE.BufferGeometry, strength = 0.5) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const position = geometry.getAttribute('position');
    if (!box || !position) {
        return geometry;
    }
    const centerX = (box.min.x + box.max.x) / 2;
    const centerY = (box.min.y + box.max.y) / 2;
    const halfX = Math.max((box.max.x - box.min.x) / 2, 0.0001);
    const halfY = Math.max((box.max.y - box.min.y) / 2, 0.0001);
    const normals = new Float32Array(position.count * 3);
    const normal = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 1) {
        normal
            .set(
                ((position.getX(index) - centerX) / halfX) * strength,
                ((position.getY(index) - centerY) / halfY) * strength * 0.6,
                1,
            )
            .normalize();
        normals.set([normal.x, normal.y, normal.z], index * 3);
    }
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return geometry;
}

function withLeafDomeNormals(
    geometries: Record<PlantLeafType, THREE.BufferGeometry>,
) {
    for (const geometry of Object.values(geometries)) {
        applyLeafDomeNormals(geometry);
    }
    return geometries;
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

/**
 * One rounded leaflet of a frond: a smooth oval from `origin` along
 * `direction` (unit length), `length` long and `halfWidth` wide at its
 * broadest. `tipTaper` narrows the far end: 0 keeps a round, slightly
 * obovate leaflet (tomato, parsley), larger values give the softly pointed
 * lobes of a feathery carrot or dill frond. Never a thin needle or saw.
 */
function createRoundedLeaflet({
    direction,
    halfWidth,
    length,
    origin,
    samples,
    tipTaper,
}: {
    direction: readonly [number, number];
    halfWidth: number;
    length: number;
    origin: readonly [number, number];
    samples: number;
    tipTaper: number;
}) {
    const [directionX, directionY] = direction;
    const points: [number, number][] = [];
    for (let index = 0; index < samples; index += 1) {
        const angle = (index / samples) * Math.PI * 2;
        const along = (1 - Math.cos(angle)) / 2;
        const width =
            halfWidth *
            Math.sin(angle) *
            (0.86 + 0.28 * along * (1 - along) * 2 - tipTaper * along ** 2);
        const distance = along * length;
        points.push([
            origin[0] + directionX * distance - directionY * width,
            origin[1] + directionY * distance + directionX * width,
        ]);
    }
    return createPolygonGeometry(points);
}

/**
 * A frond (compound, pinnate or feathery leaf): a broad rachis carrying
 * pairs of rounded leaflets and one at the tip. Leaflets are at least 0.26
 * leaf units wide and the rachis 0.12, so at the small leaf scale of a
 * tomato or carrot in a bed they still read as soft leaves instead of
 * hair-thin wisps (GAME_ART.md: no visible part thinner than 0.03).
 */
function createFrondGeometry({
    leafletPairCount,
    leafletSamples,
    lengths,
    liftLeaflets,
    minimumHalfWidth,
    terminal,
    tipTaper,
    widthRatio,
    yRange,
}: {
    leafletPairCount: number;
    leafletSamples: number;
    /** Leaflet length of the lowest and of the highest pair. */
    lengths: readonly [number, number];
    liftLeaflets: boolean;
    minimumHalfWidth: number;
    /** Tip leaflet: where it starts on the rachis and its half width. */
    terminal: { halfWidth: number; startY: number };
    tipTaper: number;
    widthRatio: number;
    /** Heights of the lowest and highest leaflet pair on the rachis. */
    yRange: readonly [number, number];
}) {
    const geometries: THREE.BufferGeometry[] = [
        createPolygonGeometry([
            [-0.06, -1],
            [0.06, -1],
            [0.045, terminal.startY + 0.1],
            [-0.045, terminal.startY + 0.1],
        ]),
        createRoundedLeaflet({
            direction: [0, 1],
            halfWidth: terminal.halfWidth,
            length: 1 - terminal.startY,
            origin: [0, terminal.startY],
            samples: leafletSamples + 2,
            tipTaper,
        }),
    ];

    for (let pairIndex = 0; pairIndex < leafletPairCount; pairIndex += 1) {
        const t = leafletPairCount > 1 ? pairIndex / (leafletPairCount - 1) : 0;
        const y = THREE.MathUtils.lerp(yRange[0], yRange[1], t);
        const length = THREE.MathUtils.lerp(lengths[0], lengths[1], t);
        const halfWidth = Math.max(minimumHalfWidth, length * widthRatio);
        // Leaflets angle up toward the tip, a little more near the top.
        const lift = 0.3 + t * 0.25;
        const directionLength = Math.hypot(1, lift);
        const zOffset = liftLeaflets
            ? (pairIndex % 2 === 0 ? 1 : -1) * 0.05 * (1 - t * 0.3)
            : 0;

        for (const side of [-1, 1]) {
            const leaflet = createRoundedLeaflet({
                direction: [side / directionLength, lift / directionLength],
                halfWidth,
                length,
                origin: [side * 0.03, y],
                samples: leafletSamples,
                tipTaper,
            });
            if (zOffset !== 0) {
                leaflet.translate(0, 0, zOffset * side);
            }
            geometries.push(leaflet);
        }
    }

    return mergeLeafGeometries(geometries);
}

/** Tomato and raspberry: a few broad, round leaflets. */
const compoundFrond = {
    lengths: [0.64, 0.46],
    minimumHalfWidth: 0.14,
    terminal: { halfWidth: 0.22, startY: 0.3 },
    tipTaper: 0,
    widthRatio: 0.3,
    yRange: [-0.7, 0.14],
} as const;

/** Parsley, pea, celery: more and rounder leaflets along the rachis. */
const pinnateFrond = {
    lengths: [0.6, 0.4],
    minimumHalfWidth: 0.13,
    terminal: { halfWidth: 0.18, startY: 0.4 },
    tipTaper: 0.1,
    widthRatio: 0.3,
    yRange: [-0.75, 0.24],
} as const;

/** Carrot, dill, fennel: many soft, gently pointed lobes. */
const featheryFrond = {
    lengths: [0.66, 0.36],
    minimumHalfWidth: 0.13,
    terminal: { halfWidth: 0.13, startY: 0.5 },
    tipTaper: 0.35,
    widthRatio: 0.2,
    yRange: [-0.8, 0.4],
} as const;

/**
 * Toy-like leaf silhouettes (GAME_ART.md, Shape): broad, rounded lobes and
 * soft sinuses instead of saw teeth and star points, each still the outline
 * of its species' leaf.
 */
const fullLeafGeometries: Record<PlantLeafType, THREE.BufferGeometry> =
    withLeafDomeNormals({
        round: new THREE.CircleGeometry(1, 12),
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
        // A scalloped round leaf: soft teeth instead of a star.
        serrated: createRadialLeafGeometry({
            bounds: { maxX: 1, maxY: 1, minY: -1 },
            radius: (angle) => 0.86 + 0.14 * softLobes(angle, 8),
            samples: 24,
        }),
        compound: createFrondGeometry({
            ...compoundFrond,
            leafletPairCount: 3,
            leafletSamples: 8,
            liftLeaflets: true,
        }),
        // A frilly salad leaf: a broad oval with soft scallops all round,
        // never a zig-zag.
        ruffled: createRadialLeafGeometry({
            bounds: { maxX: 0.72, maxY: 1, minY: -1 },
            radius: (angle) =>
                (0.87 + 0.13 * softLobes(angle, 6, 0.8)) *
                (1 - 0.18 * (Math.abs(angle) / Math.PI) ** 2),
            samples: 24,
        }),
        // Three rounded lobes down each side of a long leaf.
        lobed: createSymmetricLeafGeometry(
            Array.from({ length: 13 }, (_, index) => {
                const t = index / 12;
                const envelope = Math.sin(Math.PI * t) ** 0.75;
                const lobe = (0.5 - 0.5 * Math.cos(Math.PI * 2 * 3 * t)) ** 0.7;
                return [-1 + t * 2, 0.74 * envelope * (0.6 + 0.4 * lobe)] as [
                    number,
                    number,
                ];
            }),
        ),
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
        // Three round leaflets on a short stalk.
        trifoliate: createRadialLeafGeometry({
            bounds: { maxX: 0.92, maxY: 1, minY: -0.72 },
            radius: (angle) => {
                const leaflet = Math.max(
                    ...[0, 0.64, -0.64].map((center) =>
                        Math.max(0, Math.cos((angle - center * Math.PI) * 1.9)),
                    ),
                );
                return 0.3 + 0.7 * leaflet ** 0.6;
            },
            samples: 30,
        }),
        pinnate: createFrondGeometry({
            ...pinnateFrond,
            leafletPairCount: 4,
            leafletSamples: 8,
            liftLeaflets: true,
        }),
        feathery: createFrondGeometry({
            ...featheryFrond,
            leafletPairCount: 5,
            leafletSamples: 8,
            liftLeaflets: true,
        }),
        // Five broad, rounded lobes with a notch at the stalk, like a squash
        // or fig leaf, instead of a five-pointed star.
        palmate: createRadialLeafGeometry({
            bounds: { maxX: 0.98, maxY: 1, minY: -0.66 },
            radius: (angle) =>
                (0.58 + 0.42 * softLobes(angle, 5, 0.6)) *
                (1 - 0.2 * (Math.abs(angle) / Math.PI) ** 1.5),
            samples: 30,
        }),
    });

/**
 * Low-cost silhouettes for leaves that are rendered on constrained devices.
 * Instance transforms, colors, sway, and exact organ-graph leaf counts stay
 * unchanged; only sub-pixel outline detail is removed.
 */
const compactLeafGeometries: Record<PlantLeafType, THREE.BufferGeometry> =
    withLeafDomeNormals({
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
            ...compoundFrond,
            leafletPairCount: 2,
            leafletSamples: 6,
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
            ...pinnateFrond,
            leafletPairCount: 2,
            leafletSamples: 6,
            liftLeaflets: false,
        }),
        feathery: createFrondGeometry({
            ...featheryFrond,
            leafletPairCount: 3,
            leafletSamples: 6,
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
    });

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
