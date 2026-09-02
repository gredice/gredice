import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
    buildCrossTierCheckNameInventory,
    buildMarkdown,
    compareConfirmedReports,
    compareReports,
    parseArgs,
    runCli,
    writeComparisonReports,
} from './compare-game-profile-reports.mjs';

const baselineCommit = '1'.repeat(40);
const candidateCommit = '2'.repeat(40);
const sharedHarnessCommit = 'f'.repeat(40);

function crossTierLeaseTopology() {
    return {
        activeLeaseCount: 10,
        activeRenderLeaseCount: 10,
        renderLeaseOwners: ['scene-ambient'],
        renderLeaseSummaries: [
            {
                framesPerSecond: 30,
                leaseCount: 10,
                owner: 'scene-ambient',
            },
        ],
        targetFramesPerSecond: 30,
    };
}

function sample(overrides = {}) {
    return {
        displayCadenceControl: null,
        drawCalls: 6_000,
        drawCallsPerRenderedFrame: 200,
        gpu: {
            complete: false,
            elapsedP95Ms: null,
            reason: 'GPU timer unavailable',
            supported: false,
            valid: false,
        },
        jsHeapMb: 64,
        longTaskCount: 0,
        longTaskMaxMs: 0,
        longTaskTotalMs: 0,
        p95FrameMs: 16,
        renderedFps: 30,
        submittedTriangles: 900_000,
        trianglesPerRenderedFrame: 30_000,
        ...overrides,
    };
}

function displayCadenceControlSnapshot(overrides = {}) {
    const intervalMs = 1_000 / 30;
    const deliveredFrameCount = overrides.deliveredFrameCount ?? 500;
    const skippedPhaseCount = overrides.skippedPhaseCount ?? 4;
    const firstDeliveredPhaseAt = overrides.firstDeliveredPhaseAt ?? 100;
    const firstDeliveredAt =
        overrides.firstDeliveredAt ?? firstDeliveredPhaseAt;
    const lastDeliveredPhaseAt =
        overrides.lastDeliveredPhaseAt ??
        firstDeliveredPhaseAt +
            (deliveredFrameCount + skippedPhaseCount - 1) * intervalMs;
    const lastDeliveredAt =
        overrides.lastDeliveredAt ?? lastDeliveredPhaseAt + 0.25;
    const observedFramesPerSecond =
        overrides.observedFramesPerSecond ??
        Math.round(
            (((deliveredFrameCount - 1) * 1_000) /
                (lastDeliveredAt - firstDeliveredAt)) *
                100,
        ) / 100;
    return {
        callbackTimestampMode: 'scheduled-phase-v1',
        cancelRequestCount: 100,
        cancelledBeforeDeliveryCount: 50,
        deliveredCallbackCount: 1_000,
        deliveredFrameCount,
        firstDeliveredAt,
        firstDeliveredPhaseAt,
        installationError: null,
        installed: true,
        intervalMs,
        lastDeliveredAt,
        lastDeliveredPhaseAt,
        mode: 'profiler-owned-raf-v1',
        nativeFrameCancellationCount: 10,
        nativeFrameCount: 1_000,
        nativeFramePending: true,
        observedRateClock: 'native-wall-time-v1',
        observedFramesPerSecond,
        pendingCallbackCount: 2,
        requestCount: 1_052,
        requestedFramesPerSecond: 30,
        skippedPhaseCount,
        ...overrides,
    };
}

function displayCadenceControlSample(overrides = {}) {
    const atStart = displayCadenceControlSnapshot();
    const atEnd = displayCadenceControlSnapshot({
        cancelRequestCount: 110,
        cancelledBeforeDeliveryCount: 55,
        deliveredCallbackCount: 1_300,
        deliveredFrameCount: 650,
        nativeFrameCancellationCount: 12,
        nativeFrameCount: 1_300,
        nativeFramePending: false,
        pendingCallbackCount: 1,
        requestCount: 1_356,
        skippedPhaseCount: atStart.skippedPhaseCount,
    });
    return {
        atEnd,
        atStart,
        callbackTimestampMode: 'scheduled-phase-v1',
        cancelRequestCountDelta: 10,
        cancelledBeforeDeliveryCountDelta: 5,
        deliveredCallbackCountDelta: 300,
        deliveredFrameCountDelta: 150,
        elapsedMs: 5_000,
        installedAtEnd: true,
        installedAtStart: true,
        intervalMs: 1_000 / 30,
        mode: 'profiler-owned-raf-v1',
        nativeFrameCountDelta: 300,
        observedRateClock: 'native-wall-time-v1',
        observedFramesPerSecond: 30,
        requestedFramesPerSecond: 30,
        skippedPhaseCountDelta: 0,
        ...overrides,
    };
}

function setAvailableGpuSample(
    target,
    { elapsedMs, elapsedP95Ms, elapsedTotalMs, renderedFrames },
) {
    target.elapsedMs = elapsedMs;
    target.renderedFrames = renderedFrames;
    target.gpu = {
        complete: true,
        disjoint: false,
        elapsedMaxMs: elapsedP95Ms,
        elapsedP95Ms,
        elapsedTotalMs,
        reason: null,
        sampleCount: renderedFrames,
        supported: true,
        valid: true,
    };
    if (target.runtimeFrameLoopCounterDeltas) {
        const deltas = target.runtimeFrameLoopCounterDeltas;
        deltas.ownedInvalidationCount = renderedFrames;
        deltas.productiveWakeupCount = renderedFrames;
        deltas.r3fFrameCallbackCount = renderedFrames;
        deltas.wakeupCount = renderedFrames;
        deltas.scheduledCallbackCount =
            renderedFrames + deltas.cancelledCallbackCount;
    }
}

function runtime(overrides = {}) {
    return {
        blockCount: 297,
        browserDpr: 2,
        dprCap: 2,
        generatedPlantExpectedInstanceCount: 537,
        generatedPlantFieldCount: 54,
        generatedPlantInstanceCount: 537,
        generatedPlantVisibleFieldCount: 54,
        generatedPlantVisibleInstanceCount: 537,
        profileGardenId: 99_996,
        qualityTier: 'high',
        raisedBedCount: 3,
        rendererGeometries: 200,
        rendererShaders: 24,
        rendererTextures: 11,
        shadowMapSize: 4_096,
        shadowsEnabled: true,
        stackCount: 270,
        staticOpaqueSceneCacheEnabled: false,
        ...overrides,
    };
}

function rendererStatsMeasurement(mode = 'post-render-receipt-v1') {
    if (mode === 'legacy-pre-render-settled-v1') {
        return {
            completedAt: 700,
            drawCallsDelta: 10,
            legacySettleMs: 600,
            measurementMode: mode,
            renderedFramesDelta: 1,
            rendererStatsPublishedAt: null,
            rendererStatsReceiptCount: null,
            rendererStatsReceiptDelta: null,
            rendererStatsRenderFrame: null,
            r3fFrameCallbackCountDelta: null,
            runtimeMeasurementMode: null,
            startedAt: 100,
            submittedTrianglesDelta: 100,
        };
    }
    return {
        completedAt: 120,
        drawCallsDelta: 10,
        legacySettleMs: null,
        measurementMode: mode,
        renderedFramesDelta: 1,
        rendererStatsPublishedAt: 110,
        rendererStatsReceiptCount: 2,
        rendererStatsReceiptDelta: 1,
        rendererStatsRenderFrame: 1,
        r3fFrameCallbackCountDelta: 1,
        runtimeMeasurementMode: 'post-render-microtask-v1',
        startedAt: 100,
        submittedTrianglesDelta: 100,
    };
}

function crossTierResourceSnapshot(
    resources,
    {
        populationAtEnd = {
            bee: 1,
            bird: 2,
            butterfly: 3,
            cat: 1,
            dog: 1,
            ladybug: 5,
            squirrel: 1,
        },
        populationAtStart = populationAtEnd,
        populationExposure = populationAtEnd,
    } = {},
) {
    const canonicalPopulationExposure = Object.fromEntries(
        Object.entries(populationExposure).sort(([left], [right]) =>
            left.localeCompare(right),
        ),
    );
    return {
        attemptCount: 1,
        capturedAt: 700,
        measurementMode: 'population-exposure-post-render-resource-snapshot-v1',
        populationAtEnd: structuredClone(populationAtEnd),
        populationAtStart: structuredClone(populationAtStart),
        populationExposure: structuredClone(canonicalPopulationExposure),
        populationExposureAvailable:
            Object.keys(canonicalPopulationExposure).length > 0,
        populationExposureAtEnd: structuredClone(canonicalPopulationExposure),
        populationExposureAtStart: structuredClone(canonicalPopulationExposure),
        populationExposureSignature: JSON.stringify(
            canonicalPopulationExposure,
        ),
        rendererStatsMode: 'post-render-receipt-v1',
        resources: {
            rendererGeometries: resources.rendererGeometries,
            rendererShaders: resources.rendererShaders,
            rendererStatsMeasurement: rendererStatsMeasurement(),
            rendererTextures: resources.rendererTextures,
        },
    };
}

function normalScenario(profileRun, overrides = {}) {
    const baseName = 'game-high-target-clear-idle-desktop';
    return {
        acceptance: { pass: true },
        baseName,
        budget: {
            checks: [{ name: 'p95FrameMs', pass: true }],
            pass: true,
        },
        budgetName: 'gameHighTarget',
        canvasReadyMs: 480,
        cdp: { jsHeapMb: 64, scriptDuration: 0.8 },
        domContentLoadedMs: 22,
        environment: {
            renderer: 'ANGLE Metal Renderer',
            userAgent: 'Profile Browser/1',
            vendor: 'Profile Vendor',
        },
        memory: {
            jsHeapBeforeCollectionMb: 72,
            measurementMode: 'post-scenario-forced-gc-v1',
            retainedJsHeapMb: 64,
        },
        name: `${baseName}-run-${profileRun}`,
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high',
        performanceBudget: {
            checks: [{ name: 'p95FrameMs', pass: true }],
            pass: true,
        },
        profileRun,
        requested: {
            controls: '0',
            details: '1',
            displayCadenceControl: null,
            dpr: 2,
            gardenProfile: 'high-target',
            graphicsBackend: 'angle-metal',
            isMobile: false,
            mode: 'details',
            quality: 'high',
            sampleMs: 5_000,
            staticSceneCache: 'legacy',
            viewport: { height: 720, width: 1_280 },
        },
        runtime: runtime(),
        sample: sample(),
        ...overrides,
    };
}

function lifecycleScenario(profileRun) {
    const scenario = normalScenario(profileRun);
    const fixture = {
        actorGroundingShadowDroppedCount: 0,
        blockCount: 297,
        generatedPlantExpectedInstanceCount: 537,
        generatedPlantFieldCount: 54,
        generatedPlantInstanceCount: 537,
        generatedPlantVisibleFieldCount: 54,
        generatedPlantVisibleInstanceCount: 537,
        raisedBedCount: 3,
        speciesCounts: { bird: 2, cat: 1, dog: 1 },
        stackCount: 270,
    };
    const phaseResources = {
        rendererGeometries: 200,
        rendererShaders: 24,
        rendererStatsMeasurement: {
            completedAt: 120,
            drawCallsDelta: 10,
            legacySettleMs: null,
            measurementMode: 'post-render-receipt-v1',
            renderedFramesDelta: 1,
            rendererStatsPublishedAt: 110,
            rendererStatsReceiptCount: 2,
            rendererStatsReceiptDelta: 1,
            rendererStatsRenderFrame: 1,
            r3fFrameCallbackCountDelta: 1,
            runtimeMeasurementMode: 'post-render-microtask-v1',
            startedAt: 100,
            submittedTrianglesDelta: 100,
        },
        rendererTextures: 11,
    };
    const phaseFixture = () => ({
        fixture: structuredClone(fixture),
        gardenId: scenario.runtime.profileGardenId,
        resources: structuredClone(phaseResources),
    });
    const lifecycleSample = (overrides = {}) =>
        sample({
            runtimeFrameLoopAtEnd: {
                effectiveVisible: true,
                targetFramesPerSecond: 30,
            },
            runtimeFrameLoopAtStart: {
                effectiveVisible: true,
                targetFramesPerSecond: 30,
            },
            ...overrides,
        });
    scenario.baseName = 'game-high-target-runtime-lifecycle-desktop';
    scenario.name = `${scenario.baseName}-run-${profileRun}`;
    scenario.requested = {
        ...scenario.requested,
        freshContext: true,
        lifecycleProfile: true,
        motion: 'runtime-lifecycle',
    };
    scenario.lifecycle = {
        active: {
            cdp: { jsHeapMb: 64, scriptDuration: 0.8 },
            runtimeFrameLoop: {
                activeLeaseCount: 0,
                awaitingFrameReceipt: false,
                cancelledCallbackCount: 0,
                canvasVisible: true,
                documentVisible: true,
                effectiveVisible: true,
                loopActive: true,
                ownedInvalidationCount: 10,
                resumeCount: 0,
                scheduledCallbackCount: 20,
                suspendCount: 0,
                targetFramesPerSecond: 30,
                wakeupCount: 19,
            },
            sample: lifecycleSample(),
        },
        cold: {
            canvasAttachedMs: 300,
            canvasSizedMs: 380,
            domContentLoadedMs: 20,
            firstSubmittedFrameMs: 490,
            fixture: phaseFixture(),
            fixtureReadyMs: 580,
            interactionReadyMs: 870,
        },
        context: {
            restoredControl: {
                fixture: phaseFixture(),
            },
            restoredWindow: {
                cdp: { jsHeapMb: 64, scriptDuration: 0.9 },
                sample: lifecycleSample({ renderedFps: 29 }),
            },
        },
        hidden: {
            resumedControl: {
                fixture: phaseFixture(),
            },
            residualDeltas: {
                cancelledCallbackCount: 0,
                ownedInvalidationCount: 0,
                resumeCount: 0,
                scheduledCallbackCount: 0,
                suspendCount: 0,
                wakeupCount: 0,
            },
            runtimeSchedulerZeroObserved: true,
        },
        offscreen: {
            resumedControl: {
                fixture: phaseFixture(),
            },
            residualDeltas: {
                cancelledCallbackCount: 0,
                ownedInvalidationCount: 0,
                resumeCount: 0,
                scheduledCallbackCount: 0,
                suspendCount: 0,
                wakeupCount: 0,
            },
            runtimeSchedulerZeroObserved: true,
        },
    };
    return scenario;
}

function lifecycleResourceWitnesses(scenario) {
    return [
        scenario.lifecycle.cold.fixture.resources,
        scenario.lifecycle.offscreen.resumedControl.fixture.resources,
        scenario.lifecycle.hidden.resumedControl.fixture.resources,
        scenario.lifecycle.context.restoredControl.fixture.resources,
    ];
}

function setRendererResourceCounts(
    resources,
    [rendererGeometries, rendererShaders, rendererTextures],
) {
    Object.assign(resources, {
        rendererGeometries,
        rendererShaders,
        rendererTextures,
    });
}

function setLifecycleResourceCounts(scenario, { cold, mature, restored }) {
    const [
        coldResources,
        offscreenResources,
        hiddenResources,
        restoredResources,
    ] = lifecycleResourceWitnesses(scenario);
    setRendererResourceCounts(coldResources, cold);
    setRendererResourceCounts(offscreenResources, mature);
    setRendererResourceCounts(hiddenResources, mature);
    setRendererResourceCounts(restoredResources, restored);
}

function setReportLifecycleResourceCounts(reportValue, counts) {
    for (const scenario of reportLifecycleScenarios(reportValue)) {
        setLifecycleResourceCounts(scenario, counts);
    }
}

function reportLifecycleScenarios(reportValue) {
    return reportValue.scenarios.filter(
        ({ requested }) => requested.lifecycleProfile === true,
    );
}

function gardenSwitchScenario(profileRun) {
    const scenario = normalScenario(profileRun);
    scenario.baseName = 'game-garden-switch-high-fauna-single-context-desktop';
    scenario.name = `${scenario.baseName}-run-${profileRun}`;
    scenario.requested = {
        ...scenario.requested,
        gardenProfile: 'garden-switch',
        gardenSwitchProfile: true,
        motion: 'high-fauna-single-context-switch',
    };
    const arrival = (arrivalIndex, profile, timing) => {
        const arrivalSample = sample({
            rendererShaders: 24,
            rendererTextures: 11,
            runtimeFrameLoopAtEnd: {
                awaitingFrameReceipt: false,
                callbackPending: true,
                displayFrameCalibrationCount: 1,
                displayFrameIntervalMs: 1000 / 60,
                effectiveVisible: true,
                pendingCallbackDueAt: 2_000,
                pendingCallbackKind: 'timeout',
                targetFramesPerSecond: 30,
            },
            runtimeFrameLoopAtStart: {
                awaitingFrameReceipt: false,
                callbackPending: true,
                displayFrameCalibrationCount: 1,
                displayFrameIntervalMs: 1000 / 60,
                effectiveVisible: true,
                pendingCallbackDueAt: 1_000,
                pendingCallbackKind: 'timeout',
                targetFramesPerSecond: 30,
            },
            runtimeFrameLoopCounterDeltas: {
                cancelledCallbackCount: 1,
                fixedStepFailureCount: 0,
                invalidationFailureCount: 0,
                missedFrameReceiptCount: 0,
                ownedInvalidationCount: 30,
                postCalibrationFrameWakeupCount: 0,
                pendingFrameReceiptReconciliationWakeupCount: 0,
                productiveWakeupCount: 30,
                r3fFrameCallbackCount: 30,
                retainedTimeoutReconciliationWakeupCount: 0,
                scheduledCallbackCount: 31,
                unexpectedNoWorkWakeupCount: 0,
                wakeupCount: 30,
            },
        });
        setAvailableGpuSample(arrivalSample, {
            elapsedMs: 1_000,
            elapsedP95Ms: 15,
            elapsedTotalMs: 400,
            renderedFrames: 30,
        });
        return {
            arrivalIndex,
            fixture: {
                actorGroundingShadowDroppedCount: 0,
                blockCount: profile === 'high-target' ? 297 : 147,
                generatedPlantExpectedInstanceCount:
                    profile === 'high-target' ? 537 : null,
                generatedPlantFieldCount: profile === 'high-target' ? 54 : 0,
                generatedPlantInstanceCount:
                    profile === 'high-target' ? 537 : 0,
                generatedPlantVisibleFieldCount:
                    profile === 'high-target' ? 54 : 0,
                generatedPlantVisibleInstanceCount:
                    profile === 'high-target' ? 537 : 0,
                raisedBedCount: profile === 'high-target' ? 3 : 0,
                speciesCounts:
                    profile === 'high-target'
                        ? { bird: 2, cat: 1, dog: 1 }
                        : {
                              bird: 1,
                              cat: 1,
                              chicken: 1,
                              cow: 2,
                              dog: 1,
                              goat: 1,
                              horse: 1,
                              piglet: 1,
                              rabbit: 1,
                              sheep: 2,
                          },
                stackCount: profile === 'high-target' ? 270 : 117,
            },
            gardenId: profile === 'high-target' ? 99_996 : 99_995,
            profile,
            resources: {
                rendererGeometries: 200,
                rendererShaders: 24,
                rendererTextures: 11,
            },
            sample: arrivalSample,
            timing,
        };
    };
    const switchTiming = {
        dispatched: true,
        displayedMs: 350,
        hiddenObserved: true,
        settledMs: 900,
        settleTargetMs: 500,
        visibleMs: 380,
    };
    const arrivals = [
        arrival(1, 'high-target', { initial: true }),
        arrival(2, 'fauna-heavy', { ...switchTiming }),
        arrival(3, 'high-target', { ...switchTiming }),
        arrival(4, 'fauna-heavy', { ...switchTiming }),
        arrival(5, 'high-target', { ...switchTiming }),
        arrival(6, 'fauna-heavy', { ...switchTiming }),
        arrival(7, 'high-target', { ...switchTiming }),
    ];
    scenario.gardenSwitch = {
        arrivals,
        lifetimeResources: {
            measurementMode:
                'page-lifetime-webgl-program-texture-and-arrival-snapshot-geometry-v1',
            rendererGeometries: 200,
            rendererShaders: 24,
            rendererTextures: 11,
        },
    };
    return scenario;
}

function report({
    commit,
    harnessCommit = sharedHarnessCommit,
    scenarios,
    overrides = {},
}) {
    return {
        comparisonContractVersion: 6,
        generatedAt: '2026-08-30T00:00:00.000Z',
        options: {
            allowLegacyOperationVisuals: false,
            build: false,
            closeupRepeat: null,
            closeupTimeoutMs: 30_000,
            graphicsBackend: 'angle-metal',
            legacyOutlinePipeline: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarioSet: 'high-target',
            scenarios: [],
            screenshots: true,
            soakMs: 0,
            warmupMs: 5_000,
        },
        provenance: {
            comparable: true,
            harness: { commit: harnessCommit, dirty: false },
            reasons: [],
            runtime: {
                arch: 'arm64',
                browserVersion: 'Chromium/140',
                nodeVersion: 'v24.15.0',
                platform: 'darwin',
            },
            server: { buildPerformed: false, mode: 'external' },
            subject: {
                commit,
                dirty: false,
                source: 'served-build-marker',
            },
        },
        scenarios: scenarios.map((scenario) => ({
            ...scenario,
            servedBuildProvenance: {
                commit,
                comparisonContractVersion: 6,
                dirty: false,
            },
        })),
        schemaVersion: 6,
        sourceCommit: commit,
        ...overrides,
    };
}

function reportPair(scenarioFactory = normalScenario) {
    return {
        baseline: report({
            commit: baselineCommit,
            scenarios: [1, 2, 3].map(scenarioFactory),
        }),
        candidate: report({
            commit: candidateCommit,
            scenarios: [1, 2, 3].map(scenarioFactory),
        }),
    };
}

