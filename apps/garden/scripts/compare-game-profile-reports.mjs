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

const comparisonContractVersion = 1;
const profileSchemaVersion = 6;
const defaultOutDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'test-results/game-profile/comparisons',
);
const commitPattern = /^[0-9a-f]{40}$/;
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
        id: 'memory.js_heap_mb',
        label: 'JavaScript heap',
        direction: 'maximum',
        medianAbsoluteTolerance: 8,
        medianLimit: 1.15,
        runAbsoluteTolerance: 16,
        runLimit: 1.3,
        read: ({ cdp, sample }) => cdp?.jsHeapMb ?? sample?.jsHeapMb,
        unit: 'MiB',
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

function validateExactValue(errors, value, expected, path) {
    if (canonicalJson(value) !== canonicalJson(expected)) {
        errors.push(
            `${path} must be ${canonicalJson(expected)}; received ${canonicalJson(value)}`,
        );
    }
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

function validateCanonicalScenarioEvidence(errors, scenario, label, key) {
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
    }

    if (scenario.baseName === 'game-high-target-runtime-lifecycle-desktop') {
        validatePositiveNumber(
            errors,
            runtime.browserDpr,
            `${path} runtime.browserDpr`,
        );
        for (const [phaseName, fixture] of [
            ['cold', scenario.lifecycle?.cold?.fixture],
            [
                'context-restored',
                scenario.lifecycle?.context?.restoredControl?.fixture,
            ],
        ]) {
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

function validateReport(report, label, { allowPartial = false } = {}) {
    const errors = [];
    if (!isRecord(report)) {
        return [`${label} report is not an object`];
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
            'managedServer',
            'screenshots',
        ]) {
            if (typeof options[field] !== 'boolean') {
                errors.push(`${label}.options.${field} must be a boolean`);
            }
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
        if (isRecord(subject) && harness.commit !== subject.commit) {
            errors.push(
                `${label}.provenance.harness.commit must match the served-build subject commit`,
            );
        }
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
        if (!allowPartial) {
            validateCanonicalScenarioEvidence(errors, scenario, label, key);
        }
        if (scenario.acceptance?.pass !== true) {
            errors.push(`${label} scenario ${key} acceptance.pass is not true`);
        }
        validatePassingChecks(
            errors,
            scenario.budget,
            `${label} scenario ${key} budget`,
        );
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
    const available =
        gpu?.supported === true &&
        gpu?.valid === true &&
        gpu?.complete === true &&
        gpu?.disjoint === false &&
        Number.isInteger(gpu?.sampleCount) &&
        gpu.sampleCount > 0 &&
        isFiniteNumber(gpu.elapsedP95Ms) &&
        gpu.elapsedP95Ms > 0;
    if (available) {
        return { available: true, value: gpu.elapsedP95Ms };
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

function samplePhases(scenario) {
    if (scenario.requested?.lifecycleProfile === true) {
        return [
            {
                cdp: scenario.lifecycle?.active?.cdp ?? scenario.cdp,
                name: 'active',
                resources: scenario.lifecycle?.cold?.fixture?.resources,
                sample: scenario.lifecycle?.active?.sample ?? scenario.sample,
            },
            {
                cdp: scenario.lifecycle?.context?.restoredWindow?.cdp,
                name: 'context-restored',
                resources:
                    scenario.lifecycle?.context?.restoredControl?.fixture
                        ?.resources,
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
    { baselineSchemaVersion, candidateSchemaVersion },
) {
    const errors = [];
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
        requestedCompatibilitySignature(
            baseline.requested,
            baselineSchemaVersion,
        ),
        requestedCompatibilitySignature(
            candidate.requested,
            candidateSchemaVersion,
        ),
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

function comparePairedScenarios(pairs) {
    const comparisons = [];
    const errors = [];
    const invariants = [];
    const skipped = [];
    const sampleRows = [];
    const timingRows = [];

    for (const { baseline, candidate } of pairs) {
        const baseName = scenarioBaseName(baseline);
        const profileRun = scenarioRun(baseline);
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

    for (const group of groupRows(sampleRows)) {
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
                addMetricRows({
                    baselineValue: metric.read(row.baseline),
                    candidateValue: metric.read(row.candidate),
                    errors,
                    metricId: metric.id,
                    positiveRequired: true,
                    required:
                        ![
                            'cpu.script_duration_s',
                            'memory.js_heap_mb',
                        ].includes(metric.id) ||
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
                    ...buildRatioComparison({ ...metric, rows }),
                });
            }
        }

        const gpuRows = [];
        for (const row of group.rows) {
            const baselineGpu = gpuState(row.baseline.sample);
            const candidateGpu = gpuState(row.candidate.sample);
            if (
                baselineGpu.invalidAvailableValue ||
                candidateGpu.invalidAvailableValue
            ) {
                errors.push(
                    `${row.scenario} ${row.phase} GPU timing must be complete, non-disjoint, sampled, and positive when marked valid`,
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
                    candidate: candidateGpu.value,
                    phase: row.phase,
                    profileRun: row.profileRun,
                    scenario: row.scenario,
                });
            }
        }
        if (gpuRows.length > 0) {
            comparisons.push({
                phase: group.phase,
                scenario: group.scenario,
                ...buildRatioComparison({
                    direction: 'maximum',
                    id: 'gpu.p95_ms',
                    label: 'GPU p95 duration',
                    medianAbsoluteTolerance: 3,
                    medianLimit: 1.15,
                    rows: gpuRows,
                    runAbsoluteTolerance: 6,
                    runLimit: 1.4,
                    unit: 'ms',
                }),
            });
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
                    ...buildAbsoluteComparison({ ...metric, rows }),
                });
            }
        }
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
        baselinePath = null,
        candidatePath = null,
        confirmedMatrixMember = false,
    } = {},
) {
    const validationErrors = [
        ...validateReport(baseline, 'baseline', { allowPartial }),
        ...validateReport(candidate, 'candidate', { allowPartial }),
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
            pick(baseline.options, reportOptionFields),
            pick(candidate.options, reportOptionFields),
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
                            baselineSchemaVersion: baseline.schemaVersion,
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
        comparisonData = comparePairedScenarios(pairs);
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
            subjectCommit: baseline?.provenance?.subject?.commit ?? null,
        },
        candidate: {
            generatedAt: candidate?.generatedAt ?? null,
            harnessCommit: candidate?.provenance?.harness?.commit ?? null,
            path: candidatePath,
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
        schemaVersion: 2,
        skipped: comparable ? comparisonData.skipped : [],
        status,
        summary: {
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

function compareReports(baseline, candidate, options = {}) {
    return compareReportPair(baseline, candidate, {
        ...options,
        confirmedMatrixMember: false,
    });
}

function metricKey(result) {
    return `${result.scenario}::${result.phase}::${result.id}`;
}

function invariantKey(result) {
    return `${result.scenario}::${result.phase}::${result.profileRun}::${result.field}`;
}

function reportCapture(report, path) {
    return {
        generatedAt: report?.generatedAt ?? null,
        harnessCommit: report?.provenance?.harness?.commit ?? null,
        path,
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
        candidatePath = null,
        confirmationPath = null,
    } = {},
) {
    const sharedOptions = { allowPartial, allowSameSource, baselinePath };
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
              baselinePath,
              candidatePath: baselineConfirmationPath,
              confirmedMatrixMember: true,
          })
        : null;
    const baselineRepeatedPrimary = baselineConfirmation
        ? compareReportPair(baselineConfirmation, candidate, {
              allowPartial,
              allowSameSource,
              baselinePath: baselineConfirmationPath,
              candidatePath,
              confirmedMatrixMember: true,
          })
        : null;
    const baselineRepeatedConfirmation = baselineConfirmation
        ? compareReportPair(baselineConfirmation, confirmation, {
              allowPartial,
              allowSameSource,
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
    if (validationErrors.length > 0) {
        return {
            ...primary,
            baselineConfirmation: reportCapture(
                baselineConfirmation,
                baselineConfirmationPath,
            ),
            baselineConfirmationUsed: Boolean(baselineConfirmation),
            comparable: false,
            comparisons: [],
            confirmation: reportCapture(confirmation, confirmationPath),
            confirmationUsed: true,
            exitCode: 2,
            invariants: [],
            schemaVersion: 2,
            skipped: [],
            status: 'invalid',
            summary: {
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
                      individual: result.individual,
                      label,
                      medianDelta: result.medianDelta,
                      medianRatio: result.medianRatio,
                      medianWorsening: result.medianWorsening,
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
        const replicationIncomplete =
            screeningBreach &&
            availableReplications.length !== comparisonPairs.length;
        const reproducedRegression =
            availableReplications.length === comparisonPairs.length &&
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
        ),
        baselineConfirmationUsed: Boolean(baselineConfirmation),
        comparisons,
        confirmation: reportCapture(confirmation, confirmationPath),
        confirmationUsed: true,
        exitCode: status === 'pass' ? 0 : 1,
        invariants,
        schemaVersion: 2,
        skipped,
        status,
        summary: {
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
        `Diagnostic only: ${comparison.diagnostic ? `yes (${comparison.diagnosticReasons.join('; ')})` : 'no'}`,
        `Comparable: ${comparison.comparable ? 'yes' : 'no'}`,
        `Baseline subject: ${comparison.baseline.subjectCommit ?? 'unknown'}`,
        `Candidate subject: ${comparison.candidate.subjectCommit ?? 'unknown'}`,
        `Baseline harness: ${comparison.baseline.harnessCommit ?? 'unknown'}`,
        `Candidate harness: ${comparison.candidate.harnessCommit ?? 'unknown'}`,
    ];
    if (comparison.confirmationUsed) {
        lines.push(
            `Confirmation subject: ${comparison.confirmation.subjectCommit ?? 'unknown'}`,
            `Confirmation harness: ${comparison.confirmation.harnessCommit ?? 'unknown'}`,
        );
    }
    if (comparison.baselineConfirmationUsed) {
        lines.push(
            `Baseline confirmation subject: ${comparison.baselineConfirmation.subjectCommit ?? 'unknown'}`,
            `Baseline confirmation harness: ${comparison.baselineConfirmation.harnessCommit ?? 'unknown'}`,
        );
    }
    lines.push(
        '',
        '## Summary',
        '',
        `Scenario runs: ${comparison.summary.scenarioRunCount}; comparison pairs: ${comparison.summary.comparisonPairCount ?? 1}; comparisons: ${comparison.summary.passedComparisons}/${comparison.summary.totalComparisons} passed; screening signals: ${comparison.summary.screeningComparisons}; reproduced regressions: ${comparison.summary.reproducedRegressions ?? comparison.summary.failedComparisons}; unresolved replications: ${comparison.summary.unresolvedReplications ?? 0}; invariants: ${comparison.summary.passedInvariants}/${comparison.summary.totalInvariants} passed; skipped metrics: ${comparison.summary.skippedMetrics}.`,
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
                result.kind === 'ratio'
                    ? `${result.direction === 'minimum' ? '>=' : '<='} ${result.medianLimit}x screen; ${result.medianAbsoluteTolerance} ${result.unit} practical floor; repeat required`
                    : `median <= +${result.maximumIncrease} ${result.unit}; repeat required`;
            const resultLabel = result.regressionBreach
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
            lines.push(
                `- ${failure.scenario} / ${failure.phase} / ${failure.id}: ${replicationSummary || `median ${failure.kind === 'ratio' ? `${display(failure.medianRatio)}x` : display(failure.medianDelta)}`}${failedRanks ? `; diagnostic primary rank breaches ${failedRanks}` : ''}`,
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
        lines.push('', '## Raw-rank diagnostics', '');
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
                    const ranks = replication.individual
                        .filter((run) => !run.pass)
                        .map((run) => run.sampleRank)
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
