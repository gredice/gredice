import {
    GeneratedPlantTemplateCache,
    getGeneratedPlantTemplateCacheDelta,
} from '../hooks/generatedPlantTemplateCache';
import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from '../lib/generatedPlantRenderData';
import {
    getPackedPlantRenderDataTransferables,
    mergePackedPlantRenderDataInstances,
    type PackedPlantRenderData,
    packPlantRenderData,
} from '../lib/packedPlantRenderData';
import {
    PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION,
    PACKED_PLANT_RENDER_WORKER_REQUEST_KIND,
    PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND,
    type PackedPlantRenderWorkerRequest,
    type PackedPlantRenderWorkerResponse,
    type PackedPlantRenderWorkerTemplateCacheMetrics,
    type PackedPlantRenderWorkerTimings,
} from '../lib/plant-render-worker-types';

export interface PlantRenderWorkerDispatchResult {
    response: PackedPlantRenderWorkerResponse;
    transferables: ArrayBuffer[];
}

type MonotonicClock = () => number;

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
            if (!seen.has(buffer)) {
                seen.add(buffer);
                transferables.push(buffer);
            }
        }
    }

    return transferables;
}

function clonePackedPlantRenderData(
    template: PackedPlantRenderData,
): PackedPlantRenderData {
    // Responses transfer their buffers. Never transfer the cached archetype.
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
            colors: vegetable.colors.slice(),
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
): PackedPlantRenderWorkerTemplateCacheMetrics {
    const snapshot = cache.snapshot();

    return {
        delta: getGeneratedPlantTemplateCacheDelta(before, snapshot),
        snapshot,
    };
}

export function handlePlantRenderWorkerRequest(
    request: PackedPlantRenderWorkerRequest,
    clock: MonotonicClock = () => performance.now(),
    templateCache = new GeneratedPlantTemplateCache(),
): PlantRenderWorkerDispatchResult {
    if (
        request.kind !== PACKED_PLANT_RENDER_WORKER_REQUEST_KIND ||
        request.version !== PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION
    ) {
        throw new RangeError('Unsupported packed plant worker protocol');
    }

    const totalStartedAt = clock();
    const cacheBefore = templateCache.snapshot();
    const requestTemplates = new Map<string, PackedPlantRenderData>();
    const timings: PackedPlantRenderWorkerTimings = {
        packingDurationMs: 0,
        renderDataBuildDurationMs: 0,
        rootBatchingDurationMs: 0,
        topologyGenerationDurationMs: 0,
        totalDurationMs: 0,
    };
    const results = request.tasks.map((task) => {
        if (!task.templateKey) {
            throw new TypeError(
                'Packed plant worker tasks require a non-empty templateKey',
            );
        }

        let template =
            requestTemplates.get(task.templateKey) ??
            templateCache.get(task.templateKey);
        if (!template) {
            const generated = measure(clock, () =>
                generatePlantTopology({
                    generation: task.generation,
                    plantDefinition: task.plantDefinition,
                    seed: task.seed,
                }),
            );
            timings.topologyGenerationDurationMs += generated.durationMs;

            const built = measure(clock, () =>
                buildGeneratedPlantRenderData({
                    flowerGrowth: task.flowerGrowth,
                    fruitGrowth: task.fruitGrowth,
                    plantDefinition: task.plantDefinition,
                    renderDetailedGeometry: true,
                    showFlowers: task.showFlowers,
                    showLeaves: task.showLeaves,
                    showProduce: task.showProduce,
                    topology: generated.value,
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
