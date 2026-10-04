import assert from 'node:assert/strict';
import test from 'node:test';
import { GeneratedPlantTemplateCache } from '../hooks/generatedPlantTemplateCache';
import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from '../lib/generatedPlantRenderData';
import {
    getPackedPlantRenderDataTransferByteLength,
    mergePackedPlantRenderDataInstances,
    packPlantRenderData,
} from '../lib/packedPlantRenderData';
import { plantTypes } from '../lib/plant-definitions';
import {
    PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
    PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    type PackedPlantRenderWorkerRequest,
} from '../lib/plant-render-worker-types';
import { handlePlantRenderWorkerRequest } from './plant-render-worker-handler';

function createRequest(): PackedPlantRenderWorkerRequest {
    return {
        id: 42,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks: [
            {
                flowerGrowth: 0.8,
                fruitGrowth: 0.9,
                generation: 10,
                plantDefinition: plantTypes.tomato,
                rootTransforms: [
                    {
                        translation: [0.4, -0.75, 0.2],
                        uniformScale: 0.7,
                        yawRadians: 0.3,
                    },
                    {
                        translation: [-0.25, -0.75, -0.1],
                        uniformScale: 0.62,
                        yawRadians: 1.1,
                    },
                ],
                seed: 'packed-worker-tomato',
                showFlowers: true,
                showLeaves: true,
                showProduce: true,
                templateKey: 'tomato:detailed:packed-worker-tomato',
            },
        ],
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };
}

test('requires the graph-only packed plant protocol v4', () => {
    const request = createRequest();
    const unsupportedKind = { ...request };
    const unsupportedVersion = { ...request };
    Reflect.set(unsupportedKind, 'kind', 'unsupported-kind');
    Reflect.set(unsupportedVersion, 'version', 3);

    assert.equal(PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION, 4);
    assert.throws(
        () => handlePlantRenderWorkerRequest(unsupportedKind),
        /Unsupported packed plant worker protocol/,
    );
    assert.throws(
        () => handlePlantRenderWorkerRequest(unsupportedVersion),
        /Unsupported packed plant worker protocol/,
    );
});

test('builds deterministic graph render data and batches every root transform', () => {
    const request = createRequest();
    const task = request.tasks[0];
    assert.ok(task);

    const topology = generatePlantTopology({
        generation: task.generation,
        plantDefinition: task.plantDefinition,
        seed: task.seed,
    });
    const template = packPlantRenderData(
        buildGeneratedPlantRenderData({
            flowerGrowth: task.flowerGrowth,
            fruitGrowth: task.fruitGrowth,
            plantDefinition: task.plantDefinition,
            renderDetailedGeometry: true,
            showFlowers: task.showFlowers,
            showLeaves: task.showLeaves,
            showProduce: task.showProduce,
            topology,
        }),
    );
    const expected = mergePackedPlantRenderDataInstances(
        (task.rootTransforms ?? []).map((transform) => ({
            template,
            transform,
        })),
    );
    let clockValue = 0;
    const dispatched = handlePlantRenderWorkerRequest(
        request,
        () => clockValue++,
    );
    clockValue = 0;
    const repeated = handlePlantRenderWorkerRequest(
        request,
        () => clockValue++,
    );

    assert.equal(
        dispatched.response.kind,
        PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    );
    assert.equal(
        dispatched.response.version,
        PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    );
    assert.equal(dispatched.response.id, request.id);
    assert.deepEqual(dispatched.response.results, [expected]);
    assert.deepEqual(repeated.response.results, dispatched.response.results);
    assert.equal(
        dispatched.response.results[0]?.stems.count,
        template.stems.count * 2,
    );
    assert.equal(
        dispatched.response.results[0]?.leaves.count,
        template.leaves.count * 2,
    );
    assert.deepEqual(dispatched.response.timings, {
        packingDurationMs: 1,
        renderDataBuildDurationMs: 1,
        rootBatchingDurationMs: 1,
        topologyGenerationDurationMs: 1,
        totalDurationMs: 9,
    });
    assert.equal(
        dispatched.response.transferByteLength,
        getPackedPlantRenderDataTransferByteLength(expected),
    );
    assert.equal(
        dispatched.response.transferByteLength,
        dispatched.transferables.reduce(
            (total, buffer) => total + buffer.byteLength,
            0,
        ),
    );
    assert.equal(
        new Set(dispatched.transferables).size,
        dispatched.transferables.length,
    );
});

