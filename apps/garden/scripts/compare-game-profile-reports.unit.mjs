import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
    buildMarkdown,
    compareConfirmedReports,
    compareReports,
    parseArgs,
    runCli,
    writeComparisonReports,
} from './compare-game-profile-reports.mjs';

const baselineCommit = '1'.repeat(40);
const candidateCommit = '2'.repeat(40);

function sample(overrides = {}) {
    return {
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
        trianglesPerRenderedFrame: 30_000,
        ...overrides,
    };
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

function normalScenario(profileRun, overrides = {}) {
    const baseName = 'game-high-target-clear-idle-desktop';
    return {
        acceptance: { pass: true },
        baseName,
        budgetName: 'gameHighTarget',
        canvasReadyMs: 480,
        cdp: { jsHeapMb: 64, scriptDuration: 0.8 },
        domContentLoadedMs: 22,
        environment: {
            renderer: 'ANGLE Metal Renderer',
            userAgent: 'Profile Browser/1',
            vendor: 'Profile Vendor',
        },
        name: `${baseName}-run-${profileRun}`,
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high',
        profileRun,
        requested: {
            controls: '0',
            details: '1',
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
        rendererTextures: 11,
    };
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
            sample: sample(),
        },
        cold: {
            canvasAttachedMs: 300,
            canvasSizedMs: 380,
            domContentLoadedMs: 20,
            firstSubmittedFrameMs: 490,
            fixture: {
                fixture,
                gardenId: scenario.runtime.profileGardenId,
                resources: phaseResources,
            },
            fixtureReadyMs: 580,
            interactionReadyMs: 870,
        },
        context: {
            restoredControl: {
                fixture: {
                    fixture,
                    gardenId: scenario.runtime.profileGardenId,
                    resources: phaseResources,
                },
            },
            restoredWindow: {
                cdp: { jsHeapMb: 64, scriptDuration: 0.9 },
                sample: sample({ renderedFps: 29 }),
            },
        },
        hidden: {
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

function gardenSwitchScenario(profileRun) {
    const scenario = normalScenario(profileRun);
    scenario.baseName = 'game-high-fauna-single-context-switch-desktop';
    scenario.name = `${scenario.baseName}-run-${profileRun}`;
    scenario.requested = {
        ...scenario.requested,
        gardenProfile: 'garden-switch',
        gardenSwitchProfile: true,
        motion: 'high-fauna-single-context-switch',
    };
    const arrival = (arrivalIndex, profile, timing) => ({
        arrivalIndex,
        fixture: {
            actorGroundingShadowDroppedCount: 0,
            blockCount: profile === 'high-target' ? 297 : 147,
            generatedPlantExpectedInstanceCount:
                profile === 'high-target' ? 537 : null,
            generatedPlantFieldCount: profile === 'high-target' ? 54 : 0,
            generatedPlantInstanceCount: profile === 'high-target' ? 537 : 0,
            generatedPlantVisibleFieldCount: profile === 'high-target' ? 54 : 0,
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
        sample: sample(),
        timing,
    });
    const switchTiming = {
        dispatched: true,
        displayedMs: 350,
        hiddenObserved: true,
        settledMs: 900,
        settleTargetMs: 500,
        visibleMs: 380,
    };
    scenario.gardenSwitch = {
        arrivals: [
            arrival(1, 'high-target', { initial: true }),
            arrival(2, 'fauna-heavy', { ...switchTiming }),
            arrival(3, 'high-target', { ...switchTiming }),
            arrival(4, 'fauna-heavy', { ...switchTiming }),
            arrival(5, 'high-target', { ...switchTiming }),
            arrival(6, 'fauna-heavy', { ...switchTiming }),
            arrival(7, 'high-target', { ...switchTiming }),
        ],
    };
    return scenario;
}

function report({ commit, scenarios, overrides = {} }) {
    return {
        comparisonContractVersion: 1,
        generatedAt: '2026-08-30T00:00:00.000Z',
        options: {
            allowLegacyOperationVisuals: false,
            build: true,
            closeupRepeat: null,
            closeupTimeoutMs: 30_000,
            graphicsBackend: 'angle-metal',
            managedServer: true,
            sampleMs: 5_000,
            scenarioSet: 'high-target',
            scenarios: [],
            screenshots: true,
            soakMs: 0,
            warmupMs: 5_000,
        },
        provenance: {
            comparable: true,
            harness: { commit, dirty: false },
            reasons: [],
            runtime: {
                arch: 'arm64',
                browserVersion: 'Chromium/140',
                nodeVersion: 'v24.15.0',
                platform: 'darwin',
            },
            server: { buildPerformed: true, mode: 'managed' },
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
                comparisonContractVersion: 1,
                dirty: false,
            },
        })),
        schemaVersion: 5,
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
    if (baseName.startsWith('game-cross-tier-')) {
        scenario.requested.crossTierProfile = true;
        scenario.requested.autoQualityDeviceClass = baseName.includes(
            'auto-constrained',
        )
            ? 'constrained'
            : baseName.includes('auto-standard')
              ? 'standard'
              : 'unspecified';
        scenario.requested.autoQualityMetrics = {
            coarsePointer: false,
            coreCount: 8,
            dpr: 2,
            memoryGb: 8,
            narrowViewport: false,
        };
        scenario.requested.expectedAutoQualityMetrics = baseName.includes(
            '-auto-',
        )
            ? structuredClone(scenario.requested.autoQualityMetrics)
            : null;
        scenario.requested.expectedDprCap = 2;
        scenario.requested.expectedGroundDecorationDensity = 1;
        scenario.requested.expectedQualityTier = 'high';
        scenario.requested.expectedShadowMapSize = 4_096;
        scenario.requested.expectedShadows = true;
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
    assert.equal(
        compareReports(complete.baseline, complete.candidate).status,
        'pass',
    );

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

test('valid schema-v5 reports compare raw runs and ignore scenario order', () => {
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
        comparison.comparisons.map((result) => result.id),
        [...comparison.comparisons.map((result) => result.id)].sort(),
    );
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
    assert.match(buildMarkdown(comparison), /candidate: 3/);
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
        scenario.cdp.jsHeapMb = values.heap;
        scenario.cdp.scriptDuration = values.script;
        scenario.runtime.rendererGeometries = values.geometry;
        scenario.sample.gpu = {
            complete: true,
            disjoint: false,
            elapsedP95Ms: values.gpu,
            sampleCount: 50,
            supported: true,
            valid: true,
        };
        scenario.sample.longTaskCount = values.longTask === 0 ? 0 : 1;
        scenario.sample.longTaskMaxMs = values.longTask;
        scenario.sample.longTaskTotalMs = values.longTask;
    }
    for (const [index, values] of candidateValues.entries()) {
        const scenario = candidate.scenarios[index];
        scenario.canvasReadyMs = values.canvas;
        scenario.domContentLoadedMs = values.dom;
        scenario.cdp.jsHeapMb = values.heap;
        scenario.cdp.scriptDuration = values.script;
        scenario.runtime.rendererGeometries = values.geometry;
        scenario.sample.gpu = {
            complete: true,
            disjoint: false,
            elapsedP95Ms: values.gpu,
            sampleCount: 50,
            supported: true,
            valid: true,
        };
        scenario.sample.longTaskCount = values.longTask === 0 ? 0 : 1;
        scenario.sample.longTaskMaxMs = values.longTask;
        scenario.sample.longTaskTotalMs = values.longTask;
    }

    const comparison = comparePartialReports(baseline, candidate);
    assert.equal(comparison.status, 'pass');
    assert.equal(comparison.summary.failedComparisons, 0);
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
                scenario.sample.gpu = {
                    complete: true,
                    disjoint: false,
                    elapsedP95Ms: 4,
                    sampleCount: 50,
                    supported: true,
                    valid: true,
                };
            }
            for (const report of [candidate, confirmation]) {
                for (const scenario of report.scenarios) {
                    scenario.sample.gpu = {
                        complete: true,
                        disjoint: false,
                        elapsedP95Ms: 10,
                        sampleCount: 50,
                        supported: true,
                        valid: true,
                    };
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

test('lifecycle active resources come from the cold fixture', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    for (const scenario of candidate.scenarios) {
        scenario.lifecycle.cold.fixture.resources.rendererGeometries += 2;
    }

    const comparison = comparePartialReports(baseline, candidate);
    const activeGeometries = comparison.comparisons.find(
        (result) =>
            result.id === 'resources.geometries' && result.phase === 'active',
    );
    assert.equal(activeGeometries.pass, false);
    assert.equal(comparison.exitCode, 1);
});

test('lifecycle restored fixture drift is incompatible', () => {
    const { baseline, candidate } = reportPair(lifecycleScenario);
    for (const scenario of candidate.scenarios) {
        scenario.lifecycle.context.restoredControl.fixture.fixture.blockCount += 1;
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
        scenario.gardenSwitch.arrivals[1].sample.jsHeapMb = 81;
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
                result.phase === 'arrival-2-fauna-heavy',
        ).pass,
        false,
    );
    assert.equal(comparison.exitCode, 1);
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
        'mismatched harness commit': ({ candidate }) => {
            candidate.provenance.harness.commit = baselineCommit;
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
            candidate.scenarios[0].servedBuildProvenance.comparisonContractVersion = 2;
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
    candidate.provenance.harness.commit = baselineCommit;
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

    candidate.scenarios[0].sample.gpu = {
        complete: true,
        disjoint: false,
        elapsedP95Ms: 4,
        sampleCount: 1,
        supported: true,
        valid: true,
    };
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
    assert.match(comparison.validationErrors.join('\n'), /must be complete/);

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
            /non-disjoint, sampled/,
        );
    }
});

test('available GPU p95 uses a practical median noise floor', () => {
    const { baseline, candidate } = reportPair();
    for (const scenario of baseline.scenarios) {
        scenario.sample.gpu = {
            complete: true,
            disjoint: false,
            elapsedP95Ms: 4,
            sampleCount: 1,
            supported: true,
            valid: true,
        };
    }
    for (const scenario of candidate.scenarios) {
        scenario.sample.gpu = {
            complete: true,
            disjoint: false,
            elapsedP95Ms: 11,
            sampleCount: 1,
            supported: true,
            valid: true,
        };
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
        '--candidate',
        'after.json',
        '--confirmation',
        'after-repeat.json',
    ]);
    assert.equal(named.baselinePath, resolve('before.json'));
    assert.equal(named.baselineConfirmationPath, resolve('before-repeat.json'));
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
        () => parseArgs(['--median-frame-limit', '1.5']),
        /Unknown option/,
    );
});

test('report writer emits stamped and latest JSON and Markdown files', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'game-compare-writer-'));
    try {
        const { baseline, candidate } = reportPair();
        const comparison = comparePartialReports(baseline, candidate);
        const paths = await writeComparisonReports(comparison, directory);
        const written = JSON.parse(await readFile(paths.jsonPath, 'utf8'));
        assert.equal(written.schemaVersion, 2);
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
        assert.equal(JSON.parse(before).schemaVersion, 5);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});
