/** Supplemental only: canonical cross-tier scenarios and comparison contract stay fixed. */
export const staticCacheClearanceMeasurementMode = 'cache-owned-render-pass-v1';
export const staticCacheClearanceMinimumSoakMs = 60_000;

export function buildStaticCacheClearanceScenarioSets(profiles) {
    const common = (profile) => ({
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        staticCacheClearance: true,
        cacheGpuMetrics: true,
        externalGpuTimer: false,
        expectedDprCap: profile.dprCap,
        expectedQualitySetting: profile.quality,
        expectedQualityTier: profile.tier,
        expectedShadowMapSize: profile.shadowMapSize,
        expectedShadows: profile.shadows,
        expectedGroundDecorationDensity: profile.groundDecorationDensity,
        ...(profile.autoQualityDeviceClass
            ? {
                  autoQualityDeviceClass: profile.autoQualityDeviceClass,
                  navigatorMetrics: profile.navigatorMetrics,
              }
            : {}),
    });
    const path = (profile, mode, cache, extra = '') =>
        `/debug/profile/game?mode=${mode}&profile=high-target&quality=${profile.quality}&controls=0&details=1&hud=0&debugHud=0&staticSceneCache=${cache}&fixedTimeSeconds=43200${extra}`;
    const visual = profiles.flatMap((profile) =>
        ['details', 'cloudy', 'rain', 'snow'].flatMap((mode) =>
            ['legacy', 'cache'].map((role) => ({
                ...common(profile),
                name: `game-static-cache-${profile.slug}-${mode}-${role}-desktop`,
                path: path(profile, mode, role),
                comparisonPair: `static-cache-clearance-${profile.slug}-${mode}`,
                comparisonRole: role,
                staticSceneCacheBenchmark: true,
                screenshotWitness: true,
                staticSceneCacheVisualDeterministic: true,
                fixedTimeSeconds: 43_200,
                repeat: 5,
            })),
        ),
    );
    const depth = profiles.map((profile) => ({
        ...common(profile),
        name: `game-static-cache-${profile.slug}-depth-desktop`,
        path: path(
            profile,
            'details',
            'cache',
            '&staticSceneCacheOcclusionFixture=1',
        ),
        staticCacheDepth: true,
        screenshotWitness: true,
        repeat: 1,
    }));
    const lifecycle = profiles.map((profile) => ({
        ...common(profile),
        name: `game-static-cache-${profile.slug}-lifecycle-desktop`,
        path: path(profile, 'details', 'cache', '&lifecycle=1&outline=1'),
        lifecycleProfile: true,
        screenshotWitness: true,
        repeat: 3,
    }));
    const layers = profiles.map((profile) => ({
        ...common(profile),
        name: `game-static-cache-${profile.slug}-weather-layers-desktop`,
        path: path(
            profile,
            'snow-onset',
            'cache',
            '&weatherSurface=integrated',
        ),
        staticCacheLayers: true,
        screenshotWitness: true,
        repeat: 3,
    }));
    const soak = profiles.map((profile) => ({
        ...common(profile),
        name: `game-static-cache-${profile.slug}-soak-desktop`,
        path: path(profile, 'cloudy', 'cache'),
        staticCacheSoak: true,
        screenshotWitness: true,
        repeat: 1,
    }));
    return {
        'static-cache-visuals': visual,
        'static-cache-depth': depth,
        'static-cache-lifecycle': lifecycle,
        'static-cache-soak': soak,
        'static-cache-layers': layers,
        'static-cache-clearance': [
            ...visual,
            ...depth,
            ...lifecycle,
            ...soak,
            ...layers,
        ],
    };
}

