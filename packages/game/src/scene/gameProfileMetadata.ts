'use client';

import type { GameCameraSnapshot } from '../controls/GameCameraRigApi';
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

export type RuntimeFrameLoopProfileTelemetry = {
    activeLeaseCount: number;
    cancelledCallbackCount: number;
    canvasVisible: boolean;
    documentVisible: boolean;
    effectiveVisible: boolean;
    loopActive: boolean;
    ownedInvalidationCount: number;
    resumeCount: number;
    scheduledCallbackCount: number;
    suspendCount: number;
    targetFramesPerSecond: number;
    wakeupCount: number;
};

export function createRuntimeFrameLoopProfileTelemetry(): RuntimeFrameLoopProfileTelemetry {
    return {
        activeLeaseCount: 0,
        cancelledCallbackCount: 0,
        canvasVisible: false,
        documentVisible: false,
        effectiveVisible: false,
        loopActive: false,
        ownedInvalidationCount: 0,
        resumeCount: 0,
        scheduledCallbackCount: 0,
        suspendCount: 0,
        targetFramesPerSecond: 0,
        wakeupCount: 0,
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
    gardenStructureActiveRevision?: number;
    gardenStructureAssetBytesRequested?: number;
    gardenStructureAssetBytesResident?: number;
    gardenStructureAssetResolutionIssueCount?: number;
    gardenStructureAssetResolutionStatus?: 'idle' | 'resolved';
    gardenStructureAssetUnresolvedBatchCount?: number;
    gardenStructureAssetUrl?: string;
    gardenStructureCameraActivePointerCount?: number;
    gardenStructureCameraMode?: 'browse' | 'building' | 'restoring';
    gardenStructureCameraPositionX?: number;
    gardenStructureCameraPositionY?: number;
    gardenStructureCameraPositionZ?: number;
    gardenStructureCameraTargetX?: number;
    gardenStructureCameraTargetY?: number;
    gardenStructureCameraTargetZ?: number;
    gardenStructureCameraZoom?: number;
    gardenStructureAvatarCollisionStepCount?: number;
    gardenStructureAvatarCollisionStepDurationMaxMs?: number;
    gardenStructureAvatarCollisionStepDurationP95Ms?: number;
    gardenStructureAvatarCollisionStepDurationTotalMs?: number;
    gardenStructureCollisionBoxCount?: number;
    gardenStructureCollisionBucketCount?: number;
    gardenStructureCollectionDetailSuppressedPropCount?: number;
    gardenStructureCollectionExteriorSuppressedPropCount?: number;
    gardenStructureCollectionFrustumCulledPropCount?: number;
    gardenStructureCollectionFrustumCulledStructureCount?: number;
    gardenStructureCollectionPropCount?: number;
    gardenStructureCollectionStructureCount?: number;
    gardenStructureCollectionVisiblePropCount?: number;
    gardenStructureCollectionVisibleStructureCount?: number;
    gardenStructureCompileCount?: number;
    gardenStructureCompileDurationMs?: number;
    gardenStructureCompileDurationMaxMs?: number;
    gardenStructureDocumentPayloadBytes?: number;
    gardenStructureEdgeCount?: number;
    gardenStructureEditorActionCount?: number;
    gardenStructureEditorActionDurationMaxMs?: number;
    gardenStructureEditorActionDurationP95Ms?: number;
    gardenStructureEditorActionDurationTotalMs?: number;
    gardenStructureEditorActive?: boolean;
    gardenStructureEditorLastAction?: string;
    gardenStructureEditorPointerResolutionCount?: number;
    gardenStructureEditorPointerResolutionMaxMs?: number;
    gardenStructureEditorPointerResolutionTotalMs?: number;
    gardenStructureExteriorSuppressedPropCount?: number;
    gardenStructureFloorCount?: number;
    gardenStructureFallbackAttributeBytes?: number;
    gardenStructureFallbackDrawCount?: number;
    gardenStructureFallbackIndexBytes?: number;
    gardenStructureFallbackInstanceBufferBytes?: number;
    gardenStructureFallbackInstanceCount?: number;
    gardenStructureFallbackTriangleCount?: number;
    gardenStructureFallbackVertexCount?: number;
    gardenStructureFootprintCellCount?: number;
    gardenStructureNavigationCompileDurationMs?: number;
    gardenStructureNavigationCompileDurationMaxMs?: number;
    gardenStructureOpenPortalCount?: number;
    gardenStructurePlanCacheEstimatedBytes?: number;
    gardenStructurePlanCacheEvictionCount?: number;
    gardenStructurePlanCacheHitCount?: number;
    gardenStructurePlanCacheLookupDurationMaxMs?: number;
    gardenStructurePlanCacheMissCount?: number;
    gardenStructurePlanCacheOutcome?: 'hit' | 'miss' | 'none';
    gardenStructurePlanCacheLookupDurationMs?: number;
    gardenStructurePreviewAttributeBytes?: number;
    gardenStructurePreviewDrawCount?: number;
    gardenStructurePreviewIndexBytes?: number;
    gardenStructurePreviewInstanceBufferBytes?: number;
    gardenStructurePreviewInstanceCount?: number;
    gardenStructurePreviewTriangleCount?: number;
    gardenStructurePreviewVertexCount?: number;
    gardenStructureProductionAttributeBytes?: number;
    gardenStructureProductionDrawCount?: number;
    gardenStructureProductionIndexBytes?: number;
    gardenStructureProductionInstanceBufferBytes?: number;
    gardenStructureProductionInstanceCount?: number;
    gardenStructureProductionOpaqueDrawCount?: number;
    gardenStructureProductionTextureCount?: number;
    gardenStructureProductionTextureEstimatedBytes?: number;
    gardenStructureProductionTransparentDrawCount?: number;
    gardenStructureProductionTriangleCount?: number;
    gardenStructureProductionVertexCount?: number;
    gardenStructurePropCount?: number;
    gardenStructureProjectedBottom?: number;
    gardenStructureProjectedLeft?: number;
    gardenStructureProjectedRight?: number;
    gardenStructureProjectedTop?: number;
    gardenStructureRenderBatchCount?: number;
    gardenStructureRenderInstanceCount?: number;
    gardenStructureRenderTriangleCount?: number;
    gardenStructureRenderVertexCount?: number;
    gardenStructureRoofRegionCount?: number;
    gardenStructureStructureCount?: number;
    gardenStructureTransparentSurfaceCount?: number;
    gardenStructureVisibleInteriorSurfaceCount?: number;
    gardenStructureVisiblePropCount?: number;
    gardenStructureVisibleStructureCount?: number;
    gardenStructureWalkableCellCount?: number;
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

const gardenStructureEditorActionSampleLimit = 64;
const gardenStructureEditorActionSamples: number[] = [];
const gardenStructureAvatarCollisionStepBucketWidthMs = 0.05;
const gardenStructureAvatarCollisionStepFiniteBucketCount = 200;
const gardenStructureAvatarCollisionStepOverflowBucket =
    gardenStructureAvatarCollisionStepFiniteBucketCount + 1;
const gardenStructureAvatarCollisionStepBucketCount =
    gardenStructureAvatarCollisionStepOverflowBucket + 1;
const gardenStructureAvatarCollisionStepFenwickTree = new Uint32Array(
    gardenStructureAvatarCollisionStepBucketCount + 1,
);
let gardenStructureAvatarCollisionStepSampleCount = 0;
let gardenStructureProfileTelemetryEnabled = false;
let gardenStructurePointerStartedAt: number | null = null;

export function getGardenStructureProfileP95(samples: readonly number[]) {
    if (samples.length === 0) {
        return 0;
    }
    const sorted = [...samples].sort((left, right) => left - right);
    return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}

export function setGardenStructureProfileTelemetryEnabled(enabled: boolean) {
    gardenStructureProfileTelemetryEnabled = enabled;
    gardenStructurePointerStartedAt = null;
    gardenStructureEditorActionSamples.length = 0;
    gardenStructureAvatarCollisionStepFenwickTree.fill(0);
    gardenStructureAvatarCollisionStepSampleCount = 0;
    updateGameProfileMetadata({
        gardenStructureAvatarCollisionStepCount: 0,
        gardenStructureAvatarCollisionStepDurationMaxMs: 0,
        gardenStructureAvatarCollisionStepDurationP95Ms: 0,
        gardenStructureAvatarCollisionStepDurationTotalMs: 0,
        gardenStructureCompileDurationMaxMs: 0,
        gardenStructureCompileDurationMs: 0,
        gardenStructureEditorActionCount: 0,
        gardenStructureEditorActionDurationMaxMs: 0,
        gardenStructureEditorActionDurationP95Ms: 0,
        gardenStructureEditorActionDurationTotalMs: 0,
        gardenStructureEditorLastAction: '',
        gardenStructureEditorPointerResolutionCount: 0,
        gardenStructureEditorPointerResolutionMaxMs: 0,
        gardenStructureEditorPointerResolutionTotalMs: 0,
        gardenStructureNavigationCompileDurationMaxMs: 0,
        gardenStructureNavigationCompileDurationMs: 0,
        gardenStructurePlanCacheLookupDurationMaxMs: 0,
        gardenStructurePlanCacheLookupDurationMs: 0,
    });
}

function getGardenStructureAvatarCollisionStepP95(maxDurationMs: number) {
    let target = Math.ceil(
        gardenStructureAvatarCollisionStepSampleCount * 0.95,
    );
    let fenwickIndex = 0;
    let binaryStep = 1;
    while (binaryStep * 2 <= gardenStructureAvatarCollisionStepBucketCount) {
        binaryStep *= 2;
    }
    while (binaryStep > 0) {
        const nextIndex = fenwickIndex + binaryStep;
        if (
            nextIndex <= gardenStructureAvatarCollisionStepBucketCount &&
            gardenStructureAvatarCollisionStepFenwickTree[nextIndex] < target
        ) {
            fenwickIndex = nextIndex;
            target -= gardenStructureAvatarCollisionStepFenwickTree[nextIndex];
        }
        binaryStep = Math.floor(binaryStep / 2);
    }
    const bucket = Math.min(
        fenwickIndex,
        gardenStructureAvatarCollisionStepOverflowBucket,
    );
    return bucket === gardenStructureAvatarCollisionStepOverflowBucket
        ? maxDurationMs
        : bucket * gardenStructureAvatarCollisionStepBucketWidthMs;
}

function addGardenStructureAvatarCollisionStepBucket(bucket: number) {
    let fenwickIndex = bucket + 1;
    while (
        fenwickIndex < gardenStructureAvatarCollisionStepFenwickTree.length
    ) {
        gardenStructureAvatarCollisionStepFenwickTree[fenwickIndex] += 1;
        fenwickIndex += fenwickIndex & -fenwickIndex;
    }
}

/**
 * Records the measured duration around one real horizontal avatar movement
 * resolution. The fixed-size histogram keeps profiling memory and p95 work
 * bounded independently of soak duration.
 */
export function recordGardenStructureAvatarCollisionStep(durationMs: number) {
    if (
        !gardenStructureProfileTelemetryEnabled ||
        !Number.isFinite(durationMs) ||
        durationMs < 0
    ) {
        return;
    }

    const bucket = Math.min(
        Math.ceil(durationMs / gardenStructureAvatarCollisionStepBucketWidthMs),
        gardenStructureAvatarCollisionStepOverflowBucket,
    );
    addGardenStructureAvatarCollisionStepBucket(bucket);
    gardenStructureAvatarCollisionStepSampleCount += 1;
    const current = readGameProfileMetadata();
    const maxDurationMs = Math.max(
        current?.gardenStructureAvatarCollisionStepDurationMaxMs ?? 0,
        durationMs,
    );
    if (!current) {
        return;
    }
    current.gardenStructureAvatarCollisionStepCount =
        gardenStructureAvatarCollisionStepSampleCount;
    current.gardenStructureAvatarCollisionStepDurationMaxMs = maxDurationMs;
    current.gardenStructureAvatarCollisionStepDurationP95Ms =
        getGardenStructureAvatarCollisionStepP95(maxDurationMs);
    current.gardenStructureAvatarCollisionStepDurationTotalMs =
        (current.gardenStructureAvatarCollisionStepDurationTotalMs ?? 0) +
        durationMs;
}

export function recordGardenStructureCompileDurations({
    cacheOutcome,
    compileDurationMs,
    lookupDurationMs,
    navigationCompileDurationMs,
}: Readonly<{
    cacheOutcome: 'hit' | 'miss' | 'none';
    compileDurationMs: number;
    lookupDurationMs: number;
    navigationCompileDurationMs: number;
}>) {
    if (!gardenStructureProfileTelemetryEnabled) {
        return;
    }

    const compileDurationValid =
        Number.isFinite(compileDurationMs) && compileDurationMs >= 0;
    const navigationDurationValid =
        Number.isFinite(navigationCompileDurationMs) &&
        navigationCompileDurationMs >= 0;
    const lookupDurationValid =
        Number.isFinite(lookupDurationMs) && lookupDurationMs >= 0;
    if (
        !compileDurationValid &&
        !navigationDurationValid &&
        !lookupDurationValid
    ) {
        return;
    }

    const current = readGameProfileMetadata();
    updateGameProfileMetadata({
        ...(compileDurationValid
            ? {
                  gardenStructureCompileDurationMs: compileDurationMs,
                  gardenStructureCompileDurationMaxMs:
                      cacheOutcome === 'miss'
                          ? Math.max(
                                current?.gardenStructureCompileDurationMaxMs ??
                                    0,
                                compileDurationMs,
                            )
                          : (current?.gardenStructureCompileDurationMaxMs ?? 0),
              }
            : {}),
        ...(navigationDurationValid
            ? {
                  gardenStructureNavigationCompileDurationMs:
                      navigationCompileDurationMs,
                  gardenStructureNavigationCompileDurationMaxMs: Math.max(
                      current?.gardenStructureNavigationCompileDurationMaxMs ??
                          0,
                      navigationCompileDurationMs,
                  ),
              }
            : {}),
        ...(lookupDurationValid
            ? {
                  gardenStructurePlanCacheLookupDurationMaxMs: Math.max(
                      current?.gardenStructurePlanCacheLookupDurationMaxMs ?? 0,
                      lookupDurationMs,
                  ),
                  gardenStructurePlanCacheLookupDurationMs: lookupDurationMs,
              }
            : {}),
    });
}

export function recordGardenStructureEditorAction(
    action: string,
    durationMs: number,
) {
    if (
        !gardenStructureProfileTelemetryEnabled ||
        !Number.isFinite(durationMs) ||
        durationMs < 0
    ) {
        return;
    }
    gardenStructureEditorActionSamples.push(durationMs);
    if (
        gardenStructureEditorActionSamples.length >
        gardenStructureEditorActionSampleLimit
    ) {
        gardenStructureEditorActionSamples.shift();
    }
    const sorted = [...gardenStructureEditorActionSamples].sort(
        (left, right) => left - right,
    );
    updateGameProfileMetadata({
        gardenStructureEditorActionCount:
            gardenStructureEditorActionSamples.length,
        gardenStructureEditorActionDurationMaxMs: sorted.at(-1) ?? 0,
        gardenStructureEditorActionDurationP95Ms:
            getGardenStructureProfileP95(sorted),
        gardenStructureEditorActionDurationTotalMs: sorted.reduce(
            (total, duration) => total + duration,
            0,
        ),
        gardenStructureEditorLastAction: action,
    });
}

export function beginGardenStructurePointerResolution(startedAt: number) {
    if (
        !gardenStructureProfileTelemetryEnabled ||
        !Number.isFinite(startedAt) ||
        startedAt < 0
    ) {
        return;
    }
    gardenStructurePointerStartedAt = startedAt;
}

export function recordGardenStructurePointerResolution(resolvedAt: number) {
    const startedAt = gardenStructurePointerStartedAt;
    gardenStructurePointerStartedAt = null;
    if (
        !gardenStructureProfileTelemetryEnabled ||
        startedAt === null ||
        !Number.isFinite(resolvedAt) ||
        resolvedAt < startedAt
    ) {
        return;
    }
    const durationMs = resolvedAt - startedAt;
    const current = readGameProfileMetadata();
    updateGameProfileMetadata({
        gardenStructureEditorPointerResolutionCount:
            (current?.gardenStructureEditorPointerResolutionCount ?? 0) + 1,
        gardenStructureEditorPointerResolutionMaxMs: Math.max(
            current?.gardenStructureEditorPointerResolutionMaxMs ?? 0,
            durationMs,
        ),
        gardenStructureEditorPointerResolutionTotalMs:
            (current?.gardenStructureEditorPointerResolutionTotalMs ?? 0) +
            durationMs,
    });
}