function independentRepeat(source) {
    const repeated = structuredClone(source);
    repeated.generatedAt = '2026-08-30T00:01:00.000Z';
    repeated.scenarios[0].domContentLoadedMs += 0.001;
    return repeated;
}

function independentBaselineRepeat(source) {
    const repeated = structuredClone(source);
    repeated.generatedAt = '2026-08-30T00:02:00.000Z';
    repeated.scenarios[0].domContentLoadedMs += 0.002;
    return repeated;
}

function comparePartialReports(baseline, candidate, options = {}) {
    return compareReports(baseline, candidate, {
        ...options,
        allowPartial: true,
    });
}

function compareConfirmedPartialReports(
    baseline,
    candidate,
    confirmation,
    options = {},
) {
    return compareConfirmedReports(baseline, candidate, confirmation, {
        ...options,
        allowPartial: true,
    });
}

const regressionBaseNames = [
    'game-cross-tier-low-steady-desktop',
    'game-cross-tier-low-camera-motion-desktop',
    'game-cross-tier-medium-steady-desktop',
    'game-cross-tier-medium-camera-motion-desktop',
    'game-cross-tier-high-steady-desktop',
    'game-cross-tier-high-camera-motion-desktop',
    'game-cross-tier-auto-standard-steady-desktop',
    'game-cross-tier-auto-standard-camera-motion-desktop',
    'game-cross-tier-auto-constrained-steady-desktop',
    'game-cross-tier-auto-constrained-camera-motion-desktop',
    'game-fauna-heavy-day-interaction-desktop',
    'game-garden-switch-high-fauna-single-context-desktop',
    'game-high-target-runtime-lifecycle-desktop',
];

const crossTierFixturePolicies = [
    {
        autoQualityDeviceClass: 'unspecified',
        dprCap: 1,
        groundDecorationDensity: 0,
        quality: 'low',
        shadowMapSize: 0,
        shadows: false,
        slug: 'low',
        tier: 'low',
    },
    {
        autoQualityDeviceClass: 'unspecified',
        dprCap: 1.5,
        groundDecorationDensity: 0.5,
        quality: 'medium',
        shadowMapSize: 2_048,
        shadows: true,
        slug: 'medium',
        tier: 'medium',
    },
    {
        autoQualityDeviceClass: 'unspecified',
        dprCap: 2,
        groundDecorationDensity: 1,
        quality: 'high',
        shadowMapSize: 4_096,
        shadows: true,
        slug: 'high',
        tier: 'high',
    },
    {
        autoQualityDeviceClass: 'standard',
        autoQualityMetrics: {
            coarsePointer: false,
            coreCount: 8,
            dpr: 2,
            memoryGb: 8,
            narrowViewport: false,
        },
        dprCap: 1.5,
        groundDecorationDensity: 0.5,
        quality: 'auto',
        shadowMapSize: 2_048,
        shadows: true,
        slug: 'auto-standard',
        tier: 'medium',
    },
    {
        autoQualityDeviceClass: 'constrained',
        autoQualityMetrics: {
            coarsePointer: false,
            coreCount: 4,
            dpr: 2,
            memoryGb: 4,
            narrowViewport: false,
        },
        dprCap: 1,
        groundDecorationDensity: 0.25,
        quality: 'auto',
        shadowMapSize: 1_024,
        shadows: true,
        slug: 'auto-constrained',
        tier: 'auto-constrained',
    },
];

function regressionScenario(baseName, profileRun) {
    let scenario;
    if (baseName === 'game-high-target-runtime-lifecycle-desktop') {
        scenario = lifecycleScenario(profileRun);
    } else if (
        baseName === 'game-garden-switch-high-fauna-single-context-desktop'
    ) {
        scenario = gardenSwitchScenario(profileRun);
    } else {
        scenario = normalScenario(profileRun);
    }
    scenario.baseName = baseName;
    scenario.name = `${baseName}-run-${profileRun}`;
    if (
        baseName.startsWith('game-cross-tier-') ||
        baseName === 'game-fauna-heavy-day-interaction-desktop'
    ) {
        scenario.requested.continuousRenderLeases = '1';
    }
    if (baseName.startsWith('game-cross-tier-')) {
        const policy = crossTierFixturePolicies.find(({ slug }) =>
            baseName.startsWith(`game-cross-tier-${slug}-`),
        );
        if (!policy) {
            throw new Error(`Missing fixture policy for ${baseName}`);
        }
        scenario.requested.crossTierProfile = true;
        scenario.requested.displayCadenceControl = {
            callbackTimestampMode: 'scheduled-phase-v1',
            framesPerSecond: 30,
            mode: 'profiler-owned-raf-v1',
            observedRateClock: 'native-wall-time-v1',
        };
        scenario.requested.autoQualityDeviceClass =
            policy.autoQualityDeviceClass;
        scenario.requested.autoQualityMetrics = structuredClone(
            policy.autoQualityMetrics ?? {
                coarsePointer: false,
                coreCount: 8,
                dpr: 2,
                memoryGb: 8,
                narrowViewport: false,
            },
        );
        scenario.requested.expectedAutoQualityMetrics =
            policy.autoQualityMetrics
                ? structuredClone(policy.autoQualityMetrics)
                : null;
        scenario.requested.expectedDprCap = policy.dprCap;
        scenario.requested.expectedGroundDecorationDensity =
            policy.groundDecorationDensity;
        scenario.requested.expectedQualityTier = policy.tier;
        scenario.requested.expectedShadowMapSize = policy.shadowMapSize;
        scenario.requested.expectedShadows = policy.shadows;
        scenario.requested.quality = policy.quality;
        scenario.path = scenario.path.replace(
            'quality=high',
            `quality=${policy.quality}`,
        );
        scenario.runtime.dprCap = policy.dprCap;
        scenario.runtime.groundDecorationDensity =
            policy.groundDecorationDensity;
        scenario.runtime.qualityTier = policy.tier;
        scenario.runtime.shadowMapSize = policy.shadowMapSize;
        scenario.runtime.shadowsEnabled = policy.shadows;
        scenario.runtime.runtimeFrameLoop = {
            activeLeaseCount: 10,
            targetFramesPerSecond: 30,
        };
        const expectedDpr = Math.min(scenario.requested.dpr, policy.dprCap);
        scenario.canvasReadyMs = 380;
        scenario.crossTierCold = {
            canvasAttachmentCount: 1,
            canvasAttachedMs: 310,
            canvasSize: {
                clientHeight: scenario.requested.viewport.height,
                clientWidth: scenario.requested.viewport.width,
                height: Math.round(
                    scenario.requested.viewport.height * expectedDpr,
                ),
                width: Math.round(
                    scenario.requested.viewport.width * expectedDpr,
                ),
            },
            canvasSizedMs: scenario.canvasReadyMs,
            domContentLoadedMs: 18,
            expectedDpr,
            firstCanvasPersistent: true,
            firstSubmittedFrameMs: 490,
            fixtureReadyMs: 580,
            hostCanvasReadyDiagnosticMs: 565,
            installedMs: 0,
            measurementMode: 'document-start-dpr-aware-canvas-and-fixture-v1',
            mutationObserverStopped: true,
            observationStoppedMs: 581,
            trackerInstalled: true,
        };
        scenario.crossTierResourceSnapshot = crossTierResourceSnapshot(
            scenario.runtime,
            policy.shadows
                ? undefined
                : {
                      populationAtEnd: {},
                      populationAtStart: {},
                      populationExposure: {},
                  },
        );
        scenario.sample = {
            ...scenario.sample,
            displayCadenceControl: displayCadenceControlSample(),
            elapsedMs: 5_000,
            frames: 300,
            gpu: {
                complete: true,
                disjoint: false,
                elapsedMaxMs: 18,
                elapsedP95Ms: 15,
                elapsedTotalMs: 1_500,
                reason: null,
                sampleCount: 150,
                supported: true,
                valid: true,
            },
            performanceMeasurementMode: 'separate-observer-free-window-v1',
            renderedFrames: 150,
            runtimeFrameLoopActiveLeaseCountAtEnd: 10,
            runtimeFrameLoopActiveLeaseCountMin: 10,
            runtimeFrameLoopActiveLeaseCountAtStart: 10,
            runtimeFrameLoopActiveLeaseCountMax: 10,
            runtimeFrameLoopAtEnd: {
                ...crossTierLeaseTopology(),
                effectiveVisible: true,
            },
            runtimeFrameLoopAtStart: {
                ...crossTierLeaseTopology(),
                effectiveVisible: true,
            },
            runtimeFrameLoopCounterDeltas: {
                r3fFrameCallbackCount: 150,
            },
            runtimeFrameLoopObservationCount: 303,
            runtimeFrameLoopObservationMode: 'separate-semantic-raf-window-v1',
            runtimeFrameLoopObservationRafFrameCount: 300,
            runtimeFrameLoopSemanticLeaseTopologyAtEnd:
                crossTierLeaseTopology(),
            runtimeFrameLoopSemanticLeaseTopologyAtStart:
                crossTierLeaseTopology(),
            runtimeFrameLoopTargetFramesPerSecondAtEnd: 30,
            runtimeFrameLoopTargetFramesPerSecondMin: 30,
            runtimeFrameLoopTargetFramesPerSecondAtStart: 30,
            runtimeFrameLoopTargetFramesPerSecondMax: 30,
        };
        const checkNames = buildCrossTierCheckNameInventory(baseName);
        scenario.acceptance = {
            checks: checkNames.acceptance.map((name) => ({ name, pass: true })),
            pass: true,
        };
        scenario.performanceBudget = {
            checks: checkNames.performance.map((name) => ({
                name,
                pass: true,
            })),
            pass: true,
        };
        scenario.budget = {
            checks: checkNames.budget.map((name) => ({ name, pass: true })),
            pass: true,
        };
    }
    if (baseName === 'game-fauna-heavy-day-interaction-desktop') {
        scenario.requested.faunaProfile = true;
        scenario.requested.gardenProfile = 'fauna-heavy';
        scenario.runtime.actorGroundingShadowSpeciesCounts = {
            bird: 1,
            cat: 1,
            chicken: 1,
            cow: 2,
            dog: 1,
            goat: 1,
            horse: 1,
            piglet: 1,
            rabbit: 1,
            sheep: 2,
        };
    }
    if (
        scenario.requested.crossTierProfile === true ||
        scenario.requested.faunaProfile === true
    ) {
        scenario.runtime.profileGardenStackCount = scenario.runtime.stackCount;
        scenario.runtime.profileGardenBlockCount = scenario.runtime.blockCount;
        scenario.runtime.profileGardenRaisedBedCount =
            scenario.runtime.raisedBedCount;
    }
    return scenario;
}

function regressionReport(commit) {
    const result = report({
        commit,
        scenarios: regressionBaseNames.flatMap((baseName) =>
            [1, 2, 3].map((profileRun) =>
                regressionScenario(baseName, profileRun),
            ),
        ),
    });
    result.options.scenarioSet = 'cross-tier,fauna,garden-switch,lifecycle';
    return result;
}

function regressionReportPair() {
    return {
        baseline: regressionReport(baselineCommit),
        candidate: regressionReport(candidateCommit),
    };
}

function butterflyPopulation(butterfly) {
    return {
        bee: 1,
        bird: 2,
        butterfly,
        cat: 1,
        dog: 1,
        ladybug: 5,
        squirrel: 1,
    };
}

function setCrossTierResourceEvidence(
    scenario,
    { endpointButterflies, exposureButterflies, geometries },
) {
    const endpoint = butterflyPopulation(endpointButterflies);
    scenario.crossTierResourceSnapshot.populationAtStart =
        structuredClone(endpoint);
    scenario.crossTierResourceSnapshot.populationAtEnd =
        structuredClone(endpoint);
    scenario.crossTierResourceSnapshot.populationExposure =
        butterflyPopulation(exposureButterflies);
    scenario.crossTierResourceSnapshot.populationExposureAtStart =
        butterflyPopulation(exposureButterflies);
    scenario.crossTierResourceSnapshot.populationExposureAtEnd =
        butterflyPopulation(exposureButterflies);
    scenario.crossTierResourceSnapshot.populationExposureAvailable = true;
    scenario.crossTierResourceSnapshot.populationExposureSignature =
        JSON.stringify(butterflyPopulation(exposureButterflies));
    scenario.crossTierResourceSnapshot.resources.rendererGeometries =
        geometries;
}

function applyLegacyHeartbeatSchedulerEvidence(reportValue) {
    const requiredFailures = new Set([
        'crossTierSampleStartActiveLeaseCount',
        'crossTierSemanticLeaseTopologyAvailable',
        'crossTierSemanticStartLeaseTopologyCount',
        'crossTierSemanticEndLeaseTopologyCount',
        'crossTierRenderedFramesMatchR3fFrameCallbackDelta',
    ]);
    reportValue.options.legacyOutlinePipeline = true;
    for (const scenario of reportValue.scenarios) {
        if (
            scenario.baseName ===
            'game-garden-switch-high-fauna-single-context-desktop'
        ) {
            for (const arrival of scenario.gardenSwitch.arrivals) {
                const deltas = arrival.sample.runtimeFrameLoopCounterDeltas;
                delete deltas.postCalibrationFrameWakeupCount;
                delete deltas.pendingFrameReceiptReconciliationWakeupCount;
                delete deltas.productiveWakeupCount;
                delete deltas.retainedTimeoutReconciliationWakeupCount;
                delete deltas.unexpectedNoWorkWakeupCount;
                delete arrival.sample.runtimeFrameLoopAtStart
                    .awaitingFrameReceipt;
                delete arrival.sample.runtimeFrameLoopAtEnd
                    .awaitingFrameReceipt;
            }
        }
        if (
            scenario.baseName.startsWith('game-cross-tier-') ||
            scenario.baseName === 'game-fauna-heavy-day-interaction-desktop'
        ) {
            delete scenario.requested.continuousRenderLeases;
        }
        if (scenario.baseName.startsWith('game-cross-tier-')) {
            scenario.crossTierResourceSnapshot.rendererStatsMode =
                'legacy-pre-render-settled-v1';
            scenario.crossTierResourceSnapshot.resources.rendererStatsMeasurement =
                rendererStatsMeasurement('legacy-pre-render-settled-v1');
        }
        if (!scenario.baseName.startsWith('game-cross-tier-')) {
            if (
                scenario.baseName ===
                'game-high-target-runtime-lifecycle-desktop'
            ) {
                for (const resources of lifecycleResourceWitnesses(scenario)) {
                    resources.rendererStatsMeasurement = {
                        ...resources.rendererStatsMeasurement,
                        legacySettleMs: 600,
                        measurementMode: 'legacy-pre-render-settled-v1',
                        rendererStatsPublishedAt: null,
                        rendererStatsReceiptCount: null,
                        rendererStatsReceiptDelta: null,
                        rendererStatsRenderFrame: null,
                        r3fFrameCallbackCountDelta: null,
                        runtimeMeasurementMode: null,
                    };
                }
                delete scenario.lifecycle.active.runtimeFrameLoop
                    .awaitingFrameReceipt;
            }
            continue;
        }
        scenario.requested.legacyOutlinePipeline = true;
        scenario.runtime.runtimeFrameLoop.activeLeaseCount = 0;
        scenario.sample.renderedFps = 30;
        scenario.sample.runtimeFrameLoopActiveLeaseCountAtEnd = 0;
        scenario.sample.runtimeFrameLoopActiveLeaseCountMin = 0;
        scenario.sample.runtimeFrameLoopActiveLeaseCountAtStart = 0;
        scenario.sample.runtimeFrameLoopActiveLeaseCountMax = 0;
        scenario.sample.runtimeFrameLoopAtEnd = {
            activeLeaseCount: 0,
            effectiveVisible: true,
            loopActive: true,
            targetFramesPerSecond: 30,
        };
        scenario.sample.runtimeFrameLoopAtStart = structuredClone(
            scenario.sample.runtimeFrameLoopAtEnd,
        );
        scenario.sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount =
            null;
        scenario.sample.runtimeFrameLoopSemanticLeaseTopologyAtEnd = null;
        scenario.sample.runtimeFrameLoopSemanticLeaseTopologyAtStart = null;
        const checkNames = buildCrossTierCheckNameInventory(scenario.baseName, {
            legacyOutlinePipeline: true,
        });
        const expectedFailures = new Set(requiredFailures);
        scenario.acceptance = {
            checks: checkNames.acceptance.map((name) => ({
                name,
                pass: !expectedFailures.has(name),
            })),
            pass: false,
        };
        scenario.performanceBudget = {
            checks: checkNames.performance.map((name) => ({
                name,
                pass: true,
            })),
            pass: true,
        };
        scenario.budget = {
            checks: checkNames.budget.map((name) => ({
                name,
                pass: !expectedFailures.has(name),
            })),
            pass: false,
        };
    }
    return reportValue;
}

function setLegacyCrossTierRenderedFps(reportValue, baseName, renderedFps) {
    for (const scenario of reportValue.scenarios.filter(
        (value) => value.baseName === baseName,
    )) {
        scenario.sample.renderedFps = renderedFps;
        const renderedFpsPass = renderedFps <= 32;
        for (const result of [scenario.acceptance, scenario.budget]) {
            const check = result.checks.find(
                ({ name }) => name === 'crossTierRenderedFps',
            );
            check.pass = renderedFpsPass;
        }
    }
}

test('cross-tier acceptance inventories distinguish cached and legacy outline evidence', () => {
    const baseName = 'game-cross-tier-high-steady-desktop';
    const cached = buildCrossTierCheckNameInventory(baseName);
    const legacy = buildCrossTierCheckNameInventory(baseName, {
        legacyOutlinePipeline: true,
    });
    const expectedPrefix = [
        'crossTierGardenProfile',
        'crossTierDisplayCadenceControlMode',
        'crossTierDisplayCadenceControlTargetFramesPerSecond',
        'crossTierDisplayCadenceControlInstalledAtStart',
        'crossTierDisplayCadenceControlInstalledAtEnd',
        'crossTierDisplayCadenceControlObservedMode',
        'crossTierDisplayCadenceControlObservedTargetFramesPerSecond',
        'crossTierDisplayCadenceControlObservedFramesPerSecond',
        'crossTierDisplayCadenceControlRequestedCallbackTimestampMode',
        'crossTierDisplayCadenceControlRequestedObservedRateClock',
        'crossTierDisplayCadenceControlObservedCallbackTimestampMode',
        'crossTierDisplayCadenceControlObservedRateClock',
        'crossTierDisplayCadenceControlIntervalMs',
        'crossTierDisplayCadenceControlStartPhaseTimestamp',
        'crossTierDisplayCadenceControlEndPhaseTimestamp',
        'crossTierDisplayCadenceControlDeliveredFrameCount',
        'crossTierDisplayCadenceControlSkippedPhaseCount',
        'crossTierDisplayCadenceControlPhaseAdvanceConservation',
        'crossTierQualityRequest',
        'crossTierQualityTier',
    ];

    assert.deepEqual(
        cached.acceptance.slice(0, expectedPrefix.length),
        expectedPrefix,
    );
    assert.deepEqual(
        legacy.acceptance.slice(0, expectedPrefix.length),
        expectedPrefix,
    );

    assert.equal(
        cached.acceptance.includes('crossTierOutlinePerformanceWindowHits'),
        true,
    );
    assert.equal(
        cached.acceptance.includes(
            'crossTierOutlineSemanticWindowCompositeConservation',
        ),
        true,
    );
    assert.equal(
        cached.acceptance.includes(
            'crossTierOutlineLegacyHorizontalPassAlignment',
        ),
        false,
    );
    assert.equal(
        legacy.acceptance.includes(
            'crossTierOutlineLegacyHorizontalPassAlignment',
        ),
        true,
    );
    assert.equal(
        legacy.acceptance.includes('crossTierOutlinePerformanceWindowHits'),
        false,
    );
});

