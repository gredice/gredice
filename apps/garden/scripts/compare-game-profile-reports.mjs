import { randomUUID } from 'node:crypto';
import {
    mkdir,
    readFile,
    realpath,
    rename,
    rm,
    writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const displayCadenceControlComparisonContractVersion = 4;
const cadenceAndLifetimeComparisonContractVersion = 5;
const comparisonContractVersion = cadenceAndLifetimeComparisonContractVersion;
const comparisonReportSchemaVersion = 3;
const profileSchemaVersion = 6;
const defaultOutDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'test-results/game-profile/comparisons',
);
const commitPattern = /^[0-9a-f]{40}$/;
const retainedHeapMeasurementMode = 'post-scenario-forced-gc-v1';
const crossTierPerformanceMeasurementMode = 'separate-observer-free-window-v1';
const crossTierRuntimeFrameLoopObservationMode =
    'separate-semantic-raf-window-v1';
const canonicalSchedulerBaselineContract = 'canonical-v1';
const legacyHeartbeatSchedulerBaselineContract = 'legacy-heartbeat-v1';
const lifecycleRendererStatsCanonicalMode = 'post-render-receipt-v1';
const lifecycleRendererStatsLegacyMode = 'legacy-pre-render-settled-v1';
const rendererStatsRuntimeMeasurementMode = 'post-render-microtask-v1';
const lifecycleLegacyRendererStatsSettleMs = 600;
const lifecycleRuntimeFrameLoopBooleanFields = [
    'canvasVisible',
    'documentVisible',
    'effectiveVisible',
    'loopActive',
];
const lifecycleRuntimeFrameLoopNumberFields = [
    'activeLeaseCount',
    'targetFramesPerSecond',
    'scheduledCallbackCount',
    'wakeupCount',
    'ownedInvalidationCount',
    'cancelledCallbackCount',
    'suspendCount',
    'resumeCount',
];
const schedulerBaselineContracts = new Set([
    canonicalSchedulerBaselineContract,
    legacyHeartbeatSchedulerBaselineContract,
]);
const regressionScenarioSet = 'cross-tier,fauna,garden-switch,lifecycle';
const regressionScenarioBaseNames = [
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
const regressionScenarioRunKeys = regressionScenarioBaseNames.flatMap(
    (baseName) => [1, 2, 3].map((profileRun) => `${baseName}::${profileRun}`),
);
const legacyContinuousRenderLeaseCompatibilityScenarioBaseNames = new Set(
    regressionScenarioBaseNames.filter(
        (baseName) =>
            baseName.startsWith('game-cross-tier-') ||
            baseName === 'game-fauna-heavy-day-interaction-desktop',
    ),
);
const gardenSwitchScenarioBaseName =
    'game-garden-switch-high-fauna-single-context-desktop';
const gardenSwitchTargetFramesPerSecond = 30;
const gardenSwitchRenderedFpsTolerance = 2;
const gardenSwitchMinimumRenderedFps =
    gardenSwitchTargetFramesPerSecond - gardenSwitchRenderedFpsTolerance;
const gardenSwitchMaximumRenderedFps =
    gardenSwitchTargetFramesPerSecond + gardenSwitchRenderedFpsTolerance;
const gardenSwitchGpuOccupancyDiagnosticGate =
    'GPU p95, semantic delivery, causal scheduler wakeup accounting, and submitted render work';
const gardenSwitchResourceDiagnosticGate =
    'garden-switch mature repeated arrivals and workflow lifetime peak resource gates';
const gardenSwitchLifetimeResourceMeasurementMode =
    'page-lifetime-webgl-program-texture-and-arrival-snapshot-geometry-v1';
const lifecycleScenarioBaseName = 'game-high-target-runtime-lifecycle-desktop';
const lifecycleTargetFramesPerSecond = 30;
const lifecycleRenderedFpsTolerance = 2;
const lifecycleMinimumRenderedFps =
    lifecycleTargetFramesPerSecond - lifecycleRenderedFpsTolerance;
const lifecycleMaximumRenderedFps =
    lifecycleTargetFramesPerSecond + lifecycleRenderedFpsTolerance;
const lifecycleMaximumP95FrameMs = 33.3;
const lifecycleResourceDiagnosticGate =
    'lifecycle mature and peak resource gates';
const crossTierTargetFramesPerSecond = 30;
const crossTierDisplayCadenceControlMode = 'profiler-owned-raf-v1';
const crossTierDisplayCadenceCallbackTimestampMode = 'scheduled-phase-v1';
const crossTierDisplayCadenceObservedRateClock = 'native-wall-time-v1';
const crossTierDisplayCadencePhaseAdvanceToleranceMs = 0.001;
const crossTierDisplayCadenceObservedRateToleranceFps = 0.01;
const crossTierDisplayCadenceCounterFields = [
    'cancelRequestCount',
    'cancelledBeforeDeliveryCount',
    'deliveredCallbackCount',
    'deliveredFrameCount',
    'nativeFrameCancellationCount',
    'nativeFrameCount',
    'requestCount',
    'skippedPhaseCount',
];
const crossTierDisplayCadenceDeltaFields = [
    ['cancelRequestCountDelta', 'cancelRequestCount'],
    ['cancelledBeforeDeliveryCountDelta', 'cancelledBeforeDeliveryCount'],
    ['deliveredCallbackCountDelta', 'deliveredCallbackCount'],
    ['deliveredFrameCountDelta', 'deliveredFrameCount'],
    ['nativeFrameCountDelta', 'nativeFrameCount'],
    ['skippedPhaseCountDelta', 'skippedPhaseCount'],
];
const crossTierRenderedFpsTolerance = 2;
const crossTierMinimumRenderedFps =
    crossTierTargetFramesPerSecond - crossTierRenderedFpsTolerance;
const crossTierMaximumRenderedFps =
    crossTierTargetFramesPerSecond + crossTierRenderedFpsTolerance;
const crossTierMatchedCadenceMedianToleranceFps = 2;
const crossTierCadenceConfoundedGpuGate =
    'mapped same-tier steady GPU p95 under matched 28-32 FPS cadence';
const legacyHeartbeatRequiredFailureNames = [
    'crossTierSampleStartActiveLeaseCount',
    'crossTierSemanticLeaseTopologyAvailable',
    'crossTierSemanticStartLeaseTopologyCount',
    'crossTierSemanticEndLeaseTopologyCount',
    'crossTierRenderedFramesMatchR3fFrameCallbackDelta',
];
const crossTierAcceptanceCheckPrefix = [
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
const crossTierAutoAcceptanceChecks = [
    'crossTierAutoMemoryGb',
    'crossTierAutoCoreCount',
    'crossTierAutoReportedDpr',
    'crossTierAutoCoarsePointer',
    'crossTierAutoNarrowViewport',
];
const crossTierAcceptanceChecksBeforeMotion = [
    'crossTierDprCap',
    'crossTierShadowsEnabled',
    'crossTierShadowMapSize',
    'crossTierGroundDecorationDensity',
    'crossTierReportedDpr',
    'crossTierCanvasClientWidth',
    'crossTierCanvasClientHeight',
    'crossTierCanvasWidth',
    'crossTierCanvasHeight',
    'crossTierGeneratedPlantFields',
    'crossTierExpectedGeneratedPlantInstances',
    'crossTierGeneratedPlantInstances',
    'crossTierVisiblePlantFields',
    'crossTierVisiblePlantInstances',
    'crossTierMinimumVisiblePlantFields',
    'crossTierMinimumVisiblePlantInstances',
    'crossTierRuntimeTargetFramesPerSecond',
    'crossTierSampleStartTargetFramesPerSecond',
    'crossTierSampleMaximumTargetFramesPerSecond',
    'crossTierSampleMinimumTargetFramesPerSecond',
    'crossTierSampleEndTargetFramesPerSecond',
    'crossTierSampleStartSnapshotTargetFramesPerSecond',
    'crossTierSampleEndSnapshotTargetFramesPerSecond',
    'crossTierSampleStartVisible',
    'crossTierSampleEndVisible',
    'crossTierSampleStartActiveLeaseCount',
    'crossTierSampleMaximumActiveLeaseCount',
    'crossTierSampleMinimumActiveLeaseCount',
    'crossTierSampleEndActiveLeaseCount',
    'crossTierSemanticLeaseTopologyAvailable',
    'crossTierSemanticStartLeaseTopologyCount',
    'crossTierSemanticEndLeaseTopologyCount',
    'crossTierSemanticEndLeaseTopology',
    'crossTierControlStartLeaseTopology',
    'crossTierControlEndLeaseTopology',
    'crossTierRafFrames',
    'crossTierSemanticRafFrames',
    'crossTierRuntimeFrameLoopObservationCount',
    'crossTierPerformanceMeasurementMode',
    'crossTierRuntimeFrameLoopObservationMode',
    'crossTierRenderedFramesMatchR3fFrameCallbackDelta',
];
const crossTierCameraMotionAcceptanceChecks = [
    'crossTierCameraMotionObserved',
    'crossTierCameraSnapshotVersionDelta',
];
const crossTierAcceptanceChecksBeforeOutlinePipeline = [
    'crossTierStaticSceneCacheRequest',
    'crossTierStaticSceneCacheEnabled',
    'crossTierOutlineFlag',
    'crossTierOutlineProfile',
    'crossTierOutlineRaisedBedId',
    'crossTierOutlineProfileDispatched',
    'crossTierOutlineTelemetryAvailable',
    'crossTierOutlineActiveTargets',
    'crossTierOutlineStyleGroups',
];
const crossTierLegacyOutlineAcceptanceChecks = [
    'crossTierOutlinePipeline',
    'crossTierOutlineLegacyHorizontalPassAlignment',
    'crossTierOutlineLegacyCompositePassAlignment',
];
const crossTierCachedOutlineAcceptanceChecks = [
    'crossTierOutlinePipeline',
    'crossTierOutlineCacheEligibleTargets',
    'crossTierOutlineCacheBypasses',
    'crossTierOutlineCacheHits',
    'crossTierOutlineCacheMisses',
    'crossTierOutlineMaskMissAlignment',
    'crossTierOutlineHorizontalPassAlignment',
    'crossTierOutlineCacheConservation',
    'crossTierOutlinePerformanceWindowBypasses',
    'crossTierOutlinePerformanceWindowHits',
    'crossTierOutlinePerformanceWindowMisses',
    'crossTierOutlinePerformanceWindowMaskPasses',
    'crossTierOutlinePerformanceWindowHorizontalPasses',
    'crossTierOutlinePerformanceWindowCompositePasses',
    'crossTierOutlinePerformanceWindowMaskConservation',
    'crossTierOutlinePerformanceWindowHorizontalAlignment',
    'crossTierOutlinePerformanceWindowCompositeConservation',
    'crossTierOutlineSemanticWindowBypasses',
    'crossTierOutlineSemanticWindowHits',
    'crossTierOutlineSemanticWindowMisses',
    'crossTierOutlineSemanticWindowMaskPasses',
    'crossTierOutlineSemanticWindowHorizontalPasses',
    'crossTierOutlineSemanticWindowCompositePasses',
    'crossTierOutlineSemanticWindowMaskConservation',
    'crossTierOutlineSemanticWindowHorizontalAlignment',
    'crossTierOutlineSemanticWindowCompositeConservation',
];
const crossTierAcceptanceCheckSuffix = [
    'crossTierOutlineCommandAction',
    'crossTierOutlineTargetBlockId',
    'crossTierScreenshotWitnessValid',
    'crossTierScreenshotWidth',
    'crossTierScreenshotHeight',
    'crossTierScreenshotOpaque',
    'crossTierScreenshotEntropy',
    'crossTierScreenshotMaximumChannelStandardDeviation',
    'crossTierScreenshotSampledLumaRange',
    'crossTierScreenshotSampledUniqueColorCount',
    'crossTierRenderedFps',
    'crossTierRenderedFrames',
    'crossTierDrawCalls',
    'crossTierSubmittedTriangles',
    'crossTierApiErrors',
    'crossTierConsoleErrors',
    'crossTierPageErrors',
];
const crossTierPerformanceCheckNames = [
    'p95FrameMs',
    'maxFrameMs',
    'longTaskCount',
    'retainedJsHeapMb',
    'drawCallsPerRenderedFrame',
    'trianglesPerRenderedFrame',
    'gpuElapsedP95Ms',
];
const crossTierBaseNamePattern =
    /^game-cross-tier-(low|medium|high|auto-standard|auto-constrained)-(steady|camera-motion)-desktop$/;
const canonicalCrossTierPolicies = {
    low: {
        autoQualityDeviceClass: 'unspecified',
        dprCap: 1,
        expectedAutoQualityMetrics: null,
        groundDecorationDensity: 0,
        quality: 'low',
        shadowMapSize: 0,
        shadows: false,
        tier: 'low',
    },
    medium: {
        autoQualityDeviceClass: 'unspecified',
        dprCap: 1.5,
        expectedAutoQualityMetrics: null,
        groundDecorationDensity: 0.5,
        quality: 'medium',
        shadowMapSize: 2_048,
        shadows: true,
        tier: 'medium',
    },
    high: {
        autoQualityDeviceClass: 'unspecified',
        dprCap: 2,
        expectedAutoQualityMetrics: null,
        groundDecorationDensity: 1,
        quality: 'high',
        shadowMapSize: 4_096,
        shadows: true,
        tier: 'high',
    },
    'auto-standard': {
        autoQualityDeviceClass: 'standard',
        dprCap: 1.5,
        expectedAutoQualityMetrics: {
            coarsePointer: false,
            coreCount: 8,
            dpr: 2,
            memoryGb: 8,
            narrowViewport: false,
        },
        groundDecorationDensity: 0.5,
        quality: 'auto',
        shadowMapSize: 2_048,
        shadows: true,
        tier: 'medium',
    },
    'auto-constrained': {
        autoQualityDeviceClass: 'constrained',
        dprCap: 1,
        expectedAutoQualityMetrics: {
            coarsePointer: false,
            coreCount: 4,
            dpr: 2,
            memoryGb: 4,
            narrowViewport: false,
        },
        groundDecorationDensity: 0.25,
        quality: 'auto',
        shadowMapSize: 1_024,
        shadows: true,
        tier: 'auto-constrained',
    },
};

// Browser/CDP counters have material same-commit variance. A median regression
// must exceed both its relative limit and this fixed practical noise floor.
const ratioMetricRegistry = [
    {
        id: 'frame.p95_ms',
        label: 'p95 frame duration',
        direction: 'maximum',
        medianAbsoluteTolerance: 2,
        medianLimit: 1.15,
        runAbsoluteTolerance: 4,
        runLimit: 1.3,
        read: ({ sample }) => sample?.p95FrameMs,
        unit: 'ms',
    },
    {
        id: 'frame.rendered_fps',
        label: 'rendered FPS',
        direction: 'minimum',
        medianAbsoluteTolerance: 5,
        medianLimit: 0.9,
        runAbsoluteTolerance: 8,
        runLimit: 0.8,
        read: ({ sample }) => sample?.renderedFps,
        unit: 'fps',
    },
    {
        id: 'render.draws_per_rendered_frame',
        label: 'draw calls per rendered frame',
        direction: 'maximum',
        medianLimit: 1.05,
        runLimit: 1.1,
        read: ({ sample }) => sample?.drawCallsPerRenderedFrame,
        unit: 'draws/frame',
    },
    {
        id: 'render.triangles_per_rendered_frame',
        label: 'triangles per rendered frame',
        direction: 'maximum',
        medianLimit: 1.05,
        runLimit: 1.1,
        read: ({ sample }) => sample?.trianglesPerRenderedFrame,
        unit: 'triangles/frame',
    },
    {
        id: 'cpu.script_duration_s',
        label: 'script duration',
        direction: 'maximum',
        medianAbsoluteTolerance: 0.5,
        medianLimit: 1.15,
        runAbsoluteTolerance: 0.75,
        runLimit: 1.3,
        read: ({ cdp }) => cdp?.scriptDuration,
        unit: 's',
    },
];

const gardenSwitchInitialTotalWorkMetricRegistry = [
    {
        id: 'render.draw_calls_total',
        label: 'total draw calls',
        direction: 'maximum',
        medianLimit: 1.05,
        runLimit: 1.1,
        read: ({ sample }) => sample?.drawCalls,
        unit: 'draws',
    },
    {
        id: 'render.triangles_total',
        label: 'total submitted triangles',
        direction: 'maximum',
        medianLimit: 1.05,
        runLimit: 1.1,
        read: ({ sample }) => sample?.submittedTriangles,
        unit: 'triangles',
    },
];

const retainedHeapMetric = {
    id: 'memory.js_heap_mb',
    label: 'retained JavaScript heap',
    direction: 'maximum',
    medianAbsoluteTolerance: 8,
    medianLimit: 1.15,
    runAbsoluteTolerance: 16,
    runLimit: 1.3,
    unit: 'MiB',
};

function timingThresholds(metricId) {
    if (metricId === 'cold.dom_content_loaded_ms') {
        return {
            direction: 'maximum',
            medianAbsoluteTolerance: 25,
            medianLimit: 1.25,
            runAbsoluteTolerance: 50,
            runLimit: 1.5,
            unit: 'ms',
        };
    }
    if (
        metricId === 'switch.displayed_ms' ||
        metricId === 'switch.visible_ms'
    ) {
        return {
            direction: 'maximum',
            medianAbsoluteTolerance: 50,
            medianLimit: 1.15,
            runAbsoluteTolerance: 100,
            runLimit: 1.3,
            unit: 'ms',
        };
    }
    if (metricId === 'switch.settled_ms') {
        return {
            direction: 'maximum',
            medianAbsoluteTolerance: 100,
            medianLimit: 1.15,
            runAbsoluteTolerance: 200,
            runLimit: 1.3,
            unit: 'ms',
        };
    }
    return {
        direction: 'maximum',
        medianAbsoluteTolerance: 100,
        medianLimit: 1.2,
        runAbsoluteTolerance: 300,
        runLimit: 1.5,
        unit: 'ms',
    };
}

const resourceMetricRegistry = [
    {
        id: 'resources.geometries',
        label: 'renderer geometries',
        field: 'rendererGeometries',
        maximumIncrease: 1,
    },
    {
        id: 'resources.shaders',
        label: 'renderer shaders',
        field: 'rendererShaders',
        maximumIncrease: 1,
    },
    {
        id: 'resources.textures',
        label: 'renderer textures',
        field: 'rendererTextures',
        maximumIncrease: 1,
    },
];

const runtimeFixtureFields = [
    'profileGardenId',
    'profileGardenStackCount',
    'profileGardenBlockCount',
    'profileGardenRaisedBedCount',
    'stackCount',
    'blockCount',
    'raisedBedCount',
    'generatedPlantExpectedInstanceCount',
    'generatedPlantFieldCount',
    'generatedPlantInstanceCount',
    'generatedPlantVisibleFieldCount',
    'generatedPlantVisibleInstanceCount',
];

// Regular profiles record the browser context DPR in requested.dpr. Only the
// lifecycle fixture additionally exposes an observed runtime.browserDpr.
const runtimePolicyFields = [
    'dprCap',
    'qualityTier',
    'shadowMapSize',
    'shadowsEnabled',
    'staticOpaqueSceneCacheEnabled',
];

const reportOptionFields = [
    'allowLegacyOperationVisuals',
    'build',
    'closeupRepeat',
    'closeupTimeoutMs',
    'graphicsBackend',
    'legacyOutlinePipeline',
    'managedServer',
    'sampleMs',
    'scenarioSet',
    'scenarios',
    'screenshots',
    'soakMs',
    'warmupMs',
];

const commonRequestedStringFields = [
    'controls',
    'details',
    'gardenProfile',
    'graphicsBackend',
    'mode',
    'quality',
    'staticSceneCache',
];

// Schema v6 captures exist on both sides of the scheduler rollout. Newer v6
// harnesses materialize these optional request values while older v6 harnesses
// omit them. Normalize only the documented semantic defaults so an older
// omission remains comparable without hiding an enabled profile or warmup.
const requestedCompatibilityDefaultsBySchemaVersion = new Map([
    [
        6,
        {
            legacyOutlinePipeline: false,
            lifecycleLiveProfile: false,
            motionWarmupMs: 0,
            runtimeOwnersProfile: false,
            staticIdle: '0',
            staticIdleProfile: false,
        },
    ],
]);

const rendererResourceFields = [
    'rendererGeometries',
    'rendererShaders',
    'rendererTextures',
];

const lifecycleCounterFields = [
    'scheduledCallbackCount',
    'wakeupCount',
    'ownedInvalidationCount',
    'cancelledCallbackCount',
    'suspendCount',
    'resumeCount',
];

const fixedFaunaSpecies = [
    'bird',
    'cat',
    'chicken',
    'cow',
    'dog',
    'goat',
    'horse',
    'piglet',
    'rabbit',
    'sheep',
];

const gardenSwitchArrivalProfiles = [
    'high-target',
    'fauna-heavy',
    'high-target',
    'fauna-heavy',
    'high-target',
    'fauna-heavy',
    'high-target',
];

const gardenSwitchArrivalGardenIds = [
    99_996, 99_995, 99_996, 99_995, 99_996, 99_995, 99_996,
];

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function hasOwn(record, field) {
    return Object.hasOwn(record, field);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}

function validateNonNegativeNumber(errors, value, path) {
    if (!isFiniteNumber(value) || value < 0) {
        errors.push(`${path} must be a non-negative finite number`);
    }
}

function validatePositiveNumber(errors, value, path) {
    if (!isFiniteNumber(value) || value <= 0) {
        errors.push(`${path} must be a positive finite number`);
    }
}

function validatePositiveInteger(errors, value, path) {
    if (!Number.isInteger(value) || value <= 0) {
        errors.push(`${path} must be a positive integer`);
    }
}

function validateExactValue(errors, value, expected, path) {
    if (canonicalJson(value) !== canonicalJson(expected)) {
        errors.push(
            `${path} must be ${canonicalJson(expected)}; received ${canonicalJson(value)}`,
        );
    }
}

function validateRetainedHeapEvidence(errors, memory, path) {
    if (!isRecord(memory)) {
        errors.push(`${path} is missing`);
        return;
    }
    validateExactValue(
        errors,
        memory.measurementMode,
        retainedHeapMeasurementMode,
        `${path}.measurementMode`,
    );
    validatePositiveNumber(
        errors,
        memory.jsHeapBeforeCollectionMb,
        `${path}.jsHeapBeforeCollectionMb`,
    );
    validatePositiveNumber(
        errors,
        memory.retainedJsHeapMb,
        `${path}.retainedJsHeapMb`,
    );
}

function validateCrossTierDisplayCadenceControlSnapshot(errors, value, path) {
    if (!isRecord(value)) {
        errors.push(`${path} is missing`);
        return null;
    }
    validateExactValue(errors, value.installed, true, `${path}.installed`);
    validateExactValue(
        errors,
        value.installationError,
        null,
        `${path}.installationError`,
    );
    validateExactValue(
        errors,
        value.mode,
        crossTierDisplayCadenceControlMode,
        `${path}.mode`,
    );
    validateExactValue(
        errors,
        value.callbackTimestampMode,
        crossTierDisplayCadenceCallbackTimestampMode,
        `${path}.callbackTimestampMode`,
    );
    validateExactValue(
        errors,
        value.observedRateClock,
        crossTierDisplayCadenceObservedRateClock,
        `${path}.observedRateClock`,
    );
    validateExactValue(
        errors,
        value.requestedFramesPerSecond,
        crossTierTargetFramesPerSecond,
        `${path}.requestedFramesPerSecond`,
    );
    validatePositiveNumber(errors, value.intervalMs, `${path}.intervalMs`);
    if (
        isFiniteNumber(value.intervalMs) &&
        Math.abs(value.intervalMs - 1_000 / crossTierTargetFramesPerSecond) >
            0.01
    ) {
        errors.push(
            `${path}.intervalMs must match the ${crossTierTargetFramesPerSecond} FPS target`,
        );
    }
    for (const field of crossTierDisplayCadenceCounterFields) {
        if (!Number.isInteger(value[field]) || value[field] < 0) {
            errors.push(`${path}.${field} must be a non-negative integer`);
        }
    }
    if (
        !Number.isInteger(value.pendingCallbackCount) ||
        value.pendingCallbackCount < 0
    ) {
        errors.push(
            `${path}.pendingCallbackCount must be a non-negative integer`,
        );
    }
    if (typeof value.nativeFramePending !== 'boolean') {
        errors.push(`${path}.nativeFramePending must be a boolean`);
    }
    if (
        Number.isInteger(value.requestCount) &&
        Number.isInteger(value.deliveredCallbackCount) &&
        Number.isInteger(value.cancelledBeforeDeliveryCount) &&
        Number.isInteger(value.pendingCallbackCount) &&
        value.requestCount !==
            value.deliveredCallbackCount +
                value.cancelledBeforeDeliveryCount +
                value.pendingCallbackCount
    ) {
        errors.push(
            `${path} requestCount must equal deliveredCallbackCount + cancelledBeforeDeliveryCount + pendingCallbackCount`,
        );
    }
    if (
        Number.isInteger(value.cancelRequestCount) &&
        Number.isInteger(value.cancelledBeforeDeliveryCount) &&
        value.cancelRequestCount < value.cancelledBeforeDeliveryCount
    ) {
        errors.push(
            `${path}.cancelRequestCount must not be less than cancelledBeforeDeliveryCount`,
        );
    }
    if (
        Number.isInteger(value.deliveredCallbackCount) &&
        Number.isInteger(value.deliveredFrameCount) &&
        value.deliveredCallbackCount < value.deliveredFrameCount
    ) {
        errors.push(
            `${path}.deliveredCallbackCount must not be less than deliveredFrameCount`,
        );
    }
    if (
        Number.isInteger(value.nativeFrameCount) &&
        Number.isInteger(value.deliveredFrameCount) &&
        value.nativeFrameCount < value.deliveredFrameCount
    ) {
        errors.push(
            `${path}.nativeFrameCount must not be less than deliveredFrameCount`,
        );
    }
    if (
        Number.isInteger(value.deliveredFrameCount) &&
        value.deliveredFrameCount > 0
    ) {
        for (const field of [
            'firstDeliveredAt',
            'firstDeliveredPhaseAt',
            'lastDeliveredAt',
            'lastDeliveredPhaseAt',
        ]) {
            validateNonNegativeNumber(errors, value[field], `${path}.${field}`);
        }
        if (
            isFiniteNumber(value.firstDeliveredAt) &&
            isFiniteNumber(value.lastDeliveredAt) &&
            value.firstDeliveredAt > value.lastDeliveredAt
        ) {
            errors.push(
                `${path}.firstDeliveredAt must not be later than lastDeliveredAt`,
            );
        }
        if (
            isFiniteNumber(value.firstDeliveredPhaseAt) &&
            isFiniteNumber(value.lastDeliveredPhaseAt) &&
            value.firstDeliveredPhaseAt > value.lastDeliveredPhaseAt
        ) {
            errors.push(
                `${path}.firstDeliveredPhaseAt must not be later than lastDeliveredPhaseAt`,
            );
        }
        if (
            isFiniteNumber(value.firstDeliveredPhaseAt) &&
            isFiniteNumber(value.firstDeliveredAt) &&
            value.firstDeliveredPhaseAt > value.firstDeliveredAt
        ) {
            errors.push(
                `${path}.firstDeliveredPhaseAt must not be later than firstDeliveredAt`,
            );
        }
        if (
            isFiniteNumber(value.lastDeliveredPhaseAt) &&
            isFiniteNumber(value.lastDeliveredAt) &&
            value.lastDeliveredPhaseAt > value.lastDeliveredAt
        ) {
            errors.push(
                `${path}.lastDeliveredPhaseAt must not be later than lastDeliveredAt`,
            );
        }
        if (
            Number.isInteger(value.skippedPhaseCount) &&
            isFiniteNumber(value.intervalMs) &&
            isFiniteNumber(value.firstDeliveredPhaseAt) &&
            isFiniteNumber(value.lastDeliveredPhaseAt)
        ) {
            const actualLifetimePhaseAdvanceMs =
                value.lastDeliveredPhaseAt - value.firstDeliveredPhaseAt;
            const expectedLifetimePhaseAdvanceMs =
                (value.deliveredFrameCount + value.skippedPhaseCount - 1) *
                value.intervalMs;
            if (
                Math.abs(
                    actualLifetimePhaseAdvanceMs -
                        expectedLifetimePhaseAdvanceMs,
                ) > crossTierDisplayCadencePhaseAdvanceToleranceMs
            ) {
                errors.push(
                    `${path} lifetime phase advance must equal (deliveredFrameCount + skippedPhaseCount - 1) * intervalMs within ${crossTierDisplayCadencePhaseAdvanceToleranceMs} ms`,
                );
            }
        }
    }
    if (Number.isInteger(value.deliveredFrameCount)) {
        if (value.deliveredFrameCount < 2) {
            validateExactValue(
                errors,
                value.observedFramesPerSecond,
                null,
                `${path}.observedFramesPerSecond`,
            );
        } else {
            validatePositiveNumber(
                errors,
                value.observedFramesPerSecond,
                `${path}.observedFramesPerSecond`,
            );
            if (
                isFiniteNumber(value.firstDeliveredAt) &&
                isFiniteNumber(value.lastDeliveredAt) &&
                value.lastDeliveredAt <= value.firstDeliveredAt
            ) {
                errors.push(
                    `${path}.lastDeliveredAt must be later than firstDeliveredAt after multiple deliveries`,
                );
            }
            if (
                isFiniteNumber(value.firstDeliveredAt) &&
                isFiniteNumber(value.lastDeliveredAt) &&
                value.lastDeliveredAt > value.firstDeliveredAt &&
                isFiniteNumber(value.observedFramesPerSecond)
            ) {
                const derivedObservedFramesPerSecond =
                    ((value.deliveredFrameCount - 1) * 1_000) /
                    (value.lastDeliveredAt - value.firstDeliveredAt);
                if (
                    Math.abs(
                        derivedObservedFramesPerSecond -
                            value.observedFramesPerSecond,
                    ) > crossTierDisplayCadenceObservedRateToleranceFps
                ) {
                    errors.push(
                        `${path}.observedFramesPerSecond must match native delivery timestamps within report precision`,
                    );
                }
            }
        }
    }
    return value;
}

function validateCrossTierDisplayCadenceControlEvidence(
    errors,
    scenario,
    path,
) {
    const requestedControl = scenario.requested?.displayCadenceControl;
    validateExactValue(
        errors,
        requestedControl,
        {
            callbackTimestampMode: crossTierDisplayCadenceCallbackTimestampMode,
            framesPerSecond: crossTierTargetFramesPerSecond,
            mode: crossTierDisplayCadenceControlMode,
            observedRateClock: crossTierDisplayCadenceObservedRateClock,
        },
        `${path}.requested.displayCadenceControl`,
    );

    const sample = scenario.sample;
    const samplePath = `${path}.sample`;
    if (!isRecord(sample)) {
        errors.push(`${samplePath} is missing`);
        return;
    }
    if (!Number.isInteger(sample.frames) || sample.frames <= 0) {
        errors.push(`${samplePath}.frames must be a positive integer`);
    }

    const control = sample.displayCadenceControl;
    const controlPath = `${samplePath}.displayCadenceControl`;
    if (!isRecord(control)) {
        errors.push(`${controlPath} is missing`);
        return;
    }
    validateExactValue(
        errors,
        control.installedAtStart,
        true,
        `${controlPath}.installedAtStart`,
    );
    validateExactValue(
        errors,
        control.installedAtEnd,
        true,
        `${controlPath}.installedAtEnd`,
    );
    validateExactValue(
        errors,
        control.mode,
        crossTierDisplayCadenceControlMode,
        `${controlPath}.mode`,
    );
    validateExactValue(
        errors,
        control.requestedFramesPerSecond,
        crossTierTargetFramesPerSecond,
        `${controlPath}.requestedFramesPerSecond`,
    );
    validateExactValue(
        errors,
        control.callbackTimestampMode,
        crossTierDisplayCadenceCallbackTimestampMode,
        `${controlPath}.callbackTimestampMode`,
    );
    validateExactValue(
        errors,
        control.observedRateClock,
        crossTierDisplayCadenceObservedRateClock,
        `${controlPath}.observedRateClock`,
    );
    validateExactValue(
        errors,
        control.intervalMs,
        1_000 / crossTierTargetFramesPerSecond,
        `${controlPath}.intervalMs`,
    );

    const atStart = validateCrossTierDisplayCadenceControlSnapshot(
        errors,
        control.atStart,
        `${controlPath}.atStart`,
    );
    const atEnd = validateCrossTierDisplayCadenceControlSnapshot(
        errors,
        control.atEnd,
        `${controlPath}.atEnd`,
    );
    if (atStart && atEnd) {
        for (const field of ['firstDeliveredAt', 'firstDeliveredPhaseAt']) {
            validateExactValue(
                errors,
                atEnd[field],
                atStart[field],
                `${controlPath}.${field} across atStart and atEnd`,
            );
        }
        for (const [snapshotName, snapshot] of [
            ['atStart', atStart],
            ['atEnd', atEnd],
        ]) {
            validateExactValue(
                errors,
                snapshot.intervalMs,
                control.intervalMs,
                `${controlPath}.${snapshotName}.intervalMs`,
            );
        }
        for (const field of crossTierDisplayCadenceCounterFields) {
            if (
                Number.isInteger(atStart[field]) &&
                Number.isInteger(atEnd[field]) &&
                atEnd[field] < atStart[field]
            ) {
                errors.push(
                    `${controlPath}.${field} must not decrease from atStart to atEnd`,
                );
            }
        }
        for (const field of ['lastDeliveredAt', 'lastDeliveredPhaseAt']) {
            if (
                isFiniteNumber(atStart[field]) &&
                isFiniteNumber(atEnd[field]) &&
                atEnd[field] < atStart[field]
            ) {
                errors.push(
                    `${controlPath}.${field} must not decrease from atStart to atEnd`,
                );
            }
        }
    }

    const positiveDeltaFields = new Set([
        'deliveredCallbackCountDelta',
        'deliveredFrameCountDelta',
        'nativeFrameCountDelta',
    ]);
    for (const [
        deltaField,
        snapshotField,
    ] of crossTierDisplayCadenceDeltaFields) {
        const delta = control[deltaField];
        if (
            !Number.isInteger(delta) ||
            delta < 0 ||
            (positiveDeltaFields.has(deltaField) && delta === 0)
        ) {
            errors.push(
                `${controlPath}.${deltaField} must be a ${positiveDeltaFields.has(deltaField) ? 'positive' : 'non-negative'} integer`,
            );
        }
        if (
            atStart &&
            atEnd &&
            Number.isInteger(atStart[snapshotField]) &&
            Number.isInteger(atEnd[snapshotField]) &&
            delta !== atEnd[snapshotField] - atStart[snapshotField]
        ) {
            errors.push(
                `${controlPath}.${deltaField} must equal atEnd.${snapshotField} - atStart.${snapshotField}`,
            );
        }
    }
    if (
        Number.isInteger(control.deliveredCallbackCountDelta) &&
        Number.isInteger(control.deliveredFrameCountDelta) &&
        control.deliveredCallbackCountDelta < control.deliveredFrameCountDelta
    ) {
        errors.push(
            `${controlPath}.deliveredCallbackCountDelta must not be less than deliveredFrameCountDelta`,
        );
    }
    if (
        Number.isInteger(control.nativeFrameCountDelta) &&
        Number.isInteger(control.deliveredFrameCountDelta) &&
        control.nativeFrameCountDelta < control.deliveredFrameCountDelta
    ) {
        errors.push(
            `${controlPath}.nativeFrameCountDelta must not be less than deliveredFrameCountDelta`,
        );
    }
    if (
        atStart &&
        atEnd &&
        isFiniteNumber(atStart.lastDeliveredPhaseAt) &&
        isFiniteNumber(atEnd.lastDeliveredPhaseAt) &&
        Number.isInteger(control.deliveredFrameCountDelta) &&
        Number.isInteger(control.skippedPhaseCountDelta) &&
        isFiniteNumber(control.intervalMs)
    ) {
        const actualPhaseAdvanceMs =
            atEnd.lastDeliveredPhaseAt - atStart.lastDeliveredPhaseAt;
        const expectedPhaseAdvanceMs =
            (control.deliveredFrameCountDelta +
                control.skippedPhaseCountDelta) *
            control.intervalMs;
        if (
            Math.abs(actualPhaseAdvanceMs - expectedPhaseAdvanceMs) >
            crossTierDisplayCadencePhaseAdvanceToleranceMs
        ) {
            errors.push(
                `${controlPath} phase advance must equal (deliveredFrameCountDelta + skippedPhaseCountDelta) * intervalMs within ${crossTierDisplayCadencePhaseAdvanceToleranceMs} ms`,
            );
        }
    }

    validatePositiveNumber(
        errors,
        control.elapsedMs,
        `${controlPath}.elapsedMs`,
    );
    if (
        isFiniteNumber(control.elapsedMs) &&
        isFiniteNumber(sample.elapsedMs) &&
        Math.abs(control.elapsedMs - sample.elapsedMs) > 0.02
    ) {
        errors.push(
            `${controlPath}.elapsedMs must match sample.elapsedMs within profiler rounding tolerance`,
        );
    }
    const observedFramesPerSecond = control.observedFramesPerSecond;
    if (
        !isFiniteNumber(observedFramesPerSecond) ||
        observedFramesPerSecond < crossTierMinimumRenderedFps ||
        observedFramesPerSecond > crossTierMaximumRenderedFps
    ) {
        errors.push(
            `${controlPath}.observedFramesPerSecond must be within ${crossTierMinimumRenderedFps}-${crossTierMaximumRenderedFps} FPS`,
        );
    }
    if (
        Number.isInteger(control.deliveredFrameCountDelta) &&
        control.deliveredFrameCountDelta > 0 &&
        isFiniteNumber(control.elapsedMs) &&
        control.elapsedMs > 0 &&
        isFiniteNumber(observedFramesPerSecond)
    ) {
        const derivedFramesPerSecond =
            (control.deliveredFrameCountDelta * 1_000) / control.elapsedMs;
        if (Math.abs(derivedFramesPerSecond - observedFramesPerSecond) > 0.05) {
            errors.push(
                `${controlPath}.observedFramesPerSecond must match deliveredFrameCountDelta / elapsedMs`,
            );
        }
    }
}

function readCrossTierLeaseTopology(value) {
    if (
        !isRecord(value) ||
        !Number.isInteger(value.activeLeaseCount) ||
        value.activeLeaseCount <= 0 ||
        !Number.isInteger(value.activeRenderLeaseCount) ||
        value.activeRenderLeaseCount !== value.activeLeaseCount ||
        !isFiniteNumber(value.targetFramesPerSecond) ||
        value.targetFramesPerSecond <= 0 ||
        !Array.isArray(value.renderLeaseOwners) ||
        value.renderLeaseOwners.some((owner) => !isNonEmptyString(owner)) ||
        !Array.isArray(value.renderLeaseSummaries) ||
        value.renderLeaseSummaries.some(
            (summary) =>
                !isRecord(summary) ||
                !isNonEmptyString(summary.owner) ||
                !isFiniteNumber(summary.framesPerSecond) ||
                summary.framesPerSecond <= 0 ||
                !Number.isInteger(summary.leaseCount) ||
                summary.leaseCount <= 0,
        )
    ) {
        return null;
    }

    const summaryLeaseCount = value.renderLeaseSummaries.reduce(
        (total, summary) => total + summary.leaseCount,
        0,
    );
    const summaryOwners = [
        ...new Set(value.renderLeaseSummaries.map((summary) => summary.owner)),
    ].sort();
    if (
        summaryLeaseCount !== value.activeRenderLeaseCount ||
        canonicalJson(summaryOwners) !== canonicalJson(value.renderLeaseOwners)
    ) {
        return null;
    }

    return {
        activeLeaseCount: value.activeLeaseCount,
        activeRenderLeaseCount: value.activeRenderLeaseCount,
        renderLeaseOwners: value.renderLeaseOwners,
        renderLeaseSummaries: value.renderLeaseSummaries,
        targetFramesPerSecond: value.targetFramesPerSecond,
    };
}

function validateCrossTierObserverIsolation(errors, sample, path) {
    if (!isRecord(sample)) {
        errors.push(`${path} is missing`);
        return;
    }
    validateExactValue(
        errors,
        sample.performanceMeasurementMode,
        crossTierPerformanceMeasurementMode,
        `${path}.performanceMeasurementMode`,
    );
    validateExactValue(
        errors,
        sample.runtimeFrameLoopObservationMode,
        crossTierRuntimeFrameLoopObservationMode,
        `${path}.runtimeFrameLoopObservationMode`,
    );

    const rafFrameCount = sample.runtimeFrameLoopObservationRafFrameCount;
    if (!Number.isInteger(rafFrameCount) || rafFrameCount <= 0) {
        errors.push(
            `${path}.runtimeFrameLoopObservationRafFrameCount must be a positive integer`,
        );
    }
    const observationCount = sample.runtimeFrameLoopObservationCount;
    if (
        !Number.isInteger(observationCount) ||
        observationCount !== rafFrameCount + 3
    ) {
        errors.push(
            `${path}.runtimeFrameLoopObservationCount must equal runtimeFrameLoopObservationRafFrameCount + 3`,
        );
    }

    const leaseFields = [
        'runtimeFrameLoopActiveLeaseCountAtStart',
        'runtimeFrameLoopActiveLeaseCountMin',
        'runtimeFrameLoopActiveLeaseCountMax',
        'runtimeFrameLoopActiveLeaseCountAtEnd',
    ];
    const leaseCounts = leaseFields.map((field) => sample[field]);
    for (const [index, leaseCount] of leaseCounts.entries()) {
        if (!Number.isInteger(leaseCount) || leaseCount <= 0) {
            errors.push(
                `${path}.${leaseFields[index]} must be a positive integer`,
            );
        }
    }
    if (
        leaseCounts.every(
            (leaseCount) => Number.isInteger(leaseCount) && leaseCount > 0,
        ) &&
        new Set(leaseCounts).size !== 1
    ) {
        errors.push(
            `${path} runtime frame-loop active lease counts must remain stable`,
        );
    }

    const topologyEntries = [
        [
            'runtimeFrameLoopSemanticLeaseTopologyAtStart',
            sample.runtimeFrameLoopSemanticLeaseTopologyAtStart,
        ],
        [
            'runtimeFrameLoopSemanticLeaseTopologyAtEnd',
            sample.runtimeFrameLoopSemanticLeaseTopologyAtEnd,
        ],
        ['runtimeFrameLoopAtStart', sample.runtimeFrameLoopAtStart],
        ['runtimeFrameLoopAtEnd', sample.runtimeFrameLoopAtEnd],
    ].map(([field, value]) => ({
        field,
        topology: readCrossTierLeaseTopology(value),
    }));
    for (const entry of topologyEntries) {
        if (entry.topology === null) {
            errors.push(`${path}.${entry.field} has invalid lease topology`);
        }
    }
    if (topologyEntries.every((entry) => entry.topology !== null)) {
        const topologyKeys = topologyEntries.map((entry) =>
            canonicalJson(entry.topology),
        );
        if (new Set(topologyKeys).size !== 1) {
            errors.push(
                `${path} semantic and observer-free lease topologies must match`,
            );
        }
        if (
            Number.isInteger(leaseCounts[0]) &&
            topologyEntries[0].topology.activeLeaseCount !== leaseCounts[0]
        ) {
            errors.push(
                `${path} semantic lease topology count must match runtimeFrameLoopActiveLeaseCountAtStart`,
            );
        }
    }
}

function validateLegacyHeartbeatControlSnapshot(errors, value, path) {
    if (!isRecord(value)) {
        errors.push(`${path} is missing`);
        return;
    }
    validateExactValue(
        errors,
        value.activeLeaseCount,
        0,
        `${path}.activeLeaseCount`,
    );
    validateExactValue(
        errors,
        value.targetFramesPerSecond,
        crossTierTargetFramesPerSecond,
        `${path}.targetFramesPerSecond`,
    );
    validateExactValue(
        errors,
        value.effectiveVisible,
        true,
        `${path}.effectiveVisible`,
    );
    validateExactValue(errors, value.loopActive, true, `${path}.loopActive`);
    for (const field of [
        'activeRenderLeaseCount',
        'renderLeaseOwners',
        'renderLeaseSummaries',
    ]) {
        if (hasOwn(value, field)) {
            errors.push(
                `${path}.${field} must be absent for the legacy contract`,
            );
        }
    }
}

function validateLegacyHeartbeatCrossTierEvidence(errors, scenario, path) {
    const runtimeFrameLoop = scenario.runtime?.runtimeFrameLoop;
    if (!isRecord(runtimeFrameLoop)) {
        errors.push(`${path}.runtime.runtimeFrameLoop is missing`);
    } else {
        validateExactValue(
            errors,
            runtimeFrameLoop.activeLeaseCount,
            0,
            `${path}.runtime.runtimeFrameLoop.activeLeaseCount`,
        );
        validateExactValue(
            errors,
            runtimeFrameLoop.targetFramesPerSecond,
            crossTierTargetFramesPerSecond,
            `${path}.runtime.runtimeFrameLoop.targetFramesPerSecond`,
        );
    }

    const sample = scenario.sample;
    const samplePath = `${path}.sample`;
    if (!isRecord(sample)) {
        errors.push(`${samplePath} is missing`);
        return;
    }
    validateExactValue(
        errors,
        sample.performanceMeasurementMode,
        crossTierPerformanceMeasurementMode,
        `${samplePath}.performanceMeasurementMode`,
    );
    validateExactValue(
        errors,
        sample.runtimeFrameLoopObservationMode,
        crossTierRuntimeFrameLoopObservationMode,
        `${samplePath}.runtimeFrameLoopObservationMode`,
    );

    const rafFrameCount = sample.runtimeFrameLoopObservationRafFrameCount;
    if (!Number.isInteger(rafFrameCount) || rafFrameCount <= 0) {
        errors.push(
            `${samplePath}.runtimeFrameLoopObservationRafFrameCount must be a positive integer`,
        );
    }
    const observationCount = sample.runtimeFrameLoopObservationCount;
    if (
        !Number.isInteger(observationCount) ||
        observationCount !== rafFrameCount + 3
    ) {
        errors.push(
            `${samplePath}.runtimeFrameLoopObservationCount must equal runtimeFrameLoopObservationRafFrameCount + 3`,
        );
    }

    for (const field of [
        'runtimeFrameLoopTargetFramesPerSecondAtStart',
        'runtimeFrameLoopTargetFramesPerSecondMin',
        'runtimeFrameLoopTargetFramesPerSecondMax',
        'runtimeFrameLoopTargetFramesPerSecondAtEnd',
    ]) {
        validateExactValue(
            errors,
            sample[field],
            crossTierTargetFramesPerSecond,
            `${samplePath}.${field}`,
        );
    }
    for (const field of [
        'runtimeFrameLoopActiveLeaseCountAtStart',
        'runtimeFrameLoopActiveLeaseCountMin',
        'runtimeFrameLoopActiveLeaseCountMax',
        'runtimeFrameLoopActiveLeaseCountAtEnd',
    ]) {
        validateExactValue(errors, sample[field], 0, `${samplePath}.${field}`);
    }
    for (const field of [
        'runtimeFrameLoopSemanticLeaseTopologyAtStart',
        'runtimeFrameLoopSemanticLeaseTopologyAtEnd',
    ]) {
        if (!hasOwn(sample, field) || sample[field] !== null) {
            errors.push(`${samplePath}.${field} must be explicit null`);
        }
    }
    validateLegacyHeartbeatControlSnapshot(
        errors,
        sample.runtimeFrameLoopAtStart,
        `${samplePath}.runtimeFrameLoopAtStart`,
    );
    validateLegacyHeartbeatControlSnapshot(
        errors,
        sample.runtimeFrameLoopAtEnd,
        `${samplePath}.runtimeFrameLoopAtEnd`,
    );

    for (const field of ['frames', 'renderedFrames']) {
        if (!Number.isInteger(sample[field]) || sample[field] <= 0) {
            errors.push(`${samplePath}.${field} must be a positive integer`);
        }
    }
    if (!isFiniteNumber(sample.renderedFps) || sample.renderedFps <= 0) {
        errors.push(
            `${samplePath}.renderedFps must be a positive finite number`,
        );
    }
    const counterDeltas = sample.runtimeFrameLoopCounterDeltas;
    if (
        !isRecord(counterDeltas) ||
        !hasOwn(counterDeltas, 'r3fFrameCallbackCount') ||
        counterDeltas.r3fFrameCallbackCount !== null
    ) {
        errors.push(
            `${samplePath}.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount must be explicit null`,
        );
    }
}

function legacyHeartbeatExpectedFailureNames(
    sample,
    inputComparisonContractVersion,
) {
    const expected = [...legacyHeartbeatRequiredFailureNames];
    if (
        inputComparisonContractVersion <
            displayCadenceControlComparisonContractVersion &&
        isFiniteNumber(sample?.renderedFps) &&
        sample.renderedFps > crossTierMaximumRenderedFps
    ) {
        expected.push('crossTierRenderedFps');
    }
    return expected.sort();
}

function buildCrossTierCheckNameInventory(
    baseName,
    { legacyOutlinePipeline = false } = {},
) {
    const acceptance = [
        ...crossTierAcceptanceCheckPrefix,
        ...(baseName.includes('-auto-') ? crossTierAutoAcceptanceChecks : []),
        ...crossTierAcceptanceChecksBeforeMotion,
        ...(baseName.includes('-camera-motion-')
            ? crossTierCameraMotionAcceptanceChecks
            : []),
        ...crossTierAcceptanceChecksBeforeOutlinePipeline,
        ...(legacyOutlinePipeline
            ? crossTierLegacyOutlineAcceptanceChecks
            : crossTierCachedOutlineAcceptanceChecks),
        ...crossTierAcceptanceCheckSuffix,
    ];
    const performance = [...crossTierPerformanceCheckNames];
    return {
        acceptance,
        budget: [...performance, ...acceptance],
        performance,
    };
}

function validateCheckNameInventory(errors, value, path, expectedNames) {
    if (!isRecord(value) || !Array.isArray(value.checks)) {
        errors.push(`${path}.checks must be an array`);
        return;
    }
    const names = [];
    const seen = new Set();
    for (const [index, check] of value.checks.entries()) {
        if (!isRecord(check) || !isNonEmptyString(check.name)) {
            errors.push(`${path}.checks[${index}] must have a name`);
            continue;
        }
        if (seen.has(check.name)) {
            errors.push(`${path}.checks has duplicate name ${check.name}`);
        }
        seen.add(check.name);
        names.push(check.name);
    }
    validateExactValue(
        errors,
        names,
        expectedNames,
        `${path} check name inventory`,
    );
}

function validateCrossTierCheckNameInventories(
    errors,
    scenario,
    path,
    { legacyOutlinePipeline },
) {
    const expected = buildCrossTierCheckNameInventory(scenario.baseName, {
        legacyOutlinePipeline,
    });
    validateCheckNameInventory(
        errors,
        scenario.acceptance,
        `${path} acceptance`,
        expected.acceptance,
    );
    validateCheckNameInventory(
        errors,
        scenario.performanceBudget,
        `${path} performanceBudget`,
        expected.performance,
    );
    validateCheckNameInventory(
        errors,
        scenario.budget,
        `${path} budget`,
        expected.budget,
    );
}

function validateLegacyHeartbeatCheckOutcome(
    errors,
    value,
    path,
    expectedFailureNames,
) {
    if (!isRecord(value)) {
        errors.push(`${path} is missing`);
        return;
    }
    if (value.pass !== false) {
        errors.push(`${path}.pass must be false for the legacy contract`);
    }
    if (!Array.isArray(value.checks) || value.checks.length === 0) {
        errors.push(`${path}.checks must be a non-empty array`);
        return;
    }
    const failedNames = [];
    const seenNames = new Set();
    for (const [index, check] of value.checks.entries()) {
        if (!isRecord(check) || !isNonEmptyString(check.name)) {
            errors.push(`${path}.checks[${index}] must have a name`);
            continue;
        }
        if (seenNames.has(check.name)) {
            errors.push(`${path}.checks has duplicate name ${check.name}`);
        }
        seenNames.add(check.name);
        if (typeof check.pass !== 'boolean') {
            errors.push(`${path}.checks[${index}].pass must be a boolean`);
        } else if (!check.pass) {
            failedNames.push(check.name);
        }
    }
    validateExactValue(
        errors,
        failedNames.sort(),
        expectedFailureNames,
        `${path} failed check names`,
    );
}

function validatePassingChecks(errors, value, path) {
    if (!isRecord(value)) {
        errors.push(`${path} is missing`);
        return;
    }
    if (value.pass !== true) {
        errors.push(`${path}.pass is not true`);
    }
    if (!Array.isArray(value.checks) || value.checks.length === 0) {
        errors.push(`${path}.checks must be a non-empty array`);
        return;
    }
    for (const [index, check] of value.checks.entries()) {
        if (!isRecord(check)) {
            errors.push(`${path}.checks[${index}] must be an object`);
        } else if (check.pass !== true) {
            errors.push(`${path}.checks[${index}].pass is not true`);
        }
    }
}

function validateRendererResources(errors, resources, path) {
    if (!isRecord(resources)) {
        errors.push(`${path} is missing`);
        return;
    }
    for (const field of rendererResourceFields) {
        validateNonNegativeNumber(errors, resources[field], `${path}.${field}`);
    }
}

function validateLifecycleRendererStatsMeasurement(
    errors,
    resources,
    path,
    expectedMode,
) {
    if (!isRecord(resources)) {
        return;
    }
    for (const field of rendererResourceFields) {
        validatePositiveNumber(errors, resources[field], `${path}.${field}`);
    }
    const measurement = resources.rendererStatsMeasurement;
    const measurementPath = `${path}.rendererStatsMeasurement`;
    if (!isRecord(measurement)) {
        errors.push(`${measurementPath} is missing`);
        return;
    }
    validateExactValue(
        errors,
        measurement.measurementMode,
        expectedMode,
        `${measurementPath}.measurementMode`,
    );
    validatePositiveNumber(
        errors,
        measurement.startedAt,
        `${measurementPath}.startedAt`,
    );
    validatePositiveNumber(
        errors,
        measurement.completedAt,
        `${measurementPath}.completedAt`,
    );
    if (
        isFiniteNumber(measurement.startedAt) &&
        isFiniteNumber(measurement.completedAt) &&
        measurement.completedAt < measurement.startedAt
    ) {
        errors.push(
            `${measurementPath}.completedAt must not precede startedAt`,
        );
    }
    for (const field of [
        'drawCallsDelta',
        'renderedFramesDelta',
        'submittedTrianglesDelta',
    ]) {
        validatePositiveNumber(
            errors,
            measurement[field],
            `${measurementPath}.${field}`,
        );
    }

    if (expectedMode === lifecycleRendererStatsLegacyMode) {
        validateExactValue(
            errors,
            measurement.legacySettleMs,
            lifecycleLegacyRendererStatsSettleMs,
            `${measurementPath}.legacySettleMs`,
        );
        for (const field of [
            'rendererStatsPublishedAt',
            'rendererStatsReceiptCount',
            'rendererStatsReceiptDelta',
            'rendererStatsRenderFrame',
            'r3fFrameCallbackCountDelta',
            'runtimeMeasurementMode',
        ]) {
            if (!hasOwn(measurement, field) || measurement[field] !== null) {
                errors.push(
                    `${measurementPath}.${field} must be explicit null`,
                );
            }
        }
        return;
    }

    validateExactValue(
        errors,
        measurement.runtimeMeasurementMode,
        rendererStatsRuntimeMeasurementMode,
        `${measurementPath}.runtimeMeasurementMode`,
    );
    if (measurement.legacySettleMs !== null) {
        errors.push(`${measurementPath}.legacySettleMs must be explicit null`);
    }
    validatePositiveNumber(
        errors,
        measurement.rendererStatsPublishedAt,
        `${measurementPath}.rendererStatsPublishedAt`,
    );
    if (
        isFiniteNumber(measurement.rendererStatsPublishedAt) &&
        isFiniteNumber(measurement.startedAt) &&
        measurement.rendererStatsPublishedAt <= measurement.startedAt
    ) {
        errors.push(
            `${measurementPath}.rendererStatsPublishedAt must follow startedAt`,
        );
    }
    for (const field of [
        'rendererStatsReceiptCount',
        'rendererStatsReceiptDelta',
        'rendererStatsRenderFrame',
        'r3fFrameCallbackCountDelta',
    ]) {
        if (!Number.isInteger(measurement[field]) || measurement[field] <= 0) {
            errors.push(
                `${measurementPath}.${field} must be a positive integer`,
            );
        }
    }
}

function validateLifecycleRuntimeFrameLoop(
    errors,
    runtimeFrameLoop,
    path,
    expectedRendererStatsMode,
) {
    if (!isRecord(runtimeFrameLoop)) {
        errors.push(`${path} is missing`);
        return;
    }

    if (expectedRendererStatsMode === lifecycleRendererStatsLegacyMode) {
        if (hasOwn(runtimeFrameLoop, 'awaitingFrameReceipt')) {
            errors.push(
                `${path}.awaitingFrameReceipt must be absent for the legacy contract`,
            );
        }
    } else if (typeof runtimeFrameLoop.awaitingFrameReceipt !== 'boolean') {
        errors.push(`${path}.awaitingFrameReceipt must be a boolean`);
    }

    for (const field of lifecycleRuntimeFrameLoopBooleanFields) {
        if (typeof runtimeFrameLoop[field] !== 'boolean') {
            errors.push(`${path}.${field} must be a boolean`);
        }
    }
    for (const field of lifecycleRuntimeFrameLoopNumberFields) {
        if (!isFiniteNumber(runtimeFrameLoop[field])) {
            errors.push(`${path}.${field} must be a finite number`);
        }
    }
}

function validateStructuralCounts(errors, fixture, path, prefix = '') {
    if (!isRecord(fixture)) {
        errors.push(`${path} is missing`);
        return;
    }
    for (const field of ['stackCount', 'blockCount', 'raisedBedCount']) {
        const key = prefix
            ? `${prefix}${field[0].toUpperCase()}${field.slice(1)}`
            : field;
        validateNonNegativeNumber(errors, fixture[key], `${path}.${key}`);
    }
}

function validateGeneratedPlantCounts(errors, fixture, path) {
    for (const field of [
        'generatedPlantExpectedInstanceCount',
        'generatedPlantFieldCount',
        'generatedPlantInstanceCount',
        'generatedPlantVisibleFieldCount',
        'generatedPlantVisibleInstanceCount',
    ]) {
        validateNonNegativeNumber(errors, fixture[field], `${path}.${field}`);
    }
}

function validateSpeciesCounts(errors, speciesCounts, path, requiredSpecies) {
    if (!isRecord(speciesCounts)) {
        errors.push(`${path} is missing`);
        return;
    }
    for (const species of requiredSpecies) {
        if (
            !Number.isInteger(speciesCounts[species]) ||
            speciesCounts[species] < 1
        ) {
            errors.push(`${path}.${species} must be a positive integer`);
        }
    }
}

function validateGardenFixture(errors, fixture, path, profile) {
    validateStructuralCounts(errors, fixture, path);
    if (!isRecord(fixture)) {
        return;
    }
    validateNonNegativeNumber(
        errors,
        fixture.actorGroundingShadowDroppedCount,
        `${path}.actorGroundingShadowDroppedCount`,
    );
    if (profile === 'high-target') {
        validateGeneratedPlantCounts(errors, fixture, path);
        validateSpeciesCounts(
            errors,
            fixture.speciesCounts,
            `${path}.speciesCounts`,
            ['bird', 'cat', 'dog'],
        );
    } else {
        if (
            !hasOwn(fixture, 'generatedPlantExpectedInstanceCount') ||
            fixture.generatedPlantExpectedInstanceCount !== null
        ) {
            errors.push(
                `${path}.generatedPlantExpectedInstanceCount must be null for fauna-heavy`,
            );
        }
        for (const field of [
            'generatedPlantFieldCount',
            'generatedPlantInstanceCount',
            'generatedPlantVisibleFieldCount',
            'generatedPlantVisibleInstanceCount',
        ]) {
            validateNonNegativeNumber(
                errors,
                fixture[field],
                `${path}.${field}`,
            );
        }
        validateSpeciesCounts(
            errors,
            fixture.speciesCounts,
            `${path}.speciesCounts`,
            fixedFaunaSpecies,
        );
    }
}

function validateAutoQualityMetrics(errors, metrics, path) {
    if (!isRecord(metrics)) {
        errors.push(`${path} is missing`);
        return;
    }
    if (typeof metrics.coarsePointer !== 'boolean') {
        errors.push(`${path}.coarsePointer must be a boolean`);
    }
    if (typeof metrics.narrowViewport !== 'boolean') {
        errors.push(`${path}.narrowViewport must be a boolean`);
    }
    validatePositiveNumber(errors, metrics.coreCount, `${path}.coreCount`);
    validatePositiveNumber(errors, metrics.dpr, `${path}.dpr`);
    validatePositiveNumber(errors, metrics.memoryGb, `${path}.memoryGb`);
}

function validateCanonicalScenarioEvidence(
    errors,
    scenario,
    label,
    key,
    { schedulerBaselineContract = canonicalSchedulerBaselineContract } = {},
) {
    const requested = scenario.requested;
    const runtime = scenario.runtime;
    const path = `${label} scenario ${key}`;
    if (
        !isNonEmptyString(scenario.baseName) ||
        !isRecord(requested) ||
        !isRecord(runtime)
    ) {
        return;
    }

    if (scenario.baseName.startsWith('game-cross-tier-')) {
        validateCrossTierDisplayCadenceControlEvidence(errors, scenario, path);
        if (
            schedulerBaselineContract ===
            legacyHeartbeatSchedulerBaselineContract
        ) {
            validateLegacyHeartbeatCrossTierEvidence(errors, scenario, path);
        } else {
            validateCrossTierObserverIsolation(
                errors,
                scenario.sample,
                `${path} sample`,
            );
        }
        const profileSlug = crossTierBaseNamePattern.exec(
            scenario.baseName,
        )?.[1];
        const policy = canonicalCrossTierPolicies[profileSlug];
        if (!policy) {
            errors.push(`${path} has an unsupported cross-tier profile`);
            return;
        }
        if (!isNonEmptyString(requested.autoQualityDeviceClass)) {
            errors.push(`${path} requested.autoQualityDeviceClass is missing`);
        }
        validateAutoQualityMetrics(
            errors,
            requested.autoQualityMetrics,
            `${path} requested.autoQualityMetrics`,
        );
        if (scenario.baseName.includes('-auto-')) {
            validateAutoQualityMetrics(
                errors,
                requested.expectedAutoQualityMetrics,
                `${path} requested.expectedAutoQualityMetrics`,
            );
        } else if (requested.expectedAutoQualityMetrics !== null) {
            errors.push(
                `${path} requested.expectedAutoQualityMetrics must be null for an explicit tier`,
            );
        }
        validatePositiveNumber(
            errors,
            requested.expectedDprCap,
            `${path} requested.expectedDprCap`,
        );
        validateNonNegativeNumber(
            errors,
            requested.expectedGroundDecorationDensity,
            `${path} requested.expectedGroundDecorationDensity`,
        );
        if (!isNonEmptyString(requested.expectedQualityTier)) {
            errors.push(`${path} requested.expectedQualityTier is missing`);
        }
        validateNonNegativeNumber(
            errors,
            requested.expectedShadowMapSize,
            `${path} requested.expectedShadowMapSize`,
        );
        if (typeof requested.expectedShadows !== 'boolean') {
            errors.push(`${path} requested.expectedShadows must be a boolean`);
        }
        for (const [field, expected] of Object.entries({
            autoQualityDeviceClass: policy.autoQualityDeviceClass,
            expectedAutoQualityMetrics: policy.expectedAutoQualityMetrics,
            expectedDprCap: policy.dprCap,
            expectedGroundDecorationDensity: policy.groundDecorationDensity,
            expectedQualityTier: policy.tier,
            expectedShadowMapSize: policy.shadowMapSize,
            expectedShadows: policy.shadows,
            quality: policy.quality,
        })) {
            validateExactValue(
                errors,
                requested[field],
                expected,
                `${path} requested.${field}`,
            );
        }
        if (policy.expectedAutoQualityMetrics) {
            validateExactValue(
                errors,
                requested.autoQualityMetrics,
                policy.expectedAutoQualityMetrics,
                `${path} requested.autoQualityMetrics`,
            );
        }
        for (const [field, expected] of Object.entries({
            dprCap: policy.dprCap,
            groundDecorationDensity: policy.groundDecorationDensity,
            qualityTier: policy.tier,
            shadowMapSize: policy.shadowMapSize,
            shadowsEnabled: policy.shadows,
        })) {
            validateExactValue(
                errors,
                runtime[field],
                expected,
                `${path} runtime.${field}`,
            );
        }
    }

    if (scenario.baseName === 'game-fauna-heavy-day-interaction-desktop') {
        validateSpeciesCounts(
            errors,
            runtime.actorGroundingShadowSpeciesCounts,
            `${path} runtime.actorGroundingShadowSpeciesCounts`,
            fixedFaunaSpecies,
        );
    }

    if (
        scenario.baseName ===
        'game-garden-switch-high-fauna-single-context-desktop'
    ) {
        const arrivals = scenario.gardenSwitch?.arrivals;
        if (!Array.isArray(arrivals) || arrivals.length !== 7) {
            errors.push(
                `${path} gardenSwitch.arrivals must contain exactly 7 arrivals`,
            );
        } else {
            for (const [index, arrival] of arrivals.entries()) {
                const arrivalPath = `${path} gardenSwitch.arrivals[${index}]`;
                if (!isRecord(arrival)) {
                    errors.push(`${arrivalPath} is missing`);
                    continue;
                }
                const expectedArrivalIndex = index + 1;
                const expectedProfile = gardenSwitchArrivalProfiles[index];
                const expectedGardenId = gardenSwitchArrivalGardenIds[index];
                if (arrival.arrivalIndex !== expectedArrivalIndex) {
                    errors.push(
                        `${arrivalPath}.arrivalIndex must be ${expectedArrivalIndex}`,
                    );
                }
                if (arrival.profile !== expectedProfile) {
                    errors.push(
                        `${arrivalPath}.profile must be ${expectedProfile}`,
                    );
                }
                if (arrival.gardenId !== expectedGardenId) {
                    errors.push(
                        `${arrivalPath}.gardenId must be ${expectedGardenId}`,
                    );
                }
                validateGardenFixture(
                    errors,
                    arrival.fixture,
                    `${arrivalPath}.fixture`,
                    expectedProfile,
                );
                validateRendererResources(
                    errors,
                    arrival.resources,
                    `${arrivalPath}.resources`,
                );
                if (!isRecord(arrival.sample)) {
                    errors.push(`${arrivalPath}.sample is missing`);
                } else {
                    for (const field of [
                        'rendererShaders',
                        'rendererTextures',
                    ]) {
                        validatePositiveInteger(
                            errors,
                            arrival.sample[field],
                            `${arrivalPath}.sample.${field}`,
                        );
                    }
                }
                if (index === 0) {
                    if (arrival.timing?.initial !== true) {
                        errors.push(
                            `${arrivalPath}.timing.initial must be true`,
                        );
                    }
                } else {
                    for (const field of ['dispatched', 'hiddenObserved']) {
                        if (arrival.timing?.[field] !== true) {
                            errors.push(
                                `${arrivalPath}.timing.${field} must be true`,
                            );
                        }
                    }
                    for (const field of [
                        'displayedMs',
                        'settleTargetMs',
                        'settledMs',
                        'visibleMs',
                    ]) {
                        validatePositiveNumber(
                            errors,
                            arrival.timing?.[field],
                            `${arrivalPath}.timing.${field}`,
                        );
                    }
                }
            }
        }
        const lifetimeResources = scenario.gardenSwitch?.lifetimeResources;
        const lifetimePath = `${path} gardenSwitch.lifetimeResources`;
        if (!isRecord(lifetimeResources)) {
            errors.push(`${lifetimePath} is missing`);
        } else {
            validateExactValue(
                errors,
                lifetimeResources.measurementMode,
                gardenSwitchLifetimeResourceMeasurementMode,
                `${lifetimePath}.measurementMode`,
            );
            for (const field of rendererResourceFields) {
                validatePositiveInteger(
                    errors,
                    lifetimeResources[field],
                    `${lifetimePath}.${field}`,
                );
            }
            const geometryArrivalValues = Array.isArray(arrivals)
                ? arrivals.map(
                      (arrival) => arrival?.resources?.rendererGeometries,
                  )
                : [];
            if (
                geometryArrivalValues.every(Number.isInteger) &&
                geometryArrivalValues.length > 0 &&
                lifetimeResources.rendererGeometries !==
                    Math.max(...geometryArrivalValues)
            ) {
                errors.push(
                    `${lifetimePath}.rendererGeometries must equal the maximum arrival snapshot`,
                );
            }
            for (const field of ['rendererShaders', 'rendererTextures']) {
                const arrivalValues = Array.isArray(arrivals)
                    ? arrivals.map((arrival) => arrival?.sample?.[field])
                    : [];
                if (
                    arrivalValues.every(Number.isInteger) &&
                    arrivalValues.length > 0 &&
                    Number.isInteger(lifetimeResources[field]) &&
                    lifetimeResources[field] < Math.max(...arrivalValues)
                ) {
                    errors.push(
                        `${lifetimePath}.${field} must cover every instrumented arrival sample`,
                    );
                }
            }
        }
    }

    if (scenario.baseName === 'game-high-target-runtime-lifecycle-desktop') {
        const lifecycleRendererStatsMode =
            schedulerBaselineContract ===
            legacyHeartbeatSchedulerBaselineContract
                ? lifecycleRendererStatsLegacyMode
                : lifecycleRendererStatsCanonicalMode;
        validatePositiveNumber(
            errors,
            runtime.browserDpr,
            `${path} runtime.browserDpr`,
        );
        validateLifecycleRuntimeFrameLoop(
            errors,
            scenario.lifecycle?.active?.runtimeFrameLoop,
            `${path} lifecycle.active.runtimeFrameLoop`,
            lifecycleRendererStatsMode,
        );
        const lifecycleResourceFixtures = [
            ['cold', scenario.lifecycle?.cold?.fixture],
            [
                'offscreen-resumed',
                scenario.lifecycle?.offscreen?.resumedControl?.fixture,
            ],
            [
                'hidden-resumed',
                scenario.lifecycle?.hidden?.resumedControl?.fixture,
            ],
            [
                'context-restored',
                scenario.lifecycle?.context?.restoredControl?.fixture,
            ],
        ];
        for (const [phaseName, fixture] of lifecycleResourceFixtures) {
            const fixturePath = `${path} lifecycle.${phaseName}.fixture`;
            if (!isRecord(fixture)) {
                errors.push(`${fixturePath} is missing`);
                continue;
            }
            if (fixture.gardenId !== runtime.profileGardenId) {
                errors.push(
                    `${fixturePath}.gardenId must match runtime.profileGardenId`,
                );
            }
            validateGardenFixture(
                errors,
                fixture.fixture,
                `${fixturePath}.fixture`,
                'high-target',
            );
            validateRendererResources(
                errors,
                fixture.resources,
                `${fixturePath}.resources`,
            );
            validateLifecycleRendererStatsMeasurement(
                errors,
                fixture.resources,
                `${fixturePath}.resources`,
                lifecycleRendererStatsMode,
            );
        }

        const offscreenResources = lifecycleResourceFixtures[1][1]?.resources;
        const hiddenResources = lifecycleResourceFixtures[2][1]?.resources;
        if (isRecord(offscreenResources) && isRecord(hiddenResources)) {
            for (const field of rendererResourceFields) {
                validateExactValue(
                    errors,
                    hiddenResources[field],
                    offscreenResources[field],
                    `${path} lifecycle mature ${field}`,
                );
            }
        }
    }
}

function round(value, digits = 4) {
    if (!isFiniteNumber(value)) {
        return value;
    }
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
    const finite = values
        .filter(isFiniteNumber)
        .sort((left, right) => left - right);
    if (finite.length === 0) {
        return null;
    }
    const middle = Math.floor(finite.length / 2);
    return finite.length % 2 === 0
        ? (finite[middle - 1] + finite[middle]) / 2
        : finite[middle];
}

function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (!isRecord(value)) {
        return value;
    }
    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, canonicalize(value[key])]),
    );
}

