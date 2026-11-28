import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import {
    createWeatherSurfaceGeometry,
    getWeatherSurfaceGeometryMetadata,
} from '../../scene/weatherSurfaceGeometry';
import { bridgeWeatherCreases } from './weatherCreaseBridges';

const slope = 0.4 / Math.hypot(1, 0.4);
const up = 1 / Math.hypot(1, 0.4);

/**
 * The top of `Block_Grass_Corner_1_2`: two faces with their own normals,
 * folded along the diagonal from the low corner to the apex.
 */
function cornerTop() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
            [
                [-0.5, -0.2, 0.5],
                [0.5, -0.2, 0.5],
                [0.5, 0.2, -0.5],
                [-0.5, -0.2, 0.5],
                [0.5, 0.2, -0.5],
                [-0.5, -0.2, -0.5],
            ].flat(),
            3,
        ),
    );
    geometry.setAttribute(
        'normal',
        new Float32BufferAttribute(
            [
                [0, up, slope],
                [0, up, slope],
                [0, up, slope],
                [-slope, up, 0],
                [-slope, up, 0],
                [-slope, up, 0],
            ].flat(),
            3,
        ),
    );
    geometry.setIndex([0, 1, 2, 3, 4, 5]);
    return geometry;
}

/**
 * The top of `Block_Grass_Reverse_Corner_1_2`: high along -z and +x, low at
 * the -x +z corner, folded along the diagonal. Both faces lean away from
 * their high edges.
 */
function reverseCornerTop() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
            [
                [-0.5, 0.2, -0.5],
                [-0.5, -0.2, 0.5],
                [0.5, 0.2, -0.5],
                [0.5, 0.2, -0.5],
                [-0.5, -0.2, 0.5],
                [0.5, 0.2, 0.5],
            ].flat(),
            3,
        ),
    );
    geometry.setAttribute(
        'normal',
        new Float32BufferAttribute(
            [
                [0, up, slope],
                [0, up, slope],
                [0, up, slope],
                [-slope, up, 0],
                [-slope, up, 0],
                [-slope, up, 0],
            ].flat(),
            3,
        ),
    );
    geometry.setAttribute(
        'uv',
        new Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1], 2),
    );
    geometry.setIndex([0, 1, 2, 3, 4, 5]);
    return geometry;
}

function vertex(geometry: BufferGeometry, index: number, lift = 0) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    return new Vector3()
        .fromBufferAttribute(position, index)
        .addScaledVector(
            new Vector3().fromBufferAttribute(normal, index),
            lift,
        );
}

function triangles(geometry: BufferGeometry) {
    const index = geometry.getIndex();
    assert.ok(index);
    const result: [number, number, number][] = [];
    for (let offset = 0; offset < index.count; offset += 3) {
        result.push([
            index.getX(offset),
            index.getX(offset + 1),
            index.getX(offset + 2),
        ]);
    }
    return result;
}

/**
 * `Block_Grass_Angle_1_2`: a wedge whose slope rises from its toe at -x to
 * its back wall at +x, with a bottom and two triangular sides, each face with
 * its own normal.
 */
