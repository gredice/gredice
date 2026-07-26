import {
    GeneratedPlantTemplateCache,
    getGeneratedPlantTemplateCacheDelta,
} from '../hooks/generatedPlantTemplateCache';
import { buildPlantRenderData } from '../lib/buildPlantRenderData';
import {
    generateLSystemStringWithGenerations,
    type LSystemSymbol,
} from '../lib/l-system';
import {
    type LSystemGenerationTask,
    type LSystemWorkerMessageRequest,
    type LSystemWorkerMessageResponse,
    type LSystemWorkerRequest,
    type LSystemWorkerResponse,
    PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
    PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    type PackedPlantRenderWorkerRequest,
    type PackedPlantRenderWorkerResponse,
    type PackedPlantRenderWorkerTemplateCacheMetricsV1,
    type PackedPlantRenderWorkerTimingsV1,
} from '../lib/l-system-worker-types';
import {
    getPackedPlantRenderDataTransferables,
    mergePackedPlantRenderDataInstances,
    type PackedPlantRenderData,
    packPlantRenderData,
} from '../lib/packedPlantRenderData';
import { SeededRNG } from '../lib/rng';

export interface LSystemWorkerDispatchResult<
    Response extends LSystemWorkerMessageResponse,
> {
    response: Response;
    transferables: ArrayBuffer[];
}

type MonotonicClock = () => number;

function generateSymbols({
    axiom,
    rules,
    iterations,
    seed,
}: LSystemGenerationTask): LSystemSymbol[] {
    return generateLSystemStringWithGenerations(
        axiom,
        rules,
        iterations,
        new SeededRNG(seed),
    );
}

function measure<T>(clock: MonotonicClock, operation: () => T) {
    const startedAt = clock();
    const value = operation();

    return {
        durationMs: Math.max(0, clock() - startedAt),
        value,
    };
}

function getUniqueTransferables(results: PackedPlantRenderData[]) {
    const seen = new Set<ArrayBuffer>();
    const transferables: ArrayBuffer[] = [];

    for (const result of results) {
        for (const buffer of getPackedPlantRenderDataTransferables(result)) {
            if (seen.has(buffer)) {
                continue;
            }

            seen.add(buffer);
            transferables.push(buffer);
        }
    }

    return transferables;
}

function clonePackedPlantRenderData(
    template: PackedPlantRenderData,
): PackedPlantRenderData {
    // Response buffers are transferred out of the worker. They must never
    // alias the cached archetype or the transfer would detach the cache entry.
    return {
        bounds: {
            boxMax: [...template.bounds.boxMax],
            boxMin: [...template.bounds.boxMin],
            sphereCenter: [...template.bounds.sphereCenter],
            sphereRadius: template.bounds.sphereRadius,
        },
        flowers: {
            count: template.flowers.count,
            matrices: template.flowers.matrices.slice(),
            swayPhases: template.flowers.swayPhases.slice(),
        },
        leaves: {
            colors: template.leaves.colors.slice(),
            count: template.leaves.count,
            matrices: template.leaves.matrices.slice(),
            swayPhases: template.leaves.swayPhases.slice(),
        },
        lodSummary: { ...template.lodSummary },
        stems: {
            count: template.stems.count,
            matrices: template.stems.matrices.slice(),
            radii: template.stems.radii.slice(),
            swayPhases: template.stems.swayPhases.slice(),
        },
        thorns: {
            count: template.thorns.count,
            matrices: template.thorns.matrices.slice(),
            swayPhases: template.thorns.swayPhases.slice(),
        },
        vegetables: template.vegetables.map((vegetable) => ({
            count: vegetable.count,
            growth: vegetable.growth.slice(),
            matrices: vegetable.matrices.slice(),
            swayPhases: vegetable.swayPhases.slice(),
            type: vegetable.type,
        })),
        version: template.version,
    };
}

function buildTemplateCacheMetrics(
    cache: GeneratedPlantTemplateCache,
    before: ReturnType<GeneratedPlantTemplateCache['snapshot']>,
): PackedPlantRenderWorkerTemplateCacheMetricsV1 {
    const snapshot = cache.snapshot();

    return {
        delta: getGeneratedPlantTemplateCacheDelta(before, snapshot),
        snapshot,
    };
}

