import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector4 } from 'three';
import { chunkMeshInstances } from './chunkedMeshGeometry';
import {
    waterSideInstancesEqual,
    waterSideNeighbors,
    waterTopInstancesEqual,
} from './retainedWaterChunks';
import { createMergedWaterSideGeometry } from './waterBlockGeometry';
import type { WaterTopChunkInstance } from './waterChunkGeometry';

function water(x: number): WaterTopChunkInstance {
    return {
        position: [x, 0, 0],
        rotation: 0,
        waterHeight: 1,
        surfaceY: 0.5,
        shoreDepth: 1,
        depthSamples: [1, 1, 1, 1],
        shoreDepthSamples: [1, 1, 1, 1],
        foamEdges: new Vector4(),
        foamCorners: new Vector4(),
    };
}

describe('retained water topology', () => {
    it('retains distant top geometry but invalidates a changed foam or shore sample', () => {
        const first = chunkMeshInstances([water(1), water(18)]);
        const refreshed = [water(1), water(18)];
        assert.strictEqual(
            chunkMeshInstances(
                refreshed,
                undefined,
                first,
                waterTopInstancesEqual,
            ),
            first,
        );
        refreshed[0].foamEdges.x = 1;
        const next = chunkMeshInstances(
            refreshed,
            undefined,
            first,
            waterTopInstancesEqual,
        );
        assert.notStrictEqual(next[0], first[0]);
        assert.strictEqual(next[1], first[1]);
        refreshed[1].shoreDepthSamples = [0.5, 1, 1, 1];
        assert.notStrictEqual(
            chunkMeshInstances(
                refreshed,
                undefined,
                next,
                waterTopInstancesEqual,
            )[1],
            next[1],
        );
    });

    it('matches global hidden-side removal at a chunk boundary, including vertical ranges', () => {
        const owner = water(7);
        const all = [
            owner,
            water(8),
            water(32),
            {
                ...water(8),
                position: [8, 1, 0] satisfies [number, number, number],
            },
        ];
        const local = waterSideNeighbors([owner], all);
        assert.equal(local.length, 3);
        const globalGeometry = createMergedWaterSideGeometry([owner], {
            neighborInstances: all,
        });
        const localGeometry = createMergedWaterSideGeometry([owner], {
            neighborInstances: local,
        });
        assert.deepEqual(
            localGeometry.getAttribute('position').array,
            globalGeometry.getAttribute('position').array,
        );
        assert.deepEqual(
            localGeometry.index?.array,
            globalGeometry.index?.array,
        );
        assert.equal(waterSideInstancesEqual(water(7), owner), true);
        assert.equal(
            waterSideInstancesEqual({ ...owner, waterHeight: 2 }, owner),
            false,
        );
        globalGeometry.dispose();
        localGeometry.dispose();
    });
});
