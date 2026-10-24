import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createStaticOpaqueSceneCacheBenefitState,
    invalidateStaticOpaqueSceneCacheBenefitGpuSamples,
    recordStaticOpaqueSceneCacheBenefitFrame,
    recordStaticOpaqueSceneCacheBenefitGpuSample,
    restartStaticOpaqueSceneCacheBenefit,
    shouldProbeStaticOpaqueSceneCacheLive,
    staticOpaqueSceneCacheBenefitWindowFrames,
} from './staticOpaqueSceneCacheBenefit';
import {
    buildStaticOpaqueSceneCacheObservedLiveMetadata,
    renderStaticOpaqueSceneCacheFrame,
    staticOpaqueSceneCacheObserverWindowId,
} from './staticOpaqueSceneCacheFrame';
import type { StaticOpaqueSceneCacheGpuSample } from './staticOpaqueSceneCacheGpuTimer';

function drawFrame({
    enabled,
    observed = true,
    queryAvailable = true,
    throwRender = false,
}: {
    enabled: boolean;
    observed?: boolean;
    queryAvailable?: boolean;
    throwRender?: boolean;
}) {
    const events: string[] = [];
    const samples: StaticOpaqueSceneCacheGpuSample[] = [];
    const run = () =>
        renderStaticOpaqueSceneCacheFrame({
            enabled,
            nowMs: 100,
            gpuTimer: {
                evidenceEpoch: 3,
                poll: (nowMs) => {
                    assert.equal(nowMs, 100);
                    events.push('poll');
                    return samples;
                },
                isProfileObserved: () => observed,
                begin: (kind, nowMs, windowId) => {
                    assert.equal(kind, 'live');
                    assert.equal(nowMs, 100);
                    assert.equal(
                        windowId,
                        staticOpaqueSceneCacheObserverWindowId,
                    );
                    events.push(queryAvailable ? 'begin' : 'unavailable');
                    return queryAvailable;
                },
                end: () => {
                    events.push('end');
                },
            },
            consumeGpuSamples: (actual, epoch) => {
                assert.equal(actual, samples);
                assert.equal(epoch, 3);
                events.push('consume');
            },
            prepareLive: () => {
                events.push('release-targets');
            },
            renderLive: () => {
                events.push('render-live');
                if (throwRender) throw new Error('render failed');
            },
            publishLive: () => {
                events.push('publish');
            },
            renderCache: (nowMs) => {
                assert.equal(nowMs, 100);
                events.push(
                    'scan-registry',
                    'scan-lighting',
                    'scan-materials',
                    'render-cache',
                );
            },
        });
    return { events, run };
}

test('disabled legacy observer polls fairly and renders without any cache scene scans', () => {
    const legacy = drawFrame({ enabled: false });
    legacy.run();
    assert.deepEqual(legacy.events, [
        'poll',
        'consume',
        'release-targets',
        'begin',
        'render-live',
        'end',
        'publish',
    ]);
    const cached = drawFrame({ enabled: true });
    cached.run();
    assert.deepEqual(cached.events, [
        'poll',
        'consume',
        'scan-registry',
        'scan-lighting',
        'scan-materials',
        'render-cache',
    ]);
});

test('disabled live render never ends an unavailable or unobserved query', () => {
    for (const patch of [{ queryAvailable: false }, { observed: false }]) {
        const frame = drawFrame({ enabled: false, ...patch });
        frame.run();
        assert.equal(
            frame.events.filter((event) => event === 'render-live').length,
            1,
        );
        assert.equal(frame.events.includes('end'), false);
        assert.equal(frame.events.includes('scan-registry'), false);
        assert.equal(frame.events.at(-1), 'publish');
    }
});

test('a failed observed render closes only its own query before propagating failure', () => {
    const frame = drawFrame({ enabled: false, throwRender: true });
    assert.throws(frame.run, /render failed/);
    assert.equal(frame.events.at(-1), 'end');
    assert.equal(frame.events.includes('publish'), false);
});

function measuredWindow({
    liveMs,
    observerWindowId = staticOpaqueSceneCacheObserverWindowId,
}: {
    liveMs?: number;
    observerWindowId?: number;
}) {
    let state = createStaticOpaqueSceneCacheBenefitState();
    for (let index = 0; index < 3; index++) {
        // Cold, layer-change and shadow-refresh diagnostic renders are costly.
        for (const observerMs of [50, 75, 100])
            state = recordStaticOpaqueSceneCacheBenefitGpuSample(
                state,
                'live',
                observerMs,
                observerWindowId,
            );
        if (liveMs !== undefined)
            state = recordStaticOpaqueSceneCacheBenefitGpuSample(
                state,
                'live',
                liveMs,
                state.windowId,
            );
        state = recordStaticOpaqueSceneCacheBenefitGpuSample(
            state,
            'hit',
            2,
            state.windowId,
        );
    }
    state = recordStaticOpaqueSceneCacheBenefitGpuSample(
        state,
        'capture',
        5,
        state.windowId,
    );
    return state;
}

function evaluateWindow(
    state: ReturnType<typeof createStaticOpaqueSceneCacheBenefitState>,
) {
    for (
        let index = 0;
        index < staticOpaqueSceneCacheBenefitWindowFrames;
        index++
    )
        state = recordStaticOpaqueSceneCacheBenefitFrame(
            state,
            {
                action: index === 0 ? 'capture' : 'hit',
                capturePasses: index === 0 ? 2 : undefined,
                staticSubmissions: 40,
                staticTriangles: 80_000,
            },
            100,
        );
    return state;
}

