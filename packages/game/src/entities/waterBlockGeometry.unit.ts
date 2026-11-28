import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector4 } from 'three';
import {
    createMergedWaterSideGeometry,
    createWaterBlockGeometry,
    getWaterBlockYOffset,
} from './waterBlockGeometry';

describe('createWaterBlockGeometry', () => {
    it('renders joined water as one top surface without internal side faces', () => {
        const geometry = createWaterBlockGeometry(new Vector4(0, 0, 0, 0));
        const positionAttribute = geometry.getAttribute('position');
        const indexAttribute = geometry.getIndex();

        assert.equal(positionAttribute.count, 4);
        assert.equal(indexAttribute?.count, 6);
        assert.deepEqual(geometryNormals(new Vector4(0, 0, 0, 0)), ['0,1,0']);

        geometry.dispose();
    });

    it('adds only the exposed side faces for edge water blocks', () => {
        assert.deepEqual(geometryNormals(new Vector4(1, 0, 1, 0)), [
            '-1,0,0',
            '0,0,-1',
            '0,1,0',
        ]);
    });

    it('can render only the water top for instanced joined water', () => {
        assert.deepEqual(
            geometryNormals(new Vector4(1, 1, 1, 1), {
                includeSides: false,
            }),
            ['0,1,0'],
        );
    });

    it('can render water sides without an internal top face', () => {
        assert.deepEqual(
            geometryNormals(new Vector4(1, 0, 1, 0), {
                includeTop: false,
            }),
            ['-1,0,0', '0,0,-1'],
        );
    });

    it('uses the requested visual height for water faces', () => {
        const geometry = createWaterBlockGeometry(new Vector4(1, 1, 1, 1), {
            height: 0.25,
        });

        assert.deepEqual(geometryYExtents(geometry), [-0.125, 0.125]);

        geometry.dispose();
    });

    it('winds every face around its outward normal', () => {
        const geometry = createWaterBlockGeometry(new Vector4(1, 1, 1, 1));

        assert.deepEqual(trianglesFacingAgainstNormal(geometry), []);

        geometry.dispose();
    });

    it('rounds exposed sides over with a lip and rounded corners', () => {
        const exposed = new Vector4(1, 1, 1, 1);
        const geometry = createWaterBlockGeometry(exposed, {
            rimEdges: exposed,
        });
        const normal = geometry.getAttribute('normal');
        let tiltedNormals = 0;

        for (let index = 0; index < normal.count; index += 1) {
            const [x, y, z] = [
                normal.getX(index),
                normal.getY(index),
                normal.getZ(index),
            ];
            assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-4);
            const isAxis = [x, y, z].some((value) => Math.abs(value) > 0.9999);
            if (!isAxis) tiltedNormals += 1;
        }

        // The lip and corner columns blend between the top and side normals.
        assert.ok(tiltedNormals > 0);
        assert.deepEqual(trianglesFacingAgainstNormal(geometry), []);
        const box = geometryXzExtents(geometry);
        assert.deepEqual(box, [-0.5, 0.5]);

        geometry.dispose();
    });

    it('keeps a lone water block square without rim flags', () => {
        assert.deepEqual(geometryNormals(new Vector4(1, 1, 1, 1)), [
            '-1,0,0',
            '0,0,-1',
            '0,0,1',
            '0,1,0',
            '1,0,0',
        ]);
    });
});

function geometryXzExtents(
    geometry: ReturnType<typeof createWaterBlockGeometry>,
) {
    const position = geometry.getAttribute('position');
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < position.count; index += 1) {
        min = Math.min(min, position.getX(index), position.getZ(index));
        max = Math.max(max, position.getX(index), position.getZ(index));
    }

    return [Number(min.toFixed(6)), Number(max.toFixed(6))];
}

/**
 * Triangles whose vertex order winds against their stored normal. A lit
 * double-sided material treats them as seen from behind and flips their
 * normal, so that side of the water loses its light.
 */
