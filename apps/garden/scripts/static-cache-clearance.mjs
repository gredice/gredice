/** Supplemental only: canonical cross-tier scenarios and comparison contract stay fixed. */
export const staticCacheClearanceMeasurementMode = 'cache-owned-render-pass-v1';
export const staticCacheClearanceMinimumSoakMs = 60_000;

/** The canonical resource barrier observes shadow registrations, not all fauna. */
export function allowMissingStaticCacheShadowPopulation(
    expectedShadows,
    observedShadows,
) {
    return expectedShadows === false && observedShadows === false;
}

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
        `/debug/profile/game?mode=${mode}&profile=high-target&quality=${profile.quality}&controls=0&details=1&hud=0&debugHud=0&staticSceneCache=${cache}&fixedTimeSeconds=43200&staticCacheWitness=1${extra}`;
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
    const scene = document.querySelector('[data-game-profile-mode]');
    const receipt = document.querySelector(
        '[data-game-profile-cache-weather-witness]',
    );
    let weatherInputWitness = null;
    try {
        weatherInputWitness = JSON.parse(
            receipt?.getAttribute('data-game-profile-cache-weather-witness') ??
                'null',
        );
    } catch {
        // A missing or malformed committed input receipt fails acceptance.
    }
    return {
        atMs: performance.now(),
        sceneMode: scene?.getAttribute('data-game-profile-mode') ?? null,
        sceneQuality: scene?.getAttribute('data-game-profile-quality') ?? null,
        sceneStaticSceneCache:
            scene?.getAttribute('data-game-profile-static-scene-cache') ?? null,
        weatherInputWitness,
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
                        'snowParticleCount',
                        'weatherDisabled',
                        'cloudProjectedShadowCount',
                        'cloudVisualCount',
                    ].includes(key),
            ),
        ),
    };
}