function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
}

function pick(record, fields) {
    return Object.fromEntries(
        fields.map((field) => [field, record?.[field] ?? null]),
    );
}

function scenarioBaseName(scenario) {
    return scenario.baseName;
}

function scenarioRun(scenario) {
    return scenario.profileRun;
}

function scenarioKey(scenario) {
    return `${scenarioBaseName(scenario)}::${scenarioRun(scenario)}`;
}

function pushMismatch(errors, path, baselineValue, candidateValue) {
    if (canonicalJson(baselineValue) !== canonicalJson(candidateValue)) {
        errors.push(
            `${path} differs: baseline=${canonicalJson(baselineValue)}, candidate=${canonicalJson(candidateValue)}`,
        );
    }
}

function requestedCompatibilitySignature(requested, schemaVersion) {
    if (!isRecord(requested)) {
        return requested;
    }
    const defaults =
        requestedCompatibilityDefaultsBySchemaVersion.get(schemaVersion);
    return defaults ? { ...defaults, ...requested } : requested;
}

function validateReport(
    report,
    label,
    {
        allowPartial = false,
        schedulerBaselineContract = canonicalSchedulerBaselineContract,
    } = {},
) {
    const errors = [];
    if (!isRecord(report)) {
        return [`${label} report is not an object`];
    }
    if (!schedulerBaselineContracts.has(schedulerBaselineContract)) {
        errors.push(
            `${label} scheduler baseline contract is unsupported: ${String(schedulerBaselineContract)}`,
        );
    }
    if (
        schedulerBaselineContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        allowPartial
    ) {
        errors.push(
            `${label} legacy heartbeat scheduler evidence requires the complete canonical manifest`,
        );
    }
    if (report.schemaVersion !== profileSchemaVersion) {
        errors.push(
            `${label}.schemaVersion must be ${profileSchemaVersion}; received ${String(report.schemaVersion)}`,
        );
    }
    if (report.comparisonContractVersion !== comparisonContractVersion) {
        errors.push(
            `${label}.comparisonContractVersion must be ${comparisonContractVersion}; received ${String(report.comparisonContractVersion)}`,
        );
    }
    if (!Array.isArray(report.scenarios) || report.scenarios.length === 0) {
        errors.push(`${label}.scenarios must be a non-empty array`);
    }

    const options = report.options;
    if (!isRecord(options)) {
        errors.push(`${label}.options is missing`);
    } else {
        for (const field of reportOptionFields) {
            if (!hasOwn(options, field)) {
                errors.push(`${label}.options.${field} is missing`);
            }
        }
        for (const field of [
            'allowLegacyOperationVisuals',
            'build',
            'legacyOutlinePipeline',
            'managedServer',
            'screenshots',
        ]) {
            if (typeof options[field] !== 'boolean') {
                errors.push(`${label}.options.${field} must be a boolean`);
            }
        }
        if (
            typeof options.legacyOutlinePipeline === 'boolean' &&
            options.legacyOutlinePipeline !==
                (schedulerBaselineContract ===
                    legacyHeartbeatSchedulerBaselineContract)
        ) {
            errors.push(
                `${label}.options.legacyOutlinePipeline must be ${schedulerBaselineContract === legacyHeartbeatSchedulerBaselineContract} for scheduler contract ${schedulerBaselineContract}`,
            );
        }
        if (
            options.closeupRepeat !== null &&
            (!Number.isInteger(options.closeupRepeat) ||
                options.closeupRepeat < 1)
        ) {
            errors.push(
                `${label}.options.closeupRepeat must be null or a positive integer`,
            );
        }
        validatePositiveNumber(
            errors,
            options.closeupTimeoutMs,
            `${label}.options.closeupTimeoutMs`,
        );
        validatePositiveNumber(
            errors,
            options.sampleMs,
            `${label}.options.sampleMs`,
        );
        validateNonNegativeNumber(
            errors,
            options.soakMs,
            `${label}.options.soakMs`,
        );
        validatePositiveNumber(
            errors,
            options.warmupMs,
            `${label}.options.warmupMs`,
        );
        if (!isNonEmptyString(options.graphicsBackend)) {
            errors.push(`${label}.options.graphicsBackend is missing`);
        }
        if (!isNonEmptyString(options.scenarioSet)) {
            errors.push(`${label}.options.scenarioSet is missing`);
        }
        if (!Array.isArray(options.scenarios)) {
            errors.push(`${label}.options.scenarios must be an array`);
        }
        if (!allowPartial && options.scenarioSet !== regressionScenarioSet) {
            errors.push(
                `${label}.options.scenarioSet must be ${regressionScenarioSet}; use --allow-partial only for diagnostics`,
            );
        }
        if (!allowPartial && options.scenarios?.length !== 0) {
            errors.push(
                `${label}.options.scenarios must be empty for a canonical regression bundle`,
            );
        }
    }

    const provenance = report.provenance;
    if (!isRecord(provenance)) {
        errors.push(`${label}.provenance is missing`);
        return errors;
    }
    if (provenance.comparable !== true) {
        const reasons = Array.isArray(provenance.reasons)
            ? provenance.reasons.join('; ')
            : 'no provenance reason supplied';
        errors.push(`${label}.provenance.comparable is not true: ${reasons}`);
    }
    if (!Array.isArray(provenance.reasons)) {
        errors.push(`${label}.provenance.reasons must be an array`);
    } else if (provenance.reasons.length > 0) {
        errors.push(`${label}.provenance.reasons must be empty`);
    }

    const subject = provenance.subject;
    if (!isRecord(subject)) {
        errors.push(`${label}.provenance.subject is missing`);
    } else {
        if (!commitPattern.test(subject.commit ?? '')) {
            errors.push(
                `${label}.provenance.subject.commit is not a full Git commit`,
            );
        }
        if (subject.dirty !== false) {
            errors.push(`${label}.provenance.subject.dirty must be false`);
        }
        if (subject.source !== 'served-build-marker') {
            errors.push(
                `${label}.provenance.subject.source must be served-build-marker`,
            );
        }
        if (report.sourceCommit !== subject.commit) {
            errors.push(
                `${label}.sourceCommit must match provenance.subject.commit`,
            );
        }
    }

    const harness = provenance.harness;
    if (!isRecord(harness)) {
        errors.push(`${label}.provenance.harness is missing`);
    } else {
        if (!commitPattern.test(harness.commit ?? '')) {
            errors.push(
                `${label}.provenance.harness.commit is not a full Git commit`,
            );
        }
        if (harness.dirty !== false) {
            errors.push(`${label}.provenance.harness.dirty must be false`);
        }
    }
    if (
        schedulerBaselineContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        isRecord(subject) &&
        isRecord(harness) &&
        subject.commit === harness.commit
    ) {
        errors.push(
            `${label} legacy heartbeat scheduler subject must predate and differ from its profiler harness`,
        );
    }

    for (const field of ['platform', 'arch', 'nodeVersion', 'browserVersion']) {
        if (
            typeof provenance.runtime?.[field] !== 'string' ||
            provenance.runtime[field].length === 0
        ) {
            errors.push(`${label}.provenance.runtime.${field} is missing`);
        }
    }
    if (typeof provenance.server?.buildPerformed !== 'boolean') {
        errors.push(`${label}.provenance.server.buildPerformed is missing`);
    }
    if (!['managed', 'external'].includes(provenance.server?.mode)) {
        errors.push(`${label}.provenance.server.mode is invalid`);
    }
    if (
        provenance.server?.mode === 'managed' &&
        isRecord(subject) &&
        isRecord(harness) &&
        harness.commit !== subject.commit
    ) {
        errors.push(
            `${label}.provenance.harness.commit must match the served-build subject commit for a managed server`,
        );
    }

    const seen = new Set();
    const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
    for (const [scenarioIndex, scenario] of scenarios.entries()) {
        if (!isRecord(scenario)) {
            errors.push(
                `${label}.scenarios[${scenarioIndex}] must be an object`,
            );
            continue;
        }
        const key = scenarioKey(scenario);
        if (
            typeof scenarioBaseName(scenario) !== 'string' ||
            scenarioBaseName(scenario).length === 0 ||
            !Number.isInteger(scenarioRun(scenario)) ||
            scenarioRun(scenario) < 1
        ) {
            errors.push(`${label} has an invalid scenario identity: ${key}`);
        } else if (seen.has(key)) {
            errors.push(`${label} has duplicate scenario run ${key}`);
        }
        seen.add(key);
        for (const field of ['name', 'path', 'budgetName']) {
            if (!isNonEmptyString(scenario[field])) {
                errors.push(`${label} scenario ${key} ${field} is missing`);
            }
        }

        const requested = scenario.requested;
        if (!isRecord(requested)) {
            errors.push(`${label} scenario ${key} requested is missing`);
        } else {
            for (const field of commonRequestedStringFields) {
                if (!isNonEmptyString(requested[field])) {
                    errors.push(
                        `${label} scenario ${key} requested.${field} is missing`,
                    );
                }
            }
            validatePositiveNumber(
                errors,
                requested.dpr,
                `${label} scenario ${key} requested.dpr`,
            );
            if (typeof requested.isMobile !== 'boolean') {
                errors.push(
                    `${label} scenario ${key} requested.isMobile must be a boolean`,
                );
            }
            validatePositiveNumber(
                errors,
                requested.viewport?.width,
                `${label} scenario ${key} requested.viewport.width`,
            );
            validatePositiveNumber(
                errors,
                requested.viewport?.height,
                `${label} scenario ${key} requested.viewport.height`,
            );
            if (
                typeof scenario.baseName === 'string' &&
                scenario.baseName.startsWith('game-cross-tier-') &&
                requested.crossTierProfile !== true
            ) {
                errors.push(
                    `${label} scenario ${key} must identify a cross-tier profile`,
                );
            }
            if (
                scenario.baseName ===
                    'game-fauna-heavy-day-interaction-desktop' &&
                (requested.faunaProfile !== true ||
                    requested.gardenProfile !== 'fauna-heavy')
            ) {
                errors.push(
                    `${label} scenario ${key} must identify the fauna fixture`,
                );
            }
            if (
                scenario.baseName ===
                    'game-garden-switch-high-fauna-single-context-desktop' &&
                requested.gardenSwitchProfile !== true
            ) {
                errors.push(
                    `${label} scenario ${key} must identify the garden-switch fixture`,
                );
            }
            if (
                scenario.baseName ===
                    'game-high-target-runtime-lifecycle-desktop' &&
                requested.lifecycleProfile !== true
            ) {
                errors.push(
                    `${label} scenario ${key} must identify the lifecycle fixture`,
                );
            }
            if (
                legacyContinuousRenderLeaseCompatibilityScenarioBaseNames.has(
                    scenario.baseName,
                )
            ) {
                if (
                    schedulerBaselineContract ===
                    legacyHeartbeatSchedulerBaselineContract
                ) {
                    if (requested.continuousRenderLeases != null) {
                        errors.push(
                            `${label} scenario ${key} legacy heartbeat requested.continuousRenderLeases must be omitted or null`,
                        );
                    }
                } else if (requested.continuousRenderLeases !== '1') {
                    errors.push(
                        `${label} scenario ${key} canonical requested.continuousRenderLeases must be "1"`,
                    );
                }
            }
        }

        const runtime = scenario.runtime;
        if (!isRecord(runtime)) {
            errors.push(`${label} scenario ${key} runtime is missing`);
        } else {
            if (!Number.isInteger(runtime.profileGardenId)) {
                errors.push(
                    `${label} scenario ${key} runtime.profileGardenId must be an integer`,
                );
            }
            if (!isNonEmptyString(runtime.qualityTier)) {
                errors.push(
                    `${label} scenario ${key} runtime.qualityTier is missing`,
                );
            }
            if (typeof runtime.staticOpaqueSceneCacheEnabled !== 'boolean') {
                errors.push(
                    `${label} scenario ${key} runtime.staticOpaqueSceneCacheEnabled must be a boolean`,
                );
            }
            validateRendererResources(
                errors,
                runtime,
                `${label} scenario ${key} runtime`,
            );
            const usesProfileFixture =
                requested?.crossTierProfile === true ||
                requested?.faunaProfile === true;
            validateStructuralCounts(
                errors,
                runtime,
                `${label} scenario ${key} runtime`,
                usesProfileFixture ? 'profileGarden' : '',
            );
            if (requested?.gardenProfile !== 'fauna-heavy') {
                validateGeneratedPlantCounts(
                    errors,
                    runtime,
                    `${label} scenario ${key} runtime`,
                );
            }
            if (requested?.gardenSwitchProfile !== true) {
                validatePositiveNumber(
                    errors,
                    runtime.dprCap,
                    `${label} scenario ${key} runtime.dprCap`,
                );
                validateNonNegativeNumber(
                    errors,
                    runtime.shadowMapSize,
                    `${label} scenario ${key} runtime.shadowMapSize`,
                );
                if (typeof runtime.shadowsEnabled !== 'boolean') {
                    errors.push(
                        `${label} scenario ${key} runtime.shadowsEnabled must be a boolean`,
                    );
                }
            }
        }
        validateRetainedHeapEvidence(
            errors,
            scenario.memory,
            `${label} scenario ${key} memory`,
        );
        if (!allowPartial) {
            validateCanonicalScenarioEvidence(errors, scenario, label, key, {
                schedulerBaselineContract,
            });
            if (scenario.baseName?.startsWith('game-cross-tier-')) {
                validateCrossTierCheckNameInventories(
                    errors,
                    scenario,
                    `${label} scenario ${key}`,
                    {
                        legacyOutlinePipeline:
                            options?.legacyOutlinePipeline === true,
                    },
                );
            }
        }
        const isLegacyCrossTierScenario =
            schedulerBaselineContract ===
                legacyHeartbeatSchedulerBaselineContract &&
            scenario.baseName?.startsWith('game-cross-tier-');
        if (isLegacyCrossTierScenario) {
            const expectedFailureNames = legacyHeartbeatExpectedFailureNames(
                scenario.sample,
                report.comparisonContractVersion,
            );
            validateLegacyHeartbeatCheckOutcome(
                errors,
                scenario.acceptance,
                `${label} scenario ${key} acceptance`,
                expectedFailureNames,
            );
            validateLegacyHeartbeatCheckOutcome(
                errors,
                scenario.budget,
                `${label} scenario ${key} budget`,
                expectedFailureNames,
            );
        } else {
            if (scenario.acceptance?.pass !== true) {
                errors.push(
                    `${label} scenario ${key} acceptance.pass is not true`,
                );
            }
            validatePassingChecks(
                errors,
                scenario.budget,
                `${label} scenario ${key} budget`,
            );
        }
        validatePassingChecks(
            errors,
            scenario.performanceBudget,
            `${label} scenario ${key} performanceBudget`,
        );
        for (const field of ['renderer', 'userAgent', 'vendor']) {
            if (
                typeof scenario.environment?.[field] !== 'string' ||
                scenario.environment[field].length === 0
            ) {
                errors.push(
                    `${label} scenario ${key} environment.${field} is missing`,
                );
            }
        }
        const marker = scenario.servedBuildProvenance;
        if (!isRecord(marker)) {
            errors.push(
                `${label} scenario ${key} served-build provenance is missing`,
            );
        } else {
            if (marker.commit !== subject?.commit) {
                errors.push(
                    `${label} scenario ${key} served-build commit must match the report subject`,
                );
            }
            if (marker.dirty !== false) {
                errors.push(
                    `${label} scenario ${key} served-build dirty state must be false`,
                );
            }
            if (
                marker.comparisonContractVersion !== comparisonContractVersion
            ) {
                errors.push(
                    `${label} scenario ${key} served-build comparison contract must be ${comparisonContractVersion}`,
                );
            }
        }
    }
    if (!allowPartial) {
        const actualKeys = [...seen].sort();
        const expectedKeys = [...regressionScenarioRunKeys].sort();
        const actual = new Set(actualKeys);
        const expected = new Set(expectedKeys);
        const missing = expectedKeys.filter((key) => !actual.has(key));
        const extra = actualKeys.filter((key) => !expected.has(key));
        if (missing.length > 0 || extra.length > 0) {
            errors.push(
                `${label} regression scenario manifest differs: missing=${canonicalJson(missing)}, extra=${canonicalJson(extra)}`,
            );
        }
    }
    return errors;
}