/** Passed directly to addInitScript: no enclosing module bindings. */
export function installStaticCacheGpuMetrics() {
    let startedAt = null;
    let endedAt = null;
    let complete = false;
    let invalidReason = null;
    let supported = null;
    let samples = [];
    const pending = new Map();
    const inWindow = (at) =>
        startedAt !== null &&
        at >= startedAt &&
        (endedAt === null || at <= endedAt);
    globalThis.__gameProfileCacheGpuObserver = (event) => {
        if (event.type === 'supported') {
            supported = event.supported;
        } else if (event.type === 'invalid') {
            pending.clear();
            if (startedAt !== null && !complete) invalidReason = event.reason;
        } else if (event.type === 'begin' && inWindow(event.startedAtMs)) {
            pending.set(event.startedAtMs, true);
        } else if (event.type === 'sample') {
            pending.delete(event.sample.startedAtMs);
            if (inWindow(event.sample.startedAtMs)) samples.push(event.sample);
        }
    };
    globalThis.__gameProfileCacheGpuTimer = {
        reset() {
            startedAt = performance.now();
            endedAt = null;
            complete = false;
            invalidReason = null;
            samples = [];
            pending.clear();
        },
        stop() {
            endedAt ??= performance.now();
        },
        async finish() {
            this.stop();
            const deadline = performance.now() + 2_000;
            while (
                pending.size &&
                performance.now() < deadline &&
                !invalidReason
            ) {
                await new Promise((resolveFrame) => {
                    const raf =
                        globalThis.__gameProfileRequestNativeAnimationFrame ??
                        globalThis.requestAnimationFrame.bind(globalThis);
                    raf(resolveFrame);
                });
            }
            complete = pending.size === 0;
            if (!complete)
                invalidReason ??= 'Timed out draining cache-owned GPU queries';
        },
        snapshot() {
            const values = samples
                .map((sample) => sample.elapsedMs)
                .sort((a, b) => a - b);
            const valid =
                supported === true &&
                complete &&
                !invalidReason &&
                values.length > 0;
            return {
                measurementMode: 'cache-owned-render-pass-v1',
                complete,
                disjoint: invalidReason === 'disjoint',
                elapsedMaxMs: values.at(-1) ?? null,
                elapsedP95Ms:
                    values[Math.max(0, Math.ceil(values.length * 0.95) - 1)] ??
                    null,
                elapsedTotalMs: values.length
                    ? values.reduce((a, b) => a + b, 0)
                    : null,
                reason:
                    invalidReason ??
                    (values.length
                        ? null
                        : 'No cache-owned GPU render-pass samples'),
                sampleCount: values.length,
                kinds: Object.fromEntries(
                    ['capture', 'hit', 'live'].map((kind) => [
                        kind,
                        samples.filter((sample) => sample.kind === kind).length,
                    ]),
                ),
                supported: supported === true,
                valid,
            };
        },
    };
}

/** Snapshot outside measured windows so resource witnesses do not perturb timings. */
export function readStaticCacheWitness() {
    const profile = globalThis.__grediceGameProfile ?? {};
    return {
        atMs: performance.now(),
        qualityTier: profile.qualityTier ?? null,
        dprCap: profile.dprCap ?? null,
        shadowMapSize: profile.shadowMapSize ?? null,
        shadowsEnabled: profile.shadowsEnabled ?? null,
        rendererGeometries: profile.rendererGeometries ?? null,
        rendererTextures: profile.rendererTextures ?? null,
        rendererShaders: profile.rendererShaders ?? null,
        ...Object.fromEntries(
            Object.entries(profile).filter(
                ([key]) =>
                    key.startsWith('profileGarden') ||
                    key.startsWith('generatedPlant') ||
                    key.startsWith('staticOpaqueSceneCache') ||
                    key.startsWith('weatherSurface') ||
                    [
                        'frostIntensity',
                        'rainWetness',
                        'rainParticleCount',
                        'snowCoverage',
                        'snowIntensity',
                        'cloudProjectedShadowCount',
                        'cloudVisualCount',
                    ].includes(key),
            ),
        ),
    };
}

export function classifyStaticCacheWitness(witness) {
    if (witness?.staticOpaqueSceneCacheEnabled === false) return 'legacy';
    if (
        witness?.staticOpaqueSceneCacheBenefitStatus === 'disabled' ||
        witness?.staticOpaqueSceneCacheSupported === false
    )
        return 'live-no-op';
    if (
        witness?.staticOpaqueSceneCacheBenefitStatus === 'enabled' &&
        witness.staticOpaqueSceneCacheSupported === true &&
        witness.staticOpaqueSceneCacheState === 'ready' &&
        witness.staticOpaqueSceneCacheBenefitReason === 'gpu-savings' &&
        Number.isFinite(
            witness.staticOpaqueSceneCacheBenefitNetGpuMsPerFrame,
        ) &&
        witness.staticOpaqueSceneCacheBenefitNetGpuMsPerFrame > 0
    )
        return 'measured-caching';
    return 'inconclusive';
}

