import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildAdaptiveHighComparisons,
    buildHighTargetMedians,
    buildMarkdown,
    buildPlantCloseupAcceptance,
    buildPlantCloseupMedians,
    buildProfileSummary,
    drainProfileSample,
    evaluateBudget,
    evaluateHighTargetAcceptance,
    finalizeProfileSampleAtEndpoint,
    finishInteractiveProfileSample,
    getScenarioRequest,
    installBrowserMetrics,
    isOutlineProfileTelemetryReady,
    mergeProfileSampleDrain,
    normalizeRenderWork,
    parseArgs,
    resolveChromiumGraphicsArgs,
    resolveChromiumGraphicsBackend,
    resolveScenarios,
} from './profile-game-scene.mjs';

test('closeup acceptance rejects synchronous worker fallback', () => {
    const phase = (syncFallbackTaskCount) => ({
        detailOutcome: 'ready',
        profile: {
            lSystem: {
                syncFallbackTaskCount,
                workerFailureCount: 0,
            },
        },
    });
    const runs = [
        {
            closeup: {
                cold: phase(0),
                warm: phase(0),
            },
        },
    ];

    assert.equal(
        buildPlantCloseupAcceptance(runs).workerFailureFreePhaseCount,
        2,
    );
    runs[0].closeup.warm = phase(1);
    assert.equal(
        buildPlantCloseupAcceptance(runs).workerFailureFreePhaseCount,
        1,
    );
});

test('closeup acceptance requires the selected bed to exercise foliage', () => {
    const phase = (leaves) => ({
        detailOutcome: 'ready',
        profile: {
            selected: {
                parts: {
                    leaves,
                },
            },
        },
    });
    const runs = [
        {
            closeup: {
                cold: phase(120),
                warm: phase(120),
            },
        },
    ];

    assert.equal(buildPlantCloseupAcceptance(runs).foliageCoveredPhaseCount, 2);
    runs[0].closeup.warm = phase(0);
    assert.equal(buildPlantCloseupAcceptance(runs).foliageCoveredPhaseCount, 1);
});

test('closeup acceptance bounds archetypes for the grown foliage fixture', () => {
    const phase = (maxArchetypeCountPerBatch) => ({
        profile: {
            renderData: {
                maxArchetypeCountPerBatch,
            },
        },
    });
    const runs = [
        {
            closeup: {
                cold: phase(12),
                warm: phase(12),
            },
        },
    ];

    assert.equal(
        buildPlantCloseupAcceptance(runs).archetypeBoundedPhaseCount,
        2,
    );
    runs[0].closeup.warm = phase(13);
    assert.equal(
        buildPlantCloseupAcceptance(runs).archetypeBoundedPhaseCount,
        1,
    );
});

test('plant closeup scenario set resolves deterministic desktop and mobile runs', () => {
    const scenarios = resolveScenarios('plant-closeup');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        ['game-plant-heavy-closeup-desktop', 'game-plant-heavy-closeup-mobile'],
    );
    for (const scenario of scenarios) {
        assert.equal(scenario.plantCloseup.raisedBedId, 29);
        assert.equal(scenario.plantCloseup.repeat, 5);
        assert.match(scenario.path, /closeupRaisedBedId=29/);
        assert.match(scenario.path, /profile=plant-heavy/);
    }
});

test('profile request reads the deterministic closeup target', () => {
    const request = getScenarioRequest(
        '/debug/profile/game?profile=plant-heavy&quality=medium&closeupRaisedBedId=29',
    );

    assert.equal(request.closeupRaisedBedId, 29);
    assert.equal(request.gardenProfile, 'plant-heavy');
    assert.equal(request.quality, 'medium');
});

test('high target scenario set covers representative High DPR 2 phases', () => {
    const scenarios = resolveScenarios('high-target');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
            'game-high-target-clear-idle-desktop',
            'game-high-target-camera-motion-desktop',
            'game-high-target-hover-selection-desktop',
            'game-high-target-placement-desktop',
            'game-high-target-rain-desktop',
            'game-high-target-snow-desktop',
        ],
    );
    assert.deepEqual(
        scenarios.map((scenario) => getScenarioRequest(scenario.path).mode),
        ['details', 'details', 'details', 'details', 'rain', 'snow'],
    );
    for (const scenario of scenarios) {
        const request = getScenarioRequest(scenario.path);
        assert.equal(scenario.budget, 'gameHighTarget');
        assert.equal(scenario.dpr, 2);
        assert.equal(scenario.isMobile, false);
        assert.equal(request.blockGeometryMerging, '1');
        assert.equal(request.controls, '1');
        assert.equal(request.debugHud, '0');
        assert.equal(request.details, '1');
        assert.equal(request.gardenProfile, 'high-target');
        assert.equal(request.hud, '0');
        assert.equal(request.operationVisuals, '0');
        assert.equal(request.quality, 'high');
        assert.equal(scenario.repeat, 3);
    }
    assert.equal(scenarios[0].motion, undefined);
    assert.equal(scenarios[1].motion, 'pan-zoom-rotate');
    assert.equal(scenarios[2].interaction, 'hover-scan');
    assert.equal(scenarios[3].placementProfile.action, 'run');
    assert.equal(getScenarioRequest(scenarios[3].path).placement, '1');
});

test('operation-visual High scenario is isolated behind its own opt-in set', () => {
    const scenarios = resolveScenarios('high-target-operation-visuals');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    assert.equal(scenario.name, 'game-high-target-operation-visuals-desktop');
    assert.equal(scenario.budget, 'gameHighTarget');
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.isMobile, false);
    assert.equal(scenario.repeat, 3);
    assert.deepEqual(getScenarioRequest(scenario.path), {
        adaptiveHigh: '0',
        blockGeometryMerging: '1',
        closeupRaisedBedId: null,
        controls: '1',
        debugHud: '0',
        details: '1',
        gardenProfile: 'high-target',
        hud: '0',
        mode: 'details',
        operationVisuals: '1',
        outline: '0',
        placement: '0',
        quality: 'high',
    });
    assert.equal(
        resolveScenarios('high-target').some(
            (candidate) =>
                getScenarioRequest(candidate.path).operationVisuals === '1',
        ),
        false,
    );
});

test('outline scenario deterministically targets the connected raised bed after warmup', () => {
    const scenarios = resolveScenarios('outline');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    assert.equal(
        scenario.name,
        'game-high-target-connected-raised-bed-outline-desktop',
    );
    assert.deepEqual(scenario.outlineProfile, {
        action: 'show',
        raisedBedId: 2,
    });
    assert.equal(scenario.budget, 'gameHighTarget');
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.repeat, 3);
    const request = getScenarioRequest(scenario.path);
    assert.equal(request.gardenProfile, 'high-target');
    assert.equal(request.outline, '1');
    assert.equal(request.quality, 'high');
});

test('outline telemetry readiness requires the connected target and one style group', () => {
    assert.equal(isOutlineProfileTelemetryReady(null), false);
    assert.equal(
        isOutlineProfileTelemetryReady({
            hoverOutlineActiveTargetCount: 2,
        }),
        false,
    );
    assert.equal(
        isOutlineProfileTelemetryReady({
            hoverOutlineActiveTargetCount: 1,
            hoverOutlineStyleGroupCount: 1,
        }),
        false,
    );
    assert.equal(
        isOutlineProfileTelemetryReady({
            hoverOutlineActiveTargetCount: 2,
            hoverOutlineStyleGroupCount: 1,
        }),
        false,
    );
    assert.equal(
        isOutlineProfileTelemetryReady({
            hoverOutlineActiveTargetCount: 2,
            hoverOutlineProfileTargetBlockId: 'profile-raised-bed:2:0',
            hoverOutlineProfileTargetRaisedBedId: 2,
            hoverOutlineStyleGroupCount: 1,
        }),
        true,
    );
});

test('graphics backend auto-selects macOS Metal with an explicit portable override', () => {
    assert.equal(resolveChromiumGraphicsBackend('darwin'), 'angle-metal');
    assert.equal(resolveChromiumGraphicsBackend('linux'), 'default');
    assert.equal(
        resolveChromiumGraphicsBackend('darwin', 'default'),
        'default',
    );
    assert.equal(
        resolveChromiumGraphicsBackend('darwin', 'angle-metal'),
        'angle-metal',
    );
    assert.deepEqual(resolveChromiumGraphicsArgs('darwin', 'auto'), [
        '--use-gl=angle',
        '--use-angle=metal',
    ]);
    assert.deepEqual(resolveChromiumGraphicsArgs('darwin', 'default'), []);
    assert.deepEqual(resolveChromiumGraphicsArgs('linux', 'auto'), []);
    assert.deepEqual(resolveChromiumGraphicsArgs('win32', 'default'), []);
    assert.throws(
        () => resolveChromiumGraphicsBackend('linux', 'angle-metal'),
        /requires macOS/,
    );
});

test('graphics backend CLI overrides the portable auto default explicitly', () => {
    assert.equal(
        parseArgs(['--graphics-backend', 'default']).graphicsBackend,
        'default',
    );
    assert.equal(
        parseArgs(['--graphics-backend', 'angle-metal']).graphicsBackend,
        'angle-metal',
    );
    assert.throws(
        () => parseArgs(['--graphics-backend', 'unsupported']),
        /Graphics backend must be one of/,
    );
});

test('legacy operation visual profiling bypass is explicit', () => {
    assert.equal(parseArgs([]).allowLegacyOperationVisuals, false);
    assert.equal(
        parseArgs(['--allow-legacy-operation-visuals'])
            .allowLegacyOperationVisuals,
        true,
    );
});