function rampWedge() {
    const faces: { normal: number[]; points: number[][] }[] = [
        {
            normal: [-slope, up, 0],
            points: [
                [-0.5, -0.2, -0.5],
                [-0.5, -0.2, 0.5],
                [0.5, 0.2, 0.5],
                [0.5, 0.2, -0.5],
            ],
        },
        {
            normal: [0, -1, 0],
            points: [
                [-0.5, -0.2, -0.5],
                [0.5, -0.2, -0.5],
                [0.5, -0.2, 0.5],
                [-0.5, -0.2, 0.5],
            ],
        },
        {
            normal: [1, 0, 0],
            points: [
                [0.5, -0.2, 0.5],
                [0.5, -0.2, -0.5],
                [0.5, 0.2, -0.5],
                [0.5, 0.2, 0.5],
            ],
        },
        {
            normal: [0, 0, 1],
            points: [
                [-0.5, -0.2, 0.5],
                [0.5, -0.2, 0.5],
                [0.5, 0.2, 0.5],
            ],
        },
        {
            normal: [0, 0, -1],
            points: [
                [-0.5, -0.2, -0.5],
                [0.5, 0.2, -0.5],
                [0.5, -0.2, -0.5],
            ],
        },
    ];
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    for (const face of faces) {
        const first = positions.length / 3;
        for (const point of face.points) {
            positions.push(...point);
            normals.push(...face.normal);
        }
        for (let corner = 1; corner + 1 < face.points.length; corner++) {
            indices.push(first, first + corner, first + corner + 1);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    return geometry;
}

describe('weather crease bridges', () => {
    it('takes the fold of a corner top off the open edges', () => {
        const source = cornerTop();
        const bridged = bridgeWeatherCreases(source);
        assert.notEqual(bridged, source);
        // Two triangles across the fold, and a hem (two copies, two
        // triangles) on each of the two toes.
        assert.equal(
            bridged.getAttribute('position').count,
            source.getAttribute('position').count + 4,
        );
        assert.equal(triangles(bridged).length, 8);
        // The sides keep their skirts; the fold and the hemmed toes have
        // none.
        const plain = getWeatherSurfaceGeometryMetadata(
            createWeatherSurfaceGeometry(source),
        );
        const sealed = getWeatherSurfaceGeometryMetadata(
            createWeatherSurfaceGeometry(bridged),
        );
        assert.equal(plain?.boundaryEdgeCount, 6);
        assert.equal(sealed?.boundaryEdgeCount, 2);
    });

    it('draws nothing without snow and closes the fold when it lifts', () => {
        const bridged = bridgeWeatherCreases(cornerTop());
        const strips = triangles(bridged).slice(2, 4);
        for (const [a, b, c] of strips) {
            // Flat on the fold at rest...
            const area = vertex(bridged, b)
                .sub(vertex(bridged, a))
                .cross(vertex(bridged, c).sub(vertex(bridged, a)))
                .length();
            assert.ok(area < 1e-9);
            // ...and across the gap, facing up, once each face lifts along
            // its own normal.
            const lift = 0.04;
            const face = vertex(bridged, b, lift)
                .sub(vertex(bridged, a, lift))
                .cross(vertex(bridged, c, lift).sub(vertex(bridged, a, lift)));
            assert.ok(face.length() > 1e-6);
            assert.ok(face.y > 0);
        }
        // Every lifted edge along the fold is shared by two triangles.
        const counts = new Map<string, number>();
        for (const [a, b, c] of triangles(bridged)) {
            for (const [start, end] of [
                [a, b],
                [b, c],
                [c, a],
            ]) {
                const key = start < end ? `${start}|${end}` : `${end}|${start}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
        const apex = new Vector3(0.5, 0.2, -0.5);
        const low = new Vector3(-0.5, -0.2, 0.5);
        const onFold = (index: number) =>
            vertex(bridged, index).distanceTo(apex) < 1e-6 ||
            vertex(bridged, index).distanceTo(low) < 1e-6;
        for (const [key, count] of counts) {
            const [start, end] = key.split('|').map(Number);
            if (!onFold(start) || !onFold(end)) continue;
            const length = vertex(bridged, start).distanceTo(
                vertex(bridged, end),
            );
            if (length < 1e-6) continue;
            assert.equal(count, 2, key);
        }
    });

    it('welts the high edges of an inner corner to lift straight up', () => {
        const source = reverseCornerTop();
        const bridged = bridgeWeatherCreases(source);
        const position = bridged.getAttribute('position');
        const normal = bridged.getAttribute('normal');
        const uv = bridged.getAttribute('uv');
        // Each high edge gets an upward copy of its two ends.
        assert.equal(position.count, 10);
        assert.equal(uv.count, 10);
        const copies = [6, 7, 8, 9];
        for (const copy of copies) {
            assert.deepEqual(
                [normal.getX(copy), normal.getY(copy), normal.getZ(copy)],
                [0, 1, 0],
            );
            const point = vertex(bridged, copy);
            assert.ok(
                Math.abs(point.y - 0.2) < 1e-6,
                'copies sit on the high edges',
            );
            assert.ok(point.z === -0.5 || point.x === 0.5);
        }
        // The fold, then two strips per welt, all flat at rest and facing up
        // once lifted.
        const added = triangles(bridged).slice(2);
        assert.equal(added.length, 6);
        for (const [a, b, c] of added) {
            const area = vertex(bridged, b)
                .sub(vertex(bridged, a))
                .cross(vertex(bridged, c).sub(vertex(bridged, a)))
                .length();
            assert.ok(area < 1e-9);
            const lift = 0.04;
            const face = vertex(bridged, b, lift)
                .sub(vertex(bridged, a, lift))
                .cross(vertex(bridged, c, lift).sub(vertex(bridged, a, lift)));
            assert.ok(face.y > 0);
        }
        // The skirts move from the sloped high edges to their level copies.
        const weather = createWeatherSurfaceGeometry(bridged);
        assert.equal(
            getWeatherSurfaceGeometryMetadata(weather)?.boundaryEdgeCount,
            4,
        );
    });

    it('keeps a ramp bottom in place and hems its toe instead of bridging it', () => {
        const source = rampWedge();
        const sourceCount = source.getAttribute('position').count;
        const bridged = bridgeWeatherCreases(source);
        const normal = bridged.getAttribute('normal');
        const layer = bridged.getAttribute('aSnowLayer');
        assert.ok(layer);
        const isToe = (point: Vector3) =>
            Math.abs(point.x + 0.5) < 1e-6 && Math.abs(point.y + 0.2) < 1e-6;
        const facesDown = (index: number) => normal.getY(index) < -0.5;
        // The bottom never lifts; every other source vertex may.
        for (let index = 0; index < sourceCount; index++) {
            assert.equal(layer.getX(index), facesDown(index) ? 0 : 1);
        }
        // No strip reaches the bottom: a bridge from the slope's toe to it
        // stood proud of the slope's cover as a grey band.
        const added = triangles(bridged).slice(triangles(source).length);
        for (const triangle of added) {
            for (const index of triangle) {
                assert.equal(facesDown(index), false);
            }
        }
        // The toe gets a hem: copies of its ends with the slope's normal
        // that stay on the toe.
        const copies = Array.from(
            { length: bridged.getAttribute('position').count - sourceCount },
            (_, offset) => sourceCount + offset,
        );
        assert.equal(copies.length, 2);
        for (const copy of copies) {
            assert.ok(isToe(vertex(bridged, copy)));
            assert.ok(Math.abs(normal.getX(copy) + slope) < 1e-6);
            assert.ok(Math.abs(normal.getY(copy) - up) < 1e-6);
            assert.equal(layer.getX(copy), 0);
        }
        // The hem lies flat at rest and, once the slope lifts out along its
        // normal, hangs from it down to the toe, facing out.
        const lift = 0.04;
        const lifted = (index: number) =>
            vertex(bridged, index, layer.getX(index) * lift);
        const hems = added.filter((triangle) =>
            triangle.some((index) => copies.includes(index)),
        );
        assert.equal(hems.length, 2);
        for (const [a, b, c] of hems) {
            const area = vertex(bridged, b)
                .sub(vertex(bridged, a))
                .cross(vertex(bridged, c).sub(vertex(bridged, a)))
                .length();
            assert.ok(area < 1e-9);
            const face = lifted(b)
                .sub(lifted(a))
                .cross(lifted(c).sub(lifted(a)));
            assert.ok(face.length() > 1e-6);
            assert.ok(face.x < 0);
        }
        // No skirt rises along the toe: the slope's toe edge is hemmed and
        // the bottom's stays put.
        const weather = createWeatherSurfaceGeometry(bridged);
        const position = weather.getAttribute('position');
        const skirtNormal = weather.getAttribute('normal');
        const surface = weather.getAttribute('aWeatherSurface');
        const weatherLayer = weather.getAttribute('aSnowLayer');
        for (let index = 0; index < position.count; index += 1) {
            const point = new Vector3().fromBufferAttribute(position, index);
            if (
                surface.getX(index) !== 1 ||
                !isToe(point) ||
                weatherLayer.getX(index) === 0
            ) {
                continue;
            }
            // Only a side's bottom edge (facing ±z) lifts at a toe corner.
            assert.ok(
                Math.abs(Math.abs(skirtNormal.getZ(index)) - 1) < 1e-6,
                'a skirt lifts along the toe',
            );
        }
    });

    it('leaves a geometry without hard creases alone and caches by source', () => {
        const flat = new BufferGeometry();
        flat.setAttribute(
            'position',
            new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1], 3),
        );
        flat.setAttribute(
            'normal',
            new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3),
        );
        flat.setIndex([0, 2, 1, 0, 3, 2]);
        assert.equal(bridgeWeatherCreases(flat), flat);
        const source = cornerTop();
        assert.equal(
            bridgeWeatherCreases(source),
            bridgeWeatherCreases(source),
        );
    });
});
