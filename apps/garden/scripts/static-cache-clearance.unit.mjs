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
    staticOpaqueSceneCacheBaseTerrainLayer: 'cached',
    staticOpaqueSceneCacheStaticPropsLayer: 'cached',
    sceneMode: 'details',
    sceneQuality: 'high',
    sceneStaticSceneCache: 'cache',
    weatherInputWitness: {
        mode: 'details',
        cacheEnabled: true,
        request: 'initial',
        revision: 0,
        weather: {
            cloudy: 0,
            foggy: 0,
            rainy: 0,
            snowy: 0,
            snowAccumulation: 0,
            temperature: null,
            source: null,
            isStale: null,
        },
    },
    weatherDisabled: false,
    cloudVisualCount: 0,
    rainParticleCount: 0,
    snowParticleCount: 0,
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
            mode: 'details',
            quality: 'high',
            expectedQualitySetting: 'high',
            staticSceneCache: 'cache',
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
        staticOpaqueSceneCacheBaseTerrainLayer: 'live',
        staticOpaqueSceneCacheStaticPropsLayer: 'live',
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

test('every cache-requested row rejects legacy runtime decisions including earlier witnesses', () => {
    const legacy = {
        ...measured,
        staticOpaqueSceneCacheEnabled: false,
        staticOpaqueSceneCacheAllocatedTargetBytes: 0,
        sceneStaticSceneCache: 'legacy',
        weatherInputWitness: {
            ...measured.weatherInputWitness,
            cacheEnabled: false,
        },
    };
    for (const row of [
        {},
        { staticCacheDepth: true },
        { lifecycleProfile: true },
        { staticCacheLayers: true },
        { staticCacheSoak: true },
    ]) {
        const input = fixture({
            requested: { ...fixture().requested, ...row },
            evidence: { witnesses: [legacy, legacy], soakMs: 60_000 },
        });
        const result = evaluateStaticCacheClearance(input);
        assert.equal(result.pass, false);
        assert.equal(
            result.checks.find(
                (check) => check.name === 'cacheClearanceResolvedDecision',
            ).pass,
            false,
        );
    }
    assert.equal(
        evaluateStaticCacheClearance(
            fixture({
                evidence: { witnesses: [legacy, measured] },
            }),
        ).pass,
        false,
    );
    assert.equal(
        evaluateStaticCacheClearance(
            fixture({
                requested: {
                    ...fixture().requested,
                    staticSceneCache: 'legacy',
                    comparisonRole: 'legacy',
                },
                evidence: { witnesses: [legacy, legacy] },
                sample: { renderedFrames: 100, gpu: { valid: false } },
            }),
        ).pass,
        true,
    );
    assert.equal(
        evaluateStaticCacheClearance(
            fixture({
                requested: { ...fixture().requested, comparisonRole: 'legacy' },
            }),
        ).pass,
        false,
    );
});

test('missing enablement and fabricated no-op reasons remain inconclusive', () => {
    for (const patch of [
        {
            staticOpaqueSceneCacheEnabled: undefined,
            staticOpaqueSceneCacheSupported: false,
        },
        {
            staticOpaqueSceneCacheBenefitStatus: 'disabled',
            staticOpaqueSceneCacheBenefitReason: 'disabled',
        },
        {
            staticOpaqueSceneCacheSupported: false,
            staticOpaqueSceneCacheBenefitReason: 'warming-up',
            staticOpaqueSceneCacheReason: 'ready',
        },
    ]) {
        const witness = { ...measured, ...patch };
        assert.equal(classifyStaticCacheWitness(witness), 'inconclusive');
        assert.equal(
            evaluateStaticCacheClearance(
                fixture({ evidence: { witnesses: [witness, witness] } }),
            ).pass,
            false,
        );
    }
});

test('positive admission before a final fallback still requires a valid measured window', () => {
    const noOp = {
        ...measured,
        staticOpaqueSceneCacheBenefitStatus: 'disabled',
        staticOpaqueSceneCacheBenefitReason: 'gpu-cost',
        staticOpaqueSceneCacheAllocatedTargetBytes: 0,
        staticOpaqueSceneCacheBaseTerrainLayer: 'live',
        staticOpaqueSceneCacheStaticPropsLayer: 'live',
    };
    const input = fixture({ evidence: { witnesses: [measured, noOp] } });
    assert.equal(evaluateStaticCacheClearance(input).pass, true);
    input.sample.gpu.valid = false;
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
    input.sample.gpu.valid = true;
    input.evidence.witnesses[0] = {
        ...measured,
        staticOpaqueSceneCacheReplayStatus: 'capturing',
    };
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});