test('adaptive High scenario set pairs fixed and adaptive motion and preserves runtime features', () => {
    const scenarios = resolveScenarios('adaptive-high');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
            'game-high-target-adaptive-pair-fixed-camera-motion-desktop',
            'game-high-target-adaptive-camera-motion-desktop',
            'game-high-target-adaptive-motion-recovery-desktop',
            'game-high-target-adaptive-runtime-gpu-source-desktop',
            'game-high-target-adaptive-placement-desktop',
            'game-high-target-adaptive-rain-desktop',
            'game-high-target-adaptive-snow-desktop',
            'game-high-target-adaptive-cloudy-desktop',
            'game-high-target-adaptive-windy-plants-desktop',
        ],
    );
    assert.equal(scenarios[0].motion, 'pan-zoom-rotate');
    assert.equal(scenarios[0].comparisonRole, 'fixed');
    assert.equal(scenarios[1].comparisonRole, 'adaptive');
    assert.equal(scenarios[1].profileControl, true);
    assert.equal(scenarios[2].motion, 'pan-zoom-rotate-then-idle');
    assert.equal(scenarios[2].motionMs, 650);
    assert.equal(scenarios[2].profileControl, true);
    assert.equal(scenarios[2].profileControlRecovery, true);
    assert.equal(scenarios[2].sampleMs, 7_500);
    assert.equal(scenarios[3].externalGpuTimer, false);
    assert.equal(scenarios[3].runtimeGpuSource, true);
    assert.equal(scenarios[4].placementProfile.action, 'run');
    assert.equal(scenarios[4].profileControl, true);
    assert.equal(getScenarioRequest(scenarios[4].path).placement, '1');
    assert.deepEqual(
        scenarios
            .slice(5)
            .map((scenario) => getScenarioRequest(scenario.path).mode),
        ['rain', 'snow', 'cloudy', 'windy'],
    );
    assert.equal(getScenarioRequest(scenarios[0].path).adaptiveHigh, '0');
    for (const scenario of scenarios.slice(1)) {
        const request = getScenarioRequest(scenario.path);
        assert.equal(request.adaptiveHigh, '1');
        assert.equal(request.gardenProfile, 'high-target');
        assert.equal(request.quality, 'high');
        assert.equal(scenario.dpr, 2);
        assert.equal(scenario.repeat, 3);
    }
    assert.equal(scenarios[0].repeat, 3);
});

test('historical dense High stays at DPR 1 while high-target uses DPR 2', () => {
    const denseHigh = resolveScenarios('dense').find(
        (scenario) => scenario.name === 'game-dense-25x25-high-desktop',
    );

    assert.equal(denseHigh?.dpr, 1);
    assert.equal(
        resolveScenarios('high-target').every((scenario) => scenario.dpr === 2),
        true,
    );
});

test('profile request parses the High target fixture contract', () => {
    const request = getScenarioRequest(
        '/debug/profile/game?mode=snow&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
    );

    assert.deepEqual(request, {
        adaptiveHigh: '0',
        blockGeometryMerging: '1',
        closeupRaisedBedId: null,
        controls: '1',
        debugHud: '0',
        details: '1',
        gardenProfile: 'high-target',
        hud: '0',
        mode: 'snow',
        operationVisuals: '0',
        outline: '0',
        placement: '0',
        quality: 'high',
    });
});

test('injected GPU timing yields to an existing elapsed-time query', () => {
    assert.match(
        installBrowserMetrics.toString(),
        /getQuery\([\s\S]*TIME_ELAPSED_EXT[\s\S]*CURRENT_QUERY/,
    );
});

test('runtime GPU-source scenario disables only the external profiler timer', () => {
    const source = installBrowserMetrics.toString();

    assert.match(source, /externalGpuTimer = true/);
    assert.match(
        source,
        /if \(externalGpuTimer\) \{[\s\S]*__gameProfileGpuTimer/,
    );
    assert.match(source, /__gameProfileMetrics =/);
});

test('render budgets gate calls and triangles per rendered frame', () => {
    const sample = {
        drawCallsPerFrame: 1,
        drawCallsPerRenderedFrame: 601,
        gpu: { elapsedP95Ms: null, supported: false },
        jsHeapMb: 200,
        longTaskCount: 0,
        maxFrameMs: 20,
        p95FrameMs: 16,
        trianglesPerFrame: 1,
        trianglesPerRenderedFrame: 2_500_000,
    };
    const budget = {
        drawCallsPerRenderedFrame: 600,
        gpuElapsedP95Ms: 33.3,
        jsHeapMb: 320,
        longTaskCount: 2,
        maxFrameMs: 180,
        p95FrameMs: 33.3,
        trianglesPerRenderedFrame: 3_000_000,
    };

    const result = evaluateBudget(sample, budget);
    const callsCheck = result.checks.find(
        (check) => check.name === 'drawCallsPerRenderedFrame',
    );
    const trianglesCheck = result.checks.find(
        (check) => check.name === 'trianglesPerRenderedFrame',
    );
    const gpuCheck = result.checks.find(
        (check) => check.name === 'gpuElapsedP95Ms',
    );

    assert.equal(result.pass, false);
    assert.equal(callsCheck?.pass, false);
    assert.equal(trianglesCheck?.pass, true);
    assert.deepEqual(gpuCheck, {
        actual: null,
        limit: 33.3,
        name: 'gpuElapsedP95Ms',
        pass: true,
        skipped: true,
    });
});

test('render work normalization separates rendered work from rAF responsiveness', () => {
    const sample = normalizeRenderWork({
        drawCalls: 120,
        frames: 60,
        renderedFrames: 3,
        submittedTriangles: 900_000,
    });

    assert.equal(sample.drawCallsPerFrame, 2);
    assert.equal(sample.drawCallsPerRafFrame, 2);
    assert.equal(sample.drawCallsPerRenderedFrame, 40);
    assert.equal(sample.trianglesPerFrame, 15_000);
    assert.equal(sample.trianglesPerRafFrame, 15_000);
    assert.equal(sample.trianglesPerRenderedFrame, 300_000);
});

test('markdown reports per-rAF and per-render work in separate columns', () => {
    const markdown = buildMarkdown({
        baseUrl: 'http://profile.local',
        generatedAt: '2026-07-26T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'core',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                budget: { checks: [], pass: true },
                consoleMessages: [],
                environment: null,
                name: 'work-columns',
                pageErrors: [],
                requested: {
                    blockGeometryMerging: 'default',
                    controls: '0',
                    debugHud: '0',
                    details: '1',
                    gardenProfile: 'default',
                    hud: '0',
                    mode: 'baseline',
                    motion: 'none',
                },
                runtime: null,
                sample: {
                    canvas: null,
                    drawCallsPerFrame: 2,
                    drawCallsPerRenderedFrame: 40,
                    fps: 60,
                    jsHeapMb: 100,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    renderedFps: 3,
                    trianglesPerFrame: 15_000,
                    trianglesPerRenderedFrame: 300_000,
                },
                screenshotPath: null,
            },
        ],
        schemaVersion: 2,
        sourceCommit: null,
        summary: { failedScenarios: 0 },
    });

    assert.match(
        markdown,
        /\| Draw\/frame \| Draw\/render \| Triangles\/frame \| Triangles\/render \|/,
    );
    assert.match(markdown, /\| 2 \| 40 \| 15000 \| 300000 \|/);
});

test('markdown distinguishes controlled governor evidence and formats range failures', () => {
    const markdown = buildMarkdown({
        adaptiveHighComparisons: {},
        baseUrl: 'http://profile.local',
        generatedAt: '2026-07-26T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'adaptive-high',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                budget: {
                    checks: [
                        {
                            actual: 2,
                            comparison: 'range',
                            limit: { maximum: 1.75, minimum: 1.5 },
                            name: 'adaptiveDpr',
                            pass: false,
                        },
                    ],
                    pass: false,
                },
                consoleMessages: [],
                environment: null,
                name: 'controlled-adaptive',
                pageErrors: [],
                requested: {
                    adaptiveHigh: '1',
                    blockGeometryMerging: '1',
                    controls: '1',
                    debugHud: '0',
                    details: '1',
                    gardenProfile: 'high-target',
                    hud: '0',
                    mode: 'details',
                    motion: 'pan-zoom-rotate',
                    profileControl: true,
                    sampleMs: 5_000,
                },
                runtime: {
                    adaptiveHighAmbientFps: 30,
                    adaptiveHighCloudUpdateMs: 96,
                    adaptiveHighGpuTimerSupported: false,
                    adaptiveHighSampleSource: 'frame',
                },
                sample: {
                    adaptiveHighDeclineCountDelta: 1,
                    adaptiveHighDprCapAtEnd: 1.75,
                    adaptiveHighDprCapAtStart: 2,
                    adaptiveHighDprCapMin: 1.75,
                    adaptiveHighInteractionObserved: true,
                    adaptiveHighLevelAtEnd: 1,
                    adaptiveHighLevelAtStart: 0,
                    adaptiveHighLevelMax: 1,
                    adaptiveHighProfileControlSampleCountDelta: 22,
                    adaptiveHighRecoveryCountDelta: 0,
                    adaptiveHighTransitionCountDelta: 1,
                    canvas: null,
                    drawCallsPerFrame: 1,
                    drawCallsPerRenderedFrame: 1,
                    fps: 30,
                    jsHeapMb: 100,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    renderedFps: 30,
                    trianglesPerFrame: 1,
                    trianglesPerRenderedFrame: 1,
                },
                screenshotPath: null,
            },
        ],
        schemaVersion: 2,
        sourceCommit: null,
        summary: { failedScenarios: 1 },
    });

    assert.match(markdown, /controlled \(22 synthetic samples\)/);
    assert.match(markdown, /frame \(profile control\)/);
    assert.match(markdown, /adaptiveDpr 2 outside \[1\.5, 1\.75\]/);
});