test('v6 cross-tier display cadence evidence fails closed on raw control drift', async (t) => {
    const firstCrossTierScenario = (reportValue) =>
        reportValue.scenarios.find((scenario) =>
            scenario.baseName.startsWith('game-cross-tier-'),
        );
    const cases = {
        'symmetric missing request': ({ baseline, candidate }) => {
            delete firstCrossTierScenario(baseline).requested
                .displayCadenceControl;
            delete firstCrossTierScenario(candidate).requested
                .displayCadenceControl;
        },
        'symmetric missing sample control': ({ baseline, candidate }) => {
            delete firstCrossTierScenario(baseline).sample
                .displayCadenceControl;
            delete firstCrossTierScenario(candidate).sample
                .displayCadenceControl;
        },
        'requested mode drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).requested.displayCadenceControl.mode = 'browser-native-raf';
        },
        'requested callback timestamp mode drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).requested.displayCadenceControl.callbackTimestampMode =
                'native-timestamp';
        },
        'requested observed-rate clock drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).requested.displayCadenceControl.observedRateClock =
                'scheduled-phase';
        },
        'requested target drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).requested.displayCadenceControl.framesPerSecond = 60;
        },
        'summary installation drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.installedAtEnd = false;
        },
        'summary mode drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.mode = 'browser-native-raf';
        },
        'summary callback timestamp mode drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.callbackTimestampMode =
                'native-timestamp';
        },
        'summary observed-rate clock drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.observedRateClock =
                'scheduled-phase';
        },
        'summary target drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.requestedFramesPerSecond = 60;
        },
        'missing raw start snapshot': ({ candidate }) => {
            delete firstCrossTierScenario(candidate).sample
                .displayCadenceControl.atStart;
        },
        'raw mode drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atStart.mode = 'browser-native-raf';
        },
        'raw callback timestamp mode drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atStart.callbackTimestampMode =
                'native-timestamp';
        },
        'raw observed-rate clock drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.observedRateClock =
                'scheduled-phase';
        },
        'raw target drift': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.requestedFramesPerSecond = 60;
        },
        'raw installation failure': ({ candidate }) => {
            const snapshot =
                firstCrossTierScenario(candidate).sample.displayCadenceControl
                    .atStart;
            snapshot.installed = false;
            snapshot.installationError = 'installation failed';
        },
        'raw non-null installation error': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.installationError =
                'installation failed';
        },
        'raw counter rollback': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.deliveredFrameCount = 499;
        },
        'raw skipped-phase counter rollback': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.skippedPhaseCount = 3;
        },
        'raw first-delivery timestamp drift': ({ candidate }) => {
            const snapshot =
                firstCrossTierScenario(candidate).sample.displayCadenceControl
                    .atEnd;
            snapshot.firstDeliveredAt += 100;
            snapshot.observedFramesPerSecond =
                Math.round(
                    (((snapshot.deliveredFrameCount - 1) * 1_000) /
                        (snapshot.lastDeliveredAt -
                            snapshot.firstDeliveredAt)) *
                        100,
                ) / 100;
        },
        'raw interval drift from sample summary': ({ candidate }) => {
            const control =
                firstCrossTierScenario(candidate).sample.displayCadenceControl;
            control.atStart.intervalMs += 0.000_1;
            control.atEnd.intervalMs += 0.000_1;
        },
        'raw lifetime skipped-phase inflation': ({ candidate }) => {
            const control =
                firstCrossTierScenario(candidate).sample.displayCadenceControl;
            control.atStart.skippedPhaseCount += 100;
            control.atEnd.skippedPhaseCount += 100;
        },
        'missing raw phase timestamp': ({ candidate }) => {
            delete firstCrossTierScenario(candidate).sample
                .displayCadenceControl.atStart.lastDeliveredPhaseAt;
        },
        'raw native timestamps out of order': ({ candidate }) => {
            const snapshot =
                firstCrossTierScenario(candidate).sample.displayCadenceControl
                    .atEnd;
            snapshot.lastDeliveredAt = snapshot.firstDeliveredAt - 1;
        },
        'raw phase timestamps out of order': ({ candidate }) => {
            const snapshot =
                firstCrossTierScenario(candidate).sample.displayCadenceControl
                    .atEnd;
            snapshot.lastDeliveredPhaseAt = snapshot.firstDeliveredPhaseAt - 1;
        },
        'callback phase after native delivery': ({ candidate }) => {
            const snapshot =
                firstCrossTierScenario(candidate).sample.displayCadenceControl
                    .atEnd;
            snapshot.lastDeliveredPhaseAt = snapshot.lastDeliveredAt + 1;
        },
        'raw observed-rate derivation mismatch': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.observedFramesPerSecond = 1;
        },
        'published delta mismatch': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.nativeFrameCountDelta = 299;
        },
        'published skipped-phase delta mismatch': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.skippedPhaseCountDelta = 1;
        },
        'phase advance mismatch': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.atEnd.lastDeliveredPhaseAt += 1;
        },
        'missing positive delivery delta': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.deliveredFrameCountDelta = 0;
        },
        'missing positive native delta': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.nativeFrameCountDelta = 0;
        },
        'sample elapsed mismatch': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.elapsedMs = 4_999;
        },
        'derived observed rate mismatch': ({ candidate }) => {
            firstCrossTierScenario(
                candidate,
            ).sample.displayCadenceControl.observedFramesPerSecond = 29;
        },
    };

    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            mutate(pair);

            const comparison = compareReports(pair.baseline, pair.candidate);

            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(
                comparison.validationErrors.join('\n'),
                /displayCadenceControl|cadence control/i,
            );
        });
    }
});

test('v6 cross-tier cadence inventory is exact and controlled-rate bounds are inclusive', () => {
    const missingInventoryPair = regressionReportPair();
    const scenario = missingInventoryPair.candidate.scenarios.find((value) =>
        value.baseName.startsWith('game-cross-tier-'),
    );
    for (const result of [scenario.acceptance, scenario.budget]) {
        result.checks = result.checks.filter(
            ({ name }) =>
                name !==
                'crossTierDisplayCadenceControlPhaseAdvanceConservation',
        );
    }
    const missingInventory = compareReports(
        missingInventoryPair.baseline,
        missingInventoryPair.candidate,
    );
    assert.equal(missingInventory.status, 'invalid');
    assert.match(
        missingInventory.validationErrors.join('\n'),
        /check name inventory/,
    );

    for (const [observedFramesPerSecond, deliveredFrameCountDelta] of [
        [28, 140],
        [32, 160],
    ]) {
        const pair = regressionReportPair();
        const control = pair.candidate.scenarios.find((value) =>
            value.baseName.startsWith('game-cross-tier-'),
        ).sample.displayCadenceControl;
        control.observedFramesPerSecond = observedFramesPerSecond;
        control.deliveredFrameCountDelta = deliveredFrameCountDelta;
        control.atEnd.deliveredFrameCount =
            control.atStart.deliveredFrameCount + deliveredFrameCountDelta;
        control.atEnd.lastDeliveredPhaseAt =
            control.atStart.lastDeliveredPhaseAt +
            (deliveredFrameCountDelta + control.skippedPhaseCountDelta) *
                control.intervalMs;
        control.atEnd.lastDeliveredAt =
            control.atEnd.lastDeliveredPhaseAt + 0.25;

        assert.notEqual(
            compareReports(pair.baseline, pair.candidate).status,
            'invalid',
        );
    }

    const roundedElapsedPair = regressionReportPair();
    roundedElapsedPair.candidate.scenarios.find((value) =>
        value.baseName.startsWith('game-cross-tier-'),
    ).sample.displayCadenceControl.elapsedMs = 5_000.01;
    assert.notEqual(
        compareReports(
            roundedElapsedPair.baseline,
            roundedElapsedPair.candidate,
        ).status,
        'invalid',
    );
});

test('legacy heartbeat baseline contract preserves strict candidate evidence', () => {
    const pair = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(pair.baseline);

    const rejectedWithoutContract = compareReports(
        pair.baseline,
        pair.candidate,
    );
    assert.equal(rejectedWithoutContract.status, 'invalid');
    assert.match(
        rejectedWithoutContract.validationErrors.join('\n'),
        /acceptance\.pass is not true|active lease counts/,
    );

    const acceptedLegacyBaseline = compareReports(
        pair.baseline,
        pair.candidate,
        { baselineSchedulerContract: 'legacy-heartbeat-v1' },
    );
    assert.equal(acceptedLegacyBaseline.status, 'needs-rerun');
    assert.equal(acceptedLegacyBaseline.comparable, true);
    assert.deepEqual(acceptedLegacyBaseline.validationErrors, []);
    assert.equal(
        acceptedLegacyBaseline.baseline.schedulerContract,
        'legacy-heartbeat-v1',
    );
    assert.equal(
        acceptedLegacyBaseline.candidate.schedulerContract,
        'canonical-v1',
    );
});

test('legacy continuous-render lease compatibility is limited to cross-tier and fauna requests', async (t) => {
    await t.test(
        'omitted and null legacy values match exact canonical one',
        () => {
            const pair = regressionReportPair();
            applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
            for (const scenario of pair.baseline.scenarios) {
                if (
                    scenario.baseName.startsWith('game-cross-tier-') ||
                    scenario.baseName ===
                        'game-fauna-heavy-day-interaction-desktop'
                ) {
                    if (scenario.profileRun === 1) {
                        scenario.requested.continuousRenderLeases = null;
                    } else {
                        delete scenario.requested.continuousRenderLeases;
                    }
                }
            }

            const comparison = compareReports(pair.baseline, pair.candidate, {
                baselineSchedulerContract: 'legacy-heartbeat-v1',
            });

            assert.equal(comparison.status, 'needs-rerun');
            assert.equal(comparison.comparable, true);
            assert.deepEqual(comparison.validationErrors, []);
        },
    );

    for (const { name, mutate, pattern, schedulerContract } of [
        {
            name: 'legacy cross-tier non-null drift',
            mutate: ({ baseline }) => {
                baseline.scenarios.find((scenario) =>
                    scenario.baseName.startsWith('game-cross-tier-'),
                ).requested.continuousRenderLeases = '1';
            },
            pattern:
                /legacy heartbeat requested\.continuousRenderLeases must be omitted or null/,
        },
        {
            name: 'legacy fauna non-null drift',
            mutate: ({ baseline }) => {
                baseline.scenarios.find(
                    (scenario) =>
                        scenario.baseName ===
                        'game-fauna-heavy-day-interaction-desktop',
                ).requested.continuousRenderLeases = '0';
            },
            pattern:
                /legacy heartbeat requested\.continuousRenderLeases must be omitted or null/,
        },
        {
            name: 'missing canonical candidate value',
            mutate: ({ candidate }) => {
                delete candidate.scenarios.find((scenario) =>
                    scenario.baseName.startsWith('game-cross-tier-'),
                ).requested.continuousRenderLeases;
            },
            pattern: /canonical requested\.continuousRenderLeases must be "1"/,
        },
        {
            name: 'wrong canonical candidate value',
            mutate: ({ candidate }) => {
                candidate.scenarios.find(
                    (scenario) =>
                        scenario.baseName ===
                        'game-fauna-heavy-day-interaction-desktop',
                ).requested.continuousRenderLeases = '0';
            },
            pattern: /canonical requested\.continuousRenderLeases must be "1"/,
        },
        {
            name: 'canonical baseline omission',
            schedulerContract: 'canonical-v1',
            mutate: ({ baseline }) => {
                delete baseline.scenarios.find((scenario) =>
                    scenario.baseName.startsWith('game-cross-tier-'),
                ).requested.continuousRenderLeases;
            },
            pattern: /canonical requested\.continuousRenderLeases must be "1"/,
        },
        {
            name: 'garden-switch mismatch',
            mutate: ({ candidate }) => {
                candidate.scenarios.find(
                    (scenario) =>
                        scenario.baseName ===
                        'game-garden-switch-high-fauna-single-context-desktop',
                ).requested.continuousRenderLeases = '1';
            },
            pattern: /scenario\.requested differs/,
        },
        {
            name: 'lifecycle mismatch',
            mutate: ({ candidate }) => {
                candidate.scenarios.find(
                    (scenario) =>
                        scenario.baseName ===
                        'game-high-target-runtime-lifecycle-desktop',
                ).requested.continuousRenderLeases = '1';
            },
            pattern: /scenario\.requested differs/,
        },
        {
            name: 'other cross-tier request mismatch',
            mutate: ({ candidate }) => {
                candidate.scenarios.find((scenario) =>
                    scenario.baseName.startsWith('game-cross-tier-'),
                ).requested.controls = '1';
            },
            pattern: /scenario\.requested differs/,
        },
    ]) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            if (schedulerContract !== 'canonical-v1') {
                applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
            }
            mutate(pair);

            const comparison = compareReports(pair.baseline, pair.candidate, {
                baselineSchedulerContract:
                    schedulerContract ?? 'legacy-heartbeat-v1',
            });

            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(comparison.validationErrors.join('\n'), pattern);
        });
    }
});

test('v6 legacy heartbeat baseline compares controlled cross-tier GPU evidence directly', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);

    const comparison = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        {
            baselineConfirmation,
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
    assert.equal(comparison.diagnostic, false);
    assert.equal(comparison.comparisonContractVersion, 6);
    assert.equal(comparison.schemaVersion, 3);
    assert.equal(comparison.summary.cadenceConfoundedComparisons, 0);
    assert.equal(
        comparison.baselineConfirmation.schedulerContract,
        'legacy-heartbeat-v1',
    );
    assert.match(
        buildMarkdown(comparison),
        /Baseline scheduler contract: legacy-heartbeat-v1/,
    );
    const crossTierGpu = comparison.comparisons.filter(
        ({ id, scenario }) =>
            id === 'gpu.p95_ms' && scenario.startsWith('game-cross-tier-'),
    );
    assert.equal(crossTierGpu.length, 10);
    assert.equal(
        crossTierGpu.every(
            ({ controlScenario, decisionStatus, gateBasis, replications }) =>
                controlScenario === null &&
                decisionStatus === 'comparable' &&
                gateBasis === 'matched-cadence' &&
                replications.every(
                    (replication) =>
                        replication.decisionStatus === 'comparable' &&
                        replication.gateBasis === 'matched-cadence',
                ),
        ),
        true,
    );
    assert.doesNotMatch(
        buildMarkdown(comparison),
        /## Cadence-confounded GPU diagnostics/,
    );
});

test('v6 rejects raw legacy motion outside the controlled cadence range', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    setLegacyCrossTierRenderedFps(
        baseline,
        'game-cross-tier-high-camera-motion-desktop',
        37,
    );
    for (const scenario of baseline.scenarios.filter(
        ({ baseName }) =>
            baseName === 'game-cross-tier-high-camera-motion-desktop',
    )) {
        for (const result of [scenario.acceptance, scenario.budget]) {
            result.checks.find(
                ({ name }) => name === 'crossTierRenderedFps',
            ).pass = true;
        }
    }
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);

    const comparison = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        {
            baselineConfirmation,
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );

    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /game-cross-tier-high-camera-motion-desktop GPU p95 comparison cadence requires every baseline and candidate raw sample at 28-32 FPS and a bundle-median delta no greater than 2 FPS/,
    );
    assert.equal(comparison.summary.cadenceConfoundedComparisons, 0);
    assert.equal(
        comparison.comparisons.some(
            ({ gateBasis }) => gateBasis === 'cadence-confounded',
        ),
        false,
    );
});

test('v6 direct cross-tier GPU evidence retains strict timing validation', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    baseline.scenarios.find(
        ({ baseName, profileRun }) =>
            baseName === 'game-cross-tier-high-camera-motion-desktop' &&
            profileRun === 1,
    ).sample.gpu.sampleCount -= 1;
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);

    const comparison = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        {
            baselineConfirmation,
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );

    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /GPU timing marked valid requires/,
    );
});

test('v6 controlled cadence must hold across all four bundle pairings', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    const baselineConfirmation = independentBaselineRepeat(baseline);
    setLegacyCrossTierRenderedFps(
        baselineConfirmation,
        'game-cross-tier-high-camera-motion-desktop',
        33,
    );
    for (const scenario of baselineConfirmation.scenarios.filter(
        ({ baseName }) =>
            baseName === 'game-cross-tier-high-camera-motion-desktop',
    )) {
        for (const result of [scenario.acceptance, scenario.budget]) {
            result.checks.find(
                ({ name }) => name === 'crossTierRenderedFps',
            ).pass = true;
        }
    }
    const confirmation = independentRepeat(candidate);

    const comparison = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        {
            baselineConfirmation,
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );

    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /game-cross-tier-high-camera-motion-desktop GPU p95 comparison cadence requires every baseline and candidate raw sample at 28-32 FPS and a bundle-median delta no greater than 2 FPS/,
    );
});

test('legacy outline-pipeline compatibility is baseline-only and explicit', async (t) => {
    for (const [name, mutate, options] of [
        [
            'canonical candidate true',
            ({ candidate }) => {
                candidate.options.legacyOutlinePipeline = true;
            },
            {},
        ],
        [
            'canonical candidate missing',
            ({ candidate }) => {
                delete candidate.options.legacyOutlinePipeline;
            },
            {},
        ],
        [
            'legacy baseline false',
            (pair) => {
                applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
                pair.baseline.options.legacyOutlinePipeline = false;
            },
            { baselineSchedulerContract: 'legacy-heartbeat-v1' },
        ],
    ]) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            mutate(pair);
            const comparison = compareReports(
                pair.baseline,
                pair.candidate,
                options,
            );
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(
                comparison.validationErrors.join('\n'),
                /legacyOutlinePipeline/,
            );
        });
    }
});

test('legacy heartbeat baseline contract rejects drift and cannot relax candidates', async (t) => {
    const cases = {
        'deleted passed baseline witness': ({ baseline }) => {
            const scenario = baseline.scenarios.find((value) =>
                value.baseName.startsWith('game-cross-tier-'),
            );
            scenario.acceptance.checks = scenario.acceptance.checks.filter(
                ({ name }) => name !== 'crossTierScreenshotEntropy',
            );
            scenario.budget.checks = scenario.budget.checks.filter(
                ({ name }) => name !== 'crossTierScreenshotEntropy',
            );
        },
        'symmetric deleted witness': ({ baseline, candidate }) => {
            for (const reportValue of [baseline, candidate]) {
                const scenario = reportValue.scenarios.find((value) =>
                    value.baseName.startsWith('game-cross-tier-'),
                );
                scenario.acceptance.checks = scenario.acceptance.checks.filter(
                    ({ name }) => name !== 'crossTierApiErrors',
                );
                scenario.budget.checks = scenario.budget.checks.filter(
                    ({ name }) => name !== 'crossTierApiErrors',
                );
            }
        },
        'extra baseline failure': ({ baseline }) => {
            const scenario = baseline.scenarios.find((value) =>
                value.baseName.startsWith('game-cross-tier-'),
            );
            scenario.acceptance.checks.push({
                name: 'crossTierScreenshotWitnessValid',
                pass: false,
            });
            scenario.budget.checks.push({
                name: 'crossTierScreenshotWitnessValid',
                pass: false,
            });
        },
        'legacy lease drift': ({ baseline }) => {
            const scenario = baseline.scenarios.find((value) =>
                value.baseName.startsWith('game-cross-tier-'),
            );
            scenario.sample.runtimeFrameLoopActiveLeaseCountMax = 1;
        },
        'legacy FPS underdelivery': ({ baseline }) => {
            const scenario = baseline.scenarios.find((value) =>
                value.baseName.startsWith('game-cross-tier-'),
            );
            scenario.sample.renderedFps = 27;
        },
        'legacy subject equals harness': ({ baseline }) => {
            baseline.provenance.harness.commit =
                baseline.provenance.subject.commit;
        },
        'candidate uses legacy evidence': ({ candidate }) => {
            applyLegacyHeartbeatSchedulerEvidence(candidate);
        },
        'legacy lifecycle exposes canonical receipt telemetry': ({
            baseline,
        }) => {
            const lifecycle = baseline.scenarios.find(
                (scenario) =>
                    scenario.baseName ===
                    'game-high-target-runtime-lifecycle-desktop',
            );
            lifecycle.lifecycle.active.runtimeFrameLoop.awaitingFrameReceipt = false;
        },
        'candidate lifecycle omits canonical receipt telemetry': ({
            candidate,
        }) => {
            const lifecycle = candidate.scenarios.find(
                (scenario) =>
                    scenario.baseName ===
                    'game-high-target-runtime-lifecycle-desktop',
            );
            delete lifecycle.lifecycle.active.runtimeFrameLoop
                .awaitingFrameReceipt;
        },
    };

    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
            mutate(pair);
            const comparison = compareReports(pair.baseline, pair.candidate, {
                baselineSchedulerContract: 'legacy-heartbeat-v1',
            });
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
        });
    }

    const pair = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
    const partial = compareReports(pair.baseline, pair.candidate, {
        allowPartial: true,
        baselineSchedulerContract: 'legacy-heartbeat-v1',
    });
    assert.equal(partial.status, 'invalid');
    assert.match(
        partial.validationErrors.join('\n'),
        /requires the complete canonical manifest/,
    );
    const sameSourceMode = compareReports(pair.baseline, pair.candidate, {
        allowSameSource: true,
        baselineSchedulerContract: 'legacy-heartbeat-v1',
    });
    assert.equal(sameSourceMode.status, 'invalid');
    assert.match(
        sameSourceMode.validationErrors.join('\n'),
        /cannot use same-source comparison mode/,
    );

    const bypassPair = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(bypassPair.baseline);
    applyLegacyHeartbeatSchedulerEvidence(bypassPair.candidate);
    const candidateBypass = compareReports(
        bypassPair.baseline,
        bypassPair.candidate,
        {
            baselineSchedulerContract: 'legacy-heartbeat-v1',
            candidateSchedulerContract: 'legacy-heartbeat-v1',
        },
    );
    assert.equal(candidateBypass.status, 'invalid');
});

test('canonical regression manifest is required outside diagnostic mode', () => {
    const partial = reportPair();
    const rejectedPartial = compareReports(partial.baseline, partial.candidate);
    assert.equal(rejectedPartial.status, 'invalid');
    assert.match(
        rejectedPartial.validationErrors.join('\n'),
        /regression scenario manifest|scenarioSet/,
    );
    assert.equal(
        comparePartialReports(partial.baseline, partial.candidate).status,
        'pass',
    );

    let complete = regressionReportPair();
    const singlePair = compareReports(complete.baseline, complete.candidate);
    assert.equal(singlePair.status, 'needs-rerun');
    assert.equal(singlePair.exitCode, 1);
    assert.equal(singlePair.diagnostic, true);
    assert.deepEqual(singlePair.diagnosticReasons, [
        'single comparison pair only',
    ]);

    complete = regressionReportPair();
    complete.baseline.scenarios = complete.baseline.scenarios.filter(
        (scenario) => scenario.profileRun === 1,
    );
    complete.candidate.scenarios = complete.candidate.scenarios.filter(
        (scenario) => scenario.profileRun === 1,
    );
    assert.equal(
        compareReports(complete.baseline, complete.candidate).exitCode,
        2,
    );

    complete = regressionReportPair();
    complete.baseline.scenarios = complete.baseline.scenarios.filter(
        (scenario) => !scenario.baseName.includes('fauna-heavy-day'),
    );
    complete.candidate.scenarios = complete.candidate.scenarios.filter(
        (scenario) => !scenario.baseName.includes('fauna-heavy-day'),
    );
    assert.equal(
        compareReports(complete.baseline, complete.candidate).exitCode,
        2,
    );
});