test('cold, layer and shadow observer timings cannot admit caching or advance the probe cadence', () => {
    const state = measuredWindow({});
    assert.deepEqual(state.window.liveGpuMs, []);
    assert.equal(
        shouldProbeStaticOpaqueSceneCacheLive(
            { ...state, hitsSinceProbe: 4 },
            true,
        ),
        true,
    );
    const result = evaluateWindow(state);
    assert.equal(result.status, 'disabled');
    assert.equal(result.reason, 'gpu-unavailable');
});

test('genuine same-scene probes can admit measured savings with the same observer present', () => {
    const result = evaluateWindow(measuredWindow({ liveMs: 10 }));
    assert.equal(result.status, 'enabled');
    assert.equal(result.reason, 'gpu-savings');
});

test('costly observer frames cannot turn genuine measured GPU loss into savings', () => {
    const fixed = evaluateWindow(measuredWindow({ liveMs: 1 }));
    assert.equal(fixed.status, 'disabled');
    assert.equal(fixed.reason, 'gpu-cost');
    // This recreates the rejected current-window tagging counterexample.
    const contaminated = evaluateWindow(
        measuredWindow({ liveMs: 1, observerWindowId: 0 }),
    );
    assert.equal(contaminated.status, 'enabled');
});

test('disable and re-enable keep a monotonic generation that rejects pending old queries', () => {
    const beforeDisable = invalidateStaticOpaqueSceneCacheBenefitGpuSamples(
        createStaticOpaqueSceneCacheBenefitState(),
    );
    const oldQueryWindow = beforeDisable.windowId;
    const restarted = restartStaticOpaqueSceneCacheBenefit(beforeDisable);
    const reenabled =
        invalidateStaticOpaqueSceneCacheBenefitGpuSamples(restarted);
    assert.ok(restarted.windowId > oldQueryWindow);
    assert.ok(reenabled.windowId > restarted.windowId);
    const late = recordStaticOpaqueSceneCacheBenefitGpuSample(
        reenabled,
        'live',
        100,
        oldQueryWindow,
    );
    assert.equal(late, reenabled);
    assert.deepEqual(late.window.liveGpuMs, []);
    // A reset to zero recreates the old first-invalidation query collision.
    const reused = invalidateStaticOpaqueSceneCacheBenefitGpuSamples(
        createStaticOpaqueSceneCacheBenefitState(),
    );
    assert.equal(reused.windowId, oldQueryWindow);
    assert.deepEqual(
        recordStaticOpaqueSceneCacheBenefitGpuSample(
            reused,
            'live',
            100,
            oldQueryWindow,
        ).window.liveGpuMs,
        [100],
    );
    // Observer samples remain excluded after either a reset or invalidation.
    assert.equal(
        recordStaticOpaqueSceneCacheBenefitGpuSample(
            reenabled,
            'live',
            100,
            staticOpaqueSceneCacheObserverWindowId,
        ),
        reenabled,
    );
});

test('a same-mount live receipt clears stale enabled decisions and replay metadata', () => {
    const previous = {
        staticOpaqueSceneCacheEnabled: true,
        staticOpaqueSceneCacheState: 'ready',
        staticOpaqueSceneCacheSupported: true,
        staticOpaqueSceneCacheBenefitStatus: 'enabled',
        staticOpaqueSceneCacheBenefitReason: 'gpu-savings',
        staticOpaqueSceneCacheBenefitNetGpuMsPerFrame: 12,
        staticOpaqueSceneCacheAllocatedTargetBytes: 40_000_000,
        staticOpaqueSceneCacheReplayStatus: 'ready',
        staticOpaqueSceneCacheBaseTerrainLayer: 'cached',
        staticOpaqueSceneCacheStaticPropsLayer: 'cached',
        staticOpaqueSceneCacheTargetWidth: 1280,
        staticOpaqueSceneCacheTargetHeight: 720,
    };
    const live = {
        ...previous,
        ...buildStaticOpaqueSceneCacheObservedLiveMetadata({
            staticOpaqueSceneCacheBudgetBytes: 80_000_000,
            staticOpaqueSceneCacheBudgetSource: 'device-memory',
            staticOpaqueSceneCacheGpuSampleCount: 20,
            staticOpaqueSceneCacheGpuTimingSupported: true,
            staticOpaqueSceneCacheLiveFrameCount: 4,
            staticOpaqueSceneCachePeakTargetBytes: 40_000_000,
        }),
    };
    assert.equal(live.staticOpaqueSceneCacheEnabled, false);
    assert.equal(live.staticOpaqueSceneCacheState, 'disabled');
    assert.equal(live.staticOpaqueSceneCacheSupported, false);
    assert.equal(live.staticOpaqueSceneCacheBenefitStatus, 'disabled');
    assert.equal(live.staticOpaqueSceneCacheBenefitReason, 'disabled');
    assert.equal(live.staticOpaqueSceneCacheBenefitNetGpuMsPerFrame, null);
    assert.equal(live.staticOpaqueSceneCacheReplayStatus, 'disabled');
    assert.equal(live.staticOpaqueSceneCacheBaseTerrainLayer, 'live');
    assert.equal(live.staticOpaqueSceneCacheStaticPropsLayer, 'live');
    assert.equal(live.staticOpaqueSceneCacheAllocatedTargetBytes, 0);
    assert.equal(live.staticOpaqueSceneCacheTargetWidth, 0);
    assert.equal(live.staticOpaqueSceneCacheTargetHeight, 0);
    assert.equal(live.staticOpaqueSceneCacheGpuSampleCount, 20);
    assert.equal(live.staticOpaqueSceneCacheGpuTimingSupported, true);
    assert.equal(live.staticOpaqueSceneCacheLiveFrameCount, 4);
    assert.equal(live.staticOpaqueSceneCachePeakTargetBytes, 40_000_000);
});