test('weather visual modes need committed inputs and actual effects even with matching images', () => {
    const rain = {
        ...measured,
        sceneMode: 'rain',
        cloudVisualCount: 8,
        rainParticleCount: 100,
        weatherInputWitness: {
            ...measured.weatherInputWitness,
            mode: 'rain',
            weather: {
                ...measured.weatherInputWitness.weather,
                cloudy: 0.85,
                foggy: 0.12,
                rainy: 1,
            },
        },
    };
    const input = fixture({
        requested: { ...fixture().requested, mode: 'rain' },
        evidence: { witnesses: [rain, rain] },
    });
    assert.equal(evaluateStaticCacheClearance(input).pass, true);
    for (const patch of [
        { sceneMode: 'details' },
        { weatherInputWitness: measured.weatherInputWitness },
        { rainParticleCount: 0 },
        { cloudVisualCount: 0 },
        { weatherDisabled: true },
    ]) {
        assert.equal(
            evaluateStaticCacheClearance({
                ...input,
                evidence: { witnesses: [rain, { ...rain, ...patch }] },
            }).pass,
            false,
        );
    }
});

function layerFixture(
    tier = 'high',
    quality = tier === 'auto-constrained' ? 'auto' : tier,
) {
    const profile = profiles.find(
        (profile) => profile.tier === tier && profile.quality === quality,
    );
    const noOp = {
        ...measured,
        sceneMode: 'snow-onset',
        sceneQuality: quality,
        staticOpaqueSceneCacheBenefitStatus: 'disabled',
        staticOpaqueSceneCacheBenefitReason: 'gpu-unavailable',
        staticOpaqueSceneCacheAllocatedTargetBytes: 0,
        staticOpaqueSceneCacheBaseTerrainLayer: 'live',
        staticOpaqueSceneCacheStaticPropsLayer: 'live',
    };
    const clear = measured.weatherInputWitness.weather;
    const phaseWeather = [
        ['snow-sparse-to-integrated', { ...clear, snowAccumulation: 24 }],
        ['snow-integrated-to-sparse', { ...clear, snowAccumulation: 0.75 }],
        ['clear-to-cloudy', { ...clear, cloudy: 0.85, foggy: 0.06 }],
        ['cloudy-to-clear', { ...clear }],
        [
            'clear-to-rain',
            { ...clear, rainy: 1, source: 'profile', isStale: false },
        ],
        ['rain-to-clear', { ...clear }],
        [
            'clear-to-frost',
            { ...clear, temperature: -4, source: 'profile', isStale: false },
        ],
        [
            'frost-to-clear',
            { ...clear, temperature: 12, source: 'profile', isStale: false },
        ],
    ];
    const layers = phaseWeather.map(([request, weather], index) => ({
        request,
        dispatched: true,
        witness: {
            ...noOp,
            weatherInputWitness: {
                mode: 'snow-onset',
                cacheEnabled: true,
                request,
                revision: index + 1,
                weather,
            },
            cloudVisualCount: weather.cloudy > 0 ? 8 : 0,
            rainParticleCount: weather.rainy > 0 ? 100 : 0,
            frostIntensity:
                request === 'clear-to-frost' &&
                ['high', 'medium'].includes(tier)
                    ? 1
                    : 0,
        },
    }));
    Object.assign(layers[0].witness, {
        weatherSurfaceMode: 'integrated',
        weatherSurfaceSnowIntegrationTrackedCount: 10,
        weatherSurfaceSnowIntegrationReadyCount: 10,
        weatherSurfaceSnowIntegrationTransitionCount: 10,
        weatherSurfaceIntegratedInstanceCount: 100,
        weatherSurfaceIntegratedMaterialCount: 5,
        weatherSurfacePluginVariantCount: 1,
        weatherSurfaceAvoidedOverlaySubmissionCount: 5,
        weatherSurfaceAvoidedOverlayTriangleCount: 100,
    });
    Object.assign(layers[1].witness, {
        weatherSurfaceSnowIntegrationTrackedCount: 10,
        weatherSurfaceSnowIntegrationReadyCount: 0,
        weatherSurfaceSnowIntegrationTransitionCount: 20,
        weatherSurfaceIntegratedInstanceCount: 0,
        weatherSurfaceIntegratedMaterialCount: 0,
        weatherSurfacePluginVariantCount: 0,
        weatherSurfaceAvoidedOverlaySubmissionCount: 0,
        weatherSurfaceAvoidedOverlayTriangleCount: 0,
        weatherSurfaceFallbackOverlaySubmissionCount: tier === 'high' ? 5 : 0,
        weatherSurfaceFallbackOverlayTriangleCount: tier === 'high' ? 100 : 0,
    });
    const initial = {
        ...noOp,
        weatherInputWitness: {
            mode: 'snow-onset',
            cacheEnabled: true,
            request: 'initial',
            revision: 0,
            weather: { ...clear, snowAccumulation: 0.75 },
        },
    };
    return fixture({
        requested: {
            ...fixture().requested,
            mode: 'snow-onset',
            quality,
            expectedQualitySetting: quality,
            expectedQualityTier: tier,
            expectedDprCap: profile.dprCap,
            expectedShadows: profile.shadows,
            expectedShadowMapSize: profile.shadowMapSize,
            staticCacheLayers: true,
        },
        runtime: {
            ...fixture().runtime,
            qualityTier: tier,
            dprCap: profile.dprCap,
            shadowsEnabled: profile.shadows,
            shadowMapSize: profile.shadowMapSize,
        },
        sample: { renderedFrames: 100, gpu: { valid: false } },
        evidence: {
            layers,
            witnesses: [
                initial,
                ...layers.map((layer) => layer.witness),
                { ...layers.at(-1).witness },
            ],
        },
    });
}

