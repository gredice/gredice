'use client';

import type { PlantInstanceBufferMetricsSnapshot } from '../generators/plant/lib/plantInstanceBufferMetrics';
import type { GameQualityProfileTier } from './gameQuality';

export type GeneratedPlantProfilePartCounts = {
    billboardInstances: number;
    compactLeafInstances: number;
    flowers: number;
    leafTriangles: number;
    leaves: number;
    produce: number;
    shadowCasterSubmissions: number;
    shadowPrimitiveInstances: number;
    stems: number;
    thorns: number;
};

export type GeneratedPlantProfileRenderCounts = {
    detailedFields: number;
    detailedPlantInstances: number;
    farFields: number;
    farPlantInstances: number;
    invisibleFields: number;
    invisiblePlantInstances: number;
    midFields: number;
    midPlantInstances: number;
    nearFields: number;
    nearPlantInstances: number;
    parts: GeneratedPlantProfilePartCounts;
    pendingNearFields: number;
    pendingNearPlantInstances: number;
    totalFields: number;
    totalPlantInstances: number;
};

export type GeneratedPlantShaderPrewarmStatus =
    | 'cancelled'
    | 'compiling'
    | 'failed'
    | 'idle'
    | 'ready'
    | 'scheduled'
    | 'timed-out';

export type GeneratedPlantProfilePipelineCounts = {
    packedWorker: {
        buildCount: number;
        buildDurationMaxMs: number;
        buildDurationTotalMs: number;
        observed: boolean;
        packingDurationMaxMs: number;
        packingDurationTotalMs: number;
        renderDataBuildDurationMaxMs: number;
        renderDataBuildDurationTotalMs: number;
        rootBatchingDurationMaxMs: number;
        rootBatchingDurationTotalMs: number;
        symbolGenerationDurationMaxMs: number;
        symbolGenerationDurationTotalMs: number;
        totalDurationMaxMs: number;
        totalDurationTotalMs: number;
        transferByteLengthMax: number;
        transferByteLengthTotal: number;
        transferCount: number;
    };
    scheduler: {
        activeSubscriberCount: number;
        cancelledSubscriberCount: number;
        completedTaskCount: number;
        deduplicatedSubscriberCount: number;
        deliveredSubscriberCount: number;
        enqueuedTaskCount: number;
        failedTaskCount: number;
        focusedPromotionCount: number;
        focusedQueuedTaskCount: number;
        inFlightTaskCount: number;
        lifetimePeakQueuedTaskCount: number;
        observed: boolean;
        peakQueuedTaskCount: number;
        priorityPromotionCount: number;
        queuedTaskCount: number;
        queuedTaskRemovalCount: number;
        staleResultCount: number;
        startedTaskCount: number;
        submittedSubscriberCount: number;
    };
    shaderPrewarm: {
        deduplicated: boolean | null;
        durationMs: number | null;
        observed: boolean;
        postSwapCompilationCount: number | null;
        postSwapProgramCount: number | null;
        programCountAfter: number | null;
        programCountBefore: number | null;
        readyAtFirstDetailSwap: boolean | null;
        status: GeneratedPlantShaderPrewarmStatus;
    };
    templateCache: {
        entryCount: number;
        estimatedBytes: number;
        evictionCount: number;
        hitCount: number;
        lifetimePeakEstimatedBytes: number;
        maxEntryCount: number;
        maxEstimatedBytes: number;
        missCount: number;
        observed: boolean;
        oversizeSkipCount: number;
        peakEstimatedBytes: number;
        writeCount: number;
    };
};

export type GeneratedPlantProfileSnapshot = {
    active: boolean;
    camera: {
        active: boolean;
        settled: boolean;
        view: 'closeup' | 'normal';
        zoom: number | null;
    };
    error: string | null;
    instanceBuffers: PlantInstanceBufferMetricsSnapshot;
    lSystem: {
        cancelledTaskCount: number;
        completedTaskCount: number;
        requestedTaskCount: number;
        syncFallbackTaskCount: number;
        workerDurationMaxMs: number;
        workerDurationTotalMs: number;
        workerFailureCount: number;
        workerRequestCount: number;
        workerTaskCount: number;
    };
    lodEvaluation: {
        durationMaxMs: number;
        durationTotalMs: number;
        fieldEvaluationCount: number;
        fieldProjectionTestCount: number;
        groupRejectionCount: number;
        groupTestCount: number;
        updateCount: number;
    };
    milestonesMs: {
        cameraSettled: number | null;
        firstDetailedChunk: number | null;
        firstDetailedField: number | null;
        fullyDetailed: number | null;
        nearIntent: number | null;
        pendingNear: number | null;
    };
    nonSelected: GeneratedPlantProfileRenderCounts;
    pipeline: GeneratedPlantProfilePipelineCounts;
    renderData: {
        activeArchetypeCount: number;
        buildCount: number;
        buildDurationMaxMs: number;
        buildDurationTotalMs: number;
        builtPlantInstanceCount: number;
        detailedPlantInstanceCount: number;
        failedArchetypeCount: number;
        maxArchetypeCountPerBatch: number;
    };
    selected: GeneratedPlantProfileRenderCounts;
    selectedBlockId: string;
    selectedRaisedBedId: number;
    sessionId: number;
};

