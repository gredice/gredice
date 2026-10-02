import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildStaticCacheClearanceScenarioSets,
    classifyStaticCacheWitness,
    evaluateStaticCacheClearance,
    installStaticCacheGpuMetrics,
    staticCacheClearanceMinimumSoakMs,
} from './static-cache-clearance.mjs';

const profiles = [
    {
        quality: 'low',
        tier: 'low',
        slug: 'low',
        dprCap: 1,
        shadows: false,
        shadowMapSize: 0,
    },
    {
        quality: 'medium',
        tier: 'medium',
        slug: 'medium',
        dprCap: 1.5,
        shadows: true,
        shadowMapSize: 2048,
    },
    {
        quality: 'high',
        tier: 'high',
        slug: 'high',
        dprCap: 2,
        shadows: true,
        shadowMapSize: 4096,
    },
    {
        quality: 'auto',
        tier: 'medium',
        slug: 'auto-standard',
        dprCap: 1.5,
        shadows: true,
        shadowMapSize: 2048,
        autoQualityDeviceClass: 'standard',
        navigatorMetrics: { deviceMemory: 8, hardwareConcurrency: 8 },
    },
    {
        quality: 'auto',
        tier: 'auto-constrained',
        slug: 'auto-constrained',
        dprCap: 1,
        shadows: true,
        shadowMapSize: 1024,
        autoQualityDeviceClass: 'constrained',
        navigatorMetrics: { deviceMemory: 4, hardwareConcurrency: 4 },
    },
];
const sets = buildStaticCacheClearanceScenarioSets(profiles);
const measured = {
    staticOpaqueSceneCacheEnabled: true,
    staticOpaqueSceneCacheSupported: true,
    staticOpaqueSceneCacheState: 'ready',
    staticOpaqueSceneCacheBenefitStatus: 'enabled',
    staticOpaqueSceneCacheBenefitReason: 'gpu-savings',
    staticOpaqueSceneCacheBenefitNetGpuMsPerFrame: 1,
    staticOpaqueSceneCacheReplayStatus: 'ready',
    staticOpaqueSceneCacheBudgetBytes: 80 * 1024 * 1024,
    staticOpaqueSceneCacheAllocatedTargetBytes: 20 * 1024 * 1024,
    staticOpaqueSceneCachePeakTargetBytes: 20 * 1024 * 1024,
    staticOpaqueSceneCacheReplayEstimatedBytes: 36,
    resourceMeasurementMode:
        'population-exposure-post-render-resource-snapshot-v1',
    resourceMeasurementValid: true,
    rendererShaders: 10,
    rendererTextures: 20,
    rendererGeometries: 30,
};
function fixture(overrides = {}) {
    return {
        requested: {
            expectedQualityTier: 'high',
            expectedDprCap: 2,
            expectedShadows: true,
            expectedShadowMapSize: 4096,
        },
        runtime: {
            a: 1,
            b: 1,
            c: 1,
            d: 1,
            e: 1,
            f: 1,
            g: 1,
            qualityTier: 'high',
            dprCap: 2,
            shadowsEnabled: true,
            shadowMapSize: 4096,
        },
        screenshotValid: true,
        fixtureExpected: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
        sample: {
            renderedFrames: 100,
            gpu: { valid: true, measurementMode: 'cache-owned-render-pass-v1' },
        },
        evidence: { witnesses: [{ ...measured }, { ...measured }], soakMs: 0 },
        ...overrides,
    };
}

test('supplement covers all canonical resolved tiers without mutating their profiles', () => {
    const before = structuredClone(profiles);
    const all = sets['static-cache-clearance'];
    assert.deepEqual(profiles, before);
    assert.equal(
        new Set(all.map((scenario) => scenario.name)).size,
        all.length,
    );
    for (const profile of profiles) {
        const scenarios = all.filter(
            (scenario) =>
                scenario.expectedQualitySetting === profile.quality &&
                scenario.expectedQualityTier === profile.tier &&
                scenario.autoQualityDeviceClass ===
                    profile.autoQualityDeviceClass,
        );
        assert.equal(scenarios.length, 12);
        assert.ok(
            scenarios.every(
                (scenario) =>
                    scenario.expectedDprCap === profile.dprCap &&
                    scenario.staticCacheClearance === true &&
                    scenario.externalGpuTimer === false,
            ),
        );
    }
});

