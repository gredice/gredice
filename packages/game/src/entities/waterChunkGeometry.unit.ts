import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector4 } from 'three';
import {
    chunkWaterTopInstances,
    createWaterTopChunkGeometry,
    type WaterTopChunkInstance,
} from './waterChunkGeometry';

function waterTopInstance(
    position: [number, number, number],
    foamEdges = new Vector4(1, 0, 1, 0),
    foamCorners = new Vector4(0, 1, 0, 1),
): WaterTopChunkInstance {
    return {
        depthSamples: [1, 2, 3, 4],
        foamCorners,
        foamEdges,
        position,
        rotation: 0,
        shoreDepth: 2,
        surfaceY: position[1] + 0.2,
        waterHeight: 0.4,
    };
}

function waterTopInstanceWithShoreSamples(
    position: [number, number, number],
): WaterTopChunkInstance {
    return {
        ...waterTopInstance(position),
        shoreDepth: 2,
        shoreDepthSamples: [0, 1, 2, 3],
    };
}

describe('chunkWaterTopInstances', () => {
    it('partitions water top surfaces by world chunk', () => {
        const chunks = chunkWaterTopInstances([
            waterTopInstance([0, 0, 0]),
            waterTopInstance([8, 0, 0]),
        ]);

        assert.deepEqual(
            chunks.map((chunk) => [chunk.key, chunk.instances.length]),
            [
                ['0:0', 1],
                ['1:0', 1],
            ],
        );
    });
});

describe('createWaterTopChunkGeometry', () => {
    it('stores world positions, local positions, and foam masks', () => {
        const geometry = createWaterTopChunkGeometry([
            waterTopInstance(
                [2, 1, 3],
                new Vector4(1, 0, 0, 1),
                new Vector4(0, 1, 1, 0),
            ),
        ]);
        const position = geometry.getAttribute('position');
        const localPosition = geometry.getAttribute('waterLocalPosition');
        const foamEdges = geometry.getAttribute('waterFoamEdges');
        const foamCorners = geometry.getAttribute('waterFoamCorners');
        const waterDepth = geometry.getAttribute('waterDepth');
        const shoreDepth = geometry.getAttribute('waterShoreDepth');
        const surfaceY = geometry.getAttribute('waterSurfaceY');

        assert.equal(position.count, 4);
        assert.equal(geometry.getIndex()?.count, 6);
        assert.deepEqual(
            [position.getX(0), position.getY(0), position.getZ(0)].map(
                (value) => Number(value.toFixed(6)),
            ),
            [1.5, 1.2, 2.5],
        );
        assert.deepEqual(
            [
                localPosition.getX(0),
                localPosition.getY(0),
                localPosition.getZ(0),
            ].map((value) => Number(value.toFixed(6))),
            [-0.5, 0.2, -0.5],
        );
        assert.deepEqual(
            [
                foamEdges.getX(0),
                foamEdges.getY(0),
                foamEdges.getZ(0),
                foamEdges.getW(0),
            ],
            [1, 0, 0, 1],
        );
        assert.deepEqual(
            [
                foamCorners.getX(0),
                foamCorners.getY(0),
                foamCorners.getZ(0),
                foamCorners.getW(0),
            ],
            [0, 1, 1, 0],
        );
        assert.deepEqual(
            [
                waterDepth.getX(0),
                waterDepth.getX(1),
                waterDepth.getX(2),
                waterDepth.getX(3),
            ],
            [1, 2, 3, 4],
        );
        assert.equal(shoreDepth.getX(0), 2);
        assert.equal(Number(surfaceY.getX(0).toFixed(6)), 1.2);

        geometry.dispose();
    });

    it('stores per-vertex shore depth samples when present', () => {
        const geometry = createWaterTopChunkGeometry([
            waterTopInstanceWithShoreSamples([0, 0, 0]),
        ]);
        const shoreDepth = geometry.getAttribute('waterShoreDepth');

        assert.deepEqual(
            [
                shoreDepth.getX(0),
                shoreDepth.getX(1),
                shoreDepth.getX(2),
                shoreDepth.getX(3),
            ],
            [0, 1, 2, 3],
        );

        geometry.dispose();
    });
});
