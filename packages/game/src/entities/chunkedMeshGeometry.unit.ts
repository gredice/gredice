import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import {
    type ChunkedMeshInstance,
    chunkMeshInstances,
    createMergedChunkGeometry,
    createMeshInstanceMatrix,
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