test('every visual pair has five deterministic legacy/cache runs with the same fixture', () => {
    const pairs = Map.groupBy(
        sets['static-cache-visuals'],
        (scenario) => scenario.comparisonPair,
    );
    assert.equal(pairs.size, 20);
    for (const scenarios of pairs.values()) {
        assert.deepEqual(
            scenarios.map((scenario) => scenario.comparisonRole),
            ['legacy', 'cache'],
        );
        const [legacy, cache] = scenarios;
        assert.equal(
            legacy.path.replace(
                'staticSceneCache=legacy',
                'staticSceneCache=cache',
            ),
            cache.path,
        );
        assert.equal(legacy.repeat, 5);
        assert.equal(cache.repeat, 5);
        assert.equal(cache.fixedTimeSeconds, 43200);
        assert.equal(cache.staticSceneCacheVisualDeterministic, true);
    }
});

test('supplement reuses depth/lifecycle fixtures and requires an explicit soak', () => {
    assert.equal(sets['static-cache-depth'].length, 5);
    assert.ok(
        sets['static-cache-depth'].every((scenario) =>
            scenario.path.includes('staticSceneCacheOcclusionFixture=1'),
        ),
    );
    assert.ok(
        sets['static-cache-lifecycle'].every(
            (scenario) =>
                scenario.lifecycleProfile === true &&
                scenario.path.includes('lifecycle=1'),
        ),
    );
    assert.equal(sets['static-cache-soak'].length, 5);
    assert.equal(staticCacheClearanceMinimumSoakMs, 60_000);
});

test('modeled work, missing GPU data and a temporary probe cannot establish clearance', () => {
    assert.equal(classifyStaticCacheWitness(measured), 'measured-caching');
    assert.equal(
        classifyStaticCacheWitness({
            ...measured,
            staticOpaqueSceneCacheBenefitReason: 'work-savings',
            staticOpaqueSceneCacheBenefitNetGpuMsPerFrame: null,
        }),
        'inconclusive',
    );
    assert.equal(
        classifyStaticCacheWitness({
            ...measured,
            staticOpaqueSceneCacheBenefitStatus: 'probing',
        }),
        'inconclusive',
    );
    assert.equal(
        classifyStaticCacheWitness({
            ...measured,
            staticOpaqueSceneCacheBenefitNetGpuMsPerFrame: Number.NaN,
        }),
        'inconclusive',
    );
});

test('measured admission still needs a valid same-owner GPU sample window', () => {
    assert.equal(evaluateStaticCacheClearance(fixture()).pass, true);
    assert.equal(
        evaluateStaticCacheClearance(
            fixture({ sample: { renderedFrames: 100, gpu: { valid: false } } }),
        ).pass,
        false,
    );
    assert.equal(
        evaluateStaticCacheClearance(
            fixture({
                sample: {
                    renderedFrames: 100,
                    gpu: {
                        valid: true,
                        measurementMode: 'external-render-pass-v1',
                    },
                },
            }),
        ).pass,
        false,
    );
    assert.equal(
        evaluateStaticCacheClearance(fixture()).measuredGpuSavingsClaimed,
        false,
    );
});

test('supported no-op must release the probe targets', () => {
    const noOp = {
        ...measured,
        staticOpaqueSceneCacheBenefitStatus: 'disabled',
        staticOpaqueSceneCacheBenefitReason: 'gpu-unavailable',
        staticOpaqueSceneCacheAllocatedTargetBytes: 0,
    };
    const input = fixture({
        sample: { renderedFrames: 100, gpu: { valid: false } },
        evidence: { witnesses: [noOp, noOp] },
    });
    const accepted = evaluateStaticCacheClearance(input);
    assert.equal(accepted.outcome, 'live-no-op');
    assert.equal(accepted.pass, true);
    input.evidence.witnesses[1] = {
        ...noOp,
        staticOpaqueSceneCacheAllocatedTargetBytes: 1000,
    };
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});

