import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createStaticOpaqueSceneCacheBenefitState,
    estimateStaticOpaqueSceneCacheFrameWorkSavings,
    invalidateStaticOpaqueSceneCacheBenefitGpuSamples,
    isStaticOpaqueSceneCacheBenefitAllowed,
    recordStaticOpaqueSceneCacheBenefitFrame,
    recordStaticOpaqueSceneCacheBenefitGpuSample,
    recordStaticOpaqueSceneCacheLiveProbe,
    resumeStaticOpaqueSceneCacheBenefit,
    type StaticOpaqueSceneCacheBenefitFrame,
    type StaticOpaqueSceneCacheBenefitState,
    shouldProbeStaticOpaqueSceneCacheLive,
    staticOpaqueSceneCacheBenefitCooldownMs,
    staticOpaqueSceneCacheBenefitMaximumCooldownMs,
    staticOpaqueSceneCacheBenefitWindowCaptures,
    staticOpaqueSceneCacheBenefitWindowFrames,
} from './staticOpaqueSceneCacheBenefit';

const capture = {
    action: 'capture',
    capturePasses: 2,
    staticSubmissions: 40,
    staticTriangles: 80_000,
} satisfies StaticOpaqueSceneCacheBenefitFrame;
const hit = {
    action: 'hit',
    staticSubmissions: 40,
    staticTriangles: 80_000,
} satisfies StaticOpaqueSceneCacheBenefitFrame;

function record(
    state: StaticOpaqueSceneCacheBenefitState,
    frames: readonly StaticOpaqueSceneCacheBenefitFrame[],
    nowMs = 0,
) {
    let next = state;
    for (const frame of frames) {
        next = recordStaticOpaqueSceneCacheBenefitFrame(next, frame, nowMs);
    }
    return next;
}

function repeat<T>(value: T, count: number) {
    return Array.from({ length: count }, () => value);
}

function withGpuSamples(
    state: StaticOpaqueSceneCacheBenefitState,
    samples: { capture?: number; hit: number; live: number },
) {
    let next = state;
    for (let index = 0; index < 3; index += 1) {
        next = recordStaticOpaqueSceneCacheBenefitGpuSample(
            next,
            'live',
            samples.live,
        );
        next = recordStaticOpaqueSceneCacheBenefitGpuSample(
            next,
            'hit',
            samples.hit,
        );
    }
    if (samples.capture !== undefined) {
        next = recordStaticOpaqueSceneCacheBenefitGpuSample(
            next,
            'capture',
            samples.capture,
        );
    }
    return next;
}

describe('static opaque scene cache work model', () => {
    it('credits hits and charges captures against live rendering', () => {
        // 40 submissions + 8 triangle units + 2 full-screen units.
        assert.equal(estimateStaticOpaqueSceneCacheFrameWorkSavings(hit), 48);
        assert.equal(
            estimateStaticOpaqueSceneCacheFrameWorkSavings(capture),
            -52,
        );
        assert.equal(
            estimateStaticOpaqueSceneCacheFrameWorkSavings({
                ...capture,
                capturePasses: 1,
            }),
            -2,
        );
        assert.equal(
            estimateStaticOpaqueSceneCacheFrameWorkSavings({
                action: 'hit',
                staticSubmissions: 0,
                staticTriangles: 0,
            }),
            0,
        );
    });
});