function runtimeCompatibilitySignature(scenario) {
    return pick(scenario.runtime, runtimePolicyFields);
}

function structuralFixture(fixture) {
    const structural = pick(fixture, [
        'blockCount',
        'generatedPlantExpectedInstanceCount',
        'generatedPlantFieldCount',
        'generatedPlantInstanceCount',
        'generatedPlantVisibleFieldCount',
        'generatedPlantVisibleInstanceCount',
        'raisedBedCount',
        'stackCount',
    ]);
    const fixedSpeciesCounts = pickFixedFaunaSpeciesCounts(
        fixture?.speciesCounts ?? fixture?.actorGroundingShadowSpeciesCounts,
    );
    return fixedSpeciesCounts
        ? { ...structural, fixedSpeciesCounts }
        : structural;
}

function pickFixedFaunaSpeciesCounts(speciesCounts) {
    if (!isRecord(speciesCounts)) {
        return null;
    }
    const fixed = Object.fromEntries(
        fixedFaunaSpecies
            .filter((species) => species in speciesCounts)
            .map((species) => [species, speciesCounts[species]]),
    );
    return Object.keys(fixed).length > 0 ? fixed : null;
}

function scenarioFixtureSignature(scenario) {
    const signature = {
        runtime: pick(scenario.runtime, runtimeFixtureFields),
    };
    const fixedSpeciesCounts = pickFixedFaunaSpeciesCounts(
        scenario.runtime?.speciesCounts ??
            scenario.runtime?.actorGroundingShadowSpeciesCounts,
    );
    if (fixedSpeciesCounts) {
        signature.runtime.fixedSpeciesCounts = fixedSpeciesCounts;
    }
    if (scenario.requested?.lifecycleProfile === true) {
        signature.lifecycle = {
            cold: {
                fixture: structuralFixture(
                    scenario.lifecycle?.cold?.fixture?.fixture,
                ),
                gardenId: scenario.lifecycle?.cold?.fixture?.gardenId ?? null,
            },
            restored: {
                fixture: structuralFixture(
                    scenario.lifecycle?.context?.restoredControl?.fixture
                        ?.fixture,
                ),
                gardenId:
                    scenario.lifecycle?.context?.restoredControl?.fixture
                        ?.gardenId ?? null,
            },
        };
    }
    if (scenario.requested?.gardenSwitchProfile === true) {
        signature.gardenSwitch = (scenario.gardenSwitch?.arrivals ?? []).map(
            (arrival) => ({
                arrivalIndex: arrival.arrivalIndex,
                fixture: structuralFixture(arrival.fixture),
                gardenId: arrival.gardenId,
                profile: arrival.profile,
            }),
        );
    }
    return signature;
}