test('current and peak resource bounds and fresh resource receipts are hard gates', () => {
    for (const patch of [
        { staticOpaqueSceneCacheAllocatedTargetBytes: 81 * 1024 * 1024 },
        { staticOpaqueSceneCachePeakTargetBytes: 81 * 1024 * 1024 },
        { resourceMeasurementValid: false },
        { resourceMeasurementMode: 'stale-metadata' },
    ]) {
        assert.equal(
            evaluateStaticCacheClearance(
                fixture({
                    evidence: {
                        witnesses: [measured, { ...measured, ...patch }],
                    },
                }),
            ).pass,
            false,
        );
    }
});

test('depth keeps canonical leak, match and verified-hit thresholds', () => {
    const depth = {
        ...measured,
        staticOpaqueSceneCacheOcclusionFixturePass: true,
        staticOpaqueSceneCacheOcclusionBackgroundWitnessMinimumMatchRatio: 0.96,
        staticOpaqueSceneCacheOcclusionOccluderMinimumMatchRatio: 0.96,
        staticOpaqueSceneCacheOcclusionForegroundMinimumMatchRatio: 0.96,
        staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio: 0.04,
        staticOpaqueSceneCacheOcclusionVerifiedHitFrameCount: 3,
    };
    const input = fixture({
        requested: { ...fixture().requested, staticCacheDepth: true },
        evidence: { witnesses: [depth, depth] },
        depthThresholds: {
            minimumMatchRatio: 0.96,
            maximumLeakRatio: 0.04,
            verifiedHitCount: 3,
        },
    });
    assert.equal(evaluateStaticCacheClearance(input).pass, true);
    input.evidence.witnesses[1] = {
        ...depth,
        staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio: 0.041,
    };
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});

test('soak needs a full duration, periodic witnesses and bounded resource growth', () => {
    const input = fixture({
        requested: { ...fixture().requested, staticCacheSoak: true },
        evidence: {
            witnesses: Array.from({ length: 4 }, () => ({ ...measured })),
            soakMs: 60_000,
        },
    });
    assert.equal(evaluateStaticCacheClearance(input).pass, true);
    input.evidence.soakMs = 59_999;
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
    input.evidence.soakMs = 60_000;
    input.evidence.witnesses[3].rendererTextures = 25;
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});

test('cache query observer preserves frame kind and excludes samples outside the window', async (t) => {
    const savedObserver = Object.getOwnPropertyDescriptor(
        globalThis,
        '__gameProfileCacheGpuObserver',
    );
    const savedTimer = Object.getOwnPropertyDescriptor(
        globalThis,
        '__gameProfileCacheGpuTimer',
    );
    t.after(() => {
        for (const [key, descriptor] of [
            ['__gameProfileCacheGpuObserver', savedObserver],
            ['__gameProfileCacheGpuTimer', savedTimer],
        ]) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    installStaticCacheGpuMetrics();
    const observer = globalThis.__gameProfileCacheGpuObserver;
    const timer = globalThis.__gameProfileCacheGpuTimer;
    observer({ type: 'supported', supported: true });
    observer({
        type: 'sample',
        sample: { elapsedMs: 100, kind: 'capture', startedAtMs: 0 },
    });
    timer.reset();
    const startedAtMs = performance.now();
    observer({ type: 'begin', startedAtMs });
    timer.stop();
    observer({
        type: 'sample',
        sample: { elapsedMs: 2, kind: 'live', startedAtMs },
    });
    await timer.finish();
    const result = timer.snapshot();
    assert.equal(result.valid, true);
    assert.equal(result.sampleCount, 1);
    assert.equal(result.elapsedP95Ms, 2);
    assert.deepEqual(result.kinds, { capture: 0, hit: 0, live: 1 });
    timer.reset();
    observer({ type: 'invalid', reason: 'disjoint' });
    await timer.finish();
    assert.equal(timer.snapshot().valid, false);
    assert.equal(timer.snapshot().disjoint, true);
});

test('blank screenshots and incomplete or drifting fixture populations fail closed', () => {
    assert.equal(
        evaluateStaticCacheClearance(fixture({ screenshotValid: false })).pass,
        false,
    );
    assert.equal(
        evaluateStaticCacheClearance(fixture({ fixtureExpected: undefined }))
            .pass,
        false,
    );
    const input = fixture();
    input.runtime.g = 0;
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});
