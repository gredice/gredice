import {
    type BufferAttribute,
    type BufferGeometry,
    Float32BufferAttribute,
    type InterleavedBufferAttribute,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
} from 'three';
import { WEATHER_SURFACE_ATTRIBUTE_NAMES } from '../../scene/weatherSurfaceGeometry';

/** Distance each side of a strip is lifted to tell which way it faces. */
const orientationLift = 0.01;
/** A face leaning away from or over its open edge by more than this gets a welt or a hem. */
const leanTolerance = 0.05;
/** A face whose normal's upward share is below this faces down. */
const downwardLimit = -0.5;
/**
 * A face whose normal's upward share is above this lifts mostly along its
 * normal (the weather material's side band ends below it), so it can lean
 * over a toe.
 */
const slopeFloor = 0.4;

const bridgedGeometries = new WeakMap<BufferGeometry, BufferGeometry>();

type Attribute = BufferAttribute | InterleavedBufferAttribute;
type Vector = [number, number, number];
/**
 * A new vertex: a welt faces straight up and lifts with a level top beside
 * it; a hem keeps its source's normal and stays on the toe.
 */
type Copy = { kind: 'welt' | 'hem'; source: number };

function numberKey(value: number) {
    return Object.is(value, -0) ? '0' : String(value);
}

function component(attribute: Attribute, index: number, item: number) {
    if (item === 0) return attribute.getX(index);
    if (item === 1) return attribute.getY(index);
    if (item === 2) return attribute.getZ(index);
    return attribute.getW(index);
}

/**
 * Seals the cracks the integrated snow (`createWeatherSurfaceGeometry`)
 * opens in a sloped terrain top, with strips that lie flat without snow.
 *
 * Snow lifts each vertex along its own normal. The two faces of a hard
 * crease (the fold across a corner block's top, the edge between a slope and
 * a side) pull apart, and the block under them showed through as a green
 * crack. The skirts that close open edges rise straight up and cannot follow
 * a tilted face. A strip of zero width that reuses the faces' own vertices
 * joins each crease: it stretches across as the faces lift.
 *
 * A face that leans away from an open edge (an inner corner's top beside its
 * high walls) pulls away from a level neighbour's top, which lifts straight
 * up. That edge gets a welt: a copy of the edge facing straight up, joined
 * to the face by a strip, so the edge lifts with the neighbour's.
 *
 * The bottom of a block never shows, so it stays put (`aSnowLayer` 0) and
 * no crease with it is bridged. Lifted like a side, straight up, its edge
 * along a ramp's or corner's toe stood proud of the slope's cover, which
 * lifts out along its normal: a bridge there showed as a grey band along the
 * toe, and the bottom's skirt as a thin line.
 *
 * A slope that leans over an open edge (that toe) lifts the edge out past
 * the toe instead. The edge gets a hem: a copy of the edge with the slope's
 * own normal that stays on the toe (`aSnowLayer` 0), joined to the face by a
 * strip, so the cover folds down to the toe and shades like the slope.
 *
 * Cached by source, so every user shares one geometry.
 */
export function bridgeWeatherCreases(source: BufferGeometry): BufferGeometry {
    const cached = bridgedGeometries.get(source);
    if (cached) return cached;
    const bridged = createBridgedGeometry(source);
    bridgedGeometries.set(source, bridged);
    return bridged;
}