test('interactive sampling stops at the endpoint and drains bounded long tasks later', async () => {
    const keys = [
        'document',
        '__gameProfileGpuTimer',
        '__gameProfileInteractiveSample',
        '__gameProfileLongTasks',
        '__gameProfileMetrics',
        '__gameProfileReadLongTasks',
    ];
    const descriptors = new Map(
        keys.map((key) => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key),
        ]),
    );
    const setGlobal = (key, value) => {
        Object.defineProperty(globalThis, key, {
            configurable: true,
            value,
            writable: true,
        });
    };
    const canvas = {
        clientHeight: 720,
        clientWidth: 1280,
        height: 1440,
        width: 2560,
    };
    const metrics = {
        drawCalls: 120,
        instancedDrawCalls: 30,
        renderedFrames: 12,
        submittedTriangles: 900_000,
    };
    const startedAt = performance.now() - 1_000;
    const interactiveSample = {
        intervals: [0, 16, 20],
        lastFrameAt: performance.now(),
        running: true,
        startedAt,
    };
    let longTaskRange = null;
    let gpuDrained = false;
    const events = [];

    try {
        setGlobal('document', {
            querySelector: () => canvas,
        });
        setGlobal('__gameProfileInteractiveSample', interactiveSample);
        setGlobal('__gameProfileLongTasks', []);
        setGlobal('__gameProfileMetrics', metrics);
        setGlobal('__gameProfileReadLongTasks', (start, end) => {
            events.push('read-long-tasks');
            longTaskRange = { end, start };
            return gpuDrained ? [55] : [];
        });
        setGlobal('__gameProfileGpuTimer', {
            async finish() {
                events.push('finish-gpu');
                gpuDrained = true;
                canvas.width = 1;
                interactiveSample.intervals.push(2_000);
                metrics.drawCalls = 9_999;
                metrics.instancedDrawCalls = 9_999;
                metrics.renderedFrames = 9_999;
                metrics.submittedTriangles = 9_999;
                globalThis.__gameProfileLongTasks.push(2_000);
            },
            snapshot() {
                return {
                    elapsedP95Ms: 7,
                    supported: true,
                    valid: true,
                };
            },
            stop() {
                events.push('stop-gpu');
            },
        });

        const sampleAtEndpoint = await finishInteractiveProfileSample();

        assert.deepEqual(events, ['stop-gpu']);
        assert.equal(sampleAtEndpoint.canvas.width, 2560);
        assert.equal(sampleAtEndpoint.drawCalls, 120);
        assert.equal(sampleAtEndpoint.frames, 2);
        assert.equal(sampleAtEndpoint.instancedDrawCalls, 30);
        assert.equal(sampleAtEndpoint.renderedFrames, 12);
        assert.equal(sampleAtEndpoint.submittedTriangles, 900_000);

        const drainedSample = await drainProfileSample(
            sampleAtEndpoint.sampleWindow,
        );
        const result = mergeProfileSampleDrain(sampleAtEndpoint, drainedSample);

        assert.equal(result.canvas.width, 2560);
        assert.equal(result.drawCalls, 120);
        assert.equal(result.frames, 2);
        assert.equal(result.instancedDrawCalls, 30);
        assert.equal(result.longTaskCount, 1);
        assert.equal(result.longTaskMaxMs, 55);
        assert.equal(result.renderedFrames, 12);
        assert.equal(result.submittedTriangles, 900_000);
        assert.deepEqual(result.gpu, {
            elapsedP95Ms: 7,
            supported: true,
            valid: true,
        });
        assert.deepEqual(events, ['stop-gpu', 'finish-gpu', 'read-long-tasks']);
        assert.equal(longTaskRange?.start, startedAt);
        assert.equal(longTaskRange?.end, sampleAtEndpoint.sampleWindow.endedAt);
    } finally {
        for (const key of keys) {
            const descriptor = descriptors.get(key);
            if (descriptor) {
                Object.defineProperty(globalThis, key, descriptor);
            } else {
                Reflect.deleteProperty(globalThis, key);
            }
        }
    }
});

test('profile finalization captures CDP before draining GPU queries', async () => {
    const calls = [];
    const sampleAtEndpoint = {
        drawCalls: 12,
        sampleWindow: {
            endedAt: 200,
            startedAt: 100,
        },
    };
    const result = await finalizeProfileSampleAtEndpoint({
        cdp: {
            async send(command) {
                calls.push(`cdp:${command}`);
                return { metrics: [{ name: 'TaskDuration', value: 1 }] };
            },
        },
        page: {
            async evaluate(callback, sampleWindow) {
                calls.push('drain');
                assert.equal(callback, drainProfileSample);
                assert.deepEqual(sampleWindow, sampleAtEndpoint.sampleWindow);
                return {
                    gpu: { supported: false, valid: false },
                    longTasks: [60],
                };
            },
        },
        sampleAtEndpoint,
    });

    assert.deepEqual(calls, ['cdp:Performance.getMetrics', 'drain']);
    assert.deepEqual(result.endpointMetrics, {
        metrics: [{ name: 'TaskDuration', value: 1 }],
    });
    assert.equal(result.sample.drawCalls, 12);
    assert.equal(result.sample.longTaskCount, 1);
    assert.equal(result.sample.sampleWindow, undefined);
});

test('render budgets enforce GPU p95 when timer queries are supported', () => {
    const result = evaluateBudget(
        {
            drawCallsPerRenderedFrame: 100,
            gpu: { elapsedP95Ms: 34, supported: true, valid: true },
            jsHeapMb: 200,
            longTaskCount: 0,
            maxFrameMs: 20,
            p95FrameMs: 16,
            trianglesPerRenderedFrame: 1_000_000,
        },
        {
            drawCallsPerRenderedFrame: 600,
            gpuElapsedP95Ms: 33.3,
            jsHeapMb: 320,
            longTaskCount: 2,
            maxFrameMs: 180,
            p95FrameMs: 33.3,
            trianglesPerRenderedFrame: 3_000_000,
        },
    );
    const gpuCheck = result.checks.find(
        (check) => check.name === 'gpuElapsedP95Ms',
    );

    assert.equal(result.pass, false);
    assert.deepEqual(gpuCheck, {
        actual: 34,
        limit: 33.3,
        name: 'gpuElapsedP95Ms',
        pass: false,
        skipped: false,
    });
});

test('render budgets skip incomplete or disjoint GPU timer results', () => {
    for (const gpu of [
        {
            complete: false,
            disjoint: false,
            elapsedP95Ms: 100,
            supported: true,
            valid: false,
        },
        {
            complete: true,
            disjoint: true,
            elapsedP95Ms: 100,
            supported: true,
            valid: false,
        },
    ]) {
        const result = evaluateBudget(
            {
                drawCallsPerRenderedFrame: 100,
                gpu,
                jsHeapMb: 200,
                longTaskCount: 0,
                maxFrameMs: 20,
                p95FrameMs: 16,
                trianglesPerRenderedFrame: 1_000_000,
            },
            {
                drawCallsPerRenderedFrame: 600,
                gpuElapsedP95Ms: 33.3,
                jsHeapMb: 320,
                longTaskCount: 2,
                maxFrameMs: 180,
                p95FrameMs: 33.3,
                trianglesPerRenderedFrame: 3_000_000,
            },
        );

        assert.equal(result.pass, true);
        assert.equal(
            result.checks.find((check) => check.name === 'gpuElapsedP95Ms')
                ?.skipped,
            true,
        );
    }
});

