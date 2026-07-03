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
});

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