function trianglesFacingAgainstNormal(
    geometry: ReturnType<typeof createWaterBlockGeometry>,
) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex();
    const reversed: string[] = [];
    if (!index) return ['missing index'];

    for (let offset = 0; offset < index.count; offset += 3) {
        const [a, b, c] = [0, 1, 2].map((corner) => {
            const vertex = index.getX(offset + corner);
            return [
                position.getX(vertex),
                position.getY(vertex),
                position.getZ(vertex),
            ];
        });
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const winding = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ];
        const first = index.getX(offset);
        const stored = [
            normal.getX(first),
            normal.getY(first),
            normal.getZ(first),
        ];
        const alignment =
            winding[0] * stored[0] +
            winding[1] * stored[1] +
            winding[2] * stored[2];

        if (alignment <= 0) reversed.push(stored.join(','));
    }

    return reversed;
}

function geometryNormals(
    foamEdges: Vector4,
    options?: Parameters<typeof createWaterBlockGeometry>[1],
) {
    const geometry = createWaterBlockGeometry(foamEdges, options);
    const normalAttribute = geometry.getAttribute('normal');
    const normals = new Set<string>();

    for (let index = 0; index < normalAttribute.count; index += 1) {
        normals.add(
            [
                normalAttribute.getX(index),
                normalAttribute.getY(index),
                normalAttribute.getZ(index),
            ].join(','),
        );
    }

    geometry.dispose();
    return [...normals].sort();
}

function geometryYExtents(
    geometry: ReturnType<typeof createWaterBlockGeometry>,
) {
    const positionAttribute = geometry.getAttribute('position');
    const yValues = new Set<number>();

    for (let index = 0; index < positionAttribute.count; index += 1) {
        yValues.add(Number(positionAttribute.getY(index).toFixed(6)));
    }

    return [...yValues].sort((left, right) => left - right);
}