function buildPackedPlantRenderResponse(
    request: PackedPlantRenderWorkerRequest,
    clock: MonotonicClock,
    templateCache: GeneratedPlantTemplateCache,
): LSystemWorkerDispatchResult<PackedPlantRenderWorkerResponse> {
    const totalStartedAt = clock();
    const cacheBefore = templateCache.snapshot();
    const requestTemplates = new Map<string, PackedPlantRenderData>();
    const timings: PackedPlantRenderWorkerTimingsV1 = {
        packingDurationMs: 0,
        renderDataBuildDurationMs: 0,
        rootBatchingDurationMs: 0,
        symbolGenerationDurationMs: 0,
        totalDurationMs: 0,
    };
    const results = request.tasks.map((task) => {
        if (!task.templateKey) {
            throw new TypeError(
                'Packed plant worker tasks require a non-empty templateKey',
            );
        }

        let template = requestTemplates.get(task.templateKey);
        if (!template) {
            template = templateCache.get(task.templateKey);
        }
        if (!template) {
            const generated = measure(clock, () =>
                generateSymbols(task.generationTask),
            );
            timings.symbolGenerationDurationMs += generated.durationMs;

            const built = measure(clock, () =>
                buildPlantRenderData({
                    flowerGrowth: task.flowerGrowth,
                    fruitGrowth: task.fruitGrowth,
                    generation: task.generation,
                    lSystemSymbols: generated.value,
                    plantDefinition: task.plantDefinition,
                    renderDetailedGeometry: true,
                    seed: task.generationTask.seed,
                    showFlowers: task.showFlowers,
                    showLeaves: task.showLeaves,
                    showProduce: task.showProduce,
                }),
            );
            timings.renderDataBuildDurationMs += built.durationMs;

            const packed = measure(clock, () =>
                packPlantRenderData(built.value),
            );
            timings.packingDurationMs += packed.durationMs;
            template = packed.value;
            templateCache.set(task.templateKey, template);
        }
        requestTemplates.set(task.templateKey, template);

        const rooted = measure(clock, () =>
            task.rootTransforms && task.rootTransforms.length > 0
                ? mergePackedPlantRenderDataInstances(
                      task.rootTransforms.map((transform) => ({
                          template,
                          transform,
                      })),
                  )
                : clonePackedPlantRenderData(template),
        );
        timings.rootBatchingDurationMs += rooted.durationMs;
        return rooted.value;
    });
    timings.totalDurationMs = Math.max(0, clock() - totalStartedAt);

    const transferables = getUniqueTransferables(results);
    const transferByteLength = transferables.reduce(
        (total, buffer) => total + buffer.byteLength,
        0,
    );

    return {
        response: {
            id: request.id,
            kind: PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
            results,
            templateCache: buildTemplateCacheMetrics(
                templateCache,
                cacheBefore,
            ),
            timings,
            transferByteLength,
            version: PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
        },
        transferables,
    };
}

export function handleLSystemWorkerRequest(
    request: PackedPlantRenderWorkerRequest,
    clock?: MonotonicClock,
    templateCache?: GeneratedPlantTemplateCache,
): LSystemWorkerDispatchResult<PackedPlantRenderWorkerResponse>;
export function handleLSystemWorkerRequest(
    request: LSystemWorkerRequest,
    clock?: MonotonicClock,
    templateCache?: GeneratedPlantTemplateCache,
): LSystemWorkerDispatchResult<LSystemWorkerResponse>;
export function handleLSystemWorkerRequest(
    request: LSystemWorkerMessageRequest,
    clock?: MonotonicClock,
    templateCache?: GeneratedPlantTemplateCache,
): LSystemWorkerDispatchResult<LSystemWorkerMessageResponse>;
export function handleLSystemWorkerRequest(
    request: LSystemWorkerMessageRequest,
    clock: MonotonicClock = () => performance.now(),
    templateCache = new GeneratedPlantTemplateCache(),
): LSystemWorkerDispatchResult<LSystemWorkerMessageResponse> {
    if ('kind' in request) {
        if (
            request.kind !== PACKED_PLANT_RENDER_WORKER_REQUEST_KIND ||
            request.version !== PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION
        ) {
            throw new RangeError(
                'Unsupported packed plant worker request protocol',
            );
        }

        return buildPackedPlantRenderResponse(request, clock, templateCache);
    }

    return {
        response: {
            id: request.id,
            results: request.tasks.map(generateSymbols),
        },
        transferables: [],
    };
}
