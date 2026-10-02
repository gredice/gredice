/*
 * Runtime benefit gate for the layered static opaque cache.
 *
 * The cache only stays enabled while it saves more GPU work than it spends on
 * captures and composition. Measured GPU time decides when timer queries are
 * available. Submitted work remains a diagnostic and can reject churn; it
 * never establishes a GPU saving. Missing measured evidence ends the probe
 * and releases its targets for a cooldown that doubles on every consecutive loss.
 */

// Hits and captures needed before a window is judged.
export const staticOpaqueSceneCacheBenefitWindowFrames = 60;
// Captures that end a window early, so capture churn is caught quickly.
export const staticOpaqueSceneCacheBenefitWindowCaptures = 8;
// GPU samples needed per kind before caching can be admitted.
export const staticOpaqueSceneCacheBenefitMinimumGpuSamples = 3;
// A live probe frame is rendered after this many consecutive hits.
export const staticOpaqueSceneCacheBenefitProbeInterval = 30;
// Hits before the first probes, so the first live samples arrive early.
export const staticOpaqueSceneCacheBenefitInitialProbeInterval = 4;
export const staticOpaqueSceneCacheBenefitCooldownMs = 30_000;
export const staticOpaqueSceneCacheBenefitMaximumCooldownMs = 300_000;
// Work model: triangles that cost about as much as one submission, and the
// cost of shading every pixel once, in submissions.
const trianglesPerSubmission = 10_000;
const fullScreenPassSubmissions = 2;
// The replay is one submission plus one cheap full-screen texel-fetch pass.
const compositeSubmissions = 1 + fullScreenPassSubmissions / 2;

export type StaticOpaqueSceneCacheBenefitStatus =
    | 'disabled'
    | 'enabled'
    | 'probing';

export type StaticOpaqueSceneCacheBenefitReason =
    | 'gpu-cost'
    | 'gpu-savings'
    | 'gpu-unavailable'
    | 'warming-up'
    | 'work-cost';

export type StaticOpaqueSceneCacheBenefitSampleKind =
    | 'capture'
    | 'hit'
    | 'live';

export type StaticOpaqueSceneCacheBenefitFrame = {
    action: 'capture' | 'hit';
    /** Static scene renders in this capture: 2 when cloud response is captured. */
    capturePasses?: number;
    staticSubmissions: number;
    staticTriangles: number;
};

type StaticOpaqueSceneCacheBenefitWindow = {
    captureGpuMs: number[];
    captures: number;
    gpuCaptures: number;
    gpuHits: number;
    hitGpuMs: number[];
    hits: number;
    liveGpuMs: number[];
    workUnits: number;
};

export type StaticOpaqueSceneCacheBenefitState = {
    consecutiveLosses: number;
    disabledUntilMs: number;
    evaluations: number;
    hitsSinceProbe: number;
    lastNetGpuMsPerFrame: number | null;
    lastNetWorkPerFrame: number | null;
    reason: StaticOpaqueSceneCacheBenefitReason;
    status: StaticOpaqueSceneCacheBenefitStatus;
    window: StaticOpaqueSceneCacheBenefitWindow;
    windowId: number;
};

function createWindow(): StaticOpaqueSceneCacheBenefitWindow {
    return {
        captureGpuMs: [],
        captures: 0,
        gpuCaptures: 0,
        gpuHits: 0,
        hitGpuMs: [],
        hits: 0,
        liveGpuMs: [],
        workUnits: 0,
    };
}

export function createStaticOpaqueSceneCacheBenefitState(): StaticOpaqueSceneCacheBenefitState {
    return {
        consecutiveLosses: 0,
        disabledUntilMs: 0,
        evaluations: 0,
        hitsSinceProbe: 0,
        lastNetGpuMsPerFrame: null,
        lastNetWorkPerFrame: null,
        reason: 'warming-up',
        status: 'probing',
        window: createWindow(),
        windowId: 0,
    };
}

function finiteNonNegative(value: number | undefined) {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, value)
        : 0;
}