test('high target acceptance proves the intended workload rendered', () => {
    const input = {
        apiErrors: [],
        pageErrors: [],
        requested: {
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'rain',
            motion: 'hover-scan',
            quality: 'high',
        },
        runtime: {
            actorGroundingShadowBatchCount: 1,
            actorGroundingShadowCount: 4,
            actorGroundingShadowDroppedCount: 0,
            actorGroundingShadowPrimaryCasterCount: 0,
            actorGroundingShadowVisibleCount: 4,
            animatedCasterShadowRefreshCount: 0,
            groundDecorationCount: 596,
            groundDecorationDensity: 1,
            groundDecorationVisibleCount: 571,
            generatedPlantFieldCount: 54,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            instancedInteractionResolutionCount: 1,
            instancedInteractionResolvedTargetCount: 1,
            qualityTier: 'high',
            rainParticleCount: 2_000,
            shadowMapSize: 4_096,
            shadowsEnabled: true,
        },
        sample: {
            actorGroundingShadowUpdateCountDelta: 60,
            animatedCasterShadowRefreshCountDelta: 0,
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            drawCalls: 100,
            elapsedMs: 5_000,
            instancedInteractionResolvedTargetCountDelta: 1,
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    };
    const result = evaluateHighTargetAcceptance(input);

    assert.equal(result.pass, true);
    assert.equal(
        result.checks.every((check) => check.pass),
        true,
    );
    assert.equal(
        result.checks.find(
            (check) =>
                check.name ===
                'highTargetInteractionResolvedTargetsDuringSample',
        )?.pass,
        true,
    );

    const missingDecorations = evaluateHighTargetAcceptance({
        ...input,
        runtime: {
            ...input.runtime,
            groundDecorationCount: 0,
        },
    });
    assert.equal(missingDecorations.pass, false);
    assert.equal(
        missingDecorations.checks.find(
            (check) => check.name === 'highTargetGroundDecorationCount',
        )?.pass,
        false,
    );
    assert.equal(
        evaluateHighTargetAcceptance({
            ...input,
            runtime: {
                ...input.runtime,
                groundDecorationVisibleCount: 0,
            },
        }).pass,
        false,
    );

    const casterResult = evaluateHighTargetAcceptance({
        ...input,
        runtime: {
            ...input.runtime,
            actorGroundingShadowPrimaryCasterCount: 1,
        },
    });
    assert.equal(casterResult.pass, false);
    assert.equal(
        casterResult.checks.find(
            (check) =>
                check.name === 'highTargetActorGroundingShadowPrimaryCasters',
        )?.pass,
        false,
    );
});

test('operation-visual High acceptance gates batching, uploads, mulch, and highlight identity', () => {
    const input = {
        apiErrors: [],
        pageErrors: [],
        requested: {
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            motion: 'none',
            operationVisuals: '1',
            quality: 'high',
        },
        runtime: {
            actorGroundingShadowBatchCount: 1,
            actorGroundingShadowCount: 5,
            actorGroundingShadowDroppedCount: 0,
            actorGroundingShadowPrimaryCasterCount: 0,
            actorGroundingShadowVisibleCount: 5,
            animatedCasterShadowRefreshCount: 0,
            generatedPlantExpectedInstanceCount: 286,
            generatedPlantFieldCount: 34,
            generatedPlantInstanceCount: 286,
            generatedPlantVisibleFieldCount: 34,
            generatedPlantVisibleInstanceCount: 286,
            groundDecorationCount: 596,
            groundDecorationDensity: 1,
            groundDecorationVisibleCount: 571,
            operationVisualHighlightProfileDispatched: true,
            operationVisualHighlightProfileTargetFieldId: 201,
            operationVisualHighlightProfileTargetGardenId: 99_996,
            operationVisualHighlightProfileTargetPositionIndex: 0,
            operationVisualHighlightProfileTargetRaisedBedId: 2,
            qualityTier: 'high',
            raisedBedFieldVisualBatchCount: 7,
            raisedBedFieldVisualChunkCount: 2,
            raisedBedFieldVisualInstanceCount: 396,
            raisedBedFieldVisualMatrixUploadCount: 7,
            raisedBedFieldVisualObjectCount: 7,
            raisedBedFieldVisualUploadedInstanceCount: 396,
            raisedBedMulchBatchCount: 12,
            raisedBedMulchGroupCount: 12,
            raisedBedMulchInstanceCount: 54,
            raisedBedMulchObjectCount: 12,
            raisedBedMulchOverlayCount: 54,
            shadowMapSize: 4_096,
            shadowsEnabled: true,
        },
        sample: {
            actorGroundingShadowUpdateCountDelta: 60,
            animatedCasterShadowRefreshCountDelta: 0,
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            drawCalls: 100,
            elapsedMs: 5_000,
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    };
    const result = evaluateHighTargetAcceptance(input);

    assert.equal(result.pass, true);
    assert.deepEqual(
        result.checks.find(
            (check) =>
                check.name === 'highTargetOperationVisualRenderedObjects',
        ),
        {
            actual: 21,
            comparison: 'range',
            legacy: 452,
            limit: {
                maximum: 64,
                minimum: 4,
            },
            name: 'highTargetOperationVisualRenderedObjects',
            pass: true,
        },
    );
    const markdown = buildMarkdown({
        adaptiveHighComparisons: {},
        baseUrl: 'http://profile.local',
        generatedAt: '2026-07-27T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'high-target-operation-visuals',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                budget: { checks: result.checks, pass: true },
                consoleMessages: [],
                environment: null,
                name: 'game-high-target-operation-visuals-desktop',
                pageErrors: [],
                requested: {
                    controls: '1',
                    debugHud: '0',
                    details: '1',
                    hud: '0',
                    ...input.requested,
                },
                runtime: input.runtime,
                sample: {
                    drawCallsPerFrame: 2,
                    drawCallsPerRenderedFrame: 20,
                    fps: 60,
                    jsHeapMb: 100,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    trianglesPerFrame: 15_000,
                    trianglesPerRenderedFrame: 300_000,
                    ...input.sample,
                },
                screenshotPath: null,
            },
        ],
        schemaVersion: 2,
        sourceCommit: null,
        summary: { failedScenarios: 0 },
    });
    assert.match(
        markdown,
        /field visuals 396 instances\/7 objects\/7 batches\/2 chunks, uploads 7\/396; mulch 54 instances\/12 objects\/12 batches\/12 groups; operation objects 21\/452 legacy/,
    );

    for (const [field, value, checkName] of [
        [
            'generatedPlantExpectedInstanceCount',
            287,
            'highTargetExpectedGeneratedPlantInstances',
        ],
        [
            'operationVisualHighlightProfileDispatched',
            false,
            'highTargetOperationVisualHighlightDispatched',
        ],
        [
            'raisedBedFieldVisualInstanceCount',
            395,
            'highTargetOperationVisualFieldInstances',
        ],
        [
            'raisedBedFieldVisualMatrixUploadCount',
            8,
            'highTargetOperationVisualFieldMatrixUploads',
        ],
        [
            'raisedBedFieldVisualUploadedInstanceCount',
            395,
            'highTargetOperationVisualFieldUploadedInstances',
        ],
        [
            'raisedBedMulchInstanceCount',
            53,
            'highTargetOperationVisualMulchInstances',
        ],
        [
            'raisedBedMulchOverlayCount',
            53,
            'highTargetOperationVisualMulchOverlays',
        ],
    ]) {
        const invalid = evaluateHighTargetAcceptance({
            ...input,
            runtime: {
                ...input.runtime,
                [field]: value,
            },
        });
        assert.equal(
            invalid.checks.find((check) => check.name === checkName)?.pass,
            false,
            `${checkName} should reject ${field}=${value}`,
        );
    }

    const tooManyObjects = evaluateHighTargetAcceptance({
        ...input,
        runtime: {
            ...input.runtime,
            raisedBedFieldVisualObjectCount: 32,
            raisedBedMulchObjectCount: 33,
        },
    });
    assert.equal(
        tooManyObjects.checks.find(
            (check) =>
                check.name === 'highTargetOperationVisualRenderedObjects',
        )?.pass,
        false,
    );
});

