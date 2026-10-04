import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector4 } from 'three';
import {
    resolveWaterShoreDepthSamples,
    resolveWaterShoreDepths,
    type WaterShoreDepthInstance,
} from './waterShoreDepth';

const noFoamEdges = new Vector4(0, 0, 0, 0);

function water(
    x: number,
    z: number,
    foamEdges = noFoamEdges,
    y = 0,
): WaterShoreDepthInstance {
    return {
        foamEdges,
        position: [x, y, z],
        waterHeight: 0.4,
    };
}

function gridWater(size: number) {
    const instances: WaterShoreDepthInstance[] = [];

    for (let x = 0; x < size; x += 1) {
        for (let z = 0; z < size; z += 1) {
            instances.push(
                water(
                    x,
                    z,
                    new Vector4(
                        x === 0 ? 1 : 0,
                        x === size - 1 ? 1 : 0,
                        z === 0 ? 1 : 0,
                        z === size - 1 ? 1 : 0,
                    ),
                ),
            );
        }
    }

    return instances;
}

function depthAt(
    instances: WaterShoreDepthInstance[],
    depths: number[],
    x: number,
    z: number,
) {
    const index = instances.findIndex(
        (instance) => instance.position[0] === x && instance.position[2] === z,
    );

    return depths[index];
}

function rounded(values: number[]) {
    return values.map((value) => Number(value.toFixed(6)));
}

describe('resolveWaterShoreDepths', () => {
    it('starts shoreline water at depth zero', () => {
        assert.deepEqual(
            resolveWaterShoreDepths([water(0, 0, new Vector4(1, 0, 0, 0))]),
            [0],
        );
    });

    it('increments depth by tile distance from exposed shore water', () => {
        const instances = gridWater(5);
        const depths = resolveWaterShoreDepths(instances);

        assert.equal(depthAt(instances, depths, 0, 2), 0);
        assert.equal(depthAt(instances, depths, 1, 2), 1);
        assert.equal(depthAt(instances, depths, 2, 2), 2);
    });

    it('does not connect water surfaces at separate vertical ranges', () => {
        const lower = water(0, 0, new Vector4(1, 0, 0, 0), 0);
        const upper = water(1, 0, noFoamEdges, 1);

        assert.deepEqual(resolveWaterShoreDepths([lower, upper]), [0, 0]);
    });
});

describe('resolveWaterShoreDepthSamples', () => {
    it('samples continuous distance from exposed shore edges', () => {
        const instances = [
            water(0, 0, new Vector4(1, 0, 0, 0)),
            water(1, 0),
            water(2, 0),
        ];
        const samples = resolveWaterShoreDepthSamples(instances);

        assert.deepEqual(rounded(samples[0] ?? []), [0, 0, 1, 1]);
        assert.deepEqual(rounded(samples[1] ?? []), [1, 1, 2, 2]);
        assert.deepEqual(rounded(samples[2] ?? []), [2, 2, 3, 3]);
    });

    it('uses Euclidean point-to-segment distance for diagonal samples', () => {
        const instances = [
            water(0, 0, new Vector4(1, 0, 0, 0)),
            water(1, 0),
            water(1, 1),
        ];
        const samples = resolveWaterShoreDepthSamples(instances);
        const expected = [1, Math.SQRT2, Math.sqrt(5), 2].map((value) =>
            Number(value.toFixed(6)),
        );

        assert.deepEqual(rounded(samples[2] ?? []), expected);
    });

    it('keeps separate vertical water ranges isolated', () => {
        const lower = water(0, 0, new Vector4(1, 0, 0, 0), 0);
        const upper = water(1, 0, noFoamEdges, 1);

        assert.deepEqual(resolveWaterShoreDepthSamples([lower, upper]), [
            [0, 0, 1, 1],
            [0, 0, 0, 0],
        ]);
    });
});