/** Supplemental acceptance; an unmeasured probe is never called clearance. */
export function evaluateStaticCacheClearance({
    requested,
    runtime,
    sample,
    evidence,
    apiErrors = [],
    consoleMessages = [],
    pageErrors = [],
    depthThresholds,
    fixtureExpected,
    screenshotValid,
}) {
    const checks = [];
    const add = (name, actual, pass, limit) =>
        checks.push({ name, actual, limit, pass });
    const all = evidence?.witnesses ?? [];
    const final = all.at(-1);
    const outcome = classifyStaticCacheWitness(final);
    add(
        'cacheClearanceScreenshot',
        screenshotValid,
        screenshotValid === true,
        true,
    );
    add(
        'cacheClearanceFixtureContract',
        fixtureExpected,
        fixtureExpected !== undefined &&
            Object.keys(fixtureExpected).length >= 7,
        'complete fixture',
    );
    for (const [key, expected] of Object.entries(fixtureExpected ?? {})) {
        add(
            `cacheClearanceFixture${key}`,
            runtime?.[key],
            runtime?.[key] === expected,
            expected,
        );
    }
    add('cacheClearanceWitnesses', all.length, all.length >= 2, 2);
    add(
        'cacheClearanceFreshResources',
        all.every(
            (witness) =>
                witness.resourceMeasurementMode ===
                    'population-exposure-post-render-resource-snapshot-v1' &&
                witness.resourceMeasurementValid === true,
        ),
        all.every(
            (witness) =>
                witness.resourceMeasurementMode ===
                    'population-exposure-post-render-resource-snapshot-v1' &&
                witness.resourceMeasurementValid === true,
        ),
        true,
    );
    add(
        'cacheClearanceQualityTier',
        runtime?.qualityTier,
        runtime?.qualityTier === requested.expectedQualityTier,
        requested.expectedQualityTier,
    );
    add(
        'cacheClearanceDprCap',
        runtime?.dprCap,
        runtime?.dprCap === requested.expectedDprCap,
        requested.expectedDprCap,
    );
    add(
        'cacheClearanceShadows',
        runtime?.shadowsEnabled,
        runtime?.shadowsEnabled === requested.expectedShadows,
        requested.expectedShadows,
    );
    add(
        'cacheClearanceShadowMap',
        runtime?.shadowMapSize,
        runtime?.shadowMapSize === requested.expectedShadowMapSize,
        requested.expectedShadowMapSize,
    );
    add(
        'cacheClearanceRenderedFrames',
        sample?.renderedFrames,
        sample?.renderedFrames > 0,
        1,
    );
    add(
        'cacheClearanceErrors',
        apiErrors.length +
            pageErrors.length +
            consoleMessages.filter((message) => message.type === 'error')
                .length,
        apiErrors.length === 0 &&
            pageErrors.length === 0 &&
            !consoleMessages.some((message) => message.type === 'error'),
        0,
    );
    add(
        'cacheClearanceResolvedDecision',
        outcome,
        outcome !== 'inconclusive',
        'measured-caching or bounded live-no-op',
    );
    const withinBudget = all.every((witness) => {
        const budget = witness.staticOpaqueSceneCacheBudgetBytes;
        const current = witness.staticOpaqueSceneCacheAllocatedTargetBytes;
        const peak = witness.staticOpaqueSceneCachePeakTargetBytes;
        const replay = witness.staticOpaqueSceneCacheReplayEstimatedBytes;
        return (
            [budget, current, peak, replay].every(
                (value) => Number.isFinite(value) && value >= 0,
            ) &&
            current <= budget &&
            peak <= budget
        );
    });
    add('cacheClearanceResourceBudget', withinBudget, withinBudget, true);
    if (outcome === 'measured-caching') {
        add(
            'cacheClearanceMeasuredAdmission',
            all.every(
                (witness) =>
                    classifyStaticCacheWitness(witness) === 'measured-caching',
            ),
            all.every(
                (witness) =>
                    classifyStaticCacheWitness(witness) === 'measured-caching',
            ),
            true,
        );
        add(
            'cacheClearanceGpuTiming',
            sample?.gpu?.valid,
            sample?.gpu?.valid === true &&
                sample.gpu.measurementMode === 'cache-owned-render-pass-v1',
            true,
        );
        add(
            'cacheClearanceReplayReady',
            final?.staticOpaqueSceneCacheReplayStatus,
            final?.staticOpaqueSceneCacheReplayStatus === 'ready',
            'ready',
        );
        if (requested.staticCacheDepth) {
            for (const key of ['BackgroundWitness', 'Occluder', 'Foreground']) {
                const value =
                    final?.[
                        `staticOpaqueSceneCacheOcclusion${key}MinimumMatchRatio`
                    ];
                add(
                    `cacheClearanceDepth${key}`,
                    value,
                    Number.isFinite(value) &&
                        value >= depthThresholds.minimumMatchRatio,
                    depthThresholds.minimumMatchRatio,
                );
            }
            const leak =
                final?.staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio;
            add(
                'cacheClearanceDepthLeak',
                leak,
                Number.isFinite(leak) &&
                    leak >= 0 &&
                    leak <= depthThresholds.maximumLeakRatio,
                depthThresholds.maximumLeakRatio,
            );
            add(
                'cacheClearanceDepthVerifiedHits',
                final?.staticOpaqueSceneCacheOcclusionVerifiedHitFrameCount,
                final?.staticOpaqueSceneCacheOcclusionVerifiedHitFrameCount ===
                    depthThresholds.verifiedHitCount,
                depthThresholds.verifiedHitCount,
            );
            add(
                'cacheClearanceDepth',
                final?.staticOpaqueSceneCacheOcclusionFixturePass,
                final?.staticOpaqueSceneCacheOcclusionFixturePass === true,
                true,
            );
        }
    } else if (outcome === 'live-no-op') {
        add(
            'cacheClearanceNoOpTargetRelease',
            final?.staticOpaqueSceneCacheAllocatedTargetBytes,
            final?.staticOpaqueSceneCacheAllocatedTargetBytes === 0,
            0,
        );
    }
    if (requested.staticCacheLayers) {
        const layers = evidence?.layers ?? [];
        const expected = [
            'snow-sparse-to-integrated',
            'snow-integrated-to-sparse',
            'clear-to-cloudy',
            'cloudy-to-clear',
            'clear-to-rain',
            'rain-to-clear',
            'clear-to-frost',
            'frost-to-clear',
        ];
        add(
            'cacheClearanceWeatherSequence',
            layers.map((layer) => layer.request),
            layers.length === expected.length &&
                layers.every(
                    (layer, index) =>
                        layer.dispatched === true &&
                        layer.request === expected[index],
                ),
            expected,
        );
        const frost = layers.find((layer) => layer.request === 'clear-to-frost')
            ?.witness?.frostIntensity;
        const frostEnabled =
            requested.expectedQualityTier === 'high' ||
            requested.expectedQualityTier === 'medium';
        add(
            'cacheClearanceFrostPolicy',
            frost,
            Number.isFinite(frost) && (frostEnabled ? frost > 0 : frost === 0),
            frostEnabled ? '>0' : 0,
        );
        const clearedFrost = layers.at(-1)?.witness?.frostIntensity;
        add('cacheClearanceFrostCleared', clearedFrost, clearedFrost === 0, 0);
    }
    if (requested.staticCacheSoak) {
        add(
            'cacheClearanceSoakDuration',
            evidence?.soakMs,
            evidence?.soakMs >= staticCacheClearanceMinimumSoakMs,
            staticCacheClearanceMinimumSoakMs,
        );
        add('cacheClearanceSoakSamples', all.length, all.length >= 4, 4);
        for (const [key, maximumGrowth] of [
            ['rendererShaders', 1],
            ['rendererTextures', 4],
            ['rendererGeometries', 2],
        ]) {
            const values = all.map((witness) => witness[key]);
            const growth = values.every(Number.isFinite)
                ? Math.max(...values) - values[0]
                : null;
            add(
                `cacheClearanceSoak${key}`,
                growth,
                growth !== null && growth <= maximumGrowth,
                maximumGrowth,
            );
        }
    }
    return {
        checks,
        pass: checks.every((check) => check.pass),
        outcome,
        measuredGpuSavingsClaimed: false,
        measurementMode: staticCacheClearanceMeasurementMode,
    };
}