test('outline acceptance gates deterministic dispatch and telemetry when available', () => {
    const validOutlineRuntime = {
        hoverOutlineActiveTargetCount: 2,
        hoverOutlineAllocatedHeight: 256,
        hoverOutlineAllocatedPixelCount: 131_072,
        hoverOutlineAllocatedWidth: 512,
        hoverOutlineAllocationEstimatedBytes: 262_144,
        hoverOutlineCompositePassCount: 2,
        hoverOutlineCropClippedCount: 0,
        hoverOutlineCropPixelCount: 100_000,
        hoverOutlineDrawingBufferPixelCount: 3_686_400,
        hoverOutlineFormat: 'r8',
        hoverOutlineHorizontalPassCount: 2,
        hoverOutlineKernelSampleCount: 23,
        hoverOutlineMaskPassCount: 2,
        hoverOutlineMaxKernelSampleCount: 51,
        hoverOutlinePipeline: 'cropped-bounded-separable-r8',
        hoverOutlineProfileCommandAction: 'show',
        hoverOutlineProfileTargetBlockId: 'profile-raised-bed:2:0',
        hoverOutlineProfileTargetRaisedBedId: 2,
        hoverOutlineRenderTargetCount: 2,
        hoverOutlineRoiRatio: 0.04,
        hoverOutlineStyleGroupCount: 1,
        hoverOutlineThickness: 5,
    };
    const createInput = ({
        environment,
        requested = {},
        runtime = {},
        sample = {},
    } = {}) => ({
        apiErrors: [],
        environment,
        pageErrors: [],
        requested: {
            gardenProfile: 'high-target',
            outline: '1',
            outlineProfile: 'connected-raised-bed',
            outlineRaisedBedId: 2,
            ...requested,
        },
        runtime,
        sample: {
            outlineProfileDispatched: true,
            outlineProfileTelemetryAvailable: false,
            ...sample,
        },
    });
    const withoutTelemetry = evaluateHighTargetAcceptance(createInput());
    assert.equal(
        withoutTelemetry.checks.find(
            (check) => check.name === 'highTargetOutlineProfileDispatched',
        )?.pass,
        true,
    );
    assert.equal(
        withoutTelemetry.checks.some(
            (check) => check.name === 'highTargetOutlineActiveTargets',
        ),
        false,
    );

    const withTelemetry = evaluateHighTargetAcceptance(
        createInput({
            runtime: validOutlineRuntime,
            sample: {
                outlineProfileTelemetryAvailable: true,
            },
        }),
    );
    assert.equal(
        withTelemetry.checks
            .filter((check) => check.name.startsWith('highTargetOutline'))
            .every((check) => check.pass),
        true,
    );

    const metalEvidence = evaluateHighTargetAcceptance(
        createInput({
            environment: {
                renderer:
                    'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)',
            },
            requested: {
                graphicsBackend: 'angle-metal',
            },
            runtime: validOutlineRuntime,
            sample: {
                gpu: {
                    elapsedP95Ms: 12.5,
                    sampleCount: 45,
                    supported: true,
                    valid: true,
                },
                outlineProfileTelemetryAvailable: true,
            },
        }),
    );
    const metalCheckNames = [
        'highTargetOutlineAngleMetalRenderer',
        'highTargetOutlineGpuTimerSupported',
        'highTargetOutlineGpuTimerValid',
        'highTargetOutlineGpuTimerSamples',
        'highTargetOutlineGpuElapsedP95Ms',
    ];
    assert.equal(
        metalEvidence.checks
            .filter((check) => metalCheckNames.includes(check.name))
            .every((check) => check.pass),
        true,
    );

    for (const [environment, gpu, checkName] of [
        [
            { renderer: 'ANGLE (Apple, OpenGL 4.1)' },
            {
                elapsedP95Ms: 12.5,
                sampleCount: 45,
                supported: true,
                valid: true,
            },
            'highTargetOutlineAngleMetalRenderer',
        ],
        [
            {
                renderer:
                    'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)',
            },
            {
                elapsedP95Ms: null,
                sampleCount: 0,
                supported: false,
                valid: false,
            },
            'highTargetOutlineGpuTimerSupported',
        ],
        [
            {
                renderer:
                    'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)',
            },
            {
                elapsedP95Ms: null,
                sampleCount: 0,
                supported: true,
                valid: false,
            },
            'highTargetOutlineGpuTimerValid',
        ],
        [
            {
                renderer:
                    'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)',
            },
            {
                elapsedP95Ms: Number.POSITIVE_INFINITY,
                sampleCount: 45,
                supported: true,
                valid: true,
            },
            'highTargetOutlineGpuElapsedP95Ms',
        ],
    ]) {
        const result = evaluateHighTargetAcceptance(
            createInput({
                environment,
                requested: {
                    graphicsBackend: 'angle-metal',
                },
                runtime: validOutlineRuntime,
                sample: {
                    gpu,
                    outlineProfileTelemetryAvailable: true,
                },
            }),
        );
        assert.equal(
            result.checks.find((check) => check.name === checkName)?.pass,
            false,
            `${checkName} should reject missing hardware evidence`,
        );
    }

    const portableOutline = evaluateHighTargetAcceptance(
        createInput({
            environment: { renderer: 'SwiftShader' },
            requested: {
                graphicsBackend: 'default',
            },
            runtime: validOutlineRuntime,
            sample: {
                gpu: {
                    elapsedP95Ms: null,
                    sampleCount: 0,
                    supported: false,
                    valid: false,
                },
                outlineProfileTelemetryAvailable: true,
            },
        }),
    );
    assert.equal(
        portableOutline.checks.some((check) =>
            metalCheckNames.includes(check.name),
        ),
        false,
    );

    for (const [field, invalidValue, checkName] of [
        ['hoverOutlineActiveTargetCount', 1, 'highTargetOutlineActiveTargets'],
        ['hoverOutlineStyleGroupCount', 2, 'highTargetOutlineStyleGroups'],
        [
            'hoverOutlineProfileCommandAction',
            'hide',
            'highTargetOutlineProfileCommandAction',
        ],
        [
            'hoverOutlineProfileTargetBlockId',
            'profile-raised-bed:3:0',
            'highTargetOutlineProfileTargetBlockId',
        ],
        [
            'hoverOutlineProfileTargetRaisedBedId',
            3,
            'highTargetOutlineProfileTargetRaisedBedId',
        ],
        ['hoverOutlinePipeline', 'legacy', 'highTargetOutlinePipeline'],
        ['hoverOutlineFormat', 'rgba8', 'highTargetOutlineFormat'],
        ['hoverOutlineRenderTargetCount', 3, 'highTargetOutlineRenderTargets'],
        [
            'hoverOutlineDrawingBufferPixelCount',
            1,
            'highTargetOutlineDrawingBufferPixels',
        ],
        ['hoverOutlineCropPixelCount', 0, 'highTargetOutlineCropPixels'],
        ['hoverOutlineAllocatedWidth', 0, 'highTargetOutlineAllocatedWidth'],
        ['hoverOutlineAllocatedHeight', 0, 'highTargetOutlineAllocatedHeight'],
        ['hoverOutlineRoiRatio', 0.26, 'highTargetOutlineRoiRatio'],
        ['hoverOutlineCropClippedCount', 1, 'highTargetOutlineCropClipping'],
        ['hoverOutlineThickness', 4, 'highTargetOutlineThickness'],
        ['hoverOutlineKernelSampleCount', 21, 'highTargetOutlineKernelSamples'],
        [
            'hoverOutlineMaxKernelSampleCount',
            49,
            'highTargetOutlineMaximumKernelSamples',
        ],
        ['hoverOutlineMaskPassCount', 0, 'highTargetOutlineMaskPasses'],
        [
            'hoverOutlineHorizontalPassCount',
            1,
            'highTargetOutlineHorizontalPassAlignment',
        ],
        [
            'hoverOutlineCompositePassCount',
            1,
            'highTargetOutlineCompositePassAlignment',
        ],
        [
            'hoverOutlineAllocationEstimatedBytes',
            1,
            'highTargetOutlineAllocationBytes',
        ],
    ]) {
        const result = evaluateHighTargetAcceptance(
            createInput({
                runtime: {
                    ...validOutlineRuntime,
                    [field]: invalidValue,
                },
                sample: {
                    outlineProfileTelemetryAvailable: true,
                },
            }),
        );
        assert.equal(
            result.checks.find((check) => check.name === checkName)?.pass,
            false,
            `${checkName} should reject ${field}=${invalidValue}`,
        );
    }
});

