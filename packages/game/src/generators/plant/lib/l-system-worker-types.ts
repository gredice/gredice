import type { LSystemSymbol } from './l-system';
import type {
    PackedPlantRenderData,
    PackedPlantRootTransform,
} from './packedPlantRenderData';
import type { PlantDefinition, Rule } from './plant-definitions';

export const PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION = 1 as const;
export const PACKED_PLANT_RENDER_WORKER_REQUEST_KIND =
    'packed-plant-render-request' as const;
export const PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND =
    'packed-plant-render-response' as const;

export interface LSystemGenerationTask {
    axiom: string;
    rules: Record<string, Rule>;
    iterations: number;
    seed: string;
}

export interface LSystemWorkerRequest {
    id: number;
    tasks: LSystemGenerationTask[];
}

export interface LSystemWorkerResponse {
    id: number;
    results: LSystemSymbol[][];
}

/**
 * One exact detailed plant build. The L-system iteration count is kept
 * separate from the lifecycle generation because fractional lifecycle growth
 * still affects render geometry after symbol generation.
 */
export interface PackedPlantRenderWorkerTaskV1 {
    flowerGrowth: number;
    fruitGrowth: number;
    generation: number;
    generationTask: LSystemGenerationTask;
    plantDefinition: PlantDefinition;
    rootTransforms?: PackedPlantRootTransform[];
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
    /**
     * Identifies the unrooted packed archetype. Root transforms must never be
     * included so differently positioned instances share one worker cache hit.
     */
    templateKey: string;
}

export interface PackedPlantRenderWorkerRequestV1 {
    id: number;
    kind: typeof PACKED_PLANT_RENDER_WORKER_REQUEST_KIND;
    tasks: PackedPlantRenderWorkerTaskV1[];
    version: typeof PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION;
}

export interface PackedPlantRenderWorkerTimingsV1 {
    packingDurationMs: number;
    renderDataBuildDurationMs: number;
    rootBatchingDurationMs: number;
    symbolGenerationDurationMs: number;
    totalDurationMs: number;
}

export interface PackedPlantRenderWorkerTemplateCacheDeltaV1 {
    evictionCount: number;
    hitCount: number;
    missCount: number;
    oversizeSkipCount: number;
    writeCount: number;
}

export interface PackedPlantRenderWorkerTemplateCacheSnapshotV1
    extends PackedPlantRenderWorkerTemplateCacheDeltaV1 {
    entryCount: number;
    estimatedBytes: number;
    maxEntryCount: number;
    maxEstimatedBytes: number;
    peakEstimatedBytes: number;
}

export interface PackedPlantRenderWorkerTemplateCacheMetricsV1 {
    delta: PackedPlantRenderWorkerTemplateCacheDeltaV1;
    snapshot: PackedPlantRenderWorkerTemplateCacheSnapshotV1;
}

export interface PackedPlantRenderWorkerResponseV1 {
    id: number;
    kind: typeof PACKED_PLANT_RENDER_WORKER_RESPONSE_KIND;
    results: PackedPlantRenderData[];
    templateCache: PackedPlantRenderWorkerTemplateCacheMetricsV1;
    timings: PackedPlantRenderWorkerTimingsV1;
    transferByteLength: number;
    version: typeof PACKED_PLANT_RENDER_WORKER_PROTOCOL_VERSION;
}

export type PackedPlantRenderWorkerRequest = PackedPlantRenderWorkerRequestV1;
export type PackedPlantRenderWorkerResponse = PackedPlantRenderWorkerResponseV1;

export type LSystemWorkerMessageRequest =
    | LSystemWorkerRequest
    | PackedPlantRenderWorkerRequest;
export type LSystemWorkerMessageResponse =
    | LSystemWorkerResponse
    | PackedPlantRenderWorkerResponse;

export function getLSystemGenerationTaskKey(task: LSystemGenerationTask) {
    return JSON.stringify([task.axiom, task.rules, task.iterations, task.seed]);
}