test('canonical release comparison requires a symmetric 2x2 matrix through the API', () => {
    const { baseline, candidate } = regressionReportPair();
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);

    for (const policy of crossTierFixturePolicies) {
        const scenario = baseline.scenarios.find(
            (item) =>
                item.baseName.startsWith(`game-cross-tier-${policy.slug}-`) &&
                item.profileRun === 1,
        );
        assert.equal(scenario.requested.quality, policy.quality);
        assert.equal(scenario.runtime.qualityTier, policy.tier);
        assert.equal(scenario.runtime.dprCap, policy.dprCap);
        assert.equal(
            scenario.runtime.groundDecorationDensity,
            policy.groundDecorationDensity,
        );
        assert.equal(scenario.runtime.shadowMapSize, policy.shadowMapSize);
        assert.equal(scenario.runtime.shadowsEnabled, policy.shadows);
    }

    const incomplete = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
    );
    assert.equal(incomplete.status, 'invalid');
    assert.equal(incomplete.exitCode, 2);
    assert.match(
        incomplete.validationErrors.join('\n'),
        /baseline confirmation is required/,
    );

    const complete = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        { baselineConfirmation },
    );
    assert.equal(complete.status, 'pass');
    assert.equal(complete.exitCode, 0);
    assert.equal(complete.diagnostic, false);
    assert.deepEqual(complete.diagnosticReasons, []);
    assert.equal(complete.summary.comparisonPairCount, 4);
});

test('canonical garden-switch release evidence requires complete workflow GPU timing', () => {
    const { baseline, candidate } = regressionReportPair();
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);
    for (const report of [
        baseline,
        baselineConfirmation,
        candidate,
        confirmation,
    ]) {
        const scenario = report.scenarios.find(
            (item) =>
                item.baseName ===
                'game-garden-switch-high-fauna-single-context-desktop',
        );
        for (const arrival of scenario.gardenSwitch.arrivals) {
            arrival.sample.gpu = sample().gpu;
            delete arrival.sample.elapsedMs;
            delete arrival.sample.renderedFrames;
        }
    }

    const comparison = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        { baselineConfirmation },
    );

    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /GPU elapsed-workflow occupancy timing is required for confirmed release evidence/,
    );
});

test('canonical nested policy and fixture evidence fails closed', async (t) => {
    const mutateScenario = (pair, baseName, mutate) => {
        for (const report of [pair.baseline, pair.candidate]) {
            const scenario = report.scenarios.find(
                (item) => item.baseName === baseName,
            );
            mutate(scenario);
        }
    };
    const cases = {
        'cross-tier requested tier policy': (pair) => {
            mutateScenario(
                pair,
                'game-cross-tier-low-steady-desktop',
                (scenario) => {
                    scenario.requested.quality = 'high';
                },
            );
        },
        'cross-tier runtime tier policy': (pair) => {
            mutateScenario(
                pair,
                'game-cross-tier-medium-steady-desktop',
                (scenario) => {
                    scenario.runtime.qualityTier = 'high';
                },
            );
        },
        'cross-tier automatic input policy': (pair) => {
            mutateScenario(
                pair,
                'game-cross-tier-auto-constrained-steady-desktop',
                (scenario) => {
                    scenario.requested.autoQualityMetrics.coreCount = 8;
                    scenario.requested.expectedAutoQualityMetrics.coreCount = 8;
                },
            );
        },
        'cross-tier browser DPR': (pair) => {
            mutateScenario(
                pair,
                'game-cross-tier-high-steady-desktop',
                (scenario) => {
                    delete scenario.requested.dpr;
                },
            );
        },
        'fauna browser DPR': (pair) => {
            mutateScenario(
                pair,
                'game-fauna-heavy-day-interaction-desktop',
                (scenario) => {
                    delete scenario.requested.dpr;
                },
            );
        },
        'lifecycle browser DPR': (pair) => {
            mutateScenario(
                pair,
                'game-high-target-runtime-lifecycle-desktop',
                (scenario) => {
                    delete scenario.runtime.browserDpr;
                },
            );
        },
        'fauna species': (pair) => {
            mutateScenario(
                pair,
                'game-fauna-heavy-day-interaction-desktop',
                (scenario) => {
                    delete scenario.runtime.actorGroundingShadowSpeciesCounts;
                },
            );
        },
        'switch fixture': (pair) => {
            mutateScenario(
                pair,
                'game-garden-switch-high-fauna-single-context-desktop',
                (scenario) => {
                    delete scenario.gardenSwitch.arrivals[0].fixture;
                },
            );
        },
        'switch garden identity': (pair) => {
            mutateScenario(
                pair,
                'game-garden-switch-high-fauna-single-context-desktop',
                (scenario) => {
                    delete scenario.gardenSwitch.arrivals[0].gardenId;
                },
            );
        },
        'switch arrival sequence': (pair) => {
            mutateScenario(
                pair,
                'game-garden-switch-high-fauna-single-context-desktop',
                (scenario) => {
                    scenario.gardenSwitch.arrivals =
                        scenario.gardenSwitch.arrivals.slice(0, 1);
                },
            );
        },
        'lifecycle cold fixture': (pair) => {
            mutateScenario(
                pair,
                'game-high-target-runtime-lifecycle-desktop',
                (scenario) => {
                    delete scenario.lifecycle.cold.fixture.fixture;
                },
            );
        },
    };
    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            mutate(pair);
            const comparison = compareReports(pair.baseline, pair.candidate);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
        });
    }
});

test('lifecycle renderer resource receipts fail closed for canonical and legacy release evidence', async (t) => {
    const lifecycleResources = (reportValue) =>
        reportValue.scenarios
            .filter(
                (scenario) =>
                    scenario.baseName ===
                    'game-high-target-runtime-lifecycle-desktop',
            )
            .flatMap((scenario) => [
                scenario.lifecycle.cold.fixture.resources,
                scenario.lifecycle.offscreen.resumedControl.fixture.resources,
                scenario.lifecycle.hidden.resumedControl.fixture.resources,
                scenario.lifecycle.context.restoredControl.fixture.resources,
            ]);
    const cases = {
        'symmetric receipt absence': {
            expected: /rendererStatsMeasurement is missing/,
            mutate: ({ baseline, candidate }) => {
                for (const resources of [
                    ...lifecycleResources(baseline),
                    ...lifecycleResources(candidate),
                ]) {
                    delete resources.rendererStatsMeasurement;
                }
            },
        },
        'symmetric measurement mode drift': {
            expected:
                /rendererStatsMeasurement\.measurementMode must be "post-render-receipt-v1"/,
            mutate: ({ baseline, candidate }) => {
                for (const resources of [
                    ...lifecycleResources(baseline),
                    ...lifecycleResources(candidate),
                ]) {
                    resources.rendererStatsMeasurement.measurementMode =
                        'pre-render-v0';
                }
            },
        },
        'symmetric offscreen receipt absence': {
            expected:
                /lifecycle\.offscreen-resumed\.fixture\.resources\.rendererStatsMeasurement is missing/,
            mutate: ({ baseline, candidate }) => {
                delete lifecycleResources(baseline)[1].rendererStatsMeasurement;
                delete lifecycleResources(candidate)[1]
                    .rendererStatsMeasurement;
            },
        },
        'symmetric hidden measurement mode drift': {
            expected:
                /lifecycle\.hidden-resumed\.fixture\.resources\.rendererStatsMeasurement\.measurementMode must be "post-render-receipt-v1"/,
            mutate: ({ baseline, candidate }) => {
                lifecycleResources(
                    baseline,
                )[2].rendererStatsMeasurement.measurementMode = 'pre-render-v0';
                lifecycleResources(
                    candidate,
                )[2].rendererStatsMeasurement.measurementMode = 'pre-render-v0';
            },
        },
        'candidate stale receipt': {
            expected:
                /rendererStatsMeasurement\.rendererStatsReceiptDelta must be a positive integer/,
            mutate: ({ candidate }) => {
                lifecycleResources(
                    candidate,
                )[0].rendererStatsMeasurement.rendererStatsReceiptDelta = 0;
            },
        },
        'candidate zero restored resources': {
            expected: /rendererTextures must be a positive finite number/,
            mutate: ({ candidate }) => {
                lifecycleResources(candidate)[3].rendererTextures = 0;
            },
        },
        'candidate mature resource witnesses disagree': {
            expected:
                /lifecycle mature rendererGeometries must be 201; received 200/,
            mutate: ({ candidate }) => {
                lifecycleResources(candidate)[1].rendererGeometries = 201;
            },
        },
        'candidate missing receipt with legacy baseline': {
            baselineContract: 'legacy-heartbeat-v1',
            expected: /rendererStatsMeasurement is missing/,
            mutate: ({ baseline, candidate }) => {
                applyLegacyHeartbeatSchedulerEvidence(baseline);
                delete lifecycleResources(candidate)[0]
                    .rendererStatsMeasurement;
            },
        },
    };

    for (const [name, { baselineContract, expected, mutate }] of Object.entries(
        cases,
    )) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            mutate(pair);
            const comparison = compareReports(pair.baseline, pair.candidate, {
                baselineSchedulerContract: baselineContract,
            });
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.equal(comparison.comparisons.length, 0);
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }
});

test('symmetrically incomplete options, requests, policies, and fixtures are invalid', async (t) => {
    const cases = {
        options: ({ baseline, candidate }) => {
            delete baseline.options;
            delete candidate.options;
        },
        requested: ({ baseline, candidate }) => {
            delete baseline.scenarios[0].requested;
            delete candidate.scenarios[0].requested;
        },
        'runtime policy': ({ baseline, candidate }) => {
            delete baseline.scenarios[0].runtime.qualityTier;
            delete candidate.scenarios[0].runtime.qualityTier;
        },
        'runtime fixture': ({ baseline, candidate }) => {
            for (const report of [baseline, candidate]) {
                delete report.scenarios[0].runtime.stackCount;
                delete report.scenarios[0].runtime.blockCount;
                delete report.scenarios[0].runtime.raisedBedCount;
            }
        },
    };
    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = reportPair();
            mutate(pair);
            const comparison = comparePartialReports(
                pair.baseline,
                pair.candidate,
            );
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
        });
    }
});

test('valid schema-v6 reports compare raw runs and ignore scenario order', () => {
    const { baseline, candidate } = reportPair();
    candidate.scenarios.reverse();

    const comparison = comparePartialReports(baseline, candidate);

    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
    assert.equal(comparison.summary.scenarioRunCount, 3);
    assert.ok(comparison.summary.totalComparisons > 0);
    assert.ok(
        comparison.comparisons.every(
            (result) => result.individual.length === 3,
        ),
    );
    assert.deepEqual(
        comparison.comparisons.map(
            (result) => `${result.scenario}::${result.phase}::${result.id}`,
        ),
        [
            ...comparison.comparisons.map(
                (result) => `${result.scenario}::${result.phase}::${result.id}`,
            ),
        ].sort(),
    );
});

test('schema-v6 request omissions equal only their semantic defaults', async (t) => {
    const defaults = {
        lifecycleLiveProfile: false,
        motionWarmupMs: 0,
        runtimeOwnersProfile: false,
        staticIdle: '0',
        staticIdleProfile: false,
    };
    const nonDefaults = {
        lifecycleLiveProfile: true,
        motionWarmupMs: 1,
        runtimeOwnersProfile: true,
        staticIdle: '1',
        staticIdleProfile: true,
    };

    await t.test('newer explicit defaults match older omissions', () => {
        const { baseline, candidate } = reportPair();
        for (const scenario of candidate.scenarios) {
            Object.assign(scenario.requested, defaults);
        }

        const comparison = comparePartialReports(baseline, candidate);

        assert.equal(comparison.status, 'pass');
        assert.equal(comparison.exitCode, 0);
    });

    await t.test('normalization is symmetric', () => {
        const { baseline, candidate } = reportPair();
        for (const scenario of baseline.scenarios) {
            Object.assign(scenario.requested, defaults);
        }

        const comparison = comparePartialReports(baseline, candidate);

        assert.equal(comparison.status, 'pass');
        assert.equal(comparison.exitCode, 0);
    });

    for (const [field, value] of Object.entries(nonDefaults)) {
        await t.test(`${field} non-default remains incompatible`, () => {
            const { baseline, candidate } = reportPair();
            candidate.scenarios[0].requested[field] = value;

            const comparison = comparePartialReports(baseline, candidate);

            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(
                comparison.validationErrors.join('\n'),
                /scenario\.requested differs/,
            );
        });
    }
});

test('median frame regression returns exit code 1', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of candidate.scenarios) {
        scenario.sample.p95FrameMs = 18.56;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const frame = comparison.comparisons.find(
        (result) => result.id === 'frame.p95_ms',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    assert.equal(frame.medianRatio, 1.16);
    assert.equal(frame.medianPass, false);
});

test('an individual outlier remains diagnostic when the batch median passes', () => {
    const { baseline, candidate } = reportPair();
    candidate.scenarios[2].sample.p95FrameMs = 20.96;

    const comparison = comparePartialReports(baseline, candidate);
    const frame = comparison.comparisons.find(
        (result) => result.id === 'frame.p95_ms',
    );

    assert.equal(frame.medianRatio, 1);
    assert.equal(frame.medianPass, true);
    assert.equal(frame.pass, true);
    assert.equal(frame.rawRanksDiagnosticOnly, true);
    assert.deepEqual(
        frame.individual
            .filter((run) => !run.pass)
            .map((run) => run.sampleRank),
        [3],
    );
    assert.match(buildMarkdown(comparison), /## Raw-rank diagnostics/);
    assert.match(
        buildMarkdown(comparison),
        /candidate: rank 3 .*candidate run 3 = 20\.96 ms; raw rank is diagnostic/,
    );
});

test('median gate uses the ratio of independent batch medians', () => {
    const { baseline, candidate } = reportPair();
    baseline.scenarios[0].sample.p95FrameMs = 1;
    baseline.scenarios[1].sample.p95FrameMs = 100;
    baseline.scenarios[2].sample.p95FrameMs = 100;
    candidate.scenarios[0].sample.p95FrameMs = 2;
    candidate.scenarios[1].sample.p95FrameMs = 100;
    candidate.scenarios[2].sample.p95FrameMs = 100;

    const frame = comparePartialReports(baseline, candidate).comparisons.find(
        (result) => result.id === 'frame.p95_ms',
    );
    assert.equal(frame.baselineMedian, 100);
    assert.equal(frame.candidateMedian, 100);
    assert.equal(frame.medianRatio, 1);
    assert.equal(frame.medianPass, true);
    assert.equal(frame.pass, true);
});

test('performance repeats are permutation invariant', () => {
    const { baseline, candidate } = reportPair();
    const baselineValues = [10, 16, 20];
    const candidateValues = [20, 10, 16];
    for (const [index, scenario] of baseline.scenarios.entries()) {
        scenario.sample.p95FrameMs = baselineValues[index];
    }
    for (const [index, scenario] of candidate.scenarios.entries()) {
        scenario.sample.p95FrameMs = candidateValues[index];
    }

    const frame = comparePartialReports(baseline, candidate).comparisons.find(
        (result) => result.id === 'frame.p95_ms',
    );
    assert.equal(frame.medianRatio, 1);
    assert.equal(frame.pass, true);
    assert.deepEqual(
        frame.individual.map((run) => [
            run.baseline,
            run.candidate,
            run.sampleRank,
        ]),
        [
            [10, 10, 1],
            [16, 16, 2],
            [20, 20, 3],
        ],
    );
});

test('same-commit browser noise stays inside the frozen practical floors', () => {
    const { baseline, candidate } = reportPair();
    const baselineValues = [
        {
            canvas: 370,
            dom: 16,
            geometry: 274,
            gpu: 18,
            heap: 45,
            longTask: 0,
            script: 0.2,
        },
        {
            canvas: 371,
            dom: 19,
            geometry: 274,
            gpu: 19,
            heap: 54,
            longTask: 55,
            script: 0.24,
        },
        {
            canvas: 690,
            dom: 20,
            geometry: 275,
            gpu: 21,
            heap: 64,
            longTask: 60,
            script: 0.28,
        },
    ];
    const candidateValues = [
        {
            canvas: 710,
            dom: 23,
            geometry: 275,
            gpu: 23,
            heap: 62,
            longTask: 59,
            script: 0.7,
        },
        {
            canvas: 368,
            dom: 17,
            geometry: 274,
            gpu: 20,
            heap: 50,
            longTask: 58,
            script: 0.22,
        },
        {
            canvas: 383,
            dom: 19,
            geometry: 275,
            gpu: 21,
            heap: 53,
            longTask: 0,
            script: 0.22,
        },
    ];
    for (const [index, values] of baselineValues.entries()) {
        const scenario = baseline.scenarios[index];
        scenario.canvasReadyMs = values.canvas;
        scenario.domContentLoadedMs = values.dom;
        scenario.memory.retainedJsHeapMb = values.heap;
        scenario.cdp.scriptDuration = values.script;
        scenario.runtime.rendererGeometries = values.geometry;
        setAvailableGpuSample(scenario.sample, {
            elapsedMs: 1_000,
            elapsedP95Ms: values.gpu,
            elapsedTotalMs: values.gpu * 50,
            renderedFrames: 50,
        });
        scenario.sample.longTaskCount = values.longTask === 0 ? 0 : 1;
        scenario.sample.longTaskMaxMs = values.longTask;
        scenario.sample.longTaskTotalMs = values.longTask;
    }
    for (const [index, values] of candidateValues.entries()) {
        const scenario = candidate.scenarios[index];
        scenario.canvasReadyMs = values.canvas;
        scenario.domContentLoadedMs = values.dom;
        scenario.memory.retainedJsHeapMb = values.heap;
        scenario.cdp.scriptDuration = values.script;
        scenario.runtime.rendererGeometries = values.geometry;
        setAvailableGpuSample(scenario.sample, {
            elapsedMs: 1_000,
            elapsedP95Ms: values.gpu,
            elapsedTotalMs: values.gpu * 50,
            renderedFrames: 50,
        });
        scenario.sample.longTaskCount = values.longTask === 0 ? 0 : 1;
        scenario.sample.longTaskMaxMs = values.longTask;
        scenario.sample.longTaskTotalMs = values.longTask;
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.summary.failedComparisons, 0);
});

test('retained heap is compared once per scenario run outside phase samples', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of candidate.scenarios) {
        scenario.cdp.jsHeapMb = 640;
        for (const arrival of scenario.gardenSwitch.arrivals) {
            arrival.sample.jsHeapMb = 640;
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const retainedHeap = comparison.comparisons.filter(
        (result) => result.id === 'memory.js_heap_mb',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(retainedHeap.length, 1);
    assert.equal(retainedHeap[0].phase, 'post-scenario');
    assert.equal(retainedHeap[0].individual.length, 3);
    assert.deepEqual(
        retainedHeap[0].individual.map(
            ({ baseline: before, candidate: after }) => [before, after],
        ),
        [
            [64, 64],
            [64, 64],
            [64, 64],
        ],
    );
});

test('retained heap uses the frozen scenario-level relative and absolute limits', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of candidate.scenarios) {
        scenario.memory.retainedJsHeapMb = 81;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const retainedHeap = comparison.comparisons.find(
        (result) => result.id === 'memory.js_heap_mb',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(retainedHeap.baselineMedian, 64);
    assert.equal(retainedHeap.candidateMedian, 81);
    assert.equal(retainedHeap.medianLimit, 1.15);
    assert.equal(retainedHeap.medianAbsoluteTolerance, 8);
    assert.equal(retainedHeap.runLimit, 1.3);
    assert.equal(retainedHeap.runAbsoluteTolerance, 16);
    assert.equal(retainedHeap.pass, false);
});

test('schema-v6 retained-heap witnesses fail closed for garden-switch evidence', async (t) => {
    const cases = {
        'symmetric witness absence': {
            expected: /memory is missing/,
            mutate: ({ baseline, candidate }) => {
                for (const scenario of [
                    ...baseline.scenarios,
                    ...candidate.scenarios,
                ]) {
                    delete scenario.memory;
                }
            },
        },
        'symmetric measurement-mode drift': {
            expected:
                /memory\.measurementMode must be "post-scenario-forced-gc-v1"/,
            mutate: ({ baseline, candidate }) => {
                for (const scenario of [
                    ...baseline.scenarios,
                    ...candidate.scenarios,
                ]) {
                    scenario.memory.measurementMode = 'phase-end-snapshot-v0';
                }
            },
        },
        'non-positive pre-collection heap': {
            expected:
                /memory\.jsHeapBeforeCollectionMb must be a positive finite number/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].memory.jsHeapBeforeCollectionMb = 0;
            },
        },
        'non-finite retained heap': {
            expected:
                /memory\.retainedJsHeapMb must be a positive finite number/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].memory.retainedJsHeapMb =
                    Number.POSITIVE_INFINITY;
            },
        },
    };

    for (const [name, { expected, mutate }] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = reportPair(gardenSwitchScenario);
            mutate(pair);

            const comparison = comparePartialReports(
                pair.baseline,
                pair.candidate,
            );
            assert.equal(pair.baseline.schemaVersion, 6);
            assert.equal(pair.candidate.schemaVersion, 6);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.equal(comparison.comparisons.length, 0);
            assert.match(comparison.validationErrors.join('\n'), expected);
            assert.doesNotMatch(
                buildMarkdown(comparison),
                /retained JavaScript heap/,
            );
        });
    }
});

test('a relative-only signal requires a rerun and clears when not reproduced', () => {
    const { baseline, candidate } = reportPair();
    const confirmation = independentRepeat(candidate);
    for (const scenario of candidate.scenarios) {
        scenario.cdp.scriptDuration = 1;
    }

    const first = comparePartialReports(baseline, candidate);
    assert.equal(first.status, 'needs-rerun');
    assert.equal(first.exitCode, 1);
    assert.equal(first.summary.screeningComparisons, 1);
    assert.equal(first.summary.failedComparisons, 0);

    const confirmed = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
    );
    assert.equal(confirmed.status, 'pass');
    assert.equal(confirmed.exitCode, 0);
    assert.equal(confirmed.confirmationUsed, true);
    assert.equal(confirmed.summary.reproducedRegressions, 0);
    assert.equal(confirmed.summary.screeningComparisons, 1);
});