test('transfers response buffers while preserving cached templates for later hits', () => {
    const request: PackedPlantRenderWorkerRequest = {
        id: 43,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks: [
            {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: 10,
                plantDefinition: plantTypes.carrot,
                seed: 'packed-worker-carrot',
                showLeaves: false,
                templateKey: 'carrot:detailed:packed-worker-carrot',
            },
        ],
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };
    const templateCache = new GeneratedPlantTemplateCache();
    const dispatched = handlePlantRenderWorkerRequest(
        request,
        undefined,
        templateCache,
    );
    const nonEmptyTransferables = dispatched.transferables.filter(
        (buffer) => buffer.byteLength > 0,
    );
    const nonEmptyTransferByteLength = nonEmptyTransferables.reduce(
        (total, buffer) => total + buffer.byteLength,
        0,
    );

    assert.equal(dispatched.response.results[0]?.leaves.count, 0);
    assert.ok(nonEmptyTransferables.length > 0);
    assert.deepEqual(dispatched.response.templateCache.delta, {
        evictionCount: 0,
        hitCount: 0,
        missCount: 1,
        oversizeSkipCount: 0,
        writeCount: 1,
    });
    assert.equal(dispatched.response.templateCache.snapshot.entryCount, 1);
    assert.equal(dispatched.response.templateCache.snapshot.maxEntryCount, 256);
    assert.equal(
        dispatched.response.templateCache.snapshot.maxEstimatedBytes,
        16 * 1024 * 1024,
    );

    const cloned = structuredClone(dispatched.response, {
        transfer: dispatched.transferables,
    });

    assert.equal(cloned.id, request.id);
    assert.equal(cloned.results[0]?.leaves.count, 0);
    assert.equal(cloned.transferByteLength, nonEmptyTransferByteLength);
    assert.ok(nonEmptyTransferables.every((buffer) => buffer.byteLength === 0));

    const warmed = handlePlantRenderWorkerRequest(
        {
            ...request,
            id: 44,
            tasks: request.tasks.map((task) => ({
                ...task,
                rootTransforms: [
                    {
                        translation: [0.3, -0.75, -0.2],
                        uniformScale: 0.8,
                        yawRadians: 0.5,
                    },
                ],
            })),
        },
        undefined,
        templateCache,
    );

    assert.deepEqual(warmed.response.templateCache.delta, {
        evictionCount: 0,
        hitCount: 1,
        missCount: 0,
        oversizeSkipCount: 0,
        writeCount: 0,
    });
    assert.equal(warmed.response.templateCache.snapshot.entryCount, 1);
    assert.equal(warmed.response.timings.packingDurationMs, 0);
    assert.equal(warmed.response.timings.renderDataBuildDurationMs, 0);
    assert.equal(warmed.response.timings.topologyGenerationDurationMs, 0);
    assert.ok((warmed.response.results[0]?.stems.count ?? 0) > 0);
});

test('reuses one request-local template when the LRU rejects an oversized entry', () => {
    const templateCache = new GeneratedPlantTemplateCache({
        maxEntryCount: 256,
        maxEstimatedBytes: 1,
    });
    const sharedTask = {
        flowerGrowth: 1,
        fruitGrowth: 1,
        generation: 10,
        plantDefinition: plantTypes.carrot,
        seed: 'oversized-request-local-carrot',
        templateKey: 'carrot:oversized:shared',
    };
    const request: PackedPlantRenderWorkerRequest = {
        id: 45,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks: [
            {
                ...sharedTask,
                rootTransforms: [
                    {
                        translation: [0, -0.75, 0],
                        uniformScale: 0.7,
                    },
                ],
            },
            {
                ...sharedTask,
                rootTransforms: [
                    {
                        translation: [0.5, -0.75, 0.2],
                        uniformScale: 0.65,
                    },
                ],
            },
        ],
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };

    const dispatched = handlePlantRenderWorkerRequest(
        request,
        undefined,
        templateCache,
    );

    assert.equal(dispatched.response.results.length, 2);
    assert.deepEqual(dispatched.response.templateCache.delta, {
        evictionCount: 0,
        hitCount: 0,
        missCount: 1,
        oversizeSkipCount: 1,
        writeCount: 0,
    });
    assert.equal(dispatched.response.templateCache.snapshot.entryCount, 0);
});