test('adaptive High acceptance allows bounded effective DPR during interaction', () => {
    const input = {
        apiErrors: [],
        pageErrors: [],
        requested: {
            adaptiveHigh: '1',
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            motion: 'pan-zoom-rotate',
            quality: 'high',
        },
        runtime: {
            actorGroundingShadowBatchCount: 1,
            actorGroundingShadowCount: 5,
            actorGroundingShadowDroppedCount: 0,
            actorGroundingShadowPrimaryCasterCount: 0,
            actorGroundingShadowVisibleCount: 5,
            adaptiveHighDprCap: 1.75,
            adaptiveHighEnabled: true,
            adaptiveHighOscillationCount: 0,
            adaptiveHighTransitionCount: 1,
            animatedCasterShadowRefreshCount: 0,
            groundDecorationCount: 596,
            groundDecorationDensity: 1,
            groundDecorationVisibleCount: 571,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            qualityTier: 'high',
            shadowMapSize: 4_096,
            shadowsEnabled: true,
            weatherDisabled: false,
        },
        sample: {
            actorGroundingShadowUpdateCountDelta: 60,
            adaptiveHighDeclineCountDelta: 1,
            adaptiveHighDeclineObserved: true,
            adaptiveHighDprCapAtEnd: 1.75,
            adaptiveHighDprCapAtStart: 2,
            adaptiveHighDprCapMin: 1.75,
            adaptiveHighInteractionObserved: true,
            adaptiveHighLevelAtEnd: 1,
            adaptiveHighLevelAtStart: 0,
            adaptiveHighLevelMax: 1,
            adaptiveHighTransitionCountDelta: 1,
            animatedCasterShadowRefreshCountDelta: 0,
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1260,
                width: 2240,
            },
            drawCalls: 100,
            effectiveDprAtEnd: 1.75,
            effectiveDprMin: 1.75,
            elapsedMs: 5_000,
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    };

    assert.equal(evaluateHighTargetAcceptance(input).pass, true);

    const controlled = {
        ...input,
        requested: {
            ...input.requested,
            profileControl: true,
        },
        runtime: {
            ...input.runtime,
            adaptiveHighProfileControlActive: true,
            adaptiveHighProfileControlEnabled: true,
        },
        sample: {
            ...input.sample,
            adaptiveHighProfileControlObserved: true,
            adaptiveHighProfileControlStarted: true,
        },
    };
    assert.equal(evaluateHighTargetAcceptance(controlled).pass, true);
    for (const sample of [
        {
            ...controlled.sample,
            adaptiveHighProfileControlObserved: false,
        },
        {
            ...controlled.sample,
            adaptiveHighProfileControlStarted: false,
        },
    ]) {
        assert.equal(
            evaluateHighTargetAcceptance({ ...controlled, sample }).pass,
            false,
        );
    }

    for (const runtime of [
        { ...input.runtime, adaptiveHighOscillationCount: 1 },
        { ...input.runtime, weatherDisabled: true },
    ]) {
        assert.equal(
            evaluateHighTargetAcceptance({ ...input, runtime }).pass,
            false,
        );
    }

    for (const sample of [
        { ...input.sample, adaptiveHighTransitionCountDelta: 0 },
        { ...input.sample, adaptiveHighDeclineObserved: false },
        { ...input.sample, adaptiveHighDprCapMin: 2 },
        { ...input.sample, adaptiveHighInteractionObserved: false },
        { ...input.sample, adaptiveHighLevelMax: 0 },
    ]) {
        assert.equal(
            evaluateHighTargetAcceptance({ ...input, sample }).pass,
            false,
        );
    }

    assert.equal(
        evaluateHighTargetAcceptance({
            ...input,
            sample: {
                ...input.sample,
                canvas: {
                    ...input.sample.canvas,
                    width: 2560,
                },
            },
        }).pass,
        false,
    );
    assert.equal(
        evaluateHighTargetAcceptance({
            ...input,
            runtime: {
                ...input.runtime,
                adaptiveHighDprCap: 1.4,
            },
            sample: {
                ...input.sample,
                adaptiveHighDprCapAtEnd: 1.4,
                effectiveDprAtEnd: 1.4,
                effectiveDprMin: 1.4,
            },
        }).pass,
        false,
    );

    const recovered = {
        ...input,
        requested: {
            ...input.requested,
            motion: 'pan-zoom-rotate-then-idle',
            profileControl: true,
            profileControlRecovery: true,
        },
        runtime: {
            ...input.runtime,
            adaptiveHighDprCap: 2,
            adaptiveHighOscillationCount: 1,
            adaptiveHighProfileControlActive: true,
            adaptiveHighProfileControlEnabled: true,
        },
        sample: {
            ...input.sample,
            adaptiveHighDprCapAtEnd: 2,
            adaptiveHighLevelAtEnd: 0,
            adaptiveHighRecoveryCountDelta: 1,
            adaptiveHighProfileControlObserved: true,
            adaptiveHighProfileControlSampleCountDelta: 22,
            adaptiveHighProfileControlStarted: true,
            adaptiveHighTransitionCountDelta: 2,
            canvas: {
                ...input.sample.canvas,
                height: 1440,
                width: 2560,
            },
            effectiveDprAtEnd: 2,
        },
    };
    assert.equal(evaluateHighTargetAcceptance(recovered).pass, true);
    assert.equal(
        evaluateHighTargetAcceptance({
            ...recovered,
            sample: {
                ...recovered.sample,
                adaptiveHighDprCapMin: 2,
                adaptiveHighDeclineObserved: false,
                adaptiveHighLevelMax: 0,
                adaptiveHighRecoveryCountDelta: 0,
                adaptiveHighTransitionCountDelta: 0,
            },
        }).pass,
        false,
    );
    assert.equal(
        evaluateHighTargetAcceptance({
            ...recovered,
            runtime: {
                ...recovered.runtime,
                adaptiveHighDprCap: 1.75,
            },
            sample: {
                ...recovered.sample,
                adaptiveHighDprCapAtEnd: 1.75,
                adaptiveHighLevelAtEnd: 1,
                effectiveDprAtEnd: 1.75,
            },
        }).pass,
        false,
    );

    const runtimeGpuSource = {
        ...input,
        requested: {
            ...input.requested,
            motion: 'none',
            runtimeGpuSource: true,
        },
        runtime: {
            ...input.runtime,
            adaptiveHighGpuTimerSupported: true,
            adaptiveHighSampleSource: 'gpu',
        },
        sample: {
            ...input.sample,
            adaptiveHighGpuSourceObserved: true,
        },
    };
    assert.equal(evaluateHighTargetAcceptance(runtimeGpuSource).pass, true);
    assert.equal(
        evaluateHighTargetAcceptance({
            ...runtimeGpuSource,
            runtime: {
                ...runtimeGpuSource.runtime,
                adaptiveHighSampleSource: 'frame',
            },
        }).pass,
        false,
    );
    assert.equal(
        evaluateHighTargetAcceptance({
            ...runtimeGpuSource,
            runtime: {
                ...runtimeGpuSource.runtime,
                adaptiveHighGpuTimerSupported: false,
                adaptiveHighSampleSource: 'frame',
            },
            sample: {
                ...runtimeGpuSource.sample,
                adaptiveHighGpuSourceObserved: false,
            },
        }).pass,
        true,
    );

    const cloudy = {
        ...input,
        requested: {
            ...input.requested,
            mode: 'cloudy',
            motion: 'none',
        },
        runtime: {
            ...input.runtime,
            actorGroundingShadowCount: 4,
            actorGroundingShadowVisibleCount: 4,
            cloudVisualCount: 8,
        },
        sample: {
            ...input.sample,
            cloudAttenuationUpdateCountDelta: 1,
        },
    };
    assert.equal(evaluateHighTargetAcceptance(cloudy).pass, true);
    assert.equal(
        evaluateHighTargetAcceptance({
            ...cloudy,
            sample: {
                ...cloudy.sample,
                cloudAttenuationUpdateCountDelta: 0,
            },
        }).pass,
        false,
    );

    const windy = {
        ...cloudy,
        requested: {
            ...cloudy.requested,
            mode: 'windy',
        },
        runtime: {
            ...cloudy.runtime,
            adaptiveHighAmbientFps: 20,
            cloudVisualCount: 7,
        },
    };
    assert.equal(evaluateHighTargetAcceptance(windy).pass, true);
    assert.equal(
        evaluateHighTargetAcceptance({
            ...windy,
            runtime: {
                ...windy.runtime,
                adaptiveHighAmbientFps: 0,
            },
        }).pass,
        false,
    );

    for (const [mode, particleField, particleCount] of [
        ['rain', 'rainParticleCount', 2_000],
        ['snow', 'snowParticleCount', 3_500],
    ]) {
        const weather = {
            ...input,
            requested: {
                ...input.requested,
                mode,
                motion: 'none',
            },
            runtime: {
                ...input.runtime,
                actorGroundingShadowCount: 4,
                actorGroundingShadowVisibleCount: 4,
                [particleField]: particleCount,
                ...(mode === 'snow'
                    ? {
                          groundDecorationCount: 0,
                          groundDecorationVisibleCount: null,
                          snowParticleCapacity: 5_000,
                      }
                    : {}),
            },
        };
        assert.equal(evaluateHighTargetAcceptance(weather).pass, true);
        assert.equal(
            evaluateHighTargetAcceptance({
                ...weather,
                runtime: {
                    ...weather.runtime,
                    [particleField]: 0,
                },
            }).pass,
            false,
        );
    }
});

test('high target acceptance distinguishes a cached map from refreshes and resets', () => {
    for (const [primaryShadowRefreshCountDelta, expectedPass] of [
        [0, true],
        [1, false],
        [-1, false],
    ]) {
        const result = evaluateHighTargetAcceptance({
            apiErrors: [],
            pageErrors: [],
            requested: {
                blockGeometryMerging: '1',
                gardenProfile: 'high-target',
                mode: 'details',
                quality: 'high',
                scenarioName: 'game-high-target-clear-idle-desktop-run-1',
            },
            runtime: {
                actorGroundingShadowBatchCount: 1,
                actorGroundingShadowCount: 5,
                actorGroundingShadowDroppedCount: 0,
                actorGroundingShadowPrimaryCasterCount: 0,
                actorGroundingShadowVisibleCount: 4,
                animatedCasterShadowRefreshCount: 0,
                groundDecorationCount: 596,
                groundDecorationDensity: 1,
                groundDecorationVisibleCount: 571,
                generatedPlantExpectedInstanceCount: 537,
                generatedPlantFieldCount: 54,
                generatedPlantInstanceCount: 537,
                generatedPlantVisibleFieldCount: 54,
                generatedPlantVisibleInstanceCount: 537,
                qualityTier: 'high',
                shadowMapSize: 4_096,
                shadowsEnabled: true,
            },
            sample: {
                actorGroundingShadowUpdateCountDelta: 60,
                animatedCasterShadowRefreshCountDelta: 0,
                canvas: {
                    clientHeight: 720,
                    clientWidth: 1280,
                    height: 1440,
                    width: 2560,
                },
                drawCalls: 100,
                elapsedMs: 5_000,
                primaryShadowRefreshCountAtStart: 2,
                primaryShadowRefreshCountDelta,
                renderedFps: 12,
                renderedFrames: 60,
                reportedDpr: 2,
                submittedTriangles: 1_000_000,
            },
        });

        assert.equal(result.pass, expectedPass);
        assert.deepEqual(
            result.checks.find(
                (check) =>
                    check.name ===
                    'highTargetPrimaryShadowRefreshesDuringClearIdle',
            ),
            {
                actual: primaryShadowRefreshCountDelta,
                comparison: 'equal',
                limit: 0,
                name: 'highTargetPrimaryShadowRefreshesDuringClearIdle',
                pass: expectedPass,
            },
        );
    }
});