function gpuState(sample) {
    const gpu = sample?.gpu;
    const elapsedMs = sample?.elapsedMs;
    const elapsedMaxMs = gpu?.elapsedMaxMs;
    const elapsedP95Ms = gpu?.elapsedP95Ms;
    const elapsedTotalMs = gpu?.elapsedTotalMs;
    const renderedFrames = sample?.renderedFrames;
    const sampleCount = gpu?.sampleCount;
    const available =
        gpu?.supported === true &&
        gpu?.valid === true &&
        gpu?.complete === true &&
        gpu?.disjoint === false &&
        gpu.reason === null &&
        Number.isInteger(renderedFrames) &&
        renderedFrames > 0 &&
        Number.isInteger(sampleCount) &&
        sampleCount === renderedFrames &&
        isFiniteNumber(elapsedMs) &&
        elapsedMs > 0 &&
        isFiniteNumber(elapsedP95Ms) &&
        elapsedP95Ms > 0 &&
        isFiniteNumber(elapsedMaxMs) &&
        elapsedMaxMs >= elapsedP95Ms &&
        isFiniteNumber(elapsedTotalMs) &&
        elapsedTotalMs >= elapsedMaxMs;
    if (available) {
        return {
            available: true,
            elapsedMeanMs: elapsedTotalMs / sampleCount,
            elapsedOccupancyPercent: (elapsedTotalMs / elapsedMs) * 100,
            value: elapsedP95Ms,
        };
    }
    return {
        available: false,
        invalidAvailableValue:
            gpu?.supported === true && gpu?.valid === true && !available,
        reason:
            typeof gpu?.reason === 'string' && gpu.reason.length > 0
                ? gpu.reason
                : null,
    };
}

function gpuElapsedWindowOccupancyState(sample) {
    const state = gpuState(sample);
    return {
        valid: state.available === true,
        value: state.available === true ? state.elapsedOccupancyPercent : null,
    };
}

function gpuElapsedWorkflowOccupancyState(scenario) {
    const arrivals = scenario?.gardenSwitch?.arrivals;
    if (!Array.isArray(arrivals) || arrivals.length === 0) {
        return { available: false, invalid: true, value: null };
    }

    const gpuStates = arrivals.map((arrival) => gpuState(arrival?.sample));
    const availableCount = gpuStates.filter((state) => state.available).length;
    if (availableCount === 0) {
        return {
            available: false,
            invalid: gpuStates.some((state) => state.invalidAvailableValue),
            value: null,
        };
    }
    if (availableCount !== arrivals.length) {
        return { available: true, invalid: true, value: null };
    }

    let elapsedMs = 0;
    let elapsedTotalMs = 0;
    for (const arrival of arrivals) {
        const occupancy = gpuElapsedWindowOccupancyState(arrival?.sample);
        if (!occupancy.valid) {
            return { available: true, invalid: true, value: null };
        }
        elapsedMs += arrival.sample.elapsedMs;
        elapsedTotalMs += arrival.sample.gpu.elapsedTotalMs;
    }
    return {
        available: true,
        invalid: false,
        value: (elapsedTotalMs / elapsedMs) * 100,
    };
}

function samplePhases(scenario) {
    if (scenario.requested?.lifecycleProfile === true) {
        return [
            {
                cdp: scenario.lifecycle?.active?.cdp ?? scenario.cdp,
                name: 'active',
                sample: scenario.lifecycle?.active?.sample ?? scenario.sample,
            },
            {
                cdp: scenario.lifecycle?.context?.restoredWindow?.cdp,
                name: 'context-restored',
                sample: scenario.lifecycle?.context?.restoredWindow?.sample,
            },
        ];
    }
    if (scenario.requested?.gardenSwitchProfile === true) {
        return (scenario.gardenSwitch?.arrivals ?? []).map((arrival) => ({
            cdp: null,
            name: `arrival-${arrival.arrivalIndex}-${arrival.profile}`,
            resources: arrival.resources,
            sample: arrival.sample,
        }));
    }
    return [
        {
            cdp: scenario.cdp,
            name: 'sample',
            resources: scenario.runtime,
            sample: scenario.sample,
        },
    ];
}

function lifecycleResourcePhases(scenario) {
    const witnesses = [
        {
            diagnosticOnly: true,
            gatedBy: lifecycleResourceDiagnosticGate,
            name: 'cold',
            resources: scenario.lifecycle?.cold?.fixture?.resources,
        },
        {
            diagnosticOnly: false,
            name: 'offscreen-resumed',
            resources:
                scenario.lifecycle?.offscreen?.resumedControl?.fixture
                    ?.resources,
        },
        {
            diagnosticOnly: false,
            name: 'hidden-resumed',
            resources:
                scenario.lifecycle?.hidden?.resumedControl?.fixture?.resources,
        },
        {
            diagnosticOnly: true,
            gatedBy: lifecycleResourceDiagnosticGate,
            name: 'context-restored',
            resources:
                scenario.lifecycle?.context?.restoredControl?.fixture
                    ?.resources,
        },
    ];
    const resources = Object.fromEntries(
        rendererResourceFields.map((field) => {
            const values = witnesses.map((witness) =>
                isFiniteNumber(witness.resources?.[field])
                    ? witness.resources[field]
                    : null,
            );
            return [
                field,
                values.every(isFiniteNumber) ? Math.max(...values) : null,
            ];
        }),
    );
    return [
        ...witnesses,
        {
            diagnosticOnly: false,
            name: 'lifecycle-peak',
            resources,
        },
    ];
}

function gardenSwitchResourcePhases(scenario) {
    const arrivals = scenario.gardenSwitch?.arrivals ?? [];
    return [
        ...arrivals.map((arrival, index) => ({
            diagnosticOnly: index < 3,
            gatedBy: index < 3 ? gardenSwitchResourceDiagnosticGate : null,
            name: `arrival-${arrival.arrivalIndex}-${arrival.profile}`,
            resources: arrival.resources,
        })),
        {
            diagnosticOnly: false,
            gatedBy: null,
            name: 'switch-lifetime-peak',
            resources: scenario.gardenSwitch?.lifetimeResources,
        },
    ];
}

function resourcePhases(scenario) {
    if (scenario.requested?.lifecycleProfile === true) {
        return lifecycleResourcePhases(scenario);
    }
    if (scenario.requested?.gardenSwitchProfile === true) {
        return gardenSwitchResourcePhases(scenario);
    }
    return samplePhases(scenario).map((phase) => ({
        diagnosticOnly: false,
        gatedBy: null,
        name: phase.name,
        resources: phase.resources,
    }));
}

function timingPhases(scenario) {
    if (scenario.requested?.lifecycleProfile === true) {
        const cold = scenario.lifecycle?.cold;
        return [
            {
                metrics: {
                    'cold.canvas_attached_ms': cold?.canvasAttachedMs,
                    'cold.canvas_sized_ms': cold?.canvasSizedMs,
                    'cold.dom_content_loaded_ms': cold?.domContentLoadedMs,
                    'cold.first_submitted_frame_ms':
                        cold?.firstSubmittedFrameMs,
                    'cold.fixture_ready_ms': cold?.fixtureReadyMs,
                    'cold.interaction_ready_ms': cold?.interactionReadyMs,
                },
                name: 'cold',
            },
        ];
    }

    const phases = [
        {
            metrics: {
                'cold.canvas_ready_ms': scenario.canvasReadyMs,
                'cold.dom_content_loaded_ms': scenario.domContentLoadedMs,
            },
            name: 'cold',
        },
    ];
    if (scenario.requested?.gardenSwitchProfile === true) {
        for (const arrival of scenario.gardenSwitch?.arrivals ?? []) {
            if (arrival.timing?.initial === true) {
                continue;
            }
            phases.push({
                metrics: {
                    'switch.displayed_ms': arrival.timing?.displayedMs,
                    'switch.settled_ms': arrival.timing?.settledMs,
                    'switch.visible_ms': arrival.timing?.visibleMs,
                },
                name: `arrival-${arrival.arrivalIndex}-${arrival.profile}`,
            });
        }
    }
    return phases;
}