test('a relative-only signal fails when both candidate captures reproduce it', () => {
    const { baseline, candidate } = reportPair();
    const confirmation = independentRepeat(candidate);
    for (const report of [candidate, confirmation]) {
        for (const scenario of report.scenarios) {
            scenario.cdp.scriptDuration = 1;
        }
    }

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    assert.equal(comparison.summary.reproducedRegressions, 1);
});

test('the symmetric 2x2 gate clears a signal caused by one baseline bundle', () => {
    const { baseline, candidate } = reportPair();
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);
    for (const report of [baselineConfirmation, candidate, confirmation]) {
        for (const scenario of report.scenarios) {
            scenario.cdp.scriptDuration = 1;
        }
    }

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
        { baselineConfirmation },
    );
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
    assert.equal(comparison.baselineConfirmationUsed, true);
    assert.equal(comparison.summary.comparisonPairCount, 4);
    assert.equal(comparison.summary.screeningComparisons, 1);
    assert.equal(comparison.summary.reproducedRegressions, 0);
});

test('the symmetric 2x2 gate fails a signal reproduced across all bundles', () => {
    const { baseline, candidate } = reportPair();
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);
    for (const report of [candidate, confirmation]) {
        for (const scenario of report.scenarios) {
            scenario.cdp.scriptDuration = 1;
        }
    }

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
        { baselineConfirmation },
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    assert.equal(comparison.summary.comparisonPairCount, 4);
    assert.equal(comparison.summary.reproducedRegressions, 1);
});

test('a meaningful regression fails and remains failed when reproduced', async (t) => {
    const cases = {
        'canvas readiness': ({ baseline, candidate, confirmation }) => {
            for (const scenario of baseline.scenarios) {
                scenario.canvasReadyMs = 400;
            }
            for (const report of [candidate, confirmation]) {
                for (const scenario of report.scenarios) {
                    scenario.canvasReadyMs = 650;
                }
            }
        },
        'script duration': ({ baseline, candidate, confirmation }) => {
            for (const scenario of baseline.scenarios) {
                scenario.cdp.scriptDuration = 0.5;
            }
            for (const report of [candidate, confirmation]) {
                for (const scenario of report.scenarios) {
                    scenario.cdp.scriptDuration = 1;
                }
            }
        },
        'GPU duration': ({ baseline, candidate, confirmation }) => {
            for (const scenario of baseline.scenarios) {
                setAvailableGpuSample(scenario.sample, {
                    elapsedMs: 1_000,
                    elapsedP95Ms: 4,
                    elapsedTotalMs: 200,
                    renderedFrames: 50,
                });
            }
            for (const report of [candidate, confirmation]) {
                for (const scenario of report.scenarios) {
                    setAvailableGpuSample(scenario.sample, {
                        elapsedMs: 1_000,
                        elapsedP95Ms: 10,
                        elapsedTotalMs: 500,
                        renderedFrames: 50,
                    });
                }
            }
        },
    };
    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const { baseline, candidate } = reportPair();
            const confirmation = independentRepeat(candidate);
            mutate({ baseline, candidate, confirmation });
            const first = comparePartialReports(baseline, candidate);
            assert.equal(first.status, 'regression');
            const confirmed = compareConfirmedPartialReports(
                baseline,
                candidate,
                confirmation,
            );
            assert.equal(confirmed.status, 'regression');
            assert.equal(confirmed.exitCode, 1);
            assert.equal(confirmed.summary.reproducedRegressions, 1);
        });
    }
});

test('confirmation must be the same exact compatible candidate', () => {
    const { baseline, candidate } = reportPair();
    const confirmation = independentRepeat(candidate);
    confirmation.provenance.subject.commit = '3'.repeat(40);
    confirmation.provenance.harness.commit = '3'.repeat(40);
    confirmation.sourceCommit = '3'.repeat(40);
    for (const scenario of confirmation.scenarios) {
        scenario.servedBuildProvenance.commit = '3'.repeat(40);
    }

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
    );
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /subject commits must be identical|harness commits must be identical/,
    );
});

test('confirmation must be an independent capture', () => {
    const { baseline, candidate } = reportPair();
    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        structuredClone(candidate),
    );
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /independent capture|timestamp-only copy/,
    );
});

test('property reordering cannot disguise a timestamp-only copy', () => {
    const { baseline, candidate } = reportPair();
    const timestampOnlyCopy = structuredClone(candidate);
    timestampOnlyCopy.generatedAt = '2026-08-30T00:01:00.000Z';
    const reordered = Object.fromEntries(
        Object.entries(timestampOnlyCopy).reverse(),
    );

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        reordered,
    );
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(comparison.validationErrors.join('\n'), /timestamp-only copy/);
});

test('baseline confirmation must preserve baseline provenance', () => {
    const { baseline, candidate } = reportPair();
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);
    baselineConfirmation.provenance.subject.commit = '4'.repeat(40);
    baselineConfirmation.provenance.harness.commit = '4'.repeat(40);
    baselineConfirmation.sourceCommit = '4'.repeat(40);
    for (const scenario of baselineConfirmation.scenarios) {
        scenario.servedBuildProvenance.commit = '4'.repeat(40);
    }

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
        { baselineConfirmation },
    );
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /baseline and baseline confirmation subject commits must be identical/,
    );
});

test('required ratio metrics reject missing and zero values as incompatible', () => {
    let pair = reportPair();
    delete pair.baseline.scenarios[0].sample.p95FrameMs;
    delete pair.candidate.scenarios[0].sample.p95FrameMs;
    assert.equal(
        comparePartialReports(pair.baseline, pair.candidate).exitCode,
        2,
    );

    pair = reportPair();
    pair.baseline.scenarios[0].sample.renderedFps = 0;
    pair.candidate.scenarios[0].sample.renderedFps = 0;
    assert.equal(
        comparePartialReports(pair.baseline, pair.candidate).exitCode,
        2,
    );
});

test('minimum metrics reject a rendered-FPS decline in the correct direction', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of candidate.scenarios) {
        scenario.sample.renderedFps = 24;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const renderedFps = comparison.comparisons.find(
        (result) => result.id === 'frame.rendered_fps',
    );

    assert.equal(renderedFps.direction, 'minimum');
    assert.equal(renderedFps.medianRatio, 0.8);
    assert.equal(renderedFps.pass, false);
});

test('cross-tier rendered FPS gates the declared 30 FPS target under matched cadence', () => {
    const scenarioFactory = (profileRun) =>
        regressionScenario(
            'game-cross-tier-high-camera-motion-desktop',
            profileRun,
        );
    const { baseline, candidate } = reportPair(scenarioFactory);
    for (const [index, scenario] of baseline.scenarios.entries()) {
        scenario.sample.renderedFps = [29, 30, 31][index];
    }
    for (const [index, scenario] of candidate.scenarios.entries()) {
        scenario.sample.renderedFps = [29, 30, 31][index];
    }

    const comparison = comparePartialReports(baseline, candidate);
    const renderedFps = comparison.comparisons.find(
        (result) => result.id === 'frame.rendered_fps',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(renderedFps.targetAwareRenderedFps, true);
    assert.equal(renderedFps.targetFramesPerSecond, 30);
    assert.equal(renderedFps.minimumRenderedFps, 28);
    assert.equal(renderedFps.maximumRenderedFps, 32);
    assert.equal(renderedFps.baselineRelativeDiagnosticOnly, true);
    assert.equal(renderedFps.baselineRelativeScreeningBreach, false);
    assert.equal(renderedFps.screeningBreach, false);
    assert.equal(renderedFps.regressionBreach, false);
    assert.equal(
        renderedFps.individual.every(
            (run) =>
                run.pass === true &&
                run.candidateFloorPass === true &&
                run.candidateCeilingPass === true &&
                run.baselineRelativePass === true,
        ),
        true,
    );
    assert.match(
        buildMarkdown(comparison),
        /candidate 28-32 fps around declared 30 fps target; every raw run; baseline-relative ratio diagnostic only/,
    );
});

test('matched-cadence cross-tier GPU p95 keeps the existing decisive threshold', () => {
    const scenarioFactory = (profileRun) =>
        regressionScenario(
            'game-cross-tier-high-camera-motion-desktop',
            profileRun,
        );
    const { baseline, candidate } = reportPair(scenarioFactory);
    for (const scenario of baseline.scenarios) {
        scenario.sample.gpu.elapsedP95Ms = 15;
        scenario.sample.gpu.elapsedMaxMs = 15;
    }
    for (const scenario of candidate.scenarios) {
        scenario.sample.gpu.elapsedP95Ms = 19;
        scenario.sample.gpu.elapsedMaxMs = 19;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const gpu = comparison.comparisons.find(
        (result) => result.id === 'gpu.p95_ms',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    assert.equal(gpu.gateBasis, 'matched-cadence');
    assert.equal(gpu.decisionStatus, 'comparable');
    assert.equal(gpu.medianLimit, 1.15);
    assert.equal(gpu.medianAbsoluteTolerance, 3);
    assert.equal(gpu.regressionBreach, true);
    assert.notEqual(gpu.diagnosticOnly, true);
});

test('cross-tier GPU evidence fails closed when semantic cadence underdelivers or oversubmits', async (t) => {
    for (const [name, renderedFps] of [
        ['underdelivery', 27.9],
        ['oversubmission', 32.1],
    ]) {
        await t.test(name, () => {
            const scenarioFactory = (profileRun) =>
                regressionScenario(
                    'game-cross-tier-high-camera-motion-desktop',
                    profileRun,
                );
            const { baseline, candidate } = reportPair(scenarioFactory);
            for (const scenario of candidate.scenarios) {
                scenario.sample.renderedFps = renderedFps;
            }

            const comparison = comparePartialReports(baseline, candidate);
            const result = comparison.comparisons.find(
                (item) => item.id === 'frame.rendered_fps',
            );
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.equal(result, undefined);
            assert.match(
                comparison.validationErrors.join('\n'),
                /GPU p95 comparison cadence requires/,
            );
        });
    }
});

test('confirmed cross-tier evidence is invalid when one capture violates matched cadence', () => {
    const scenarioFactory = (profileRun) =>
        regressionScenario(
            'game-cross-tier-high-camera-motion-desktop',
            profileRun,
        );
    const { baseline, candidate } = reportPair(scenarioFactory);
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);
    candidate.scenarios[0].sample.renderedFps = 32.1;

    const comparison = compareConfirmedPartialReports(
        baseline,
        candidate,
        confirmation,
        { baselineConfirmation },
    );
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /GPU p95 comparison cadence requires/,
    );
});

test('cross-tier semantic rendered-FPS gate fails closed for incomplete or drifting scheduler evidence', async (t) => {
    const cases = {
        'baseline runtime target drift': {
            expected:
                /baseline\.runtime\.runtimeFrameLoop\.targetFramesPerSecond must be 30/,
            mutate: ({ baseline }) => {
                baseline.scenarios[0].runtime.runtimeFrameLoop.targetFramesPerSecond = 29;
            },
        },
        'candidate scalar maximum drift': {
            expected: /runtimeFrameLoopTargetFramesPerSecondMax must be 30/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopTargetFramesPerSecondMax = 60;
            },
        },
        'candidate scalar minimum drift': {
            expected: /runtimeFrameLoopTargetFramesPerSecondMin must be 30/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopTargetFramesPerSecondMin = 15;
            },
        },
        'candidate endpoint missing': {
            expected: /runtimeFrameLoopAtStart is missing/,
            mutate: ({ candidate }) => {
                delete candidate.scenarios[0].sample.runtimeFrameLoopAtStart;
            },
        },
        'candidate endpoint invisible': {
            expected: /runtimeFrameLoopAtEnd\.effectiveVisible must be true/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopAtEnd.effectiveVisible = false;
            },
        },
        'candidate unstable leases': {
            expected: /active lease counts must remain stable/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopActiveLeaseCountMax = 11;
            },
        },
        'candidate downward lease drift': {
            expected: /active lease counts must remain stable/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopActiveLeaseCountMin = 9;
            },
        },
        'candidate semantic lease topology drift': {
            expected: /semantic and observer-free lease topologies must match/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopSemanticLeaseTopologyAtEnd.renderLeaseOwners =
                    ['different-owner'];
                candidate.scenarios[0].sample.runtimeFrameLoopSemanticLeaseTopologyAtEnd.renderLeaseSummaries[0].owner =
                    'different-owner';
            },
        },
        'candidate observer-free lease topology drift': {
            expected: /semantic and observer-free lease topologies must match/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopAtEnd.renderLeaseSummaries[0].framesPerSecond = 60;
            },
        },
        'candidate incomplete observation coverage': {
            expected:
                /runtimeFrameLoopObservationCount must equal runtimeFrameLoopObservationRafFrameCount \+ 3/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopObservationCount = 302;
            },
        },
        'candidate mismatched R3F receipts': {
            expected:
                /renderedFrames must equal the positive runtimeFrameLoopCounterDeltas\.r3fFrameCallbackCount/,
            mutate: ({ candidate }) => {
                candidate.scenarios[0].sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount = 149;
            },
        },
    };

    for (const [name, { expected, mutate }] of Object.entries(cases)) {
        await t.test(name, () => {
            const scenarioFactory = (profileRun) =>
                regressionScenario(
                    'game-cross-tier-high-camera-motion-desktop',
                    profileRun,
                );
            const pair = reportPair(scenarioFactory);
            mutate(pair);

            const comparison = comparePartialReports(
                pair.baseline,
                pair.candidate,
            );
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }
});

test('canonical cross-tier evidence versions observer-isolated measurement windows', async (t) => {
    const crossTierScenario = (reportValue) =>
        reportValue.scenarios.find(
            (scenario) =>
                scenario.baseName ===
                    'game-cross-tier-high-camera-motion-desktop' &&
                scenario.profileRun === 1,
        );

    const accepted = regressionReportPair();
    for (const reportValue of [accepted.baseline, accepted.candidate]) {
        const sampleValue = crossTierScenario(reportValue).sample;
        sampleValue.runtimeFrameLoopObservationRafFrameCount = 240;
        sampleValue.runtimeFrameLoopObservationCount = 243;
        assert.equal(sampleValue.frames, 300);
    }
    const acceptedComparison = compareReports(
        accepted.baseline,
        accepted.candidate,
    );
    assert.notEqual(acceptedComparison.status, 'invalid');
    assert.deepEqual(acceptedComparison.validationErrors, []);

    const cases = {
        'performance window mode drift': {
            expected:
                /performanceMeasurementMode must be "separate-observer-free-window-v1"/,
            mutate: (sampleValue) => {
                sampleValue.performanceMeasurementMode = 'observer-active-v0';
            },
        },
        'semantic rAF window mode drift': {
            expected:
                /runtimeFrameLoopObservationMode must be "separate-semantic-raf-window-v1"/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopObservationMode = 'timed-window-v0';
            },
        },
        'non-positive semantic rAF frame count': {
            expected:
                /runtimeFrameLoopObservationRafFrameCount must be a positive integer/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopObservationRafFrameCount = 0;
            },
        },
        'observation count derived from the performance frame count': {
            expected:
                /runtimeFrameLoopObservationCount must equal runtimeFrameLoopObservationRafFrameCount \+ 3/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopObservationRafFrameCount = 240;
                sampleValue.runtimeFrameLoopObservationCount =
                    sampleValue.frames + 3;
            },
        },
    };

    for (const [name, { expected, mutate }] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = regressionReportPair();
            mutate(crossTierScenario(pair.candidate).sample);

            const comparison = compareReports(pair.baseline, pair.candidate);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }
});

test('isolated long tasks are diagnostic but a recurrent count increase fails', () => {
    const { baseline, candidate } = reportPair();
    candidate.scenarios[1].sample.longTaskCount = 1;
    candidate.scenarios[1].sample.longTaskMaxMs = 58;
    candidate.scenarios[1].sample.longTaskTotalMs = 58;

    let comparison = comparePartialReports(baseline, candidate);

    assert.equal(comparison.status, 'pass');
    assert.equal(
        comparison.comparisons
            .find((result) => result.id === 'long_tasks.count')
            ?.individual.some((run) => !run.pass),
        true,
    );

    candidate.scenarios[2].sample.longTaskCount = 1;
    candidate.scenarios[2].sample.longTaskMaxMs = 58;
    candidate.scenarios[2].sample.longTaskTotalMs = 58;
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);

    delete candidate.scenarios[1].sample.longTaskCount;
    const missing = comparePartialReports(baseline, candidate);
    assert.equal(missing.status, 'invalid');
    assert.match(missing.validationErrors.join('\n'), /longTaskCount/);
});

test('recurrent long-task count and meaningful duration growth fail', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of baseline.scenarios) {
        scenario.sample.longTaskCount = 1;
        scenario.sample.longTaskMaxMs = 55;
        scenario.sample.longTaskTotalMs = 55;
    }
    for (const scenario of candidate.scenarios) {
        scenario.sample.longTaskCount = 2;
        scenario.sample.longTaskMaxMs = 70;
        scenario.sample.longTaskTotalMs = 110;
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    for (const id of [
        'long_tasks.count',
        'long_tasks.max_ms',
        'long_tasks.total_ms',
    ]) {
        assert.equal(
            comparison.comparisons.find((result) => result.id === id)?.pass,
            false,
        );
    }
});

test('resource gates allow one transient count but fail sustained growth', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of candidate.scenarios) {
        scenario.runtime.rendererShaders += 1;
        scenario.runtime.rendererTextures += 1;
    }
    assert.equal(comparePartialReports(baseline, candidate).status, 'pass');

    for (const scenario of candidate.scenarios) {
        scenario.runtime.rendererGeometries += 1;
    }
    assert.equal(comparePartialReports(baseline, candidate).status, 'pass');

    for (const scenario of candidate.scenarios) {
        scenario.runtime.rendererGeometries += 1;
    }
    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(
        comparison.comparisons.find(
            (result) => result.id === 'resources.geometries',
        ).pass,
        false,
    );
});

