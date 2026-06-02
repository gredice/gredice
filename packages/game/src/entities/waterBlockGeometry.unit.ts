import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector4 } from 'three';
import {
    createMergedWaterSideGeometry,
    createWaterBlockGeometry,
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
});
