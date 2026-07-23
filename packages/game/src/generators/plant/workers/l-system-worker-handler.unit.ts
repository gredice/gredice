import assert from 'node:assert/strict';
import test from 'node:test';
import { GeneratedPlantTemplateCache } from '../hooks/generatedPlantTemplateCache';
import { buildPlantRenderData } from '../lib/buildPlantRenderData';
import { generateLSystemStringWithGenerations } from '../lib/l-system';
import {
    type LSystemGenerationTask,
    PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
    PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    type PackedPlantRenderWorkerRequest,
} from '../lib/l-system-worker-types';
import {
    getPackedPlantRenderDataTransferByteLength,
    mergePackedPlantRenderDataInstances,
    packPlantRenderData,
} from '../lib/packedPlantRenderData';
import { plantTypes } from '../lib/plant-definitions';
import { SeededRNG } from '../lib/rng';
import { handleLSystemWorkerRequest } from './l-system-worker-handler';

function generateExpectedSymbols(task: LSystemGenerationTask) {
    return generateLSystemStringWithGenerations(
        task.axiom,
        task.rules,
        task.iterations,
        new SeededRNG(task.seed),
    );
}

test('preserves the legacy symbol-only worker protocol', () => {
    const task: LSystemGenerationTask = {
        axiom: 'F',
        iterations: 3,
        rules: {
            F: 'F[+F]F',
        },
        seed: 'legacy-worker',
    };

    const dispatched = handleLSystemWorkerRequest({
        id: 41,
        tasks: [task],
    });

    assert.equal(dispatched.response.id, 41);
    assert.deepEqual(dispatched.response.results, [
        generateExpectedSymbols(task),
    ]);
    assert.deepEqual(dispatched.transferables, []);
});

test('builds exact packed render data and exposes deterministic profiling metadata', () => {
    const definition = plantTypes.tomato;
    const generationTask: LSystemGenerationTask = {
        axiom: definition.axiom,
        iterations: 7,
        rules: definition.rules,
        seed: 'packed-worker-tomato',
    };
    const request: PackedPlantRenderWorkerRequest = {
        id: 42,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks: [
            {
                flowerGrowth: 0.8,
                fruitGrowth: 0.9,
                generation: 6.5,
                generationTask,
                plantDefinition: definition,
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
                showFlowers: true,
                showLeaves: true,
                showProduce: true,
                templateKey: 'tomato:detailed:packed-worker-tomato',
            },
        ],
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };
    let clockValue = 0;

    const dispatched = handleLSystemWorkerRequest(request, () => clockValue++);
    const template = packPlantRenderData(
        buildPlantRenderData({
            flowerGrowth: 0.8,
            fruitGrowth: 0.9,
            generation: 6.5,
            lSystemSymbols: generateExpectedSymbols(generationTask),
            plantDefinition: definition,
            renderDetailedGeometry: true,
            seed: generationTask.seed,
            showFlowers: true,
            showLeaves: true,
            showProduce: true,
        }),
    );
    const expected = mergePackedPlantRenderDataInstances(
        (request.tasks[0]?.rootTransforms ?? []).map((transform) => ({
            template,
            transform,
        })),
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
    assert.deepEqual(dispatched.response.timings, {
        packingDurationMs: 1,
        renderDataBuildDurationMs: 1,
        rootBatchingDurationMs: 1,
        symbolGenerationDurationMs: 1,
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

test('posts packed buffers as transferables without copying their payload', () => {
    const definition = plantTypes.carrot;
    const generationTask: LSystemGenerationTask = {
        axiom: definition.axiom,
        iterations: 6,
        rules: definition.rules,
        seed: 'packed-worker-carrot',
    };
    const request: PackedPlantRenderWorkerRequest = {
        id: 43,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks: [
            {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: 6,
                generationTask,
                plantDefinition: definition,
                showLeaves: false,
                templateKey: 'carrot:detailed:packed-worker-carrot',
            },
        ],
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };
    const templateCache = new GeneratedPlantTemplateCache();
    const dispatched = handleLSystemWorkerRequest(
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

    const warmed = handleLSystemWorkerRequest(
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
    assert.equal(warmed.response.timings.symbolGenerationDurationMs, 0);
    assert.ok((warmed.response.results[0]?.stems.count ?? 0) > 0);
});

test('reuses one request-local archetype when the worker LRU skips an oversized template', () => {
    const definition = plantTypes.carrot;
    const generationTask: LSystemGenerationTask = {
        axiom: definition.axiom,
        iterations: 6,
        rules: definition.rules,
        seed: 'oversized-request-local-carrot',
    };
    const templateCache = new GeneratedPlantTemplateCache({
        maxEntryCount: 256,
        maxEstimatedBytes: 1,
    });
    const request: PackedPlantRenderWorkerRequest = {
        id: 45,
        kind: PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
        tasks: [
            {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: 6,
                generationTask,
                plantDefinition: definition,
                rootTransforms: [
                    {
                        translation: [0, -0.75, 0],
                        uniformScale: 0.7,
                    },
                ],
                templateKey: 'carrot:oversized:shared',
            },
            {
                flowerGrowth: 1,
                fruitGrowth: 1,
                generation: 6,
                generationTask,
                plantDefinition: definition,
                rootTransforms: [
                    {
                        translation: [0.5, -0.75, 0.2],
                        uniformScale: 0.65,
                    },
                ],
                templateKey: 'carrot:oversized:shared',
            },
        ],
        version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    };

    const dispatched = handleLSystemWorkerRequest(
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