test('cross-tier geometry matches the 275/277 butterfly matrix by population exposure', () => {
    const baseName = 'game-cross-tier-auto-standard-camera-motion-desktop';
    const { baseline, candidate } = reportPair((profileRun) =>
        regressionScenario(baseName, profileRun),
    );
    const baselineEvidence = [
        { endpointButterflies: 3, exposureButterflies: 3, geometries: 275 },
        { endpointButterflies: 3, exposureButterflies: 3, geometries: 275 },
        { endpointButterflies: 3, exposureButterflies: 4, geometries: 277 },
    ];
    const candidateEvidence = [
        { endpointButterflies: 3, exposureButterflies: 4, geometries: 277 },
        { endpointButterflies: 3, exposureButterflies: 4, geometries: 277 },
        { endpointButterflies: 3, exposureButterflies: 3, geometries: 275 },
    ];
    for (const [index, scenario] of baseline.scenarios.entries()) {
        setCrossTierResourceEvidence(scenario, baselineEvidence[index]);
    }
    for (const [index, scenario] of candidate.scenarios.entries()) {
        setCrossTierResourceEvidence(scenario, candidateEvidence[index]);
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    const geometries = comparison.comparisons.find(
        (result) => result.id === 'resources.geometries',
    );
    assert.equal(geometries.baselineMedian, 276);
    assert.equal(geometries.candidateMedian, 276);
    assert.equal(geometries.medianDelta, 0);
    assert.deepEqual(
        geometries.individual.map(
            ({ baseline, candidate: candidateValue, populationExposure }) => [
                baseline,
                candidateValue,
                populationExposure.butterfly,
            ],
        ),
        [
            [275, 275, 3],
            [277, 277, 4],
        ],
    );
    assert.deepEqual(
        {
            matchedSampleCount:
                geometries.populationExposureMatching.matchedSampleCount,
            matchedSignatureCount:
                geometries.populationExposureMatching.matchedSignatureCount,
            unmatchedBaselineSampleCount:
                geometries.populationExposureMatching
                    .unmatchedBaselineSampleCount,
            unmatchedCandidateSampleCount:
                geometries.populationExposureMatching
                    .unmatchedCandidateSampleCount,
        },
        {
            matchedSampleCount: 2,
            matchedSignatureCount: 2,
            unmatchedBaselineSampleCount: 1,
            unmatchedCandidateSampleCount: 1,
        },
    );
    assert.match(
        buildMarkdown(comparison),
        /population exposure matched 2 samples across 2 signatures/,
    );
});

test('cross-tier cold comparison uses document-start milestones and ignores host RAF bimodality', () => {
    const baseName = 'game-cross-tier-auto-constrained-camera-motion-desktop';
    const { baseline, candidate } = reportPair((profileRun) =>
        regressionScenario(baseName, profileRun),
    );
    for (const scenario of baseline.scenarios) {
        scenario.crossTierCold.hostCanvasReadyDiagnosticMs = 386;
    }
    for (const scenario of candidate.scenarios) {
        scenario.crossTierCold.hostCanvasReadyDiagnosticMs = 572;
    }

    let comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    const timingIds = comparison.comparisons
        .filter((result) => result.phase === 'cold')
        .map((result) => result.id);
    assert.equal(timingIds.includes('cold.canvas_ready_ms'), false);
    assert.equal(timingIds.includes('cold.canvas_sized_ms'), true);
    assert.equal(timingIds.includes('cold.first_submitted_frame_ms'), true);
    assert.equal(timingIds.includes('cold.fixture_ready_ms'), true);

    for (const scenario of candidate.scenarios) {
        scenario.canvasReadyMs = 600;
        scenario.crossTierCold.canvasSizedMs = 600;
        scenario.crossTierCold.firstSubmittedFrameMs = 620;
        scenario.crossTierCold.fixtureReadyMs = 700;
        scenario.crossTierCold.observationStoppedMs = 701;
    }
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(
        comparison.comparisons.find(
            (result) => result.id === 'cold.canvas_sized_ms',
        ).regressionBreach,
        true,
    );

    candidate.scenarios[0].canvasReadyMs = 601;
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.match(
        comparison.validationErrors.join('\n'),
        /canvasSizedMs\/top-level canvasReadyMs/,
    );
});

test('cross-tier cold milestone evidence fails closed when missing or incoherent', async (t) => {
    const baseName = 'game-cross-tier-medium-steady-desktop';
    for (const { expected, mutate } of [
        {
            expected: /crossTierCold is missing/,
            mutate: (_cold, scenario) => {
                delete scenario.crossTierCold;
            },
        },
        {
            expected: /crossTierCold\.measurementMode must be/,
            mutate: (cold) => {
                cold.measurementMode = 'host-double-raf-v0';
            },
        },
        {
            expected: /crossTierCold\.expectedDpr must be 1\.5/,
            mutate: (cold) => {
                cold.expectedDpr = 2;
            },
        },
        {
            expected: /firstSubmittedFrameMs must not precede canvasSizedMs/,
            mutate: (cold) => {
                cold.firstSubmittedFrameMs = cold.canvasSizedMs - 1;
            },
        },
    ]) {
        await t.test(expected.source, () => {
            const { baseline, candidate } = reportPair((profileRun) =>
                regressionScenario(baseName, profileRun),
            );
            const scenario = candidate.scenarios[0];
            mutate(scenario.crossTierCold, scenario);
            const comparison = comparePartialReports(baseline, candidate);
            assert.equal(comparison.status, 'invalid');
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }
});

test('cross-tier geometry retains the hard +1 gate within one population exposure', () => {
    const baseName = 'game-cross-tier-auto-standard-camera-motion-desktop';
    const { baseline, candidate } = reportPair((profileRun) =>
        regressionScenario(baseName, profileRun),
    );
    for (const scenario of baseline.scenarios) {
        setCrossTierResourceEvidence(scenario, {
            endpointButterflies: 3,
            exposureButterflies: 3,
            geometries: 275,
        });
    }
    for (const scenario of candidate.scenarios) {
        setCrossTierResourceEvidence(scenario, {
            endpointButterflies: 3,
            exposureButterflies: 3,
            geometries: 277,
        });
    }

    const comparison = comparePartialReports(baseline, candidate);
    const geometries = comparison.comparisons.find(
        (result) => result.id === 'resources.geometries',
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(geometries.maximumIncrease, 1);
    assert.equal(geometries.medianDelta, 2);
    assert.equal(geometries.regressionBreach, true);
});

test('cross-tier Low accepts an explicit empty exposure stratum and keeps geometry hard-gated', () => {
    const baseName = 'game-cross-tier-low-steady-desktop';
    const { baseline, candidate } = reportPair((profileRun) =>
        regressionScenario(baseName, profileRun),
    );
    for (const scenario of [...baseline.scenarios, ...candidate.scenarios]) {
        const snapshot = scenario.crossTierResourceSnapshot;
        snapshot.populationAtStart = {};
        snapshot.populationAtEnd = {};
        snapshot.populationExposureAtStart = {};
        snapshot.populationExposureAtEnd = {};
        snapshot.populationExposure = {};
        snapshot.populationExposureAvailable = false;
        snapshot.populationExposureSignature = '{}';
    }
    for (const scenario of baseline.scenarios) {
        scenario.crossTierResourceSnapshot.resources.rendererGeometries = 250;
    }
    for (const scenario of candidate.scenarios) {
        scenario.crossTierResourceSnapshot.resources.rendererGeometries = 252;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const geometries = comparison.comparisons.find(
        (result) => result.id === 'resources.geometries',
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(geometries.populationExposureMatching.matchedSampleCount, 3);
    assert.deepEqual(geometries.individual[0].populationExposure, {});
    assert.equal(geometries.medianDelta, 2);
});

test('cross-tier shaders and textures gate every fresh snapshot without exposure re-pairing', () => {
    const baseName = 'game-cross-tier-medium-steady-desktop';
    const { baseline, candidate } = reportPair((profileRun) =>
        regressionScenario(baseName, profileRun),
    );
    for (const [index, scenario] of candidate.scenarios.entries()) {
        scenario.crossTierResourceSnapshot.resources.rendererShaders += 2;
        scenario.crossTierResourceSnapshot.resources.rendererTextures += 2;
        setCrossTierResourceEvidence(scenario, {
            endpointButterflies: index === 0 ? 3 : 4,
            exposureButterflies: index === 0 ? 3 : 4,
            geometries: 200,
        });
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    for (const id of ['resources.shaders', 'resources.textures']) {
        const result = comparison.comparisons.find(
            (comparisonResult) => comparisonResult.id === id,
        );
        assert.equal(result.individual.length, 3);
        assert.equal(result.medianDelta, 2);
        assert.equal(result.regressionBreach, true);
        assert.equal(result.populationExposureMatching, undefined);
    }
});

test('cross-tier geometry fails closed without a shared population exposure', () => {
    const baseName = 'game-cross-tier-auto-standard-camera-motion-desktop';
    const { baseline, candidate } = reportPair((profileRun) =>
        regressionScenario(baseName, profileRun),
    );
    for (const scenario of baseline.scenarios) {
        setCrossTierResourceEvidence(scenario, {
            endpointButterflies: 3,
            exposureButterflies: 3,
            geometries: 275,
        });
    }
    for (const scenario of candidate.scenarios) {
        setCrossTierResourceEvidence(scenario, {
            endpointButterflies: 4,
            exposureButterflies: 4,
            geometries: 277,
        });
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /requires at least one matched population-exposure sample/,
    );
});

test('cross-tier resource snapshots reject stale or malformed evidence', async (t) => {
    const baseName = 'game-cross-tier-auto-standard-camera-motion-desktop';
    for (const { expected, mutate } of [
        {
            expected: /crossTierResourceSnapshot is missing/,
            mutate: (_snapshot, scenario) => {
                delete scenario.crossTierResourceSnapshot;
            },
        },
        {
            expected: /crossTierResourceSnapshot\.measurementMode must be/,
            mutate: (snapshot) => {
                snapshot.measurementMode = 'pre-render-v0';
            },
        },
        {
            expected: /populationAtStart must be a non-empty record/,
            mutate: (snapshot) => {
                snapshot.populationAtStart = {};
            },
        },
        {
            expected:
                /populationExposure\.butterfly must be a non-negative integer/,
            mutate: (snapshot) => {
                snapshot.populationExposure.butterfly = 3.5;
            },
        },
        {
            expected:
                /populationAtStart must equal populationAtEnd elementwise/,
            mutate: (snapshot) => {
                snapshot.populationAtStart.butterfly = 2;
            },
        },
        {
            expected:
                /populationExposureAtStart must equal populationExposureAtEnd elementwise/,
            mutate: (snapshot) => {
                snapshot.populationExposureAtStart.butterfly = 2;
            },
        },
        {
            expected:
                /populationExposure must equal populationExposureAtEnd elementwise/,
            mutate: (snapshot) => {
                snapshot.populationExposure.butterfly = 4;
            },
        },
        {
            expected: /populationExposureAvailable must be a boolean/,
            mutate: (snapshot) => {
                delete snapshot.populationExposureAvailable;
            },
        },
        {
            expected: /populationExposureSignature must be/,
            mutate: (snapshot) => {
                snapshot.populationExposureSignature = '{"butterfly":4}';
            },
        },
        {
            expected:
                /populationExposure\.butterfly must be at least the endpoint population 3/,
            mutate: (snapshot) => {
                snapshot.populationExposure.butterfly = 2;
            },
        },
        {
            expected:
                /resources\.rendererGeometries must be a positive finite number/,
            mutate: (snapshot) => {
                snapshot.resources.rendererGeometries = 0;
            },
        },
        {
            expected:
                /rendererStatsMeasurement\.measurementMode must be "post-render-receipt-v1"/,
            mutate: (snapshot) => {
                snapshot.resources.rendererStatsMeasurement =
                    rendererStatsMeasurement('legacy-pre-render-settled-v1');
            },
        },
    ]) {
        await t.test(expected.source, () => {
            const { baseline, candidate } = reportPair((profileRun) =>
                regressionScenario(baseName, profileRun),
            );
            const scenario = candidate.scenarios[0];
            mutate(scenario.crossTierResourceSnapshot, scenario);
            const comparison = comparePartialReports(baseline, candidate);
            assert.equal(comparison.status, 'invalid');
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }

    await t.test('legacy heartbeat requires a legacy receipt witness', () => {
        const pair = regressionReportPair();
        applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
        const scenario = pair.baseline.scenarios.find(
            ({ baseName: scenarioBaseName }) => scenarioBaseName === baseName,
        );
        scenario.crossTierResourceSnapshot.resources.rendererStatsMeasurement =
            rendererStatsMeasurement();
        const comparison = compareReports(pair.baseline, pair.candidate, {
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        });
        assert.equal(comparison.status, 'invalid');
        assert.match(
            comparison.validationErrors.join('\n'),
            /rendererStatsMeasurement\.measurementMode must be "legacy-pre-render-settled-v1"/,
        );
    });
});

test('lifecycle phases compare restored work and gate SceneTime-owned zero work', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    let comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.summary.totalInvariants, 42);
    assert.ok(
        comparison.comparisons.some(
            (result) => result.phase === 'context-restored',
        ),
    );
    assert.ok(
        comparison.comparisons.some(
            (result) => result.id === 'cold.first_submitted_frame_ms',
        ),
    );

    candidate.scenarios[1].lifecycle.hidden.residualDeltas.wakeupCount = 1;
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    assert.deepEqual(
        comparison.invariants
            .filter((invariant) => !invariant.pass)
            .map((invariant) => [
                invariant.phase,
                invariant.profileRun,
                invariant.field,
            ]),
        [['hidden', 2, 'residualDeltas.wakeupCount']],
    );

    candidate.scenarios[1].lifecycle.hidden.residualDeltas.wakeupCount = 0;
    baseline.scenarios[0].lifecycle.offscreen.runtimeSchedulerZeroObserved = false;
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(
        comparison.invariants.find(
            (invariant) =>
                invariant.phase === 'offscreen' &&
                invariant.profileRun === 1 &&
                invariant.field === 'runtimeSchedulerZeroObserved',
        ).baselinePass,
        false,
    );
});

test('legacy-to-canonical lifecycle gates semantic 30 FPS cadence instead of baseline frequency', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    for (const scenario of reportLifecycleScenarios(baseline)) {
        scenario.lifecycle.active.sample.p95FrameMs = 18;
        scenario.lifecycle.active.sample.renderedFps = 34;
        scenario.lifecycle.context.restoredWindow.sample.p95FrameMs = 18;
        scenario.lifecycle.context.restoredWindow.sample.renderedFps = 34;
    }
    for (const scenario of reportLifecycleScenarios(candidate)) {
        scenario.lifecycle.active.sample.p95FrameMs = 27;
        scenario.lifecycle.active.sample.renderedFps = 30;
        scenario.lifecycle.context.restoredWindow.sample.p95FrameMs = 27;
        scenario.lifecycle.context.restoredWindow.sample.renderedFps = 30;
    }

    const comparison = compareConfirmedReports(
        baseline,
        candidate,
        independentRepeat(candidate),
        {
            baselineConfirmation: independentBaselineRepeat(baseline),
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );
    const p95Results = comparison.comparisons.filter(
        (result) =>
            result.id === 'frame.p95_ms' &&
            result.scenario === 'game-high-target-runtime-lifecycle-desktop',
    );
    const renderedFpsResults = comparison.comparisons.filter(
        (result) =>
            result.id === 'frame.rendered_fps' &&
            result.scenario === 'game-high-target-runtime-lifecycle-desktop',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(p95Results.length, 2);
    assert.equal(renderedFpsResults.length, 2);
    for (const result of p95Results) {
        assert.equal(result.targetAwareMaximum, true);
        assert.equal(result.maximumCandidateValue, 33.3);
        assert.equal(result.targetFramesPerSecond, 30);
        assert.equal(result.everyRawRunGate, true);
        assert.equal(result.rawRanksDiagnosticOnly, false);
        assert.equal(result.baselineRelativeDiagnosticOnly, true);
        assert.equal(result.baselineRelativeRegressionBreach, true);
        assert.equal(result.regressionBreach, false);
        assert.equal(result.pass, true);
    }
    for (const result of renderedFpsResults) {
        assert.equal(result.targetAwareRenderedFps, true);
        assert.equal(result.minimumRenderedFps, 28);
        assert.equal(result.maximumRenderedFps, 32);
        assert.equal(result.everyRawRunGate, true);
        assert.equal(result.rawRanksDiagnosticOnly, false);
        assert.equal(result.pass, true);
    }
    assert.match(
        buildMarkdown(comparison),
        /candidate <= 33\.3 ms under declared 30 fps target; every raw run; baseline-relative ratio diagnostic only/,
    );
});

test('legacy-to-canonical lifecycle semantic cadence bounds are inclusive and fail on one raw breach', () => {
    const buildPair = () => {
        const pair = regressionReportPair();
        applyLegacyHeartbeatSchedulerEvidence(pair.baseline);
        for (const scenario of reportLifecycleScenarios(pair.baseline)) {
            for (const phase of [
                scenario.lifecycle.active.sample,
                scenario.lifecycle.context.restoredWindow.sample,
            ]) {
                phase.p95FrameMs = 18;
                phase.renderedFps = 34;
            }
        }
        return pair;
    };
    const comparePair = (pair) =>
        compareConfirmedReports(
            pair.baseline,
            pair.candidate,
            independentRepeat(pair.candidate),
            {
                baselineConfirmation: independentBaselineRepeat(pair.baseline),
                baselineSchedulerContract: 'legacy-heartbeat-v1',
            },
        );
    let pair = buildPair();
    for (const scenario of reportLifecycleScenarios(pair.candidate)) {
        scenario.lifecycle.active.sample.p95FrameMs = 33.3;
        scenario.lifecycle.active.sample.renderedFps = 28;
        scenario.lifecycle.context.restoredWindow.sample.p95FrameMs = 33.3;
        scenario.lifecycle.context.restoredWindow.sample.renderedFps = 32;
    }
    let comparison = comparePair(pair);
    assert.equal(comparison.status, 'pass');

    const cleanConfirmation = independentRepeat(pair.candidate);
    reportLifecycleScenarios(
        pair.candidate,
    )[0].lifecycle.context.restoredWindow.sample.p95FrameMs = 33.3001;
    comparison = compareConfirmedReports(
        pair.baseline,
        pair.candidate,
        cleanConfirmation,
        {
            baselineConfirmation: independentBaselineRepeat(pair.baseline),
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );
    const restoredP95 = comparison.comparisons.find(
        (result) =>
            result.id === 'frame.p95_ms' && result.phase === 'context-restored',
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(restoredP95.candidateMedian, 33.3);
    assert.equal(restoredP95.regressionBreach, true);
    assert.equal(restoredP95.individual.filter((run) => !run.pass).length, 1);
    assert.match(
        buildMarkdown(comparison),
        /candidate run 1 = 33\.3001 ms; candidate <= 33\.3 ms/,
    );

    pair = buildPair();
    for (const scenario of reportLifecycleScenarios(pair.candidate)) {
        scenario.lifecycle.active.sample.p95FrameMs = 27;
        scenario.lifecycle.active.sample.renderedFps = 30;
        scenario.lifecycle.context.restoredWindow.sample.p95FrameMs = 27;
        scenario.lifecycle.context.restoredWindow.sample.renderedFps = 30;
    }
    reportLifecycleScenarios(
        pair.candidate,
    )[0].lifecycle.active.sample.renderedFps = 27.9;
    reportLifecycleScenarios(
        pair.candidate,
    )[1].lifecycle.context.restoredWindow.sample.renderedFps = 32.1;
    comparison = comparePair(pair);
    assert.equal(comparison.status, 'regression');
    assert.equal(
        comparison.comparisons
            .find(
                (result) =>
                    result.id === 'frame.rendered_fps' &&
                    result.phase === 'active',
            )
            .individual.some((run) => run.candidateFloorPass === false),
        true,
    );
    assert.equal(
        comparison.comparisons
            .find(
                (result) =>
                    result.id === 'frame.rendered_fps' &&
                    result.phase === 'context-restored',
            )
            .individual.some((run) => run.candidateCeilingPass === false),
        true,
    );
});

test('canonical lifecycle comparisons retain relative p95 regression gates', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    for (const scenario of baseline.scenarios) {
        scenario.lifecycle.active.sample.p95FrameMs = 10;
        scenario.lifecycle.active.sample.renderedFps = 34;
        scenario.lifecycle.context.restoredWindow.sample.p95FrameMs = 10;
        scenario.lifecycle.context.restoredWindow.sample.renderedFps = 34;
    }
    for (const scenario of candidate.scenarios) {
        scenario.lifecycle.active.sample.p95FrameMs = 20;
        scenario.lifecycle.active.sample.renderedFps = 34;
        scenario.lifecycle.context.restoredWindow.sample.p95FrameMs = 20;
        scenario.lifecycle.context.restoredWindow.sample.renderedFps = 34;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const p95 = comparison.comparisons.find(
        (result) => result.id === 'frame.p95_ms',
    );
    const renderedFps = comparison.comparisons.find(
        (result) => result.id === 'frame.rendered_fps',
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(p95.targetAwareMaximum, undefined);
    assert.equal(p95.regressionBreach, true);
    assert.equal(renderedFps.targetAwareRenderedFps, undefined);
    assert.equal(renderedFps.pass, true);
});

test('legacy-to-canonical lifecycle semantic gate requires visible target snapshots', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    delete reportLifecycleScenarios(candidate)[0].lifecycle.context
        .restoredWindow.sample.runtimeFrameLoopAtStart;

    const comparison = compareReports(baseline, candidate, {
        baselineSchedulerContract: 'legacy-heartbeat-v1',
    });
    assert.equal(comparison.status, 'invalid');
    assert.match(
        comparison.validationErrors.join('\n'),
        /context-restored candidate\.sample\.runtimeFrameLoopAtStart is missing/,
    );
});

test('lifecycle progress resources are diagnostic while mature and peak resources are gated', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    setReportLifecycleResourceCounts(baseline, {
        cold: [193, 15, 5],
        mature: [277, 26, 7],
        restored: [229, 19, 4],
    });
    setReportLifecycleResourceCounts(candidate, {
        cold: [255, 21, 5],
        mature: [277, 26, 7],
        restored: [249, 21, 5],
    });

    const comparison = compareReports(baseline, candidate, {
        baselineSchedulerContract: 'legacy-heartbeat-v1',
    });
    const coldGeometries = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.geometries' && result.phase === 'cold',
    );
    const restoredShaders = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.shaders' &&
            result.phase === 'context-restored',
    );
    const peakGeometries = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.geometries' &&
            result.phase === 'lifecycle-peak',
    );
    assert.equal(
        comparison.status,
        'needs-rerun',
        comparison.validationErrors.join('\n'),
    );
    assert.equal(comparison.comparable, true);
    assert.equal(coldGeometries.diagnosticOnly, true);
    assert.equal(coldGeometries.baselineRelativeRegressionBreach, true);
    assert.equal(coldGeometries.regressionBreach, false);
    assert.equal(restoredShaders.diagnosticOnly, true);
    assert.equal(restoredShaders.baselineRelativeRegressionBreach, true);
    assert.equal(restoredShaders.regressionBreach, false);
    assert.equal(peakGeometries.diagnosticOnly, undefined);
    assert.equal(peakGeometries.baselineMedian, 277);
    assert.equal(peakGeometries.candidateMedian, 277);
    assert.equal(peakGeometries.pass, true);
    assert.equal(comparison.exitCode, 1);
    const markdown = buildMarkdown(comparison);
    assert.match(
        markdown,
        /cold \| renderer geometries .* diagnostic only; gated by lifecycle mature and peak resource gates \| pass/,
    );
    assert.match(
        markdown,
        /lifecycle-peak \| renderer geometries .* median <= \+1 count; repeat required \| pass/,
    );
});

test('confirmed lifecycle resources preserve diagnostics and the exact one-count allowance', () => {
    const { baseline, candidate } = regressionReportPair();
    applyLegacyHeartbeatSchedulerEvidence(baseline);
    setReportLifecycleResourceCounts(baseline, {
        cold: [193, 15, 5],
        mature: [277, 26, 7],
        restored: [229, 19, 4],
    });
    setReportLifecycleResourceCounts(candidate, {
        cold: [255, 21, 5],
        mature: [278, 27, 8],
        restored: [249, 21, 5],
    });
    const baselineConfirmation = independentBaselineRepeat(baseline);
    const confirmation = independentRepeat(candidate);

    let comparison = compareConfirmedReports(
        baseline,
        candidate,
        confirmation,
        {
            baselineConfirmation,
            baselineSchedulerContract: 'legacy-heartbeat-v1',
        },
    );
    assert.equal(
        comparison.status,
        'pass',
        comparison.validationErrors.join('\n'),
    );
    for (const phase of [
        'offscreen-resumed',
        'hidden-resumed',
        'lifecycle-peak',
    ]) {
        const geometries = comparison.comparisons.find(
            (result) =>
                result.id === 'resources.geometries' && result.phase === phase,
        );
        assert.equal(geometries.candidateMedian, 278);
        assert.equal(geometries.regressionBreach, false);
    }
    assert.equal(
        comparison.comparisons.find(
            (result) =>
                result.id === 'resources.geometries' && result.phase === 'cold',
        ).diagnosticOnly,
        true,
    );

    setReportLifecycleResourceCounts(candidate, {
        cold: [255, 21, 5],
        mature: [279, 27, 8],
        restored: [249, 21, 5],
    });
    setReportLifecycleResourceCounts(confirmation, {
        cold: [255, 21, 5],
        mature: [279, 27, 8],
        restored: [249, 21, 5],
    });
    comparison = compareConfirmedReports(baseline, candidate, confirmation, {
        baselineConfirmation,
        baselineSchedulerContract: 'legacy-heartbeat-v1',
    });
    assert.equal(comparison.status, 'regression');
    for (const phase of [
        'offscreen-resumed',
        'hidden-resumed',
        'lifecycle-peak',
    ]) {
        assert.equal(
            comparison.comparisons.find(
                (result) =>
                    result.id === 'resources.geometries' &&
                    result.phase === phase,
            ).reproducedRegression,
            true,
        );
    }
});

test('lifecycle mature resource growth remains a hard regression', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    for (const scenario of candidate.scenarios) {
        scenario.lifecycle.offscreen.resumedControl.fixture.resources.rendererGeometries += 2;
        scenario.lifecycle.hidden.resumedControl.fixture.resources.rendererGeometries += 2;
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'regression');
    for (const phase of [
        'offscreen-resumed',
        'hidden-resumed',
        'lifecycle-peak',
    ]) {
        assert.equal(
            comparison.comparisons.find(
                (result) =>
                    result.id === 'resources.geometries' &&
                    result.phase === phase,
            ).regressionBreach,
            true,
        );
    }
});

test('reproduced lifecycle transient growth above the lifetime peak remains a hard regression', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    for (const scenario of candidate.scenarios) {
        scenario.lifecycle.cold.fixture.resources.rendererGeometries += 2;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const coldGeometries = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.geometries' && result.phase === 'cold',
    );
    const peakGeometries = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.geometries' &&
            result.phase === 'lifecycle-peak',
    );
    assert.equal(comparison.status, 'regression');
    assert.equal(coldGeometries.diagnosticOnly, true);
    assert.equal(coldGeometries.regressionBreach, false);
    assert.equal(coldGeometries.baselineRelativeRegressionBreach, true);
    assert.equal(peakGeometries.regressionBreach, true);
});

test('one lifecycle peak outlier remains a visible raw-rank diagnostic', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    candidate.scenarios[0].lifecycle.cold.fixture.resources.rendererGeometries += 2;

    const comparison = comparePartialReports(baseline, candidate);
    const peakGeometries = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.geometries' &&
            result.phase === 'lifecycle-peak',
    );
    assert.equal(comparison.status, 'pass');
    assert.equal(peakGeometries.rawRanksDiagnosticOnly, true);
    assert.equal(
        peakGeometries.individual.some((run) => run.pass === false),
        true,
    );
    assert.equal(peakGeometries.regressionBreach, false);
});

test('lifecycle restored fixture drift is incompatible', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    for (const scenario of candidate.scenarios) {
        scenario.lifecycle.context.restoredControl.fixture.fixture.blockCount += 1;
        assert.equal(scenario.lifecycle.cold.fixture.fixture.blockCount, 297);
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /scenario.fixture differs/,
    );
});