function average(values: readonly number[]) {
    let total = 0;
    for (const value of values) {
        total += value;
    }
    return values.length > 0 ? total / values.length : 0;
}

/** Static work one live render would submit, in submission units. */
export function estimateStaticOpaqueSceneCacheWork({
    staticSubmissions,
    staticTriangles,
}: Pick<
    StaticOpaqueSceneCacheBenefitFrame,
    'staticSubmissions' | 'staticTriangles'
>) {
    return (
        finiteNonNegative(staticSubmissions) +
        finiteNonNegative(staticTriangles) / trianglesPerSubmission +
        fullScreenPassSubmissions
    );
}

/**
 * Net work a frame saves compared with rendering the static layers live.
 * A hit replaces the static render with the composite. A capture renders the
 * static layers once per capture pass and then composites.
 */
export function estimateStaticOpaqueSceneCacheFrameWorkSavings(
    frame: StaticOpaqueSceneCacheBenefitFrame,
) {
    const staticWork = estimateStaticOpaqueSceneCacheWork(frame);
    if (frame.action === 'hit') {
        return staticWork - compositeSubmissions;
    }
    const capturePasses = Math.max(
        1,
        Math.floor(finiteNonNegative(frame.capturePasses ?? 1)),
    );
    return -(staticWork * (capturePasses - 1) + compositeSubmissions);
}

export function isStaticOpaqueSceneCacheBenefitAllowed(
    state: StaticOpaqueSceneCacheBenefitState,
    nowMs: number,
) {
    return state.status !== 'disabled' || nowMs >= state.disabledUntilMs;
}

/** Returns a probing state once a disabled state's cooldown has elapsed. */
export function resumeStaticOpaqueSceneCacheBenefit(
    state: StaticOpaqueSceneCacheBenefitState,
    nowMs: number,
): StaticOpaqueSceneCacheBenefitState {
    if (state.status !== 'disabled' || nowMs < state.disabledUntilMs) {
        return state;
    }
    return {
        ...state,
        hitsSinceProbe: 0,
        reason: 'warming-up',
        status: 'probing',
        window: createWindow(),
        windowId: state.windowId + 1,
    };
}

/** True when this hit frame should render live to sample the live GPU cost. */
export function shouldProbeStaticOpaqueSceneCacheLive(
    state: StaticOpaqueSceneCacheBenefitState,
    gpuTimingAvailable: boolean,
) {
    if (!gpuTimingAvailable || state.status === 'disabled') {
        return false;
    }
    const interval =
        state.window.liveGpuMs.length <
        staticOpaqueSceneCacheBenefitMinimumGpuSamples
            ? staticOpaqueSceneCacheBenefitInitialProbeInterval
            : staticOpaqueSceneCacheBenefitProbeInterval;
    return state.hitsSinceProbe >= interval;
}

export function recordStaticOpaqueSceneCacheLiveProbe(
    state: StaticOpaqueSceneCacheBenefitState,
): StaticOpaqueSceneCacheBenefitState {
    return { ...state, hitsSinceProbe: 0 };
}

export function recordStaticOpaqueSceneCacheBenefitGpuSample(
    state: StaticOpaqueSceneCacheBenefitState,
    kind: StaticOpaqueSceneCacheBenefitSampleKind,
    elapsedMs: number,
    windowId = state.windowId,
): StaticOpaqueSceneCacheBenefitState {
    if (
        state.status === 'disabled' ||
        windowId !== state.windowId ||
        !Number.isFinite(elapsedMs) ||
        elapsedMs < 0
    ) {
        return state;
    }
    const key =
        kind === 'capture'
            ? 'captureGpuMs'
            : kind === 'hit'
              ? 'hitGpuMs'
              : 'liveGpuMs';
    return {
        ...state,
        window: {
            ...state.window,
            [key]: [...state.window[key], elapsedMs].slice(
                -staticOpaqueSceneCacheBenefitWindowFrames,
            ),
        },
    };
}

