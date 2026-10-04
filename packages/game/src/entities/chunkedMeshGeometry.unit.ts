import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import {
    type ChunkedMeshInstance,
    chunkMeshInstances,
    createChunkMatrices,
    createMergedChunkGeometry,
    createMeshInstanceMatrix,
    type MeshInstanceLocalTransform,
    type MeshInstanceScale,
    writeMeshInstanceMatrices,
} from './chunkedMeshGeometry';

function createPointGeometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
    return geometry;
}

function geometryPositions(geometry: BufferGeometry) {
    const position = geometry.getAttribute('position');
    const positions: number[][] = [];

    for (let index = 0; index < position.count; index += 1) {
        positions.push([
            Number(position.getX(index).toFixed(6)),
            Number(position.getY(index).toFixed(6)),
            Number(position.getZ(index).toFixed(6)),
        ]);
    }

    return positions;
}

describe('chunkMeshInstances', () => {
    it('partitions instances into stable world-space chunk keys', () => {
        const chunks = chunkMeshInstances(
            [
                { position: [0, 0, 0], rotation: 0 },
                { position: [7.9, 0, 0], rotation: 0 },
                { position: [8, 0, 0], rotation: 0 },
                { position: [-0.1, 0, -8.1], rotation: 0 },
            ],
            8,
        );

        assert.deepEqual(
            chunks.map((chunk) => [chunk.key, chunk.instances.length]),
            [
                ['-1:-2', 1],
                ['0:0', 2],
                ['1:0', 1],
            ],
        );
    });
});

describe('createMeshInstanceMatrix', () => {
    it('combines root and local transforms', () => {
        const matrix = createMeshInstanceMatrix(
            { position: [2, 3, 4], rotation: 0 },
            { position: [0, 0.5, 0], rotation: [0, 0, 0] },
            [2, 1, 2],
        );
        const point = createPointGeometry();
        point.applyMatrix4(matrix);

        assert.deepEqual(geometryPositions(point), [[2, 3.5, 4]]);

        point.dispose();
    });
});

describe('batch mesh transforms', () => {
    const instances: ChunkedMeshInstance[] = [-4, -1, 0, 1, 2, 3, 4].map(
        (rotation) => ({ position: [-8.25, 3.5, 7.75], rotation }),
    );
    const transforms: MeshInstanceLocalTransform[] = [
        { position: [0, 0, 0], rotation: [0, 0, 0] },
        { position: [-0.75, 2.25, 0.5], rotation: [0.4, -1.2, 0.7] },
    ];
    const scales: MeshInstanceScale[] = [
        undefined,
        0,
        1.75,
        -2,
        [0.5, 2, 1.25],
        [-1, 2, -0.75],
    ];

    for (const transform of transforms) {
        for (const scale of scales) {
            it(`matches independent matrices and rendered geometry for ${JSON.stringify({ transform, scale })}`, () => {
                const matrices = createChunkMatrices(
                    instances,
                    transform,
                    scale,
                );
                const source = new BufferGeometry();
                source.setAttribute(
                    'position',
                    new Float32BufferAttribute(
                        [0, 0, 0, 1, -2, 0.5, -1, 0, 2],
                        3,
                    ),
                );
                const merged = createMergedChunkGeometry({
                    geometry: source,
                    instances,
                    localTransform: transform,
                    scale,
                });
                const expectedPositions: number[][] = [];
                for (let index = 0; index < instances.length; index++) {
                    const expected = createMeshInstanceMatrix(
                        instances[index],
                        transform,
                        scale,
                    );
                    assert.deepEqual(
                        new Matrix4().fromArray(matrices, index * 16).elements,
                        expected.elements,
                    );
                    const transformed = source.clone().applyMatrix4(expected);
                    expectedPositions.push(...geometryPositions(transformed));
                    transformed.dispose();
                }
                assert.deepEqual(geometryPositions(merged), expectedPositions);
                source.dispose();
                merged.dispose();
            });
        }
    }

    it('borrows one matrix per batch and keeps compiler output buffers independent', () => {
        const borrowed = new Set<Matrix4>();
        writeMeshInstanceMatrices(instances, transforms[1], 1, (matrix) => {
            borrowed.add(matrix);
        });
        assert.equal(borrowed.size, 1);
        const first = createChunkMatrices(instances, transforms[1], 1);
        const snapshot = first.slice();
        const second = createChunkMatrices(instances, transforms[0], -1);
        assert.notEqual(first.buffer, second.buffer);
        structuredClone(second, { transfer: [second.buffer] });
        assert.deepEqual(first, snapshot);
        const single = createMeshInstanceMatrix(instances[0], transforms[1], 1);
        assert.notEqual(
            single,
            createMeshInstanceMatrix(instances[0], transforms[1], 1),
        );
    });

    it('writes no scratch matrices for an empty batch', () => {
        writeMeshInstanceMatrices([], transforms[0], 1, () => {
            assert.fail('empty batch must not invoke its writer');
        });
        assert.equal(createChunkMatrices([], transforms[0], 1).length, 0);
    });
});

describe('createMergedChunkGeometry', () => {
    it('applies instance transforms and merges clones into one geometry', () => {
        const source = createPointGeometry();
        const instances: ChunkedMeshInstance[] = [
            { position: [1, 0, 0], rotation: 0 },
            { position: [3, 0, 0], rotation: 0 },
        ];
        const merged = createMergedChunkGeometry({
            geometry: source,
            instances,
            localTransform: { position: [0, 1, 0], rotation: [0, 0, 0] },
            scale: undefined,
        });

        assert.deepEqual(geometryPositions(merged), [
            [1, 1, 0],
            [3, 1, 0],
        ]);

        source.dispose();
        merged.dispose();
    });
});