function compareScenarioCompatibility(
    baseline,
    candidate,
    {
        baselineSchedulerContract,
        baselineSchemaVersion,
        candidateSchedulerContract,
        candidateSchemaVersion,
    },
) {
    const errors = [];
    let baselineRequested = requestedCompatibilitySignature(
        baseline.requested,
        baselineSchemaVersion,
    );
    const candidateRequested = requestedCompatibilitySignature(
        candidate.requested,
        candidateSchemaVersion,
    );
    const comparesLegacyBaselineToCanonicalCandidate =
        baselineSchedulerContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        candidateSchedulerContract === canonicalSchedulerBaselineContract;
    if (
        comparesLegacyBaselineToCanonicalCandidate &&
        isRecord(baselineRequested)
    ) {
        baselineRequested = {
            ...baselineRequested,
            legacyOutlinePipeline: false,
        };
    }
    if (
        comparesLegacyBaselineToCanonicalCandidate &&
        legacyContinuousRenderLeaseCompatibilityScenarioBaseNames.has(
            baseline.baseName,
        ) &&
        isRecord(baselineRequested)
    ) {
        baselineRequested = {
            ...baselineRequested,
            continuousRenderLeases: '1',
        };
    }
    pushMismatch(errors, 'scenario.name', baseline.name, candidate.name);
    pushMismatch(errors, 'scenario.path', baseline.path, candidate.path);
    pushMismatch(
        errors,
        'scenario.budgetName',
        baseline.budgetName,
        candidate.budgetName,
    );
    pushMismatch(
        errors,
        'scenario.requested',
        baselineRequested,
        candidateRequested,
    );
    pushMismatch(
        errors,
        'scenario.runtime policy',
        runtimeCompatibilitySignature(baseline),
        runtimeCompatibilitySignature(candidate),
    );
    pushMismatch(
        errors,
        'scenario.fixture',
        scenarioFixtureSignature(baseline),
        scenarioFixtureSignature(candidate),
    );
    pushMismatch(
        errors,
        'scenario.environment',
        pick(baseline.environment, ['renderer', 'userAgent', 'vendor']),
        pick(candidate.environment, ['renderer', 'userAgent', 'vendor']),
    );
    pushMismatch(
        errors,
        'scenario.sample phases',
        samplePhases(baseline).map((phase) => phase.name),
        samplePhases(candidate).map((phase) => phase.name),
    );
    pushMismatch(
        errors,
        'scenario.timing phases',
        timingPhases(baseline).map((phase) => phase.name),
        timingPhases(candidate).map((phase) => phase.name),
    );
    return errors;
}

function ratio(candidate, baseline) {
    if (baseline === 0) {
        return candidate === 0 ? 1 : Number.POSITIVE_INFINITY;
    }
    return candidate / baseline;
}

function ratioPass(value, direction, limit) {
    return direction === 'minimum' ? value >= limit : value <= limit;
}

function practicalPass({
    absoluteTolerance = 0,
    baseline,
    candidate,
    direction,
    limit,
}) {
    const valueRatio = ratio(candidate, baseline);
    const worsening =
        direction === 'minimum' ? baseline - candidate : candidate - baseline;
    const relativePass = ratioPass(valueRatio, direction, limit);
    const absolutePass =
        absoluteTolerance === 0
            ? worsening <= 0
            : worsening < absoluteTolerance;
    return {
        absolutePass,
        pass: relativePass || absolutePass,
        ratio: valueRatio,
        relativePass,
        worsening,
    };
}

function rankIndependentRuns(rows) {
    // The bundles are captured sequentially, so run N is not an experimental
    // pair with run N. Rank matching keeps every raw value visible without
    // making the result depend on arbitrary repeat ordering.
    const baseline = [...rows].sort(
        (left, right) => left.baseline - right.baseline,
    );
    const candidate = [...rows].sort(
        (left, right) => left.candidate - right.candidate,
    );
    return baseline.map((baselineRow, index) => ({
        baseline: baselineRow.baseline,
        baselineProfileRun: baselineRow.profileRun,
        candidate: candidate[index].candidate,
        candidateProfileRun: candidate[index].profileRun,
        sampleRank: index + 1,
    }));
}

function buildRatioComparison({
    direction,
    id,
    label,
    medianAbsoluteTolerance = 0,
    medianLimit,
    rows,
    runAbsoluteTolerance = 0,
    runLimit,
    unit,
}) {
    const individualWithRawRatio = rankIndependentRuns(rows).map((row) => {
        const result = practicalPass({
            absoluteTolerance: runAbsoluteTolerance,
            baseline: row.baseline,
            candidate: row.candidate,
            direction,
            limit: runLimit,
        });
        return {
            ...row,
            pass: result.pass,
            rawRatio: result.ratio,
            ratio: round(result.ratio),
            worsening: round(result.worsening),
        };
    });
    const individual = individualWithRawRatio.map(
        ({ rawRatio: _, ...run }) => run,
    );
    const baselineMedian = median(rows.map((row) => row.baseline));
    const candidateMedian = median(rows.map((row) => row.candidate));
    const medianResult = practicalPass({
        absoluteTolerance: medianAbsoluteTolerance,
        baseline: baselineMedian,
        candidate: candidateMedian,
        direction,
        limit: medianLimit,
    });
    return {
        baselineMedian: round(baselineMedian),
        candidateMedian: round(candidateMedian),
        direction,
        id,
        individual,
        kind: 'ratio',
        label,
        medianAbsoluteTolerance,
        medianAbsolutePass: medianResult.absolutePass,
        medianLimit,
        medianPass: medianResult.pass,
        medianRatio: round(medianResult.ratio),
        medianRelativePass: medianResult.relativePass,
        medianWorsening: round(medianResult.worsening),
        pass: medianResult.pass,
        rawRanksDiagnosticOnly: true,
        regressionBreach:
            !medianResult.relativePass && !medianResult.absolutePass,
        runAbsoluteTolerance,
        runLimit,
        screeningBreach: !medianResult.relativePass,
        unit,
    };
}

function buildTargetAwareRenderedFpsComparison({
    maximumRenderedFps = null,
    minimumRenderedFps,
    rows,
    targetFramesPerSecond,
    targetToleranceFramesPerSecond,
    ...metric
}) {
    const baselineRelative = buildRatioComparison({ ...metric, rows });
    const individual = baselineRelative.individual.map((run) => {
        const candidateFloorPass = run.candidate >= minimumRenderedFps;
        const candidateCeilingPass =
            maximumRenderedFps === null || run.candidate <= maximumRenderedFps;
        return {
            ...run,
            baselineRelativePass: run.pass,
            baselineRelativeRatio: run.ratio,
            baselineRelativeWorsening: run.worsening,
            candidateCeilingPass,
            candidateFloorPass,
            maximumRenderedFps,
            minimumRenderedFps,
            pass: candidateFloorPass && candidateCeilingPass,
            targetFramesPerSecond,
        };
    });
    const pass = individual.every((run) => run.pass);
    return {
        ...baselineRelative,
        baselineRelativeDiagnosticOnly: true,
        baselineRelativeRegressionBreach: baselineRelative.regressionBreach,
        baselineRelativeScreeningBreach: baselineRelative.screeningBreach,
        everyRawRunGate: true,
        individual,
        medianPass: pass,
        maximumRenderedFps,
        minimumRenderedFps,
        pass,
        rawRanksDiagnosticOnly: false,
        regressionBreach: !pass,
        screeningBreach: !pass,
        targetFramesPerSecond,
        targetToleranceFramesPerSecond,
        targetAwareRenderedFps: true,
    };
}

function buildTargetAwareMaximumComparison({
    maximumCandidateValue,
    rows,
    targetFramesPerSecond,
    ...metric
}) {
    const baselineRelative = buildRatioComparison({ ...metric, rows });
    const individual = baselineRelative.individual.map((run) => {
        const candidateMaximumPass = run.candidate <= maximumCandidateValue;
        return {
            ...run,
            baselineRelativePass: run.pass,
            baselineRelativeRatio: run.ratio,
            baselineRelativeWorsening: run.worsening,
            candidateMaximumPass,
            maximumCandidateValue,
            pass: candidateMaximumPass,
            targetFramesPerSecond,
        };
    });
    const pass = individual.every((run) => run.pass);
    return {
        ...baselineRelative,
        baselineRelativeDiagnosticOnly: true,
        baselineRelativeRegressionBreach: baselineRelative.regressionBreach,
        baselineRelativeScreeningBreach: baselineRelative.screeningBreach,
        everyRawRunGate: true,
        individual,
        maximumCandidateValue,
        medianPass: pass,
        pass,
        rawRanksDiagnosticOnly: false,
        regressionBreach: !pass,
        screeningBreach: !pass,
        targetFramesPerSecond,
        targetAwareMaximum: true,
    };
}

function buildGardenSwitchRenderedFpsComparison({ phase, rows, ...metric }) {
    return buildTargetAwareRenderedFpsComparison({
        ...metric,
        maximumRenderedFps: phase.startsWith('arrival-1-')
            ? gardenSwitchMaximumRenderedFps
            : null,
        minimumRenderedFps: gardenSwitchMinimumRenderedFps,
        rows,
        targetFramesPerSecond: gardenSwitchTargetFramesPerSecond,
        targetToleranceFramesPerSecond: gardenSwitchRenderedFpsTolerance,
    });
}

function buildCrossTierRenderedFpsComparison({ rows, ...metric }) {
    return buildTargetAwareRenderedFpsComparison({
        ...metric,
        maximumRenderedFps: crossTierMaximumRenderedFps,
        minimumRenderedFps: crossTierMinimumRenderedFps,
        rows,
        targetFramesPerSecond: crossTierTargetFramesPerSecond,
        targetToleranceFramesPerSecond: crossTierRenderedFpsTolerance,
    });
}

function buildLifecycleRenderedFpsComparison({ rows, ...metric }) {
    return buildTargetAwareRenderedFpsComparison({
        ...metric,
        maximumRenderedFps: lifecycleMaximumRenderedFps,
        minimumRenderedFps: lifecycleMinimumRenderedFps,
        rows,
        targetFramesPerSecond: lifecycleTargetFramesPerSecond,
        targetToleranceFramesPerSecond: lifecycleRenderedFpsTolerance,
    });
}

function buildLifecycleP95FrameComparison({ rows, ...metric }) {
    return buildTargetAwareMaximumComparison({
        ...metric,
        maximumCandidateValue: lifecycleMaximumP95FrameMs,
        rows,
        targetFramesPerSecond: lifecycleTargetFramesPerSecond,
    });
}

function buildRatioDiagnosticComparison({ gatedBy, rows, ...metric }) {
    const baselineRelative = buildRatioComparison({ ...metric, rows });
    return {
        ...baselineRelative,
        baselineRelativeDiagnosticOnly: true,
        baselineRelativeRegressionBreach: baselineRelative.regressionBreach,
        baselineRelativeScreeningBreach: baselineRelative.screeningBreach,
        diagnosticOnly: true,
        gatedBy,
        individual: baselineRelative.individual.map((run) => ({
            ...run,
            baselineRelativePass: run.pass,
            baselineRelativeRatio: run.ratio,
            baselineRelativeWorsening: run.worsening,
            pass: true,
        })),
        medianPass: true,
        pass: true,
        regressionBreach: false,
        screeningBreach: false,
    };
}

function buildCadenceConfoundedGpuComparison({ gatedBy, ...metric }) {
    const diagnostic = buildRatioDiagnosticComparison({
        ...metric,
        gatedBy,
    });
    return {
        ...diagnostic,
        rawThresholdObservation: {
            medianAbsolutePass: diagnostic.medianAbsolutePass,
            medianPass: diagnostic.baselineRelativeRegressionBreach !== true,
            medianRelativePass: diagnostic.medianRelativePass,
            regressionBreach: diagnostic.baselineRelativeRegressionBreach,
            screeningBreach: diagnostic.baselineRelativeScreeningBreach,
        },
    };
}

function validateGardenSwitchFrameContract(row, reportKind, errors) {
    const sample = row[reportKind]?.sample;
    const boundarySnapshots = [];
    for (const boundary of [
        'runtimeFrameLoopAtStart',
        'runtimeFrameLoopAtEnd',
    ]) {
        const snapshot = sample?.[boundary];
        const path = `${row.scenario} run ${row.profileRun} ${row.phase} ${reportKind}.sample.${boundary}`;
        if (!isRecord(snapshot)) {
            errors.push(`${path} is missing`);
            continue;
        }
        boundarySnapshots.push(snapshot);
        if (
            snapshot.targetFramesPerSecond !== gardenSwitchTargetFramesPerSecond
        ) {
            errors.push(
                `${path}.targetFramesPerSecond must be ${gardenSwitchTargetFramesPerSecond}; received ${canonicalJson(snapshot.targetFramesPerSecond)}`,
            );
        }
        if (snapshot.effectiveVisible !== true) {
            errors.push(`${path}.effectiveVisible must be true`);
        }
        if (snapshot.callbackPending !== true) {
            errors.push(`${path}.callbackPending must be true`);
        }
        if (snapshot.pendingCallbackKind !== 'timeout') {
            errors.push(`${path}.pendingCallbackKind must be "timeout"`);
        }
        if (
            !isFiniteNumber(snapshot.pendingCallbackDueAt) ||
            snapshot.pendingCallbackDueAt < 0
        ) {
            errors.push(
                `${path}.pendingCallbackDueAt must be a non-negative finite number`,
            );
        }
        if (typeof snapshot.awaitingFrameReceipt !== 'boolean') {
            errors.push(`${path}.awaitingFrameReceipt must be a boolean`);
        }
        if (
            !isFiniteNumber(snapshot.displayFrameIntervalMs) ||
            snapshot.displayFrameIntervalMs <= 0
        ) {
            errors.push(
                `${path}.displayFrameIntervalMs must be a positive finite number`,
            );
        }
        if (
            !Number.isInteger(snapshot.displayFrameCalibrationCount) ||
            snapshot.displayFrameCalibrationCount < 1
        ) {
            errors.push(
                `${path}.displayFrameCalibrationCount must be a positive integer`,
            );
        }
    }
    if (
        boundarySnapshots.length === 2 &&
        boundarySnapshots.every(
            (snapshot) =>
                Number.isInteger(snapshot.displayFrameCalibrationCount) &&
                snapshot.displayFrameCalibrationCount >= 1,
        ) &&
        boundarySnapshots[0].displayFrameCalibrationCount !==
            boundarySnapshots[1].displayFrameCalibrationCount
    ) {
        errors.push(
            `${row.scenario} run ${row.profileRun} ${row.phase} ${reportKind}.sample displayFrameCalibrationCount must remain stable across the sample window`,
        );
    }

    const path = `${row.scenario} run ${row.profileRun} ${row.phase} ${reportKind}.sample`;
    const renderedFrames = sample?.renderedFrames;
    const counterDeltas = sample?.runtimeFrameLoopCounterDeltas;
    if (!isRecord(counterDeltas)) {
        errors.push(`${path}.runtimeFrameLoopCounterDeltas is missing`);
        return;
    }
    const counterFields = [
        'scheduledCallbackCount',
        'wakeupCount',
        'productiveWakeupCount',
        'retainedTimeoutReconciliationWakeupCount',
        'pendingFrameReceiptReconciliationWakeupCount',
        'unexpectedNoWorkWakeupCount',
        'postCalibrationFrameWakeupCount',
        'ownedInvalidationCount',
        'cancelledCallbackCount',
        'r3fFrameCallbackCount',
        'fixedStepFailureCount',
        'invalidationFailureCount',
        'missedFrameReceiptCount',
    ];
    for (const field of counterFields) {
        const value = counterDeltas[field];
        if (!Number.isInteger(value) || value < 0) {
            errors.push(
                `${path}.runtimeFrameLoopCounterDeltas.${field} must be a non-negative integer`,
            );
        }
    }
    if (
        !Number.isInteger(renderedFrames) ||
        renderedFrames <= 0 ||
        renderedFrames !== counterDeltas.r3fFrameCallbackCount
    ) {
        errors.push(
            `${path}.renderedFrames must equal the positive runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount`,
        );
    }

    const startPending = sample?.runtimeFrameLoopAtStart?.callbackPending;
    const endPending = sample?.runtimeFrameLoopAtEnd?.callbackPending;
    if (
        counterFields.every((field) =>
            Number.isInteger(counterDeltas[field]),
        ) &&
        typeof startPending === 'boolean' &&
        typeof endPending === 'boolean'
    ) {
        const pendingCallbackDelta = Number(endPending) - Number(startPending);
        const observedCallbackDelta =
            counterDeltas.scheduledCallbackCount -
            counterDeltas.wakeupCount -
            counterDeltas.cancelledCallbackCount;
        if (observedCallbackDelta !== pendingCallbackDelta) {
            errors.push(
                `${path}.runtimeFrameLoopCounterDeltas callback conservation must equal the pending callback delta; received ${observedCallbackDelta}, expected ${pendingCallbackDelta}`,
            );
        }

        const classifiedWakeupCount =
            counterDeltas.productiveWakeupCount +
            counterDeltas.retainedTimeoutReconciliationWakeupCount +
            counterDeltas.pendingFrameReceiptReconciliationWakeupCount +
            counterDeltas.unexpectedNoWorkWakeupCount;
        if (counterDeltas.wakeupCount !== classifiedWakeupCount) {
            errors.push(
                `${path}.runtimeFrameLoopCounterDeltas wakeup classification conservation must equal wakeupCount; received ${classifiedWakeupCount} classified wakeups for ${counterDeltas.wakeupCount} handled wakeups`,
            );
        }
    }

    const awaitingFrameReceiptAtStart =
        sample?.runtimeFrameLoopAtStart?.awaitingFrameReceipt;
    if (
        Number.isInteger(
            counterDeltas.pendingFrameReceiptReconciliationWakeupCount,
        ) &&
        Number.isInteger(counterDeltas.ownedInvalidationCount) &&
        typeof awaitingFrameReceiptAtStart === 'boolean' &&
        counterDeltas.pendingFrameReceiptReconciliationWakeupCount >
            counterDeltas.ownedInvalidationCount +
                Number(awaitingFrameReceiptAtStart)
    ) {
        errors.push(
            `${path}.runtimeFrameLoopCounterDeltas.pendingFrameReceiptReconciliationWakeupCount must not exceed ownedInvalidationCount plus an awaiting receipt at sample start`,
        );
    }

    for (const field of [
        'fixedStepFailureCount',
        'invalidationFailureCount',
        'missedFrameReceiptCount',
        'postCalibrationFrameWakeupCount',
        'unexpectedNoWorkWakeupCount',
    ]) {
        if (counterDeltas[field] !== 0) {
            errors.push(
                `${path}.runtimeFrameLoopCounterDeltas.${field} must be 0; received ${canonicalJson(counterDeltas[field])}`,
            );
        }
    }
}

function validateLifecycleCandidateFrameContract(row, errors) {
    const sample = row.candidate?.sample;
    for (const boundary of [
        'runtimeFrameLoopAtStart',
        'runtimeFrameLoopAtEnd',
    ]) {
        const snapshot = sample?.[boundary];
        const path = `${row.scenario} run ${row.profileRun} ${row.phase} candidate.sample.${boundary}`;
        if (!isRecord(snapshot)) {
            errors.push(`${path} is missing`);
            continue;
        }
        if (snapshot.targetFramesPerSecond !== lifecycleTargetFramesPerSecond) {
            errors.push(
                `${path}.targetFramesPerSecond must be ${lifecycleTargetFramesPerSecond}; received ${canonicalJson(snapshot.targetFramesPerSecond)}`,
            );
        }
        if (snapshot.effectiveVisible !== true) {
            errors.push(`${path}.effectiveVisible must be true`);
        }
    }
}

function validateCrossTierCandidateFrameContract(row, errors) {
    const targetFields = [
        'runtimeFrameLoopTargetFramesPerSecondAtStart',
        'runtimeFrameLoopTargetFramesPerSecondMax',
        'runtimeFrameLoopTargetFramesPerSecondAtEnd',
    ];
    for (const reportKind of ['baseline', 'candidate']) {
        const phase = row[reportKind];
        const path = `${row.scenario} run ${row.profileRun} ${row.phase} ${reportKind}`;
        const runtimeTarget =
            phase?.resources?.runtimeFrameLoop?.targetFramesPerSecond;
        if (runtimeTarget !== crossTierTargetFramesPerSecond) {
            errors.push(
                `${path}.runtime.runtimeFrameLoop.targetFramesPerSecond must be ${crossTierTargetFramesPerSecond}; received ${canonicalJson(runtimeTarget)}`,
            );
        }
        for (const field of targetFields) {
            const value = phase?.sample?.[field];
            if (value !== crossTierTargetFramesPerSecond) {
                errors.push(
                    `${path}.sample.${field} must be ${crossTierTargetFramesPerSecond}; received ${canonicalJson(value)}`,
                );
            }
        }
    }

    const sample = row.candidate?.sample;
    const path = `${row.scenario} run ${row.profileRun} ${row.phase} candidate.sample`;
    if (
        sample?.runtimeFrameLoopTargetFramesPerSecondMin !==
        crossTierTargetFramesPerSecond
    ) {
        errors.push(
            `${path}.runtimeFrameLoopTargetFramesPerSecondMin must be ${crossTierTargetFramesPerSecond}; received ${canonicalJson(sample?.runtimeFrameLoopTargetFramesPerSecondMin)}`,
        );
    }
    for (const boundary of [
        'runtimeFrameLoopAtStart',
        'runtimeFrameLoopAtEnd',
    ]) {
        const snapshot = sample?.[boundary];
        const snapshotPath = `${path}.${boundary}`;
        if (!isRecord(snapshot)) {
            errors.push(`${snapshotPath} is missing`);
            continue;
        }
        if (snapshot.targetFramesPerSecond !== crossTierTargetFramesPerSecond) {
            errors.push(
                `${snapshotPath}.targetFramesPerSecond must be ${crossTierTargetFramesPerSecond}; received ${canonicalJson(snapshot.targetFramesPerSecond)}`,
            );
        }
        if (snapshot.effectiveVisible !== true) {
            errors.push(`${snapshotPath}.effectiveVisible must be true`);
        }
    }

    const leaseFields = [
        'runtimeFrameLoopActiveLeaseCountAtStart',
        'runtimeFrameLoopActiveLeaseCountMin',
        'runtimeFrameLoopActiveLeaseCountMax',
        'runtimeFrameLoopActiveLeaseCountAtEnd',
    ];
    const leaseCounts = leaseFields.map((field) => sample?.[field]);
    for (const [index, leaseCount] of leaseCounts.entries()) {
        if (!Number.isInteger(leaseCount) || leaseCount <= 0) {
            errors.push(
                `${path}.${leaseFields[index]} must be a positive integer`,
            );
        }
    }
    if (
        leaseCounts.every(
            (leaseCount) => Number.isInteger(leaseCount) && leaseCount > 0,
        ) &&
        new Set(leaseCounts).size !== 1
    ) {
        errors.push(
            `${path} runtime frame-loop active lease counts must remain stable`,
        );
    }

    const frames = sample?.frames;
    if (!Number.isInteger(frames) || frames <= 0) {
        errors.push(`${path}.frames must be a positive integer`);
    }
    validateCrossTierObserverIsolation(errors, sample, path);

    const renderedFrames = sample?.renderedFrames;
    const r3fFrameCallbackCount =
        sample?.runtimeFrameLoopCounterDeltas?.r3fFrameCallbackCount;
    if (
        !Number.isInteger(renderedFrames) ||
        renderedFrames <= 0 ||
        renderedFrames !== r3fFrameCallbackCount
    ) {
        errors.push(
            `${path}.renderedFrames must equal the positive runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount`,
        );
    }
}

function buildAbsoluteComparison({
    id,
    label,
    maximumIncrease,
    rows,
    unit = 'count',
}) {
    const individual = rankIndependentRuns(rows).map((row) => {
        const delta = row.candidate - row.baseline;
        return {
            ...row,
            delta: round(delta),
            pass: delta <= maximumIncrease,
        };
    });
    const baselineMedian = median(rows.map((row) => row.baseline));
    const candidateMedian = median(rows.map((row) => row.candidate));
    const medianDelta = candidateMedian - baselineMedian;
    return {
        baselineMedian: round(baselineMedian),
        candidateMedian: round(candidateMedian),
        id,
        individual,
        kind: 'absolute',
        label,
        maximumIncrease,
        medianDelta: round(medianDelta),
        pass: medianDelta <= maximumIncrease,
        rawRanksDiagnosticOnly: true,
        regressionBreach: medianDelta > maximumIncrease,
        screeningBreach: medianDelta > maximumIncrease,
        unit,
    };
}

function buildAbsoluteDiagnosticComparison({ gatedBy, ...metric }) {
    const baselineRelative = buildAbsoluteComparison(metric);
    return {
        ...baselineRelative,
        baselineRelativeDiagnosticOnly: true,
        baselineRelativeRegressionBreach: baselineRelative.regressionBreach,
        baselineRelativeScreeningBreach: baselineRelative.screeningBreach,
        diagnosticOnly: true,
        gatedBy,
        individual: baselineRelative.individual.map((run) => ({
            ...run,
            baselineRelativePass: run.pass,
            pass: true,
        })),
        pass: true,
        regressionBreach: false,
        screeningBreach: false,
    };
}

function groupRows(rows) {
    const groups = new Map();
    for (const row of rows) {
        const key = `${row.scenario}::${row.phase}`;
        const group = groups.get(key) ?? {
            phase: row.phase,
            rows: [],
            scenario: row.scenario,
        };
        group.rows.push(row);
        groups.set(key, group);
    }
    return [...groups.values()].sort((left, right) =>
        `${left.scenario}::${left.phase}`.localeCompare(
            `${right.scenario}::${right.phase}`,
        ),
    );
}