function createBridgedGeometry(source: BufferGeometry) {
    const position = source.getAttribute('position');
    const normal = source.getAttribute('normal');
    // Groups would leave the strips outside every draw range, and morph
    // targets would need the new vertices too.
    if (
        !position ||
        !normal ||
        source.groups.length > 0 ||
        Object.keys(source.morphAttributes).length > 0
    ) {
        return source;
    }
    const count = position.count;
    const index = source.getIndex();
    const indices = index
        ? Array.from({ length: index.count }, (_, offset) => index.getX(offset))
        : Array.from({ length: count }, (_, offset) => offset);
    const positionKeys = Array.from({ length: count }, (_, vertex) =>
        [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
            .map(numberKey)
            .join(':'),
    );
    // A vertex is its position and normal, as the weather surface keys it:
    // faces that share both are welded there and lift together.
    const vertexKeys = positionKeys.map(
        (key, vertex) =>
            `${key}|${[normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex)].map(numberKey).join(':')}`,
    );
    const facesDown = (vertex: number) => normal.getY(vertex) < downwardLimit;

    type Edge = { count: number; start: number; end: number };
    const edges = new Map<string, Edge>();
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const [a, b, c] = [
            indices[offset],
            indices[offset + 1],
            indices[offset + 2],
        ];
        for (const [start, end] of [
            [a, b],
            [b, c],
            [c, a],
        ]) {
            const key =
                vertexKeys[start] < vertexKeys[end]
                    ? `${vertexKeys[start]}|${vertexKeys[end]}`
                    : `${vertexKeys[end]}|${vertexKeys[start]}`;
            const edge = edges.get(key);
            if (edge) edge.count += 1;
            else edges.set(key, { count: 1, start, end });
        }
    }
    // Open edges of the faces that lift; the bottom's are left alone.
    const openEdges = [...edges.values()].filter(
        (edge) =>
            edge.count === 1 &&
            positionKeys[edge.start] !== positionKeys[edge.end] &&
            !facesDown(edge.start) &&
            !facesDown(edge.end),
    );

    // Open edges that lie on another open edge: the two sides of a crease.
    const creases = new Map<string, Edge[]>();
    for (const edge of openEdges) {
        const from = positionKeys[edge.start];
        const to = positionKeys[edge.end];
        const key = from < to ? `${from}|${to}` : `${to}|${from}`;
        const sides = creases.get(key) ?? [];
        sides.push(edge);
        creases.set(key, sides);
    }

    const copies: Copy[] = [];
    const copyOf = (vertex: number) =>
        vertex < count ? undefined : copies[vertex - count];
    const sourceOf = (vertex: number) => copyOf(vertex)?.source ?? vertex;
    const pointOf = (vertex: number): Vector => {
        const from = sourceOf(vertex);
        return [position.getX(from), position.getY(from), position.getZ(from)];
    };
    const normalOf = (vertex: number): Vector => {
        if (copyOf(vertex)?.kind === 'welt') return [0, 1, 0];
        const from = sourceOf(vertex);
        return [normal.getX(from), normal.getY(from), normal.getZ(from)];
    };
    const lifted = (vertex: number): Vector => {
        const point = pointOf(vertex);
        if (copyOf(vertex)?.kind === 'hem') return point;
        const direction = normalOf(vertex);
        return [
            point[0] + direction[0] * orientationLift,
            point[1] + direction[1] * orientationLift,
            point[2] + direction[2] * orientationLift,
        ];
    };
    /**
     * The triangle wound to face, once lifted, toward `toward` or else the
     * way its normals point.
     */
    const facing = (a: number, b: number, c: number, toward?: Vector) => {
        const [pa, pb, pc] = [lifted(a), lifted(b), lifted(c)];
        const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const face = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ];
        const [na, nb, nc] = [normalOf(a), normalOf(b), normalOf(c)];
        let dot = 0;
        for (let axis = 0; axis < 3; axis++) {
            dot +=
                face[axis] *
                (toward ? toward[axis] : na[axis] + nb[axis] + nc[axis]);
        }
        return dot < 0 ? [a, c, b] : [a, b, c];
    };

    const strips: number[] = [];
    const bridged = new Set<Edge>();
    for (const sides of creases.values()) {
        if (sides.length !== 2) continue;
        const [first, second] = sides;
        // Pair each end of the first side with the same point of the second.
        const [secondStart, secondEnd] =
            positionKeys[second.start] === positionKeys[first.start]
                ? [second.start, second.end]
                : [second.end, second.start];
        strips.push(
            ...facing(first.start, first.end, secondEnd),
            ...facing(first.start, secondEnd, secondStart),
        );
        bridged.add(first);
        bridged.add(second);
    }

    // Welts and hems on open edges by how their face leans, outward being
    // away from the middle of the geometry (as the weather skirts take it).
    let [minX, maxX, minZ, maxZ] = [
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
    ];
    for (let vertex = 0; vertex < count; vertex++) {
        minX = Math.min(minX, position.getX(vertex));
        maxX = Math.max(maxX, position.getX(vertex));
        minZ = Math.min(minZ, position.getZ(vertex));
        maxZ = Math.max(maxZ, position.getZ(vertex));
    }
    const centre = [(minX + maxX) / 2, (minZ + maxZ) / 2];
    for (const edge of openEdges) {
        if (bridged.has(edge)) continue;
        const [sx, , sz] = pointOf(edge.start);
        const [ex, , ez] = pointOf(edge.end);
        let outward = [ez - sz, sx - ex];
        const length = Math.hypot(outward[0], outward[1]);
        if (length < 1e-6) continue;
        outward = [outward[0] / length, outward[1] / length];
        const middle = [(sx + ex) / 2 - centre[0], (sz + ez) / 2 - centre[1]];
        if (outward[0] * middle[0] + outward[1] * middle[1] < 0) {
            outward = [-outward[0], -outward[1]];
        }
        const [nx, ny, nz] = normalOf(edge.start);
        const lean = nx * outward[0] + nz * outward[1];
        const kind =
            lean < -leanTolerance
                ? 'welt'
                : lean > leanTolerance && ny > slopeFloor
                  ? 'hem'
                  : undefined;
        if (!kind) continue;
        const startCopy = count + copies.length;
        copies.push({ kind, source: edge.start });
        const endCopy = count + copies.length;
        copies.push({ kind, source: edge.end });
        // A hem hangs from the lifted toe down to the toe: it faces out.
        const toward: Vector | undefined =
            kind === 'hem' ? [outward[0], 0, outward[1]] : undefined;
        strips.push(
            ...facing(edge.start, edge.end, endCopy, toward),
            ...facing(edge.start, endCopy, startCopy, toward),
        );
    }
    if (!strips.length) return source;

    const result = source.clone();
    const total = count + copies.length;
    if (copies.length) {
        for (const [name, attribute] of Object.entries(source.attributes)) {
            const { itemSize } = attribute;
            const values = new Float32Array(total * itemSize);
            for (let vertex = 0; vertex < total; vertex++) {
                const from = sourceOf(vertex);
                const welt = copyOf(vertex)?.kind === 'welt';
                for (let item = 0; item < itemSize; item++) {
                    values[vertex * itemSize + item] =
                        name === 'normal' && welt
                            ? item === 1
                                ? 1
                                : 0
                            : component(attribute, from, item);
                }
            }
            result.setAttribute(
                name,
                new Float32BufferAttribute(values, itemSize),
            );
        }
    }
    const pinned = (vertex: number) =>
        copyOf(vertex)?.kind === 'hem' || (vertex < count && facesDown(vertex));
    if (Array.from({ length: total }, (_, vertex) => vertex).some(pinned)) {
        // How far snow may lift each vertex: as the source says (else
        // fully), and not at all on the bottom or a hem's toe.
        const sourceLayer = source.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.snowLayer,
        );
        const layers = new Float32Array(total);
        for (let vertex = 0; vertex < total; vertex++) {
            layers[vertex] = pinned(vertex)
                ? 0
                : (sourceLayer?.getX(sourceOf(vertex)) ?? 1);
        }
        result.setAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.snowLayer,
            new Float32BufferAttribute(layers, 1),
        );
    }
    const all = [...indices, ...strips];
    result.setIndex(
        total > 65_535
            ? new Uint32BufferAttribute(all, 1)
            : new Uint16BufferAttribute(all, 1),
    );
    return result;
}