test('garden-switch arrivals pair by phase and compare transition timings', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of candidate.scenarios) {
        scenario.gardenSwitch.arrivals[1].timing.settledMs = 1_170;
        scenario.memory.retainedJsHeapMb = 81;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const settled = comparison.comparisons.find(
        (result) => result.id === 'switch.settled_ms',
    );
    assert.equal(settled.phase, 'arrival-2-fauna-heavy');
    assert.equal(settled.medianRatio, 1.3);
    assert.equal(settled.pass, false);
    assert.equal(
        comparison.comparisons.find(
            (result) =>
                result.id === 'memory.js_heap_mb' &&
                result.phase === 'post-scenario',
        ).pass,
        false,
    );
    assert.equal(comparison.exitCode, 1);
});

test('garden-switch resource gates ignore compile progress but retain mature and lifetime growth', () => {
    const applyShaderEvidence = (reportValue, sequence, lifetimePeak) => {
        for (const scenario of reportValue.scenarios) {
            for (const [
                index,
                arrival,
            ] of scenario.gardenSwitch.arrivals.entries()) {
                arrival.resources.rendererShaders = sequence[index];
                arrival.sample.rendererShaders = sequence[index];
            }
            scenario.gardenSwitch.lifetimeResources.rendererShaders =
                lifetimePeak;
        }
    };
    const baselineSequence = [24, 26, 32, 30, 32, 30, 32];
    const candidateSequence = [24, 28, 32, 30, 32, 30, 32];
    let pair = reportPair(gardenSwitchScenario);
    applyShaderEvidence(pair.baseline, baselineSequence, 32);
    applyShaderEvidence(pair.candidate, candidateSequence, 32);

    let comparison = comparePartialReports(pair.baseline, pair.candidate);
    const earlyFauna = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.shaders' &&
            result.phase === 'arrival-2-fauna-heavy',
    );
    const matureFauna = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.shaders' &&
            result.phase === 'arrival-4-fauna-heavy',
    );
    const lifetimePeak = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.shaders' &&
            result.phase === 'switch-lifetime-peak',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(earlyFauna.diagnosticOnly, true);
    assert.equal(earlyFauna.baselineRelativeRegressionBreach, true);
    assert.equal(earlyFauna.regressionBreach, false);
    assert.equal(matureFauna.diagnosticOnly, undefined);
    assert.equal(matureFauna.pass, true);
    assert.equal(lifetimePeak.pass, true);
    assert.match(
        buildMarkdown(comparison),
        /arrival-2-fauna-heavy \| renderer shaders .* diagnostic only; gated by garden-switch mature repeated arrivals and workflow lifetime peak resource gates \| pass/,
    );

    pair = reportPair(gardenSwitchScenario);
    applyShaderEvidence(pair.baseline, baselineSequence, 32);
    applyShaderEvidence(pair.candidate, [24, 28, 32, 32, 32, 32, 32], 32);
    comparison = comparePartialReports(pair.baseline, pair.candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(
        comparison.comparisons.find(
            (result) =>
                result.id === 'resources.shaders' &&
                result.phase === 'arrival-4-fauna-heavy',
        ).regressionBreach,
        true,
    );

    pair = reportPair(gardenSwitchScenario);
    applyShaderEvidence(pair.baseline, baselineSequence, 32);
    applyShaderEvidence(pair.candidate, candidateSequence, 34);
    comparison = comparePartialReports(pair.baseline, pair.candidate);
    assert.equal(comparison.status, 'regression');
    assert.equal(
        comparison.comparisons.find(
            (result) =>
                result.id === 'resources.shaders' &&
                result.phase === 'switch-lifetime-peak',
        ).regressionBreach,
        true,
    );
});

test('garden-switch lifetime resource evidence fails closed when missing or malformed', () => {
    let pair = regressionReportPair();
    const firstCandidateGardenSwitch = () =>
        pair.candidate.scenarios.find(
            (scenario) => scenario.requested.gardenSwitchProfile === true,
        );
    delete firstCandidateGardenSwitch().gardenSwitch.lifetimeResources;
    let comparison = compareReports(pair.baseline, pair.candidate);
    assert.equal(comparison.status, 'invalid');
    assert.match(
        comparison.validationErrors.join('\n'),
        /gardenSwitch\.lifetimeResources is missing/,
    );

    pair = regressionReportPair();
    firstCandidateGardenSwitch().gardenSwitch.lifetimeResources.rendererShaders = 23;
    comparison = compareReports(pair.baseline, pair.candidate);
    assert.equal(comparison.status, 'invalid');
    assert.match(
        comparison.validationErrors.join('\n'),
        /rendererShaders must cover every instrumented arrival sample/,
    );

    pair = regressionReportPair();
    firstCandidateGardenSwitch().gardenSwitch.lifetimeResources.rendererGeometries = 201;
    comparison = compareReports(pair.baseline, pair.candidate);
    assert.equal(comparison.status, 'invalid');
    assert.match(
        comparison.validationErrors.join('\n'),
        /rendererGeometries must equal the maximum arrival snapshot/,
    );
});

test('garden-switch rendered FPS uses exact semantic target evidence instead of baseline oversubmission', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of baseline.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            arrival.sample.renderedFps = 45;
        }
    }
    for (const scenario of candidate.scenarios) {
        for (const [
            index,
            arrival,
        ] of scenario.gardenSwitch.arrivals.entries()) {
            arrival.sample.renderedFps = index === 0 ? 30 : 35;
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const renderedFps = comparison.comparisons.filter(
        (result) => result.id === 'frame.rendered_fps',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(renderedFps.length, 7);
    for (const [index, result] of renderedFps.entries()) {
        assert.equal(result.targetAwareRenderedFps, true);
        assert.equal(result.targetFramesPerSecond, 30);
        assert.equal(result.minimumRenderedFps, 28);
        assert.equal(result.maximumRenderedFps, index === 0 ? 32 : null);
        assert.equal(result.medianRatio, index === 0 ? 0.6667 : 0.7778);
        assert.equal(result.baselineRelativeDiagnosticOnly, true);
        assert.equal(result.baselineRelativeScreeningBreach, true);
        assert.equal(result.screeningBreach, false);
        assert.equal(result.regressionBreach, false);
        assert.equal(result.pass, true);
        assert.equal(
            result.individual.every(
                (run) =>
                    run.pass === true &&
                    run.candidateFloorPass === true &&
                    run.candidateCeilingPass === true &&
                    run.baselineRelativePass === false,
            ),
            true,
        );
    }
    assert.match(
        buildMarkdown(comparison),
        /candidate 28-32 fps around declared 30 fps target; every raw run; baseline-relative ratio diagnostic only/,
    );
    assert.match(
        buildMarkdown(comparison),
        /candidate >= 28 fps \(target 30 fps, 2 fps tolerance\); baseline-relative ratio diagnostic only/,
    );
});

test('garden-switch semantic rendered-FPS gate fails closed without exact visible target evidence', async (t) => {
    const cases = {
        'invisible end snapshot': {
            expected: /runtimeFrameLoopAtEnd\.effectiveVisible must be true/,
            mutate: (sample) => {
                sample.runtimeFrameLoopAtEnd.effectiveVisible = false;
            },
        },
        'mismatched end target': {
            expected:
                /runtimeFrameLoopAtEnd\.targetFramesPerSecond must be 30; received 29/,
            mutate: (sample) => {
                sample.runtimeFrameLoopAtEnd.targetFramesPerSecond = 29;
            },
        },
        'missing start snapshot': {
            expected: /runtimeFrameLoopAtStart is missing/,
            mutate: (sample) => {
                delete sample.runtimeFrameLoopAtStart;
            },
        },
    };

    for (const [name, { expected, mutate }] of Object.entries(cases)) {
        await t.test(name, () => {
            const { baseline, candidate } = reportPair(gardenSwitchScenario);
            mutate(candidate.scenarios[0].gardenSwitch.arrivals[0].sample);

            const comparison = comparePartialReports(baseline, candidate);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }
});

test('garden-switch semantic rendered-FPS gate rejects a true under-target cadence', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of baseline.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            arrival.sample.renderedFps = 45;
        }
    }
    for (const scenario of candidate.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            arrival.sample.renderedFps = 27.9;
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const renderedFps = comparison.comparisons.find(
        (result) => result.id === 'frame.rendered_fps',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    assert.equal(renderedFps.minimumRenderedFps, 28);
    assert.equal(renderedFps.pass, false);
    assert.equal(renderedFps.regressionBreach, true);
    assert.equal(
        renderedFps.individual.every(
            (run) => run.candidateFloorPass === false && run.pass === false,
        ),
        true,
    );
});

test('garden-switch full-length control rejects over-target cadence', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of candidate.scenarios) {
        scenario.gardenSwitch.arrivals[0].sample.renderedFps = 32.1;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const renderedFps = comparison.comparisons.find(
        (result) =>
            result.id === 'frame.rendered_fps' &&
            result.phase === 'arrival-1-high-target',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    assert.equal(renderedFps.maximumRenderedFps, 32);
    assert.equal(renderedFps.pass, false);
    assert.equal(renderedFps.regressionBreach, true);
    assert.equal(
        renderedFps.individual.every(
            (run) => run.candidateCeilingPass === false && run.pass === false,
        ),
        true,
    );
});

test('garden-switch GPU p95 gates latency while elapsed occupancy stays diagnostic', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of baseline.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: 450,
                renderedFrames: 45,
            });
        }
    }
    for (const scenario of candidate.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 23,
                elapsedTotalMs: 330,
                renderedFrames: 30,
            });
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const gpuP95 = comparison.comparisons.filter(
        (result) => result.id === 'gpu.p95_ms',
    );
    const gpuOccupancy = comparison.comparisons.filter(
        (result) => result.id === 'gpu.elapsed_window_occupancy_percent',
    );
    const workflowOccupancy = comparison.comparisons.find(
        (result) => result.id === 'gpu.elapsed_workflow_occupancy_percent',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(gpuP95.length, 7);
    assert.equal(gpuOccupancy.length, 7);
    for (const result of gpuP95) {
        assert.equal(result.medianRatio, 1.5333);
        assert.notEqual(result.diagnosticOnly, true);
        assert.equal(result.screeningBreach, true);
        assert.equal(result.regressionBreach, true);
        assert.equal(result.pass, false);
    }
    for (const result of gpuOccupancy) {
        assert.equal(result.baselineMedian, 45);
        assert.equal(result.candidateMedian, 33);
        assert.equal(result.medianRatio, 0.7333);
        assert.equal(result.diagnosticOnly, true);
        assert.equal(result.regressionBreach, false);
        assert.equal(result.pass, true);
    }
    assert.equal(workflowOccupancy.baselineMedian, 45);
    assert.equal(workflowOccupancy.candidateMedian, 33);
    assert.equal(workflowOccupancy.diagnosticOnly, true);
    assert.equal(workflowOccupancy.pass, true);
    assert.match(
        buildMarkdown(comparison),
        /diagnostic only; gated by GPU p95, semantic delivery, causal scheduler wakeup accounting, and submitted render work/,
    );
});

test('garden-switch elapsed occupancy remains diagnostic when timer-query duty cycle rises', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of baseline.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: 400,
                renderedFrames: 40,
            });
        }
    }
    for (const scenario of candidate.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: 600,
                renderedFrames: 30,
            });
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const gpuOccupancy = comparison.comparisons.find(
        (result) => result.id === 'gpu.elapsed_workflow_occupancy_percent',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
    assert.equal(gpuOccupancy.baselineMedian, 40);
    assert.equal(gpuOccupancy.candidateMedian, 60);
    assert.equal(gpuOccupancy.medianRatio, 1.5);
    assert.equal(gpuOccupancy.baselineRelativeRegressionBreach, true);
    assert.equal(gpuOccupancy.diagnosticOnly, true);
    assert.equal(gpuOccupancy.regressionBreach, false);
    assert.equal(gpuOccupancy.pass, true);
});

test('garden-switch full-length initial occupancy remains a complete diagnostic', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of baseline.scenarios) {
        for (const arrival of scenario.gardenSwitch.arrivals) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: 400,
                renderedFrames: 40,
            });
        }
    }
    for (const scenario of candidate.scenarios) {
        for (const [
            index,
            arrival,
        ] of scenario.gardenSwitch.arrivals.entries()) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: index === 0 ? 600 : 400,
                renderedFrames: 40,
            });
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const initialOccupancy = comparison.comparisons.find(
        (result) =>
            result.id === 'gpu.elapsed_window_occupancy_percent' &&
            result.phase === 'arrival-1-high-target',
    );
    const workflowOccupancy = comparison.comparisons.find(
        (result) => result.id === 'gpu.elapsed_workflow_occupancy_percent',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
    assert.equal(initialOccupancy.medianRatio, 1.5);
    assert.equal(initialOccupancy.baselineRelativeRegressionBreach, true);
    assert.equal(initialOccupancy.diagnosticOnly, true);
    assert.equal(initialOccupancy.regressionBreach, false);
    assert.equal(initialOccupancy.pass, true);
    assert.equal(workflowOccupancy.baselineMedian, 40);
    assert.equal(workflowOccupancy.candidateMedian, 42.8571);
    assert.equal(workflowOccupancy.pass, true);
});

test('garden-switch workflow occupancy preserves the wall-time-weighted diagnostic', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of baseline.scenarios) {
        for (const [
            index,
            arrival,
        ] of scenario.gardenSwitch.arrivals.entries()) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: index === 0 ? 100 : 400,
                renderedFrames: 40,
            });
        }
    }
    for (const scenario of candidate.scenarios) {
        for (const [
            index,
            arrival,
        ] of scenario.gardenSwitch.arrivals.entries()) {
            setAvailableGpuSample(arrival.sample, {
                elapsedMs: 1_000,
                elapsedP95Ms: 15,
                elapsedTotalMs: index === 0 ? 900 : 400,
                renderedFrames: 40,
            });
        }
    }

    const comparison = comparePartialReports(baseline, candidate);
    const initialOccupancy = comparison.comparisons.find(
        (result) =>
            result.id === 'gpu.elapsed_window_occupancy_percent' &&
            result.phase === 'arrival-1-high-target',
    );
    const workflowOccupancy = comparison.comparisons.find(
        (result) => result.id === 'gpu.elapsed_workflow_occupancy_percent',
    );

    assert.equal(comparison.status, 'pass');
    assert.equal(initialOccupancy.diagnosticOnly, true);
    assert.equal(initialOccupancy.pass, true);
    assert.equal(initialOccupancy.baselineRelativeRegressionBreach, true);
    assert.equal(workflowOccupancy.baselineMedian, 35.7143);
    assert.equal(workflowOccupancy.candidateMedian, 47.1429);
    assert.equal(workflowOccupancy.medianRatio, 1.32);
    assert.equal(workflowOccupancy.diagnosticOnly, true);
    assert.equal(workflowOccupancy.baselineRelativeRegressionBreach, true);
    assert.equal(workflowOccupancy.regressionBreach, false);
    assert.equal(workflowOccupancy.pass, true);
});

test('garden-switch full-length control gates total submitted work', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    for (const scenario of candidate.scenarios) {
        const sampleValue = scenario.gardenSwitch.arrivals[0].sample;
        sampleValue.drawCalls *= 1.06;
        sampleValue.submittedTriangles *= 1.06;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const totalDraws = comparison.comparisons.find(
        (result) => result.id === 'render.draw_calls_total',
    );
    const totalTriangles = comparison.comparisons.find(
        (result) => result.id === 'render.triangles_total',
    );

    assert.equal(comparison.status, 'regression');
    assert.equal(comparison.exitCode, 1);
    for (const result of [totalDraws, totalTriangles]) {
        assert.equal(result.phase, 'arrival-1-high-target');
        assert.equal(result.medianLimit, 1.05);
        assert.equal(result.runLimit, 1.1);
        assert.equal(result.medianRatio, 1.06);
        assert.equal(result.regressionBreach, true);
        assert.equal(result.pass, false);
    }
});

test('garden-switch scheduler efficiency rejects non-semantic wakeups', async (t) => {
    const cases = {
        'callback is not pending': {
            expected: /callbackPending must be true/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtEnd.callbackPending = false;
            },
        },
        'callback conservation mismatch': {
            expected: /callback conservation must equal/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopCounterDeltas.scheduledCallbackCount += 1;
            },
        },
        'incomplete display calibration': {
            expected: /displayFrameCalibrationCount must be a positive integer/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtStart.displayFrameCalibrationCount = 0;
            },
        },
        'inactive display calibration': {
            expected: /displayFrameIntervalMs must be a positive finite number/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtStart.displayFrameIntervalMs =
                    null;
            },
        },
        'malformed end receipt boundary': {
            expected:
                /runtimeFrameLoopAtEnd.awaitingFrameReceipt must be a boolean/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtEnd.awaitingFrameReceipt = null;
            },
        },
        'missed frame receipt': {
            expected: /missedFrameReceiptCount must be 0/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopCounterDeltas.missedFrameReceiptCount = 1;
            },
        },
        'missing receipt probe counter': {
            expected:
                /pendingFrameReceiptReconciliationWakeupCount must be a non-negative integer/,
            mutate: (sampleValue) => {
                delete sampleValue.runtimeFrameLoopCounterDeltas
                    .pendingFrameReceiptReconciliationWakeupCount;
            },
        },
        'missing start receipt boundary': {
            expected:
                /runtimeFrameLoopAtStart.awaitingFrameReceipt must be a boolean/,
            mutate: (sampleValue) => {
                delete sampleValue.runtimeFrameLoopAtStart.awaitingFrameReceipt;
            },
        },
        'non-timeout pending callback': {
            expected: /pendingCallbackKind must be "timeout"/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtStart.pendingCallbackKind =
                    'frame';
            },
        },
        'timeout without a finite due time': {
            expected:
                /pendingCallbackDueAt must be a non-negative finite number/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtEnd.pendingCallbackDueAt = null;
            },
        },
        'perpetual RAF wakeups': {
            expected: /postCalibrationFrameWakeupCount must be 0/,
            mutate: (sampleValue) => {
                const deltas = sampleValue.runtimeFrameLoopCounterDeltas;
                deltas.wakeupCount = 390;
                deltas.productiveWakeupCount = 390;
                deltas.postCalibrationFrameWakeupCount = 360;
                deltas.scheduledCallbackCount =
                    deltas.wakeupCount + deltas.cancelledCallbackCount;
            },
        },
        'unclassified wakeup': {
            expected: /wakeup classification conservation must equal/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopCounterDeltas.wakeupCount += 1;
                sampleValue.runtimeFrameLoopCounterDeltas.scheduledCallbackCount += 1;
            },
        },
        'unexpected no-work wakeup': {
            expected: /unexpectedNoWorkWakeupCount must be 0/,
            mutate: (sampleValue) => {
                const deltas = sampleValue.runtimeFrameLoopCounterDeltas;
                deltas.wakeupCount += 1;
                deltas.unexpectedNoWorkWakeupCount += 1;
                deltas.scheduledCallbackCount += 1;
            },
        },
        'render receipt mismatch': {
            expected: /renderedFrames must equal the positive/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount -= 1;
            },
        },
        'receipt probe ownership bound': {
            expected:
                /pendingFrameReceiptReconciliationWakeupCount must not exceed ownedInvalidationCount plus an awaiting receipt at sample start/,
            mutate: (sampleValue) => {
                const deltas = sampleValue.runtimeFrameLoopCounterDeltas;
                deltas.pendingFrameReceiptReconciliationWakeupCount =
                    deltas.ownedInvalidationCount + 1;
                deltas.wakeupCount +=
                    deltas.pendingFrameReceiptReconciliationWakeupCount;
                deltas.scheduledCallbackCount +=
                    deltas.pendingFrameReceiptReconciliationWakeupCount;
            },
        },
        'unstable display calibration': {
            expected:
                /displayFrameCalibrationCount must remain stable across the sample window/,
            mutate: (sampleValue) => {
                sampleValue.runtimeFrameLoopAtEnd.displayFrameCalibrationCount = 2;
            },
        },
    };

    for (const [name, { expected, mutate }] of Object.entries(cases)) {
        await t.test(name, () => {
            const { baseline, candidate } = reportPair(gardenSwitchScenario);
            mutate(candidate.scenarios[0].gardenSwitch.arrivals[0].sample);

            const comparison = comparePartialReports(baseline, candidate);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(comparison.validationErrors.join('\n'), expected);
        });
    }
});

