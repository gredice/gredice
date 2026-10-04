import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector4 } from 'three';
import type { WaterBlockDepthSamples } from './waterBlockDepth';
import type { WaterTopChunkInstance } from './waterChunkGeometry';
import { smoothWaterTopDepthSamples } from './waterDepthSmoothing';

const noFoam = new Vector4(0, 0, 0, 0);

function waterTop(
    position: [number, number, number],
    depthSamples: WaterBlockDepthSamples,
    shoreDepth = 0,
): WaterTopChunkInstance {
    return {
        depthSamples,
        foamCorners: noFoam,
        foamEdges: noFoam,
        position,
        rotation: 0,
        shoreDepth,
        surfaceY: position[1] + 0.2,
        waterHeight: 0.4,
    };
}

function rounded(values: number[]) {
    return values.map((value) => Number(value.toFixed(6)));
}

describe('smoothWaterTopDepthSamples', () => {
    it('smooths flat water depth across shared borders', () => {
        const [shallow, deep] = smoothWaterTopDepthSamples([
            waterTop([0, 0, 0], [1, 1, 1, 1]),
            waterTop([1, 0, 0], [3, 3, 3, 3]),
        ]);

        assert.ok(shallow);
        assert.ok(deep);
        assert.deepEqual(
            rounded([shallow.depthSamples[2], shallow.depthSamples[3]]),
            [2, 2],
        );
        assert.deepEqual(
            rounded([deep.depthSamples[0], deep.depthSamples[1]]),
            [2, 2],
        );
        assert.ok(shallow.depthSamples[0] < shallow.depthSamples[2]);
        assert.ok(deep.depthSamples[2] > deep.depthSamples[0]);
    });

    it('keeps separated water surfaces unchanged', () => {
        const smoothed = smoothWaterTopDepthSamples([
            waterTop([0, 0, 0], [1, 1, 1, 1]),
            waterTop([2, 0, 0], [3, 3, 3, 3]),
        ]);

        assert.deepEqual(smoothed[0]?.depthSamples, [1, 1, 1, 1]);
        assert.deepEqual(smoothed[1]?.depthSamples, [3, 3, 3, 3]);
    });

    it('preserves shaped terrain depth when there are no neighbors', () => {
        const smoothed = smoothWaterTopDepthSamples([
            waterTop([0, 0, 0], [1, 1, 0, 0]),
        ]);

        assert.deepEqual(smoothed[0]?.depthSamples, [1, 1, 0, 0]);
    });

    it('does not smooth unrelated vertical water surfaces', () => {
        const smoothed = smoothWaterTopDepthSamples([
            waterTop([0, 0, 0], [1, 1, 1, 1]),
            waterTop([1, 3, 0], [3, 3, 3, 3]),
        ]);

        assert.deepEqual(smoothed[0]?.depthSamples, [1, 1, 1, 1]);
        assert.deepEqual(smoothed[1]?.depthSamples, [3, 3, 3, 3]);
    });
});
