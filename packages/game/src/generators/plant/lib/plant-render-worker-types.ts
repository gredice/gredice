import type {
    PackedPlantRenderData,
    PackedPlantRootTransform,
} from './packedPlantRenderData';
import type { PlantDefinition } from './plant-definitions';

export const PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION = 4 as const;
export const PACKED_PLANT_RENDER_WORKER_REQUEST_KIND =
    'packed-plant-render-request' as const;
export const PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND =
    'packed-plant-render-response' as const;

export interface PackedPlantRenderWorkerTask {
    flowerGrowth: number;
    fruitGrowth: number;
    generation: number;
    plantDefinition: PlantDefinition;
    rootTransforms?: PackedPlantRootTransform[];
    seed: string;
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
    /** Unrooted archetype key shared by every instance in this template. */
    templateKey: string;
}

export interface PackedPlantRenderWorkerRequest {
    id: number;
    kind: typeof PACKED_PLANT_RENDER_WORKER_REQUEST_KIND;
    tasks: PackedPlantRenderWorkerTask[];
    version: typeof PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION;
}

export interface PackedPlantRenderWorkerTimings {
    packingDurationMs: number;
    renderDataBuildDurationMs: number;
    rootBatchingDurationMs: number;
    topologyGenerationDurationMs: number;
    totalDurationMs: number;
}

export interface PackedPlantRenderWorkerTemplateCacheDelta {
    evictionCount: number;
    hitCount: number;
    missCount: number;
    oversizeSkipCount: number;
    writeCount: number;
}

export interface PackedPlantRenderWorkerTemplateCacheSnapshot
    extends PackedPlantRenderWorkerTemplateCacheDelta {
    entryCount: number;
    estimatedBytes: number;
    maxEntryCount: number;
    maxEstimatedBytes: number;
    peakEstimatedBytes: number;
}

export interface PackedPlantRenderWorkerTemplateCacheMetrics {
    delta: PackedPlantRenderWorkerTemplateCacheDelta;
    snapshot: PackedPlantRenderWorkerTemplateCacheSnapshot;
}

export interface PackedPlantRenderWorkerResponse {
    id: number;
    kind: typeof PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND;
    results: PackedPlantRenderData[];
    templateCache: PackedPlantRenderWorkerTemplateCacheMetrics;
    timings: PackedPlantRenderWorkerTimings;
    transferByteLength: number;
    version: typeof PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION;
}
