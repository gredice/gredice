import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGeneratedPlantRenderRegistrySnapshot,
    registerGeneratedPlantRenderBatch,
    resetGeneratedPlantRenderRegistryForTests,
} from './generatedPlantRenderRegistry';

test('generated plant render registry aggregates live exact and cluster work', () => {
    resetGeneratedPlantRenderRegistryForTests();
    const releaseExact = registerGeneratedPlantRenderBatch('near:bed:1', {
        clusterInstanceCount: 0,
        clusterPrimitiveTriangleCount: 0,
        detailedInstanceCount: 179,
        detailedLeafTriangleCount: 177_883,
        nearInstanceCount: 179,
        pendingDetailInstanceCount: 0,
    });
    const releaseCluster = registerGeneratedPlantRenderBatch('mid:bed:2', {
        clusterInstanceCount: 358,
        clusterPrimitiveTriangleCount: 1_432,
        detailedInstanceCount: 0,
        detailedLeafTriangleCount: 0,
        nearInstanceCount: 0,
        pendingDetailInstanceCount: 0,
    });

    assert.deepEqual(getGeneratedPlantRenderRegistrySnapshot(), {
        clusterInstanceCount: 358,
        clusterPrimitiveTriangleCount: 1_432,
        detailedInstanceCount: 179,
        detailedLeafTriangleCount: 177_883,
        nearInstanceCount: 179,
        pendingDetailInstanceCount: 0,
        renderBatchCount: 2,
    });

    releaseCluster();
    releaseExact();
    assert.equal(getGeneratedPlantRenderRegistrySnapshot().renderBatchCount, 0);
});

test('stale cleanup cannot remove a newer batch registration', () => {
    resetGeneratedPlantRenderRegistryForTests();
    const releaseFirst = registerGeneratedPlantRenderBatch('near:bed:1', {
        clusterInstanceCount: 0,
        clusterPrimitiveTriangleCount: 0,
        detailedInstanceCount: 1,
        detailedLeafTriangleCount: 10,
        nearInstanceCount: 1,
        pendingDetailInstanceCount: 0,
    });
    const releaseSecond = registerGeneratedPlantRenderBatch('near:bed:1', {
        clusterInstanceCount: 0,
        clusterPrimitiveTriangleCount: 0,
        detailedInstanceCount: 2,
        detailedLeafTriangleCount: 20,
        nearInstanceCount: 2,
        pendingDetailInstanceCount: 0,
    });

    releaseFirst();
    assert.equal(
        getGeneratedPlantRenderRegistrySnapshot().detailedInstanceCount,
        2,
    );
    releaseSecond();
});