function crossTierSteadyScenarioBaseName(baseName) {
    return baseName.replace('-camera-motion-', '-steady-');
}

function crossTierCadenceState(rows) {
    const baselineValues = rows.map((row) => row.baseline.sample?.renderedFps);
    const candidateValues = rows.map(
        (row) => row.candidate?.sample?.renderedFps,
    );
    const valuesAreFinite = [...baselineValues, ...candidateValues].every(
        isFiniteNumber,
    );
    const baselineMedian = valuesAreFinite ? median(baselineValues) : null;
    const candidateMedian = valuesAreFinite ? median(candidateValues) : null;
    const everyRawSampleInTargetRange = valuesAreFinite
        ? [...baselineValues, ...candidateValues].every(
              (value) =>
                  value >= crossTierMinimumRenderedFps &&
                  value <= crossTierMaximumRenderedFps,
          )
        : false;
    const medianDeltaFps = valuesAreFinite
        ? Math.abs(candidateMedian - baselineMedian)
        : null;
    return {
        baselineMedian: isFiniteNumber(baselineMedian)
            ? round(baselineMedian)
            : null,
        baselineValues,
        candidateMedian: isFiniteNumber(candidateMedian)
            ? round(candidateMedian)
            : null,
        candidateValues,
        everyRawSampleInTargetRange,
        matched:
            everyRawSampleInTargetRange &&
            medianDeltaFps <= crossTierMatchedCadenceMedianToleranceFps,
        medianDeltaFps: isFiniteNumber(medianDeltaFps)
            ? round(medianDeltaFps)
            : null,
    };
}

function pushCrossTierCadenceError(errors, scenario, state, purpose) {
    errors.push(
        `${scenario} ${purpose} requires every baseline and candidate raw sample at ${crossTierMinimumRenderedFps}-${crossTierMaximumRenderedFps} FPS and a bundle-median delta no greater than ${crossTierMatchedCadenceMedianToleranceFps} FPS; received baseline=${canonicalJson(state.baselineValues)}, candidate=${canonicalJson(state.candidateValues)}, medianDelta=${canonicalJson(state.medianDeltaFps)}`,
    );
}

function crossTierGpuCadencePolicy({
    baselineSchedulerContract,
    errors,
    group,
    groupsByScenario,
    inputComparisonContractVersion,
}) {
    const cadence = crossTierCadenceState(group.rows);
    const isCameraMotion = group.scenario.includes('-camera-motion-');
    if (cadence.matched) {
        return {
            cadence,
            controlScenario: null,
            decisionStatus: 'comparable',
            gateBasis: 'matched-cadence',
        };
    }

    const candidateMotionInTargetRange = cadence.candidateValues.every(
        (value) =>
            isFiniteNumber(value) &&
            value >= crossTierMinimumRenderedFps &&
            value <= crossTierMaximumRenderedFps,
    );
    // Contract v4 makes the profiler-owned 30 FPS control mandatory. Preserve
    // the raw-motion diagnostic only for already-produced pre-v4 history.
    const intentionalLegacyCameraConfound =
        inputComparisonContractVersion <
            displayCadenceControlComparisonContractVersion &&
        isCameraMotion &&
        baselineSchedulerContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        isFiniteNumber(cadence.baselineMedian) &&
        cadence.baselineMedian > crossTierMaximumRenderedFps &&
        candidateMotionInTargetRange &&
        cadence.baselineMedian > cadence.candidateMedian;
    if (!intentionalLegacyCameraConfound) {
        pushCrossTierCadenceError(
            errors,
            group.scenario,
            cadence,
            'GPU p95 comparison cadence',
        );
        return {
            cadence,
            controlScenario: null,
            decisionStatus: 'invalid',
            gateBasis: 'cadence-mismatch',
        };
    }

    const controlScenario = crossTierSteadyScenarioBaseName(group.scenario);
    const control = groupsByScenario.get(controlScenario);
    if (!control) {
        errors.push(
            `${group.scenario} cadence-confounded GPU p95 evidence requires mapped same-tier steady control ${controlScenario}`,
        );
        return {
            cadence,
            controlScenario,
            decisionStatus: 'invalid',
            gateBasis: 'cadence-confounded',
        };
    }
    const controlCadence = crossTierCadenceState(control.rows);
    if (!controlCadence.matched) {
        pushCrossTierCadenceError(
            errors,
            controlScenario,
            controlCadence,
            `mapped steady control for ${group.scenario}`,
        );
    }
    for (const row of control.rows) {
        const baselineGpu = gpuState(row.baseline.sample);
        const candidateGpu = gpuState(row.candidate?.sample);
        if (!baselineGpu.available || !candidateGpu.available) {
            errors.push(
                `${group.scenario} cadence-confounded GPU p95 evidence requires complete strict GPU timing in mapped steady control ${controlScenario} run ${row.profileRun}`,
            );
        }
    }
    return {
        cadence,
        controlCadence,
        controlScenario,
        decisionStatus: 'not-comparable',
        gateBasis: 'cadence-confounded',
    };
}

function addMetricRows({
    candidateValue,
    baselineValue,
    errors,
    metricId,
    positiveRequired = false,
    required = false,
    row,
    rows,
    skipped,
}) {
    const baselinePresent = isFiniteNumber(baselineValue);
    const candidatePresent = isFiniteNumber(candidateValue);
    if (!baselinePresent && !candidatePresent) {
        if (required) {
            errors.push(
                `${row.scenario} ${row.phase} ${metricId} is required in both reports`,
            );
            return;
        }
        skipped.push({
            metric: metricId,
            phase: row.phase,
            reason: 'metric unavailable in both reports',
            scenario: row.scenario,
        });
        return;
    }
    if (baselinePresent !== candidatePresent) {
        errors.push(
            `${row.scenario} ${row.phase} ${metricId} is only available in one report`,
        );
        return;
    }
    if (positiveRequired && (baselineValue <= 0 || candidateValue <= 0)) {
        errors.push(
            `${row.scenario} ${row.phase} ${metricId} must be positive in both reports`,
        );
        return;
    }
    rows.push({
        baseline: baselineValue,
        candidate: candidateValue,
        phase: row.phase,
        profileRun: row.profileRun,
        scenario: row.scenario,
    });
}

function comparePairedScenarios(
    pairs,
    {
        baselineSchedulerContract = canonicalSchedulerBaselineContract,
        inputComparisonContractVersion = comparisonContractVersion,
        requireCandidateFrameContract = true,
        requireGardenSwitchWorkflowGpuTiming = false,
    } = {},
) {
    const comparisons = [];
    const errors = [];
    const invariants = [];
    const skipped = [];
    const gardenSwitchWorkflowRows = [];
    const resourceRows = [];
    const retainedHeapRows = [];
    const sampleRows = [];
    const timingRows = [];

    for (const { baseline, candidate } of pairs) {
        const baseName = scenarioBaseName(baseline);
        const profileRun = scenarioRun(baseline);
        retainedHeapRows.push({
            baseline: baseline.memory.retainedJsHeapMb,
            candidate: candidate.memory.retainedJsHeapMb,
            phase: 'post-scenario',
            profileRun,
            scenario: baseName,
        });
        if (baseName === gardenSwitchScenarioBaseName) {
            const baselineWorkflow = gpuElapsedWorkflowOccupancyState(baseline);
            const candidateWorkflow =
                gpuElapsedWorkflowOccupancyState(candidate);
            const workflowPath = `${baseName} run ${profileRun} workflow`;
            if (baselineWorkflow.invalid || candidateWorkflow.invalid) {
                errors.push(
                    `${workflowPath} GPU elapsed-workflow occupancy requires complete GPU timing and valid elapsed-window totals for every arrival in both reports`,
                );
            } else if (
                baselineWorkflow.available !== candidateWorkflow.available
            ) {
                errors.push(
                    `${workflowPath} GPU timing availability differs between reports`,
                );
            } else if (baselineWorkflow.available) {
                gardenSwitchWorkflowRows.push({
                    baseline: baselineWorkflow.value,
                    candidate: candidateWorkflow.value,
                    phase: 'workflow',
                    profileRun,
                    scenario: baseName,
                });
            } else if (requireGardenSwitchWorkflowGpuTiming) {
                errors.push(
                    `${workflowPath} GPU elapsed-workflow occupancy timing is required for confirmed release evidence`,
                );
            } else {
                skipped.push({
                    metric: 'gpu.elapsed_workflow_occupancy_percent',
                    phase: 'workflow',
                    reason: 'GPU timing unavailable for every arrival in both reports',
                    scenario: baseName,
                });
            }
        }
        const baselineSamplePhases = samplePhases(baseline);
        const candidateSamplePhases = samplePhases(candidate);
        for (const [index, baselinePhase] of baselineSamplePhases.entries()) {
            const candidatePhase = candidateSamplePhases[index];
            sampleRows.push({
                baseline: baselinePhase,
                candidate: candidatePhase,
                phase: baselinePhase.name,
                profileRun,
                scenario: baseName,
            });
        }

        const baselineResourcePhases = resourcePhases(baseline);
        const candidateResourcePhases = resourcePhases(candidate);
        for (const [index, baselinePhase] of baselineResourcePhases.entries()) {
            const candidatePhase = candidateResourcePhases[index];
            if (!candidatePhase || candidatePhase.name !== baselinePhase.name) {
                errors.push(
                    `${baseName} run ${profileRun} resource phase ${baselinePhase.name} is missing from candidate evidence`,
                );
                continue;
            }
            if (
                candidatePhase.diagnosticOnly !== baselinePhase.diagnosticOnly
            ) {
                errors.push(
                    `${baseName} run ${profileRun} resource phase ${baselinePhase.name} diagnostic policy differs between reports`,
                );
                continue;
            }
            if (candidatePhase.gatedBy !== baselinePhase.gatedBy) {
                errors.push(
                    `${baseName} run ${profileRun} resource phase ${baselinePhase.name} diagnostic gate differs between reports`,
                );
                continue;
            }
            resourceRows.push({
                baseline: baselinePhase,
                candidate: candidatePhase,
                diagnosticOnly: baselinePhase.diagnosticOnly,
                gatedBy: baselinePhase.gatedBy ?? null,
                phase: baselinePhase.name,
                profileRun,
                scenario: baseName,
            });
        }

        const baselineTimingPhases = timingPhases(baseline);
        const candidateTimingPhases = timingPhases(candidate);
        for (const [index, baselinePhase] of baselineTimingPhases.entries()) {
            timingRows.push({
                baseline: baselinePhase,
                candidate: candidateTimingPhases[index],
                phase: baselinePhase.name,
                profileRun,
                scenario: baseName,
            });
        }

        if (baseline.requested?.lifecycleProfile === true) {
            for (const phase of ['offscreen', 'hidden']) {
                const baselinePhase = baseline.lifecycle?.[phase];
                const candidatePhase = candidate.lifecycle?.[phase];
                const schedulerValues = [
                    {
                        field: 'runtimeSchedulerZeroObserved',
                        baseline: baselinePhase?.runtimeSchedulerZeroObserved,
                        candidate: candidatePhase?.runtimeSchedulerZeroObserved,
                        expected: true,
                    },
                    ...lifecycleCounterFields.map((field) => ({
                        field: `residualDeltas.${field}`,
                        baseline: baselinePhase?.residualDeltas?.[field],
                        candidate: candidatePhase?.residualDeltas?.[field],
                        expected: 0,
                    })),
                ];
                for (const value of schedulerValues) {
                    if (
                        value.baseline === undefined ||
                        value.candidate === undefined
                    ) {
                        errors.push(
                            `${baseName} run ${profileRun} ${phase}.${value.field} is missing`,
                        );
                        continue;
                    }
                    invariants.push({
                        baseline: value.baseline,
                        baselinePass: value.baseline === value.expected,
                        candidate: value.candidate,
                        candidatePass: value.candidate === value.expected,
                        expected: value.expected,
                        field: value.field,
                        pass:
                            value.baseline === value.expected &&
                            value.candidate === value.expected,
                        phase,
                        profileRun,
                        scenario: baseName,
                    });
                }
            }
        }
    }

    const sampleGroups = groupRows(sampleRows);
    const sampleGroupsByScenario = new Map(
        sampleGroups.map((group) => [group.scenario, group]),
    );
    for (const group of sampleGroups) {
        const targetAwareLifecycle =
            requireCandidateFrameContract &&
            baselineSchedulerContract ===
                legacyHeartbeatSchedulerBaselineContract &&
            group.scenario === lifecycleScenarioBaseName;
        for (const metric of [
            {
                field: 'longTaskCount',
                id: 'long_tasks.count',
                kind: 'absolute',
                label: 'long-task count',
                unit: 'count',
            },
            {
                field: 'longTaskTotalMs',
                id: 'long_tasks.total_ms',
                kind: 'ratio',
                label: 'long-task total duration',
                medianAbsoluteTolerance: 20,
                medianLimit: 1.2,
                runAbsoluteTolerance: 40,
                runLimit: 1.5,
                unit: 'ms',
            },
            {
                field: 'longTaskMaxMs',
                id: 'long_tasks.max_ms',
                kind: 'ratio',
                label: 'long-task maximum duration',
                medianAbsoluteTolerance: 10,
                medianLimit: 1.2,
                runAbsoluteTolerance: 20,
                runLimit: 1.5,
                unit: 'ms',
            },
        ]) {
            const rows = [];
            for (const row of group.rows) {
                const baselineValue = row.baseline.sample?.[metric.field];
                const candidateValue = row.candidate?.sample?.[metric.field];
                if (
                    !isFiniteNumber(baselineValue) ||
                    baselineValue < 0 ||
                    !isFiniteNumber(candidateValue) ||
                    candidateValue < 0
                ) {
                    errors.push(
                        `${row.scenario} run ${row.profileRun} ${row.phase} ${metric.field} must be a non-negative finite number in both reports`,
                    );
                } else {
                    rows.push({
                        baseline: baselineValue,
                        candidate: candidateValue,
                        phase: row.phase,
                        profileRun: row.profileRun,
                        scenario: row.scenario,
                    });
                }
            }
            if (rows.length > 0) {
                comparisons.push({
                    phase: group.phase,
                    scenario: group.scenario,
                    ...(metric.kind === 'absolute'
                        ? buildAbsoluteComparison({
                              ...metric,
                              maximumIncrease: 0,
                              rows,
                          })
                        : buildRatioComparison({ ...metric, rows })),
                });
            }
        }

        for (const metric of ratioMetricRegistry) {
            const rows = [];
            for (const row of group.rows) {
                if (
                    requireCandidateFrameContract &&
                    metric.id === 'frame.rendered_fps'
                ) {
                    if (group.scenario === gardenSwitchScenarioBaseName) {
                        if (
                            baselineSchedulerContract ===
                            canonicalSchedulerBaselineContract
                        ) {
                            validateGardenSwitchFrameContract(
                                row,
                                'baseline',
                                errors,
                            );
                        }
                        validateGardenSwitchFrameContract(
                            row,
                            'candidate',
                            errors,
                        );
                    } else if (crossTierBaseNamePattern.test(group.scenario)) {
                        validateCrossTierCandidateFrameContract(row, errors);
                    } else if (targetAwareLifecycle) {
                        validateLifecycleCandidateFrameContract(row, errors);
                    }
                }
                addMetricRows({
                    baselineValue: metric.read(row.baseline),
                    candidateValue: metric.read(row.candidate),
                    errors,
                    metricId: metric.id,
                    positiveRequired: true,
                    required:
                        metric.id !== 'cpu.script_duration_s' ||
                        isRecord(row.baseline.cdp) ||
                        isRecord(row.candidate.cdp),
                    row,
                    rows,
                    skipped,
                });
            }
            if (rows.length > 0) {
                comparisons.push({
                    phase: group.phase,
                    scenario: group.scenario,
                    ...(targetAwareLifecycle && metric.id === 'frame.p95_ms'
                        ? buildLifecycleP95FrameComparison({
                              ...metric,
                              rows,
                          })
                        : targetAwareLifecycle &&
                            metric.id === 'frame.rendered_fps'
                          ? buildLifecycleRenderedFpsComparison({
                                ...metric,
                                rows,
                            })
                          : requireCandidateFrameContract &&
                              metric.id === 'frame.rendered_fps' &&
                              group.scenario === gardenSwitchScenarioBaseName
                            ? buildGardenSwitchRenderedFpsComparison({
                                  ...metric,
                                  phase: group.phase,
                                  rows,
                              })
                            : requireCandidateFrameContract &&
                                metric.id === 'frame.rendered_fps' &&
                                crossTierBaseNamePattern.test(group.scenario)
                              ? buildCrossTierRenderedFpsComparison({
                                    ...metric,
                                    rows,
                                })
                              : buildRatioComparison({ ...metric, rows })),
                });
            }
        }

        if (
            requireCandidateFrameContract &&
            group.scenario === gardenSwitchScenarioBaseName &&
            group.phase.startsWith('arrival-1-')
        ) {
            for (const metric of gardenSwitchInitialTotalWorkMetricRegistry) {
                const rows = [];
                for (const row of group.rows) {
                    addMetricRows({
                        baselineValue: metric.read(row.baseline),
                        candidateValue: metric.read(row.candidate),
                        errors,
                        metricId: metric.id,
                        positiveRequired: true,
                        required: true,
                        row,
                        rows,
                        skipped,
                    });
                }
                if (rows.length > 0) {
                    comparisons.push({
                        phase: group.phase,
                        scenario: group.scenario,
                        ...buildRatioComparison({ ...metric, rows }),
                    });
                }
            }
        }

        const crossTierGpuCadence =
            requireCandidateFrameContract &&
            crossTierBaseNamePattern.test(group.scenario)
                ? crossTierGpuCadencePolicy({
                      baselineSchedulerContract,
                      errors,
                      group,
                      groupsByScenario: sampleGroupsByScenario,
                      inputComparisonContractVersion,
                  })
                : null;
        const gpuRows = [];
        const gpuOccupancyRows = [];
        for (const row of group.rows) {
            const baselineGpu = gpuState(row.baseline.sample);
            const candidateGpu = gpuState(row.candidate.sample);
            if (
                baselineGpu.invalidAvailableValue ||
                candidateGpu.invalidAvailableValue
            ) {
                errors.push(
                    `${row.scenario} ${row.phase} GPU timing marked valid requires a positive sample window and rendered-frame count; complete, valid, non-disjoint queries; a null reason; positive ordered p95, maximum, and total elapsed time; and gpu.sampleCount equal to sample.renderedFrames`,
                );
            } else if (baselineGpu.available !== candidateGpu.available) {
                errors.push(
                    `${row.scenario} ${row.phase} GPU timing availability differs between reports`,
                );
            } else if (!baselineGpu.available) {
                if (!baselineGpu.reason || !candidateGpu.reason) {
                    errors.push(
                        `${row.scenario} ${row.phase} GPU timing unavailability requires an explicit reason in both reports`,
                    );
                } else if (baselineGpu.reason !== candidateGpu.reason) {
                    errors.push(
                        `${row.scenario} ${row.phase} GPU timing unavailable for different reasons: baseline=${baselineGpu.reason}, candidate=${candidateGpu.reason}`,
                    );
                } else if (crossTierGpuCadence) {
                    errors.push(
                        `${row.scenario} run ${row.profileRun} ${row.phase} GPU timing is required for cadence-safe cross-tier comparison`,
                    );
                } else {
                    skipped.push({
                        metric: 'gpu.p95_ms',
                        phase: row.phase,
                        reason: `GPU timing unavailable in both reports: ${baselineGpu.reason}`,
                        scenario: row.scenario,
                    });
                }
            } else {
                gpuRows.push({
                    baseline: baselineGpu.value,
                    baselineElapsedMeanMs: baselineGpu.elapsedMeanMs,
                    baselineElapsedOccupancyPercent:
                        baselineGpu.elapsedOccupancyPercent,
                    candidate: candidateGpu.value,
                    candidateElapsedMeanMs: candidateGpu.elapsedMeanMs,
                    candidateElapsedOccupancyPercent:
                        candidateGpu.elapsedOccupancyPercent,
                    phase: row.phase,
                    profileRun: row.profileRun,
                    scenario: row.scenario,
                });
                if (
                    requireCandidateFrameContract &&
                    group.scenario === gardenSwitchScenarioBaseName
                ) {
                    const baselineOccupancy = gpuElapsedWindowOccupancyState(
                        row.baseline.sample,
                    );
                    const candidateOccupancy = gpuElapsedWindowOccupancyState(
                        row.candidate.sample,
                    );
                    if (!baselineOccupancy.valid || !candidateOccupancy.valid) {
                        errors.push(
                            `${row.scenario} run ${row.profileRun} ${row.phase} GPU elapsed-window evidence requires complete, valid, non-disjoint timing; positive ordered gpu.elapsedP95Ms, gpu.elapsedMaxMs, and gpu.elapsedTotalMs; a null gpu.reason; positive sample.elapsedMs and sample.renderedFrames; and gpu.sampleCount equal to sample.renderedFrames in both reports`,
                        );
                    } else {
                        gpuOccupancyRows.push({
                            baseline: baselineOccupancy.value,
                            candidate: candidateOccupancy.value,
                            phase: row.phase,
                            profileRun: row.profileRun,
                            scenario: row.scenario,
                        });
                    }
                }
            }
        }
        if (gpuRows.length > 0) {
            const metric = {
                direction: 'maximum',
                id: 'gpu.p95_ms',
                label: 'GPU p95 duration',
                medianAbsoluteTolerance: 3,
                medianLimit: 1.15,
                rows: gpuRows,
                runAbsoluteTolerance: 6,
                runLimit: 1.4,
                unit: 'ms',
            };
            const timingDiagnostics = {
                baselineElapsedMeanMedianMs: round(
                    median(gpuRows.map((row) => row.baselineElapsedMeanMs)),
                ),
                baselineElapsedOccupancyMedianPercent: round(
                    median(
                        gpuRows.map(
                            (row) => row.baselineElapsedOccupancyPercent,
                        ),
                    ),
                ),
                candidateElapsedMeanMedianMs: round(
                    median(gpuRows.map((row) => row.candidateElapsedMeanMs)),
                ),
                candidateElapsedOccupancyMedianPercent: round(
                    median(
                        gpuRows.map(
                            (row) => row.candidateElapsedOccupancyPercent,
                        ),
                    ),
                ),
            };
            const cadenceConfounded =
                crossTierGpuCadence?.gateBasis === 'cadence-confounded' &&
                crossTierGpuCadence.decisionStatus === 'not-comparable';
            comparisons.push({
                phase: group.phase,
                scenario: group.scenario,
                ...(cadenceConfounded
                    ? buildCadenceConfoundedGpuComparison({
                          ...metric,
                          gatedBy: `${crossTierCadenceConfoundedGpuGate}: ${crossTierGpuCadence.controlScenario}`,
                      })
                    : buildRatioComparison(metric)),
                ...(crossTierGpuCadence
                    ? {
                          cadence: crossTierGpuCadence.cadence,
                          cadenceControl:
                              crossTierGpuCadence.controlCadence ?? null,
                          controlScenario: crossTierGpuCadence.controlScenario,
                          decisionStatus: crossTierGpuCadence.decisionStatus,
                          gateBasis: crossTierGpuCadence.gateBasis,
                      }
                    : {
                          decisionStatus: 'comparable',
                          gateBasis: 'direct',
                      }),
                gpuTimingDiagnostics: timingDiagnostics,
            });
        }
        if (gpuOccupancyRows.length > 0) {
            comparisons.push({
                phase: group.phase,
                scenario: group.scenario,
                ...buildRatioDiagnosticComparison({
                    direction: 'maximum',
                    gatedBy: gardenSwitchGpuOccupancyDiagnosticGate,
                    id: 'gpu.elapsed_window_occupancy_percent',
                    label: 'GPU elapsed-window occupancy',
                    medianAbsoluteTolerance: 5,
                    medianLimit: 1.15,
                    rows: gpuOccupancyRows,
                    runAbsoluteTolerance: 10,
                    runLimit: 1.3,
                    unit: '%',
                }),
            });
        }
    }

    for (const group of groupRows(resourceRows)) {
        const diagnosticOnly = group.rows.every(
            (row) => row.diagnosticOnly === true,
        );
        if (
            !diagnosticOnly &&
            group.rows.some((row) => row.diagnosticOnly === true)
        ) {
            errors.push(
                `${group.scenario} ${group.phase} resource diagnostic policy is inconsistent`,
            );
            continue;
        }
        for (const metric of resourceMetricRegistry) {
            const rows = [];
            for (const row of group.rows) {
                addMetricRows({
                    baselineValue: row.baseline.resources?.[metric.field],
                    candidateValue: row.candidate.resources?.[metric.field],
                    errors,
                    metricId: metric.id,
                    required: true,
                    row,
                    rows,
                    skipped,
                });
            }
            if (rows.length > 0) {
                comparisons.push({
                    phase: group.phase,
                    scenario: group.scenario,
                    ...(diagnosticOnly
                        ? buildAbsoluteDiagnosticComparison({
                              ...metric,
                              gatedBy: group.rows[0].gatedBy,
                              rows,
                          })
                        : buildAbsoluteComparison({ ...metric, rows })),
                });
            }
        }
    }

    for (const group of groupRows(retainedHeapRows)) {
        comparisons.push({
            phase: group.phase,
            scenario: group.scenario,
            ...buildRatioComparison({
                ...retainedHeapMetric,
                rows: group.rows,
            }),
        });
    }

    if (gardenSwitchWorkflowRows.length > 0) {
        comparisons.push({
            phase: 'workflow',
            scenario: gardenSwitchScenarioBaseName,
            ...buildRatioDiagnosticComparison({
                direction: 'maximum',
                gatedBy: gardenSwitchGpuOccupancyDiagnosticGate,
                id: 'gpu.elapsed_workflow_occupancy_percent',
                label: 'GPU elapsed-workflow occupancy',
                medianAbsoluteTolerance: 5,
                medianLimit: 1.15,
                rows: gardenSwitchWorkflowRows,
                runAbsoluteTolerance: 10,
                runLimit: 1.3,
                unit: '%',
            }),
        });
    }

    const timingMetricIds = [
        ...new Set(
            timingRows.flatMap((row) => [
                ...Object.keys(row.baseline.metrics),
                ...Object.keys(row.candidate.metrics),
            ]),
        ),
    ].sort();
    for (const metricId of timingMetricIds) {
        const relevantRows = timingRows.filter(
            (row) =>
                metricId in row.baseline.metrics ||
                metricId in row.candidate.metrics,
        );
        for (const group of groupRows(relevantRows)) {
            const rows = [];
            for (const row of group.rows) {
                addMetricRows({
                    baselineValue: row.baseline.metrics[metricId],
                    candidateValue: row.candidate.metrics[metricId],
                    errors,
                    metricId,
                    positiveRequired: true,
                    required: true,
                    row,
                    rows,
                    skipped,
                });
            }
            if (rows.length > 0) {
                comparisons.push({
                    phase: group.phase,
                    scenario: group.scenario,
                    ...buildRatioComparison({
                        ...timingThresholds(metricId),
                        id: metricId,
                        label: metricId.replaceAll(/[._]/g, ' '),
                        rows,
                    }),
                });
            }
        }
    }

    comparisons.sort((left, right) =>
        `${left.scenario}::${left.phase}::${left.id}`.localeCompare(
            `${right.scenario}::${right.phase}::${right.id}`,
        ),
    );
    invariants.sort((left, right) =>
        `${left.scenario}::${left.phase}::${left.profileRun}::${left.field}`.localeCompare(
            `${right.scenario}::${right.phase}::${right.profileRun}::${right.field}`,
        ),
    );
    skipped.sort((left, right) =>
        `${left.scenario}::${left.phase}::${left.metric}`.localeCompare(
            `${right.scenario}::${right.phase}::${right.metric}`,
        ),
    );
    return { comparisons, errors, invariants, skipped };
}

