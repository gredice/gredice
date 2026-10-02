import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    BufferAttribute,
    Float32BufferAttribute,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    IntType,
} from 'three';
import {
    meshSourceVersion,
    meshSourceVersionMatches,
} from './meshSourceVersion';

describe('compiler source versions', () => {
    it('tracks index and morph replacement, array replacement, layout and upload semantics without requiring an upload', () => {
        for (const change of [
            'index',
            'morph',
            'array',
            'itemSize',
            'normalized',
            'gpuType',
            'added-attribute',
            'removed-attribute',
        ]) {
            const geometry = new BoxGeometry();
            const before = meshSourceVersion(geometry);
            assert.equal(meshSourceVersionMatches(before, geometry), true);
            const position = geometry.getAttribute('position');
            assert.ok(position instanceof BufferAttribute);
            if (change === 'index') geometry.setIndex([0, 1, 2]);
            else if (change === 'morph') geometry.morphAttributes.position = [];
            else if (change === 'array')
                position.array = new Float32Array(position.array);
            else if (change === 'itemSize') position.itemSize = 2;
            else if (change === 'normalized') position.normalized = true;
            else if (change === 'gpuType') position.gpuType = IntType;
            else if (change === 'added-attribute')
                geometry.setAttribute(
                    'weather',
                    new Float32BufferAttribute(24, 1),
                );
            else geometry.deleteAttribute('uv');
            assert.equal(
                meshSourceVersionMatches(before, geometry),
                false,
                change,
            );
            geometry.dispose();
        }
    });

    it('tracks the interleaved data owner, array, version, stride and offset separately', () => {
        for (const change of ['data', 'array', 'version', 'stride', 'offset']) {
            const geometry = new BoxGeometry();
            const data = new InterleavedBuffer(new Float32Array(24 * 4), 4);
            const attribute = new InterleavedBufferAttribute(data, 3, 0);
            geometry.setAttribute('position', attribute);
            const before = meshSourceVersion(geometry);
            if (change === 'data')
                attribute.data = new InterleavedBuffer(data.array, 4);
            else if (change === 'array')
                data.array = new Float32Array(data.array);
            else if (change === 'version') data.needsUpdate = true;
            else if (change === 'stride') data.stride = 3;
            else attribute.offset = 1;
            assert.equal(
                meshSourceVersionMatches(before, geometry),
                false,
                change,
            );
            geometry.dispose();
        }
    });
});