describe('createMergedWaterSideGeometry', () => {
    it('winds every merged side wall around its outward normal', () => {
        const geometry = createMergedWaterSideGeometry([
            { position: [0, 0, 0] },
            { position: [1, 0, 0] },
            { position: [0, 0, 1] },
        ]);

        assert.ok((geometry.getIndex()?.count ?? 0) > 0);
        assert.deepEqual(trianglesFacingAgainstNormal(geometry), []);

        const rounded = createMergedWaterSideGeometry([
            { position: [0, 0, 0], rimEdges: new Vector4(1, 0, 1, 1) },
            { position: [1, 0, 0], rimEdges: new Vector4(0, 1, 1, 1) },
        ]);
        assert.deepEqual(trianglesFacingAgainstNormal(rounded), []);
        rounded.dispose();

        geometry.dispose();
    });

    it('merges continuous exterior side walls across adjacent water blocks', () => {
        const geometry = createMergedWaterSideGeometry([
            { position: [0, 0, 0] },
            { position: [1, 0, 0] },
        ]);
        const positionAttribute = geometry.getAttribute('position');
        const indexAttribute = geometry.getIndex();

        assert.equal(positionAttribute.count, 16);
        assert.equal(indexAttribute?.count, 24);

        geometry.dispose();
    });

    it('uses neighbor instances to hide side walls across chunk boundaries', () => {
        const geometry = createMergedWaterSideGeometry(
            [{ position: [0, 0, 0] }],
            {
                neighborInstances: [
                    { position: [0, 0, 0] },
                    { position: [1, 0, 0] },
                ],
            },
        );
        const positionAttribute = geometry.getAttribute('position');
        const indexAttribute = geometry.getIndex();

        assert.equal(positionAttribute.count, 12);
        assert.equal(indexAttribute?.count, 18);

        geometry.dispose();
    });

    it('hides internal sides when a style batch receives mixed-water neighbors', () => {
        const standardWater = {
            position: [0, 0, 0] as [number, number, number],
            style: 'standard',
        };
        const swampWater = {
            position: [1, 0, 0] as [number, number, number],
            style: 'swamp',
        };
        const geometry = createMergedWaterSideGeometry([standardWater], {
            neighborInstances: [standardWater, swampWater],
        });

        assert.equal(geometry.getAttribute('position').count, 12);
        assert.equal(geometry.getIndex()?.count, 18);

        geometry.dispose();
    });

    it('keeps side walls when adjacent water blocks are on different levels', () => {
        const geometry = createMergedWaterSideGeometry([
            { position: [0, 0, 0] },
            { position: [1, 0.4, 0] },
        ]);
        const positionAttribute = geometry.getAttribute('position');
        const indexAttribute = geometry.getIndex();

        assert.equal(positionAttribute.count, 32);
        assert.equal(indexAttribute?.count, 48);

        geometry.dispose();
    });

    it('clips side walls to adjacent water range overlaps', () => {
        const geometry = createMergedWaterSideGeometry([
            {
                position: [0, 0.25 + getWaterBlockYOffset(0.25), 0],
                waterHeight: 0.25,
            },
            {
                position: [1, 0.4 + getWaterBlockYOffset(0.4), 0],
                waterHeight: 0.4,
            },
        ]);
        const positionAttribute = geometry.getAttribute('position');
        const indexAttribute = geometry.getIndex();

        assert.equal(positionAttribute.count, 32);
        assert.equal(indexAttribute?.count, 48);
        assert.deepEqual(geometryYExtents(geometry), [0.19, 0.34, 0.44, 0.74]);

        geometry.dispose();
    });

    it('merges continuous exterior side walls across stacked water blocks', () => {
        const geometry = createMergedWaterSideGeometry([
            { position: [0, 0, 0] },
            { position: [0, 0.4, 0] },
        ]);
        const positionAttribute = geometry.getAttribute('position');
        const indexAttribute = geometry.getIndex();

        assert.equal(positionAttribute.count, 16);
        assert.equal(indexAttribute?.count, 24);

        geometry.dispose();
    });

    it('uses per-instance water heights for merged side walls', () => {
        const geometry = createMergedWaterSideGeometry([
            {
                position: [0, getWaterBlockYOffset(0.25), 0],
                waterHeight: 0.25,
            },
        ]);

        assert.deepEqual(geometryYExtents(geometry), [-0.06, 0.19]);

        geometry.dispose();
    });

    it('stores depth-map attributes for merged side walls', () => {
        const geometry = createMergedWaterSideGeometry([
            {
                depth: 3,
                position: [0, getWaterBlockYOffset(0.4), 0],
                surfaceY: 1.2,
                waterHeight: 0.4,
            },
        ]);
        const position = geometry.getAttribute('position');
        const waterDepth = geometry.getAttribute('waterDepth');
        const waterSurfaceY = geometry.getAttribute('waterSurfaceY');

        assert.equal(waterDepth.count, position.count);
        assert.equal(waterSurfaceY.count, position.count);
        assert.equal(waterDepth.getX(0), 3);
        assert.equal(Number(waterSurfaceY.getX(0).toFixed(6)), 1.2);

        geometry.dispose();
    });

    it('stores per-edge top depth and shore samples for merged side walls', () => {
        const geometry = createMergedWaterSideGeometry([
            {
                depth: 4,
                depthSamples: [1, 2, 3, 4],
                position: [0, getWaterBlockYOffset(0.4), 0],
                shoreDepthSamples: [0, 1, 2, 3],
                surfaceY: 1.2,
                waterHeight: 0.4,
            },
        ]);
        const normal = geometry.getAttribute('normal');
        const waterDepth = geometry.getAttribute('waterDepth');
        const waterShoreDepth = geometry.getAttribute('waterShoreDepth');
        const negativeXDepths: number[] = [];
        const negativeXShoreDepths: number[] = [];

        for (let index = 0; index < normal.count; index += 1) {
            if (
                normal.getX(index) === -1 &&
                normal.getY(index) === 0 &&
                normal.getZ(index) === 0
            ) {
                negativeXDepths.push(waterDepth.getX(index));
                negativeXShoreDepths.push(waterShoreDepth.getX(index));
            }
        }

        assert.deepEqual(negativeXDepths, [2, 2, 1, 1]);
        assert.deepEqual(negativeXShoreDepths, [1, 1, 0, 0]);

        geometry.dispose();
    });
});