export type GameProfileMetadata = {
    adaptiveHighAmbientFps?: number;
    adaptiveHighCloudUpdateMs?: number;
    adaptiveHighDeclineCount?: number;
    adaptiveHighDprCap?: number;
    adaptiveHighEnabled?: boolean;
    adaptiveHighEwmaMs?: number;
    adaptiveHighFactor?: number;
    adaptiveHighGpuTimerDisjointCount?: number;
    adaptiveHighGpuTimerPendingCount?: number;
    adaptiveHighGpuTimerSupported?: boolean;
    adaptiveHighInteractionActive?: boolean;
    adaptiveHighLevel?: number;
    adaptiveHighLevelDwellMs?: number;
    adaptiveHighLoad?: number;
    adaptiveHighOscillationCount?: number;
    adaptiveHighProfileControlActive?: boolean;
    adaptiveHighProfileControlEnabled?: boolean;
    adaptiveHighProfileControlSampleCount?: number;
    adaptiveHighReason?: string;
    adaptiveHighRecoveryCount?: number;
    adaptiveHighSampleMs?: number;
    adaptiveHighSampleSource?: string;
    adaptiveHighTransitionCount?: number;
    actorGroundingShadowBatchCount?: number;
    actorGroundingShadowCapacity?: number;
    actorGroundingShadowCount?: number;
    actorGroundingShadowDroppedCount?: number;
    actorGroundingShadowPrimaryCasterCount?: number;
    actorGroundingShadowUpdateCount?: number;
    actorGroundingShadowVisibleCount?: number;
    animatedCasterShadowRefreshCount?: number;
    cloudAttenuationMaskResolution?: number;
    cloudAttenuationMaterialCount?: number;
    cloudAttenuationUpdateCount?: number;
    cloudAttenuationUpdateMs?: number;
    cloudProjectedShadowCount?: number;
    cloudRealShadowCasterCount?: number;
    cloudVisualCount?: number;
    dprCap?: number;
    groundDecorationAtlasEstimatedGpuBytes?: number;
    groundDecorationAtlasPageCount?: number;
    groundDecorationChunkCount?: number;
    groundDecorationCount?: number;
    groundDecorationDensity?: number;
    groundDecorationVisibleCount?: number;
    generatedLSystemCacheEntryCount?: number;
    generatedLSystemCacheEstimatedBytes?: number;
    generatedLSystemCacheEvictionCount?: number;
    generatedLSystemCacheHitCount?: number;
    generatedLSystemCacheMaxEntryCount?: number;
    generatedLSystemCacheMaxEstimatedBytes?: number;
    generatedLSystemCacheMissCount?: number;
    generatedLSystemCacheOversizeSkipCount?: number;
    generatedLSystemCachePeakEstimatedBytes?: number;
    generatedLSystemCacheWriteCount?: number;
    generatedPlantBatchCount?: number;
    generatedPlantExpectedInstanceCount?: number;
    generatedPlantFieldCount?: number;
    generatedPlantInstanceCount?: number;
    generatedPlantProfile?: GeneratedPlantProfileSnapshot | null;
    generatedPlantVisibleFieldCount?: number;
    generatedPlantVisibleInstanceCount?: number;
    instancedInteractionControllerCount?: number;
    instancedInteractionResolutionCount?: number;
    instancedInteractionResolutionMaxMs?: number;
    instancedInteractionResolutionTotalMs?: number;
    instancedInteractionResolvedTargetCount?: number;
    instancedInteractionTargetCount?: number;
    instancedSnowOverlayCount?: number;
    placementChunkLogicalTouchedCount?: number;
    placementChunkLogicalUpdateCount?: number;
    placementChunkPhysicalRebuildCount?: number;
    placementChunkPhysicalRebuildDurationMaxMs?: number;
    placementChunkPhysicalRebuildDurationP95Ms?: number;
    placementChunkPhysicalTransformedInstanceCount?: number;
    placementProjectedShadowCount?: number;
    placementProjectedShadowDroppedCount?: number;
    placementProjectedShadowPeakCount?: number;
    placementShadowActiveCount?: number;
    placementShadowDeferredChangeCount?: number;
    placementShadowFlushCount?: number;
    qualityTier?: GameQualityProfileTier;
    rainParticleCount?: number;
    rainWetOverlayDistinctUniformCount?: number;
    rainWetOverlayMaterialConsumerCount?: number;
    raisedBedMulchOverlayCount?: number;
    primaryShadowRefreshCount?: number;
    rendererGeometries?: number;
    rendererLines?: number;
    rendererMatrices?: number;
    rendererPoints?: number;
    rendererRenderCalls?: number;
    rendererShaders?: number;
    rendererTextures?: number;
    rendererTriangles?: number;
    shadowMapAutoUpdate?: boolean;
    shadowMapDynamicRefreshMs?: number;
    shadowMapInvalidationCount?: number;
    shadowMapSize?: number;
    shadowsEnabled?: boolean;
    snowOverlayDistinctUniformCount?: number;
    snowOverlayMaterialConsumerCount?: number;
    snowOverlayMinCoverage?: number;
    snowParticleCapacity?: number;
    snowParticleCount?: number;
    snowParticleGeometryBuildCount?: number;
    weatherDisabled?: boolean;
};

declare global {
    interface Window {
        __grediceGameProfile?: GameProfileMetadata;
    }
}

export function readGameProfileMetadata() {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return window.__grediceGameProfile;
}

export function updateGameProfileMetadata(metadata: GameProfileMetadata) {
    if (typeof window === 'undefined') {
        return;
    }

    window.__grediceGameProfile = {
        ...window.__grediceGameProfile,
        ...metadata,
    };
}
