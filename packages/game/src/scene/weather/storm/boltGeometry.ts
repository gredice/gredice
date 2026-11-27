import {
    BufferGeometry,
    ExtrudeGeometry,
    Float32BufferAttribute,
    Shape,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
    boltGeometryIndex,
    boltGeometryNormals,
    boltGeometryPositions,
} from './boltGeometryData';

/**
 * The bolt is the lightning icon in 3D (GAME_ART.md "Weather > Storm and
 * lightning"): a chunky zigzag, extruded and bevelled, about 0.46 as wide as
 * it is tall. The outline is the target page's (`boltGeometry` in
 * `docs/game-party-style/weather-scene.html`); the bolt is drawn facing the
 * camera, top up, so its height runs along the geometry's y axis.
 */
export const boltOutline: readonly (readonly [x: number, y: number])[] = [
    [-0.1, 1],
    [0.42, 1],
    [0.2, 0.3],
    [0.52, 0.3],
    [-0.2, -1],
    [0.02, -0.08],
    [-0.34, -0.08],
];

export const boltExtrusion = {
    depth: 0.08,
    bevelThickness: 0.09,
    bevelSize: 0.06,
    /** Four rings round the bevel: smooth at 150 px, 136 triangles. */
    bevelSegments: 4,
    /** The outline is straight lines; no extra points on them. */
    curveSegments: 1,
} as const;

/** Triangle budget of the bolt (plan WP5: at most 400). */
export const boltTriangleBudget = 400;

/**
 * Builds the bolt: the outline extruded with a rounded bevel, vertices
 * welded so the bevel shades smooth, centred on the origin. Pure; the game
 * draws the baked copy of it (`boltGeometryData.ts`, `getBoltGeometry`),
 * and a test checks the two still match.
 */
export function createBoltGeometry(): BufferGeometry {
    const shape = new Shape();
    const [first, ...rest] = boltOutline;
    if (first) shape.moveTo(first[0], first[1]);
    for (const [x, y] of rest) shape.lineTo(x, y);
    shape.closePath();
    const extruded = new ExtrudeGeometry(shape, {
        ...boltExtrusion,
        bevelEnabled: true,
    });
    // Weld on position only, then shade smooth across the bevel rings.
    extruded.deleteAttribute('uv');
    extruded.deleteAttribute('normal');
    const geometry = mergeVertices(extruded, 1e-5);
    extruded.dispose();
    geometry.computeVertexNormals();
    geometry.center();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'Weather:LightningBoltGeometry';
    return geometry;
}

/** The baked bolt (`boltGeometryData.ts`) as a geometry: no extrusion at run time. */
export function createBakedBoltGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute(boltGeometryPositions, 3),
    );
    geometry.setAttribute(
        'normal',
        new Float32BufferAttribute(boltGeometryNormals, 3),
    );
    geometry.setIndex(boltGeometryIndex.slice());
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'Weather:LightningBoltGeometry';
    return geometry;
}

let sharedBoltGeometry: BufferGeometry | null = null;

/**
 * The one bolt geometry of the session, from the baked data when a storm
 * first mounts, never during a strike.
 */
export function getBoltGeometry() {
    sharedBoltGeometry ??= createBakedBoltGeometry();
    return sharedBoltGeometry;
}

export function countBoltTriangles(geometry: BufferGeometry) {
    const index = geometry.getIndex();
    return index
        ? index.count / 3
        : geometry.getAttribute('position').count / 3;
}

/** Height and width of the bolt in geometry units, bevel included. */
export function resolveBoltSpan(geometry: BufferGeometry) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) {
        return { width: 0, height: 0, minY: 0, maxY: 0 };
    }
    return {
        width: box.max.x - box.min.x,
        height: box.max.y - box.min.y,
        minY: box.min.y,
        maxY: box.max.y,
    };
}

/**
 * Area the bolt covers on screen, in geometry units squared: the front
 * facing triangles projected onto the screen plane cover its silhouette
 * exactly once (an extrusion is closed and z-monotone).
 */
export function resolveBoltSilhouetteArea(geometry: BufferGeometry) {
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    let area = 0;
    for (let i = 0; i < count; i += 3) {
        const a = index ? index.getX(i) : i;
        const b = index ? index.getX(i + 1) : i + 1;
        const c = index ? index.getX(i + 2) : i + 2;
        const abx = position.getX(b) - position.getX(a);
        const aby = position.getY(b) - position.getY(a);
        const acx = position.getX(c) - position.getX(a);
        const acy = position.getY(c) - position.getY(a);
        const signed = (abx * acy - aby * acx) / 2;
        if (signed > 0) area += signed;
    }
    return area;
}