function compareReportPair(
    baseline,
    candidate,
    {
        allowPartial = false,
        allowSameSource = false,
        baselineSchedulerContract = canonicalSchedulerBaselineContract,
        baselinePath = null,
        candidatePath = null,
        candidateSchedulerContract = canonicalSchedulerBaselineContract,
        confirmedMatrixMember = false,
        permitLegacySameSourceRepeat = false,
        requireCandidateFrameContract = true,
    } = {},
) {
    const validationErrors = [
        ...(baselineSchedulerContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        allowSameSource &&
        !permitLegacySameSourceRepeat
            ? [
                  'legacy heartbeat scheduler baseline evidence cannot use same-source comparison mode',
              ]
            : []),
        ...validateReport(baseline, 'baseline', {
            allowPartial,
            schedulerBaselineContract: baselineSchedulerContract,
        }),
        ...validateReport(candidate, 'candidate', {
            allowPartial,
            schedulerBaselineContract: candidateSchedulerContract,
        }),
    ];

    if (validationErrors.length === 0) {
        if (
            !allowSameSource &&
            baseline.provenance.subject.commit ===
                candidate.provenance.subject.commit
        ) {
            validationErrors.push(
                'baseline and candidate subject commits are identical; pass --allow-same-source only for diagnostic comparisons',
            );
        }
        pushMismatch(
            validationErrors,
            'comparison contract',
            baseline.comparisonContractVersion,
            candidate.comparisonContractVersion,
        );
        pushMismatch(
            validationErrors,
            'profiler harness provenance',
            baseline.provenance.harness,
            candidate.provenance.harness,
        );
        pushMismatch(
            validationErrors,
            'runtime provenance',
            baseline.provenance.runtime,
            candidate.provenance.runtime,
        );
        pushMismatch(
            validationErrors,
            'server provenance',
            baseline.provenance.server,
            candidate.provenance.server,
        );
        pushMismatch(
            validationErrors,
            'profile options',
            pick(
                baseline.options,
                reportOptionFields.filter(
                    (field) => field !== 'legacyOutlinePipeline',
                ),
            ),
            pick(
                candidate.options,
                reportOptionFields.filter(
                    (field) => field !== 'legacyOutlinePipeline',
                ),
            ),
        );
    }

    let pairs = [];
    if (validationErrors.length === 0) {
        const baselineScenarios = new Map(
            baseline.scenarios.map((scenario) => [
                scenarioKey(scenario),
                scenario,
            ]),
        );
        const candidateScenarios = new Map(
            candidate.scenarios.map((scenario) => [
                scenarioKey(scenario),
                scenario,
            ]),
        );
        const baselineKeys = [...baselineScenarios.keys()].sort();
        const candidateKeys = [...candidateScenarios.keys()].sort();
        pushMismatch(
            validationErrors,
            'scenario run keys',
            baselineKeys,
            candidateKeys,
        );
        if (validationErrors.length === 0) {
            pairs = baselineKeys.map((key) => ({
                baseline: baselineScenarios.get(key),
                candidate: candidateScenarios.get(key),
                key,
            }));
            for (const pair of pairs) {
                validationErrors.push(
                    ...compareScenarioCompatibility(
                        pair.baseline,
                        pair.candidate,
                        {
                            baselineSchedulerContract,
                            baselineSchemaVersion: baseline.schemaVersion,
                            candidateSchedulerContract,
                            candidateSchemaVersion: candidate.schemaVersion,
                        },
                    ).map((error) => `${pair.key}: ${error}`),
                );
            }
        }
    }

    let comparisonData = {
        comparisons: [],
        errors: [],
        invariants: [],
        skipped: [],
    };
    if (validationErrors.length === 0) {
        comparisonData = comparePairedScenarios(pairs, {
            baselineSchedulerContract,
            inputComparisonContractVersion: baseline.comparisonContractVersion,
            requireCandidateFrameContract,
            requireGardenSwitchWorkflowGpuTiming: confirmedMatrixMember,
        });
        validationErrors.push(...comparisonData.errors);
    }

    const failedComparisons = comparisonData.comparisons.filter(
        (comparison) => comparison.regressionBreach,
    );
    const screeningComparisons = comparisonData.comparisons.filter(
        (comparison) => comparison.screeningBreach,
    );
    const failedInvariants = comparisonData.invariants.filter(
        (invariant) => !invariant.pass,
    );
    const comparable = validationErrors.length === 0;
    const pairStatus = !comparable
        ? 'invalid'
        : failedComparisons.length > 0 || failedInvariants.length > 0
          ? 'regression'
          : screeningComparisons.length > 0
            ? 'needs-rerun'
            : 'pass';
    const incompleteReleaseMatrix =
        !confirmedMatrixMember && !allowPartial && !allowSameSource;
    const status =
        pairStatus === 'pass' && incompleteReleaseMatrix
            ? 'needs-rerun'
            : pairStatus;
    const exitCode = status === 'invalid' ? 2 : status === 'pass' ? 0 : 1;

    return {
        baseline: {
            generatedAt: baseline?.generatedAt ?? null,
            harnessCommit: baseline?.provenance?.harness?.commit ?? null,
            path: baselinePath,
            schedulerContract: baselineSchedulerContract,
            subjectCommit: baseline?.provenance?.subject?.commit ?? null,
        },
        candidate: {
            generatedAt: candidate?.generatedAt ?? null,
            harnessCommit: candidate?.provenance?.harness?.commit ?? null,
            path: candidatePath,
            schedulerContract: candidateSchedulerContract,
            subjectCommit: candidate?.provenance?.subject?.commit ?? null,
        },
        comparable,
        comparisonContractVersion,
        comparisons: comparable ? comparisonData.comparisons : [],
        diagnostic: allowPartial || allowSameSource || !confirmedMatrixMember,
        diagnosticReasons: [
            ...(allowPartial ? ['partial scenario manifest allowed'] : []),
            ...(allowSameSource ? ['same source commit allowed'] : []),
            ...(!confirmedMatrixMember ? ['single comparison pair only'] : []),
        ],
        exitCode,
        generatedAt: new Date().toISOString(),
        invariants: comparable ? comparisonData.invariants : [],
        schemaVersion: comparisonReportSchemaVersion,
        skipped: comparable ? comparisonData.skipped : [],
        status,
        summary: {
            cadenceConfoundedComparisons: comparable
                ? comparisonData.comparisons.filter(
                      (comparison) =>
                          comparison.gateBasis === 'cadence-confounded',
                  ).length
                : 0,
            failedComparisons: comparable ? failedComparisons.length : 0,
            failedInvariants: comparable ? failedInvariants.length : 0,
            passedComparisons: comparable
                ? comparisonData.comparisons.length -
                  screeningComparisons.length
                : 0,
            passedInvariants: comparable
                ? comparisonData.invariants.length - failedInvariants.length
                : 0,
            scenarioRunCount: comparable ? pairs.length : 0,
            screeningComparisons: comparable ? screeningComparisons.length : 0,
            skippedMetrics: comparable ? comparisonData.skipped.length : 0,
            totalComparisons: comparable
                ? comparisonData.comparisons.length
                : 0,
            totalInvariants: comparable ? comparisonData.invariants.length : 0,
        },
        validationErrors,
    };
}

function compareReports(
    baseline,
    candidate,
    {
        allowPartial = false,
        allowSameSource = false,
        baselinePath = null,
        baselineSchedulerContract = canonicalSchedulerBaselineContract,
        candidatePath = null,
    } = {},
) {
    return compareReportPair(baseline, candidate, {
        allowPartial,
        allowSameSource,
        baselinePath,
        baselineSchedulerContract,
        candidatePath,
        candidateSchedulerContract: canonicalSchedulerBaselineContract,
        confirmedMatrixMember: false,
    });
}

function metricKey(result) {
    return `${result.scenario}::${result.phase}::${result.id}`;
}

function invariantKey(result) {
    return `${result.scenario}::${result.phase}::${result.profileRun}::${result.field}`;
}

function reportCapture(
    report,
    path,
    schedulerContract = canonicalSchedulerBaselineContract,
) {
    return {
        generatedAt: report?.generatedAt ?? null,
        harnessCommit: report?.provenance?.harness?.commit ?? null,
        path,
        schedulerContract,
        subjectCommit: report?.provenance?.subject?.commit ?? null,
    };
}

function canonicalizeEvidence(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalizeEvidence);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonicalizeEvidence(value[key])]),
        );
    }
    return value;
}

function reportEvidenceFingerprint(report) {
    if (!report || typeof report !== 'object') {
        return null;
    }
    const { generatedAt: _generatedAt, ...evidence } = report;
    return JSON.stringify(canonicalizeEvidence(evidence));
}

function validateIndependentCapture(
    source,
    repeated,
    { label, repeatedPath = null, sourcePath = null },
) {
    const errors = [];
    const sourceGeneratedAt = Date.parse(source?.generatedAt);
    const repeatedGeneratedAt = Date.parse(repeated?.generatedAt);
    if (!Number.isFinite(sourceGeneratedAt)) {
        errors.push(`${label} source generatedAt must be a valid timestamp`);
    }
    if (!Number.isFinite(repeatedGeneratedAt)) {
        errors.push(`${label} generatedAt must be a valid timestamp`);
    }
    if (
        Number.isFinite(sourceGeneratedAt) &&
        Number.isFinite(repeatedGeneratedAt) &&
        sourceGeneratedAt === repeatedGeneratedAt
    ) {
        errors.push(
            `${label} must be an independent capture with a different generatedAt value`,
        );
    }
    if (
        reportEvidenceFingerprint(source) ===
        reportEvidenceFingerprint(repeated)
    ) {
        errors.push(
            `${label} must contain independently captured evidence, not a timestamp-only copy`,
        );
    }
    if (sourcePath && repeatedPath && sourcePath === repeatedPath) {
        errors.push(`${label} report path must differ from its source path`);
    }
    return errors;
}

function validateCadenceDecisionMatrix(comparisonPairs) {
    const errors = [];
    const resultsByKey = new Map();
    for (const { comparison, label } of comparisonPairs) {
        for (const result of comparison.comparisons) {
            if (
                result.id !== 'gpu.p95_ms' ||
                !result.scenario.includes('-camera-motion-') ||
                !crossTierBaseNamePattern.test(result.scenario)
            ) {
                continue;
            }
            const values = resultsByKey.get(metricKey(result)) ?? [];
            values.push({ label, result });
            resultsByKey.set(metricKey(result), values);
        }
    }
    for (const [key, values] of resultsByKey) {
        const hasCadenceConfound = values.some(
            ({ result }) => result.gateBasis === 'cadence-confounded',
        );
        if (!hasCadenceConfound) {
            continue;
        }
        if (
            values.length !== comparisonPairs.length ||
            values.some(
                ({ result }) =>
                    result.gateBasis !== 'cadence-confounded' ||
                    result.decisionStatus !== 'not-comparable',
            )
        ) {
            errors.push(
                `${key} cadence-confounded GPU p95 classification must hold in every symmetric comparison pairing`,
            );
            continue;
        }
        const baselineMedians = values.map(
            ({ result }) => result.cadence?.baselineMedian,
        );
        const candidateMedians = values.map(
            ({ result }) => result.cadence?.candidateMedian,
        );
        if (
            baselineMedians.some(
                (value) =>
                    !isFiniteNumber(value) ||
                    value <= crossTierMaximumRenderedFps,
            ) ||
            candidateMedians.some((value) => !isFiniteNumber(value)) ||
            baselineMedians.some((baselineMedian) =>
                candidateMedians.some(
                    (candidateMedian) => baselineMedian <= candidateMedian,
                ),
            )
        ) {
            errors.push(
                `${key} cadence-confounded GPU p95 classification requires both legacy baseline medians above ${crossTierMaximumRenderedFps} FPS and above both canonical candidate medians`,
            );
        }
    }
    return errors;
}

function compareConfirmedReports(
    baseline,
    candidate,
    confirmation,
    {
        allowPartial = false,
        allowSameSource = false,
        baselineConfirmation = null,
        baselineConfirmationPath = null,
        baselinePath = null,
        baselineSchedulerContract = canonicalSchedulerBaselineContract,
        candidatePath = null,
        confirmationPath = null,
    } = {},
) {
    const sharedOptions = {
        allowPartial,
        allowSameSource,
        baselinePath,
        baselineSchedulerContract,
    };
    const primary = compareReportPair(baseline, candidate, {
        ...sharedOptions,
        candidatePath,
        confirmedMatrixMember: true,
    });
    const repeated = compareReportPair(baseline, confirmation, {
        ...sharedOptions,
        candidatePath: confirmationPath,
        confirmedMatrixMember: true,
    });
    const repeatCompatibility = compareReportPair(candidate, confirmation, {
        allowPartial,
        allowSameSource: true,
        baselinePath: candidatePath,
        candidatePath: confirmationPath,
        confirmedMatrixMember: true,
    });
    const baselineRepeatCompatibility = baselineConfirmation
        ? compareReportPair(baseline, baselineConfirmation, {
              allowPartial,
              allowSameSource: true,
              baselineSchedulerContract,
              baselinePath,
              candidatePath: baselineConfirmationPath,
              candidateSchedulerContract: baselineSchedulerContract,
              confirmedMatrixMember: true,
              permitLegacySameSourceRepeat: true,
              requireCandidateFrameContract: false,
          })
        : null;
    const baselineRepeatedPrimary = baselineConfirmation
        ? compareReportPair(baselineConfirmation, candidate, {
              allowPartial,
              allowSameSource,
              baselineSchedulerContract,
              baselinePath: baselineConfirmationPath,
              candidatePath,
              confirmedMatrixMember: true,
          })
        : null;
    const baselineRepeatedConfirmation = baselineConfirmation
        ? compareReportPair(baselineConfirmation, confirmation, {
              allowPartial,
              allowSameSource,
              baselineSchedulerContract,
              baselinePath: baselineConfirmationPath,
              candidatePath: confirmationPath,
              confirmedMatrixMember: true,
          })
        : null;
    const validationErrors = [
        ...primary.validationErrors.map((error) => `primary: ${error}`),
        ...repeated.validationErrors.map((error) => `confirmation: ${error}`),
        ...repeatCompatibility.validationErrors.map(
            (error) => `candidate repeat compatibility: ${error}`,
        ),
        ...(baselineRepeatCompatibility?.validationErrors ?? []).map(
            (error) => `baseline repeat compatibility: ${error}`,
        ),
        ...(baselineRepeatedPrimary?.validationErrors ?? []).map(
            (error) => `baseline confirmation / candidate: ${error}`,
        ),
        ...(baselineRepeatedConfirmation?.validationErrors ?? []).map(
            (error) => `baseline confirmation / confirmation: ${error}`,
        ),
    ];
    if (
        baselineSchedulerContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        (allowPartial || allowSameSource || !baselineConfirmation)
    ) {
        validationErrors.push(
            'legacy heartbeat scheduler baseline evidence requires a non-diagnostic symmetric 2x2 comparison',
        );
    }
    if (!baselineConfirmation && !allowPartial && !allowSameSource) {
        validationErrors.push(
            'baseline confirmation is required for a non-diagnostic symmetric 2x2 comparison',
        );
    }
    if (
        candidate?.provenance?.subject?.commit !==
        confirmation?.provenance?.subject?.commit
    ) {
        validationErrors.push(
            'candidate and confirmation subject commits must be identical',
        );
    }
    if (
        candidate?.provenance?.harness?.commit !==
        confirmation?.provenance?.harness?.commit
    ) {
        validationErrors.push(
            'candidate and confirmation harness commits must be identical',
        );
    }
    validationErrors.push(
        ...validateIndependentCapture(candidate, confirmation, {
            label: 'candidate confirmation',
            repeatedPath: confirmationPath,
            sourcePath: candidatePath,
        }),
    );
    if (baselineConfirmation) {
        if (
            baseline?.provenance?.subject?.commit !==
            baselineConfirmation?.provenance?.subject?.commit
        ) {
            validationErrors.push(
                'baseline and baseline confirmation subject commits must be identical',
            );
        }
        if (
            baseline?.provenance?.harness?.commit !==
            baselineConfirmation?.provenance?.harness?.commit
        ) {
            validationErrors.push(
                'baseline and baseline confirmation harness commits must be identical',
            );
        }
        validationErrors.push(
            ...validateIndependentCapture(baseline, baselineConfirmation, {
                label: 'baseline confirmation',
                repeatedPath: baselineConfirmationPath,
                sourcePath: baselinePath,
            }),
        );
    }
    const comparisonPairs = [
        {
            comparison: primary,
            label: 'baseline-1 / candidate-1',
        },
        {
            comparison: repeated,
            label: 'baseline-1 / candidate-2',
        },
        ...(baselineConfirmation
            ? [
                  {
                      comparison: baselineRepeatedPrimary,
                      label: 'baseline-2 / candidate-1',
                  },
                  {
                      comparison: baselineRepeatedConfirmation,
                      label: 'baseline-2 / candidate-2',
                  },
              ]
            : []),
    ];
    if (validationErrors.length === 0) {
        validationErrors.push(
            ...validateCadenceDecisionMatrix(comparisonPairs),
        );
    }
    if (validationErrors.length > 0) {
        return {
            ...primary,
            baselineConfirmation: reportCapture(
                baselineConfirmation,
                baselineConfirmationPath,
                baselineSchedulerContract,
            ),
            baselineConfirmationUsed: Boolean(baselineConfirmation),
            comparable: false,
            comparisons: [],
            confirmation: reportCapture(
                confirmation,
                confirmationPath,
                canonicalSchedulerBaselineContract,
            ),
            confirmationUsed: true,
            exitCode: 2,
            invariants: [],
            schemaVersion: comparisonReportSchemaVersion,
            skipped: [],
            status: 'invalid',
            summary: {
                cadenceConfoundedComparisons: 0,
                failedComparisons: 0,
                failedInvariants: 0,
                passedComparisons: 0,
                passedInvariants: 0,
                comparisonPairCount: baselineConfirmation ? 4 : 2,
                primaryScreeningComparisons: 0,
                confirmationScreeningComparisons: 0,
                replicationScreeningComparisons: [],
                reproducedRegressions: 0,
                scenarioRunCount: 0,
                screeningComparisons: 0,
                skippedMetrics: 0,
                totalComparisons: 0,
                totalInvariants: 0,
                unresolvedReplications: 0,
            },
            validationErrors,
        };
    }

    const comparisonMaps = comparisonPairs.map(({ comparison, label }) => ({
        label,
        results: new Map(
            comparison.comparisons.map((result) => [metricKey(result), result]),
        ),
    }));
    const comparisonKeys = [
        ...new Set(
            comparisonMaps.flatMap(({ results }) => [...results.keys()]),
        ),
    ].sort();
    const comparisons = comparisonKeys.map((key) => {
        const results = comparisonMaps.map(({ label, results }) => ({
            label,
            result: results.get(key) ?? null,
        }));
        const template = results.find(({ result }) => result)?.result;
        const primaryResult = results[0].result;
        const confirmationResult = results[1].result;
        const replications = results.map(({ label, result }) =>
            result
                ? {
                      available: true,
                      baselineMedian: result.baselineMedian,
                      candidateMedian: result.candidateMedian,
                      decisionStatus: result.decisionStatus,
                      gateBasis: result.gateBasis,
                      individual: result.individual,
                      label,
                      medianDelta: result.medianDelta,
                      medianRatio: result.medianRatio,
                      medianWorsening: result.medianWorsening,
                      observedRegressionBreach:
                          result.baselineRelativeRegressionBreach ??
                          result.regressionBreach,
                      observedScreeningBreach:
                          result.baselineRelativeScreeningBreach ??
                          result.screeningBreach,
                      regressionBreach: result.regressionBreach,
                      screeningBreach: result.screeningBreach,
                  }
                : { available: false, label },
        );
        const availableReplications = replications.filter(
            (replication) => replication.available,
        );
        const screeningBreach = availableReplications.some(
            (replication) => replication.screeningBreach,
        );
        const everyRawRunGate = template.everyRawRunGate === true;
        const replicationIncomplete = everyRawRunGate
            ? availableReplications.length !== comparisonPairs.length
            : screeningBreach &&
              availableReplications.length !== comparisonPairs.length;
        const reproducedRegression = everyRawRunGate
            ? availableReplications.some(
                  (replication) => replication.regressionBreach,
              )
            : availableReplications.length === comparisonPairs.length &&
              availableReplications.every(
                  (replication) => replication.screeningBreach,
              );
        return {
            ...template,
            baselineConfirmationMedian:
                results[2]?.result?.baselineMedian ?? null,
            baselineMedian:
                primaryResult?.baselineMedian ?? template.baselineMedian,
            candidateMedian:
                primaryResult?.candidateMedian ?? template.candidateMedian,
            confirmation: confirmationResult
                ? {
                      candidateMedian: confirmationResult.candidateMedian,
                      individual: confirmationResult.individual,
                      medianDelta: confirmationResult.medianDelta,
                      medianRatio: confirmationResult.medianRatio,
                      medianWorsening: confirmationResult.medianWorsening,
                      regressionBreach: confirmationResult.regressionBreach,
                      screeningBreach: confirmationResult.screeningBreach,
                  }
                : null,
            confirmationScreeningBreach:
                confirmationResult?.screeningBreach ?? null,
            individual: primaryResult?.individual ?? template.individual,
            pass: !reproducedRegression && !replicationIncomplete,
            primaryRegressionBreach: primaryResult?.regressionBreach ?? null,
            primaryScreeningBreach: primaryResult?.screeningBreach ?? null,
            regressionBreach: reproducedRegression,
            replicationIncomplete,
            replications,
            reproducedRegression,
            screeningBreach,
        };
    });

    const invariantMaps = comparisonPairs.map(({ comparison, label }) => ({
        label,
        results: new Map(
            comparison.invariants.map((result) => [
                invariantKey(result),
                result,
            ]),
        ),
    }));
    const invariantKeys = [
        ...new Set(invariantMaps.flatMap(({ results }) => [...results.keys()])),
    ].sort();
    const invariants = invariantKeys.map((key) => {
        const results = invariantMaps.map(({ label, results }) => ({
            label,
            result: results.get(key) ?? null,
        }));
        const template = results.find(({ result }) => result)?.result;
        const primaryResult = results[0].result;
        const confirmationResult = results[1].result;
        return {
            ...template,
            confirmationCandidate: confirmationResult?.candidate ?? null,
            confirmationPass: confirmationResult?.pass ?? false,
            pass:
                results.every(({ result }) => result?.pass === true) &&
                results.length === comparisonPairs.length,
            primaryCandidate: primaryResult?.candidate ?? null,
            primaryPass: primaryResult?.pass ?? false,
            replications: results.map(({ label, result }) => ({
                available: Boolean(result),
                candidate: result?.candidate ?? null,
                label,
                pass: result?.pass ?? false,
            })),
        };
    });
    const failedComparisons = comparisons.filter(
        (result) => result.regressionBreach,
    );
    const failedInvariants = invariants.filter((result) => !result.pass);
    const screeningComparisons = comparisons.filter(
        (result) => result.screeningBreach,
    );
    const unresolvedReplications = comparisons.filter(
        (result) => result.replicationIncomplete,
    );
    const status =
        failedComparisons.length > 0 || failedInvariants.length > 0
            ? 'regression'
            : unresolvedReplications.length > 0
              ? 'needs-rerun'
              : 'pass';
    const skipped = comparisonPairs.flatMap(({ comparison, label }) =>
        comparison.skipped.map((result) => ({
            ...result,
            capture: label,
        })),
    );

    return {
        ...primary,
        baselineConfirmation: reportCapture(
            baselineConfirmation,
            baselineConfirmationPath,
            baselineSchedulerContract,
        ),
        baselineConfirmationUsed: Boolean(baselineConfirmation),
        comparisons,
        confirmation: reportCapture(
            confirmation,
            confirmationPath,
            canonicalSchedulerBaselineContract,
        ),
        confirmationUsed: true,
        exitCode: status === 'pass' ? 0 : 1,
        invariants,
        schemaVersion: comparisonReportSchemaVersion,
        skipped,
        status,
        summary: {
            cadenceConfoundedComparisons: comparisons.filter(
                (result) => result.gateBasis === 'cadence-confounded',
            ).length,
            failedComparisons: failedComparisons.length,
            failedInvariants: failedInvariants.length,
            passedComparisons: comparisons.filter((result) => result.pass)
                .length,
            passedInvariants: invariants.length - failedInvariants.length,
            comparisonPairCount: comparisonPairs.length,
            primaryScreeningComparisons: primary.summary.screeningComparisons,
            confirmationScreeningComparisons:
                repeated.summary.screeningComparisons,
            replicationScreeningComparisons: comparisonPairs.map(
                ({ comparison, label }) => ({
                    count: comparison.summary.screeningComparisons,
                    label,
                }),
            ),
            reproducedRegressions: failedComparisons.length,
            scenarioRunCount: primary.summary.scenarioRunCount,
            screeningComparisons: screeningComparisons.length,
            skippedMetrics: skipped.length,
            totalComparisons: comparisons.length,
            totalInvariants: invariants.length,
            unresolvedReplications: unresolvedReplications.length,
        },
        validationErrors: [],
    };
}