export function classifyStaticCacheWitness(witness) {
    if (witness?.staticOpaqueSceneCacheEnabled === false) return 'legacy';
    if (witness?.staticOpaqueSceneCacheEnabled !== true) return 'inconclusive';
    if (
        (witness.staticOpaqueSceneCacheBenefitStatus === 'disabled' &&
            ['gpu-cost', 'gpu-unavailable', 'work-cost'].includes(
                witness.staticOpaqueSceneCacheBenefitReason,
            )) ||
        (witness.staticOpaqueSceneCacheSupported === false &&
            ['unsupported', 'target-budget', 'empty'].includes(
                witness.staticOpaqueSceneCacheReason,
            ))
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

const clearWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    snowAccumulation: 0,
    temperature: null,
    source: null,
    isStale: null,
};
const cloudyWeather = { ...clearWeather, cloudy: 0.85, foggy: 0.06 };
const sparseSnowWeather = { ...clearWeather, snowAccumulation: 0.75 };
const initialWeather = {
    details: clearWeather,
    cloudy: cloudyWeather,
    rain: { ...clearWeather, cloudy: 0.85, foggy: 0.12, rainy: 1 },
    snow: {
        ...clearWeather,
        cloudy: 0.75,
        foggy: 0.2,
        snowy: 0.7,
        snowAccumulation: 24,
    },
    'snow-onset': sparseSnowWeather,
};
const layerWeather = {
    'snow-sparse-to-integrated': { ...clearWeather, snowAccumulation: 24 },
    'snow-integrated-to-sparse': sparseSnowWeather,
    'clear-to-cloudy': cloudyWeather,
    'cloudy-to-clear': clearWeather,
    'clear-to-rain': {
        ...clearWeather,
        rainy: 1,
        source: 'profile',
        isStale: false,
    },
    'rain-to-clear': clearWeather,
    'clear-to-frost': {
        ...clearWeather,
        temperature: -4,
        source: 'profile',
        isStale: false,
    },
    'frost-to-clear': {
        ...clearWeather,
        temperature: 12,
        source: 'profile',
        isStale: false,
    },
};

export function isStaticCacheWeatherWitnessValid(
    witness,
    mode,
    request = 'initial',
    revision = 0,
) {
    const expected =
        request === 'initial' ? initialWeather[mode] : layerWeather[request];
    const receipt = witness?.weatherInputWitness;
    return (
        expected !== undefined &&
        receipt?.mode === mode &&
        receipt.request === request &&
        receipt.revision === revision &&
        Object.entries(expected).every(
            ([key, value]) => receipt.weather?.[key] === value,
        ) &&
        witness.weatherDisabled === false &&
        Number.isFinite(witness.cloudVisualCount) &&
        (expected.cloudy > 0
            ? witness.cloudVisualCount > 0
            : witness.cloudVisualCount === 0) &&
        Number.isFinite(witness.rainParticleCount) &&
        (expected.rainy > 0
            ? witness.rainParticleCount > 0
            : witness.rainParticleCount === 0) &&
        Number.isFinite(witness.snowParticleCount) &&
        (expected.snowy > 0
            ? witness.snowParticleCount > 0
            : witness.snowParticleCount === 0)
    );
}

function hasResolvedRequestedDecision(witness, requestedMode) {
    const outcome = classifyStaticCacheWitness(witness);
    if (requestedMode === 'legacy') {
        return (
            outcome === 'legacy' &&
            witness.staticOpaqueSceneCacheAllocatedTargetBytes === 0
        );
    }
    if (requestedMode !== 'cache') return false;
    if (outcome === 'measured-caching') {
        return witness.staticOpaqueSceneCacheReplayStatus === 'ready';
    }
    return (
        outcome === 'live-no-op' &&
        witness.staticOpaqueSceneCacheAllocatedTargetBytes === 0 &&
        ['live', 'absent'].includes(
            witness.staticOpaqueSceneCacheBaseTerrainLayer,
        ) &&
        ['live', 'absent'].includes(
            witness.staticOpaqueSceneCacheStaticPropsLayer,
        )
    );
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
    const requestedCache = requested.staticSceneCache;
    const cacheRequestValid =
        ['legacy', 'cache'].includes(requestedCache) &&
        (requested.comparisonRole === undefined ||
            requested.comparisonRole === null ||
            requested.comparisonRole === requestedCache);
    add(
        'cacheClearanceRequestedRole',
        requestedCache,
        cacheRequestValid,
        'explicit legacy/cache role',
    );
    const modeBound = all.every(
        (witness) =>
            witness.sceneMode === requested.mode &&
            witness.sceneStaticSceneCache === requestedCache &&
            witness.weatherInputWitness?.mode === requested.mode &&
            witness.weatherInputWitness?.cacheEnabled ===
                (requestedCache === 'cache') &&
            witness.staticOpaqueSceneCacheEnabled ===
                (requestedCache === 'cache'),
    );
    add('cacheClearanceAppliedMode', modeBound, modeBound, true);
    const qualityBound =
        requested.quality === requested.expectedQualitySetting &&
        all.every(
            (witness) =>
                witness.sceneQuality === requested.expectedQualitySetting,
        );
    add(
        'cacheClearanceAppliedQualitySetting',
        qualityBound,
        qualityBound,
        true,
    );
    const resolvedDecisions = all.every((witness) =>
        hasResolvedRequestedDecision(witness, requestedCache),
    );
    add(
        'cacheClearanceEveryDecision',
        resolvedDecisions,
        resolvedDecisions,
        true,
    );
    const weatherBound = (
        requested.staticCacheLayers ? all.slice(0, 1) : all
    ).every((witness) =>
        isStaticCacheWeatherWitnessValid(witness, requested.mode),
    );
    add('cacheClearanceAppliedWeather', weatherBound, weatherBound, true);
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
        cacheRequestValid &&
            hasResolvedRequestedDecision(final, requestedCache),
        requestedCache === 'legacy'
            ? 'legacy'
            : 'measured-caching or bounded live-no-op',
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
    if (
        all.some(
            (witness) =>
                classifyStaticCacheWitness(witness) === 'measured-caching',
        )
    ) {
        add(
            'cacheClearanceGpuTiming',
            sample?.gpu?.valid,
            sample?.gpu?.valid === true &&
                sample.gpu.measurementMode === 'cache-owned-render-pass-v1',
            true,
        );
    }
    if (outcome === 'measured-caching') {
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
        const phasesRecorded =
            all.length >= expected.length + 2 &&
            layers.every(
                (layer, index) =>
                    JSON.stringify(layer.witness) ===
                    JSON.stringify(all[index + 1]),
            );
        add(
            'cacheClearanceWeatherReceiptsRecorded',
            phasesRecorded,
            phasesRecorded,
            true,
        );
        for (const [index, layer] of layers.entries()) {
            const valid = isStaticCacheWeatherWitnessValid(
                layer.witness,
                requested.mode,
                expected[index],
                index + 1,
            );
            add(
                `cacheClearanceWeatherApplied${layer.request}`,
                valid,
                valid,
                true,
            );
            const receiptResolved = hasResolvedRequestedDecision(
                layer.witness,
                requestedCache,
            );
            add(
                `cacheClearanceWeatherDecision${layer.request}`,
                receiptResolved,
                receiptResolved,
                true,
            );
        }
        const finalWeather = isStaticCacheWeatherWitnessValid(
            final,
            requested.mode,
            'frost-to-clear',
            expected.length,
        );
        add(
            'cacheClearanceWeatherFinalReceipt',
            finalWeather,
            finalWeather,
            true,
        );
        const integrated = layers[0]?.witness;
        const sparse = layers[1]?.witness;
        const finiteSnowState = (witness) =>
            [
                'weatherSurfaceSnowIntegrationTrackedCount',
                'weatherSurfaceSnowIntegrationReadyCount',
                'weatherSurfaceSnowIntegrationTransitionCount',
                'weatherSurfaceIntegratedInstanceCount',
                'weatherSurfaceIntegratedMaterialCount',
                'weatherSurfacePluginVariantCount',
                'weatherSurfaceAvoidedOverlaySubmissionCount',
                'weatherSurfaceAvoidedOverlayTriangleCount',
            ].every(
                (key) => Number.isFinite(witness?.[key]) && witness[key] >= 0,
            );
        const integratedSnow =
            finiteSnowState(integrated) &&
            integrated?.weatherSurfaceMode === 'integrated' &&
            integrated.weatherSurfaceSnowIntegrationTrackedCount > 0 &&
            integrated.weatherSurfaceSnowIntegrationReadyCount > 0 &&
            integrated.weatherSurfaceIntegratedInstanceCount > 0 &&
            integrated.weatherSurfaceIntegratedMaterialCount > 0 &&
            integrated.weatherSurfacePluginVariantCount === 1 &&
            integrated.weatherSurfaceAvoidedOverlaySubmissionCount > 0 &&
            integrated.weatherSurfaceAvoidedOverlayTriangleCount > 0;
        add(
            'cacheClearanceSnowIntegrated',
            integratedSnow,
            integratedSnow,
            true,
        );
        const sparseSnow =
            finiteSnowState(sparse) &&
            sparse?.weatherSurfaceSnowIntegrationTrackedCount > 0 &&
            sparse.weatherSurfaceSnowIntegrationReadyCount === 0 &&
            sparse.weatherSurfaceIntegratedInstanceCount === 0 &&
            sparse.weatherSurfaceIntegratedMaterialCount === 0 &&
            sparse.weatherSurfacePluginVariantCount === 0 &&
            sparse.weatherSurfaceAvoidedOverlaySubmissionCount === 0 &&
            sparse.weatherSurfaceAvoidedOverlayTriangleCount === 0 &&
            sparse.weatherSurfaceSnowIntegrationTransitionCount >
                integrated?.weatherSurfaceSnowIntegrationTransitionCount &&
            (requested.expectedQualityTier === 'high'
                ? sparse.weatherSurfaceFallbackOverlaySubmissionCount > 0 &&
                  sparse.weatherSurfaceFallbackOverlayTriangleCount > 0
                : sparse.weatherSurfaceFallbackOverlaySubmissionCount === 0 &&
                  sparse.weatherSurfaceFallbackOverlayTriangleCount === 0);
        add('cacheClearanceSnowSparsePolicy', sparseSnow, sparseSnow, true);
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
        for (const layer of layers) {
            const terrainLive =
                layer.request === 'snow-sparse-to-integrated' ||
                layer.request === 'clear-to-rain' ||
                (layer.request === 'clear-to-frost' && frostEnabled);
            const state = layer.witness?.staticOpaqueSceneCacheBaseTerrainLayer;
            add(
                `cacheClearanceTerrainLayer${layer.request}`,
                state,
                terrainLive
                    ? state === 'live'
                    : ['live', 'cached', 'mixed'].includes(state),
                terrainLive ? 'live' : 'present terrain layer',
            );
        }
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
