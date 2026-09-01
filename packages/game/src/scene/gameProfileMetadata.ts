'use client';

import type { GameCameraSnapshot } from '../controls/GameCameraRigApi';
import type { PlantInstanceBufferMetricsSnapshot } from '../generators/plant/lib/plantInstanceBufferMetrics';
import type { GameRuntimeSchedulerSnapshot } from './GameRuntimeScheduler';
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

export type GeneratedPlantShaderProgramDiagnostic = {
    cacheKeyHash: string;
    id: number;
    name: string;
};

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
        topologyGenerationDurationMaxMs: number;
        topologyGenerationDurationTotalMs: number;
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
        postSwapPrograms: GeneratedPlantShaderProgramDiagnostic[] | null;
        programCountAfter: number | null;
        programCountBefore: number | null;
        programsAfter: GeneratedPlantShaderProgramDiagnostic[] | null;
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
    generation: {
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

export type StaticOpaqueSceneCacheState =
    | 'bypass'
    | 'capturing'
    | 'cold'
    | 'disabled'
    | 'ready'
    | 'unsupported';

export type StaticOpaqueSceneCacheOcclusionFixtureState =
    | 'arming'
    | 'failed'
    | 'passed'
    | 'verifying';

export type RuntimeFrameLoopProfileTelemetry = GameRuntimeSchedulerSnapshot & {
    sceneTimeSeconds: number;
};

export function createRuntimeFrameLoopProfileTelemetry(): RuntimeFrameLoopProfileTelemetry {
    return {
        activeDeadlineCount: 0,
        activeFixedStepLeaseCount: 0,
        activeLeaseCount: 0,
        activeRenderLeaseCount: 0,
        callbackPending: false,
        cancelledCallbackCount: 0,
        canvasVisible: false,
        contextAvailable: false,
        deadlineCount: 0,
        deadlineOwners: [],
        deferredWorkCount: 0,
        displayFrameCalibrationCount: 0,
        displayFrameIntervalMs: null,
        disposed: false,
        documentVisible: false,
        effectiveVisible: false,
        fixedStepCount: 0,
        fixedStepFailureCount: 0,
        fixedStepOwners: [],
        hiddenDeferredRenderRequestCount: 0,
        invalidationCount: 0,
        invalidationFailureCount: 0,
        leaseAcquiredCount: 0,
        leaseReleasedCount: 0,
        loopActive: false,
        maxDeliveredDeltaMs: 0,
        missedFrameReceiptCount: 0,
        nonessentialHiddenWorkCount: 0,
        ownedInvalidationCount: 0,
        pendingCallbackDueAt: null,
        pendingCallbackKind: 'none',
        renderLeaseOwners: [],
        renderLeaseSummaries: [],
        renderRequestReasons: [],
        requireCanvasVisible: true,
        resumeCount: 0,
        r3fFrameCallbackCount: 0,
        sceneTimeSeconds: 0,
        scheduledCallbackCount: 0,
        suspendCount: 0,
        targetFramesPerSecond: 0,
        wakeupCount: 0,
    };
}

/**
 * Exposes an exact scheduler snapshot to profiling readers without copying a
 * deep telemetry object on every frame and scheduler wakeup. A synchronous
 * property-read or structured-clone burst shares one snapshot. The cache stays
 * valid until its queued reset runs, so later sampling observes current state.
 */
export function bindRuntimeFrameLoopProfileTelemetry(
    telemetry: RuntimeFrameLoopProfileTelemetry,
    readSnapshot: () => RuntimeFrameLoopProfileTelemetry,
    scheduleCacheReset: (callback: () => void) => void = (callback) =>
        globalThis.queueMicrotask(callback),
) {
    const fields = Object.keys(
        telemetry,
    ) as (keyof RuntimeFrameLoopProfileTelemetry)[];
    let bound = true;
    let cachedSnapshot: RuntimeFrameLoopProfileTelemetry | null = null;
    let cacheResetScheduled = false;
    const readCachedSnapshot = () => {
        if (cachedSnapshot === null) {
            cachedSnapshot = readSnapshot();
        }
        if (!cacheResetScheduled) {
            cacheResetScheduled = true;
            scheduleCacheReset(() => {
                cachedSnapshot = null;
                cacheResetScheduled = false;
            });
        }
        return cachedSnapshot;
    };

    for (const field of fields) {
        Object.defineProperty(telemetry, field, {
            configurable: true,
            enumerable: true,
            get: () => readCachedSnapshot()[field],
        });
    }

    return () => {
        if (!bound) {
            return;
        }
        bound = false;
        const finalSnapshot = readSnapshot();
        cachedSnapshot = null;
        for (const field of fields) {
            Object.defineProperty(telemetry, field, {
                configurable: true,
                enumerable: true,
                value: finalSnapshot[field],
                writable: true,
            });
        }
    };
}

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
    actorGroundingShadowSpeciesCounts?: Record<string, number>;
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
    hoverOutlineActiveTargetCount?: number;
    hoverOutlineAllocatedHeight?: number;
    hoverOutlineAllocatedPixelCount?: number;
    hoverOutlineAllocatedWidth?: number;
    hoverOutlineAllocationEstimatedBytes?: number;
    hoverOutlineCompositePassCount?: number;
    hoverOutlineCropClippedCount?: number;
    hoverOutlineCropPixelCount?: number;
    hoverOutlineDrawingBufferPixelCount?: number;
    hoverOutlineFormat?: string;
    hoverOutlineHorizontalPassCount?: number;
    hoverOutlineKernelSampleCount?: number;
    hoverOutlineMaskPassCount?: number;
    hoverOutlineMaxKernelSampleCount?: number;
    hoverOutlinePipeline?: string;
    hoverOutlineProfileCommandAction?: 'hide' | 'show';
    hoverOutlineProfileTargetBlockId?: string | null;
    hoverOutlineProfileTargetRaisedBedId?: number | null;
    hoverOutlineRenderTargetCount?: number;
    hoverOutlineRoiRatio?: number;
    hoverOutlineStyleGroupCount?: number;
    hoverOutlineThickness?: number;
    generatedPlantBatchCount?: number;
    generatedPlantClusterInstanceCount?: number;
    generatedPlantClusterPrimitiveTriangleCount?: number;
    generatedPlantDetailedInstanceCount?: number;
    generatedPlantDetailedLeafTriangleCount?: number;
    generatedPlantDetailAdmittedBedCount?: number;
    generatedPlantDetailAdmittedInstanceCount?: number;
    generatedPlantDetailBudgetInstanceCount?: number;
    generatedPlantDetailDemotedBedCount?: number;
    generatedPlantDetailEvictedBedCount?: number;
    generatedPlantDetailOverflowInstanceCount?: number;
    generatedPlantDetailPromotedBedCount?: number;
    generatedPlantDetailRequestedBedCount?: number;
    generatedPlantDetailRequestedInstanceCount?: number;
    generatedPlantDetailRetainedBedCount?: number;
    generatedPlantDetailTransitionCount?: number;
    generatedPlantDetailUsedBudgetInstanceCount?: number;
    generatedPlantFarFieldCount?: number;
    generatedPlantFarInstanceCount?: number;
    generatedPlantExpectedInstanceCount?: number;
    generatedPlantFieldCount?: number;
    generatedPlantInstanceCount?: number;
    generatedPlantMidFieldCount?: number;
    generatedPlantMidInstanceCount?: number;
    generatedPlantNearFieldCount?: number;
    generatedPlantNearInstanceCount?: number;
    generatedPlantPendingDetailInstanceCount?: number;
    generatedPlantProfile?: GeneratedPlantProfileSnapshot | null;
    generatedPlantRenderBatchCount?: number;
    generatedPlantRenderNearInstanceCount?: number;
    generatedPlantVisibleFieldCount?: number;
    generatedPlantVisibleInstanceCount?: number;
    gameCameraSnapshot?: GameCameraSnapshot;
    gardenStructureBlockedTransitionCount?: number;
    gardenStructureCameraActivePointerCount?: number;
    gardenStructureCameraMode?: 'browse' | 'building' | 'restoring';
    gardenStructureCameraPositionX?: number;
    gardenStructureCameraPositionY?: number;
    gardenStructureCameraPositionZ?: number;
    gardenStructureCameraTargetX?: number;
    gardenStructureCameraTargetY?: number;
    gardenStructureCameraTargetZ?: number;
    gardenStructureCameraZoom?: number;
    gardenStructureCollisionBoxCount?: number;
    gardenStructureCollisionBucketCount?: number;
    gardenStructureCompileDurationMs?: number;
    gardenStructureDocumentPayloadBytes?: number;
    gardenStructureFootprintCellCount?: number;
    gardenStructureOpenPortalCount?: number;
    gardenStructurePlanCacheEstimatedBytes?: number;
    gardenStructurePlanCacheEvictionCount?: number;
    gardenStructurePlanCacheHitCount?: number;
    gardenStructurePlanCacheMissCount?: number;
    gardenStructureProjectedBottom?: number;
    gardenStructureProjectedLeft?: number;
    gardenStructureProjectedRight?: number;
    gardenStructureProjectedTop?: number;
    gardenStructureRenderBatchCount?: number;
    gardenStructureRenderInstanceCount?: number;
    gardenStructureVisibleBottom?: number;
    gardenStructureVisibleLeft?: number;
    gardenStructureVisibleRight?: number;
    gardenStructureVisibleTop?: number;
    profileAnimalCommandAcknowledgedIds?: string[];
    profileAnimalCommandAcknowledgementCount?: number;
    profileAnimalCommandBehavior?: string;
    profileAnimalCommandMovingAcknowledgedIds?: string[];
    profileAnimalCommandMovingAcknowledgementCount?: number;
    profileAnimalCommandSequence?: number;
    profileAnimalCommandSpecies?: string;
    profileGardenBlockCount?: number;
    profileGardenBlockCountsByName?: Record<string, number>;
    profileGardenId?: number;
    profileGardenRaisedBedCount?: number;
    profileGardenStackCount?: number;
    instancedInteractionControllerCount?: number;
    instancedInteractionResolutionCount?: number;
    instancedInteractionResolutionMaxMs?: number;
    instancedInteractionResolutionTotalMs?: number;
    instancedInteractionResolvedTargetCount?: number;
    instancedInteractionTargetCount?: number;
    instancedSnowOverlayCount?: number;
    operationVisualHighlightProfileDispatched?: boolean;
    operationVisualHighlightProfileTargetFieldId?: number;
    operationVisualHighlightProfileTargetGardenId?: number;
    operationVisualHighlightProfileTargetPositionIndex?: number;
    operationVisualHighlightProfileTargetRaisedBedId?: number;
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
    raisedBedFieldVisualBatchCount?: number;
    raisedBedFieldVisualChunkCount?: number;
    raisedBedFieldVisualInstanceCount?: number;
    raisedBedFieldVisualMatrixUploadCount?: number;
    raisedBedFieldVisualObjectCount?: number;
    raisedBedFieldVisualUploadedInstanceCount?: number;
    raisedBedMulchBatchCount?: number;
    raisedBedMulchGroupCount?: number;
    raisedBedMulchInstanceCount?: number;
    raisedBedMulchObjectCount?: number;
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
    runtimeFrameLoop?: RuntimeFrameLoopProfileTelemetry;
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
    staticOpaqueSceneCacheBoundaryCount?: number;
    staticOpaqueSceneCacheBypassFrameCount?: number;
    staticOpaqueSceneCacheCaptureCount?: number;
    staticOpaqueSceneCacheCaptureSubmissionCount?: number;
    staticOpaqueSceneCacheCaptureTriangleCount?: number;
    staticOpaqueSceneCacheCompositePassCount?: number;
    staticOpaqueSceneCacheReplayEstimatedBytes?: number;
    staticOpaqueSceneCacheReplayStatus?: string;
    staticOpaqueSceneCacheReplaySubmissionCount?: number;
    staticOpaqueSceneCacheReplayTriangleCount?: number;
    staticOpaqueSceneCacheEnabled?: boolean;
    staticOpaqueSceneCacheHitFrameCount?: number;
    staticOpaqueSceneCacheIneligibleBoundaryCount?: number;
    staticOpaqueSceneCacheInvalidationCount?: number;
    staticOpaqueSceneCacheLastInvalidationReason?: string;
    staticOpaqueSceneCacheLiveFrameCount?: number;
    staticOpaqueSceneCacheMeshCount?: number;
    staticOpaqueSceneCacheOcclusionBackgroundWitnessMinimumMatchRatio?: number;
    staticOpaqueSceneCacheOcclusionCaptureCountAtTransition?: number | null;
    staticOpaqueSceneCacheOcclusionFixtureEnabled?: boolean;
    staticOpaqueSceneCacheOcclusionFixturePass?: boolean;
    staticOpaqueSceneCacheOcclusionFixtureState?: StaticOpaqueSceneCacheOcclusionFixtureState;
    staticOpaqueSceneCacheOcclusionForegroundMinimumMatchRatio?: number;
    staticOpaqueSceneCacheOcclusionHitFrameCountAtTransition?: number | null;
    staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio?: number;
    staticOpaqueSceneCacheOcclusionOccluderMinimumMatchRatio?: number;
    staticOpaqueSceneCacheOcclusionTransitionCount?: number;
    staticOpaqueSceneCacheOcclusionVerifiedHitFrameCount?: number;
    staticOpaqueSceneCacheReason?: string;
    staticOpaqueSceneCacheSavedSubmissionCount?: number;
    staticOpaqueSceneCacheSavedTriangleCount?: number;
    staticOpaqueSceneCacheState?: StaticOpaqueSceneCacheState;
    staticOpaqueSceneCacheSupported?: boolean;
    staticOpaqueSceneCacheTargetEstimatedBytes?: number;
    staticOpaqueSceneCacheTargetHeight?: number;
    staticOpaqueSceneCacheTargetSampleCount?: number;
    staticOpaqueSceneCacheTargetWidth?: number;
    staticOpaqueSceneCacheTriangleCount?: number;
    staticOpaqueSceneCacheUnexpectedStaticSubmissionCount?: number;
    weatherDisabled?: boolean;
    weatherSurfaceAvoidedOverlaySubmissionCount?: number;
    weatherSurfaceAvoidedOverlayTriangleCount?: number;
    weatherSurfaceFallbackOverlaySubmissionCount?: number;
    weatherSurfaceFallbackOverlayTriangleCount?: number;
    weatherSurfaceIntegratedInstanceCount?: number;
    weatherSurfaceIntegratedMaterialCount?: number;
    weatherSurfaceMode?: 'integrated' | 'legacy';
    weatherSurfacePluginVariantCount?: number;
    weatherSurfaceSnowIntegrationReadyCount?: number;
    weatherSurfaceSnowIntegrationTrackedCount?: number;
    weatherSurfaceSnowIntegrationTransitionCount?: number;
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