function display(value) {
    if (value === Number.POSITIVE_INFINITY) {
        return 'infinity';
    }
    return value ?? 'n/a';
}

function buildMarkdown(comparison) {
    const lines = [
        '# Game Profile Cross-Report Comparison',
        '',
        `Generated: ${comparison.generatedAt}`,
        `Status: **${comparison.status}**`,
        `Comparison schema: ${comparison.schemaVersion}`,
        `Comparison contract: ${comparison.comparisonContractVersion}`,
        `Diagnostic only: ${comparison.diagnostic ? `yes (${comparison.diagnosticReasons.join('; ')})` : 'no'}`,
        `Comparable: ${comparison.comparable ? 'yes' : 'no'}`,
        `Baseline subject: ${comparison.baseline.subjectCommit ?? 'unknown'}`,
        `Baseline scheduler contract: ${comparison.baseline.schedulerContract ?? canonicalSchedulerBaselineContract}`,
        `Candidate subject: ${comparison.candidate.subjectCommit ?? 'unknown'}`,
        `Candidate scheduler contract: ${comparison.candidate.schedulerContract ?? canonicalSchedulerBaselineContract}`,
        `Baseline harness: ${comparison.baseline.harnessCommit ?? 'unknown'}`,
        `Candidate harness: ${comparison.candidate.harnessCommit ?? 'unknown'}`,
    ];
    if (comparison.confirmationUsed) {
        lines.push(
            `Confirmation subject: ${comparison.confirmation.subjectCommit ?? 'unknown'}`,
            `Confirmation scheduler contract: ${comparison.confirmation.schedulerContract ?? canonicalSchedulerBaselineContract}`,
            `Confirmation harness: ${comparison.confirmation.harnessCommit ?? 'unknown'}`,
        );
    }
    if (comparison.baselineConfirmationUsed) {
        lines.push(
            `Baseline confirmation subject: ${comparison.baselineConfirmation.subjectCommit ?? 'unknown'}`,
            `Baseline confirmation scheduler contract: ${comparison.baselineConfirmation.schedulerContract ?? canonicalSchedulerBaselineContract}`,
            `Baseline confirmation harness: ${comparison.baselineConfirmation.harnessCommit ?? 'unknown'}`,
        );
    }
    lines.push(
        '',
        '## Summary',
        '',
        `Scenario runs: ${comparison.summary.scenarioRunCount}; comparison pairs: ${comparison.summary.comparisonPairCount ?? 1}; comparisons: ${comparison.summary.passedComparisons}/${comparison.summary.totalComparisons} passed; cadence-confounded GPU diagnostics: ${comparison.summary.cadenceConfoundedComparisons ?? 0}; screening signals: ${comparison.summary.screeningComparisons}; reproduced regressions: ${comparison.summary.reproducedRegressions ?? comparison.summary.failedComparisons}; unresolved replications: ${comparison.summary.unresolvedReplications ?? 0}; invariants: ${comparison.summary.passedInvariants}/${comparison.summary.totalInvariants} passed; skipped metrics: ${comparison.summary.skippedMetrics}.`,
    );

    if (comparison.validationErrors.length > 0) {
        lines.push('', '## Invalid comparison', '');
        for (const error of comparison.validationErrors) {
            lines.push(`- ${error}`);
        }
    }

    if (comparison.comparisons.length > 0) {
        lines.push('', '## Metric gates', '');
        if (comparison.baselineConfirmationUsed) {
            lines.push(
                '| Scenario | Phase | Metric | Baseline 1 median | Baseline 2 median | Candidate 1 median | Candidate 2 median | Gate | Result |',
                '| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
            );
        } else if (comparison.confirmationUsed) {
            lines.push(
                '| Scenario | Phase | Metric | Baseline median | Candidate median | Confirmation median | Candidate delta | Confirmation delta | Gate | Result |',
                '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
            );
        } else {
            lines.push(
                '| Scenario | Phase | Metric | Baseline median | Candidate median | Delta | Gate | Result |',
                '| --- | --- | --- | ---: | ---: | ---: | --- | --- |',
            );
        }
        for (const result of comparison.comparisons) {
            const delta =
                result.kind === 'ratio'
                    ? `${display(result.medianRatio)}x`
                    : `${display(result.medianDelta)} ${result.unit}`;
            const confirmationDelta = result.confirmation
                ? result.kind === 'ratio'
                    ? `${display(result.confirmation.medianRatio)}x`
                    : `${display(result.confirmation.medianDelta)} ${result.unit}`
                : null;
            const gate =
                result.gateBasis === 'cadence-confounded'
                    ? `not comparable: cadence-confounded; raw ${result.medianLimit}x / ${result.medianAbsoluteTolerance} ${result.unit} observation retained; gated by ${result.gatedBy}`
                    : result.targetAwareMaximum
                      ? `candidate <= ${result.maximumCandidateValue} ${result.unit} under declared ${result.targetFramesPerSecond} fps target; every raw run; baseline-relative ratio diagnostic only`
                      : result.targetAwareRenderedFps
                        ? result.maximumRenderedFps === null
                            ? `candidate >= ${result.minimumRenderedFps} ${result.unit} (target ${result.targetFramesPerSecond} ${result.unit}, ${result.targetToleranceFramesPerSecond} ${result.unit} tolerance); baseline-relative ratio diagnostic only`
                            : `candidate ${result.minimumRenderedFps}-${result.maximumRenderedFps} ${result.unit} around declared ${result.targetFramesPerSecond} ${result.unit} target; every raw run; baseline-relative ratio diagnostic only`
                        : result.diagnosticOnly
                          ? `diagnostic only; gated by ${result.gatedBy}`
                          : result.kind === 'ratio'
                            ? `${result.direction === 'minimum' ? '>=' : '<='} ${result.medianLimit}x screen; ${result.medianAbsoluteTolerance} ${result.unit} practical floor; repeat required`
                            : `median <= +${result.maximumIncrease} ${result.unit}; repeat required`;
            const resultLabel =
                result.decisionStatus === 'not-comparable'
                    ? 'not comparable (cadence-confounded)'
                    : result.regressionBreach
                      ? 'fail'
                      : result.replicationIncomplete
                        ? 'needs rerun'
                        : result.screeningBreach
                          ? comparison.confirmationUsed
                              ? 'pass (not reproduced)'
                              : 'needs rerun'
                          : 'pass';
            if (comparison.baselineConfirmationUsed) {
                lines.push(
                    `| ${result.scenario} | ${result.phase} | ${result.label} | ${display(result.baselineMedian)} | ${display(result.baselineConfirmationMedian)} | ${display(result.candidateMedian)} | ${display(result.confirmation?.candidateMedian)} | ${gate} | ${resultLabel} |`,
                );
            } else if (comparison.confirmationUsed) {
                lines.push(
                    `| ${result.scenario} | ${result.phase} | ${result.label} | ${display(result.baselineMedian)} | ${display(result.candidateMedian)} | ${display(result.confirmation?.candidateMedian)} | ${delta} | ${confirmationDelta ?? 'n/a'} | ${gate} | ${resultLabel} |`,
                );
            } else {
                lines.push(
                    `| ${result.scenario} | ${result.phase} | ${result.label} | ${display(result.baselineMedian)} | ${display(result.candidateMedian)} | ${delta} | ${gate} | ${resultLabel} |`,
                );
            }
        }
    }

    const cadenceConfoundedGpu = comparison.comparisons.filter(
        (result) =>
            result.id === 'gpu.p95_ms' &&
            result.gateBasis === 'cadence-confounded',
    );
    if (cadenceConfoundedGpu.length > 0) {
        lines.push(
            '',
            '## Cadence-confounded GPU diagnostics',
            '',
            'These camera-motion GPU p95 observations are retained but do not decide the result. The mapped same-tier steady row remains the decisive GPU gate.',
            '',
            '| Scenario | Legacy motion median FPS | Canonical motion median FPS | Raw GPU p95 ratio | Raw threshold observation | Mapped steady control | GPU mean median (baseline / candidate) | GPU occupancy median (baseline / candidate) |',
            '| --- | ---: | ---: | ---: | --- | --- | ---: | ---: |',
        );
        for (const result of cadenceConfoundedGpu) {
            const diagnostics = result.gpuTimingDiagnostics ?? {};
            lines.push(
                `| ${result.scenario} | ${display(result.cadence?.baselineMedian)} | ${display(result.cadence?.candidateMedian)} | ${display(result.medianRatio)}x | ${result.rawThresholdObservation?.regressionBreach ? 'breach' : result.rawThresholdObservation?.screeningBreach ? 'screen' : 'within threshold'} | ${result.controlScenario ?? 'missing'} | ${display(diagnostics.baselineElapsedMeanMedianMs)} / ${display(diagnostics.candidateElapsedMeanMedianMs)} ms | ${display(diagnostics.baselineElapsedOccupancyMedianPercent)} / ${display(diagnostics.candidateElapsedOccupancyMedianPercent)} % |`,
            );
        }
    }

    const failures = comparison.comparisons.filter(
        (result) => result.regressionBreach,
    );
    const screeningSignals = comparison.comparisons.filter(
        (result) => result.screeningBreach && !result.regressionBreach,
    );
    const invariantFailures = comparison.invariants.filter(
        (result) => !result.pass,
    );
    if (failures.length > 0 || invariantFailures.length > 0) {
        lines.push('', '## Regressions', '');
        for (const failure of failures) {
            const replications = failure.replications ?? [];
            const replicationSummary = replications
                .map((replication) => {
                    if (!replication.available) {
                        return `${replication.label}: unavailable`;
                    }
                    const value =
                        failure.kind === 'ratio'
                            ? `${display(replication.medianRatio)}x`
                            : `${display(replication.medianDelta)} ${failure.unit}`;
                    return `${replication.label}: ${value}`;
                })
                .join('; ');
            const failedRanks = failure.individual
                .filter((run) => !run.pass)
                .map((run) => run.sampleRank)
                .join(', ');
            const failedRankLabel = failure.rawRanksDiagnosticOnly
                ? 'diagnostic primary rank breaches'
                : 'decisive primary raw-run breaches';
            lines.push(
                `- ${failure.scenario} / ${failure.phase} / ${failure.id}: ${replicationSummary || `median ${failure.kind === 'ratio' ? `${display(failure.medianRatio)}x` : display(failure.medianDelta)}`}${failedRanks ? `; ${failedRankLabel} ${failedRanks}` : ''}`,
            );
        }
        for (const failure of invariantFailures) {
            const failingReplications = failure.replications
                ?.filter((replication) => !replication.pass)
                .map((replication) => replication.label)
                .join(', ');
            lines.push(
                `- ${failure.scenario} / ${failure.phase} / run ${failure.profileRun} / ${failure.field}: ${display(failure.candidate)} (expected ${display(failure.expected)})${failingReplications ? `; failed in ${failingReplications}` : ''}`,
            );
        }
    }

    if (screeningSignals.length > 0) {
        lines.push(
            '',
            comparison.confirmationUsed
                ? '## Non-reproduced or incomplete screening signals'
                : '## Screening signals requiring an independent repeat',
            '',
        );
        for (const signal of screeningSignals) {
            const replicationSummary = signal.replications
                ?.map((replication) => {
                    if (!replication.available) {
                        return `${replication.label}: unavailable`;
                    }
                    const value =
                        signal.kind === 'ratio'
                            ? `${display(replication.medianRatio)}x`
                            : `${display(replication.medianDelta)} ${signal.unit}`;
                    return `${replication.label}: ${value}`;
                })
                .join('; ');
            lines.push(
                `- ${signal.scenario} / ${signal.phase} / ${signal.id}: ${replicationSummary || `candidate ${signal.kind === 'ratio' ? `${display(signal.medianRatio)}x` : display(signal.medianDelta)}${signal.confirmation ? `; confirmation ${signal.kind === 'ratio' ? `${display(signal.confirmation.medianRatio)}x` : display(signal.confirmation.medianDelta)}` : ''}`}`,
            );
        }
    }

    const rankDiagnostics = comparison.comparisons.filter((result) => {
        const replications = result.replications ?? [
            { available: true, individual: result.individual },
            ...(result.confirmation
                ? [
                      {
                          available: true,
                          individual: result.confirmation.individual,
                      },
                  ]
                : []),
        ];
        return replications.some(
            (replication) =>
                replication.available &&
                replication.individual?.some((run) => !run.pass),
        );
    });
    if (rankDiagnostics.length > 0) {
        const hasDecisiveRawRunFailure = rankDiagnostics.some(
            (result) => result.rawRanksDiagnosticOnly === false,
        );
        lines.push(
            '',
            hasDecisiveRawRunFailure
                ? '## Raw-run gate evidence'
                : '## Raw-rank diagnostics',
            '',
        );
        for (const result of rankDiagnostics) {
            const replications = result.replications ?? [
                {
                    available: true,
                    individual: result.individual,
                    label: 'candidate',
                },
                ...(result.confirmation
                    ? [
                          {
                              available: true,
                              individual: result.confirmation.individual,
                              label: 'confirmation',
                          },
                      ]
                    : []),
            ];
            const rankSummary = replications
                .map((replication) => {
                    if (!replication.available) {
                        return `${replication.label}: unavailable`;
                    }
                    const gate = result.targetAwareMaximum
                        ? `candidate <= ${result.maximumCandidateValue} ${result.unit}`
                        : result.targetAwareRenderedFps
                          ? result.maximumRenderedFps === null
                              ? `candidate >= ${result.minimumRenderedFps} ${result.unit}`
                              : `candidate ${result.minimumRenderedFps}-${result.maximumRenderedFps} ${result.unit}`
                          : 'raw rank is diagnostic';
                    const ranks = replication.individual
                        .filter((run) => !run.pass)
                        .map(
                            (run) =>
                                `rank ${run.sampleRank} (baseline run ${run.baselineProfileRun} = ${display(run.baseline)} ${result.unit}; candidate run ${run.candidateProfileRun} = ${display(run.candidate)} ${result.unit}; ${gate})`,
                        )
                        .join(', ');
                    return `${replication.label}: ${ranks || 'none'}`;
                })
                .join('; ');
            lines.push(
                `- ${result.scenario} / ${result.phase} / ${result.id}: ${rankSummary}`,
            );
        }
    }

    if (comparison.skipped.length > 0) {
        lines.push('', '## Skipped metrics', '');
        for (const skipped of comparison.skipped) {
            lines.push(
                `- ${skipped.capture ? `${skipped.capture} / ` : ''}${skipped.scenario} / ${skipped.phase} / ${skipped.metric}: ${skipped.reason}`,
            );
        }
    }

    return `${lines.join('\n')}\n`;
}

async function writeFileAtomically(path, contents) {
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporaryPath, contents, { flag: 'wx' });
        await rename(temporaryPath, path);
    } finally {
        await rm(temporaryPath, { force: true });
    }
}

async function writeComparisonReports(
    comparison,
    outDir,
    { inputPaths = [] } = {},
) {
    const stamp = comparison.generatedAt.replaceAll(/[:.]/g, '-');
    const json = `${JSON.stringify(comparison, null, 2)}\n`;
    const markdown = buildMarkdown(comparison);
    await mkdir(outDir, { recursive: true });
    const canonicalOutDir = await realpath(outDir);
    const canonicalInputPaths = await Promise.all(
        inputPaths.map((inputPath) => realpath(inputPath)),
    );
    for (const inputPath of canonicalInputPaths) {
        if (dirname(inputPath) === canonicalOutDir) {
            throw new Error(
                `Comparison output directory must not contain an input report: ${inputPath}`,
            );
        }
    }
    const stampedJsonPath = resolve(canonicalOutDir, `${stamp}.json`);
    const stampedMarkdownPath = resolve(canonicalOutDir, `${stamp}.md`);
    const jsonPath = resolve(canonicalOutDir, 'latest.json');
    const markdownPath = resolve(canonicalOutDir, 'latest.md');
    await Promise.all([
        writeFileAtomically(stampedJsonPath, json),
        writeFileAtomically(stampedMarkdownPath, markdown),
        writeFileAtomically(jsonPath, json),
        writeFileAtomically(markdownPath, markdown),
    ]);
    return {
        jsonPath,
        markdownPath,
    };
}

function parseArgs(args) {
    const options = {
        allowPartial: false,
        allowSameSource: false,
        baselineConfirmationPath: null,
        baselinePath: null,
        baselineSchedulerContract: canonicalSchedulerBaselineContract,
        candidatePath: null,
        confirmationPath: null,
        help: false,
        outDir: process.env.GAME_PROFILE_COMPARE_OUT_DIR
            ? resolve(process.env.GAME_PROFILE_COMPARE_OUT_DIR)
            : defaultOutDir,
    };
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        const next = () => {
            index += 1;
            if (index >= args.length) {
                throw new Error(`${argument} requires a value`);
            }
            return args[index];
        };
        if (argument === '--allow-partial') {
            options.allowPartial = true;
        } else if (argument === '--allow-same-source') {
            options.allowSameSource = true;
        } else if (argument === '--baseline') {
            options.baselinePath = resolve(next());
        } else if (argument === '--baseline-confirmation') {
            options.baselineConfirmationPath = resolve(next());
        } else if (argument === '--baseline-scheduler-contract') {
            options.baselineSchedulerContract = next();
        } else if (argument === '--candidate') {
            options.candidatePath = resolve(next());
        } else if (argument === '--confirmation') {
            options.confirmationPath = resolve(next());
        } else if (argument === '--out-dir') {
            options.outDir = resolve(next());
        } else if (argument === '--help' || argument === '-h') {
            options.help = true;
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option: ${argument}`);
        } else {
            positional.push(argument);
        }
    }
    options.baselinePath ??= positional[0] ? resolve(positional[0]) : null;
    options.candidatePath ??= positional[1] ? resolve(positional[1]) : null;
    if (positional.length > 2) {
        throw new Error('Expected at most two positional report paths');
    }
    if (!schedulerBaselineContracts.has(options.baselineSchedulerContract)) {
        throw new Error(
            `Unsupported baseline scheduler contract: ${options.baselineSchedulerContract}`,
        );
    }
    if (
        options.baselineSchedulerContract ===
            legacyHeartbeatSchedulerBaselineContract &&
        (options.allowPartial || options.allowSameSource)
    ) {
        throw new Error(
            'The legacy heartbeat scheduler baseline contract cannot be combined with --allow-partial or --allow-same-source',
        );
    }
    if (!options.help && (!options.baselinePath || !options.candidatePath)) {
        throw new Error(
            'Both baseline and candidate report paths are required',
        );
    }
    if (
        !options.help &&
        options.baselineConfirmationPath &&
        !options.confirmationPath
    ) {
        throw new Error(
            '--baseline-confirmation requires --confirmation for a symmetric 2x2 gate',
        );
    }
    if (
        !options.help &&
        !options.allowPartial &&
        !options.allowSameSource &&
        (!options.baselineConfirmationPath || !options.confirmationPath)
    ) {
        throw new Error(
            'A non-diagnostic comparison requires both --baseline-confirmation and --confirmation for a symmetric 2x2 gate',
        );
    }
    return options;
}

function printHelp() {
    console.log(`Usage: node scripts/compare-game-profile-reports.mjs [options] <baseline.json> <candidate.json>

Options:
  --baseline <path>       Baseline schema-v6 profile report
  --baseline-confirmation <path>
                          Independent repeat of the exact baseline commit
  --baseline-scheduler-contract <contract>
                          canonical-v1 (default) or legacy-heartbeat-v1
  --candidate <path>      Candidate schema-v6 profile report
  --confirmation <path>   Independent repeat of the exact candidate commit
  --out-dir <path>        Comparison report directory
  --allow-partial         Permit a noncanonical scenario manifest for diagnostics
  --allow-same-source     Permit same-commit diagnostic comparison
  --help                  Show this help

Non-diagnostic comparisons require both confirmation options.`);
}

async function readJson(path) {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
        throw new Error(
            `Unable to read JSON report ${path}: ${error.message}`,
            {
                cause: error,
            },
        );
    }
}

async function runCli(args = process.argv.slice(2)) {
    let options;
    try {
        options = parseArgs(args);
    } catch (error) {
        console.error(error.message);
        return 2;
    }
    if (options.help) {
        printHelp();
        return 0;
    }

    let baseline;
    let baselineConfirmation;
    let candidate;
    let confirmation;
    try {
        [baseline, baselineConfirmation, candidate, confirmation] =
            await Promise.all([
                readJson(options.baselinePath),
                options.baselineConfirmationPath
                    ? readJson(options.baselineConfirmationPath)
                    : Promise.resolve(null),
                readJson(options.candidatePath),
                options.confirmationPath
                    ? readJson(options.confirmationPath)
                    : Promise.resolve(null),
            ]);
    } catch (error) {
        console.error(error.message);
        return 2;
    }
    try {
        const comparison = confirmation
            ? compareConfirmedReports(baseline, candidate, confirmation, {
                  ...options,
                  baselineConfirmation,
              })
            : compareReports(baseline, candidate, options);
        const paths = await writeComparisonReports(comparison, options.outDir, {
            inputPaths: [
                options.baselinePath,
                ...(options.baselineConfirmationPath
                    ? [options.baselineConfirmationPath]
                    : []),
                options.candidatePath,
                ...(options.confirmationPath ? [options.confirmationPath] : []),
            ],
        });
        console.log(`Wrote ${paths.markdownPath}`);
        console.log(`Comparison status: ${comparison.status}`);
        for (const error of comparison.validationErrors) {
            console.error(error);
        }
        return comparison.exitCode;
    } catch (error) {
        console.error(
            error instanceof Error ? error.message : 'Comparison failed',
        );
        return 2;
    }
}

export {
    buildCrossTierCheckNameInventory,
    buildMarkdown,
    compareConfirmedReports,
    compareReports,
    comparisonContractVersion,
    parseArgs,
    profileSchemaVersion,
    runCli,
    writeComparisonReports,
};

const invokedModuleUrl = process.argv[1]
    ? pathToFileURL(resolve(process.argv[1])).href
    : null;
if (import.meta.url === invokedModuleUrl) {
    process.exitCode = await runCli();
}
