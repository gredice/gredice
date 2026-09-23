import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    BufferAttribute,
    Float16BufferAttribute,
    Float32BufferAttribute,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    Uint8BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
    type ChunkedMeshInstance,
    createChunkMatrices,
    createMeshInstanceMatrix,
} from '../../entities/chunkedMeshGeometry';
import {
    compileMeshBuffers,
    meshBufferTransferables,
    packMeshGeometry,
    unpackMeshGeometry,
} from './meshBuffers';

const transform = {
    position: [0.25, 0.2, -0.1],
    rotation: [0.2, 0.4, -0.3],
} satisfies Parameters<typeof createMeshInstanceMatrix>[1];
const instances: ChunkedMeshInstance[] = [
    { position: [2, 0.8, -3], rotation: 1 },
    { position: [-9, 2.4, 8], rotation: 3 },
];

describe('direct mesh buffers', () => {
    it('preserves half-float values before transforming copied attribute storage', () => {
        const source = new BoxGeometry();
        const original = source.getAttribute('position');
        const position = new Float16BufferAttribute(
            new Uint16Array(original.array.length),
            3,
        );
        for (let i = 0; i < original.count; i++)
            position.setXYZ(
                i,
                original.getX(i),
                original.getY(i),
                original.getZ(i),
            );
        source.setAttribute('position', position);
        source.setAttribute('weatherLocalPosition', position.clone());
        const packet = compileMeshBuffers(
            packMeshGeometry(source),
            createChunkMatrices(instances, transform, 1),
        );
        const actual = unpackMeshGeometry(packet);
        for (const [instanceIndex, instance] of instances.entries()) {
            const expected = source
                .clone()
                .applyMatrix4(createMeshInstanceMatrix(instance, transform, 1));
            for (const name of ['position', 'weatherLocalPosition'])
                assert.deepEqual(
                    actual
                        .getAttribute(name)
                        .array.slice(
                            instanceIndex * original.array.length,
                            (instanceIndex + 1) * original.array.length,
                        ),
                    expected.getAttribute(name).array,
                    name,
                );
            expected.dispose();
        }
        actual.dispose();
        source.dispose();
    });

    for (const indexed of [true, false])
        it(`matches the legacy transformed geometry for ${indexed ? 'indexed' : 'non-indexed'} sources`, () => {
            const box = new BoxGeometry();
            const source = indexed ? box : box.toNonIndexed();
            const vertexCount = source.getAttribute('position').count;
            source.setAttribute(
                'weatherLocalPosition',
                source.getAttribute('position').clone(),
            );
            source.setAttribute(
                'color',
                new Uint8BufferAttribute(
                    new Uint8Array(vertexCount * 3).fill(127),
                    3,
                    true,
                ),
            );
            source.setAttribute(
                'tangent',
                new Float32BufferAttribute(
                    Array.from({ length: vertexCount }, () => [
                        1, 0, 0, -1,
                    ]).flat(),
                    4,
                ),
            );
            const original = packMeshGeometry(source);
            const scale: [number, number, number] = [1.2, 0.7, -0.8];
            const clones = instances.map((instance) =>
                source
                    .clone()
                    .applyMatrix4(
                        createMeshInstanceMatrix(instance, transform, scale),
                    ),
            );
            const legacy = mergeGeometries(clones, false);
            assert.ok(legacy);
            legacy.computeBoundingBox();
            legacy.computeBoundingSphere();
            const packet = compileMeshBuffers(
                packMeshGeometry(source),
                createChunkMatrices(instances, transform, scale),
            );
            const actual = unpackMeshGeometry(packet);
            for (const [name, attribute] of Object.entries(legacy.attributes)) {
                assert.deepEqual(
                    actual.getAttribute(name).array,
                    attribute.array,
                    name,
                );
                assert.equal(
                    actual.getAttribute(name).normalized,
                    attribute.normalized,
                );
            }
            assert.deepEqual(
                Array.from(actual.index?.array ?? []),
                Array.from(legacy.index?.array ?? []),
            );
            assert.deepEqual(actual.boundingBox, legacy.boundingBox);
            assert.deepEqual(actual.boundingSphere, legacy.boundingSphere);
            assert.deepEqual(
                packMeshGeometry(source),
                original,
                'shared GLTF was not mutated',
            );
            actual.dispose();
            legacy.dispose();
            source.dispose();
            box.dispose();
            for (const clone of clones) clone.dispose();
        });

    it('deinterleaves attributes and transfers owned buffers without detaching the source', () => {
        const source = new BoxGeometry();
        const position = source.getAttribute('position');
        const data = new Float32Array(position.count * 4);
        for (let i = 0; i < position.count; i++)
            data.set(
                [position.getX(i), position.getY(i), position.getZ(i), 5],
                i * 4,
            );
        source.setAttribute(
            'position',
            new InterleavedBufferAttribute(
                new InterleavedBuffer(data, 4),
                3,
                0,
            ),
        );
        const packed = packMeshGeometry(source);
        const transported = structuredClone(packed, {
            transfer: meshBufferTransferables(packed),
        });
        assert.equal(packed.attributes.position.array.byteLength, 0);
        assert.ok(source.getAttribute('position').array.byteLength > 0);
        assert.deepEqual(
            Array.from(transported.attributes.position.array),
            Array.from(position.array),
        );
        source.dispose();
    });

    it('promotes indices past 65535 and duplicates arbitrary shader attributes', () => {
        const source = new BoxGeometry();
        source.setAttribute(
            'snowSkirt',
            new BufferAttribute(new Float32Array(24).fill(0.25), 1),
        );
        const matrices = createChunkMatrices(
            Array.from({ length: 3000 }, (_, i) => ({
                position: [i, 0, 0],
                rotation: 0,
            })),
            transform,
            1,
        );
        const packet = compileMeshBuffers(packMeshGeometry(source), matrices);
        assert.ok(packet.index instanceof Uint32Array);
        assert.equal(packet.attributes.position.array.length, 3000 * 24 * 3);
        assert.equal(packet.attributes.snowSkirt.array.at(-1), 0.25);
        assert.ok((packet.index.at(-1) ?? 0) > 65535);
        source.dispose();
    });
});