describe('static opaque scene cache benefit gate', () => {
    it('keeps probing until a full window is observed', () => {
        const state = record(createStaticOpaqueSceneCacheBenefitState(), [
            capture,
            ...repeat(hit, 10),
        ]);
        assert.equal(state.status, 'probing');
        assert.equal(state.reason, 'warming-up');
        assert.equal(state.evaluations, 0);
    });

    it('ends the bounded probe without measured GPU clearance', () => {
        const state = record(createStaticOpaqueSceneCacheBenefitState(), [
            capture,
            ...repeat(hit, staticOpaqueSceneCacheBenefitWindowFrames - 1),
        ]);
        assert.equal(state.status, 'disabled');
        assert.equal(state.reason, 'gpu-unavailable');
        assert.equal(state.evaluations, 1);
        assert.ok((state.lastNetWorkPerFrame ?? 0) > 0);
        assert.equal(state.lastNetGpuMsPerFrame, null);
    });

    it('disables capture churn early and releases it after a cooldown', () => {
        const state = record(
            createStaticOpaqueSceneCacheBenefitState(),
            repeat(capture, staticOpaqueSceneCacheBenefitWindowCaptures),
            1_000,
        );
        assert.equal(state.status, 'disabled');
        assert.equal(state.reason, 'work-cost');
        assert.equal(
            state.disabledUntilMs,
            1_000 + staticOpaqueSceneCacheBenefitCooldownMs,
        );
        assert.equal(
            isStaticOpaqueSceneCacheBenefitAllowed(state, 1_000),
            false,
        );
        assert.equal(resumeStaticOpaqueSceneCacheBenefit(state, 2_000), state);
        assert.equal(
            record(state, [hit], 2_000),
            state,
            'disabled gates ignore frames',
        );

        const resumed = resumeStaticOpaqueSceneCacheBenefit(
            state,
            state.disabledUntilMs,
        );
        assert.equal(resumed.status, 'probing');
        assert.equal(resumed.consecutiveLosses, 1);
        assert.equal(
            isStaticOpaqueSceneCacheBenefitAllowed(
                resumed,
                state.disabledUntilMs,
            ),
            true,
        );
    });

    it('doubles the cooldown for consecutive losses up to a cap', () => {
        let state = createStaticOpaqueSceneCacheBenefitState();
        const cooldowns: number[] = [];
        let nowMs = 0;
        for (let loss = 0; loss < 6; loss += 1) {
            state = record(
                state,
                repeat(capture, staticOpaqueSceneCacheBenefitWindowCaptures),
                nowMs,
            );
            cooldowns.push(state.disabledUntilMs - nowMs);
            nowMs = state.disabledUntilMs;
            state = resumeStaticOpaqueSceneCacheBenefit(state, nowMs);
        }
        assert.deepEqual(cooldowns, [
            30_000,
            60_000,
            120_000,
            240_000,
            staticOpaqueSceneCacheBenefitMaximumCooldownMs,
            staticOpaqueSceneCacheBenefitMaximumCooldownMs,
        ]);

        const recovered = record(
            withGpuSamples(state, { capture: 6, hit: 2, live: 4 }),
            [
                capture,
                ...repeat(hit, staticOpaqueSceneCacheBenefitWindowFrames - 1),
            ],
        );
        assert.equal(recovered.status, 'enabled');
        assert.equal(recovered.consecutiveLosses, 0);
    });

    it('prefers measured GPU time over the work model', () => {
        const frames = [
            capture,
            ...repeat(hit, staticOpaqueSceneCacheBenefitWindowFrames - 1),
        ];
        const saving = record(
            withGpuSamples(createStaticOpaqueSceneCacheBenefitState(), {
                capture: 6,
                hit: 2,
                live: 4,
            }),
            frames,
        );
        assert.equal(saving.status, 'enabled');
        assert.equal(saving.reason, 'gpu-savings');
        // (59 hits * 2 ms - 1 capture * 2 ms) / 60 frames.
        assert.ok(
            Math.abs((saving.lastNetGpuMsPerFrame ?? 0) - 116 / 60) < 1e-9,
        );

        const losing = record(
            withGpuSamples(createStaticOpaqueSceneCacheBenefitState(), {
                capture: 6,
                hit: 4.5,
                live: 4,
            }),
            frames,
        );
        assert.equal(losing.status, 'disabled');
        assert.equal(losing.reason, 'gpu-cost');
        assert.ok((losing.lastNetWorkPerFrame ?? 0) > 0);
    });

    it('rejects incomplete GPU evidence even with positive modeled savings', () => {
        const state = record(
            withGpuSamples(createStaticOpaqueSceneCacheBenefitState(), {
                hit: 4.5,
                live: 4,
            }),
            [
                capture,
                ...repeat(hit, staticOpaqueSceneCacheBenefitWindowFrames - 1),
            ],
        );
        assert.equal(state.reason, 'gpu-unavailable');
        assert.equal(state.status, 'disabled');
    });

    it('ignores late samples from an earlier evaluation window', () => {
        const state = record(
            withGpuSamples(createStaticOpaqueSceneCacheBenefitState(), {
                capture: 6,
                hit: 2,
                live: 4,
            }),
            [
                capture,
                ...repeat(hit, staticOpaqueSceneCacheBenefitWindowFrames - 1),
            ],
        );
        assert.equal(state.windowId, 1);
        assert.equal(
            recordStaticOpaqueSceneCacheBenefitGpuSample(
                state,
                'capture',
                1,
                0,
            ),
            state,
        );
        assert.equal(
            recordStaticOpaqueSceneCacheBenefitGpuSample(state, 'hit', 1, 1)
                .window.hitGpuMs.length,
            1,
        );
    });

    it('disjoint invalidation drops measured evidence without extending the probe', () => {
        const before = record(
            withGpuSamples(createStaticOpaqueSceneCacheBenefitState(), {
                capture: 6,
                hit: 2,
                live: 4,
            }),
            [capture, ...repeat(hit, 58)],
        );
        const state = invalidateStaticOpaqueSceneCacheBenefitGpuSamples(before);
        assert.equal(state.window.hits, 58);
        assert.equal(state.window.liveGpuMs.length, 0);
        assert.equal(state.window.gpuHits, 0);
        assert.equal(state.windowId, before.windowId + 1);
        assert.equal(record(state, [hit]).reason, 'gpu-unavailable');
    });

    it('does not amortize a changed scene capture against old scene hits', () => {
        let state = record(createStaticOpaqueSceneCacheBenefitState(), [
            capture,
            ...repeat(hit, 58),
        ]);
        state = invalidateStaticOpaqueSceneCacheBenefitGpuSamples(state);
        state = withGpuSamples(state, { capture: 10, hit: 2, live: 4 });
        state = record(state, [capture]);
        assert.equal(state.status, 'disabled');
        assert.equal(state.reason, 'gpu-cost');
        assert.equal(state.lastNetGpuMsPerFrame, -6);
    });

    it('bounds samples even while a render cannot record a cache frame', () => {
        let state = createStaticOpaqueSceneCacheBenefitState();
        for (let index = 0; index < 1_000; index += 1) {
            state = recordStaticOpaqueSceneCacheBenefitGpuSample(
                state,
                'live',
                1,
            );
        }
        assert.equal(
            state.window.liveGpuMs.length,
            staticOpaqueSceneCacheBenefitWindowFrames,
        );
    });

    it('ignores invalid GPU samples', () => {
        const state = createStaticOpaqueSceneCacheBenefitState();
        assert.equal(
            recordStaticOpaqueSceneCacheBenefitGpuSample(state, 'hit', -1),
            state,
        );
        assert.equal(
            recordStaticOpaqueSceneCacheBenefitGpuSample(
                state,
                'hit',
                Number.NaN,
            ),
            state,
        );
    });

    it('schedules live probes only with GPU timing', () => {
        let state = record(createStaticOpaqueSceneCacheBenefitState(), [
            capture,
            ...repeat(hit, 4),
        ]);
        assert.equal(
            shouldProbeStaticOpaqueSceneCacheLive(state, false),
            false,
        );
        assert.equal(shouldProbeStaticOpaqueSceneCacheLive(state, true), true);

        state = recordStaticOpaqueSceneCacheLiveProbe(state);
        assert.equal(shouldProbeStaticOpaqueSceneCacheLive(state, true), false);

        state = withGpuSamples(state, { hit: 2, live: 4 });
        state = record(state, repeat(hit, 4));
        assert.equal(
            shouldProbeStaticOpaqueSceneCacheLive(state, true),
            false,
            'enough live samples switch to the slower probe interval',
        );
        state = record(state, repeat(hit, 26));
        assert.equal(shouldProbeStaticOpaqueSceneCacheLive(state, true), true);

        state = record(state, [capture]);
        assert.equal(
            shouldProbeStaticOpaqueSceneCacheLive(state, true),
            false,
            'a capture restarts the hit streak',
        );
    });
});