test('high target placement acceptance requires one deferred final shadow flush', () => {
    const createInput = ({
        activeCount = 0,
        deferredDelta = 2,
        flushDelta = 1,
        primaryDelta = 1,
        projectedDrops = 0,
        projectedEnd = 0,
        projectedPeak = 2,
    } = {}) => ({
        apiErrors: [],
        pageErrors: [],
        requested: {
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            placementProfile: 'placement-drop',
            quality: 'high',
        },
        runtime: {
            actorGroundingShadowBatchCount: 1,
            actorGroundingShadowCount: 5,
            actorGroundingShadowDroppedCount: 0,
            actorGroundingShadowPrimaryCasterCount: 0,
            actorGroundingShadowVisibleCount: 4,
            animatedCasterShadowRefreshCount: 0,
            groundDecorationCount: 596,
            groundDecorationDensity: 1,
            groundDecorationVisibleCount: 571,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            placementChunkPhysicalRebuildCount: 2,
            placementProjectedShadowCount: projectedEnd,
            placementProjectedShadowDroppedCount: projectedDrops,
            placementProjectedShadowPeakCount: projectedPeak,
            placementShadowActiveCount: activeCount,
            qualityTier: 'high',
            shadowMapSize: 4_096,
            shadowsEnabled: true,
        },
        sample: {
            actorGroundingShadowUpdateCountDelta: 60,
            animatedCasterShadowRefreshCountDelta: 0,
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            drawCalls: 100,
            elapsedMs: 5_000,
            placementProfileDispatched: true,
            placementShadowDeferredChangeCountDelta: deferredDelta,
            placementShadowFlushCountDelta: flushDelta,
            primaryShadowRefreshCountDelta: primaryDelta,
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    });

    assert.equal(evaluateHighTargetAcceptance(createInput()).pass, true);

    for (const invalid of [
        { flushDelta: 0 },
        { flushDelta: 2 },
        { primaryDelta: 0 },
        { primaryDelta: 2 },
        { deferredDelta: 0 },
        { activeCount: 1 },
        { projectedEnd: 1 },
        { projectedDrops: 1 },
        { projectedPeak: 0 },
        { projectedPeak: 1 },
        { projectedPeak: 3 },
    ]) {
        assert.equal(
            evaluateHighTargetAcceptance(createInput(invalid)).pass,
            false,
        );
    }
});

test('high target acceptance requires the full workload to remain visible', () => {
    const result = evaluateHighTargetAcceptance({
        apiErrors: [],
        pageErrors: [],
        requested: {
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            quality: 'high',
        },
        runtime: {
            animatedCasterShadowRefreshCount: 1,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 53,
            generatedPlantVisibleInstanceCount: 536,
            qualityTier: 'high',
        },
        sample: {
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            drawCalls: 100,
            elapsedMs: 5_000,
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    });

    assert.equal(result.pass, false);
    assert.deepEqual(
        result.checks
            .filter((check) =>
                [
                    'highTargetVisiblePlantFields',
                    'highTargetVisiblePlantInstances',
                ].includes(check.name),
            )
            .map((check) => ({
                actual: check.actual,
                limit: check.limit,
                pass: check.pass,
            })),
        [
            { actual: 53, limit: 54, pass: false },
            { actual: 536, limit: 537, pass: false },
        ],
    );
});

test('high target acceptance rejects failed API requests', () => {
    const result = evaluateHighTargetAcceptance({
        apiErrors: [
            {
                status: 401,
                url: 'http://localhost/api/gredice/api/gardens/1/stacks',
            },
        ],
        pageErrors: [],
        requested: {
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            quality: 'high',
        },
        runtime: {
            animatedCasterShadowRefreshCount: 1,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            qualityTier: 'high',
        },
        sample: {
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            drawCalls: 100,
            elapsedMs: 5_000,
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    });

    assert.equal(result.pass, false);
    assert.deepEqual(
        result.checks.find((check) => check.name === 'highTargetApiErrors'),
        {
            actual: 1,
            comparison: 'equal',
            limit: 0,
            name: 'highTargetApiErrors',
            pass: false,
        },
    );
});

test('high target acceptance rejects a demand-render scene with one frame', () => {
    const result = evaluateHighTargetAcceptance({
        apiErrors: [],
        pageErrors: [],
        requested: {
            blockGeometryMerging: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            quality: 'high',
        },
        runtime: {
            animatedCasterShadowRefreshCount: 1,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            qualityTier: 'high',
        },
        sample: {
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            drawCalls: 10,
            elapsedMs: 5_000,
            renderedFps: 0.2,
            renderedFrames: 1,
            reportedDpr: 2,
            submittedTriangles: 10_000,
        },
    });

    assert.equal(result.pass, false);
    assert.deepEqual(
        result.checks
            .filter((check) =>
                ['highTargetRenderedFps', 'highTargetRenderedFrames'].includes(
                    check.name,
                ),
            )
            .map((check) => ({
                limit: check.limit,
                name: check.name,
                pass: check.pass,
            })),
        [
            { limit: 1, name: 'highTargetRenderedFps', pass: false },
            { limit: 5, name: 'highTargetRenderedFrames', pass: false },
        ],
    );
});

test('high target acceptance rejects zero work and an incomplete fixture', () => {
    const result = evaluateHighTargetAcceptance({
        apiErrors: [
            { status: 401, url: 'http://localhost/api/gardens/1/stacks' },
        ],
        pageErrors: ['render failed'],
        requested: {
            blockGeometryMerging: '0',
            gardenProfile: 'high-target',
            mode: 'snow',
            quality: 'medium',
        },
        runtime: {
            generatedPlantFieldCount: 0,
            generatedPlantExpectedInstanceCount: 0,
            generatedPlantInstanceCount: 1,
            generatedPlantVisibleFieldCount: 0,
            generatedPlantVisibleInstanceCount: 0,
            qualityTier: 'medium',
            snowParticleCount: 0,
        },
        sample: {
            canvas: null,
            drawCalls: 0,
            elapsedMs: 5_000,
            renderedFps: 0,
            renderedFrames: 0,
            reportedDpr: 1,
            submittedTriangles: 0,
        },
    });

    assert.equal(result.pass, false);
    assert.equal(
        result.checks.some((check) => check.pass),
        false,
    );
});

function highTargetRun(value, index, acceptancePass = true) {
    const performancePass = value <= 33.3;
    return {
        baseName: 'game-high-target-clear-idle-desktop',
        acceptance: { pass: acceptancePass },
        budget: { pass: acceptancePass && performancePass },
        budgetName: 'gameHighTarget',
        name: `game-high-target-clear-idle-desktop-run-${index + 1}`,
        performanceBudget: { pass: performancePass },
        requested: { gardenProfile: 'high-target' },
        sample: {
            drawCallsPerFrame: 100,
            drawCallsPerRenderedFrame: 100,
            gpu: {
                elapsedP95Ms: 10,
                valid: true,
            },
            jsHeapMb: 200,
            longTaskCount: 0,
            maxFrameMs: 80,
            p95FrameMs: value,
            renderedFps: 60 - index,
            trianglesPerFrame: 1_000_000,
            trianglesPerRenderedFrame: 1_000_000,
        },
    };
}

test('high target repeated runs budget the median while retaining run diagnostics', () => {
    const runs = [10, 20, 40].map((value, index) =>
        highTargetRun(value, index),
    );
    const medians = buildHighTargetMedians(runs);
    const aggregate = medians['game-high-target-clear-idle-desktop'];

    assert.deepEqual(aggregate.p95FrameMs, {
        max: 40,
        median: 20,
        min: 10,
    });
    assert.equal(aggregate.medianSample.p95FrameMs, 20);
    assert.equal(aggregate.performanceBudget.pass, true);
    assert.equal(aggregate.acceptancePass, true);
    assert.equal(aggregate.pass, true);
    assert.equal(aggregate.passedRunCount, 2);
    assert.deepEqual(buildProfileSummary(runs, medians), {
        failedScenarioNames: [],
        failedScenarios: 0,
        failedRuns: 1,
        passedRuns: 2,
        passedScenarios: 1,
        totalRuns: 3,
        totalScenarios: 1,
    });
});

test('high target aggregate requires acceptance from every repeated run', () => {
    const runs = [
        highTargetRun(10, 0),
        highTargetRun(20, 1, false),
        highTargetRun(40, 2),
    ];
    const medians = buildHighTargetMedians(runs);
    const aggregate = medians['game-high-target-clear-idle-desktop'];

    assert.equal(aggregate.performanceBudget.pass, true);
    assert.equal(aggregate.acceptancePass, false);
    assert.equal(aggregate.pass, false);
    assert.deepEqual(aggregate.failedAcceptanceRuns, [
        'game-high-target-clear-idle-desktop-run-2',
    ]);
    assert.deepEqual(buildProfileSummary(runs, medians).failedScenarioNames, [
        'game-high-target-clear-idle-desktop',
    ]);
});

test('high target aggregate fails when the median exceeds a performance budget', () => {
    const runs = [34, 40, 50].map((value, index) =>
        highTargetRun(value, index),
    );
    const aggregate =
        buildHighTargetMedians(runs)['game-high-target-clear-idle-desktop'];

    assert.equal(aggregate.acceptancePass, true);
    assert.equal(aggregate.medianSample.p95FrameMs, 40);
    assert.equal(aggregate.performanceBudget.pass, false);
    assert.equal(aggregate.pass, false);
});

test('adaptive High comparison reports paired pass rates and frame/GPU deltas', () => {
    const pairedRun = ({
        baseName,
        comparisonRole,
        gpuP95,
        index,
        p95,
        renderedFps,
    }) => {
        const run = highTargetRun(p95, index);
        return {
            ...run,
            baseName,
            name: `${baseName}-run-${index + 1}`,
            requested: {
                ...run.requested,
                comparisonPair: 'adaptive-camera-motion',
                comparisonRole,
            },
            sample: {
                ...run.sample,
                gpu: {
                    elapsedP95Ms: gpuP95,
                    valid: true,
                },
                renderedFps,
            },
        };
    };
    const runs = [
        ...[18, 20, 22].map((p95, index) =>
            pairedRun({
                baseName:
                    'game-high-target-adaptive-pair-fixed-camera-motion-desktop',
                comparisonRole: 'fixed',
                gpuP95: 10,
                index,
                p95,
                renderedFps: 50,
            }),
        ),
        ...[14, 15, 16].map((p95, index) =>
            pairedRun({
                baseName: 'game-high-target-adaptive-camera-motion-desktop',
                comparisonRole: 'adaptive',
                gpuP95: 8,
                index,
                p95,
                renderedFps: 60,
            }),
        ),
    ];
    const medians = buildHighTargetMedians(runs);
    const comparison =
        buildAdaptiveHighComparisons(medians)['adaptive-camera-motion'];

    assert.deepEqual(comparison.acceptancePassRate, {
        adaptive: 100,
        fixed: 100,
    });
    assert.deepEqual(comparison.p95FrameMs, {
        adaptive: 15,
        delta: -5,
        fixed: 20,
        percentDelta: -25,
    });
    assert.deepEqual(comparison.gpuElapsedP95Ms, {
        adaptive: 8,
        delta: -2,
        fixed: 10,
        percentDelta: -20,
    });
    assert.deepEqual(comparison.renderedFps, {
        adaptive: 60,
        delta: 10,
        fixed: 50,
        percentDelta: 20,
    });
    assert.equal(comparison.relativePerformancePass, true);
    assert.equal(
        comparison.relativePerformanceChecks.every((check) => check.pass),
        true,
    );
    assert.match(
        buildMarkdown({
            adaptiveHighComparisons: buildAdaptiveHighComparisons(medians),
            baseUrl: 'http://profile.local',
            generatedAt: '2026-07-26T00:00:00.000Z',
            highTargetMedians: medians,
            options: {
                build: false,
                managedServer: false,
                sampleMs: 5_000,
                scenarios: [],
                scenarioSet: 'adaptive-high',
                soakMs: 0,
                warmupMs: 0,
            },
            plantCloseupMedians: {},
            scenarios: [],
            schemaVersion: 2,
            sourceCommit: null,
            summary: { failedScenarios: 0 },
        }),
        /Adaptive High paired comparison[\s\S]*20 → 15 ms \(-25%\)[\s\S]*10 → 8 ms \(-20%\)/,
    );

    const regressedRuns = runs.map((run) =>
        run.requested.comparisonRole === 'adaptive'
            ? {
                  ...run,
                  sample: {
                      ...run.sample,
                      gpu: {
                          elapsedP95Ms: 12,
                          valid: true,
                      },
                      p95FrameMs: 30,
                      renderedFps: 40,
                  },
              }
            : run,
    );
    const regressedMedians = buildHighTargetMedians(regressedRuns);
    const regressedComparison =
        buildAdaptiveHighComparisons(regressedMedians)[
            'adaptive-camera-motion'
        ];

    assert.equal(
        regressedMedians['game-high-target-adaptive-camera-motion-desktop']
            .pass,
        true,
    );
    assert.equal(regressedComparison.relativePerformancePass, false);
    assert.equal(regressedComparison.aggregatePass.adaptive, false);
    assert.deepEqual(
        buildProfileSummary(regressedRuns, regressedMedians)
            .failedScenarioNames,
        ['game-high-target-adaptive-camera-motion-desktop'],
    );
});

test('placement scenario resolves a deterministic staggered two-chunk run', () => {
    const scenarios = resolveScenarios('placement');

    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'game-dense-25x25-placement-desktop');
    assert.deepEqual(scenarios[0].placementProfile, {
        action: 'run',
        staggerMs: 120,
    });
    assert.match(scenarios[0].path, /placement=1/);
    assert.match(scenarios[0].path, /profile=dense/);
});

test('profile request exposes placement profiling mode', () => {
    const request = getScenarioRequest(
        '/debug/profile/game?profile=dense&quality=medium&placement=1',
    );

    assert.equal(request.gardenProfile, 'dense');
    assert.equal(request.placement, '1');
    assert.equal(request.quality, 'medium');
});

function closeupPhase(value) {
    const sample = {
        drawCallsPerRenderedFrame: value * 10,
        gpu: {
            elapsedMaxMs: value * 2,
            elapsedP95Ms: value,
            supported: value > 1,
        },
        instancedDrawCalls: value * 4,
        jsHeapMb: value * 20,
        longTaskCount: value,
        longTaskTotalMs: value * 5,
        maxFrameMs: value * 4,
        p95FrameMs: value * 3,
        renderedFps: value * 10,
        renderedFrames: 2,
        trianglesPerRenderedFrame: value * 1_000,
    };
    const cdp = {
        jsHeapMb: value * 20,
        layoutDuration: value / 100,
        scriptDuration: value / 10,
        taskDuration: value / 5,
    };
    return {
        profile: {
            milestonesMs: {
                firstDetailedChunk: value * 5,
                fullyDetailed: value * 10,
            },
            lodEvaluation: {
                durationMaxMs: value,
                durationTotalMs: value * 2,
                fieldEvaluationCount: value * 10,
                fieldProjectionTestCount: value * 4,
                groupRejectionCount: value * 2,
                groupTestCount: value * 3,
                updateCount: value,
            },
            instanceBuffers: {
                activeAllocatedBytes: value * 1_000,
                activeCapacity: value * 10,
                activeEmptyMeshCount: 0,
                activeLiveCount: value * 10,
                activeMeshCount: value,
                bufferUploadCount: value * 2,
                orphanedResourceCount: 0,
                peakAllocatedBytes: value * 2_000,
                peakCapacity: value * 20,
                releasedAllocationCount: value,
                uploadedBytes: value * 500,
            },
            pipeline: {
                packedWorker: {
                    buildCount: value,
                    buildDurationMaxMs: value,
                    buildDurationTotalMs: value * 2,
                    observed: true,
                    packingDurationMaxMs: value * 0.5,
                    packingDurationTotalMs: value,
                    renderDataBuildDurationMaxMs: value,
                    renderDataBuildDurationTotalMs: value * 2,
                    rootBatchingDurationMaxMs: value * 1.5,
                    rootBatchingDurationTotalMs: value * 3,
                    symbolGenerationDurationMaxMs: value * 2,
                    symbolGenerationDurationTotalMs: value * 4,
                    totalDurationMaxMs: value * 4,
                    totalDurationTotalMs: value * 8,
                    transferByteLengthMax: value * 500,
                    transferByteLengthTotal: value * 1_000,
                    transferCount: value,
                },
                scheduler: {
                    cancelledSubscriberCount: value,
                    deduplicatedSubscriberCount: value * 3,
                    observed: true,
                    peakQueuedTaskCount: value * 4,
                    staleResultCount: value * 2,
                },
                shaderPrewarm: {
                    deduplicated: value > 1,
                    durationMs: value * 6,
                    observed: true,
                    postSwapCompilationCount: value - 1,
                    postSwapProgramCount: value * 7,
                    programCountAfter: value * 6,
                    programCountBefore: value * 5,
                    readyAtFirstDetailSwap: true,
                    status: 'ready',
                },
                templateCache: {
                    estimatedBytes: value * 10_000,
                    evictionCount: value,
                    hitCount: value * 5,
                    missCount: value * 2,
                    observed: true,
                },
            },
            renderData: {
                activeArchetypeCount: value * 2,
                buildCount: value,
                buildDurationMaxMs: value * 3,
                buildDurationTotalMs: value * 6,
                builtPlantInstanceCount: value * 4,
                detailedPlantInstanceCount: value * 3,
                failedArchetypeCount: value - 1,
                maxArchetypeCountPerBatch: value,
            },
        },
        steady: {
            cdp,
            sample,
        },
        transition: {
            cdp,
            sample,
        },
    };
}

test('closeup medians include scheduler, template cache, and packed worker counters', () => {
    const medians = buildPlantCloseupMedians(
        [1, 3, 2].map((value, index) => ({
            baseName: 'game-plant-heavy-closeup-desktop',
            closeup: {
                cold: closeupPhase(value),
                warm: closeupPhase(value + 3),
            },
            name: `run-${index + 1}`,
        })),
    );
    const summary = medians['game-plant-heavy-closeup-desktop'];

    assert.equal(summary.runCount, 3);
    assert.equal(summary.cold.detailReadyMs, 20);
    assert.equal(summary.cold.firstDetailChunkMs, 10);
    assert.equal(summary.cold.pipeline.schedulerPeakQueuedTaskCount, 8);
    assert.equal(summary.cold.pipeline.schedulerDeduplicatedSubscriberCount, 6);
    assert.equal(summary.cold.pipeline.templateCacheHitCount, 10);
    assert.equal(summary.cold.pipeline.templateCacheEstimatedBytes, 20_000);
    assert.equal(summary.cold.pipeline.packedTransferByteLengthTotal, 2_000);
    assert.equal(
        summary.cold.pipeline.packedSymbolGenerationDurationTotalMs,
        8,
    );
    assert.equal(summary.cold.pipeline.packedRenderDataBuildDurationMaxMs, 2);
    assert.equal(summary.cold.pipeline.packedTotalDurationTotalMs, 16);
    assert.deepEqual(summary.cold.pipeline.shaderPrewarmStatusCounts, {
        ready: 3,
    });
    assert.equal(summary.cold.pipeline.shaderPrewarmDurationMs, 12);
    assert.equal(summary.cold.pipeline.shaderPrewarmDeduplicatedRunCount, 2);
    assert.equal(
        summary.cold.pipeline.shaderPrewarmPostSwapCompilationCount,
        1,
    );
    assert.equal(
        summary.cold.pipeline.shaderPrewarmReadyAtFirstDetailSwapRunCount,
        3,
    );
    assert.equal(summary.cold.renderData.activeArchetypeCount, 4);
    assert.equal(summary.cold.renderData.maxArchetypeCountPerBatch, 2);
    assert.equal(summary.cold.renderData.detailedPlantInstanceCount, 6);
    assert.equal(summary.cold.renderData.failedArchetypeCount, 1);
    assert.equal(summary.cold.lodEvaluation.durationTotalMs, 4);
    assert.equal(summary.cold.lodEvaluation.durationPerUpdateMs, 2);
    assert.equal(summary.cold.lodEvaluation.fieldProjectionTestCount, 8);
    assert.equal(summary.cold.lodEvaluation.fieldProjectionTestsPerUpdate, 4);
    assert.equal(summary.cold.lodEvaluation.groupRejectionCount, 4);
    assert.equal(summary.cold.lodEvaluation.groupRejectionRatio, 0.667);
    assert.equal(summary.cold.instanceBuffers.activeAllocatedBytes, 2_000);
    assert.equal(summary.cold.instanceBuffers.bufferUploadCount, 4);
    assert.equal(summary.cold.instanceBuffers.orphanedResourceCount, 0);
    assert.equal(summary.cold.transition.drawCallsPerRenderedFrame, 20);
    assert.equal(summary.cold.transition.instancedCallsPerRenderedFrame, 4);
    assert.equal(summary.cold.transition.trianglesPerRenderedFrame, 2_000);
    assert.equal(summary.cold.transition.cdpScriptDuration, 0.2);
    assert.equal(summary.cold.steady.gpuSupportedRunCount, 2);
    assert.equal(summary.warm.pipeline.schedulerCancelledSubscriberCount, 5);
    assert.equal(summary.warm.pipeline.packedBuildDurationTotalMs, 10);
});
