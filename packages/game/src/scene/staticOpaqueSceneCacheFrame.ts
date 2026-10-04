import type {
    StaticOpaqueSceneCacheGpuSample,
    StaticOpaqueSceneCacheGpuTimer,
} from './staticOpaqueSceneCacheGpuTimer';

/** Diagnostic live renders are not same-scene admission probes. */
export const staticOpaqueSceneCacheObserverWindowId = -1;

export const staticOpaqueSceneCacheDisabledMetadata = {
    staticOpaqueSceneCacheAllocatedTargetBytes: 0,
    staticOpaqueSceneCacheBaseTerrainLayer: 'live',
    staticOpaqueSceneCacheBenefitEvaluationCount: 0,
    staticOpaqueSceneCacheBenefitNetGpuMsPerFrame: null,
    staticOpaqueSceneCacheBenefitNetWorkPerFrame: null,
    staticOpaqueSceneCacheBenefitReason: 'disabled',
    staticOpaqueSceneCacheBenefitStatus: 'disabled',
    staticOpaqueSceneCacheBoundaryCount: 0,
    staticOpaqueSceneCacheBudgetBytes: 0,
    staticOpaqueSceneCacheBudgetSource: 'disabled',
    staticOpaqueSceneCacheBypassFrameCount: 0,
    staticOpaqueSceneCacheCaptureCount: 0,
    staticOpaqueSceneCacheCaptureSubmissionCount: 0,
    staticOpaqueSceneCacheCaptureTriangleCount: 0,
    staticOpaqueSceneCacheCompositePassCount: 0,
    staticOpaqueSceneCacheReplayEstimatedBytes: 0,
    staticOpaqueSceneCacheReplayStatus: 'disabled',
    staticOpaqueSceneCacheReplaySubmissionCount: 0,
    staticOpaqueSceneCacheReplayTriangleCount: 0,
    staticOpaqueSceneCacheEnabled: false,
    staticOpaqueSceneCacheGpuSampleCount: 0,
    staticOpaqueSceneCacheGpuTimingSupported: null,
    staticOpaqueSceneCacheHitFrameCount: 0,
    staticOpaqueSceneCacheIneligibleBoundaryCount: 0,
    staticOpaqueSceneCacheInvalidationCount: 0,
    staticOpaqueSceneCacheLastInvalidationReason: 'disabled',
    staticOpaqueSceneCacheLiveBoundaryCount: 0,
    staticOpaqueSceneCacheLiveFrameCount: 0,
    staticOpaqueSceneCacheMeshCount: 0,
    staticOpaqueSceneCachePeakTargetBytes: 0,
    staticOpaqueSceneCacheProbeFrameCount: 0,
    staticOpaqueSceneCacheReason: 'disabled',
    staticOpaqueSceneCacheSavedSubmissionCount: 0,
    staticOpaqueSceneCacheSavedTriangleCount: 0,
    staticOpaqueSceneCacheState: 'disabled',
    staticOpaqueSceneCacheStaticPropsLayer: 'live',
    staticOpaqueSceneCacheSupported: false,
    staticOpaqueSceneCacheTargetEstimatedBytes: 0,
    staticOpaqueSceneCacheTargetHeight: 0,
    staticOpaqueSceneCacheTargetSampleCount: 0,
    staticOpaqueSceneCacheTargetWidth: 0,
    staticOpaqueSceneCacheTriangleCount: 0,
    staticOpaqueSceneCacheUnexpectedStaticSubmissionCount: 0,
} satisfies GameProfileMetadata;

/** Clear old decisions/replay fields while keeping actual diagnostic counters. */
export function buildStaticOpaqueSceneCacheObservedLiveMetadata(
    diagnostics: Pick<
        GameProfileMetadata,
        | 'staticOpaqueSceneCacheBudgetBytes'
        | 'staticOpaqueSceneCacheBudgetSource'
        | 'staticOpaqueSceneCacheGpuSampleCount'
        | 'staticOpaqueSceneCacheGpuTimingSupported'
        | 'staticOpaqueSceneCacheLiveFrameCount'
        | 'staticOpaqueSceneCachePeakTargetBytes'
    >,
) {
    return { ...staticOpaqueSceneCacheDisabledMetadata, ...diagnostics };
}

/** Polling stays identical; the disabled observer never enters cache work. */
export function renderStaticOpaqueSceneCacheFrame({
    enabled,
    gpuTimer,
    nowMs,
    consumeGpuSamples,
    prepareLive,
    publishLive,
    renderCache,
    renderLive,
}: {
    enabled: boolean;
    gpuTimer: Pick<
        StaticOpaqueSceneCacheGpuTimer,
        'poll' | 'evidenceEpoch' | 'isProfileObserved' | 'begin' | 'end'
    >;
    nowMs: number;
    consumeGpuSamples: (
        samples: readonly StaticOpaqueSceneCacheGpuSample[],
        evidenceEpoch: number,
    ) => void;
    renderCache: (nowMs: number) => void;
    renderLive: () => void;
    prepareLive: () => void;
    publishLive: () => void;
}) {
    consumeGpuSamples(gpuTimer.poll(nowMs), gpuTimer.evidenceEpoch);
    if (enabled) {
        renderCache(nowMs);
        return;
    }
    prepareLive();
    const timed =
        gpuTimer.isProfileObserved() &&
        gpuTimer.begin('live', nowMs, staticOpaqueSceneCacheObserverWindowId);
    try {
        renderLive();
    } finally {
        if (timed) gpuTimer.end();
    }
    publishLive();
}

import type { GameProfileMetadata } from './gameProfileMetadata';