test('all resolved tiers prove each applied layer with a safe no-op and exact policy', () => {
    for (const profile of profiles) {
        const result = evaluateStaticCacheClearance(
            layerFixture(profile.tier, profile.quality),
        );
        assert.equal(result.outcome, 'live-no-op');
        assert.equal(
            result.pass,
            true,
            JSON.stringify(result.checks.filter((check) => !check.pass)),
        );
    }
});

test('Automatic resolving to Medium cannot silently become an explicit Medium row', () => {
    const input = layerFixture('medium', 'auto');
    assert.equal(evaluateStaticCacheClearance(input).pass, true);
    input.evidence.witnesses[0].sceneQuality = 'medium';
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});

test('a non-cancelled but ignored entire weather cycle fails even when frost is disabled', () => {
    const input = layerFixture('low');
    for (const layer of input.evidence.layers) {
        layer.witness.weatherInputWitness =
            input.evidence.witnesses[0].weatherInputWitness;
        layer.witness.cloudVisualCount = 0;
        layer.witness.rainParticleCount = 0;
    }
    assert.equal(evaluateStaticCacheClearance(input).pass, false);
});

test('each weather phase rejects stale receipts, absent effects, wrong terrain and unresolved cache', () => {
    for (const [index, patch] of [
        [0, { weatherSurfaceIntegratedInstanceCount: 0 }],
        [
            0,
            { weatherSurfaceIntegratedInstanceCount: Number.POSITIVE_INFINITY },
        ],
        [0, { weatherSurfaceSnowIntegrationReadyCount: 0 }],
        [1, { weatherSurfaceIntegratedMaterialCount: 1 }],
        [2, { cloudVisualCount: 0 }],
        [4, { rainParticleCount: 0 }],
        [4, { staticOpaqueSceneCacheBaseTerrainLayer: 'cached' }],
        [6, { frostIntensity: 0 }],
        [7, { frostIntensity: 1 }],
        [2, { staticOpaqueSceneCacheBenefitStatus: 'probing' }],
    ]) {
        const input = layerFixture();
        Object.assign(input.evidence.layers[index].witness, patch);
        assert.equal(evaluateStaticCacheClearance(input).pass, false);
    }
    const stale = layerFixture();
    stale.evidence.layers[2].witness.weatherInputWitness.revision = 2;
    assert.equal(evaluateStaticCacheClearance(stale).pass, false);
    const unrecorded = layerFixture();
    unrecorded.evidence.witnesses.splice(3, 1);
    assert.equal(evaluateStaticCacheClearance(unrecorded).pass, false);
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