test('garden-switch scheduler efficiency accepts a causally retained no-op timeout', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    const deltas =
        candidate.scenarios[0].gardenSwitch.arrivals[0].sample
            .runtimeFrameLoopCounterDeltas;
    deltas.wakeupCount += 1;
    deltas.retainedTimeoutReconciliationWakeupCount += 1;
    deltas.scheduledCallbackCount += 1;

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
});

test('garden-switch scheduler efficiency accepts a bounded pending receipt probe', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    const sampleValue = candidate.scenarios[0].gardenSwitch.arrivals[0].sample;
    const deltas = sampleValue.runtimeFrameLoopCounterDeltas;
    sampleValue.runtimeFrameLoopAtStart.awaitingFrameReceipt = true;
    deltas.ownedInvalidationCount = 0;
    deltas.pendingFrameReceiptReconciliationWakeupCount = 1;
    deltas.wakeupCount += 1;
    deltas.scheduledCallbackCount += 1;

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
});

test('garden-switch canonical baseline requires the full scheduler evidence', () => {
    const { baseline, candidate } = reportPair(gardenSwitchScenario);
    const sampleValue = baseline.scenarios[0].gardenSwitch.arrivals[0].sample;
    delete sampleValue.runtimeFrameLoopAtStart.awaitingFrameReceipt;
    delete sampleValue.runtimeFrameLoopAtEnd.awaitingFrameReceipt;
    delete sampleValue.runtimeFrameLoopCounterDeltas
        .pendingFrameReceiptReconciliationWakeupCount;

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /baseline\.sample\.runtimeFrameLoopAtStart\.awaitingFrameReceipt must be a boolean/,
    );
    assert.match(
        comparison.validationErrors.join('\n'),
        /baseline\.sample\.runtimeFrameLoopCounterDeltas\.pendingFrameReceiptReconciliationWakeupCount must be a non-negative integer/,
    );
});

test('garden-switch elapsed-window GPU evidence fails closed for incomplete or unordered timing', async (t) => {
    const cases = {
        'mismatched GPU sample count': (sample) => {
            sample.gpu.sampleCount -= 1;
        },
        'non-null valid timing reason': (sample) => {
            sample.gpu.reason = 'unexpected timer state';
        },
        'p95 exceeds maximum': (sample) => {
            sample.gpu.elapsedMaxMs = sample.gpu.elapsedP95Ms - 1;
        },
        'maximum exceeds total': (sample) => {
            sample.gpu.elapsedMaxMs = sample.gpu.elapsedTotalMs + 1;
        },
        'missing GPU maximum': (sample) => {
            delete sample.gpu.elapsedMaxMs;
        },
        'missing GPU total': (sample) => {
            delete sample.gpu.elapsedTotalMs;
        },
    };

    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const { baseline, candidate } = reportPair(gardenSwitchScenario);
            for (const report of [baseline, candidate]) {
                for (const scenario of report.scenarios) {
                    for (const arrival of scenario.gardenSwitch.arrivals) {
                        setAvailableGpuSample(arrival.sample, {
                            elapsedMs: 1_000,
                            elapsedP95Ms: 15,
                            elapsedTotalMs: 400,
                            renderedFrames: 40,
                        });
                    }
                }
            }
            mutate(candidate.scenarios[0].gardenSwitch.arrivals[0].sample);

            const comparison = comparePartialReports(baseline, candidate);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.match(
                comparison.validationErrors.join('\n'),
                /GPU timing marked valid requires|GPU elapsed-window evidence requires/,
            );
        });
    }
});

test('comparison fails closed for scenario and environment incompatibilities', async (t) => {
    const cases = {
        'different DPR': (candidate) => {
            candidate.scenarios[0].requested.dpr = 1;
        },
        'different budget': (candidate) => {
            candidate.scenarios[0].budgetName = 'otherBudget';
        },
        'different fixture': (candidate) => {
            candidate.scenarios[0].runtime.blockCount = 298;
        },
        'different path': (candidate) => {
            candidate.scenarios[0].path += '&controls=1';
        },
        'different raw name': (candidate) => {
            candidate.scenarios[0].name += '-renamed';
        },
        'different quality': (candidate) => {
            candidate.scenarios[0].requested.quality = 'medium';
        },
        'different renderer': (candidate) => {
            candidate.scenarios[0].environment.renderer = 'Other Renderer';
        },
        'missing renderer': (candidate) => {
            candidate.scenarios[0].environment.renderer = '';
        },
        'different sample window': (candidate) => {
            candidate.options.sampleMs = 6_000;
        },
        'different user agent': (candidate) => {
            candidate.scenarios[0].environment.userAgent = 'Other Browser';
        },
        'different viewport': (candidate) => {
            candidate.scenarios[0].requested.viewport.width = 1_440;
        },
        'missing repeat': (candidate) => {
            candidate.scenarios.pop();
        },
        'missing base name': (candidate) => {
            delete candidate.scenarios[0].baseName;
        },
        'missing profile run': (candidate) => {
            delete candidate.scenarios[0].profileRun;
        },
    };

    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const { baseline, candidate } = reportPair();
            mutate(candidate);
            const comparison = comparePartialReports(baseline, candidate);
            assert.equal(comparison.status, 'invalid');
            assert.equal(comparison.exitCode, 2);
            assert.ok(comparison.validationErrors.length > 0);
        });
    }
});

test('structural acceptance must pass in every raw run', () => {
    let pair = reportPair();
    pair.baseline.scenarios[1].acceptance.pass = false;
    let comparison = comparePartialReports(pair.baseline, pair.candidate);
    assert.equal(comparison.exitCode, 2);
    assert.match(comparison.validationErrors.join('\n'), /acceptance\.pass/);

    pair = reportPair();
    delete pair.candidate.scenarios[0].acceptance;
    comparison = comparePartialReports(pair.baseline, pair.candidate);
    assert.equal(comparison.exitCode, 2);
    assert.match(comparison.validationErrors.join('\n'), /acceptance\.pass/);
});

test('absolute performance budgets must pass in every raw run', () => {
    for (const field of ['budget', 'performanceBudget']) {
        let pair = reportPair();
        pair.candidate.scenarios[0][field].pass = false;
        let comparison = comparePartialReports(pair.baseline, pair.candidate);
        assert.equal(comparison.exitCode, 2);
        assert.match(
            comparison.validationErrors.join('\n'),
            new RegExp(`${field}\\.pass`),
        );

        pair = reportPair();
        pair.candidate.scenarios[0][field].checks[0].pass = false;
        comparison = comparePartialReports(pair.baseline, pair.candidate);
        assert.equal(comparison.exitCode, 2);
        assert.match(
            comparison.validationErrors.join('\n'),
            new RegExp(`${field}\\.checks\\[0\\]\\.pass`),
        );

        pair = reportPair();
        pair.candidate.scenarios[0][field].checks = [];
        comparison = comparePartialReports(pair.baseline, pair.candidate);
        assert.equal(comparison.exitCode, 2);
        assert.match(
            comparison.validationErrors.join('\n'),
            new RegExp(`${field}\\.checks must be a non-empty array`),
        );
    }
});

test('provenance rejects malformed, dirty, mismatched, and same-source reports', async (t) => {
    const cases = {
        'dirty subject': ({ candidate }) => {
            candidate.provenance.subject.dirty = true;
        },
        'dirty harness': ({ candidate }) => {
            candidate.provenance.harness.dirty = true;
        },
        'mismatched source alias': ({ candidate }) => {
            candidate.sourceCommit = baselineCommit;
        },
        'nonempty reasons despite comparable': ({ candidate }) => {
            candidate.provenance.reasons = ['hidden mismatch'];
        },
        'mismatched scenario marker': ({ candidate }) => {
            candidate.scenarios[0].servedBuildProvenance.commit =
                baselineCommit;
        },
        'dirty scenario marker': ({ candidate }) => {
            candidate.scenarios[0].servedBuildProvenance.dirty = true;
        },
        'mismatched scenario contract': ({ candidate }) => {
            candidate.scenarios[0].servedBuildProvenance.comparisonContractVersion = 3;
        },
        'contract-v3 producer': ({ candidate }) => {
            candidate.comparisonContractVersion = 3;
            for (const scenario of candidate.scenarios) {
                scenario.servedBuildProvenance.comparisonContractVersion = 3;
            }
        },
        'producer marked incomparable': ({ candidate }) => {
            candidate.provenance.comparable = false;
            candidate.provenance.reasons = ['served marker did not match'];
        },
        'unknown subject': ({ candidate }) => {
            candidate.provenance.subject.commit = 'unknown';
            candidate.sourceCommit = 'unknown';
        },
    };
    for (const [name, mutate] of Object.entries(cases)) {
        await t.test(name, () => {
            const pair = reportPair();
            mutate(pair);
            assert.equal(
                comparePartialReports(pair.baseline, pair.candidate).exitCode,
                2,
            );
        });
    }

    const { baseline, candidate } = reportPair();
    candidate.provenance.subject.commit = baselineCommit;
    candidate.sourceCommit = baselineCommit;
    for (const scenario of candidate.scenarios) {
        scenario.servedBuildProvenance.commit = baselineCommit;
    }
    assert.equal(comparePartialReports(baseline, candidate).exitCode, 2);
    assert.equal(
        comparePartialReports(baseline, candidate, { allowSameSource: true })
            .exitCode,
        0,
    );

    const lowercase = report({
        commit: 'a'.repeat(40),
        scenarios: [normalScenario(1)],
    });
    const uppercase = report({
        commit: 'A'.repeat(40),
        scenarios: [normalScenario(1)],
    });
    assert.equal(
        comparePartialReports(lowercase, uppercase, { allowSameSource: true })
            .exitCode,
        2,
    );
});

test('different subjects are comparable when profiler harness provenance matches', () => {
    const { baseline, candidate } = reportPair();

    assert.notEqual(
        baseline.provenance.subject.commit,
        candidate.provenance.subject.commit,
    );
    assert.notEqual(
        baseline.provenance.subject.commit,
        baseline.provenance.harness.commit,
    );
    assert.notEqual(
        candidate.provenance.subject.commit,
        candidate.provenance.harness.commit,
    );
    assert.deepEqual(baseline.provenance.harness, candidate.provenance.harness);

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.comparable, true);
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.exitCode, 0);
});

test('mismatched profiler harness provenance invalidates the report pair', () => {
    const { baseline, candidate } = reportPair();
    candidate.provenance.harness.commit = 'e'.repeat(40);

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.comparable, false);
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /profiler harness provenance differs/,
    );
});

test('a managed report cannot separate its served subject from its harness', () => {
    const { baseline, candidate } = reportPair();
    candidate.options.build = true;
    candidate.options.managedServer = true;
    candidate.provenance.server = {
        buildPerformed: true,
        mode: 'managed',
    };

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.comparable, false);
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /must match the served-build subject commit for a managed server/,
    );
});

test('malformed raw scenarios return invalid instead of throwing', () => {
    const { baseline, candidate } = reportPair();
    candidate.scenarios[0] = null;

    assert.doesNotThrow(() => comparePartialReports(baseline, candidate));
    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.exitCode, 2);
    assert.match(comparison.validationErrors.join('\n'), /must be an object/);
});

test('GPU timing is skipped symmetrically and asymmetry is invalid', () => {
    const { baseline, candidate } = reportPair();
    let comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    assert.equal(
        comparison.skipped.filter((item) => item.metric === 'gpu.p95_ms')
            .length,
        3,
    );

    setAvailableGpuSample(candidate.scenarios[0].sample, {
        elapsedMs: 1_000,
        elapsedP95Ms: 4,
        elapsedTotalMs: 4,
        renderedFrames: 1,
    });
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.equal(comparison.exitCode, 2);

    candidate.scenarios[0].sample.gpu = structuredClone(
        baseline.scenarios[0].sample.gpu,
    );
    candidate.scenarios[0].sample.gpu.reason = 'different unavailable reason';
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.match(comparison.validationErrors.join('\n'), /different reasons/);

    delete baseline.scenarios[0].sample.gpu.reason;
    delete candidate.scenarios[0].sample.gpu.reason;
    comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'invalid');
    assert.match(comparison.validationErrors.join('\n'), /explicit reason/);

    const malformed = reportPair();
    malformed.baseline.scenarios[0].sample.gpu = {
        complete: false,
        elapsedP95Ms: 4,
        supported: true,
        valid: true,
    };
    malformed.candidate.scenarios[0].sample.gpu = structuredClone(
        malformed.baseline.scenarios[0].sample.gpu,
    );
    comparison = comparePartialReports(malformed.baseline, malformed.candidate);
    assert.equal(comparison.exitCode, 2);
    assert.match(
        comparison.validationErrors.join('\n'),
        /GPU timing marked valid requires/,
    );

    for (const gpu of [
        {
            complete: true,
            disjoint: true,
            elapsedP95Ms: 4,
            sampleCount: 1,
            supported: true,
            valid: true,
        },
        {
            complete: true,
            disjoint: false,
            elapsedP95Ms: 4,
            sampleCount: 0,
            supported: true,
            valid: true,
        },
    ]) {
        const malformedGpu = reportPair();
        malformedGpu.baseline.scenarios[0].sample.gpu = gpu;
        malformedGpu.candidate.scenarios[0].sample.gpu = structuredClone(gpu);
        comparison = comparePartialReports(
            malformedGpu.baseline,
            malformedGpu.candidate,
        );
        assert.equal(comparison.exitCode, 2);
        assert.match(
            comparison.validationErrors.join('\n'),
            /complete, valid, non-disjoint queries/,
        );
    }
});

test('available GPU p95 uses a practical median noise floor', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of baseline.scenarios) {
        setAvailableGpuSample(scenario.sample, {
            elapsedMs: 1_000,
            elapsedP95Ms: 4,
            elapsedTotalMs: 4,
            renderedFrames: 1,
        });
    }
    for (const scenario of candidate.scenarios) {
        setAvailableGpuSample(scenario.sample, {
            elapsedMs: 1_000,
            elapsedP95Ms: 11,
            elapsedTotalMs: 11,
            renderedFrames: 1,
        });
    }
    const comparison = comparePartialReports(baseline, candidate);
    const gpu = comparison.comparisons.find(
        (result) => result.id === 'gpu.p95_ms',
    );
    assert.equal(gpu.medianRatio, 2.75);
    assert.equal(gpu.pass, false);
    assert.equal(comparison.exitCode, 1);
});

test('Markdown reports SHAs, status, counts, failures, deltas, and skips', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of candidate.scenarios) {
        scenario.sample.p95FrameMs = 21;
    }
    const comparison = comparePartialReports(baseline, candidate);
    const markdown = buildMarkdown(comparison);

    assert.match(markdown, new RegExp(baselineCommit));
    assert.match(markdown, new RegExp(candidateCommit));
    assert.match(markdown, /Status: \*\*regression\*\*/);
    assert.match(markdown, /comparisons:/);
    assert.match(markdown, /## Regressions/);
    assert.match(markdown, /## Skipped metrics/);
    assert.match(markdown, /Delta/);
});

test('argument parser supports positional and named paths without threshold overrides', () => {
    const positional = parseArgs([
        '--allow-partial',
        '--allow-same-source',
        '--out-dir',
        'comparison-output',
        'before.json',
        'after.json',
    ]);
    assert.equal(positional.allowPartial, true);
    assert.equal(positional.allowSameSource, true);
    assert.equal(positional.baselinePath, resolve('before.json'));
    assert.equal(positional.candidatePath, resolve('after.json'));
    assert.equal(positional.outDir, resolve('comparison-output'));

    const named = parseArgs([
        '--baseline',
        'before.json',
        '--baseline-confirmation',
        'before-repeat.json',
        '--baseline-scheduler-contract',
        'legacy-heartbeat-v1',
        '--candidate',
        'after.json',
        '--confirmation',
        'after-repeat.json',
    ]);
    assert.equal(named.baselinePath, resolve('before.json'));
    assert.equal(named.baselineConfirmationPath, resolve('before-repeat.json'));
    assert.equal(named.baselineSchedulerContract, 'legacy-heartbeat-v1');
    assert.equal(named.confirmationPath, resolve('after-repeat.json'));
    assert.throws(
        () =>
            parseArgs([
                '--baseline',
                'before.json',
                '--baseline-confirmation',
                'before-repeat.json',
                '--candidate',
                'after.json',
            ]),
        /requires --confirmation/,
    );
    assert.throws(
        () => parseArgs(['before.json', 'after.json']),
        /requires both --baseline-confirmation and --confirmation/,
    );
    assert.throws(
        () =>
            parseArgs([
                '--baseline',
                'before.json',
                '--candidate',
                'after.json',
                '--confirmation',
                'after-repeat.json',
            ]),
        /requires both --baseline-confirmation and --confirmation/,
    );
    assert.throws(
        () => parseArgs(['--median-frame-limit', '1.5']),
        /Unknown option/,
    );
    assert.throws(
        () =>
            parseArgs([
                '--baseline-scheduler-contract',
                'unknown-v1',
                '--allow-partial',
                'before.json',
                'after.json',
            ]),
        /Unsupported baseline scheduler contract/,
    );
    assert.throws(
        () =>
            parseArgs([
                '--baseline-scheduler-contract',
                'legacy-heartbeat-v1',
                '--allow-same-source',
                'before.json',
                'after.json',
            ]),
        /cannot be combined/,
    );
});

test('report writer emits stamped and latest JSON and Markdown files', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'game-compare-writer-'));
    try {
        const { baseline, candidate } = reportPair();
        const comparison = comparePartialReports(baseline, candidate);
        const paths = await writeComparisonReports(comparison, directory);
        const written = JSON.parse(await readFile(paths.jsonPath, 'utf8'));
        assert.equal(written.schemaVersion, 3);
        assert.equal(written.status, 'pass');
        assert.match(
            await readFile(paths.markdownPath, 'utf8'),
            /Status: \*\*pass\*\*/,
        );
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test('CLI returns exact pass, regression, and invalid exit codes', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'game-compare-cli-'));
    try {
        const { baseline, candidate } = reportPair();
        const baselinePath = resolve(directory, 'baseline.json');
        const baselineConfirmationPath = resolve(
            directory,
            'baseline-confirmation.json',
        );
        const candidatePath = resolve(directory, 'candidate.json');
        const confirmationPath = resolve(directory, 'confirmation.json');
        const outDir = resolve(directory, 'output');
        await Promise.all([
            writeFile(baselinePath, JSON.stringify(baseline)),
            writeFile(
                baselineConfirmationPath,
                JSON.stringify(independentBaselineRepeat(baseline)),
            ),
            writeFile(candidatePath, JSON.stringify(candidate)),
            writeFile(
                confirmationPath,
                JSON.stringify(independentRepeat(candidate)),
            ),
        ]);
        assert.equal(
            await runCli([
                baselinePath,
                candidatePath,
                '--allow-partial',
                '--out-dir',
                outDir,
            ]),
            0,
        );

        for (const scenario of candidate.scenarios) {
            scenario.cdp.scriptDuration = 1;
        }
        await writeFile(candidatePath, JSON.stringify(candidate));
        assert.equal(
            await runCli([
                baselinePath,
                candidatePath,
                '--baseline-confirmation',
                baselineConfirmationPath,
                '--confirmation',
                confirmationPath,
                '--allow-partial',
                '--out-dir',
                outDir,
            ]),
            0,
        );

        for (const scenario of candidate.scenarios) {
            scenario.sample.p95FrameMs = 21;
        }
        await writeFile(candidatePath, JSON.stringify(candidate));
        assert.equal(
            await runCli([
                baselinePath,
                candidatePath,
                '--allow-partial',
                '--out-dir',
                outDir,
            ]),
            1,
        );

        candidate.schemaVersion = 4;
        await writeFile(candidatePath, JSON.stringify(candidate));
        assert.equal(
            await runCli([
                baselinePath,
                candidatePath,
                '--allow-partial',
                '--out-dir',
                outDir,
            ]),
            2,
        );
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test('CLI rejects an output directory containing input evidence', async () => {
    const directory = await mkdtemp(
        resolve(tmpdir(), 'game-compare-collision-'),
    );
    try {
        const { baseline, candidate } = reportPair();
        const evidenceDir = resolve(directory, 'evidence');
        const baselinePath = resolve(evidenceDir, 'latest.json');
        const candidatePath = resolve(directory, 'candidate.json');
        await mkdir(evidenceDir, { recursive: true });
        await Promise.all([
            writeFile(baselinePath, JSON.stringify(baseline)),
            writeFile(candidatePath, JSON.stringify(candidate)),
        ]);
        const before = await readFile(baselinePath, 'utf8');
        assert.equal(
            await runCli([
                baselinePath,
                candidatePath,
                '--allow-partial',
                '--out-dir',
                evidenceDir,
            ]),
            2,
        );
        assert.equal(await readFile(baselinePath, 'utf8'), before);
        assert.equal(JSON.parse(before).schemaVersion, 6);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});