/** Drop query evidence after disjoint/context changes without extending the probe. */
export function invalidateStaticOpaqueSceneCacheBenefitGpuSamples(
    state: StaticOpaqueSceneCacheBenefitState,
): StaticOpaqueSceneCacheBenefitState {
    if (state.status === 'disabled') {
        return state;
    }
    return {
        ...state,
        lastNetGpuMsPerFrame: null,
        reason: 'warming-up',
        status: 'probing',
        window: {
            ...state.window,
            captureGpuMs: [],
            gpuCaptures: 0,
            gpuHits: 0,
            hitGpuMs: [],
            liveGpuMs: [],
        },
        windowId: state.windowId + 1,
    };
}

function resolveNetGpuMs(window: StaticOpaqueSceneCacheBenefitWindow) {
    if (
        window.liveGpuMs.length <
            staticOpaqueSceneCacheBenefitMinimumGpuSamples ||
        window.hitGpuMs.length <
            staticOpaqueSceneCacheBenefitMinimumGpuSamples ||
        (window.gpuCaptures > 0 && window.captureGpuMs.length === 0)
    ) {
        return null;
    }
    const liveMs = average(window.liveGpuMs);
    const hitMs = average(window.hitGpuMs);
    const captureMs =
        window.gpuCaptures > 0 ? average(window.captureGpuMs) : liveMs;
    return (
        window.gpuHits * (liveMs - hitMs) -
        window.gpuCaptures * (captureMs - liveMs)
    );
}

export function recordStaticOpaqueSceneCacheBenefitFrame(
    state: StaticOpaqueSceneCacheBenefitState,
    frame: StaticOpaqueSceneCacheBenefitFrame,
    nowMs: number,
): StaticOpaqueSceneCacheBenefitState {
    if (state.status === 'disabled') {
        return state;
    }

    const window: StaticOpaqueSceneCacheBenefitWindow = {
        ...state.window,
        captures: state.window.captures + (frame.action === 'capture' ? 1 : 0),
        hits: state.window.hits + (frame.action === 'hit' ? 1 : 0),
        gpuCaptures:
            state.window.gpuCaptures + (frame.action === 'capture' ? 1 : 0),
        gpuHits: state.window.gpuHits + (frame.action === 'hit' ? 1 : 0),
        workUnits:
            state.window.workUnits +
            estimateStaticOpaqueSceneCacheFrameWorkSavings(frame),
    };
    const next: StaticOpaqueSceneCacheBenefitState = {
        ...state,
        hitsSinceProbe: frame.action === 'hit' ? state.hitsSinceProbe + 1 : 0,
        window,
    };
    const frames = window.hits + window.captures;
    if (
        frames < staticOpaqueSceneCacheBenefitWindowFrames &&
        window.captures < staticOpaqueSceneCacheBenefitWindowCaptures
    ) {
        return next;
    }

    const netGpuMs = resolveNetGpuMs(window);
    const profitable = netGpuMs !== null && netGpuMs > 0;
    const evaluated = {
        ...next,
        evaluations: state.evaluations + 1,
        lastNetGpuMsPerFrame:
            netGpuMs === null
                ? null
                : netGpuMs / Math.max(1, window.gpuCaptures + window.gpuHits),
        lastNetWorkPerFrame: window.workUnits / frames,
        window: createWindow(),
        windowId: state.windowId + 1,
    };
    if (profitable) {
        return {
            ...evaluated,
            consecutiveLosses: 0,
            reason: 'gpu-savings',
            status: 'enabled',
        };
    }

    const consecutiveLosses = state.consecutiveLosses + 1;
    return {
        ...evaluated,
        consecutiveLosses,
        disabledUntilMs:
            nowMs +
            Math.min(
                staticOpaqueSceneCacheBenefitMaximumCooldownMs,
                staticOpaqueSceneCacheBenefitCooldownMs *
                    2 ** (consecutiveLosses - 1),
            ),
        hitsSinceProbe: 0,
        reason:
            netGpuMs !== null
                ? 'gpu-cost'
                : window.workUnits <= 0
                  ? 'work-cost'
                  : 'gpu-unavailable',
        status: 'disabled',
    };
}
