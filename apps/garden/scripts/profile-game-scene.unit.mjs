import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyGardenBuildingMatchedBaselineComparison,
    beginGardenSwitchProfileSample,
    beginInteractiveProfileSample,
    buildAdaptiveHighComparisons,
    buildCrossTierMedians,
    buildGardenBuildingMatchedBaselineComparison,
    buildGardenSwitchBudgets,
    buildGardenSwitchSummary,
    buildHighTargetMedians,
    buildLifecycleResumeTransitionEvidence,
    buildLifecycleResumeWindowEvidence,
    buildLifecycleSummary,
    buildLifecycleSuspendTransitionEvidence,
    buildMarkdown,
    buildPlantCloseupAcceptance,
    buildPlantCloseupMedians,
    buildProfileSummary,
    buildReportProvenance,
    buildScenarioRunQueue,
    buildStaticIdleEvidence,
    buildStaticSceneCacheComparisons,
    buildStaticSceneCacheVisualComparisons,
    buildWeatherSurfaceComparisons,
    collectScenarioMemoryEvidence,
    drainProfileSample,
    evaluateBudget,
    evaluateCrossTierAcceptance,
    evaluateFaunaHeavyAcceptance,
    evaluateGardenBuildingAcceptance,
    evaluateGardenSwitchAcceptance,
    evaluateHighTargetAcceptance,
    evaluateLifecycleAcceptance,
    evaluateRuntimeOwnersAcceptance,
    evaluateStaticIdleAcceptance,
    finalizeProfileSampleAtEndpoint,
    finishInteractiveProfileSample,
    fullRuntimeFrameLoopCounterFields,
    gameCameraSnapshotMaximumDelta,
    getScenarioRequest,
    installBrowserMetrics,
    installGardenSwitchContextTracker,
    installLifecycleMilestoneTracker,
    installProfileContextTracker,
    isExpectedGardenBuildingProfileApiError,
    isExpectedGardenBuildingProfileConsoleError,
    isIgnoredLocalProfilerConsoleError,
    isLifecycleRendererStatsBarrierReady,
    isLifecycleRendererStatsMeasurementValid,
    isOutlineProfileTelemetryReady,
    isProfileScreenshotWitnessValid,
    lifecycleOwnedSchedulingZeroObserved,
    lifecycleRendererStatsCanonicalMode,
    lifecycleRendererStatsLegacyMode,
    lifecycleZeroWorkObserved,
    measureStaticSceneCacheImageParity,
    mergeGardenStructureAssetNetworkRuntime,
    mergeProfileSampleDrain,
    normalizeRenderLeaseSummaryRates,
    normalizeRenderWork,
    parseArgs,
    parseComparisonContractVersion,
    primeGardenSwitchProfileSample,
    resolveBoundedCameraMotionCycle,
    resolveChromiumGraphicsArgs,
    resolveChromiumGraphicsBackend,
    resolveLifecycleRendererStatsCaptureMode,
    resolveScenarios,
    shouldFailProfileRun,
    shouldObserveRuntimeFrameLoopDuringRaf,
    shouldReadRuntimeOwnerLeaseRafSnapshot,
    summarizeGardenStructureAssetNetwork,
} from './profile-game-scene.mjs';

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

test('full scheduler snapshots are sampled per RAF only for runtime-owner acceptance', () => {
    const countRafSnapshotReads = (runtimeOwnerLeaseExpectations) => {
        let readCount = 0;
        const readFullSnapshot = () => {
            readCount += 1;
            return { renderLeaseSummaries: [] };
        };
        for (let frame = 0; frame < 120; frame += 1) {
            if (
                shouldReadRuntimeOwnerLeaseRafSnapshot(
                    runtimeOwnerLeaseExpectations,
                )
            ) {
                readFullSnapshot();
            }
        }
        return readCount;
    };

    assert.equal(countRafSnapshotReads(null), 0);
    assert.equal(countRafSnapshotReads(undefined), 0);
    assert.equal(
        countRafSnapshotReads({
            'camera-interaction': 60,
            'plant-sway': 30,
        }),
        120,
    );
});

test('scheduler scalar telemetry is observed per RAF when acceptance needs extrema', () => {
    assert.equal(
        shouldObserveRuntimeFrameLoopDuringRaf({
            buildingProfile: undefined,
            crossTierProfile: false,
            runtimeOwnersProfile: false,
        }),
        false,
    );
    assert.equal(
        shouldObserveRuntimeFrameLoopDuringRaf({
            buildingProfile: { frameRateClass: 'ambient' },
            crossTierProfile: false,
            runtimeOwnersProfile: false,
        }),
        true,
    );
    assert.equal(
        shouldObserveRuntimeFrameLoopDuringRaf({
            buildingProfile: { frameRateClass: 'interactive' },
            crossTierProfile: false,
            runtimeOwnersProfile: false,
        }),
        false,
    );
    assert.equal(
        shouldObserveRuntimeFrameLoopDuringRaf({
            buildingProfile: undefined,
            crossTierProfile: false,
            runtimeOwnersProfile: true,
        }),
        true,
    );
    assert.equal(
        shouldObserveRuntimeFrameLoopDuringRaf({
            buildingProfile: undefined,
            crossTierProfile: true,
            runtimeOwnersProfile: false,
        }),
        true,
    );
});

const provenanceCommitA = 'a'.repeat(40);
const provenanceCommitB = 'b'.repeat(40);
const cleanServedBuildMarker = {
    commit: provenanceCommitA,
    comparisonContractVersion: 4,
    dirty: false,
};

function profileProvenance(overrides = {}) {
    return buildReportProvenance({
        harness: {
            commit: provenanceCommitA,
            dirty: false,
        },
        runtime: {
            arch: 'arm64',
            browserVersion: '140.0.0.0',
            nodeVersion: 'v24.15.0',
            platform: 'darwin',
        },
        scenarios: [
            {
                requested: { gardenProfile: 'high-target' },
                servedBuildProvenance: cleanServedBuildMarker,
            },
            {
                requested: { gardenSwitchProfile: true },
                servedBuildProvenance: cleanServedBuildMarker,
            },
            {
                requested: { lifecycleProfile: true },
                servedBuildProvenance: cleanServedBuildMarker,
            },
        ],
        server: {
            buildPerformed: true,
            mode: 'managed',
        },
        ...overrides,
    });
}

test('report provenance validates regular, switch, and lifecycle served-build markers', () => {
    assert.deepEqual(profileProvenance(), {
        comparable: true,
        reasons: [],
        subject: {
            commit: provenanceCommitA,
            dirty: false,
            source: 'served-build-marker',
        },
        harness: {
            commit: provenanceCommitA,
            dirty: false,
        },
        runtime: {
            arch: 'arm64',
            browserVersion: '140.0.0.0',
            nodeVersion: 'v24.15.0',
            platform: 'darwin',
        },
        server: {
            buildPerformed: true,
            mode: 'managed',
        },
    });
});

test('report provenance allows a clean external subject to differ from its clean harness', () => {
    const provenance = profileProvenance({
        harness: { commit: provenanceCommitB, dirty: false },
        server: {
            buildPerformed: false,
            mode: 'external',
        },
    });

    assert.equal(provenance.comparable, true);
    assert.deepEqual(provenance.reasons, []);
    assert.equal(provenance.subject.commit, provenanceCommitA);
    assert.equal(provenance.harness.commit, provenanceCommitB);
    assert.deepEqual(provenance.server, {
        buildPerformed: false,
        mode: 'external',
    });
});

test('comparison contract markers require one complete canonical integer', () => {
    assert.equal(parseComparisonContractVersion('1'), 1);
    assert.equal(parseComparisonContractVersion('12'), 12);
    for (const malformed of [
        null,
        '',
        '0',
        '01',
        '1.0',
        '1-invalid',
        ' 1 ',
        String(Number.MAX_SAFE_INTEGER + 1),
    ]) {
        assert.equal(parseComparisonContractVersion(malformed), null);
    }
});

test('report provenance fails closed for unknown or dirty sources', () => {
    const unknown = profileProvenance({
        harness: { commit: 'unknown', dirty: null },
        scenarios: [
            {
                servedBuildProvenance: {
                    commit: 'unknown',
                    comparisonContractVersion: null,
                    dirty: null,
                },
            },
        ],
    });
    assert.equal(unknown.comparable, false);
    assert.deepEqual(unknown.subject, {
        commit: null,
        dirty: null,
        source: 'served-build-marker',
    });
    assert.ok(unknown.reasons.includes('served-build-source-commit-unknown'));
    assert.ok(unknown.reasons.includes('served-build-dirty-state-unknown'));
    assert.ok(
        unknown.reasons.includes('served-build-comparison-contract-unknown'),
    );
    assert.ok(unknown.reasons.includes('harness-source-commit-unknown'));
    assert.ok(unknown.reasons.includes('harness-dirty-state-unknown'));

    const dirty = profileProvenance({
        harness: { commit: provenanceCommitA, dirty: true },
        scenarios: [
            {
                servedBuildProvenance: {
                    ...cleanServedBuildMarker,
                    dirty: true,
                },
            },
        ],
    });
    assert.equal(dirty.comparable, false);
    assert.ok(dirty.reasons.includes('served-build-dirty'));
    assert.ok(dirty.reasons.includes('harness-dirty'));
});

test('report provenance rejects served-build, managed harness, and contract mismatches', () => {
    const provenance = profileProvenance({
        scenarios: [
            { servedBuildProvenance: cleanServedBuildMarker },
            {
                servedBuildProvenance: {
                    ...cleanServedBuildMarker,
                    commit: provenanceCommitB,
                },
            },
            {
                servedBuildProvenance: {
                    ...cleanServedBuildMarker,
                    comparisonContractVersion: 5,
                },
            },
        ],
    });

    assert.equal(provenance.comparable, false);
    assert.equal(provenance.subject.commit, null);
    assert.ok(
        provenance.reasons.includes('served-build-source-commit-inconsistent'),
    );
    assert.ok(
        provenance.reasons.includes(
            'served-build-comparison-contract-mismatch',
        ),
    );

    const harnessMismatch = profileProvenance({
        harness: { commit: provenanceCommitB, dirty: false },
    });
    assert.equal(harnessMismatch.comparable, false);
    assert.ok(harnessMismatch.reasons.includes('source-commit-mismatch'));
});

test('external report provenance still rejects served-build and contract mismatches', () => {
    const externalServer = {
        buildPerformed: false,
        mode: 'external',
    };
    const servedBuildMismatch = profileProvenance({
        harness: { commit: provenanceCommitB, dirty: false },
        scenarios: [
            { servedBuildProvenance: cleanServedBuildMarker },
            {
                servedBuildProvenance: {
                    ...cleanServedBuildMarker,
                    commit: provenanceCommitB,
                },
            },
        ],
        server: externalServer,
    });
    assert.equal(servedBuildMismatch.comparable, false);
    assert.ok(
        servedBuildMismatch.reasons.includes(
            'served-build-source-commit-inconsistent',
        ),
    );
    assert.equal(
        servedBuildMismatch.reasons.includes('source-commit-mismatch'),
        false,
    );

    const contractMismatch = profileProvenance({
        harness: { commit: provenanceCommitB, dirty: false },
        scenarios: [
            {
                servedBuildProvenance: {
                    ...cleanServedBuildMarker,
                    comparisonContractVersion: 5,
                },
            },
        ],
        server: externalServer,
    });
    assert.equal(contractMismatch.comparable, false);
    assert.ok(
        contractMismatch.reasons.includes(
            'served-build-comparison-contract-mismatch',
        ),
    );
    assert.equal(
        contractMismatch.reasons.includes('source-commit-mismatch'),
        false,
    );
});

test('budget-enforced profiling fails closed for incomparable provenance', () => {
    const passingSummary = { failedScenarios: 0 };

    assert.equal(
        shouldFailProfileRun({
            failOnBudget: true,
            profileSummary: passingSummary,
            provenance: profileProvenance(),
        }),
        false,
    );
    assert.equal(
        shouldFailProfileRun({
            failOnBudget: true,
            profileSummary: passingSummary,
            provenance: profileProvenance({
                harness: { commit: provenanceCommitA, dirty: true },
            }),
        }),
        true,
    );
    assert.equal(
        shouldFailProfileRun({
            failOnBudget: true,
            profileSummary: { failedScenarios: 1 },
            provenance: profileProvenance(),
        }),
        true,
    );
    assert.equal(
        shouldFailProfileRun({
            failOnBudget: false,
            profileSummary: passingSummary,
            provenance: { comparable: false },
        }),
        false,
    );
    assert.equal(
        shouldFailProfileRun({
            failOnBudget: true,
            profileSummary: {},
            provenance: profileProvenance(),
        }),
        true,
    );
});

test('closeup acceptance rejects synchronous worker fallback', () => {
    const phase = (syncFallbackTaskCount) => ({
        detailOutcome: 'ready',
        profile: {
            generation: {
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

test('building scenario set covers gated normal, editing, worst-case, weather, and lifecycle workloads', () => {
    const scenarios = resolveScenarios('buildings');
    assert.equal(scenarios.length, 14);
    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
            'game-building-no-structure-network-baseline-mobile',
            'game-building-no-structure-network-baseline-desktop',
            'game-building-empty-shell-desktop',
            'game-building-empty-shell-constrained-mobile',
            'game-building-furnished-house-normal-constrained-mobile',
            'game-building-dense-garden-house-mixed-production-mobile',
            'game-building-shell-edit-constrained-mobile',
            'game-building-interior-edit-cutaway-constrained-mobile',
            'game-building-greenhouse-rain-constrained-mobile',
            'game-building-worst-case-furnished-constrained-mobile',
            'game-building-house-two-view-navigation-constrained-mobile',
            'game-building-worst-case-furnished-cutaway-constrained-mobile',
            'game-building-worst-case-edit-churn-constrained-mobile',
            'game-building-enter-exit-lifecycle-constrained-mobile',
        ],
    );
    const matchedDesktop = scenarios.filter((scenario) =>
        [
            'game-building-no-structure-network-baseline-desktop',
            'game-building-empty-shell-desktop',
        ].includes(scenario.name),
    );
    assert.deepEqual(
        matchedDesktop.map((scenario) => ({
            budget: scenario.budget,
            dpr: scenario.dpr,
            frameRateClass: scenario.buildingProfile.frameRateClass,
            isMobile: scenario.isMobile,
            viewport: scenario.viewport,
        })),
        [
            {
                budget: 'gardenBuildingHeadlessAmbientDesktop',
                dpr: 1,
                frameRateClass: 'ambient',
                isMobile: false,
                viewport: { height: 720, width: 1280 },
            },
            {
                budget: 'gardenBuildingHeadlessAmbientDesktop',
                dpr: 1,
                frameRateClass: 'ambient',
                isMobile: false,
                viewport: { height: 720, width: 1280 },
            },
        ],
    );
    assert.equal(
        matchedDesktop[0].path,
        matchedDesktop[1].path.replace('&building=1&buildingFixture=blank', ''),
    );
    assert.ok(
        [scenarios[0], ...matchedDesktop].every(
            (scenario) =>
                new URL(scenario.path, 'http://profile.local').searchParams.get(
                    'cameraProfile',
                ) === '1',
        ),
    );
    assert.ok(
        scenarios
            .filter((scenario) => scenario.buildingProfile.fixture !== 'none')
            .every(
                (scenario) =>
                    scenario.path.includes('building=1') &&
                    scenario.path.includes('staticSceneCache=legacy') &&
                    scenario.buildingProfile,
            ),
    );
    const mobileBaseline = scenarios[0];
    assert.equal(
        mobileBaseline.name,
        'game-building-no-structure-network-baseline-mobile',
    );
    assert.equal(mobileBaseline.isMobile, true);
    assert.equal(mobileBaseline.buildingProfile.frameRateClass, 'ambient');
    const worstCase = scenarios.find((scenario) =>
        scenario.name.includes('worst-case-furnished'),
    );
    assert.deepEqual(worstCase?.buildingProfile.expected, {
        edges: 301,
        footprintCells: 100,
        normalVisibleProps: 34,
        props: 100,
        roofs: 100,
    });
    assert.equal(worstCase?.isMobile, true);
    assert.equal(worstCase?.navigatorMetrics.deviceMemory, 4);
    assert.equal(worstCase?.navigatorMetrics.hardwareConcurrency, 4);
    assert.match(worstCase?.path ?? '', /avatar=1/);
    assert.equal(worstCase?.buildingProfile.motion, 'avatar-navigation');
    assert.equal(
        scenarios.find((scenario) => scenario.name.includes('greenhouse-rain'))
            ?.buildingProfile.expected.normalVisibleProps,
        2,
    );
    assert.equal(
        scenarios.find((scenario) => scenario.name.includes('house-normal'))
            ?.buildingProfile.expected.normalVisibleProps,
        0,
    );
    const twoViewNavigation = scenarios.find((scenario) =>
        scenario.name.includes('two-view-navigation'),
    );
    assert.deepEqual(
        twoViewNavigation?.buildingProfile.avatarNavigation.legs.map(
            (leg) => leg.view,
        ),
        ['third-person', 'first-person'],
    );
    assert.equal(
        scenarios.find((scenario) =>
            scenario.name.includes('furnished-cutaway'),
        )?.buildingProfile.cutaway,
        true,
    );
    assert.equal(scenarios[0].buildingProfile.fixture, 'none');
    assert.equal(getScenarioRequest(scenarios[0].path).building, '0');
    assert.equal(
        scenarios.find((scenario) => scenario.name.includes('mixed-production'))
            ?.buildingProfile.workload,
        'mixed-production',
    );
});

test('exact blank-shell selection automatically includes its matched desktop baseline', () => {
    assert.deepEqual(
        resolveScenarios('game-building-empty-shell-desktop').map(
            (scenario) => scenario.name,
        ),
        [
            'game-building-no-structure-network-baseline-desktop',
            'game-building-empty-shell-desktop',
        ],
    );
    assert.deepEqual(
        resolveScenarios('ignored', [
            'game-building-empty-shell-desktop',
            'game-building-no-structure-network-baseline-desktop',
        ]).map((scenario) => scenario.name),
        [
            'game-building-no-structure-network-baseline-desktop',
            'game-building-empty-shell-desktop',
        ],
    );
});

test('building asset network summary preserves exact response and resource timing', () => {
    const url =
        'http://localhost:3001/assets/models/GardenStructureKitV1.glb?v=abc';
    assert.deepEqual(
        summarizeGardenStructureAssetNetwork(
            [
                {
                    bodyBytes: 364_684,
                    fromServiceWorker: false,
                    status: 200,
                    url,
                },
            ],
            [
                {
                    decodedBodySize: 364_684,
                    duration: 18.25,
                    encodedBodySize: 364_684,
                    name: url,
                    responseEnd: 31.5,
                    responseStart: 13.25,
                    startTime: 10,
                    transferSize: 364_984,
                },
            ],
        ),
        {
            gardenStructureAssetNetworkBytesRequested: 364_684,
            gardenStructureAssetRequestCount: 1,
            gardenStructureAssetResponseBodyBytes: 364_684,
            gardenStructureAssetResponseFromServiceWorker: false,
            gardenStructureAssetResponseStatus: 200,
            gardenStructureAssetResponseUrl: url,
            gardenStructureAssetResourceDecodedBodyBytes: 364_684,
            gardenStructureAssetResourceDurationMs: 18.25,
            gardenStructureAssetResourceEncodedBodyBytes: 364_684,
            gardenStructureAssetResourceResponseEndMs: 31.5,
            gardenStructureAssetResourceResponseStartMs: 13.25,
            gardenStructureAssetResourceStartMs: 10,
            gardenStructureAssetResourceTransferBytes: 364_984,
            gardenStructureAssetResourceUrl: url,
        },
    );
    assert.equal(
        summarizeGardenStructureAssetNetwork([], [])
            .gardenStructureAssetRequestCount,
        0,
    );
    const retried = summarizeGardenStructureAssetNetwork(
        [
            {
                bodyBytes: 100,
                fromServiceWorker: false,
                status: 200,
                url,
            },
            {
                bodyBytes: 200,
                fromServiceWorker: false,
                status: 200,
                url,
            },
        ],
        [],
    );
    assert.equal(retried.gardenStructureAssetNetworkBytesRequested, 300);
    assert.equal(retried.gardenStructureAssetResponseBodyBytes, 200);
});

test('building asset network merge leaves non-building runtime unchanged', () => {
    const runtime = { qualityTier: 'medium' };
    assert.equal(
        mergeGardenStructureAssetNetworkRuntime({
            buildingProfile: null,
            resources: [],
            responses: [],
            runtime,
        }),
        runtime,
    );
    assert.deepEqual(
        mergeGardenStructureAssetNetworkRuntime({
            buildingProfile: { fixture: 'none' },
            resources: [],
            responses: [],
            runtime,
        }),
        {
            gardenStructureAssetNetworkBytesRequested: 0,
            gardenStructureAssetRequestCount: 0,
            gardenStructureAssetResponseBodyBytes: null,
            gardenStructureAssetResponseFromServiceWorker: null,
            gardenStructureAssetResponseStatus: null,
            gardenStructureAssetResponseUrl: null,
            gardenStructureAssetResourceDecodedBodyBytes: null,
            gardenStructureAssetResourceDurationMs: null,
            gardenStructureAssetResourceEncodedBodyBytes: null,
            gardenStructureAssetResourceResponseEndMs: null,
            gardenStructureAssetResourceResponseStartMs: null,
            gardenStructureAssetResourceStartMs: null,
            gardenStructureAssetResourceTransferBytes: null,
            gardenStructureAssetResourceUrl: null,
            qualityTier: 'medium',
        },
    );
});

test('building acceptance enforces bounded privacy-safe telemetry and editor budgets', () => {
    const result = evaluateGardenBuildingAcceptance({
        apiRequests: [{ method: 'GET', url: 'http://localhost/api/garden' }],
        requested: {
            building: '1',
            buildingFixture: 'worst-case',
            buildingProfile: {
                expected: {
                    edges: 301,
                    footprintCells: 100,
                    props: 100,
                    roofs: 100,
                },
                fixture: 'worst-case',
                mode: 'editing',
                motion: 'edit-churn',
                motionResult: { actionCount: 9, kind: 'edit-churn' },
            },
            staticSceneCache: 'legacy',
        },
        runtime: {
            gardenStructureAssetBytesResident: 96_000,
            gardenStructureAssetRequestCount: 1,
            gardenStructureAssetResolutionIssueCount: 0,
            gardenStructureAssetResolutionStatus: 'resolved',
            gardenStructureAssetUnresolvedBatchCount: 0,
            gardenStructureAssetUrl:
                '/assets/models/GardenStructureKitV1.glb?v=abc',
            gardenStructureAssetResponseBodyBytes: 364_684,
            gardenStructureAssetResponseStatus: 200,
            gardenStructureAssetResponseUrl:
                'http://localhost/assets/models/GardenStructureKitV1.glb?v=abc',
            gardenStructureAssetResourceDurationMs: 12,
            gardenStructureAssetResourceUrl:
                'http://localhost/assets/models/GardenStructureKitV1.glb?v=abc',
            gardenStructureCompileCount: 4,
            gardenStructureCompileDurationMs: 4.2,
            gardenStructureCompileDurationMaxMs: 4.2,
            gardenStructureDocumentPayloadBytes: 56_759,
            gardenStructureEdgeCount: 301,
            gardenStructureEditorActionCount: 12,
            gardenStructureEditorActionDurationMaxMs: 42,
            gardenStructureEditorActionDurationP95Ms: 24,
            gardenStructureEditorActive: true,
            gardenStructureEditorPointerResolutionCount: 1,
            gardenStructureEditorPointerResolutionMaxMs: 3,
            gardenStructureExteriorSuppressedPropCount: 0,
            gardenStructureFootprintCellCount: 100,
            gardenStructureNavigationCompileDurationMs: 2.1,
            gardenStructureNavigationCompileDurationMaxMs: 2.1,
            gardenStructurePlanCacheLookupDurationMs: 0.1,
            gardenStructurePlanCacheLookupDurationMaxMs: 0.1,
            gardenStructurePlanCacheEvictionCount: 0,
            gardenStructureFallbackDrawCount: 0,
            gardenStructurePreviewDrawCount: 1,
            gardenStructureProductionAttributeBytes: 40_000,
            gardenStructureProductionDrawCount: 12,
            gardenStructureProductionIndexBytes: 8_000,
            gardenStructureProductionInstanceBufferBytes: 48_000,
            gardenStructureProductionOpaqueDrawCount: 9,
            gardenStructureProductionTextureCount: 0,
            gardenStructureProductionTextureEstimatedBytes: 0,
            gardenStructureProductionTransparentDrawCount: 3,
            gardenStructureProductionTriangleCount: 400_000,
            gardenStructureProductionVertexCount: 600_000,
            gardenStructurePropCount: 100,
            gardenStructureRoofRegionCount: 100,
            gardenStructureStructureCount: 1,
            gardenStructureVisiblePropCount: 100,
            gardenStructureVisibleStructureCount: 1,
        },
    });
    assert.equal(result.pass, true);
    assert.ok(result.checks.every((check) => check.pass));

    const compileMaximumRegression = evaluateGardenBuildingAcceptance({
        apiRequests: [],
        requested: {
            building: '1',
            buildingFixture: 'house',
            buildingProfile: {
                expected: {
                    edges: 15,
                    footprintCells: 12,
                    props: 1,
                    roofs: 2,
                },
                fixture: 'house',
                mode: 'normal',
            },
        },
        runtime: {
            gardenStructureCompileDurationMs: 0,
            gardenStructureCompileDurationMaxMs: 101,
        },
    });
    assert.deepEqual(
        compileMaximumRegression.checks.find(
            (check) => check.name === 'buildingCompileDurationMs',
        ),
        {
            actual: 101,
            limit: 100,
            name: 'buildingCompileDurationMs',
            pass: false,
        },
    );

    const lookupMaximumRegression = evaluateGardenBuildingAcceptance({
        apiRequests: [],
        requested: {
            building: '1',
            buildingFixture: 'house',
            buildingProfile: {
                expected: {
                    edges: 15,
                    footprintCells: 12,
                    props: 1,
                    roofs: 2,
                },
                fixture: 'house',
                mode: 'normal',
            },
        },
        runtime: {
            gardenStructurePlanCacheLookupDurationMs: 0,
            gardenStructurePlanCacheLookupDurationMaxMs: 101,
        },
    });
    assert.deepEqual(
        lookupMaximumRegression.checks.find(
            (check) => check.name === 'buildingPlanCacheLookupDurationMs',
        ),
        {
            actual: 101,
            limit: 100,
            name: 'buildingPlanCacheLookupDurationMs',
            pass: false,
        },
    );

    const privateOrSlow = evaluateGardenBuildingAcceptance({
        apiRequests: [{ method: 'POST', url: 'http://localhost/api/garden' }],
        requested: {
            building: '1',
            buildingFixture: 'worst-case',
            buildingProfile: {
                expected: {
                    edges: 301,
                    footprintCells: 100,
                    props: 100,
                    roofs: 100,
                },
                fixture: 'worst-case',
                mode: 'editing',
            },
            staticSceneCache: 'legacy',
        },
        runtime: {
            gardenStructureDocument: { private: true },
            gardenStructureEditorActionDurationMaxMs: 501,
        },
    });
    assert.equal(privateOrSlow.pass, false);
    assert.ok(
        privateOrSlow.checks.some(
            (check) =>
                check.name === 'buildingProfileOmitsDocument' && !check.pass,
        ),
    );
    assert.ok(
        privateOrSlow.checks.some(
            (check) =>
                check.name === 'buildingNoMutationRequests' && !check.pass,
        ),
    );
});

test('building acceptance proves the no-structure baseline made no GLB request', () => {
    const result = evaluateGardenBuildingAcceptance({
        apiRequests: [],
        requested: {
            building: '0',
            buildingProfile: {
                expected: {
                    edges: 0,
                    footprintCells: 0,
                    props: 0,
                    roofs: 0,
                },
                fixture: 'none',
                mode: 'normal',
            },
            staticSceneCache: 'legacy',
        },
        runtime: {
            gardenStructureAssetNetworkBytesRequested: 0,
            gardenStructureAssetRequestCount: 0,
        },
    });
    assert.equal(result.pass, true);
    assert.ok(result.checks.every((check) => check.pass));
});

test('building acceptance rejects unexpected runtime failures while allowing exact signed-out fixture reads', () => {
    const input = {
        apiRequests: [],
        requested: {
            building: '0',
            buildingProfile: {
                expected: {
                    edges: 0,
                    footprintCells: 0,
                    props: 0,
                    roofs: 0,
                },
                fixture: 'none',
                mode: 'normal',
            },
            staticSceneCache: 'legacy',
        },
        runtime: {
            gardenStructureAssetNetworkBytesRequested: 0,
            gardenStructureAssetRequestCount: 0,
        },
    };
    const expectedSignedOutErrors = [
        '/api/gredice/api/users/current',
        '/api/gredice/api/accounts/current',
        '/api/gredice/api/accounts/current/sunflowers',
        '/api/gredice/api/accounts/current/tutorial-checklist',
        '/api/gredice/api/gardens/99999/operations?cursor=0',
    ].map((path) => ({
        status: 401,
        url: `http://localhost:3101${path}`,
    }));
    const expectedSignedOutConsoleErrors = expectedSignedOutErrors.map(
        (error) => ({
            type: 'error',
            text: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
            url: error.url,
        }),
    );
    const expectedNoise = evaluateGardenBuildingAcceptance({
        ...input,
        apiErrors: expectedSignedOutErrors,
        consoleMessages: [
            ...expectedSignedOutConsoleErrors,
            {
                type: 'error',
                text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
                url: 'http://127.0.0.1:3101/_vercel/insights/script.js',
            },
            {
                type: 'warning',
                text: 'THREE.Clock is deprecated',
                url: 'http://localhost:3101/app.js',
            },
        ],
        pageErrors: [],
    });
    assert.equal(expectedNoise.pass, true);
    assert.deepEqual(
        expectedNoise.checks
            .filter((check) => check.name.startsWith('buildingUnexpected'))
            .map(({ actual, name, pass }) => ({ actual, name, pass })),
        [
            {
                actual: 0,
                name: 'buildingUnexpectedApiErrors',
                pass: true,
            },
            {
                actual: 0,
                name: 'buildingUnexpectedConsoleErrors',
                pass: true,
            },
        ],
    );

    const unexpectedFailures = evaluateGardenBuildingAcceptance({
        ...input,
        apiRequests: [
            {
                method: 'POST',
                url: expectedSignedOutErrors[0].url,
            },
        ],
        apiErrors: [
            ...expectedSignedOutErrors,
            {
                status: 500,
                url: 'http://localhost:3101/api/gredice/api/directories/entities/plantSort',
            },
        ],
        consoleMessages: [
            ...expectedSignedOutConsoleErrors,
            {
                type: 'error',
                text: 'THREE.WebGLProgram: Shader Error',
                url: 'http://localhost:3101/app.js',
            },
        ],
        pageErrors: ['render failed'],
    });
    assert.equal(unexpectedFailures.pass, false);
    assert.ok(
        unexpectedFailures.checks.some(
            (check) =>
                check.name === 'buildingNoMutationRequests' && !check.pass,
        ),
    );
    assert.deepEqual(
        unexpectedFailures.checks
            .filter((check) =>
                [
                    'buildingUnexpectedApiErrors',
                    'buildingUnexpectedConsoleErrors',
                    'buildingPageErrors',
                ].includes(check.name),
            )
            .map(({ actual, name, pass }) => ({ actual, name, pass })),
        [
            {
                actual: 1,
                name: 'buildingUnexpectedApiErrors',
                pass: false,
            },
            {
                actual: 1,
                name: 'buildingUnexpectedConsoleErrors',
                pass: false,
            },
            { actual: 1, name: 'buildingPageErrors', pass: false },
        ],
    );
});

test('building ambient acceptance proves stable semantic 30 FPS ownership', () => {
    const requested = {
        building: '0',
        buildingProfile: {
            expected: {
                edges: 0,
                footprintCells: 0,
                props: 0,
                roofs: 0,
            },
            fixture: 'none',
            frameRateClass: 'ambient',
            mode: 'normal',
        },
        staticSceneCache: 'legacy',
    };
    const ambientSchedulerSnapshot = () => ({
        activeLeaseCount: 3,
        activeRenderLeaseCount: 3,
        coalescedRenderRequestReasons: [],
        effectiveVisible: true,
        renderLeaseOwners: ['cloud-layer', 'plant-sway'],
        renderLeaseSummaries: [
            { framesPerSecond: 30, leaseCount: 1, owner: 'cloud-layer' },
            { framesPerSecond: 30, leaseCount: 2, owner: 'plant-sway' },
        ],
        renderRequestReasons: [],
        targetFramesPerSecond: 30,
    });
    const buildInput = () => ({
        apiRequests: [],
        requested,
        runtime: {
            runtimeFrameLoop: {
                activeLeaseCount: 3,
                targetFramesPerSecond: 30,
            },
        },
        sample: {
            runtimeFrameLoopActiveLeaseCountAtEnd: 3,
            runtimeFrameLoopActiveLeaseCountAtStart: 3,
            runtimeFrameLoopActiveLeaseCountMax: 3,
            runtimeFrameLoopAtEnd: ambientSchedulerSnapshot(),
            runtimeFrameLoopAtStart: ambientSchedulerSnapshot(),
            runtimeFrameLoopCounterDeltas: {
                hiddenDeferredCoalescedRenderRequestCount: 0,
                hiddenCoalescedRenderRequestCount: 0,
            },
            runtimeFrameLoopObservationCount: 301,
            runtimeFrameLoopTargetFramesPerSecondAtEnd: 30,
            runtimeFrameLoopTargetFramesPerSecondAtStart: 30,
            runtimeFrameLoopTargetFramesPerSecondMax: 30,
        },
    });
    const failedAmbientChecks = (input) =>
        new Set(
            evaluateGardenBuildingAcceptance(input)
                .checks.filter(
                    (check) =>
                        check.name.startsWith('buildingAmbient') && !check.pass,
                )
                .map((check) => check.name),
        );
    const expectFailedChecks = (mutate, expectedNames) => {
        const input = buildInput();
        mutate(input);
        const failures = failedAmbientChecks(input);
        for (const name of expectedNames) {
            assert.equal(failures.has(name), true, `${name} must fail`);
        }
    };

    const passing = evaluateGardenBuildingAcceptance(buildInput());
    assert.equal(passing.pass, true);

    const allowedCoalescedRequest = buildInput();
    for (const snapshot of [
        allowedCoalescedRequest.sample.runtimeFrameLoopAtStart,
        allowedCoalescedRequest.sample.runtimeFrameLoopAtEnd,
    ]) {
        snapshot.coalescedRenderRequestReasons = ['r3f-root-update'];
    }
    assert.equal(
        evaluateGardenBuildingAcceptance(allowedCoalescedRequest).pass,
        true,
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopCounterDeltas.hiddenDeferredCoalescedRenderRequestCount = 1;
        },
        ['buildingAmbientHiddenDeferredCoalescedRenderRequestCountDelta'],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopCounterDeltas.hiddenCoalescedRenderRequestCount = 1;
        },
        ['buildingAmbientHiddenCoalescedRenderRequestCountDelta'],
    );

    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopTargetFramesPerSecondMax = 60;
        },
        ['buildingAmbientSampleMaximumTargetFramesPerSecond'],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopAtEnd.effectiveVisible = false;
        },
        [
            'buildingAmbientSampleEndVisible',
            'buildingAmbientSampleEndSchedulerSettled',
        ],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopAtEnd.coalescedRenderRequestReasons = [
                'unexpected-root-update',
            ];
        },
        [
            'buildingAmbientSampleEndCoalescedRenderRequestReasonsBounded',
            'buildingAmbientSampleEndSchedulerSettled',
        ],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopAtStart.coalescedRenderRequestReasons =
                ['r3f-root-update', 'r3f-root-update'];
        },
        [
            'buildingAmbientSampleStartCoalescedRenderRequestReasonsBounded',
            'buildingAmbientSampleStartSchedulerSettled',
        ],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopAtEnd.renderRequestReasons = [
                'profile-outline-command',
            ];
        },
        [
            'buildingAmbientSampleEndRenderRequestsDrained',
            'buildingAmbientSampleEndSchedulerSettled',
        ],
    );
    expectFailedChecks(
        (input) => {
            const snapshots = [
                input.sample.runtimeFrameLoopAtStart,
                input.sample.runtimeFrameLoopAtEnd,
            ];
            for (const snapshot of snapshots) {
                snapshot.activeLeaseCount = 4;
                snapshot.activeRenderLeaseCount = 4;
                snapshot.renderLeaseOwners.push('camera-interaction');
                snapshot.renderLeaseOwners.sort();
                snapshot.renderLeaseSummaries.push({
                    framesPerSecond: 60,
                    leaseCount: 1,
                    owner: 'camera-interaction',
                });
                snapshot.renderLeaseSummaries.sort((left, right) =>
                    left.owner.localeCompare(right.owner),
                );
            }
            input.sample.runtimeFrameLoopActiveLeaseCountAtStart = 4;
            input.sample.runtimeFrameLoopActiveLeaseCountMax = 4;
            input.sample.runtimeFrameLoopActiveLeaseCountAtEnd = 4;
        },
        [
            'buildingAmbientSampleStartMaximumLeaseFramesPerSecond',
            'buildingAmbientSampleStartInteractiveOwnerCount',
            'buildingAmbientSampleEndMaximumLeaseFramesPerSecond',
            'buildingAmbientSampleEndInteractiveOwnerCount',
        ],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopAtEnd.activeLeaseCount = 4;
        },
        ['buildingAmbientSampleEndLeaseCountsReconciled'],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopActiveLeaseCountMax = 4;
        },
        [
            'buildingAmbientSampleMaximumActiveLeaseCount',
            'buildingAmbientSemanticLeaseCountStable',
        ],
    );
    expectFailedChecks(
        (input) => {
            input.sample.runtimeFrameLoopAtEnd.renderLeaseOwners = [
                'plant-sway',
                'weather-animation',
            ];
            input.sample.runtimeFrameLoopAtEnd.renderLeaseSummaries[0].owner =
                'weather-animation';
        },
        ['buildingAmbientLeaseSummariesStable'],
    );
});

test('building matched baseline comparison tolerates bounded profiler noise', () => {
    const scenarios = [
        {
            budget: { checks: [], pass: true },
            name: 'game-building-no-structure-network-baseline-desktop',
            sample: {
                drawCallsPerRenderedFrame: 100,
                gpu: { elapsedP95Ms: 2, valid: true },
                p95FrameMs: 27,
                renderedFps: 25,
                trianglesPerRenderedFrame: 5_000,
            },
        },
        {
            budget: { checks: [], pass: true },
            name: 'game-building-empty-shell-desktop',
            sample: {
                drawCallsPerRenderedFrame: 104,
                gpu: { elapsedP95Ms: 4.9, valid: true },
                p95FrameMs: 29.1,
                renderedFps: 21,
                trianglesPerRenderedFrame: 5_200,
            },
        },
    ];
    const comparison = buildGardenBuildingMatchedBaselineComparison(scenarios);
    assert.equal(comparison?.pass, true);
    assert.ok(comparison?.checks.every((check) => check.pass));

    const applied = applyGardenBuildingMatchedBaselineComparison(scenarios);
    assert.equal(applied?.pass, true);
    assert.equal(scenarios[1].budget.pass, true);
    assert.equal(scenarios[1].budget.checks.length, 5);
});

test('building matched baseline comparison fails material blank-shell regressions', () => {
    const scenarios = [
        {
            budget: { checks: [], pass: true },
            name: 'game-building-no-structure-network-baseline-desktop',
            sample: {
                drawCallsPerRenderedFrame: 100,
                gpu: { elapsedP95Ms: 2, valid: true },
                p95FrameMs: 20,
                renderedFps: 25,
                trianglesPerRenderedFrame: 5_000,
            },
        },
        {
            budget: { checks: [], pass: true },
            name: 'game-building-empty-shell-desktop',
            sample: {
                drawCallsPerRenderedFrame: 106,
                gpu: { elapsedP95Ms: 5.1, valid: true },
                p95FrameMs: 23.1,
                renderedFps: 19.9,
                trianglesPerRenderedFrame: 5_300,
            },
        },
    ];
    const comparison = applyGardenBuildingMatchedBaselineComparison(scenarios);
    assert.equal(comparison?.pass, false);
    assert.ok(comparison?.checks.every((check) => !check.pass));
    assert.equal(scenarios[1].budget.pass, false);
    const summary = buildProfileSummary(scenarios, {});
    assert.equal(summary.failedScenarios, 1);
    assert.deepEqual(summary.failedScenarioNames, [
        'game-building-empty-shell-desktop',
    ]);
    assert.equal(
        shouldFailProfileRun({
            failOnBudget: true,
            profileSummary: summary,
            provenance: { comparable: true },
        }),
        true,
    );
});

test('building matched baseline comparison fails closed when its control is absent', () => {
    const scenarios = [
        {
            budget: { checks: [], pass: true },
            name: 'game-building-empty-shell-desktop',
            sample: {},
        },
    ];
    const comparison = applyGardenBuildingMatchedBaselineComparison(scenarios);
    assert.equal(comparison?.pass, false);
    assert.equal(
        comparison?.checks[0]?.name,
        'buildingEmptyShellMatchedBaselinePresent',
    );
    assert.equal(scenarios[0].budget.pass, false);
});

test('building matched baseline comparison skips unavailable GPU timing only', () => {
    const baselineSample = {
        drawCallsPerRenderedFrame: 100,
        gpu: { elapsedP95Ms: 2, valid: true },
        p95FrameMs: 27,
        renderedFps: 25,
        trianglesPerRenderedFrame: 5_000,
    };
    const candidateSample = {
        ...baselineSample,
        gpu: { elapsedP95Ms: null, valid: false },
    };
    const comparison = buildGardenBuildingMatchedBaselineComparison([
        {
            name: 'game-building-no-structure-network-baseline-desktop',
            sample: baselineSample,
        },
        {
            name: 'game-building-empty-shell-desktop',
            sample: candidateSample,
        },
    ]);
    const gpuCheck = comparison?.checks.find(
        (check) => check.name === 'buildingEmptyShellGpuP95Regression',
    );
    assert.equal(comparison?.pass, true);
    assert.equal(gpuCheck?.pass, true);
    assert.equal(gpuCheck?.skipped, true);
});

test('building acceptance preserves baseline-visible greenhouse and outdoor props', () => {
    for (const fixture of [
        {
            expected: {
                edges: 14,
                footprintCells: 12,
                normalVisibleProps: 2,
                props: 2,
                roofs: 1,
            },
            key: 'greenhouse',
            visibleProps: 2,
        },
        {
            expected: {
                edges: 301,
                footprintCells: 100,
                normalVisibleProps: 34,
                props: 100,
                roofs: 100,
            },
            key: 'worst-case',
            visibleProps: 34,
        },
    ]) {
        const result = evaluateGardenBuildingAcceptance({
            apiRequests: [],
            requested: {
                building: '1',
                buildingFixture: fixture.key,
                buildingProfile: {
                    expected: fixture.expected,
                    fixture: fixture.key,
                    mode: 'normal',
                },
            },
            runtime: {
                gardenStructureExteriorSuppressedPropCount:
                    fixture.expected.props - fixture.visibleProps,
                gardenStructureVisiblePropCount: fixture.visibleProps,
            },
        });

        assert.ok(
            result.checks
                .filter((check) =>
                    [
                        'buildingVisibleAndSuppressedPropCoverage',
                        'buildingVisiblePropCount',
                        'buildingExteriorSuppressedPropCount',
                    ].includes(check.name),
                )
                .every((check) => check.pass),
        );
    }
});

test('building acceptance gates measured avatar collision-step p95', () => {
    const requested = {
        avatar: '1',
        building: '1',
        buildingFixture: 'worst-case',
        buildingProfile: {
            avatarNavigation: {
                legs: [
                    {
                        key: 's',
                        maximumDistance: 0.25,
                        view: 'third-person',
                    },
                ],
            },
            expected: {
                edges: 301,
                footprintCells: 100,
                props: 100,
                roofs: 100,
            },
            fixture: 'worst-case',
            mode: 'normal',
            motion: 'avatar-navigation',
            motionResult: {
                collisionStepCount: 42,
                kind: 'avatar-navigation',
                legs: [
                    {
                        distance: 0.12,
                        key: 's',
                        view: 'third-person',
                    },
                ],
            },
        },
    };
    const runtime = {
        gardenStructureAvatarCollisionStepCount: 44,
        gardenStructureAvatarCollisionStepDurationMaxMs: 1.8,
        gardenStructureAvatarCollisionStepDurationP95Ms: 1.5,
        gardenStructureAvatarCollisionStepDurationTotalMs: 12,
        gardenStructureCollisionBoxCount: 290,
        gardenStructureCollisionBucketCount: 220,
    };
    const passing = evaluateGardenBuildingAcceptance({
        apiRequests: [],
        budget: { avatarCollisionStepP95Ms: 2 },
        requested,
        runtime,
    });
    assert.ok(
        passing.checks
            .filter((check) => check.name.startsWith('buildingAvatar'))
            .every((check) => check.pass),
    );

    const failing = evaluateGardenBuildingAcceptance({
        apiRequests: [],
        budget: { avatarCollisionStepP95Ms: 2 },
        requested,
        runtime: {
            ...runtime,
            gardenStructureAvatarCollisionStepDurationMaxMs: 2.4,
            gardenStructureAvatarCollisionStepDurationP95Ms: 2.1,
        },
    });
    assert.deepEqual(
        failing.checks.find(
            (check) => check.name === 'buildingAvatarCollisionStepP95Ms',
        ),
        {
            actual: 2.1,
            limit: 2,
            name: 'buildingAvatarCollisionStepP95Ms',
            pass: false,
        },
    );
});

test('building acceptance keeps an empty structure distinct from production GLB draws', () => {
    const responseUrl =
        'http://localhost/assets/models/GardenStructureKitV1.glb?v=abc';
    const result = evaluateGardenBuildingAcceptance({
        apiRequests: [],
        requested: {
            building: '1',
            buildingFixture: 'blank',
            buildingProfile: {
                expected: {
                    edges: 0,
                    footprintCells: 4,
                    props: 0,
                    roofs: 0,
                },
                fixture: 'blank',
                mode: 'normal',
            },
            staticSceneCache: 'legacy',
        },
        runtime: {
            gardenStructureAssetBytesResident: 96_000,
            gardenStructureAssetRequestCount: 1,
            gardenStructureAssetResolutionIssueCount: 0,
            gardenStructureAssetResolutionStatus: 'resolved',
            gardenStructureAssetUnresolvedBatchCount: 0,
            gardenStructureAssetUrl:
                '/assets/models/GardenStructureKitV1.glb?v=abc',
            gardenStructureAssetResponseBodyBytes: 364_684,
            gardenStructureAssetResponseStatus: 200,
            gardenStructureAssetResponseUrl: responseUrl,
            gardenStructureAssetResourceDurationMs: 4,
            gardenStructureAssetResourceUrl: responseUrl,
            gardenStructureCompileDurationMs: 1,
            gardenStructureCompileDurationMaxMs: 1,
            gardenStructureDocumentPayloadBytes: 242,
            gardenStructureEdgeCount: 0,
            gardenStructureEditorActive: false,
            gardenStructureExteriorSuppressedPropCount: 0,
            gardenStructureFallbackDrawCount: 0,
            gardenStructureFootprintCellCount: 4,
            gardenStructureNavigationCompileDurationMs: 0.1,
            gardenStructureNavigationCompileDurationMaxMs: 0.1,
            gardenStructurePlanCacheEvictionCount: 0,
            gardenStructurePlanCacheLookupDurationMs: 0,
            gardenStructurePlanCacheLookupDurationMaxMs: 0,
            gardenStructurePreviewDrawCount: 0,
            gardenStructureProductionAttributeBytes: 0,
            gardenStructureProductionDrawCount: 0,
            gardenStructureProductionIndexBytes: 0,
            gardenStructureProductionInstanceBufferBytes: 0,
            gardenStructureProductionOpaqueDrawCount: 0,
            gardenStructureProductionTextureCount: 0,
            gardenStructureProductionTextureEstimatedBytes: 0,
            gardenStructureProductionTransparentDrawCount: 0,
            gardenStructureProductionTriangleCount: 0,
            gardenStructureProductionVertexCount: 0,
            gardenStructurePropCount: 0,
            gardenStructureRoofRegionCount: 0,
            gardenStructureStructureCount: 1,
            gardenStructureVisiblePropCount: 0,
            gardenStructureVisibleStructureCount: 1,
        },
    });

    assert.equal(result.pass, true);
    assert.ok(result.checks.every((check) => check.pass));
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

test('cross-tier scenario set replays one High-target garden across every tier and phase', () => {
    const scenarios = resolveScenarios('cross-tier');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
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
        ],
    );
    const expectedProfiles = [
        ['low', 'low', 1, 0, false, 0, null],
        ['medium', 'medium', 1.5, 0.5, true, 2_048, null],
        ['high', 'high', 2, 1, true, 4_096, null],
        ['auto', 'medium', 1.5, 0.5, true, 2_048, 'standard'],
        ['auto', 'auto-constrained', 1, 0.25, true, 1_024, 'constrained'],
    ];

    for (const [profileIndex, expected] of expectedProfiles.entries()) {
        const [quality, tier, dprCap, density, shadows, shadowMapSize, device] =
            expected;
        const profileScenarios = scenarios.slice(
            profileIndex * 2,
            profileIndex * 2 + 2,
        );

        assert.deepEqual(
            profileScenarios.map((scenario) => scenario.motion),
            [undefined, 'bounded-zoom-rotate'],
        );
        assert.deepEqual(
            profileScenarios.map(
                (scenario) => getScenarioRequest(scenario.path).controls,
            ),
            ['0', '1'],
        );
        assert.deepEqual(
            profileScenarios.map(
                (scenario) =>
                    new URL(
                        scenario.path,
                        'http://profile.local',
                    ).searchParams.get('cameraProfile') ?? '0',
            ),
            ['0', '1'],
        );
        for (const scenario of profileScenarios) {
            const request = getScenarioRequest(scenario.path);
            assert.equal(scenario.autoQualityDeviceClass ?? null, device);
            assert.equal(scenario.budget, 'gameHighTarget');
            assert.equal(scenario.crossTierProfile, true);
            assert.deepEqual(scenario.displayCadenceControl, {
                framesPerSecond: 30,
                mode: 'profiler-owned-raf-v1',
            });
            assert.equal(scenario.dpr, 2);
            assert.equal(scenario.expectedDprCap, dprCap);
            assert.equal(scenario.expectedGroundDecorationDensity, density);
            assert.equal(scenario.expectedQualityTier, tier);
            assert.equal(scenario.expectedShadowMapSize, shadowMapSize);
            assert.equal(scenario.expectedShadows, shadows);
            assert.equal(scenario.isMobile, false);
            assert.deepEqual(scenario.outlineProfile, {
                action: 'show',
                raisedBedId: 2,
            });
            assert.equal(scenario.repeat, 3);
            assert.equal(scenario.screenshotWitness, true);
            assert.deepEqual(scenario.viewport, { width: 1280, height: 720 });
            assert.equal(request.debugHud, '0');
            assert.equal(request.details, '1');
            assert.equal(request.gardenProfile, 'high-target');
            assert.equal(request.hud, '0');
            assert.equal(request.mode, 'details');
            assert.equal(request.outline, '1');
            assert.equal(request.quality, quality);
            assert.equal(request.staticSceneCache, 'legacy');
        }
    }

    assert.deepEqual(scenarios[6].navigatorMetrics, {
        deviceMemory: 8,
        hardwareConcurrency: 8,
    });
    assert.deepEqual(scenarios[8].navigatorMetrics, {
        deviceMemory: 4,
        hardwareConcurrency: 4,
    });
});

test('fauna scenario set isolates the deterministic daytime High workload', () => {
    const scenarios = resolveScenarios('fauna');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    const request = getScenarioRequest(scenario.path);
    const url = new URL(scenario.path, 'http://profile.local');
    assert.equal(scenario.name, 'game-fauna-heavy-day-interaction-desktop');
    assert.equal(scenario.budget, 'gameHighTarget');
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.faunaProfile, true);
    assert.equal(scenario.isMobile, false);
    assert.equal(scenario.repeat, 3);
    assert.equal(scenario.screenshotWitness, true);
    assert.deepEqual(scenario.viewport, { height: 720, width: 1280 });
    assert.deepEqual(scenario.animalProfileCommand, {
        behavior: 'trot',
        species: 'Cow',
    });
    assert.equal(request.controls, '0');
    assert.equal(request.debugHud, '0');
    assert.equal(request.details, '1');
    assert.equal(request.gardenProfile, 'fauna-heavy');
    assert.equal(request.hud, '0');
    assert.equal(request.mode, 'details');
    assert.equal(request.quality, 'high');
    assert.equal(request.staticSceneCache, 'legacy');
    assert.equal(url.searchParams.get('fixedTimeSeconds'), '43200');
});

test('garden-switch scenario keeps repeated High and fauna arrivals in one context', () => {
    const scenarios = resolveScenarios('garden-switch');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    const request = getScenarioRequest(scenario.path);
    const url = new URL(scenario.path, 'http://profile.local');
    assert.equal(
        scenario.name,
        'game-garden-switch-high-fauna-single-context-desktop',
    );
    assert.equal(scenario.gardenSwitchProfile, true);
    assert.equal(scenario.repeat, 3);
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.isMobile, false);
    assert.equal(scenario.screenshotWitness, true);
    assert.deepEqual(scenario.viewport, { height: 720, width: 1280 });
    assert.equal(request.gardenProfile, 'high-target');
    assert.equal(request.mode, 'details');
    assert.equal(request.outline, '1');
    assert.equal(request.quality, 'high');
    assert.equal(request.staticSceneCache, 'legacy');
    assert.equal(url.searchParams.get('gardenSwitch'), '1');
    assert.equal(url.searchParams.get('fixedTimeSeconds'), '43200');
});

test('lifecycle scenario repeats the exact High workload in fresh contexts', () => {
    const scenarios = resolveScenarios('lifecycle');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    const request = getScenarioRequest(scenario.path);
    assert.equal(scenario.name, 'game-high-target-runtime-lifecycle-desktop');
    assert.equal(scenario.lifecycleProfile, true);
    assert.equal(scenario.repeat, 3);
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.isMobile, false);
    assert.equal(scenario.screenshotWitness, true);
    assert.deepEqual(scenario.viewport, { height: 720, width: 1280 });
    const url = new URL(scenario.path, 'http://profile.local');
    assert.equal(request.controls, '0');
    assert.equal(request.debugHud, '0');
    assert.equal(request.details, '1');
    assert.equal(request.gardenProfile, 'high-target');
    assert.equal(request.hud, '0');
    assert.equal(request.lifecycle, '1');
    assert.equal(request.mode, 'details');
    assert.equal(request.outline, '1');
    assert.equal(request.quality, 'high');
    assert.equal(request.staticSceneCache, 'legacy');
    assert.equal(url.searchParams.get('fixedTimeSeconds'), '43200');
});

test('live lifecycle scenario measures unpinned SceneTime only in its candidate set', () => {
    const scenarios = resolveScenarios('lifecycle-live');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    const request = getScenarioRequest(scenario.path);
    const url = new URL(scenario.path, 'http://profile.local');
    assert.equal(
        scenario.name,
        'game-high-target-runtime-lifecycle-live-desktop',
    );
    assert.equal(scenario.lifecycleLiveProfile, true);
    assert.equal(scenario.lifecycleProfile, true);
    assert.equal(scenario.repeat, 3);
    assert.equal(request.lifecycle, '1');
    assert.equal(request.gardenProfile, 'high-target');
    assert.equal(request.outline, '1');
    assert.equal(request.staticSceneCache, 'legacy');
    assert.equal(url.searchParams.has('fixedTimeSeconds'), false);
    assert.equal(
        resolveScenarios('lifecycle')[0].lifecycleLiveProfile,
        undefined,
    );
});

test('runtime-owner scenarios cover every tier with rain, camera, outline, and no fixed clock', () => {
    const scenarios = resolveScenarios('runtime-owners');
    const expected = [
        ['game-runtime-owners-low-desktop', 'low', 'low'],
        ['game-runtime-owners-medium-desktop', 'medium', 'medium'],
        ['game-runtime-owners-high-desktop', 'high', 'high'],
        ['game-runtime-owners-auto-standard-desktop', 'auto', 'medium'],
        [
            'game-runtime-owners-auto-constrained-desktop',
            'auto',
            'auto-constrained',
        ],
    ];

    assert.equal(scenarios.length, expected.length);
    for (const [index, scenario] of scenarios.entries()) {
        const [name, quality, tier] = expected[index];
        const request = getScenarioRequest(scenario.path);
        const url = new URL(scenario.path, 'http://profile.local');
        assert.equal(scenario.name, name);
        assert.equal(scenario.runtimeOwnersProfile, true);
        assert.equal(scenario.expectedQualityTier, tier);
        assert.equal(scenario.motion, 'runtime-owner-bounded-zoom-rotate');
        assert.equal(scenario.motionWarmupMs, 900);
        assert.equal(scenario.repeat, 3);
        assert.equal(scenario.screenshotWitness, true);
        assert.equal(request.controls, '1');
        assert.equal(request.gardenProfile, 'high-target');
        assert.equal(request.mode, 'rain');
        assert.equal(request.outline, '1');
        assert.equal(request.quality, quality);
        assert.equal(request.staticSceneCache, 'legacy');
        assert.equal(url.searchParams.get('cameraProfile'), '1');
        assert.equal(url.searchParams.has('fixedTimeSeconds'), false);
    }
});

test('bounded camera motion cycles are closed and alternate their leading direction', () => {
    const first = resolveBoundedCameraMotionCycle(0);
    const second = resolveBoundedCameraMotionCycle(1);

    assert.deepEqual(first, {
        panKeys: ['ArrowLeft', 'ArrowRight'],
        wheelDeltas: [-20, 20],
    });
    assert.deepEqual(second, {
        panKeys: ['ArrowRight', 'ArrowLeft'],
        wheelDeltas: [20, -20],
    });
    for (const cycle of [first, second]) {
        assert.deepEqual([...cycle.panKeys].sort(), [
            'ArrowLeft',
            'ArrowRight',
        ]);
        assert.equal(
            cycle.wheelDeltas.reduce((sum, delta) => sum + delta, 0),
            0,
        );
    }
});

test('camera snapshot endpoint drift fails closed for invalid snapshots', () => {
    const start = {
        position: [-10, 10, -10],
        target: [0, 0, 0],
        zoom: 100,
    };

    assert.equal(gameCameraSnapshotMaximumDelta(start, { ...start }), 0);
    assert.equal(
        gameCameraSnapshotMaximumDelta(start, {
            ...start,
            target: [0.25, 0, 0],
        }),
        0.25,
    );
    assert.equal(
        gameCameraSnapshotMaximumDelta(start, {
            ...start,
            position: [-9.5, 10, -10],
        }),
        0.5,
    );
    assert.equal(
        gameCameraSnapshotMaximumDelta(start, { ...start, zoom: 101 }),
        1,
    );
    assert.equal(gameCameraSnapshotMaximumDelta(start, null), null);
    assert.equal(gameCameraSnapshotMaximumDelta(null, start), null);
    assert.equal(
        gameCameraSnapshotMaximumDelta(start, {
            ...start,
            position: [Number.NaN, 10, -10],
        }),
        null,
    );
    assert.equal(
        gameCameraSnapshotMaximumDelta(start, {
            ...start,
            target: [0, Number.POSITIVE_INFINITY, 0],
        }),
        null,
    );
    assert.equal(
        gameCameraSnapshotMaximumDelta(start, {
            ...start,
            zoom: Number.NaN,
        }),
        null,
    );
});

test('static-idle scenario isolates one visible fixed-time zero-work fixture', () => {
    const scenarios = resolveScenarios('static-idle');

    assert.equal(scenarios.length, 1);
    const [scenario] = scenarios;
    const request = getScenarioRequest(scenario.path);
    assert.equal(scenario.name, 'game-fixed-time-static-idle-desktop');
    assert.equal(scenario.staticIdleProfile, true);
    assert.equal(scenario.repeat, 3);
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.isMobile, false);
    assert.equal(scenario.screenshotWitness, true);
    assert.deepEqual(scenario.viewport, { height: 720, width: 1280 });
    assert.equal(request.controls, '0');
    assert.equal(request.debugHud, '0');
    assert.equal(request.details, '0');
    assert.equal(request.gardenProfile, 'default');
    assert.equal(request.hud, '0');
    assert.equal(request.mode, 'baseline');
    assert.equal(request.quality, 'high');
    assert.equal(request.staticIdle, '1');
    assert.equal(request.staticSceneCache, 'legacy');
    assert.equal(scenario.fixedTimeSeconds, 43_200);
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
        building: '0',
        buildingFixture: 'house',
        closeupRaisedBedId: null,
        controls: '1',
        debugHud: '0',
        details: '1',
        foliageBudget: '0',
        gardenProfile: 'high-target',
        hud: '0',
        mode: 'details',
        operationVisuals: '1',
        outline: '0',
        placement: '0',
        quality: 'high',
        staticSceneCache: 'cache',
        staticSceneCacheOcclusionFixture: '0',
        weatherSurface: 'integrated',
    });
    assert.equal(
        resolveScenarios('high-target').some(
            (candidate) =>
                getScenarioRequest(candidate.path).operationVisuals === '1',
        ),
        false,
    );
});

test('foliage-budget High scenario reserves exact detail for explicit close-up', () => {
    const scenarios = resolveScenarios('high-target-foliage-budget');

    assert.equal(scenarios.length, 2);
    const [legacy, scenario] = scenarios;
    assert.equal(
        legacy.name,
        'game-high-target-foliage-unbudgeted-zoom-desktop',
    );
    assert.equal(getScenarioRequest(legacy.path).foliageBudget, 'legacy');
    assert.equal(legacy.comparisonPair, 'foliage-detail-budget');
    assert.equal(legacy.comparisonRole, 'legacy');
    assert.equal(scenario.name, 'game-high-target-foliage-budget-zoom-desktop');
    assert.equal(scenario.motion, 'foliage-detail-zoom');
    assert.equal(scenario.dpr, 2);
    assert.equal(scenario.repeat, 3);
    assert.equal(scenario.comparisonPair, 'foliage-detail-budget');
    assert.equal(scenario.comparisonRole, 'budgeted');
    const request = getScenarioRequest(scenario.path);
    assert.equal(request.foliageBudget, '1');
    assert.equal(request.gardenProfile, 'high-target');
    assert.equal(request.quality, 'high');
});

test('weather-material High scenarios pair legacy and integrated rain and snow', () => {
    const scenarios = resolveScenarios('high-target-weather-materials');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
            'game-high-target-rain-legacy-weather-surfaces-desktop',
            'game-high-target-rain-integrated-weather-surfaces-desktop',
            'game-high-target-snow-legacy-weather-surfaces-desktop',
            'game-high-target-snow-integrated-weather-surfaces-desktop',
        ],
    );
    assert.deepEqual(
        scenarios.map((scenario) => scenario.comparisonPair),
        [
            'rain-weather-surfaces',
            'rain-weather-surfaces',
            'snow-weather-surfaces',
            'snow-weather-surfaces',
        ],
    );
    assert.deepEqual(
        scenarios.map((scenario) => scenario.comparisonRole),
        ['legacy', 'integrated', 'legacy', 'integrated'],
    );
    assert.deepEqual(
        scenarios.map((scenario) => getScenarioRequest(scenario.path).mode),
        ['rain', 'rain', 'snow', 'snow'],
    );
    assert.deepEqual(
        scenarios.map(
            (scenario) => getScenarioRequest(scenario.path).weatherSurface,
        ),
        ['legacy', 'integrated', 'legacy', 'integrated'],
    );
    for (const scenario of scenarios) {
        const request = getScenarioRequest(scenario.path);
        assert.equal(request.gardenProfile, 'high-target');
        assert.equal(request.quality, 'high');
        assert.equal(scenario.budget, 'gameHighTarget');
        assert.equal(scenario.dpr, 2);
        assert.equal(scenario.isMobile, false);
        assert.equal(scenario.repeat, 5);
    }
});

test('weather-material runs interleave five legacy and integrated samples per pair', () => {
    const queue = buildScenarioRunQueue(
        resolveScenarios('high-target-weather-materials'),
    );
    const expectedPairOrder = [
        'legacy:1',
        'integrated:1',
        'integrated:2',
        'legacy:2',
        'legacy:3',
        'integrated:3',
        'integrated:4',
        'legacy:4',
        'legacy:5',
        'integrated:5',
    ];

    assert.equal(queue.length, 20);
    for (const [pairIndex, pairName] of [
        [0, 'rain-weather-surfaces'],
        [1, 'snow-weather-surfaces'],
    ]) {
        assert.deepEqual(
            queue
                .slice(pairIndex * 10, pairIndex * 10 + 10)
                .map(
                    ({ baseScenario, runIndex }) =>
                        `${baseScenario.comparisonRole}:${runIndex}`,
                ),
            expectedPairOrder,
            `${pairName} should use an ABBA-balanced order`,
        );
    }

    const unpairedQueue = buildScenarioRunQueue(
        resolveScenarios('high-target-operation-visuals'),
    );
    assert.deepEqual(
        unpairedQueue.map(({ runIndex }) => runIndex),
        [1, 2, 3],
    );
});

test('static scene-cache High scenarios use deterministic five-run ABBA pairs', () => {
    const scenarios = resolveScenarios('high-target-static-scene-cache');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
            'game-high-target-static-scene-cache-legacy-desktop',
            'game-high-target-static-scene-cache-cached-desktop',
            'game-high-target-static-scene-cache-cloudy-legacy-desktop',
            'game-high-target-static-scene-cache-cloudy-cached-desktop',
            'game-high-target-static-scene-cache-occlusion-fixture-desktop',
        ],
    );
    assert.deepEqual(
        scenarios.map((scenario) => scenario.comparisonRole),
        ['legacy', 'cache', 'legacy', 'cache', undefined],
    );
    for (const scenario of scenarios.slice(0, 4)) {
        const request = getScenarioRequest(scenario.path);
        assert.equal(scenario.budget, 'gameHighTarget');
        assert.equal(
            scenario.comparisonPair,
            request.mode === 'cloudy'
                ? 'static-opaque-scene-cache-cloudy'
                : 'static-opaque-scene-cache',
        );
        assert.equal(scenario.dpr, 2);
        assert.equal(scenario.isMobile, false);
        assert.equal(scenario.repeat, 5);
        assert.equal(scenario.staticSceneCacheBenchmark, true);
        assert.equal(request.controls, '0');
        assert.equal(request.details, '1');
        assert.equal(request.gardenProfile, 'high-target');
        assert.equal(scenario.staticSceneCacheVisualDeterministic, true);
        assert.equal(
            new URL(scenario.path, 'http://profile.local').searchParams.get(
                'fixedTimeSeconds',
            ),
            request.mode === 'cloudy' ? '12' : null,
        );
        assert.equal(
            scenario.fixedTimeSeconds,
            request.mode === 'cloudy' ? 12 : undefined,
        );
        assert.equal(request.quality, 'high');
    }
    assert.deepEqual(
        scenarios.slice(0, 4).map((scenario) => {
            return getScenarioRequest(scenario.path).mode;
        }),
        ['details', 'details', 'cloudy', 'cloudy'],
    );
    assert.deepEqual(
        scenarios.map(
            (scenario) => getScenarioRequest(scenario.path).staticSceneCache,
        ),
        ['legacy', 'cache', 'legacy', 'cache', 'cache'],
    );
    const fixture = scenarios[4];
    assert.equal(fixture.repeat, 1);
    assert.equal(fixture.staticSceneCacheBenchmark, true);
    assert.equal(fixture.staticSceneCacheOcclusionFixture, true);
    assert.equal(fixture.comparisonPair, undefined);
    assert.equal(
        getScenarioRequest(fixture.path).staticSceneCacheOcclusionFixture,
        '1',
    );

    const queue = buildScenarioRunQueue(scenarios);
    assert.deepEqual(
        queue.map(
            ({ baseScenario, runIndex }) =>
                `${
                    baseScenario.staticSceneCacheOcclusionFixture
                        ? 'fixture'
                        : `${baseScenario.comparisonPair}:${baseScenario.comparisonRole}`
                }:${runIndex}`,
        ),
        [
            'static-opaque-scene-cache:legacy:1',
            'static-opaque-scene-cache:cache:1',
            'static-opaque-scene-cache:cache:2',
            'static-opaque-scene-cache:legacy:2',
            'static-opaque-scene-cache:legacy:3',
            'static-opaque-scene-cache:cache:3',
            'static-opaque-scene-cache:cache:4',
            'static-opaque-scene-cache:legacy:4',
            'static-opaque-scene-cache:legacy:5',
            'static-opaque-scene-cache:cache:5',
            'static-opaque-scene-cache-cloudy:legacy:1',
            'static-opaque-scene-cache-cloudy:cache:1',
            'static-opaque-scene-cache-cloudy:cache:2',
            'static-opaque-scene-cache-cloudy:legacy:2',
            'static-opaque-scene-cache-cloudy:legacy:3',
            'static-opaque-scene-cache-cloudy:cache:3',
            'static-opaque-scene-cache-cloudy:cache:4',
            'static-opaque-scene-cache-cloudy:legacy:4',
            'static-opaque-scene-cache-cloudy:legacy:5',
            'static-opaque-scene-cache-cloudy:cache:5',
            'fixture:1',
        ],
    );
});

test('snow-onset High scenarios provide deterministic visual legacy and integrated cases', () => {
    const scenarios = resolveScenarios('high-target-weather-onset');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        [
            'game-high-target-snow-onset-legacy-weather-surfaces-desktop',
            'game-high-target-snow-onset-integrated-weather-surfaces-desktop',
            'game-high-target-snow-threshold-transition-integrated-weather-surfaces-desktop',
        ],
    );
    assert.deepEqual(
        scenarios.map((scenario) => scenario.comparisonPair),
        [undefined, undefined, undefined],
    );
    assert.deepEqual(
        scenarios.map((scenario) => scenario.comparisonRole),
        [undefined, undefined, undefined],
    );
    assert.deepEqual(
        scenarios.map((scenario) => getScenarioRequest(scenario.path).mode),
        ['snow-onset', 'snow-onset', 'snow-onset'],
    );
    assert.deepEqual(
        scenarios.map(
            (scenario) => getScenarioRequest(scenario.path).weatherSurface,
        ),
        ['legacy', 'integrated', 'integrated'],
    );
    for (const scenario of scenarios) {
        const request = getScenarioRequest(scenario.path);
        assert.equal(request.gardenProfile, 'high-target');
        assert.equal(request.quality, 'high');
        assert.equal(scenario.budget, 'gameHighTarget');
        assert.equal(scenario.dpr, 2);
        assert.equal(scenario.isMobile, false);
        assert.equal(scenario.repeat, 1);
    }
    assert.equal(
        scenarios[2].weatherSurfaceTransition,
        'snow-integration-cycle',
    );
});

test('profile request defaults invalid weather-surface values to integrated', () => {
    assert.equal(
        getScenarioRequest('/debug/profile/game').weatherSurface,
        'integrated',
    );
    assert.equal(
        getScenarioRequest('/debug/profile/game?weatherSurface=unexpected')
            .weatherSurface,
        'integrated',
    );
});

test('profile request defaults invalid static scene-cache values to cache', () => {
    assert.equal(
        getScenarioRequest('/debug/profile/game').staticSceneCache,
        'cache',
    );
    assert.equal(
        getScenarioRequest('/debug/profile/game?staticSceneCache=unexpected')
            .staticSceneCache,
        'cache',
    );
    assert.equal(
        getScenarioRequest('/debug/profile/game?staticSceneCache=legacy')
            .staticSceneCache,
        'legacy',
    );
});

test('profile request enables the static scene-cache occlusion fixture only for an exact opt-in', () => {
    assert.equal(
        getScenarioRequest('/debug/profile/game')
            .staticSceneCacheOcclusionFixture,
        '0',
    );
    assert.equal(
        getScenarioRequest(
            '/debug/profile/game?staticSceneCacheOcclusionFixture=unexpected',
        ).staticSceneCacheOcclusionFixture,
        '0',
    );
    assert.equal(
        getScenarioRequest(
            '/debug/profile/game?staticSceneCacheOcclusionFixture=1',
        ).staticSceneCacheOcclusionFixture,
        '1',
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

test('lifecycle renderer stats barrier requires a post-barrier root and submitted-render receipt', () => {
    const start = {
        capturedAt: 100,
        drawCalls: 10,
        renderedFrames: 2,
        rendererStatsMeasurementMode: 'post-render-microtask-v1',
        rendererStatsPublishedAt: 90,
        rendererStatsReceiptCount: 3,
        rendererStatsRenderFrame: 8,
        r3fFrameCallbackCount: 4,
        submittedTriangles: 20,
    };
    const ready = {
        ...start,
        capturedAt: 130,
        drawCalls: 11,
        renderedFrames: 3,
        rendererStatsPublishedAt: 120,
        rendererStatsReceiptCount: 4,
        // A restored Three renderer may restart its local render-frame count.
        rendererStatsRenderFrame: 1,
        r3fFrameCallbackCount: 5,
        submittedTriangles: 21,
    };

    assert.equal(
        isLifecycleRendererStatsBarrierReady(
            start,
            ready,
            lifecycleRendererStatsCanonicalMode,
        ),
        true,
    );
    for (const mutation of [
        { drawCalls: 10 },
        { renderedFrames: 2 },
        { submittedTriangles: 20 },
        { r3fFrameCallbackCount: 4 },
        { rendererStatsReceiptCount: 3 },
        { rendererStatsPublishedAt: 100 },
        { rendererStatsMeasurementMode: null },
        { rendererStatsRenderFrame: 0 },
    ]) {
        assert.equal(
            isLifecycleRendererStatsBarrierReady(
                start,
                { ...ready, ...mutation },
                lifecycleRendererStatsCanonicalMode,
            ),
            false,
        );
    }

    const legacy = {
        ...ready,
        rendererStatsMeasurementMode: null,
        rendererStatsPublishedAt: null,
        rendererStatsReceiptCount: null,
        rendererStatsRenderFrame: null,
        r3fFrameCallbackCount: null,
    };
    assert.equal(
        isLifecycleRendererStatsBarrierReady(
            { ...start, r3fFrameCallbackCount: null },
            legacy,
            lifecycleRendererStatsLegacyMode,
        ),
        true,
    );
});

test('lifecycle renderer stats resource measurements fail closed for canonical and legacy evidence', () => {
    const resources = {
        rendererGeometries: 193,
        rendererShaders: 15,
        rendererStatsMeasurement: {
            completedAt: 130,
            drawCallsDelta: 1,
            legacySettleMs: null,
            measurementMode: lifecycleRendererStatsCanonicalMode,
            renderedFramesDelta: 1,
            rendererStatsPublishedAt: 120,
            rendererStatsReceiptCount: 4,
            rendererStatsReceiptDelta: 1,
            rendererStatsRenderFrame: 8,
            r3fFrameCallbackCountDelta: 1,
            runtimeMeasurementMode: 'post-render-microtask-v1',
            startedAt: 100,
            submittedTrianglesDelta: 2,
        },
        rendererTextures: 5,
    };
    assert.equal(
        isLifecycleRendererStatsMeasurementValid(
            resources,
            lifecycleRendererStatsCanonicalMode,
        ),
        true,
    );
    for (const mutation of [
        { rendererGeometries: 0 },
        {
            rendererStatsMeasurement: {
                ...resources.rendererStatsMeasurement,
                completedAt: 99,
            },
        },
        {
            rendererStatsMeasurement: {
                ...resources.rendererStatsMeasurement,
                rendererStatsReceiptDelta: 0,
            },
        },
    ]) {
        assert.equal(
            isLifecycleRendererStatsMeasurementValid(
                { ...resources, ...mutation },
                lifecycleRendererStatsCanonicalMode,
            ),
            false,
        );
    }

    const legacyResources = {
        ...resources,
        rendererStatsMeasurement: {
            ...resources.rendererStatsMeasurement,
            legacySettleMs: 600,
            measurementMode: lifecycleRendererStatsLegacyMode,
            rendererStatsPublishedAt: null,
            rendererStatsReceiptCount: null,
            rendererStatsReceiptDelta: null,
            rendererStatsRenderFrame: null,
            r3fFrameCallbackCountDelta: null,
            runtimeMeasurementMode: null,
        },
    };
    assert.equal(
        isLifecycleRendererStatsMeasurementValid(
            legacyResources,
            lifecycleRendererStatsLegacyMode,
        ),
        true,
    );
    assert.equal(
        isLifecycleRendererStatsMeasurementValid(
            {
                ...legacyResources,
                rendererStatsMeasurement: {
                    ...legacyResources.rendererStatsMeasurement,
                    rendererStatsReceiptCount: 1,
                },
            },
            lifecycleRendererStatsLegacyMode,
        ),
        false,
    );
});

test('legacy lifecycle renderer stats mode is limited to an explicit clean external old subject', () => {
    const cleanHarness = {
        commit: 'a'.repeat(40),
        dirty: false,
    };
    const cleanSubject = {
        commit: 'b'.repeat(40),
        comparisonContractVersion: 4,
        dirty: false,
    };
    assert.equal(
        resolveLifecycleRendererStatsCaptureMode({
            harness: cleanHarness,
            requestedMode: lifecycleRendererStatsLegacyMode,
            servedBuild: cleanSubject,
            serverMode: 'external',
        }),
        lifecycleRendererStatsLegacyMode,
    );
    for (const input of [
        { serverMode: 'managed' },
        { harness: { ...cleanHarness, dirty: true } },
        { servedBuild: { ...cleanSubject, dirty: true } },
        { servedBuild: { ...cleanSubject, commit: cleanHarness.commit } },
        {
            servedBuild: {
                ...cleanSubject,
                comparisonContractVersion: 5,
            },
        },
    ]) {
        assert.throws(
            () =>
                resolveLifecycleRendererStatsCaptureMode({
                    harness: cleanHarness,
                    requestedMode: lifecycleRendererStatsLegacyMode,
                    servedBuild: cleanSubject,
                    serverMode: 'external',
                    ...input,
                }),
            /requires an explicit clean external subject/,
        );
    }
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

test('legacy outline pipeline profiling is explicit', () => {
    assert.equal(parseArgs([]).legacyOutlinePipeline, false);
    assert.equal(
        parseArgs(['--legacy-outline-pipeline']).legacyOutlinePipeline,
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
        '/debug/profile/game?mode=snow&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0',
    );

    assert.deepEqual(request, {
        adaptiveHigh: '0',
        building: '0',
        buildingFixture: 'house',
        closeupRaisedBedId: null,
        controls: '1',
        debugHud: '0',
        details: '1',
        foliageBudget: '0',
        gardenProfile: 'high-target',
        hud: '0',
        mode: 'snow',
        operationVisuals: '0',
        outline: '0',
        placement: '0',
        quality: 'high',
        staticSceneCache: 'cache',
        staticSceneCacheOcclusionFixture: '0',
        weatherSurface: 'integrated',
    });
});

test('injected GPU timing yields to an existing elapsed-time query', () => {
    assert.match(
        installBrowserMetrics.toString(),
        /getQuery\([\s\S]*TIME_ELAPSED_EXT[\s\S]*CURRENT_QUERY/,
    );
});

test('profiler display cadence control owns app RAF while preserving native profiler RAF and cancellation', () => {
    const keys = [
        'cancelAnimationFrame',
        'requestAnimationFrame',
        '__gameProfileCancelNativeAnimationFrame',
        '__gameProfileDisplayCadenceControl',
        '__gameProfileMetrics',
        '__gameProfileRequestNativeAnimationFrame',
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
    const nativeCallbacks = new Map();
    const cancelledNativeHandles = [];
    let nextNativeHandle = 100;
    const nativeRequestAnimationFrame = (callback) => {
        nextNativeHandle += 1;
        nativeCallbacks.set(nextNativeHandle, callback);
        return nextNativeHandle;
    };
    const nativeCancelAnimationFrame = (handle) => {
        cancelledNativeHandles.push(handle);
        nativeCallbacks.delete(handle);
    };
    const deliverNextNativeFrame = (timestamp) => {
        const entry = nativeCallbacks.entries().next().value;
        assert.ok(entry, `expected a native RAF callback at ${timestamp}`);
        const [handle, callback] = entry;
        nativeCallbacks.delete(handle);
        callback(timestamp);
    };

    try {
        setGlobal('requestAnimationFrame', nativeRequestAnimationFrame);
        setGlobal('cancelAnimationFrame', nativeCancelAnimationFrame);
        setGlobal('__gameProfileMetrics', {});

        installBrowserMetrics({
            displayCadenceControl: {
                framesPerSecond: 30,
                mode: 'profiler-owned-raf-v1',
            },
            externalGpuTimer: false,
        });

        assert.notEqual(
            globalThis.requestAnimationFrame,
            nativeRequestAnimationFrame,
        );
        assert.notEqual(
            globalThis.__gameProfileRequestNativeAnimationFrame,
            globalThis.requestAnimationFrame,
        );
        let nativeProfilerTimestamp = null;
        globalThis.__gameProfileRequestNativeAnimationFrame((timestamp) => {
            nativeProfilerTimestamp = timestamp;
        });
        deliverNextNativeFrame(-10);
        assert.equal(nativeProfilerTimestamp, -10);
        assert.equal(
            globalThis.__gameProfileDisplayCadenceControl.snapshot()
                .nativeFrameCount,
            0,
        );

        const deliveries = [];
        let nestedHandle = null;
        const firstHandle = globalThis.requestAnimationFrame((timestamp) => {
            deliveries.push(['first', timestamp]);
            nestedHandle = globalThis.requestAnimationFrame(
                (nestedTimestamp) => {
                    deliveries.push(['nested', nestedTimestamp]);
                },
            );
        });
        const cancelledHandle = globalThis.requestAnimationFrame(
            (timestamp) => {
                deliveries.push(['cancelled', timestamp]);
            },
        );
        const batchedHandle = globalThis.requestAnimationFrame((timestamp) => {
            deliveries.push(['batched', timestamp]);
        });
        assert.notEqual(firstHandle, cancelledHandle);
        assert.notEqual(cancelledHandle, batchedHandle);
        assert.equal(nativeCallbacks.size, 1);
        globalThis.cancelAnimationFrame(String(cancelledHandle));

        deliverNextNativeFrame(0);
        assert.deepEqual(deliveries, [
            ['first', 0],
            ['batched', 0],
        ]);
        assert.equal(typeof nestedHandle, 'number');
        assert.equal(nativeCallbacks.size, 1);

        deliverNextNativeFrame(16.7);
        assert.deepEqual(deliveries, [
            ['first', 0],
            ['batched', 0],
        ]);
        assert.equal(nativeCallbacks.size, 1);

        deliverNextNativeFrame(33.4);
        assert.deepEqual(deliveries, [
            ['first', 0],
            ['batched', 0],
            ['nested', 33.4],
        ]);
        assert.equal(nativeCallbacks.size, 0);

        globalThis.cancelAnimationFrame(999_999);
        const cancelledAloneHandle = globalThis.requestAnimationFrame(() => {
            deliveries.push(['cancelled-alone', 100]);
        });
        assert.equal(nativeCallbacks.size, 1);
        globalThis.cancelAnimationFrame(cancelledAloneHandle);
        assert.equal(nativeCallbacks.size, 0);
        assert.equal(cancelledNativeHandles.length, 1);

        const telemetry =
            globalThis.__gameProfileDisplayCadenceControl.snapshot();
        assert.equal(telemetry.installed, true);
        assert.equal(telemetry.mode, 'profiler-owned-raf-v1');
        assert.equal(telemetry.requestedFramesPerSecond, 30);
        assert.equal(telemetry.requestCount, 5);
        assert.equal(telemetry.cancelRequestCount, 3);
        assert.equal(telemetry.cancelledBeforeDeliveryCount, 2);
        assert.equal(telemetry.deliveredCallbackCount, 3);
        assert.equal(telemetry.deliveredFrameCount, 2);
        assert.equal(telemetry.nativeFrameCount, 3);
        assert.equal(telemetry.nativeFrameCancellationCount, 1);
        assert.equal(telemetry.pendingCallbackCount, 0);
        assert.equal(telemetry.nativeFramePending, false);
        assert.ok(Math.abs(telemetry.observedFramesPerSecond - 29.94) < 0.01);
        assert.throws(
            () => globalThis.requestAnimationFrame(null),
            /callback must be a function/,
        );
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

test('profile context tracking starts before Canvas discovery without handling loss itself', async () => {
    const keys = [
        'document',
        'HTMLCanvasElement',
        '__grediceGameProfileContextEvents',
        '__grediceGardenSwitchContextEvents',
    ];
    const descriptors = new Map(
        keys.map((key) => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key),
        ]),
    );
    const listeners = new Map();

    try {
        class ProfileCanvas {}
        Object.defineProperties(globalThis, {
            document: {
                configurable: true,
                value: {
                    addEventListener(type, listener, capture) {
                        assert.equal(capture, true);
                        listeners.set(type, listener);
                    },
                },
                writable: true,
            },
            HTMLCanvasElement: {
                configurable: true,
                value: ProfileCanvas,
                writable: true,
            },
        });

        installGardenSwitchContextTracker();
        assert.equal(listeners.size, 2);
        listeners.get('webglcontextlost')?.({
            defaultPrevented: true,
            target: new ProfileCanvas(),
        });
        listeners.get('webglcontextrestored')?.({
            target: new ProfileCanvas(),
        });
        listeners.get('webglcontextlost')?.({
            defaultPrevented: false,
            target: {},
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const tracker = globalThis.__grediceGardenSwitchContextEvents;
        assert.equal(globalThis.__grediceGameProfileContextEvents, tracker);
        assert.equal(tracker.lostCount, 1);
        assert.equal(tracker.lostDefaultPreventedCount, 1);
        assert.deepEqual(tracker.lostDefaultPreventedValues, [true]);
        assert.equal(tracker.lostTimestamps.length, 1);
        assert.equal(tracker.restoredCount, 1);
        assert.equal(tracker.restoredTimestamps.length, 1);

        installProfileContextTracker();
        assert.equal(listeners.size, 2);
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

test('lifecycle cold milestones are captured at document start and first submitted draw', () => {
    const milestoneSource = installLifecycleMilestoneTracker.toString();
    const browserMetricSource = installBrowserMetrics.toString();

    assert.match(
        milestoneSource,
        /performance\.getEntriesByType\('navigation'\)/,
    );
    assert.match(milestoneSource, /new MutationObserver/);
    assert.match(milestoneSource, /new ResizeObserver/);
    assert.match(milestoneSource, /canvasAttachedMs \?\?=/);
    assert.match(milestoneSource, /canvasSizedMs/);
    assert.match(browserMetricSource, /firstSubmittedFrameMs/);
});

test('runtime GPU-source scenario disables only the external profiler timer', () => {
    const source = installBrowserMetrics.toString();

    assert.match(source, /externalGpuTimer = true/);
    assert.match(
        source,
        /if \(externalGpuTimer\) \{[\s\S]*__gameProfileGpuTimer/,
    );
    assert.match(source, /__gameProfileMetrics =/);
    assert.match(source, /patchedCreateProgram/);
    assert.match(source, /patchedDeleteProgram/);
    assert.match(source, /patchedCreateTexture/);
    assert.match(source, /patchedDeleteTexture/);
    assert.match(source, /rendererShaders: 0/);
    assert.match(source, /rendererTextures: 0/);
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

    const result = evaluateBudget(sample, budget, {
        retainedJsHeapMb: 200,
    });
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

test('render budgets gate retained heap and keep window heap diagnostic', () => {
    const sample = {
        drawCallsPerRenderedFrame: 100,
        gpu: { elapsedP95Ms: null, supported: false },
        jsHeapMb: 10_000,
        longTaskCount: 0,
        maxFrameMs: 20,
        p95FrameMs: 16,
        trianglesPerRenderedFrame: 1_000_000,
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

    const passing = evaluateBudget(sample, budget, {
        retainedJsHeapMb: 200,
    });
    const failing = evaluateBudget(sample, budget, {
        retainedJsHeapMb: 321,
    });

    assert.equal(passing.pass, true);
    assert.equal(
        passing.checks.some((check) => check.name === 'jsHeapMb'),
        false,
    );
    assert.deepEqual(
        passing.checks.find((check) => check.name === 'retainedJsHeapMb'),
        {
            actual: 200,
            limit: 320,
            name: 'retainedJsHeapMb',
            pass: true,
        },
    );
    assert.equal(failing.pass, false);
    assert.equal(evaluateBudget(sample, budget).pass, false);
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

test('markdown reports the visible static-idle zero-work witness', () => {
    const markdown = buildMarkdown({
        baseUrl: 'http://profile.local',
        generatedAt: '2026-09-01T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'static-idle',
            soakMs: 0,
            warmupMs: 5_000,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                budget: { checks: [], pass: true },
                consoleMessages: [],
                environment: null,
                name: 'game-fixed-time-static-idle-desktop-run-1',
                pageErrors: [],
                profileRun: 1,
                requested: {
                    controls: '0',
                    debugHud: '0',
                    details: '0',
                    gardenProfile: 'default',
                    hud: '0',
                    mode: 'baseline',
                    motion: 'none',
                    staticIdleProfile: true,
                },
                runtime: null,
                sample: {
                    canvas: null,
                    drawCalls: 0,
                    drawCallsPerFrame: 0,
                    drawCallsPerRenderedFrame: 0,
                    fps: 60,
                    jsHeapMb: 100,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    renderedFps: 0,
                    renderedFrames: 0,
                    runtimeFrameLoopAtEnd: { effectiveVisible: true },
                    runtimeFrameLoopAtStart: { effectiveVisible: true },
                    submittedTriangles: 0,
                    trianglesPerFrame: 0,
                    trianglesPerRenderedFrame: 0,
                },
                screenshotPath: 'static-idle.png',
                screenshotWitness: {
                    entropy: 1,
                    height: 1_440,
                    maximumChannelStandardDeviation: 10,
                    opaque: true,
                    sampledLumaRange: 40,
                    sampledUniqueColorCount: 32,
                    width: 2_560,
                },
                staticIdle: {
                    counterDeltas: {
                        deadlineCount: 0,
                        fixedStepCount: 0,
                        nonessentialHiddenWorkCount: 0,
                        ownedInvalidationCount: 0,
                        r3fFrameCallbackCount: 0,
                        wakeupCount: 0,
                    },
                    schedulerSettledAtEnd: true,
                    schedulerSettledAtStart: true,
                    zeroWorkObserved: true,
                },
            },
        ],
        schemaVersion: 5,
        sourceCommit: null,
        summary: { failedScenarios: 0 },
    });

    assert.match(markdown, /## Fixed-time visible static-idle witness/);
    assert.match(
        markdown,
        /wake 0, invalidate 0, fixed 0, deadline 0, hidden 0 \| 0 \| 0 \/ 0 \/ 0 \| yes \| yes \| pass/,
    );
});

test('markdown distinguishes ambient scheduler evidence and matched-pair failures', () => {
    const scenario = (name, fixture, sample) => ({
        budget: { checks: [], pass: true },
        consoleMessages: [],
        environment: null,
        name,
        pageErrors: [],
        requested: {
            buildingProfile: {
                expected: {
                    edges: 0,
                    footprintCells: fixture === 'blank' ? 4 : 0,
                    props: 0,
                    roofs: 0,
                },
                fixture,
                frameRateClass: 'ambient',
                mode: 'normal',
            },
            controls: '0',
            debugHud: '0',
            details: '0',
            gardenProfile: 'default',
            hud: '0',
            mode: 'baseline',
            motion: 'none',
        },
        runtime: {
            runtimeFrameLoop: {
                activeLeaseCount: 0,
                targetFramesPerSecond: 30,
            },
        },
        sample: {
            canvas: null,
            drawCallsPerFrame: 1,
            drawCallsPerRenderedFrame: 100,
            fps: 80,
            gpu: { elapsedP95Ms: 2, valid: true },
            jsHeapMb: 50,
            longTaskCount: 0,
            maxFrameMs: 30,
            p95FrameMs: sample.p95FrameMs,
            rainUnmountMs: null,
            renderedFps: sample.renderedFps,
            runtimeFrameLoopActiveLeaseCountAtEnd: 0,
            runtimeFrameLoopActiveLeaseCountAtStart: 0,
            runtimeFrameLoopActiveLeaseCountMax: 0,
            runtimeFrameLoopObservationCount: 300,
            runtimeFrameLoopTargetFramesPerSecondAtEnd: 30,
            runtimeFrameLoopTargetFramesPerSecondAtStart: 30,
            runtimeFrameLoopTargetFramesPerSecondMax: 30,
            trianglesPerFrame: 1,
            trianglesPerRenderedFrame: 5_000,
        },
        screenshotPath: null,
    });
    const scenarios = [
        scenario(
            'game-building-no-structure-network-baseline-desktop',
            'none',
            { p95FrameMs: 20, renderedFps: 25 },
        ),
        scenario('game-building-empty-shell-desktop', 'blank', {
            p95FrameMs: 23.1,
            renderedFps: 25,
        }),
    ];
    const comparison = applyGardenBuildingMatchedBaselineComparison(scenarios);
    const report = {
        baseUrl: 'http://profile.local',
        gardenBuildingMatchedBaselineComparison: comparison,
        generatedAt: '2026-09-01T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: true,
            managedServer: true,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'buildings',
            soakMs: 0,
            warmupMs: 5_000,
        },
        plantCloseupMedians: {},
        scenarios,
        schemaVersion: 6,
        sourceCommit: provenanceCommitA,
        summary: { failedScenarios: 1 },
    };
    const markdown = buildMarkdown(report);

    assert.match(markdown, /Sample target start\/max\/end/);
    assert.match(markdown, /30\/30\/30 FPS \/ 0\/0\/0 \(300\)/);
    assert.match(markdown, /Matched desktop blank-shell overhead/);
    assert.match(markdown, /physical-device 16\.7 ms desktop target/);
    assert.match(
        markdown,
        /buildingEmptyShellBrowserRafP95Regression .* exceeded both relative and absolute noise limits/,
    );

    const candidateOnly = [
        scenario('game-building-empty-shell-desktop', 'blank', {
            p95FrameMs: 23.1,
            renderedFps: 25,
        }),
    ];
    const missingComparison =
        applyGardenBuildingMatchedBaselineComparison(candidateOnly);
    const missingMarkdown = buildMarkdown({
        ...report,
        gardenBuildingMatchedBaselineComparison: missingComparison,
        scenarios: candidateOnly,
    });
    assert.match(
        missingMarkdown,
        /buildingEmptyShellMatchedBaselinePresent \| missing \| present \| n\/a \| n\/a \| matched baseline required \| fail/,
    );
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
        rendererShaders: 18,
        rendererTextures: 27,
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
        assert.equal(sampleAtEndpoint.rendererShaders, 18);
        assert.equal(sampleAtEndpoint.rendererTextures, 27);
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
        assert.equal(result.rendererShaders, 18);
        assert.equal(result.rendererTextures, 27);
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

test('interactive sampling stays on native profiler RAF and reports controlled delivery telemetry', async () => {
    const keys = [
        'document',
        'requestAnimationFrame',
        '__gameProfileDisplayCadenceControl',
        '__gameProfileInteractiveSample',
        '__gameProfileLongTasks',
        '__gameProfileMetrics',
        '__gameProfileRequestNativeAnimationFrame',
        '__grediceGameProfile',
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
    let controlledRequestCount = 0;
    let deliveredFrameCount = 100;
    const nativeCallbacks = [];

    try {
        setGlobal('document', { querySelector: () => null });
        setGlobal('requestAnimationFrame', () => {
            controlledRequestCount += 1;
            return 99;
        });
        setGlobal('__gameProfileRequestNativeAnimationFrame', (callback) => {
            nativeCallbacks.push(callback);
            return nativeCallbacks.length;
        });
        setGlobal('__gameProfileDisplayCadenceControl', {
            snapshot: () => ({
                cancelRequestCount: 2,
                cancelledBeforeDeliveryCount: 1,
                deliveredCallbackCount: deliveredFrameCount * 2,
                deliveredFrameCount,
                installed: true,
                mode: 'profiler-owned-raf-v1',
                nativeFrameCount: deliveredFrameCount * 3,
                requestedFramesPerSecond: 30,
            }),
        });
        setGlobal('__gameProfileMetrics', {
            drawCalls: 0,
            instancedDrawCalls: 0,
            renderedFrames: 0,
            submittedTriangles: 0,
        });
        setGlobal('__grediceGameProfile', {});

        beginInteractiveProfileSample();
        assert.equal(controlledRequestCount, 0);
        assert.equal(nativeCallbacks.length, 1);
        globalThis.__gameProfileInteractiveSample.startedAt =
            performance.now() - 1_000;
        deliveredFrameCount = 130;

        const sample = await finishInteractiveProfileSample();
        assert.equal(controlledRequestCount, 0);
        assert.equal(sample.displayCadenceControl.installedAtStart, true);
        assert.equal(sample.displayCadenceControl.installedAtEnd, true);
        assert.equal(
            sample.displayCadenceControl.mode,
            'profiler-owned-raf-v1',
        );
        assert.equal(sample.displayCadenceControl.requestedFramesPerSecond, 30);
        assert.equal(sample.displayCadenceControl.deliveredFrameCountDelta, 30);
        assert.equal(
            sample.displayCadenceControl.deliveredCallbackCountDelta,
            60,
        );
        assert.equal(sample.displayCadenceControl.nativeFrameCountDelta, 90);
        assert.ok(
            sample.displayCadenceControl.observedFramesPerSecond >= 29.5 &&
                sample.displayCadenceControl.observedFramesPerSecond <= 30.5,
        );
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

test('interactive sampling deep-clones scheduler owners and reports exact counter deltas', async () => {
    const keys = [
        'document',
        'requestAnimationFrame',
        '__gameProfileInteractiveSample',
        '__gameProfileLongTasks',
        '__grediceGameProfile',
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
    const runtimeFrameLoop = {
        awaitingFrameReceipt: true,
        cancelledCallbackCount: 1,
        deadlineOwners: ['spawn'],
        displayFrameCalibrationCount: 1,
        displayFrameIntervalMs: 1000 / 60,
        fixedStepFailureCount: 0,
        fixedStepOwners: ['game-time'],
        hiddenDeferredCoalescedRenderRequestCount: 1,
        hiddenCoalescedRenderRequestCount: 2,
        hiddenDeferredRenderRequestCount: 1,
        invalidationFailureCount: 0,
        missedFrameReceiptCount: 0,
        nonessentialHiddenWorkCount: 0,
        ownedInvalidationCount: 30,
        pendingFrameReceiptReconciliationWakeupCount: 1,
        postCalibrationFrameWakeupCount: 0,
        productiveWakeupCount: 19,
        r3fFrameCallbackCount: 40,
        renderLeaseOwners: ['camera'],
        renderLeaseSummaries: [
            { framesPerSecond: 30, leaseCount: 1, owner: 'camera' },
        ],
        resumeCount: 0,
        scheduledCallbackCount: 10,
        suspendCount: 0,
        retainedTimeoutReconciliationWakeupCount: 1,
        unexpectedNoWorkWakeupCount: 0,
        wakeupCount: 20,
    };
    const gameProfile = {
        hoverOutlineCompositePassCount: 8,
        hoverOutlineHorizontalPassCount: 2,
        hoverOutlineMaskCacheBypassCount: 0,
        hoverOutlineMaskCacheHitCount: 6,
        hoverOutlineMaskCacheMissCount: 2,
        hoverOutlineMaskPassCount: 2,
        runtimeFrameLoop,
    };

    try {
        setGlobal('document', { querySelector: () => null });
        setGlobal('requestAnimationFrame', () => 1);
        setGlobal('__grediceGameProfile', gameProfile);

        beginInteractiveProfileSample();

        runtimeFrameLoop.cancelledCallbackCount = 2;
        runtimeFrameLoop.deadlineOwners.push('weather-transition');
        runtimeFrameLoop.displayFrameCalibrationCount = 2;
        runtimeFrameLoop.displayFrameIntervalMs = 1000 / 120;
        runtimeFrameLoop.fixedStepOwners.push('weather');
        runtimeFrameLoop.fixedStepFailureCount = 1;
        runtimeFrameLoop.hiddenDeferredCoalescedRenderRequestCount = 4;
        runtimeFrameLoop.hiddenCoalescedRenderRequestCount = 7;
        runtimeFrameLoop.hiddenDeferredRenderRequestCount = 3;
        runtimeFrameLoop.invalidationFailureCount = 2;
        runtimeFrameLoop.missedFrameReceiptCount = 1;
        runtimeFrameLoop.ownedInvalidationCount = 34;
        runtimeFrameLoop.pendingFrameReceiptReconciliationWakeupCount = 3;
        runtimeFrameLoop.productiveWakeupCount = 22;
        runtimeFrameLoop.r3fFrameCallbackCount = 46;
        runtimeFrameLoop.renderLeaseOwners.push('weather');
        runtimeFrameLoop.renderLeaseSummaries[0].leaseCount = 2;
        runtimeFrameLoop.resumeCount = 1;
        runtimeFrameLoop.scheduledCallbackCount = 15;
        runtimeFrameLoop.suspendCount = 1;
        runtimeFrameLoop.awaitingFrameReceipt = false;
        runtimeFrameLoop.wakeupCount = 23;
        gameProfile.hoverOutlineCompositePassCount = 18;
        gameProfile.hoverOutlineHorizontalPassCount = 5;
        gameProfile.hoverOutlineMaskCacheHitCount = 13;
        gameProfile.hoverOutlineMaskCacheMissCount = 5;
        gameProfile.hoverOutlineMaskPassCount = 5;

        const sampleAtEndpoint = await finishInteractiveProfileSample();
        const sample = mergeProfileSampleDrain(sampleAtEndpoint, {
            gpu: null,
            longTasks: [],
        });

        assert.deepEqual(sample.runtimeFrameLoopAtStart.renderLeaseOwners, [
            'camera',
        ]);
        assert.deepEqual(sample.runtimeFrameLoopAtEnd.renderLeaseOwners, [
            'camera',
            'weather',
        ]);
        assert.notEqual(
            sample.runtimeFrameLoopAtStart.renderLeaseOwners,
            sample.runtimeFrameLoopAtEnd.renderLeaseOwners,
        );
        assert.equal(sample.hoverOutlineCompositePassCountDelta, 10);
        assert.equal(sample.hoverOutlineHorizontalPassCountDelta, 3);
        assert.equal(sample.hoverOutlineMaskCacheBypassCountDelta, 0);
        assert.equal(sample.hoverOutlineMaskCacheHitCountDelta, 7);
        assert.equal(sample.hoverOutlineMaskCacheMissCountDelta, 3);
        assert.equal(sample.hoverOutlineMaskPassCountDelta, 3);
        assert.deepEqual(sample.runtimeFrameLoopAtStart.fixedStepOwners, [
            'game-time',
        ]);
        assert.deepEqual(sample.runtimeFrameLoopAtStart.deadlineOwners, [
            'spawn',
        ]);
        assert.equal(
            sample.runtimeFrameLoopAtStart.renderLeaseSummaries[0].leaseCount,
            1,
        );
        assert.equal(
            sample.runtimeFrameLoopAtEnd.renderLeaseSummaries[0].leaseCount,
            2,
        );
        assert.equal(
            sample.runtimeFrameLoopAtStart.displayFrameIntervalMs,
            1000 / 60,
        );
        assert.equal(
            sample.runtimeFrameLoopAtEnd.displayFrameIntervalMs,
            1000 / 120,
        );
        assert.equal(sample.runtimeFrameLoopAtStart.awaitingFrameReceipt, true);
        assert.equal(sample.runtimeFrameLoopAtEnd.awaitingFrameReceipt, false);
        assert.deepEqual(sample.runtimeFrameLoopCounterDeltas, {
            cancelledCallbackCount: 1,
            displayFrameCalibrationCount: 1,
            fixedStepFailureCount: 1,
            hiddenDeferredCoalescedRenderRequestCount: 3,
            hiddenCoalescedRenderRequestCount: 5,
            hiddenDeferredRenderRequestCount: 2,
            invalidationFailureCount: 2,
            missedFrameReceiptCount: 1,
            nonessentialHiddenWorkCount: 0,
            ownedInvalidationCount: 4,
            pendingFrameReceiptReconciliationWakeupCount: 2,
            postCalibrationFrameWakeupCount: 0,
            productiveWakeupCount: 3,
            r3fFrameCallbackCount: 6,
            retainedTimeoutReconciliationWakeupCount: 0,
            resumeCount: 1,
            scheduledCallbackCount: 5,
            suspendCount: 1,
            unexpectedNoWorkWakeupCount: 0,
            wakeupCount: 3,
        });
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

test('interactive sampling preserves absent scheduler telemetry without changing legacy samples', async () => {
    const keys = [
        'document',
        'requestAnimationFrame',
        '__gameProfileInteractiveSample',
        '__gameProfileLongTasks',
        '__grediceGameProfile',
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

    try {
        setGlobal('document', { querySelector: () => null });
        setGlobal('requestAnimationFrame', () => 1);
        setGlobal('__grediceGameProfile', {});

        beginInteractiveProfileSample();
        const sampleAtEndpoint = await finishInteractiveProfileSample();
        const sample = mergeProfileSampleDrain(sampleAtEndpoint, {
            gpu: null,
            longTasks: [],
        });

        assert.equal(sample.runtimeFrameLoopAtStart, null);
        assert.equal(sample.runtimeFrameLoopAtEnd, null);
        assert.deepEqual(sample.runtimeFrameLoopCounterDeltas, {
            cancelledCallbackCount: null,
            displayFrameCalibrationCount: null,
            fixedStepFailureCount: null,
            hiddenDeferredCoalescedRenderRequestCount: null,
            hiddenCoalescedRenderRequestCount: null,
            hiddenDeferredRenderRequestCount: null,
            invalidationFailureCount: null,
            missedFrameReceiptCount: null,
            nonessentialHiddenWorkCount: null,
            ownedInvalidationCount: null,
            pendingFrameReceiptReconciliationWakeupCount: null,
            postCalibrationFrameWakeupCount: null,
            productiveWakeupCount: null,
            r3fFrameCallbackCount: null,
            retainedTimeoutReconciliationWakeupCount: null,
            resumeCount: null,
            scheduledCallbackCount: null,
            suspendCount: null,
            unexpectedNoWorkWakeupCount: null,
            wakeupCount: null,
        });

        const legacySample = mergeProfileSampleDrain(
            {
                drawCalls: 0,
                sampleWindow: { endedAt: 2, startedAt: 1 },
            },
            { gpu: null, longTasks: [] },
        );
        assert.equal('runtimeFrameLoopCounterDeltas' in legacySample, false);

        const legacySchedulerSample = mergeProfileSampleDrain(
            {
                runtimeFrameLoopAtEnd: { wakeupCount: 2 },
                runtimeFrameLoopAtStart: { wakeupCount: 1 },
                sampleWindow: { endedAt: 2, startedAt: 1 },
            },
            { gpu: null, longTasks: [] },
        );
        assert.equal(
            legacySchedulerSample.runtimeFrameLoopCounterDeltas
                .hiddenDeferredCoalescedRenderRequestCount,
            0,
        );
        assert.equal(
            legacySchedulerSample.runtimeFrameLoopCounterDeltas
                .hiddenCoalescedRenderRequestCount,
            0,
        );
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

test('garden-switch sampling primes the discarded RAF before switch work', async () => {
    const keys = [
        'document',
        'requestAnimationFrame',
        '__gameProfileGpuTimer',
        '__gameProfileInteractiveSample',
        '__gameProfileLongTasks',
        '__gameProfileMetrics',
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
    const frameCallbacks = [];
    const evaluatedFunctions = [];

    try {
        setGlobal('document', { querySelector: () => null });
        setGlobal('requestAnimationFrame', (callback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        setGlobal('__gameProfileMetrics', {
            drawCalls: 0,
            instancedDrawCalls: 0,
            renderedFrames: 0,
            submittedTriangles: 0,
        });

        const page = {
            evaluate(evaluatedFunction) {
                evaluatedFunctions.push(evaluatedFunction.name);
                return evaluatedFunction();
            },
        };
        const started = beginGardenSwitchProfileSample(page);
        await Promise.resolve();

        assert.deepEqual(evaluatedFunctions, [
            beginInteractiveProfileSample.name,
            primeGardenSwitchProfileSample.name,
        ]);
        assert.equal(frameCallbacks.length, 2);

        const sampleStartedAt =
            globalThis.__gameProfileInteractiveSample.startedAt;
        frameCallbacks.shift()(sampleStartedAt + 16);
        frameCallbacks.shift()(sampleStartedAt + 16);
        await started;
        assert.equal(
            globalThis.__gameProfileInteractiveSample.intervals.length,
            1,
        );
        assert.ok(
            Math.abs(
                globalThis.__gameProfileInteractiveSample.intervals[0] - 16,
            ) < 1e-9,
        );

        frameCallbacks.shift()(sampleStartedAt + 216);
        const sample = await finishInteractiveProfileSample();
        assert.equal(sample.frames, 1);
        assert.equal(Math.round(sample.maxFrameMs), 200);
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

    await assert.rejects(
        primeGardenSwitchProfileSample(),
        /No active garden-switch profile sample to prime/,
    );
});

test('profile finalization captures timed CDP counters before draining GPU queries', async () => {
    const calls = [];
    const sampleAtEndpoint = {
        drawCalls: 12,
        jsHeapMb: 48,
        sampleWindow: {
            endedAt: 200,
            startedAt: 100,
        },
    };
    const result = await finalizeProfileSampleAtEndpoint({
        cdp: {
            async send(command) {
                calls.push(`cdp:${command}`);
                return {
                    metrics: [{ name: 'TaskDuration', value: 1 }],
                };
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
    assert.equal(result.sample.jsHeapMb, 48);
    assert.equal(result.sample.longTaskCount, 1);
    assert.equal(result.sample.sampleWindow, undefined);
});

test('scenario memory evidence collects once and preserves both heap readings', async () => {
    const calls = [];
    const mebibyte = 1024 * 1024;
    let performanceMetricReadCount = 0;
    const memory = await collectScenarioMemoryEvidence({
        async send(command) {
            calls.push(command);
            if (command === 'HeapProfiler.collectGarbage') {
                return {};
            }
            performanceMetricReadCount += 1;
            return {
                metrics: [
                    {
                        name: 'JSHeapUsedSize',
                        value:
                            (performanceMetricReadCount === 1 ? 42 : 30) *
                            mebibyte,
                    },
                ],
            };
        },
    });

    assert.deepEqual(calls, [
        'Performance.getMetrics',
        'HeapProfiler.collectGarbage',
        'Performance.getMetrics',
    ]);
    assert.deepEqual(memory, {
        jsHeapBeforeCollectionMb: 42,
        measurementMode: 'post-scenario-forced-gc-v1',
        retainedJsHeapMb: 30,
    });
});

test('scenario memory evidence fails closed without both CDP heap readings', async () => {
    for (const missingRead of ['before', 'after']) {
        let performanceMetricReadCount = 0;
        await assert.rejects(
            collectScenarioMemoryEvidence({
                async send(command) {
                    if (command === 'HeapProfiler.collectGarbage') {
                        return {};
                    }
                    performanceMetricReadCount += 1;
                    const reading =
                        performanceMetricReadCount === 1 ? 'before' : 'after';
                    return {
                        metrics:
                            reading === missingRead
                                ? []
                                : [
                                      {
                                          name: 'JSHeapUsedSize',
                                          value: 30 * 1024 * 1024,
                                      },
                                  ],
                    };
                },
            }),
            new RegExp(
                `CDP did not report JSHeapUsedSize ${missingRead} scenario-end garbage collection`,
            ),
        );
    }
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
        { retainedJsHeapMb: 200 },
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
            { retainedJsHeapMb: 200 },
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

    const shaderErrorResult = evaluateHighTargetAcceptance({
        ...input,
        consoleMessages: [
            {
                type: 'error',
                text: 'THREE.WebGLProgram: Shader Error',
            },
        ],
    });
    assert.equal(shaderErrorResult.pass, false);
    assert.equal(
        shaderErrorResult.checks.find(
            (check) => check.name === 'highTargetConsoleErrors',
        )?.pass,
        false,
    );

    const localInsightsAssetResult = evaluateHighTargetAcceptance({
        ...input,
        consoleMessages: [
            {
                type: 'error',
                text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
                url: 'http://localhost:3101/_vercel/insights/script.js',
            },
        ],
    });
    assert.equal(localInsightsAssetResult.pass, true);
    assert.equal(
        localInsightsAssetResult.checks.find(
            (check) => check.name === 'highTargetConsoleErrors',
        )?.actual,
        0,
    );
});

test('cross-tier acceptance verifies resolved quality and capped backing buffer', () => {
    const input = {
        apiErrors: [],
        consoleMessages: [],
        pageErrors: [],
        requested: {
            crossTierProfile: true,
            displayCadenceControl: {
                framesPerSecond: 30,
                mode: 'profiler-owned-raf-v1',
            },
            expectedDprCap: 1,
            expectedGroundDecorationDensity: 0,
            expectedQualityTier: 'low',
            expectedShadowMapSize: 0,
            expectedShadows: false,
            dpr: 2,
            gardenProfile: 'high-target',
            outline: '1',
            outlineProfile: 'connected-raised-bed',
            outlineRaisedBedId: 2,
            quality: 'low',
            staticSceneCache: 'legacy',
            viewport: { height: 720, width: 1280 },
        },
        runtime: {
            dprCap: 1,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            groundDecorationDensity: 0,
            hoverOutlineActiveTargetCount: 2,
            hoverOutlineCompositePassCount: 150,
            hoverOutlineHorizontalPassCount: 50,
            hoverOutlineMaskCacheBypassCount: 0,
            hoverOutlineMaskCacheEligibleTargetCount: 2,
            hoverOutlineMaskCacheHitCount: 100,
            hoverOutlineMaskCacheMissCount: 50,
            hoverOutlineMaskPassCount: 50,
            hoverOutlinePipeline: 'cropped-bounded-separable-r8-content-cache',
            hoverOutlineProfileCommandAction: 'show',
            hoverOutlineProfileTargetBlockId: 'profile-raised-bed:2:0',
            hoverOutlineStyleGroupCount: 1,
            qualityTier: 'low',
            runtimeFrameLoop: {
                activeLeaseCount: 10,
                targetFramesPerSecond: 30,
            },
            shadowMapSize: 0,
            shadowsEnabled: false,
            staticOpaqueSceneCacheEnabled: false,
            weatherDisabled: false,
        },
        sample: {
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 720,
                width: 1280,
            },
            drawCalls: 100,
            displayCadenceControl: {
                deliveredCallbackCountDelta: 300,
                deliveredFrameCountDelta: 150,
                installedAtEnd: true,
                installedAtStart: true,
                mode: 'profiler-owned-raf-v1',
                nativeFrameCountDelta: 300,
                observedFramesPerSecond: 30,
                requestedFramesPerSecond: 30,
            },
            elapsedMs: 5_000,
            frames: 300,
            performanceMeasurementMode: 'separate-observer-free-window-v1',
            generatedPlantVisibleFieldCountMin: 54,
            generatedPlantVisibleInstanceCountMin: 537,
            hoverOutlineCompositePassCountDelta: 10,
            hoverOutlineHorizontalPassCountDelta: 0,
            hoverOutlineMaskCacheBypassCountDelta: 0,
            hoverOutlineMaskCacheHitCountDelta: 10,
            hoverOutlineMaskCacheMissCountDelta: 0,
            hoverOutlineMaskPassCountDelta: 0,
            hoverOutlineSemanticCompositePassCountDelta: 10,
            hoverOutlineSemanticHorizontalPassCountDelta: 0,
            hoverOutlineSemanticMaskCacheBypassCountDelta: 0,
            hoverOutlineSemanticMaskCacheHitCountDelta: 10,
            hoverOutlineSemanticMaskCacheMissCountDelta: 0,
            hoverOutlineSemanticMaskPassCountDelta: 0,
            outlineProfileDispatched: true,
            outlineProfileTelemetryAvailable: true,
            renderedFps: 30,
            renderedFrames: 150,
            reportedDpr: 2,
            runtimeFrameLoopActiveLeaseCountAtEnd: 10,
            runtimeFrameLoopActiveLeaseCountAtStart: 10,
            runtimeFrameLoopActiveLeaseCountMax: 10,
            runtimeFrameLoopActiveLeaseCountMin: 10,
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
            runtimeFrameLoopTargetFramesPerSecondAtStart: 30,
            runtimeFrameLoopTargetFramesPerSecondMax: 30,
            runtimeFrameLoopTargetFramesPerSecondMin: 30,
            submittedTriangles: 1_000_000,
        },
        screenshotWitness: {
            entropy: 1,
            height: 1_440,
            maximumChannelStandardDeviation: 10,
            opaque: true,
            sampledLumaRange: 40,
            sampledUniqueColorCount: 32,
            width: 2_560,
        },
    };

    const result = evaluateCrossTierAcceptance(input);
    assert.equal(result.pass, true);
    assert.equal(
        result.checks.every((check) => check.pass),
        true,
    );

    const legacyOutlineInput = structuredClone(input);
    legacyOutlineInput.requested.legacyOutlinePipeline = true;
    legacyOutlineInput.runtime.hoverOutlinePipeline =
        'cropped-bounded-separable-r8';
    legacyOutlineInput.runtime.hoverOutlineCompositePassCount = 50;
    delete legacyOutlineInput.runtime.hoverOutlineMaskCacheBypassCount;
    delete legacyOutlineInput.runtime.hoverOutlineMaskCacheEligibleTargetCount;
    delete legacyOutlineInput.runtime.hoverOutlineMaskCacheHitCount;
    delete legacyOutlineInput.runtime.hoverOutlineMaskCacheMissCount;
    assert.equal(evaluateCrossTierAcceptance(legacyOutlineInput).pass, true);

    const expectFailedChecks = (mutate, expectedNames) => {
        const candidate = structuredClone(input);
        mutate(candidate);
        const failedNames = new Set(
            evaluateCrossTierAcceptance(candidate)
                .checks.filter((check) => !check.pass)
                .map((check) => check.name),
        );
        for (const name of expectedNames) {
            assert.equal(failedNames.has(name), true, `${name} must fail`);
        }
    };
    expectFailedChecks(
        (candidate) => {
            candidate.sample.hoverOutlineMaskCacheHitCountDelta = null;
        },
        ['crossTierOutlinePerformanceWindowHits'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.hoverOutlineSemanticCompositePassCountDelta = 9;
        },
        ['crossTierOutlineSemanticWindowCompositeConservation'],
    );
    expectFailedChecks(
        (candidate) => {
            delete candidate.runtime.runtimeFrameLoop.targetFramesPerSecond;
        },
        ['crossTierRuntimeTargetFramesPerSecond'],
    );
    expectFailedChecks(
        (candidate) => {
            delete candidate.sample.runtimeFrameLoopTargetFramesPerSecondMax;
        },
        ['crossTierSampleMaximumTargetFramesPerSecond'],
    );
    expectFailedChecks(
        (candidate) => {
            delete candidate.sample.runtimeFrameLoopTargetFramesPerSecondMin;
        },
        ['crossTierSampleMinimumTargetFramesPerSecond'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopTargetFramesPerSecondMin = 15;
        },
        ['crossTierSampleMinimumTargetFramesPerSecond'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopTargetFramesPerSecondAtEnd = 60;
        },
        ['crossTierSampleEndTargetFramesPerSecond'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopAtStart = null;
        },
        [
            'crossTierSampleStartSnapshotTargetFramesPerSecond',
            'crossTierSampleStartVisible',
        ],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopAtEnd.targetFramesPerSecond = 60;
            candidate.sample.runtimeFrameLoopAtEnd.effectiveVisible = false;
        },
        [
            'crossTierSampleEndSnapshotTargetFramesPerSecond',
            'crossTierSampleEndVisible',
        ],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopActiveLeaseCountMax = 11;
        },
        ['crossTierSampleMaximumActiveLeaseCount'],
    );
    expectFailedChecks(
        (candidate) => {
            delete candidate.sample.runtimeFrameLoopActiveLeaseCountMin;
        },
        ['crossTierSampleMinimumActiveLeaseCount'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopActiveLeaseCountMin = 9;
        },
        ['crossTierSampleMinimumActiveLeaseCount'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopAtEnd.renderLeaseSummaries[0].framesPerSecond = 60;
        },
        ['crossTierControlEndLeaseTopology'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopSemanticLeaseTopologyAtEnd.renderLeaseOwners =
                ['different-owner'];
            candidate.sample.runtimeFrameLoopSemanticLeaseTopologyAtEnd.renderLeaseSummaries[0].owner =
                'different-owner';
        },
        ['crossTierSemanticEndLeaseTopology'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopObservationRafFrameCount = 0;
            candidate.sample.runtimeFrameLoopObservationCount = 3;
        },
        ['crossTierSemanticRafFrames'],
    );
    for (const observationCountDelta of [2, 4]) {
        expectFailedChecks(
            (candidate) => {
                candidate.sample.runtimeFrameLoopObservationCount =
                    candidate.sample.runtimeFrameLoopObservationRafFrameCount +
                    observationCountDelta;
            },
            ['crossTierRuntimeFrameLoopObservationCount'],
        );
    }
    expectFailedChecks(
        (candidate) => {
            candidate.sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount =
                candidate.sample.renderedFrames - 1;
        },
        ['crossTierRenderedFramesMatchR3fFrameCallbackDelta'],
    );
    expectFailedChecks(
        (candidate) => {
            candidate.sample.displayCadenceControl = null;
        },
        [
            'crossTierDisplayCadenceControlInstalledAtStart',
            'crossTierDisplayCadenceControlInstalledAtEnd',
            'crossTierDisplayCadenceControlObservedFramesPerSecond',
        ],
    );
    for (const observedFramesPerSecond of [27.99, 32.01]) {
        expectFailedChecks(
            (candidate) => {
                candidate.sample.displayCadenceControl.observedFramesPerSecond =
                    observedFramesPerSecond;
            },
            ['crossTierDisplayCadenceControlObservedFramesPerSecond'],
        );
    }
    for (const observedFramesPerSecond of [28, 32]) {
        assert.equal(
            evaluateCrossTierAcceptance({
                ...input,
                sample: {
                    ...input.sample,
                    displayCadenceControl: {
                        ...input.sample.displayCadenceControl,
                        observedFramesPerSecond,
                    },
                },
            }).pass,
            true,
        );
    }
    for (const renderedFps of [27.99, 32.01]) {
        expectFailedChecks(
            (candidate) => {
                candidate.sample.renderedFps = renderedFps;
            },
            ['crossTierRenderedFps'],
        );
    }
    for (const renderedFps of [28, 32]) {
        assert.equal(
            evaluateCrossTierAcceptance({
                ...input,
                sample: { ...input.sample, renderedFps },
            }).pass,
            true,
        );
    }

    assert.equal(
        evaluateCrossTierAcceptance({
            ...input,
            runtime: { ...input.runtime, qualityTier: 'medium' },
        }).pass,
        false,
    );
    assert.equal(
        evaluateCrossTierAcceptance({
            ...input,
            sample: {
                ...input.sample,
                canvas: { ...input.sample.canvas, width: 2_560 },
            },
        }).pass,
        false,
    );
    assert.equal(
        evaluateCrossTierAcceptance({
            ...input,
            sample: {
                ...input.sample,
                generatedPlantVisibleFieldCountMin: 0,
                generatedPlantVisibleInstanceCountMin: 0,
            },
        }).pass,
        false,
    );

    const cameraMotionInput = {
        ...input,
        requested: {
            ...input.requested,
            motion: 'bounded-zoom-rotate',
        },
        sample: {
            ...input.sample,
            gameCameraMotionObserved: true,
            gameCameraSnapshotAtEnd: {
                position: [-10, 10, -10],
                target: [0, 0, 0],
                version: 21,
                zoom: 100,
            },
            gameCameraSnapshotAtStart: {
                position: [-10, 10, -10],
                target: [0, 0, 0],
                version: 1,
                zoom: 100,
            },
            gameCameraSnapshotVersionDelta: 20,
            hoverOutlineCompositePassCountDelta: 11,
            hoverOutlineHorizontalPassCountDelta: 1,
            hoverOutlineMaskCacheHitCountDelta: 10,
            hoverOutlineMaskCacheMissCountDelta: 1,
            hoverOutlineMaskPassCountDelta: 1,
            hoverOutlineSemanticCompositePassCountDelta: 11,
            hoverOutlineSemanticHorizontalPassCountDelta: 1,
            hoverOutlineSemanticMaskCacheHitCountDelta: 10,
            hoverOutlineSemanticMaskCacheMissCountDelta: 1,
            hoverOutlineSemanticMaskPassCountDelta: 1,
        },
    };
    assert.equal(evaluateCrossTierAcceptance(cameraMotionInput).pass, true);
    const missingCameraMotion = evaluateCrossTierAcceptance({
        ...cameraMotionInput,
        sample: {
            ...cameraMotionInput.sample,
            gameCameraMotionObserved: false,
            gameCameraSnapshotVersionDelta: 0,
        },
    });
    assert.equal(missingCameraMotion.pass, false);
    assert.equal(
        missingCameraMotion.checks.find(
            (check) => check.name === 'crossTierCameraMotionObserved',
        )?.pass,
        false,
    );
    assert.equal(
        missingCameraMotion.checks.find(
            (check) => check.name === 'crossTierCameraSnapshotVersionDelta',
        )?.pass,
        false,
    );

    const canonicalEndpointChange = structuredClone(cameraMotionInput);
    canonicalEndpointChange.sample.gameCameraSnapshotAtEnd.position[0] += 0.5;
    const canonicalEndpointAcceptance = evaluateCrossTierAcceptance(
        canonicalEndpointChange,
    );
    assert.equal(canonicalEndpointAcceptance.pass, true);
    assert.equal(
        canonicalEndpointAcceptance.checks.some(
            (check) => check.name === 'crossTierCameraEndpointMaximumDelta',
        ),
        false,
    );
});

test('cross-tier acceptance verifies synthetic Automatic device inputs', () => {
    const input = {
        apiErrors: [],
        consoleMessages: [],
        pageErrors: [],
        requested: {
            autoQualityDeviceClass: 'standard',
            autoQualityMetrics: {
                coarsePointer: false,
                coreCount: 8,
                dpr: 2,
                memoryGb: 8,
                narrowViewport: false,
            },
            crossTierProfile: true,
            displayCadenceControl: {
                framesPerSecond: 30,
                mode: 'profiler-owned-raf-v1',
            },
            dpr: 2,
            expectedAutoQualityMetrics: {
                coarsePointer: false,
                coreCount: 8,
                dpr: 2,
                memoryGb: 8,
                narrowViewport: false,
            },
            expectedDprCap: 1.5,
            expectedGroundDecorationDensity: 0.5,
            expectedQualityTier: 'medium',
            expectedShadowMapSize: 2_048,
            expectedShadows: true,
            gardenProfile: 'high-target',
            outline: '1',
            outlineProfile: 'connected-raised-bed',
            outlineRaisedBedId: 2,
            quality: 'auto',
            staticSceneCache: 'legacy',
            viewport: { height: 720, width: 1280 },
        },
        runtime: {
            dprCap: 1.5,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            groundDecorationDensity: 0.5,
            hoverOutlineActiveTargetCount: 2,
            hoverOutlineCompositePassCount: 150,
            hoverOutlineHorizontalPassCount: 50,
            hoverOutlineMaskCacheBypassCount: 0,
            hoverOutlineMaskCacheEligibleTargetCount: 2,
            hoverOutlineMaskCacheHitCount: 100,
            hoverOutlineMaskCacheMissCount: 50,
            hoverOutlineMaskPassCount: 50,
            hoverOutlinePipeline: 'cropped-bounded-separable-r8-content-cache',
            hoverOutlineProfileCommandAction: 'show',
            hoverOutlineProfileTargetBlockId: 'profile-raised-bed:2:0',
            hoverOutlineStyleGroupCount: 1,
            qualityTier: 'medium',
            runtimeFrameLoop: {
                activeLeaseCount: 10,
                targetFramesPerSecond: 30,
            },
            shadowMapSize: 2_048,
            shadowsEnabled: true,
            staticOpaqueSceneCacheEnabled: false,
        },
        sample: {
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1_080,
                width: 1_920,
            },
            drawCalls: 100,
            displayCadenceControl: {
                deliveredCallbackCountDelta: 300,
                deliveredFrameCountDelta: 150,
                installedAtEnd: true,
                installedAtStart: true,
                mode: 'profiler-owned-raf-v1',
                nativeFrameCountDelta: 300,
                observedFramesPerSecond: 30,
                requestedFramesPerSecond: 30,
            },
            elapsedMs: 5_000,
            frames: 300,
            performanceMeasurementMode: 'separate-observer-free-window-v1',
            generatedPlantVisibleFieldCountMin: 54,
            generatedPlantVisibleInstanceCountMin: 537,
            hoverOutlineCompositePassCountDelta: 10,
            hoverOutlineHorizontalPassCountDelta: 0,
            hoverOutlineMaskCacheBypassCountDelta: 0,
            hoverOutlineMaskCacheHitCountDelta: 10,
            hoverOutlineMaskCacheMissCountDelta: 0,
            hoverOutlineMaskPassCountDelta: 0,
            hoverOutlineSemanticCompositePassCountDelta: 10,
            hoverOutlineSemanticHorizontalPassCountDelta: 0,
            hoverOutlineSemanticMaskCacheBypassCountDelta: 0,
            hoverOutlineSemanticMaskCacheHitCountDelta: 10,
            hoverOutlineSemanticMaskCacheMissCountDelta: 0,
            hoverOutlineSemanticMaskPassCountDelta: 0,
            outlineProfileDispatched: true,
            outlineProfileTelemetryAvailable: true,
            renderedFps: 30,
            renderedFrames: 150,
            reportedDpr: 2,
            runtimeFrameLoopActiveLeaseCountAtEnd: 10,
            runtimeFrameLoopActiveLeaseCountAtStart: 10,
            runtimeFrameLoopActiveLeaseCountMax: 10,
            runtimeFrameLoopActiveLeaseCountMin: 10,
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
            runtimeFrameLoopTargetFramesPerSecondAtStart: 30,
            runtimeFrameLoopTargetFramesPerSecondMax: 30,
            runtimeFrameLoopTargetFramesPerSecondMin: 30,
            submittedTriangles: 1_000_000,
        },
        screenshotWitness: {
            entropy: 1,
            height: 1_440,
            maximumChannelStandardDeviation: 10,
            opaque: true,
            sampledLumaRange: 40,
            sampledUniqueColorCount: 32,
            width: 2_560,
        },
    };
    const result = evaluateCrossTierAcceptance(input);

    assert.equal(result.pass, true);
    assert.equal(
        result.checks.every((check) => check.pass),
        true,
    );
    assert.equal(
        evaluateCrossTierAcceptance({
            ...input,
            requested: {
                ...input.requested,
                autoQualityMetrics: {
                    ...input.requested.autoQualityMetrics,
                    coreCount: 12,
                },
            },
        }).pass,
        false,
    );
});

test('fauna acceptance requires the exact fixture, census, command, network, and visual witnesses', () => {
    const speciesCounts = {
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
    const cowIds = [
        'cow:animal-debug:1:CowShelter:-6:-1:1',
        'cow:animal-debug:1:CowShelter:3:2:1',
    ];
    const blockCountsByName = {
        BirdHouse: 1,
        Block_Dry_Ground: 1,
        Block_Grass: 116,
        Bucket: 1,
        Bush: 1,
        CactusBarrel: 1,
        CactusPricklyPear: 1,
        CatPillow: 1,
        ChickenCoop: 1,
        Composter: 3,
        CowShelter: 2,
        DogHouse: 1,
        GardenBox: 3,
        GoatShelter: 1,
        HorseStable: 1,
        PigletPen: 1,
        Pine: 1,
        RabbitHutch: 1,
        SheepFold: 2,
        StoneMedium: 1,
        Stool: 1,
        Tree: 1,
        Tulip: 3,
        WaterWell: 1,
    };
    const screenshotWitness = {
        entropy: 5.2,
        height: 1_440,
        maximumChannelStandardDeviation: 42,
        opaque: true,
        sampledLumaRange: 180,
        sampledUniqueColorCount: 2_000,
        width: 2_560,
    };
    const input = {
        apiErrors: [],
        apiRequests: [],
        consoleMessages: [],
        pageErrors: [],
        requested: {
            animalProfileCommand: { behavior: 'trot', species: 'Cow' },
            controls: '0',
            debugHud: '0',
            details: '1',
            dpr: 2,
            faunaProfile: true,
            fixedTimeSeconds: 43_200,
            gardenProfile: 'fauna-heavy',
            hud: '0',
            mode: 'details',
            quality: 'high',
            staticSceneCache: 'legacy',
        },
        runtime: {
            actorGroundingShadowCount: 12,
            actorGroundingShadowDroppedCount: 0,
            actorGroundingShadowSpeciesCounts: speciesCounts,
            actorGroundingShadowVisibleCount: 12,
            groundDecorationDensity: 1,
            profileAnimalCommandAcknowledgedIds: cowIds,
            profileAnimalCommandAcknowledgementCount: 2,
            profileAnimalCommandBehavior: 'trot',
            profileAnimalCommandMovingAcknowledgedIds: cowIds,
            profileAnimalCommandMovingAcknowledgementCount: 2,
            profileAnimalCommandSequence: 1,
            profileAnimalCommandSpecies: 'Cow',
            profileGardenBlockCount: 147,
            profileGardenBlockCountsByName: blockCountsByName,
            profileGardenId: 99_995,
            profileGardenRaisedBedCount: 0,
            profileGardenStackCount: 117,
            qualityTier: 'high',
            shadowMapSize: 4_096,
            shadowsEnabled: true,
            staticOpaqueSceneCacheEnabled: false,
        },
        sample: {
            actorGroundingShadowSpeciesCountsAtEnd: speciesCounts,
            actorGroundingShadowSpeciesCountsAtStart: speciesCounts,
            actorGroundingShadowSpeciesCountsMin: speciesCounts,
            actorGroundingShadowUpdateCountDelta: 120,
            animalProfileCommandDispatched: true,
            animalProfileCommandSequenceAtStart: null,
            canvas: {
                clientHeight: 720,
                clientWidth: 1_280,
                height: 1_440,
                width: 2_560,
            },
            drawCalls: 100,
            elapsedMs: 5_000,
            renderedFps: 30,
            renderedFrames: 150,
            reportedDpr: 2,
            submittedTriangles: 100_000,
        },
        screenshotWitness,
    };

    const result = evaluateHighTargetAcceptance(input);
    assert.equal(result.pass, true);
    assert.ok(result.checks.length > 50);
    assert.equal(evaluateFaunaHeavyAcceptance(input).pass, true);
    assert.equal(isProfileScreenshotWitnessValid(screenshotWitness), true);

    const reject = (override) =>
        evaluateHighTargetAcceptance({ ...input, ...override }).pass;
    assert.equal(
        reject({
            runtime: { ...input.runtime, profileGardenBlockCount: 146 },
        }),
        false,
    );
    assert.equal(
        reject({
            sample: {
                ...input.sample,
                actorGroundingShadowSpeciesCountsMin: {
                    ...speciesCounts,
                    cow: 1,
                },
            },
        }),
        false,
    );
    assert.equal(
        reject({
            runtime: { ...input.runtime, profileAnimalCommandSequence: 2 },
        }),
        false,
    );
    assert.equal(
        reject({
            runtime: { ...input.runtime, profileAnimalCommandSequence: 0 },
            sample: {
                ...input.sample,
                animalProfileCommandSequenceAtStart: 0,
            },
        }),
        false,
    );
    assert.equal(
        reject({
            runtime: {
                ...input.runtime,
                profileAnimalCommandAcknowledgedIds: [
                    cowIds[0],
                    'cow:wrong-actor',
                ],
            },
        }),
        false,
    );
    assert.equal(
        reject({
            apiRequests: [
                {
                    method: 'GET',
                    url: 'http://profile.local/api/game/gardens',
                },
            ],
        }),
        false,
    );
    assert.equal(
        reject({
            screenshotWitness: { ...screenshotWitness, entropy: 0 },
        }),
        false,
    );
    assert.equal(
        reject({
            screenshotWitness: { ...screenshotWitness, width: 1_280 },
        }),
        false,
    );

    const scenarios = [1, 2, 3].map((profileRun) => ({
        acceptance: { pass: true },
        baseName: 'game-fauna-heavy-day-interaction-desktop',
        budget: { pass: true },
        budgetName: 'gameHighTarget',
        memory: { retainedJsHeapMb: 100 },
        name: `game-fauna-heavy-day-interaction-desktop-run-${profileRun}`,
        performanceBudget: { pass: true },
        profileRun,
        requested: input.requested,
        runtime: { qualityTier: 'high' },
        sample: {
            drawCallsPerFrame: 2,
            drawCallsPerRenderedFrame: 100,
            effectiveDprAtEnd: 2,
            gpu: { elapsedP95Ms: null, valid: false },
            jsHeapMb: 100,
            longTaskCount: 0,
            maxFrameMs: 20,
            p95FrameMs: 16,
            renderedFps: 30,
            trianglesPerFrame: 2_000,
            trianglesPerRenderedFrame: 100_000,
        },
    }));
    const medians = buildHighTargetMedians(scenarios);
    const faunaMedian = medians['game-fauna-heavy-day-interaction-desktop'];
    assert.equal(faunaMedian?.faunaProfile, true);
    assert.equal(faunaMedian?.runCount, 3);
    assert.equal(faunaMedian?.pass, true);
    assert.deepEqual(buildProfileSummary(scenarios, medians), {
        failedScenarioNames: [],
        failedScenarios: 0,
        failedRuns: 0,
        passedRuns: 3,
        passedScenarios: 1,
        totalRuns: 3,
        totalScenarios: 1,
    });

    const markdown = buildMarkdown({
        adaptiveHighComparisons: {},
        baseUrl: 'http://profile.local',
        crossTierMedians: {},
        generatedAt: '2026-08-30T00:00:00.000Z',
        highTargetMedians: medians,
        options: {
            build: true,
            managedServer: true,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'fauna',
            soakMs: 0,
            warmupMs: 5_000,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                acceptance: result,
                apiErrors: [],
                apiRequests: [],
                budget: { checks: result.checks, pass: true },
                consoleMessages: [],
                environment: null,
                name: 'game-fauna-heavy-day-interaction-desktop',
                pageErrors: [],
                profileRun: 1,
                requested: input.requested,
                runtime: input.runtime,
                sample: {
                    ...input.sample,
                    drawCallsPerFrame: 2,
                    drawCallsPerRenderedFrame: 100,
                    fps: 60,
                    jsHeapMb: 100,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    trianglesPerFrame: 2_000,
                    trianglesPerRenderedFrame: 100_000,
                },
                screenshotPath: '/tmp/fauna.png',
                screenshotWitness,
            },
        ],
        schemaVersion: 3,
        sourceCommit: 'test-sha',
        staticSceneCacheComparisons: {},
        summary: { failedScenarios: 0 },
        weatherSurfaceComparisons: {},
    });
    assert.match(markdown, /## Fauna daytime evidence/);
    assert.match(markdown, /cow:2\/2/);
    assert.match(markdown, /CowShelter:-6:-1:1/);
    assert.match(markdown, /entropy 5\.2/);
});

test('garden-switch budgets apply the absolute retained-heap ceiling', () => {
    const acceptance = {
        checks: [
            { name: 'gardenSwitchMaximumFrameStallWithinMs', pass: true },
            { name: 'gardenSwitchFixture', pass: true },
        ],
        pass: true,
    };
    const passing = buildGardenSwitchBudgets({
        acceptance,
        memory: { retainedJsHeapMb: 319 },
    });
    const failing = buildGardenSwitchBudgets({
        acceptance,
        memory: { retainedJsHeapMb: 321 },
    });

    assert.equal(passing.budget.pass, true);
    assert.equal(passing.performanceBudget.pass, true);
    assert.deepEqual(
        passing.budget.checks.find(
            (check) => check.name === 'retainedJsHeapMb',
        ),
        {
            actual: 319,
            limit: 320,
            name: 'retainedJsHeapMb',
            pass: true,
        },
    );
    assert.equal(failing.budget.pass, false);
    assert.equal(failing.performanceBudget.pass, false);
});

test('garden-switch acceptance fails closed across fixtures, interaction, visuals, identity, timing, and resources', () => {
    const speciesCounts = {
        bee: 1,
        bird: 1,
        butterfly: 3,
        cat: 1,
        chicken: 1,
        cow: 2,
        dog: 1,
        goat: 1,
        horse: 1,
        ladybug: 5,
        piglet: 1,
        rabbit: 1,
        sheep: 2,
        squirrel: 1,
    };
    const cowIds = [
        'cow:animal-debug:1:CowShelter:-6:-1:1',
        'cow:animal-debug:1:CowShelter:3:2:1',
    ];
    const screenshotWitness = {
        entropy: 5.2,
        height: 1_440,
        maximumChannelStandardDeviation: 42,
        opaque: true,
        sampledLumaRange: 180,
        sampledUniqueColorCount: 2_000,
        width: 2_560,
    };
    let faunaVisit = 0;
    const profiles = [
        'high-target',
        'fauna-heavy',
        'high-target',
        'fauna-heavy',
        'high-target',
        'fauna-heavy',
        'high-target',
    ];
    const arrivals = profiles.map((profile, index) => {
        const highTarget = profile === 'high-target';
        if (!highTarget) {
            faunaVisit += 1;
        }
        const resources = [
            [258, 24, 7],
            [490, 26, 9],
            [523, 32, 9],
            [492, 30, 9],
            [525, 32, 9],
            [492, 30, 9],
            [525, 32, 9],
        ][index];
        return {
            arrivalIndex: index + 1,
            canvas: {
                canvasCount: 1,
                clientHeight: 720,
                clientWidth: 1_280,
                contextLost: false,
                contextLostEventCount: 0,
                contextRestoredEventCount: 0,
                gardenId: highTarget ? 99_996 : 99_995,
                height: 1_440,
                sameCanvas: true,
                sameContext: true,
                sceneVisible: true,
                width: 2_560,
            },
            fixture: highTarget
                ? {
                      blockCount: 297,
                      generatedPlantExpectedInstanceCount: 537,
                      generatedPlantFieldCount: 54,
                      generatedPlantInstanceCount: 537,
                      generatedPlantVisibleFieldCount: 54,
                      generatedPlantVisibleInstanceCount: 537,
                      raisedBedCount: 3,
                      stackCount: 270,
                  }
                : {
                      actorGroundingShadowDroppedCount: 0,
                      blockCount: 147,
                      raisedBedCount: 0,
                      speciesCounts,
                      stackCount: 117,
                  },
            gardenId: highTarget ? 99_996 : 99_995,
            interaction: highTarget
                ? {
                      activeTargetCount: 2,
                      dispatched: true,
                      kind: 'outline',
                      styleGroupCount: 1,
                      targetBlockId: 'profile-raised-bed:2:0',
                      targetRaisedBedId: 2,
                  }
                : {
                      acknowledgementCount: 2,
                      acknowledgedIds: cowIds,
                      behavior: 'trot',
                      dispatched: true,
                      kind: 'animal',
                      movingAcknowledgementCount: 2,
                      movingAcknowledgedIds: cowIds,
                      sequence: faunaVisit,
                      species: 'Cow',
                  },
            profile,
            resources: {
                rendererGeometries: resources[0],
                rendererShaders: resources[1],
                rendererTextures: resources[2],
                staticOpaqueSceneCacheEnabled: false,
            },
            sample: {
                elapsedMs: index === 0 ? 5_000 : 550,
                maxFrameMs: 100,
            },
            screenshotPath: `/tmp/garden-switch-${index + 1}.png`,
            screenshotWitness,
            timing:
                index === 0
                    ? { initial: true }
                    : {
                          dispatched: true,
                          displayedMs: 280,
                          hiddenObserved: true,
                          settleTargetMs: 500,
                          settledMs: 800,
                          visibleMs: 300,
                      },
        };
    });
    const input = {
        apiErrors: [],
        apiRequests: [],
        arrivals,
        consoleMessages: [],
        pageErrors: [],
        requested: {
            dpr: 2,
            gardenSwitch: '1',
            quality: 'high',
            sampleMs: 5_000,
            staticSceneCache: 'legacy',
        },
    };
    const result = evaluateGardenSwitchAcceptance(input);
    assert.equal(result.pass, true);
    assert.ok(result.checks.length > 100);
    assert.equal(
        result.checks.filter((check) =>
            check.name.startsWith(
                'gardenSwitchResourceWarmPlateau:fauna-heavy:F2-to-F3:',
            ),
        ).length,
        3,
    );
    assert.equal(
        result.checks.filter((check) =>
            check.name.startsWith(
                'gardenSwitchResourceWarmPlateau:high-target:H3-to-H4:',
            ),
        ).length,
        3,
    );

    const rejectArrival = (index, update) => {
        const changed = arrivals.map((arrival, arrivalIndex) =>
            arrivalIndex === index
                ? {
                      ...arrival,
                      ...update(arrival),
                  }
                : arrival,
        );
        return evaluateGardenSwitchAcceptance({
            ...input,
            arrivals: changed,
        }).pass;
    };
    assert.equal(
        rejectArrival(0, (arrival) => ({
            sample: { ...arrival.sample, elapsedMs: 4_899 },
        })),
        false,
    );
    assert.equal(
        rejectArrival(1, (arrival) => ({
            sample: { ...arrival.sample, elapsedMs: 100 },
        })),
        true,
    );
    assert.equal(
        rejectArrival(1, (arrival) => ({
            canvas: { ...arrival.canvas, sameContext: false },
        })),
        false,
    );
    assert.equal(
        rejectArrival(1, (arrival) => ({
            canvas: {
                ...arrival.canvas,
                contextLostEventCount: 1,
                contextRestoredEventCount: 1,
            },
        })),
        false,
    );
    assert.equal(
        rejectArrival(2, () => ({ gardenId: 99_995 })),
        false,
    );
    assert.equal(
        rejectArrival(3, (arrival) => ({
            interaction: {
                ...arrival.interaction,
                movingAcknowledgedIds: [cowIds[0], 'cow:wrong'],
            },
        })),
        false,
    );
    assert.equal(
        rejectArrival(6, (arrival) => ({
            screenshotWitness: {
                ...arrival.screenshotWitness,
                entropy: 0,
            },
        })),
        false,
    );
    assert.equal(
        rejectArrival(6, (arrival) => ({
            timing: { ...arrival.timing, settledMs: 2_000 },
        })),
        false,
    );
    assert.equal(
        rejectArrival(5, (arrival) => ({
            resources: {
                ...arrival.resources,
                rendererTextures: 10,
            },
        })),
        false,
    );
    assert.equal(
        rejectArrival(2, (arrival) => ({
            fixture: {
                ...arrival.fixture,
                generatedPlantVisibleFieldCount: 53,
            },
        })),
        false,
    );
    assert.equal(
        rejectArrival(4, (arrival) => ({
            fixture: {
                ...arrival.fixture,
                generatedPlantVisibleInstanceCount: 536,
            },
        })),
        false,
    );
    assert.equal(
        rejectArrival(1, (arrival) => ({
            resources: {
                ...arrival.resources,
                staticOpaqueSceneCacheEnabled: true,
            },
        })),
        false,
    );
    assert.equal(
        evaluateGardenSwitchAcceptance({
            ...input,
            apiRequests: [{ method: 'GET', url: '/api/gredice' }],
        }).pass,
        false,
    );
    assert.equal(
        evaluateGardenSwitchAcceptance({
            ...input,
            requested: {
                ...input.requested,
                sampleMs: undefined,
            },
        }).pass,
        false,
    );
    assert.equal(
        evaluateGardenSwitchAcceptance({
            ...input,
            requested: {
                ...input.requested,
                staticSceneCache: 'cache',
            },
        }).pass,
        false,
    );

    const scenario = {
        acceptance: result,
        apiErrors: [],
        apiRequests: [],
        budget: { checks: result.checks, pass: true },
        consoleMessages: [],
        environment: null,
        gardenSwitch: { arrivals },
        name: 'game-garden-switch-high-fauna-single-context-desktop',
        pageErrors: [],
        requested: {
            controls: '0',
            debugHud: '0',
            details: '1',
            dpr: 2,
            gardenProfile: 'garden-switch',
            gardenSwitch: '1',
            gardenSwitchProfile: true,
            hud: '0',
            mode: 'details',
            motion: 'high-fauna-single-context-switch',
            operationVisuals: '0',
            quality: 'high',
            staticSceneCache: 'legacy',
        },
        runtime: { qualityTier: 'high', shadowsEnabled: true },
        sample: {
            canvas: arrivals.at(-1).canvas,
            drawCallsPerFrame: 2,
            drawCallsPerRenderedFrame: 100,
            fps: 60,
            jsHeapMb: 100,
            longTaskCount: 0,
            maxFrameMs: 100,
            p95FrameMs: 20,
            rainUnmountMs: null,
            renderedFps: 30,
            trianglesPerFrame: 2_000,
            trianglesPerRenderedFrame: 100_000,
        },
        screenshotPath: arrivals.at(-1).screenshotPath,
        screenshotWitness,
    };
    assert.deepEqual(buildGardenSwitchSummary([scenario]), {
        arrivalCount: 7,
        canvasPersistentArrivalCount: 7,
        contextPersistentArrivalCount: 7,
        maximumDisplayedMs: 280,
        maximumFrameMs: 100,
        maximumSettledMs: 800,
        passedScenarioCount: 1,
        resourceWarmPlateauPass: true,
        scenarioCount: 1,
        transitionCount: 6,
    });
    const repeatedScenarios = [1, 2, 3].map((profileRun) => ({
        ...scenario,
        baseName: scenario.name,
        name: `${scenario.name}-run-${profileRun}`,
        profileRun,
    }));
    const repeatedSummary = buildGardenSwitchSummary(repeatedScenarios);
    assert.equal(repeatedSummary.scenarioCount, 3);
    assert.equal(repeatedSummary.passedScenarioCount, 3);
    assert.equal(repeatedSummary.arrivalCount, 21);
    assert.equal(repeatedSummary.transitionCount, 18);
    assert.deepEqual(buildProfileSummary(repeatedScenarios, {}), {
        failedScenarioNames: [],
        failedScenarios: 0,
        failedRuns: 0,
        passedRuns: 3,
        passedScenarios: 1,
        totalRuns: 3,
        totalScenarios: 1,
    });
    const failedRepeatedScenarios = repeatedScenarios.map(
        (repeatedScenario, index) => ({
            ...repeatedScenario,
            budget: {
                ...repeatedScenario.budget,
                pass: index !== 1,
            },
        }),
    );
    assert.deepEqual(buildProfileSummary(failedRepeatedScenarios, {}), {
        failedScenarioNames: [scenario.name],
        failedScenarios: 1,
        failedRuns: 1,
        passedRuns: 2,
        passedScenarios: 0,
        totalRuns: 3,
        totalScenarios: 1,
    });
    const faunaScenarios = [1, 2, 3].map((profileRun) => ({
        acceptance: { pass: true },
        baseName: 'game-fauna-heavy-day-interaction-desktop',
        budget: { pass: true },
        budgetName: 'gameHighTarget',
        memory: { retainedJsHeapMb: 100 },
        name: `game-fauna-heavy-day-interaction-desktop-run-${profileRun}`,
        performanceBudget: { pass: true },
        profileRun,
        requested: {
            faunaProfile: true,
            gardenProfile: 'fauna-heavy',
        },
        runtime: { qualityTier: 'high' },
        sample: {
            drawCallsPerFrame: 2,
            drawCallsPerRenderedFrame: 100,
            effectiveDprAtEnd: 2,
            gpu: { elapsedP95Ms: null, valid: false },
            jsHeapMb: 100,
            longTaskCount: 0,
            maxFrameMs: 20,
            p95FrameMs: 16,
            renderedFps: 30,
            trianglesPerFrame: 2_000,
            trianglesPerRenderedFrame: 100_000,
        },
    }));
    const combinedScenarios = [...faunaScenarios, ...repeatedScenarios];
    assert.deepEqual(
        buildProfileSummary(
            combinedScenarios,
            buildHighTargetMedians(combinedScenarios),
        ),
        {
            failedScenarioNames: [],
            failedScenarios: 0,
            failedRuns: 0,
            passedRuns: 6,
            passedScenarios: 2,
            totalRuns: 6,
            totalScenarios: 2,
        },
    );
    const markdown = buildMarkdown({
        adaptiveHighComparisons: {},
        baseUrl: 'http://profile.local',
        crossTierMedians: {},
        gardenSwitchSummary: buildGardenSwitchSummary([scenario]),
        generatedAt: '2026-08-30T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: true,
            managedServer: true,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'garden-switch',
            soakMs: 0,
            warmupMs: 5_000,
        },
        plantCloseupMedians: {},
        scenarios: [scenario],
        schemaVersion: 4,
        sourceCommit: 'test-sha',
        staticSceneCacheComparisons: {},
        summary: { failedScenarios: 0 },
        weatherSurfaceComparisons: {},
    });
    assert.match(markdown, /## Persistent-Canvas garden switching/);
    assert.match(
        markdown,
        /warm resource plateau \(fauna F2→F3, High H3→H4\): pass/,
    );
    assert.match(markdown, /cache off/);
    assert.match(markdown, /fauna-heavy \/ 99995/);
    assert.match(markdown, /Cow trot #3/);
    assert.match(markdown, /dynamic bee:1 butterfly:3 ladybug:5 squirrel:1/);
});

test('lifecycle acceptance gates owned scheduling while keeping full residual and CDP evidence diagnostic', () => {
    const residual = (renderedFrames, drawCalls, submittedTriangles) => ({
        cdp: {
            layoutDuration: 0,
            scriptDuration: 0.02,
            taskDuration: 0.03,
        },
        sample: {
            drawCalls,
            elapsedMs: 5_000,
            renderedFrames,
            submittedTriangles,
        },
    });
    const residualDeltas = {
        cancelledCallbackCount: 0,
        ownedInvalidationCount: 0,
        resumeCount: 0,
        scheduledCallbackCount: 0,
        suspendCount: 0,
        wakeupCount: 0,
    };
    const result = evaluateLifecycleAcceptance({
        active: {},
        cold: {},
        context: {},
        fixture: {},
        hidden: {
            residual: residual(3, 9, 27),
            residualDeltas,
        },
        offscreen: {
            residual: residual(2, 8, 24),
            residualDeltas,
        },
        requested: { sampleMs: 5_000 },
    });
    const byName = Object.fromEntries(
        result.checks.map((check) => [check.name, check]),
    );

    assert.equal(
        byName.lifecycleOffscreenResidualRenderedFramesFinite.pass,
        true,
    );
    assert.equal(byName.lifecycleOffscreenResidualWakeupDelta.pass, true);
    assert.equal(
        byName.lifecycleOffscreenResidualOwnedInvalidationDelta.pass,
        true,
    );
    assert.equal(byName.lifecycleHiddenResidualDrawCallsFinite.pass, true);
    assert.deepEqual(result.residualWorkPolicy, {
        fullResidualZeroWorkGated: false,
        ownedSchedulingGated: true,
        rendererAndCdpGated: false,
        runtimeSchedulerGated: true,
        reason: 'The canonical comparison lifecycle preserves its compatibility gate for owned scheduling counters. Full residual runtime, renderer, and CDP evidence remains diagnostic so before-system baseline capture stays valid.',
    });
});

test('lifecycle zero-work separates owned scheduling from full render and runtime residuals', () => {
    const ownedDeltas = {
        cancelledCallbackCount: 0,
        ownedInvalidationCount: 0,
        resumeCount: 0,
        scheduledCallbackCount: 0,
        suspendCount: 0,
        wakeupCount: 0,
    };
    const fullDeltas = Object.fromEntries(
        fullRuntimeFrameLoopCounterFields.map((field) => [field, 0]),
    );
    const residual = {
        sample: {
            drawCalls: 0,
            renderedFrames: 0,
            runtimeFrameLoopCounterDeltas: fullDeltas,
            submittedTriangles: 0,
        },
    };

    assert.equal(lifecycleOwnedSchedulingZeroObserved(ownedDeltas), true);
    assert.equal(lifecycleZeroWorkObserved(residual, fullDeltas), true);

    for (const field of fullRuntimeFrameLoopCounterFields) {
        const withResidualDeltas = { ...fullDeltas, [field]: 1 };
        assert.equal(
            lifecycleZeroWorkObserved(residual, withResidualDeltas),
            false,
            field,
        );
        assert.equal(
            lifecycleOwnedSchedulingZeroObserved(ownedDeltas),
            true,
            field,
        );
    }

    for (const field of ['drawCalls', 'renderedFrames', 'submittedTriangles']) {
        const withRendererWork = structuredClone(residual);
        withRendererWork.sample[field] = 1;
        assert.equal(
            lifecycleZeroWorkObserved(withRendererWork, fullDeltas),
            false,
            field,
        );
    }
});

test('static-idle evidence and acceptance require a visible settled zero-work window', () => {
    const schedulerSnapshot = (overrides = {}) => ({
        activeDeadlineCount: 0,
        activeFixedStepLeaseCount: 0,
        activeLeaseCount: 0,
        activeRenderLeaseCount: 0,
        awaitingFrameReceipt: false,
        callbackPending: false,
        cancelledCallbackCount: 2,
        canvasVisible: true,
        coalescedRenderRequestReasons: [],
        deadlineCount: 3,
        deadlineOwners: [],
        deferredWorkCount: 0,
        displayFrameCalibrationCount: 7,
        documentVisible: true,
        effectiveVisible: true,
        fixedStepCount: 4,
        fixedStepFailureCount: 0,
        fixedStepOwners: [],
        hiddenDeferredRenderRequestCount: 0,
        invalidationCount: 12,
        invalidationFailureCount: 0,
        leaseAcquiredCount: 5,
        leaseReleasedCount: 5,
        loopActive: false,
        missedFrameReceiptCount: 0,
        nonessentialHiddenWorkCount: 0,
        ownedInvalidationCount: 8,
        pendingCallbackDueAt: null,
        pendingCallbackKind: 'none',
        pendingFrameReceiptReconciliationWakeupCount: 0,
        postCalibrationFrameWakeupCount: 0,
        productiveWakeupCount: 10,
        r3fFrameCallbackCount: 6,
        renderLeaseOwners: [],
        renderRequestReasons: [],
        resumeCount: 0,
        scheduledCallbackCount: 10,
        suspendCount: 0,
        targetFramesPerSecond: 0,
        retainedTimeoutReconciliationWakeupCount: 0,
        unexpectedNoWorkWakeupCount: 0,
        wakeupCount: 10,
        ...overrides,
    });
    const sample = {
        canvas: {
            clientHeight: 720,
            clientWidth: 1_280,
            height: 1_440,
            width: 2_560,
        },
        drawCalls: 0,
        elapsedMs: 5_000,
        frames: 300,
        renderedFps: 0,
        renderedFrames: 0,
        reportedDpr: 2,
        runtimeFrameLoopAtEnd: schedulerSnapshot(),
        runtimeFrameLoopAtStart: schedulerSnapshot(),
        submittedTriangles: 0,
    };
    const staticIdle = buildStaticIdleEvidence(sample);
    const screenshotWitness = {
        entropy: 1,
        height: 1_440,
        maximumChannelStandardDeviation: 10,
        opaque: true,
        sampledLumaRange: 40,
        sampledUniqueColorCount: 32,
        width: 2_560,
    };
    const input = {
        apiErrors: [],
        consoleMessages: [],
        pageErrors: [],
        requested: {
            continuousRenderLeases: '1',
            controls: '0',
            debugHud: '0',
            details: '0',
            fixedTimeSeconds: 43_200,
            gardenProfile: 'default',
            hud: '0',
            mode: 'baseline',
            quality: 'high',
            sampleMs: 5_000,
            staticIdle: '1',
            staticIdleProfile: true,
            staticSceneCache: 'legacy',
        },
        runtime: {
            dprCap: 2,
            profileGardenBlockCount: 15,
            profileGardenId: 99_999,
            profileGardenRaisedBedCount: 1,
            profileGardenStackCount: 12,
            qualityTier: 'high',
            shadowMapSize: 4_096,
            shadowsEnabled: true,
            staticOpaqueSceneCacheEnabled: false,
        },
        sample,
        screenshotWitness,
        staticIdle,
    };

    assert.equal(staticIdle.schedulerSettledAtStart, true);
    assert.equal(staticIdle.schedulerSettledAtEnd, true);
    assert.equal(staticIdle.schedulerZeroObserved, true);
    assert.equal(
        staticIdle.counterDeltas.hiddenDeferredCoalescedRenderRequestCount,
        0,
    );
    assert.equal(staticIdle.counterDeltas.hiddenCoalescedRenderRequestCount, 0);
    assert.equal(staticIdle.rendererZeroObserved, true);
    assert.equal(staticIdle.zeroWorkObserved, true);
    const passing = evaluateStaticIdleAcceptance(input);
    assert.equal(
        passing.pass,
        true,
        passing.checks
            .filter((check) => !check.pass)
            .map((check) => check.name)
            .join(', '),
    );

    const withoutContinuousRenderLeases = structuredClone(input);
    withoutContinuousRenderLeases.requested.continuousRenderLeases = '0';
    assert.equal(
        evaluateStaticIdleAcceptance(withoutContinuousRenderLeases).checks.find(
            (check) => check.name === 'staticIdleContinuousRenderLeases',
        )?.pass,
        false,
    );

    const withR3fWork = structuredClone(sample);
    withR3fWork.runtimeFrameLoopAtEnd.r3fFrameCallbackCount += 1;
    const r3fEvidence = buildStaticIdleEvidence(withR3fWork);
    assert.equal(r3fEvidence.zeroWorkObserved, false);
    assert.equal(
        evaluateStaticIdleAcceptance({
            ...input,
            sample: withR3fWork,
            staticIdle: r3fEvidence,
        }).pass,
        false,
    );

    const withCoalescedRequest = structuredClone(sample);
    withCoalescedRequest.runtimeFrameLoopAtEnd.coalescedRenderRequestReasons = [
        'r3f-root-update',
    ];
    const coalescedEvidence = buildStaticIdleEvidence(withCoalescedRequest);
    assert.equal(coalescedEvidence.schedulerSettledAtEnd, false);
    assert.equal(
        evaluateStaticIdleAcceptance({
            ...input,
            sample: withCoalescedRequest,
            staticIdle: coalescedEvidence,
        }).pass,
        false,
    );

    const withHiddenCoalescedCall = structuredClone(sample);
    withHiddenCoalescedCall.runtimeFrameLoopAtEnd.hiddenCoalescedRenderRequestCount = 1;
    const hiddenCoalescedEvidence = buildStaticIdleEvidence(
        withHiddenCoalescedCall,
    );
    assert.equal(hiddenCoalescedEvidence.zeroWorkObserved, false);
    assert.equal(
        evaluateStaticIdleAcceptance({
            ...input,
            sample: withHiddenCoalescedCall,
            staticIdle: hiddenCoalescedEvidence,
        }).checks.find(
            (check) =>
                check.name ===
                'staticIdleHiddenCoalescedRenderRequestCountDelta',
        )?.pass,
        false,
    );

    const withSubmittedFrame = { ...sample, drawCalls: 1, renderedFrames: 1 };
    const rendererEvidence = buildStaticIdleEvidence(withSubmittedFrame);
    assert.equal(rendererEvidence.rendererZeroObserved, false);
    assert.equal(rendererEvidence.zeroWorkObserved, false);
});

test('lifecycle acceptance passes one complete contract and rejects focused evidence mutations', () => {
    const input = createPassingLifecycleAcceptanceInput();
    const passing = evaluateLifecycleAcceptance(input);
    assert.equal(
        passing.pass,
        true,
        passing.checks
            .filter((check) => !check.pass)
            .map((check) => check.name)
            .join(', '),
    );

    const underRendered = structuredClone(input);
    underRendered.active.sample.renderedFrames = 1;
    underRendered.active.sample.renderedFps = 0.2;
    assert.equal(
        lifecycleAcceptanceCheck(underRendered, 'lifecycleActiveRenderedFrames')
            .pass,
        false,
    );

    const schedulerWakeup = structuredClone(input);
    schedulerWakeup.offscreen.residualDeltas.wakeupCount = 1;
    assert.equal(
        lifecycleAcceptanceCheck(
            schedulerWakeup,
            'lifecycleOffscreenResidualWakeupDelta',
        ).pass,
        false,
    );

    const unhandledContextLoss = structuredClone(input);
    unhandledContextLoss.context.lost.lostDefaultPreventedCount = 0;
    unhandledContextLoss.context.lost.lostDefaultPreventedValues = [false];
    assert.equal(
        lifecycleAcceptanceCheck(
            unhandledContextLoss,
            'lifecycleContextLossHandledByRuntime',
        ).pass,
        false,
    );

    const reversedContextEvents = structuredClone(input);
    reversedContextEvents.context.restoreDurationMs = -1;
    assert.equal(
        lifecycleAcceptanceCheck(
            reversedContextEvents,
            'lifecycleContextRestoreDurationMs',
        ).pass,
        false,
    );

    const replacedColdCanvas = structuredClone(input);
    replacedColdCanvas.cold.firstCanvasPersistent = false;
    assert.equal(
        lifecycleAcceptanceCheck(
            replacedColdCanvas,
            'lifecycleColdFirstCanvasPersistent',
        ).pass,
        false,
    );

    const invalidRestoredScreenshot = structuredClone(input);
    invalidRestoredScreenshot.context.restoredControl.screenshotWitness.width = 1_280;
    assert.equal(
        lifecycleAcceptanceCheck(
            invalidRestoredScreenshot,
            'lifecycleContextRestoredScreenshotWidth',
        ).pass,
        false,
    );

    const staleColdReceipt = structuredClone(input);
    staleColdReceipt.cold.fixture.resources.rendererStatsMeasurement.rendererStatsReceiptDelta = 0;
    assert.equal(
        lifecycleAcceptanceCheck(
            staleColdReceipt,
            'lifecycleColdRendererStatsMeasurementValid',
        ).pass,
        false,
    );

    const zeroColdGeometry = structuredClone(input);
    zeroColdGeometry.cold.fixture.resources.rendererGeometries = 0;
    assert.equal(
        lifecycleAcceptanceCheck(
            zeroColdGeometry,
            'lifecycleColdRendererGeometries',
        ).pass,
        false,
    );

    const zeroRestoredTexture = structuredClone(input);
    zeroRestoredTexture.context.restoredControl.fixture.resources.rendererTextures = 0;
    assert.equal(
        lifecycleAcceptanceCheck(
            zeroRestoredTexture,
            'lifecycleContextRestoredRendererTextures',
        ).pass,
        false,
    );
});

test('legacy lifecycle acceptance explicitly requires pre-receipt telemetry while canonical mode fails closed', () => {
    const input = createPassingLifecycleAcceptanceInput();
    delete input.active.runtimeFrameLoop.awaitingFrameReceipt;
    for (const resources of [
        input.cold.fixture.resources,
        input.offscreen.resumedControl.fixture.resources,
        input.hidden.resumedControl.fixture.resources,
        input.context.restoredControl.fixture.resources,
    ]) {
        Object.assign(resources.rendererStatsMeasurement, {
            legacySettleMs: 600,
            measurementMode: lifecycleRendererStatsLegacyMode,
            rendererStatsPublishedAt: null,
            rendererStatsReceiptCount: null,
            rendererStatsReceiptDelta: null,
            rendererStatsRenderFrame: null,
            r3fFrameCallbackCountDelta: null,
            runtimeMeasurementMode: null,
        });
    }

    const legacy = evaluateLifecycleAcceptance({
        ...input,
        rendererStatsMode: lifecycleRendererStatsLegacyMode,
    });
    assert.equal(
        legacy.pass,
        true,
        legacy.checks
            .filter((check) => !check.pass)
            .map((check) => check.name)
            .join(', '),
    );
    assert.equal(
        legacy.checks.find(
            (check) =>
                check.name ===
                'lifecycleActiveAwaitingFrameReceiptLegacyOmitted',
        )?.pass,
        true,
    );
    assert.equal(
        legacy.checks.some(
            (check) => check.name === 'lifecycleActiveAwaitingFrameReceiptType',
        ),
        false,
    );

    const canonicalInput = createPassingLifecycleAcceptanceInput();
    delete canonicalInput.active.runtimeFrameLoop.awaitingFrameReceipt;
    const canonical = evaluateLifecycleAcceptance(canonicalInput);
    assert.equal(
        canonical.checks.find(
            (check) => check.name === 'lifecycleActiveAwaitingFrameReceiptType',
        )?.pass,
        false,
    );

    input.active.runtimeFrameLoop.awaitingFrameReceipt = false;
    const legacyWithCanonicalTelemetry = evaluateLifecycleAcceptance({
        ...input,
        rendererStatsMode: lifecycleRendererStatsLegacyMode,
    });
    assert.equal(
        legacyWithCanonicalTelemetry.checks.find(
            (check) =>
                check.name ===
                'lifecycleActiveAwaitingFrameReceiptLegacyOmitted',
        )?.pass,
        false,
    );
});

function lifecycleAcceptanceCheck(input, name) {
    return evaluateLifecycleAcceptance(input).checks.find(
        (check) => check.name === name,
    );
}

function fullRuntimeCounterValues(value = 0) {
    return Object.fromEntries(
        fullRuntimeFrameLoopCounterFields.map((field) => [field, value]),
    );
}

function createPassingLifecycleAcceptanceInput() {
    const screenshotWitness = {
        entropy: 1,
        height: 1_440,
        maximumChannelStandardDeviation: 6,
        opaque: true,
        sampledLumaRange: 21,
        sampledUniqueColorCount: 16,
        width: 2_560,
    };
    const outline = {
        activeTargetCount: 2,
        dispatched: true,
        kind: 'outline',
        styleGroupCount: 1,
        targetBlockId: 'profile-raised-bed:2:0',
        targetRaisedBedId: 2,
    };
    const arrival = (lostEventCount = 0, restoredEventCount = 0) => ({
        canvas: {
            canvasCount: 1,
            clientHeight: 720,
            clientWidth: 1_280,
            contextLost: false,
            contextLostEventCount: lostEventCount,
            contextRestoredEventCount: restoredEventCount,
            gardenId: 99_996,
            height: 1_440,
            sameCanvas: true,
            sameContext: true,
            sceneVisible: true,
            width: 2_560,
        },
        fixture: {
            blockCount: 297,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            raisedBedCount: 3,
            stackCount: 270,
        },
        gardenId: 99_996,
        resources: {
            rendererGeometries: 258,
            rendererShaders: 24,
            rendererStatsMeasurement: {
                completedAt: 120,
                drawCallsDelta: 10,
                legacySettleMs: null,
                measurementMode: lifecycleRendererStatsCanonicalMode,
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
            rendererTextures: 7,
            staticOpaqueSceneCacheEnabled: false,
        },
    });
    const activeSample = () => ({
        drawCalls: 1_000,
        elapsedMs: 5_000,
        renderedFps: 30,
        renderedFrames: 150,
        submittedTriangles: 10_000,
    });
    const residual = () => ({
        cdp: {
            layoutDuration: 0,
            scriptDuration: 0.01,
            taskDuration: 0.02,
        },
        sample: {
            drawCalls: 0,
            elapsedMs: 5_000,
            renderedFrames: 0,
            submittedTriangles: 0,
        },
    });
    const residualDeltas = () => ({
        cancelledCallbackCount: 0,
        ownedInvalidationCount: 0,
        resumeCount: 0,
        scheduledCallbackCount: 0,
        suspendCount: 0,
        wakeupCount: 0,
    });
    const control = (lostEventCount = 0, restoredEventCount = 0) => ({
        fixture: arrival(lostEventCount, restoredEventCount),
        interaction: { ...outline },
        postCommandRender: {
            drawCalls: 10,
            renderedFrames: 1,
            submittedTriangles: 100,
        },
        screenshotWitness: { ...screenshotWitness },
    });
    const activeRuntimeFrameLoop = {
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
    };
    const offscreenControl = control();
    const hiddenControl = control();
    const restoredControl = control(1, 1);

    return {
        active: {
            runtimeFrameLoop: activeRuntimeFrameLoop,
            sample: activeSample(),
        },
        cold: {
            canvasAttachmentCount: 1,
            canvasAttachedMs: 20,
            canvasSize: { height: 1_440, width: 2_560 },
            canvasSizedMs: 30,
            contextPageCount: 1,
            domContentLoadedMs: 10,
            firstCanvasPersistent: true,
            firstSubmittedFrameMs: 40,
            fixture: arrival(),
            fixtureReadyMs: 50,
            interaction: { ...outline },
            interactionReadyMs: 60,
            screenshotWitness: { ...screenshotWitness },
        },
        context: {
            lost: {
                contextLost: true,
                lostDefaultPreventedCount: 1,
                lostDefaultPreventedValues: [true],
                lostEventCount: 1,
                lostTimestamps: [100],
                sameCanvas: true,
                sameContext: true,
            },
            lostWindow: residual(),
            precondition: {
                contextLost: false,
                lostEventCount: 0,
                restoredEventCount: 0,
                sameCanvas: true,
                sameContext: true,
            },
            restoreDurationMs: 20,
            restored: {
                canvasCount: 1,
                contextLost: false,
                restoredEventCount: 1,
                restoredTimestamps: [120],
                sameCanvas: true,
                sameContext: true,
            },
            restoredControl,
            restoredWindow: {
                cdp: { scriptDuration: 0.2, taskDuration: 0.3 },
                sample: activeSample(),
            },
            restoreRequested: true,
            supported: true,
        },
        fixture: arrival(1, 1),
        hidden: {
            before: activeRuntimeFrameLoop,
            residual: residual(),
            residualDeltas: residualDeltas(),
            resumeDeltas: { resumeCount: 1, suspendCount: 0 },
            resumed: {
                canvasVisible: true,
                documentVisible: true,
                effectiveVisible: true,
                loopActive: true,
            },
            resumedControl: hiddenControl,
            resumedDocument: { hidden: false, visibilityState: 'visible' },
            signal: 'synthetic-document-hidden',
            suspended: {
                canvasVisible: true,
                documentVisible: false,
                effectiveVisible: false,
                loopActive: false,
            },
            suspendedDocument: { hidden: true, visibilityState: 'hidden' },
            transitionDeltas: { resumeCount: 0, suspendCount: 1 },
        },
        offscreen: {
            before: activeRuntimeFrameLoop,
            residual: residual(),
            residualDeltas: residualDeltas(),
            resumeDeltas: { resumeCount: 1, suspendCount: 0 },
            resumed: {
                canvasVisible: true,
                effectiveVisible: true,
                loopActive: true,
            },
            resumedControl: offscreenControl,
            resumedIntersection: {
                boundingRect: { top: 0 },
                entry: { height: 720, isIntersecting: true, width: 1_280 },
            },
            signal: 'intersection-observer',
            suspended: {
                canvasVisible: false,
                documentVisible: true,
                effectiveVisible: false,
                loopActive: false,
            },
            suspendedIntersection: {
                boundingRect: { top: 800 },
                entry: { height: 0, isIntersecting: false, width: 0 },
            },
            transitionDeltas: { resumeCount: 0, suspendCount: 1 },
        },
        requested: {
            controls: '0',
            debugHud: '0',
            details: '1',
            dpr: 2,
            fixedTimeSeconds: 43_200,
            freshContext: true,
            gardenProfile: 'high-target',
            hud: '0',
            lifecycle: '1',
            lifecycleProfile: true,
            lifecycleRequest: '1',
            mode: 'details',
            outline: '1',
            quality: 'high',
            sampleMs: 5_000,
            staticSceneCache: 'legacy',
            viewport: { height: 720, width: 1_280 },
        },
        resolved: {
            browserDpr: 2,
            dprCap: 2,
            qualityTier: 'high',
            shadowMapSize: 4_096,
            shadowsEnabled: true,
        },
        restoredInteraction: { ...outline },
        restoredScreenshotWitness: { ...screenshotWitness },
    };
}

function createPassingLifecycleLiveAcceptanceInput() {
    const input = createPassingLifecycleAcceptanceInput();
    const persistentLeaseSummaries = [
        { framesPerSecond: 30, leaseCount: 1, owner: 'fauna:birds' },
        { framesPerSecond: 30, leaseCount: 1, owner: 'fauna:cats' },
        { framesPerSecond: 30, leaseCount: 1, owner: 'fauna:dogs' },
        { framesPerSecond: 30, leaseCount: 2, owner: 'plant-sway' },
    ];
    const resumeWindow = (sceneTimeSeconds) => {
        const startCounters = fullRuntimeCounterValues(10);
        const endCounters = {
            ...startCounters,
            ownedInvalidationCount: startCounters.ownedInvalidationCount + 60,
            r3fFrameCallbackCount: startCounters.r3fFrameCallbackCount + 60,
            wakeupCount: startCounters.wakeupCount + 60,
        };
        for (const field of [
            'fixedStepFailureCount',
            'hiddenDeferredCoalescedRenderRequestCount',
            'hiddenCoalescedRenderRequestCount',
            'hiddenDeferredRenderRequestCount',
            'invalidationFailureCount',
            'missedFrameReceiptCount',
            'nonessentialHiddenWorkCount',
        ]) {
            startCounters[field] = 0;
            endCounters[field] = 0;
        }
        startCounters.renderRequestReasons = [];
        endCounters.renderRequestReasons = [];
        startCounters.coalescedRenderRequestReasons = ['r3f-root-update'];
        endCounters.coalescedRenderRequestReasons = ['r3f-root-update'];
        return buildLifecycleResumeWindowEvidence({
            cdp: {
                layoutDuration: 0.001,
                scriptDuration: 0.01,
                taskDuration: 0.02,
            },
            sample: {
                drawCalls: 600,
                elapsedMs: 2_000,
                renderedFps: 30,
                renderedFrames: 60,
                runtimeFrameLoopAtEnd: {
                    ...endCounters,
                    sceneTimeSeconds: sceneTimeSeconds + 2,
                    targetFramesPerSecond: 30,
                },
                runtimeFrameLoopAtStart: {
                    ...startCounters,
                    sceneTimeSeconds,
                    targetFramesPerSecond: 30,
                },
                submittedTriangles: 6_000,
            },
        });
    };
    const resumeTransition = (sceneTimeSeconds) => {
        const startCounters = fullRuntimeCounterValues(10);
        const endCounters = {
            ...startCounters,
            ownedInvalidationCount: startCounters.ownedInvalidationCount + 27,
            r3fFrameCallbackCount: startCounters.r3fFrameCallbackCount + 33,
            resumeCount: startCounters.resumeCount + 1,
            wakeupCount: startCounters.wakeupCount + 27,
        };
        for (const field of [
            'fixedStepFailureCount',
            'hiddenDeferredCoalescedRenderRequestCount',
            'hiddenCoalescedRenderRequestCount',
            'hiddenDeferredRenderRequestCount',
            'invalidationFailureCount',
            'missedFrameReceiptCount',
            'nonessentialHiddenWorkCount',
        ]) {
            startCounters[field] = 0;
            endCounters[field] = 0;
        }
        startCounters.renderRequestReasons = ['deferred-shadow-refresh'];
        endCounters.renderRequestReasons = [];
        startCounters.coalescedRenderRequestReasons = ['r3f-root-update'];
        endCounters.coalescedRenderRequestReasons = ['r3f-root-update'];
        return buildLifecycleResumeTransitionEvidence({
            cdp: {
                layoutDuration: 0.001,
                scriptDuration: 0.01,
                taskDuration: 0.02,
            },
            sample: {
                drawCalls: 330,
                elapsedMs: 900,
                frames: 54,
                renderedFps: 36.7,
                renderedFrames: 33,
                runtimeFrameLoopAtEnd: {
                    ...endCounters,
                    sceneTimeSeconds: sceneTimeSeconds + 0.9,
                    targetFramesPerSecond: 30,
                },
                runtimeFrameLoopAtStart: {
                    ...startCounters,
                    sceneTimeSeconds,
                    targetFramesPerSecond: 30,
                },
                submittedTriangles: 3_300,
            },
        });
    };
    const suspendTransition = (sceneTimeSeconds, lateFrameCount) => {
        const startCounters = fullRuntimeCounterValues(10);
        const endCounters = {
            ...startCounters,
            cancelledCallbackCount: startCounters.cancelledCallbackCount + 1,
            deferredWorkCount: startCounters.deferredWorkCount + 1,
            nonessentialHiddenWorkCount:
                startCounters.nonessentialHiddenWorkCount + lateFrameCount,
            r3fFrameCallbackCount:
                startCounters.r3fFrameCallbackCount + lateFrameCount,
            suspendCount: startCounters.suspendCount + 1,
        };
        startCounters.hiddenDeferredCoalescedRenderRequestCount = 0;
        endCounters.hiddenDeferredCoalescedRenderRequestCount = 1;
        startCounters.hiddenCoalescedRenderRequestCount = 0;
        endCounters.hiddenCoalescedRenderRequestCount = 3;
        startCounters.coalescedRenderRequestReasons = [];
        endCounters.coalescedRenderRequestReasons = ['r3f-root-update'];
        return buildLifecycleSuspendTransitionEvidence({
            cdp: {
                layoutDuration: 0,
                scriptDuration: lateFrameCount * 0.001,
                taskDuration: lateFrameCount * 0.002,
            },
            sample: {
                drawCalls: lateFrameCount * 10,
                elapsedMs: 250,
                frames: 15,
                renderedFps: lateFrameCount * 4,
                renderedFrames: lateFrameCount,
                runtimeFrameLoopAtEnd: {
                    ...endCounters,
                    callbackPending: false,
                    effectiveVisible: false,
                    loopActive: false,
                    pendingCallbackKind: 'none',
                    sceneTimeSeconds: sceneTimeSeconds + lateFrameCount * 0.03,
                    targetFramesPerSecond: 0,
                },
                runtimeFrameLoopAtStart: {
                    ...startCounters,
                    sceneTimeSeconds,
                    targetFramesPerSecond: 0,
                },
                submittedTriangles: lateFrameCount * 100,
            },
        });
    };
    const activeRuntimeFrameLoop = {
        ...input.active.runtimeFrameLoop,
        activeLeaseCount: 5,
        coalescedRenderRequestReasons: ['r3f-root-update'],
        renderLeaseSummaries: [
            ...persistentLeaseSummaries,
            {
                framesPerSecond: 30,
                leaseCount: 1,
                owner: 'sprite-wobble',
            },
        ],
        sceneTimeSeconds: 100,
        targetFramesPerSecond: 30,
    };
    input.active.runtimeFrameLoop = activeRuntimeFrameLoop;
    input.active.sample.runtimeFrameLoopAtStart = {
        coalescedRenderRequestReasons: ['r3f-root-update'],
        hiddenDeferredCoalescedRenderRequestCount: 0,
        hiddenCoalescedRenderRequestCount: 0,
    };
    input.active.sample.runtimeFrameLoopAtEnd = {
        coalescedRenderRequestReasons: ['r3f-root-update'],
        hiddenDeferredCoalescedRenderRequestCount: 0,
        hiddenCoalescedRenderRequestCount: 0,
    };
    input.active.sample.runtimeFrameLoopCounterDeltas = {
        hiddenDeferredCoalescedRenderRequestCount: 0,
        hiddenCoalescedRenderRequestCount: 0,
    };
    input.requested.fixedTimeSeconds = null;
    input.requested.lifecycleLiveProfile = true;

    for (const [index, phaseName] of ['offscreen', 'hidden'].entries()) {
        const phase = input[phaseName];
        phase.residualDeltas = fullRuntimeCounterValues();
        phase.residualSceneTimeDeltaSeconds = 0;
        const residualRuntimeFrameLoop = {
            ...fullRuntimeCounterValues(10),
            coalescedRenderRequestReasons: ['r3f-root-update'],
        };
        phase.residual.sample.runtimeFrameLoopAtStart = {
            ...residualRuntimeFrameLoop,
        };
        phase.residual.sample.runtimeFrameLoopAtEnd = {
            ...residualRuntimeFrameLoop,
        };
        phase.resumeTransition = resumeTransition(100 + index);
        phase.resumeWindow = resumeWindow(101 + index);
        phase.suspendTransition = suspendTransition(
            99 + index,
            phaseName === 'hidden' ? 1 : 0,
        );
        phase.resumed = {
            ...phase.resumed,
            renderLeaseSummaries: [
                ...persistentLeaseSummaries,
                {
                    framesPerSecond: 60,
                    leaseCount: 1,
                    owner:
                        phaseName === 'offscreen'
                            ? 'particle-bursts'
                            : 'sprite-wobble',
                },
            ],
            sceneTimeSeconds: 102 + index,
            targetFramesPerSecond: 30,
        };
        phase.zeroWorkObserved = true;
    }

    return input;
}

test('lifecycle suspension evidence requires a settled endpoint and causal frame drain', () => {
    const start = {
        ...fullRuntimeCounterValues(10),
        callbackPending: true,
        effectiveVisible: true,
        loopActive: true,
        pendingCallbackKind: 'frame',
        sceneTimeSeconds: 10,
    };
    const end = {
        ...start,
        callbackPending: false,
        deferredWorkCount: start.deferredWorkCount + 1,
        effectiveVisible: false,
        hiddenDeferredCoalescedRenderRequestCount:
            start.hiddenDeferredCoalescedRenderRequestCount + 1,
        loopActive: false,
        nonessentialHiddenWorkCount: start.nonessentialHiddenWorkCount + 3,
        pendingCallbackKind: 'none',
        r3fFrameCallbackCount: start.r3fFrameCallbackCount + 3,
        sceneTimeSeconds: 10.05,
        suspendCount: start.suspendCount + 1,
    };
    const buildEvidence = (runtimeFrameLoopAtEnd) =>
        buildLifecycleSuspendTransitionEvidence({
            cdp: {},
            sample: {
                elapsedMs: 250,
                frames: 15,
                renderedFrames: 3,
                runtimeFrameLoopAtEnd,
                runtimeFrameLoopAtStart: start,
            },
        });
    const evidence = buildEvidence(end);

    assert.equal(evidence.maximumExpectedRenderedFrames, 16);
    assert.equal(evidence.maximumExpectedR3fFrameCallbacks, 16);
    assert.equal(evidence.causalHiddenWorkBoundary, 3);
    assert.equal(evidence.settledAtEnd, true);

    for (const mutation of [
        { effectiveVisible: true },
        { loopActive: true },
        { callbackPending: true },
        { pendingCallbackKind: 'frame' },
    ]) {
        assert.equal(
            buildEvidence({ ...end, ...mutation }).settledAtEnd,
            false,
        );
    }
});

test('live lifecycle suspension bounds action drain and requires exact-zero settled work', () => {
    const input = createPassingLifecycleLiveAcceptanceInput();

    for (const phaseName of ['offscreen', 'hidden']) {
        const phaseLabel = phaseName[0].toUpperCase() + phaseName.slice(1);
        const prefix = `lifecycleLive${phaseLabel}SuspendTransition`;
        const boundedDrain = structuredClone(input);
        const boundedTransition = boundedDrain[phaseName].suspendTransition;
        boundedTransition.sample.renderedFrames = 3;
        boundedTransition.counterDeltas.r3fFrameCallbackCount = 3;
        boundedTransition.counterDeltas.nonessentialHiddenWorkCount = 3;
        boundedTransition.causalHiddenWorkBoundary = 3;
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}RenderedFramesBrowserBound`,
            ).pass,
            true,
            `${phaseName}:bounded-render-drain`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}R3fFrameCallbackBrowserBound`,
            ).pass,
            true,
            `${phaseName}:bounded-r3f-drain`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}NonessentialHiddenWorkCausalBound`,
            ).pass,
            true,
            `${phaseName}:causal-hidden-work`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}RendererAndR3fFrameCountMatch`,
            ).pass,
            true,
            `${phaseName}:renderer-r3f-match`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(boundedDrain, `${prefix}SettledAtEnd`)
                .pass,
            true,
            `${phaseName}:settled-endpoint`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}HiddenDeferredCoalescedRenderRequestCountDelta`,
            ).pass,
            true,
            `${phaseName}:one-coalesced-hidden-request`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}HiddenCoalescedRenderRequestCountDelta`,
            ).pass,
            true,
            `${phaseName}:three-persistent-fauna-hidden-requests`,
        );
        assert.equal(
            lifecycleAcceptanceCheck(
                boundedDrain,
                `${prefix}EndCoalescedRenderRequestReasonsBounded`,
            ).pass,
            true,
            `${phaseName}:allowed-coalesced-reason`,
        );

        const excessiveCoalescedHiddenWork = structuredClone(input);
        excessiveCoalescedHiddenWork[
            phaseName
        ].suspendTransition.counterDeltas.hiddenDeferredCoalescedRenderRequestCount =
            2;
        assert.equal(
            lifecycleAcceptanceCheck(
                excessiveCoalescedHiddenWork,
                `${prefix}HiddenDeferredCoalescedRenderRequestCountDelta`,
            ).pass,
            false,
            `${phaseName}:coalesced-hidden-request-burst`,
        );

        const excessiveTotalCoalescedHiddenWork = structuredClone(input);
        excessiveTotalCoalescedHiddenWork[
            phaseName
        ].suspendTransition.counterDeltas.hiddenCoalescedRenderRequestCount = 4;
        assert.equal(
            lifecycleAcceptanceCheck(
                excessiveTotalCoalescedHiddenWork,
                `${prefix}HiddenCoalescedRenderRequestCountDelta`,
            ).pass,
            false,
            `${phaseName}:total-coalesced-hidden-request-burst`,
        );

        const missingTotalCoalescedHiddenWork = structuredClone(input);
        missingTotalCoalescedHiddenWork[
            phaseName
        ].suspendTransition.counterDeltas.hiddenCoalescedRenderRequestCount = 0;
        assert.equal(
            lifecycleAcceptanceCheck(
                missingTotalCoalescedHiddenWork,
                `${prefix}HiddenCoalescedRenderRequestCountIncludesDeferredDelta`,
            ).pass,
            false,
            `${phaseName}:total-must-include-deferred-coalesced-work`,
        );

        const unexpectedCoalescedReason = structuredClone(input);
        unexpectedCoalescedReason[
            phaseName
        ].suspendTransition.sample.runtimeFrameLoopAtEnd.coalescedRenderRequestReasons =
            ['unexpected-root-update'];
        assert.equal(
            lifecycleAcceptanceCheck(
                unexpectedCoalescedReason,
                `${prefix}EndCoalescedRenderRequestReasonsBounded`,
            ).pass,
            false,
            `${phaseName}:unexpected-coalesced-reason`,
        );

        const excessiveCoalescedReasons = structuredClone(input);
        excessiveCoalescedReasons[
            phaseName
        ].suspendTransition.sample.runtimeFrameLoopAtEnd.coalescedRenderRequestReasons =
            ['r3f-root-update', 'r3f-root-update'];
        assert.equal(
            lifecycleAcceptanceCheck(
                excessiveCoalescedReasons,
                `${prefix}EndCoalescedRenderRequestReasonsBounded`,
            ).pass,
            false,
            `${phaseName}:too-many-coalesced-reasons`,
        );

        const rendererBurst = structuredClone(input);
        rendererBurst[phaseName].suspendTransition.sample.renderedFrames =
            rendererBurst[phaseName].suspendTransition
                .maximumExpectedRenderedFrames + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                rendererBurst,
                `${prefix}RenderedFramesBrowserBound`,
            ).pass,
            false,
            `${phaseName}:renderer-browser-bound`,
        );

        const r3fBurst = structuredClone(input);
        r3fBurst[
            phaseName
        ].suspendTransition.counterDeltas.r3fFrameCallbackCount =
            r3fBurst[phaseName].suspendTransition
                .maximumExpectedR3fFrameCallbacks + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                r3fBurst,
                `${prefix}R3fFrameCallbackBrowserBound`,
            ).pass,
            false,
            `${phaseName}:r3f-browser-bound`,
        );

        const unexplainedHiddenWork = structuredClone(input);
        unexplainedHiddenWork[
            phaseName
        ].suspendTransition.counterDeltas.nonessentialHiddenWorkCount =
            unexplainedHiddenWork[phaseName].suspendTransition
                .causalHiddenWorkBoundary + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                unexplainedHiddenWork,
                `${prefix}NonessentialHiddenWorkCausalBound`,
            ).pass,
            false,
            `${phaseName}:unexplained-hidden-work`,
        );

        const rendererMismatch = structuredClone(input);
        rendererMismatch[phaseName].suspendTransition.sample.renderedFrames +=
            1;
        assert.equal(
            lifecycleAcceptanceCheck(
                rendererMismatch,
                `${prefix}RendererAndR3fFrameCountMatch`,
            ).pass,
            false,
            `${phaseName}:renderer-r3f-mismatch`,
        );

        const unsettled = structuredClone(input);
        unsettled[phaseName].suspendTransition.settledAtEnd = false;
        assert.equal(
            lifecycleAcceptanceCheck(unsettled, `${prefix}SettledAtEnd`).pass,
            false,
            `${phaseName}:unsettled-endpoint`,
        );

        for (const field of [
            'scheduledCallbackCount',
            'wakeupCount',
            'invalidationCount',
            'ownedInvalidationCount',
        ]) {
            const oneInFlightCallback = structuredClone(input);
            oneInFlightCallback[phaseName].suspendTransition.counterDeltas[
                field
            ] = 1;
            assert.equal(
                lifecycleAcceptanceCheck(
                    oneInFlightCallback,
                    `${prefix}${field[0].toUpperCase()}${field.slice(1)}Delta`,
                ).pass,
                true,
                `${phaseName}:one-in-flight:${field}`,
            );

            const callbackBurst = structuredClone(input);
            callbackBurst[phaseName].suspendTransition.counterDeltas[field] = 2;
            assert.equal(
                lifecycleAcceptanceCheck(
                    callbackBurst,
                    `${prefix}${field[0].toUpperCase()}${field.slice(1)}Delta`,
                ).pass,
                false,
                `${phaseName}:callback-burst:${field}`,
            );
        }

        for (const [field, value, suffix] of [
            ['suspendCount', 0, 'SuspendCountDelta'],
            ['deferredWorkCount', 0, 'DeferredWorkCountDelta'],
            ['cancelledCallbackCount', 2, 'CancelledCallbackCountDelta'],
        ]) {
            const invalidTransition = structuredClone(input);
            invalidTransition[phaseName].suspendTransition.counterDeltas[
                field
            ] = value;
            assert.equal(
                lifecycleAcceptanceCheck(
                    invalidTransition,
                    `${prefix}${suffix}`,
                ).pass,
                false,
                `${phaseName}:transition:${field}`,
            );
        }

        const tooLong = structuredClone(input);
        tooLong[phaseName].suspendTransition.sample.elapsedMs = 401;
        assert.equal(
            lifecycleAcceptanceCheck(tooLong, `${prefix}ElapsedMsMaximum`).pass,
            false,
            `${phaseName}:elapsed-maximum`,
        );

        const sceneTimeAdvanced = structuredClone(input);
        sceneTimeAdvanced[phaseName].suspendTransition.sceneTimeDeltaSeconds =
            0.100_001;
        assert.equal(
            lifecycleAcceptanceCheck(
                sceneTimeAdvanced,
                `${prefix}SceneTimeDeltaBounded`,
            ).pass,
            false,
            `${phaseName}:scene-time-bound`,
        );

        const residualRenderedFrame = structuredClone(input);
        residualRenderedFrame[phaseName].residual.sample.renderedFrames = 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                residualRenderedFrame,
                `lifecycle${phaseLabel}ResidualRenderedFrames`,
            ).pass,
            false,
            `${phaseName}:residual-rendered-frame`,
        );

        const residualR3fFrame = structuredClone(input);
        residualR3fFrame[phaseName].residualDeltas.r3fFrameCallbackCount = 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                residualR3fFrame,
                `lifecycle${phaseLabel}ResidualR3fFrameCallbackCountDelta`,
            ).pass,
            false,
            `${phaseName}:residual-r3f-frame`,
        );

        const residualSceneTime = structuredClone(input);
        residualSceneTime[phaseName].residualSceneTimeDeltaSeconds = 0.000_001;
        assert.equal(
            lifecycleAcceptanceCheck(
                residualSceneTime,
                `lifecycleLive${phaseLabel}ResidualSceneTimeDelta`,
            ).pass,
            false,
            `${phaseName}:residual-scene-time`,
        );
    }
});

test('live lifecycle resume transition bounds owned cadence, browser frames, requests, and failures', () => {
    const input = createPassingLifecycleLiveAcceptanceInput();

    for (const phaseName of ['offscreen', 'hidden']) {
        const phaseLabel = phaseName[0].toUpperCase() + phaseName.slice(1);
        const prefix = `lifecycleLive${phaseLabel}ResumeTransition`;

        const ownedCatchUp = structuredClone(input);
        ownedCatchUp[
            phaseName
        ].resumeTransition.counterDeltas.ownedInvalidationCount =
            ownedCatchUp[phaseName].resumeTransition
                .maximumExpectedOwnedInvalidations + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                ownedCatchUp,
                `${prefix}OwnedInvalidationCadenceBound`,
            ).pass,
            false,
            `${phaseName}:owned-cadence`,
        );

        const rendererBurst = structuredClone(input);
        rendererBurst[phaseName].resumeTransition.sample.renderedFrames =
            rendererBurst[phaseName].resumeTransition
                .maximumExpectedRenderedFrames + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                rendererBurst,
                `${prefix}RenderedFramesBrowserBound`,
            ).pass,
            false,
            `${phaseName}:renderer-browser-bound`,
        );

        const r3fBurst = structuredClone(input);
        r3fBurst[
            phaseName
        ].resumeTransition.counterDeltas.r3fFrameCallbackCount =
            r3fBurst[phaseName].resumeTransition
                .maximumExpectedR3fFrameCallbacks + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                r3fBurst,
                `${prefix}R3fFrameCallbackBrowserBound`,
            ).pass,
            false,
            `${phaseName}:r3f-browser-bound`,
        );

        const semanticSurplus = structuredClone(input);
        semanticSurplus[
            phaseName
        ].resumeTransition.r3fOwnedInvalidationSurplus =
            semanticSurplus[phaseName].resumeTransition
                .maximumExpectedR3fOwnedInvalidationSurplus + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                semanticSurplus,
                `${prefix}R3fOwnedInvalidationSurplusBound`,
            ).pass,
            false,
            `${phaseName}:semantic-surplus`,
        );

        const rendererMismatch = structuredClone(input);
        rendererMismatch[phaseName].resumeTransition.sample.renderedFrames -= 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                rendererMismatch,
                `${prefix}RendererAndR3fFrameCountMatch`,
            ).pass,
            false,
            `${phaseName}:renderer-r3f-match`,
        );

        const missingResume = structuredClone(input);
        missingResume[phaseName].resumeTransition.counterDeltas.resumeCount = 0;
        assert.equal(
            lifecycleAcceptanceCheck(missingResume, `${prefix}ResumeCountDelta`)
                .pass,
            false,
            `${phaseName}:resume-count`,
        );

        const sceneTimeFastForward = structuredClone(input);
        const elapsedSeconds =
            sceneTimeFastForward[phaseName].resumeTransition.sample.elapsedMs /
            1_000;
        sceneTimeFastForward[phaseName].resumeTransition.sceneTimeDeltaSeconds =
            elapsedSeconds + 0.150_001;
        assert.equal(
            lifecycleAcceptanceCheck(
                sceneTimeFastForward,
                `${prefix}SceneTimeDeltaBounded`,
            ).pass,
            false,
            `${phaseName}:scene-time-bound`,
        );

        const pendingRequest = structuredClone(input);
        pendingRequest[
            phaseName
        ].resumeTransition.sample.runtimeFrameLoopAtEnd.renderRequestReasons = [
            'still-pending',
        ];
        assert.equal(
            lifecycleAcceptanceCheck(
                pendingRequest,
                `${prefix}RenderRequestsDrained`,
            ).pass,
            false,
            `${phaseName}:request-drain`,
        );

        for (const field of [
            'fixedStepFailureCount',
            'hiddenDeferredCoalescedRenderRequestCount',
            'hiddenCoalescedRenderRequestCount',
            'hiddenDeferredRenderRequestCount',
            'invalidationFailureCount',
            'missedFrameReceiptCount',
            'nonessentialHiddenWorkCount',
        ]) {
            const failedRuntime = structuredClone(input);
            failedRuntime[phaseName].resumeTransition.counterDeltas[field] = 1;
            assert.equal(
                lifecycleAcceptanceCheck(
                    failedRuntime,
                    `${prefix}${field[0].toUpperCase()}${field.slice(1)}Delta`,
                ).pass,
                false,
                `${phaseName}:runtime-failure:${field}`,
            );
        }
    }
});

test('live lifecycle steady resume keeps owned and R3F cadence strict with no pending requests', () => {
    const input = createPassingLifecycleLiveAcceptanceInput();

    for (const phaseName of ['offscreen', 'hidden']) {
        const phaseLabel = phaseName[0].toUpperCase() + phaseName.slice(1);
        const prefix = `lifecycleLive${phaseLabel}Resume`;

        const ownedCatchUp = structuredClone(input);
        ownedCatchUp[
            phaseName
        ].resumeWindow.counterDeltas.ownedInvalidationCount =
            ownedCatchUp[phaseName].resumeWindow
                .maximumExpectedOwnedInvalidations + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                ownedCatchUp,
                `${prefix}OwnedInvalidationCadenceBound`,
            ).pass,
            false,
            `${phaseName}:owned-cadence`,
        );

        const r3fCatchUp = structuredClone(input);
        r3fCatchUp[phaseName].resumeWindow.counterDeltas.r3fFrameCallbackCount =
            r3fCatchUp[phaseName].resumeWindow
                .maximumExpectedR3fFrameCallbacks + 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                r3fCatchUp,
                `${prefix}R3fFrameCallbackCadenceBound`,
            ).pass,
            false,
            `${phaseName}:r3f-cadence`,
        );

        for (const [endpoint, checkSuffix] of [
            ['runtimeFrameLoopAtStart', 'RenderRequestsEmptyAtStart'],
            ['runtimeFrameLoopAtEnd', 'RenderRequestsEmptyAtEnd'],
        ]) {
            const pendingRequest = structuredClone(input);
            pendingRequest[phaseName].resumeWindow.sample[
                endpoint
            ].renderRequestReasons = ['still-pending'];
            assert.equal(
                lifecycleAcceptanceCheck(
                    pendingRequest,
                    `${prefix}${checkSuffix}`,
                ).pass,
                false,
                `${phaseName}:${endpoint}`,
            );
        }

        const coalescedHiddenWork = structuredClone(input);
        coalescedHiddenWork[
            phaseName
        ].resumeWindow.counterDeltas.hiddenDeferredCoalescedRenderRequestCount =
            1;
        assert.equal(
            lifecycleAcceptanceCheck(
                coalescedHiddenWork,
                `${prefix}HiddenDeferredCoalescedRenderRequestCountDelta`,
            ).pass,
            false,
            `${phaseName}:coalesced-hidden-work`,
        );

        const totalCoalescedHiddenWork = structuredClone(input);
        totalCoalescedHiddenWork[
            phaseName
        ].resumeWindow.counterDeltas.hiddenCoalescedRenderRequestCount = 1;
        assert.equal(
            lifecycleAcceptanceCheck(
                totalCoalescedHiddenWork,
                `${prefix}HiddenCoalescedRenderRequestCountDelta`,
            ).pass,
            false,
            `${phaseName}:total-coalesced-hidden-work`,
        );
    }
});

test('live lifecycle acceptance gates exhaustive zero work, bounded resume health, and persistent cadence', () => {
    const input = createPassingLifecycleLiveAcceptanceInput();
    const passing = evaluateLifecycleAcceptance(input);
    assert.equal(
        passing.pass,
        true,
        passing.checks
            .filter((check) => !check.pass)
            .map((check) => check.name)
            .join(', '),
    );
    assert.equal(
        lifecycleAcceptanceCheck(
            input,
            'lifecycleLiveActiveCoalescedRenderRequestReasonsBounded',
        ).pass,
        true,
    );
    const unexpectedActiveCoalescedReason = structuredClone(input);
    unexpectedActiveCoalescedReason.active.runtimeFrameLoop.coalescedRenderRequestReasons =
        ['unexpected-root-update'];
    assert.equal(
        lifecycleAcceptanceCheck(
            unexpectedActiveCoalescedReason,
            'lifecycleLiveActiveCoalescedRenderRequestReasonsBounded',
        ).pass,
        false,
    );
    const activeCoalescedHiddenWork = structuredClone(input);
    activeCoalescedHiddenWork.active.sample.runtimeFrameLoopCounterDeltas.hiddenDeferredCoalescedRenderRequestCount = 1;
    assert.equal(
        lifecycleAcceptanceCheck(
            activeCoalescedHiddenWork,
            'lifecycleLiveActiveHiddenDeferredCoalescedRenderRequestCountDelta',
        ).pass,
        false,
    );
    const activeTotalCoalescedHiddenWork = structuredClone(input);
    activeTotalCoalescedHiddenWork.active.sample.runtimeFrameLoopCounterDeltas.hiddenCoalescedRenderRequestCount = 1;
    assert.equal(
        lifecycleAcceptanceCheck(
            activeTotalCoalescedHiddenWork,
            'lifecycleLiveActiveHiddenCoalescedRenderRequestCountDelta',
        ).pass,
        false,
    );
    assert.deepEqual(passing.residualWorkPolicy, {
        cdpFiniteDiagnostic: true,
        fullResidualZeroWorkGated: true,
        ownedSchedulingGated: true,
        rendererGated: true,
        runtimeSchedulerGated: true,
        reason: 'The candidate-only live lifecycle gates every offscreen and synthetic-hidden runtime counter, R3F callback, rendered frame, draw call, and submitted triangle at exact zero. CDP script, task, and layout durations remain finite diagnostics rather than zero-work gates.',
    });
    assert.deepEqual(
        normalizeRenderLeaseSummaryRates(
            input.offscreen.resumed.renderLeaseSummaries,
            {
                'fauna:birds': 30,
                'fauna:cats': 30,
                'fauna:dogs': 30,
                'plant-sway': 30,
            },
        ),
        {
            'fauna:birds': 30,
            'fauna:cats': 30,
            'fauna:dogs': 30,
            'plant-sway': 30,
        },
    );

    for (const phaseName of ['offscreen', 'hidden']) {
        const phaseLabel = phaseName[0].toUpperCase() + phaseName.slice(1);
        for (const field of fullRuntimeFrameLoopCounterFields) {
            const mutation = structuredClone(input);
            mutation[phaseName].residualDeltas[field] = 1;
            assert.equal(
                lifecycleAcceptanceCheck(
                    mutation,
                    `lifecycle${phaseLabel}Residual${field[0].toUpperCase()}${field.slice(1)}Delta`,
                ).pass,
                false,
                `${phaseName}:${field}`,
            );
            assert.equal(evaluateLifecycleAcceptance(mutation).pass, false);
        }
        for (const [field, checkSuffix] of [
            ['renderedFrames', 'RenderedFrames'],
            ['drawCalls', 'DrawCalls'],
            ['submittedTriangles', 'SubmittedTriangles'],
        ]) {
            const mutation = structuredClone(input);
            mutation[phaseName].residual.sample[field] = 1;
            assert.equal(
                lifecycleAcceptanceCheck(
                    mutation,
                    `lifecycle${phaseLabel}Residual${checkSuffix}`,
                ).pass,
                false,
                `${phaseName}:${field}`,
            );
        }
        const withoutZeroWitness = structuredClone(input);
        withoutZeroWitness[phaseName].zeroWorkObserved = false;
        assert.equal(
            lifecycleAcceptanceCheck(
                withoutZeroWitness,
                `lifecycle${phaseLabel}ResidualZeroWorkObserved`,
            ).pass,
            false,
        );
        for (const [field, suffix] of [
            ['scriptDuration', 'ScriptDuration'],
            ['taskDuration', 'TaskDuration'],
            ['layoutDuration', 'LayoutDuration'],
        ]) {
            const mutation = structuredClone(input);
            mutation[phaseName].residual.cdp[field] = Number.NaN;
            assert.equal(
                lifecycleAcceptanceCheck(
                    mutation,
                    `lifecycle${phaseLabel}ResidualCdp${suffix}`,
                ).pass,
                false,
            );
        }
        const sceneTimeAdvanced = structuredClone(input);
        sceneTimeAdvanced[phaseName].residualSceneTimeDeltaSeconds = 0.001;
        assert.equal(
            lifecycleAcceptanceCheck(
                sceneTimeAdvanced,
                `lifecycleLive${phaseLabel}ResidualSceneTimeDelta`,
            ).pass,
            false,
        );

        for (const owner of [
            'fauna:birds',
            'fauna:cats',
            'fauna:dogs',
            'plant-sway',
        ]) {
            const missingOwner = structuredClone(input);
            missingOwner[phaseName].resumed.renderLeaseSummaries = missingOwner[
                phaseName
            ].resumed.renderLeaseSummaries.filter(
                (summary) => summary.owner !== owner,
            );
            assert.equal(
                lifecycleAcceptanceCheck(
                    missingOwner,
                    `lifecycleLive${phaseLabel}RenderLeaseRatesRestored`,
                ).pass,
                false,
                `${phaseName}:missing:${owner}`,
            );

            const wrongRate = structuredClone(input);
            wrongRate[phaseName].resumed.renderLeaseSummaries.find(
                (summary) => summary.owner === owner,
            ).framesPerSecond = 29;
            assert.equal(
                lifecycleAcceptanceCheck(
                    wrongRate,
                    `lifecycleLive${phaseLabel}RenderLeaseRatesRestored`,
                ).pass,
                false,
                `${phaseName}:rate:${owner}`,
            );
        }

        const wrongTarget = structuredClone(input);
        wrongTarget[phaseName].resumed.targetFramesPerSecond = 29;
        assert.equal(
            lifecycleAcceptanceCheck(
                wrongTarget,
                `lifecycleLive${phaseLabel}TargetFramesPerSecondRestored`,
            ).pass,
            false,
        );

        for (const [path, value, checkSuffix] of [
            ['sample.elapsedMs', 1_849, 'ElapsedMs'],
            ['sample.elapsedMs', 2_101, 'ElapsedMsMaximum'],
            ['sceneTimeDeltaSeconds', 0, 'SceneTimeDeltaSeconds'],
            ['sceneTimeDeltaSeconds', 2.151, 'SceneTimeDeltaBounded'],
            ['targetFramesPerSecond', 0, 'TargetFramesPerSecond'],
            ['sample.renderedFrames', 0, 'RenderedFrames'],
            ['sample.drawCalls', 0, 'DrawCalls'],
            ['sample.submittedTriangles', 0, 'SubmittedTriangles'],
            ['counterDeltas.wakeupCount', 0, 'WakeupDelta'],
            [
                'counterDeltas.ownedInvalidationCount',
                0,
                'OwnedInvalidationDelta',
            ],
            ['counterDeltas.r3fFrameCallbackCount', 0, 'R3fFrameCallbackDelta'],
        ]) {
            const mutation = structuredClone(input);
            const segments = path.split('.');
            let target = mutation[phaseName].resumeWindow;
            while (segments.length > 1) {
                target = target[segments.shift()];
            }
            target[segments[0]] = value;
            assert.equal(
                lifecycleAcceptanceCheck(
                    mutation,
                    `lifecycleLive${phaseLabel}Resume${checkSuffix}`,
                ).pass,
                false,
                `${phaseName}:${path}`,
            );
        }
        const catchUpBurst = structuredClone(input);
        catchUpBurst[phaseName].resumeWindow.sample.renderedFrames =
            catchUpBurst[phaseName].resumeWindow.maximumExpectedRenderedFrames +
            1;
        assert.equal(
            lifecycleAcceptanceCheck(
                catchUpBurst,
                `lifecycleLive${phaseLabel}ResumeRenderedFramesCatchUpBound`,
            ).pass,
            false,
        );
        for (const field of [
            'fixedStepFailureCount',
            'hiddenDeferredCoalescedRenderRequestCount',
            'hiddenCoalescedRenderRequestCount',
            'hiddenDeferredRenderRequestCount',
            'invalidationFailureCount',
            'missedFrameReceiptCount',
            'nonessentialHiddenWorkCount',
        ]) {
            const mutation = structuredClone(input);
            mutation[phaseName].resumeWindow.counterDeltas[field] = 1;
            assert.equal(
                lifecycleAcceptanceCheck(
                    mutation,
                    `lifecycleLive${phaseLabel}Resume${field[0].toUpperCase()}${field.slice(1)}Delta`,
                ).pass,
                false,
                `${phaseName}:${field}`,
            );
        }
    }
});

function createPassingRuntimeOwnersAcceptanceInput({
    autoQualityDeviceClass = 'unspecified',
    dprCap = 2,
    groundDecorationDensity = 1,
    quality = 'high',
    shadowMapSize = 4_096,
    shadowsEnabled = true,
    tier = 'high',
} = {}) {
    const autoQualityMetrics =
        autoQualityDeviceClass === 'standard'
            ? {
                  coarsePointer: false,
                  coreCount: 8,
                  dpr: 2,
                  memoryGb: 8,
                  narrowViewport: false,
              }
            : autoQualityDeviceClass === 'constrained'
              ? {
                    coarsePointer: false,
                    coreCount: 4,
                    dpr: 2,
                    memoryGb: 4,
                    narrowViewport: false,
                }
              : null;
    const persistentOwners = Object.fromEntries(
        [
            'fauna:birds',
            'fauna:cats',
            'fauna:dogs',
            'plant-sway',
            'rain-particles',
            'weather-animation',
        ].map((owner) => [
            owner,
            {
                coverageRatio: 0.95,
                endpointObserved: true,
                expectedFramesPerSecond: 30,
                framesPerSecond: [30],
                matchingObservationCount: 97,
                matchingRafObservationCount: 95,
                maximumLeaseCount: owner === 'plant-sway' ? 2 : 1,
                observedFrameCount: 95,
                observedObservationCount: 97,
                startObserved: true,
            },
        ]),
    );

    return {
        apiErrors: [],
        consoleMessages: [],
        pageErrors: [],
        requested: {
            autoQualityDeviceClass,
            autoQualityMetrics,
            controls: '1',
            debugHud: '0',
            details: '1',
            dpr: 2,
            expectedAutoQualityMetrics: autoQualityMetrics,
            expectedDprCap: dprCap,
            expectedGroundDecorationDensity: groundDecorationDensity,
            expectedQualityTier: tier,
            expectedShadowMapSize: shadowMapSize,
            expectedShadows: shadowsEnabled,
            fixedTimeSeconds: null,
            gardenProfile: 'high-target',
            hud: '0',
            mode: 'rain',
            motion: 'runtime-owner-bounded-zoom-rotate',
            motionWarmupMs: 900,
            outline: '1',
            quality,
            runtimeOwnersProfile: true,
            staticSceneCache: 'legacy',
            viewport: { height: 720, width: 1_280 },
        },
        runtime: {
            dprCap,
            groundDecorationDensity,
            qualityTier: tier,
            shadowMapSize,
            shadowsEnabled,
            staticOpaqueSceneCacheEnabled: false,
        },
        sample: {
            drawCalls: 1_000,
            elapsedMs: 5_000,
            gameCameraMotionObserved: true,
            gameCameraSnapshotAtEnd: {
                position: [-10, 10, -10],
                target: [0, 0, 0],
                version: 6,
                zoom: 100,
            },
            gameCameraSnapshotAtStart: {
                position: [-10, 10, -10],
                target: [0, 0, 0],
                version: 1,
                zoom: 100,
            },
            gameCameraSnapshotVersionDelta: 5,
            motionWarmupCameraSnapshotAtEnd: {
                position: [-10, 10, -10],
                target: [0, 0, 0],
                version: 5,
                zoom: 100,
            },
            motionWarmupCameraSnapshotAtStart: {
                position: [-10, 10, -10],
                target: [0, 0, 0],
                version: 1,
                zoom: 100,
            },
            motionWarmupCameraSnapshotVersionDelta: 4,
            renderedFrames: 180,
            runtimeFrameLoopCounterDeltas: {
                hiddenDeferredCoalescedRenderRequestCount: 0,
                hiddenCoalescedRenderRequestCount: 0,
                ownedInvalidationCount: 150,
                r3fFrameCallbackCount: 180,
            },
            runtimeOwnerLeaseEvidence: {
                deliveryByTargetFramesPerSecond: {
                    30: {
                        actualRenderedFrames: 120,
                        deliveryRatio: 1,
                        durationMs: 4_000,
                        expectedFrameBudget: 120,
                        framesPerSecond: 30,
                    },
                    60: {
                        actualRenderedFrames: 60,
                        deliveryRatio: 1,
                        durationMs: 1_000,
                        expectedFrameBudget: 60,
                        framesPerSecond: 60,
                    },
                },
                endpointObserved: true,
                frameCount: 100,
                observationCount: 102,
                owners: {
                    'camera-interaction': {
                        coverageRatio: 0.05,
                        endpointObserved: false,
                        expectedFramesPerSecond: 60,
                        framesPerSecond: [60],
                        matchingObservationCount: 5,
                        matchingRafObservationCount: 5,
                        maximumLeaseCount: 1,
                        observedFrameCount: 5,
                        observedObservationCount: 5,
                        startObserved: false,
                    },
                    ...persistentOwners,
                },
                rafObservationCount: 100,
                sceneTimeDeltaSeconds: 5,
                startObserved: true,
                targetFramesPerSecondMax: 60,
                targetFramesPerSecondMin: 30,
            },
            submittedTriangles: 10_000,
        },
        screenshotWitness: {
            entropy: 1,
            height: 1_440,
            maximumChannelStandardDeviation: 10,
            opaque: true,
            sampledLumaRange: 40,
            sampledUniqueColorCount: 32,
            width: 2_560,
        },
    };
}

function runtimeOwnersAcceptanceCheck(input, name) {
    return evaluateRuntimeOwnersAcceptance(input).checks.find(
        (check) => check.name === name,
    );
}

test('runtime-owner acceptance proves exact camera, weather, plant, and fauna cadence across tiers', () => {
    const profiles = [
        {
            dprCap: 1,
            groundDecorationDensity: 0,
            quality: 'low',
            shadowMapSize: 0,
            shadowsEnabled: false,
            tier: 'low',
        },
        {
            dprCap: 1.5,
            groundDecorationDensity: 0.5,
            quality: 'medium',
            shadowMapSize: 2_048,
            tier: 'medium',
        },
        {},
        {
            autoQualityDeviceClass: 'standard',
            dprCap: 1.5,
            groundDecorationDensity: 0.5,
            quality: 'auto',
            shadowMapSize: 2_048,
            tier: 'medium',
        },
        {
            autoQualityDeviceClass: 'constrained',
            dprCap: 1,
            groundDecorationDensity: 0.25,
            quality: 'auto',
            shadowMapSize: 1_024,
            tier: 'auto-constrained',
        },
    ];

    for (const profile of profiles) {
        const input = createPassingRuntimeOwnersAcceptanceInput(profile);
        const result = evaluateRuntimeOwnersAcceptance(input);
        assert.equal(
            result.pass,
            true,
            result.checks
                .filter((check) => !check.pass)
                .map((check) => check.name)
                .join(', '),
        );
        assert.equal(evaluateHighTargetAcceptance(input).pass, true);
    }
});

test('runtime-owner acceptance gates delivered 30 and 60 FPS cadence', () => {
    const setDeliveredFrames = (input, rate, actualRenderedFrames) => {
        const delivery =
            input.sample.runtimeOwnerLeaseEvidence
                .deliveryByTargetFramesPerSecond[rate];
        delivery.actualRenderedFrames = actualRenderedFrames;
        delivery.deliveryRatio =
            actualRenderedFrames / delivery.expectedFrameBudget;
        const attributedRenderedFrames = Object.values(
            input.sample.runtimeOwnerLeaseEvidence
                .deliveryByTargetFramesPerSecond,
        ).reduce(
            (total, candidate) => total + candidate.actualRenderedFrames,
            0,
        );
        input.sample.renderedFrames = attributedRenderedFrames;
        input.sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount =
            attributedRenderedFrames;
    };
    const passing = createPassingRuntimeOwnersAcceptanceInput();
    assert.equal(evaluateRuntimeOwnersAcceptance(passing).pass, true);

    const underdelivered = structuredClone(passing);
    setDeliveredFrames(underdelivered, 30, 100);
    assert.equal(
        runtimeOwnersAcceptanceCheck(
            underdelivered,
            'runtimeOwners30FpsDeliveryRatioMinimum',
        ).pass,
        false,
    );

    const overdelivered = structuredClone(passing);
    setDeliveredFrames(overdelivered, 60, 70);
    assert.equal(
        runtimeOwnersAcceptanceCheck(
            overdelivered,
            'runtimeOwners60FpsDeliveryRatioMaximum',
        ).pass,
        false,
    );

    const missingSixtyFpsExposure = structuredClone(passing);
    Object.assign(
        missingSixtyFpsExposure.sample.runtimeOwnerLeaseEvidence
            .deliveryByTargetFramesPerSecond[60],
        {
            actualRenderedFrames: 0,
            deliveryRatio: null,
            durationMs: 0,
            expectedFrameBudget: 0,
        },
    );
    missingSixtyFpsExposure.sample.renderedFrames = 120;
    missingSixtyFpsExposure.sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount = 120;
    assert.equal(
        runtimeOwnersAcceptanceCheck(
            missingSixtyFpsExposure,
            'runtimeOwners60FpsDeliveryDurationMs',
        ).pass,
        false,
    );

    for (const [sceneTimeDeltaSeconds, checkName] of [
        [4.7, 'runtimeOwnersSceneTimeDeltaSecondsMinimum'],
        [5.3, 'runtimeOwnersSceneTimeDeltaSecondsMaximum'],
    ]) {
        const sceneTimeDrift = structuredClone(passing);
        sceneTimeDrift.sample.runtimeOwnerLeaseEvidence.sceneTimeDeltaSeconds =
            sceneTimeDeltaSeconds;
        assert.equal(
            runtimeOwnersAcceptanceCheck(sceneTimeDrift, checkName).pass,
            false,
        );
    }

    const r3fMismatch = structuredClone(passing);
    r3fMismatch.sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount += 1;
    assert.equal(
        runtimeOwnersAcceptanceCheck(
            r3fMismatch,
            'runtimeOwnersRenderedFramesMatchR3fFrameCallbackDelta',
        ).pass,
        false,
    );

    const attributionMismatch = structuredClone(passing);
    attributionMismatch.sample.runtimeOwnerLeaseEvidence.deliveryByTargetFramesPerSecond[60].actualRenderedFrames += 1;
    attributionMismatch.sample.runtimeOwnerLeaseEvidence.deliveryByTargetFramesPerSecond[60].deliveryRatio =
        61 / 60;
    assert.equal(
        runtimeOwnersAcceptanceCheck(
            attributionMismatch,
            'runtimeOwnersAttributedRenderedFramesMatchRenderedFrames',
        ).pass,
        false,
    );
});

test('runtime-owner acceptance rejects missing, intermittent, or wrong-rate owner evidence', () => {
    const input = createPassingRuntimeOwnersAcceptanceInput();
    const owners = Object.keys(input.sample.runtimeOwnerLeaseEvidence.owners);
    const ownerLabel = (owner) =>
        owner
            .split(/[:-]/u)
            .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
            .join('');

    for (const owner of owners) {
        const missing = structuredClone(input);
        delete missing.sample.runtimeOwnerLeaseEvidence.owners[owner];
        assert.equal(
            runtimeOwnersAcceptanceCheck(missing, 'runtimeOwnersOwnerSet').pass,
            false,
            `missing:${owner}`,
        );

        const wrongExpectedRate = structuredClone(input);
        wrongExpectedRate.sample.runtimeOwnerLeaseEvidence.owners[
            owner
        ].expectedFramesPerSecond = 29;
        const prefix =
            owner === 'camera-interaction'
                ? 'runtimeOwnersCamera'
                : `runtimeOwners${ownerLabel(owner)}`;
        assert.equal(
            runtimeOwnersAcceptanceCheck(
                wrongExpectedRate,
                `${prefix}ExpectedFramesPerSecond`,
            ).pass,
            false,
            `expected-rate:${owner}`,
        );

        const wrongObservedRate = structuredClone(input);
        wrongObservedRate.sample.runtimeOwnerLeaseEvidence.owners[
            owner
        ].framesPerSecond = [29];
        assert.equal(
            runtimeOwnersAcceptanceCheck(
                wrongObservedRate,
                `${prefix}FramesPerSecond`,
            ).pass,
            false,
            `observed-rate:${owner}`,
        );
    }

    for (const owner of owners.filter(
        (owner) => owner !== 'camera-interaction',
    )) {
        const prefix = `runtimeOwners${ownerLabel(owner)}`;
        for (const [field, value, suffix] of [
            ['coverageRatio', 0.8999, 'CoverageRatio'],
            ['maximumLeaseCount', 0, 'MaximumLeaseCount'],
            ['startObserved', false, 'StartObserved'],
            ['endpointObserved', false, 'EndpointObserved'],
        ]) {
            const mutation = structuredClone(input);
            mutation.sample.runtimeOwnerLeaseEvidence.owners[owner][field] =
                value;
            assert.equal(
                runtimeOwnersAcceptanceCheck(mutation, `${prefix}${suffix}`)
                    .pass,
                false,
                `${owner}:${field}`,
            );
        }
    }

    for (const [field, value, check] of [
        [
            'matchingRafObservationCount',
            1,
            'runtimeOwnersCameraMatchingFrameCount',
        ],
        ['observedFrameCount', 1, 'runtimeOwnersCameraObservedFrameCount'],
        ['maximumLeaseCount', 0, 'runtimeOwnersCameraMaximumLeaseCount'],
    ]) {
        const mutation = structuredClone(input);
        mutation.sample.runtimeOwnerLeaseEvidence.owners['camera-interaction'][
            field
        ] = value;
        assert.equal(runtimeOwnersAcceptanceCheck(mutation, check).pass, false);
    }
});

test('runtime-owner acceptance fails closed on sample, target, visual, and error witnesses', () => {
    const input = createPassingRuntimeOwnersAcceptanceInput();
    const mutations = [
        [
            'sample.runtimeOwnerLeaseEvidence.startObserved',
            false,
            'runtimeOwnersStartObserved',
        ],
        [
            'sample.runtimeOwnerLeaseEvidence.endpointObserved',
            false,
            'runtimeOwnersEndpointObserved',
        ],
        [
            'sample.runtimeOwnerLeaseEvidence.frameCount',
            1,
            'runtimeOwnersFrameCount',
        ],
        [
            'sample.runtimeOwnerLeaseEvidence.rafObservationCount',
            1,
            'runtimeOwnersRafObservationCount',
        ],
        [
            'sample.runtimeOwnerLeaseEvidence.targetFramesPerSecondMin',
            29,
            'runtimeOwnersTargetFramesPerSecondMin',
        ],
        [
            'sample.runtimeOwnerLeaseEvidence.targetFramesPerSecondMax',
            59,
            'runtimeOwnersTargetFramesPerSecondMax',
        ],
        [
            'sample.runtimeFrameLoopCounterDeltas.ownedInvalidationCount',
            0,
            'runtimeOwnersOwnedInvalidationDelta',
        ],
        [
            'sample.runtimeFrameLoopCounterDeltas.r3fFrameCallbackCount',
            0,
            'runtimeOwnersR3fFrameCallbackDelta',
        ],
        [
            'sample.runtimeFrameLoopCounterDeltas.hiddenDeferredCoalescedRenderRequestCount',
            1,
            'runtimeOwnersHiddenDeferredCoalescedRenderRequestCountDelta',
        ],
        [
            'sample.runtimeFrameLoopCounterDeltas.hiddenCoalescedRenderRequestCount',
            1,
            'runtimeOwnersHiddenCoalescedRenderRequestCountDelta',
        ],
        ['sample.renderedFrames', 0, 'runtimeOwnersRenderedFrames'],
        ['sample.drawCalls', 0, 'runtimeOwnersDrawCalls'],
        ['sample.submittedTriangles', 0, 'runtimeOwnersSubmittedTriangles'],
        [
            'sample.gameCameraMotionObserved',
            false,
            'runtimeOwnersCameraMotionObserved',
        ],
        [
            'sample.gameCameraSnapshotVersionDelta',
            0,
            'runtimeOwnersCameraSnapshotVersionDelta',
        ],
        [
            'sample.motionWarmupCameraSnapshotVersionDelta',
            0,
            'runtimeOwnersMotionWarmupCameraVersionDelta',
        ],
        [
            'sample.motionWarmupCameraSnapshotAtEnd.target.0',
            0.02,
            'runtimeOwnersMotionWarmupCameraEndpointMaximumDelta',
        ],
        [
            'sample.gameCameraSnapshotAtEnd.target.0',
            1,
            'runtimeOwnersCameraEndpointMaximumDelta',
        ],
        ['screenshotWitness.entropy', 0, 'runtimeOwnersScreenshotWitnessValid'],
    ];

    for (const [path, value, check] of mutations) {
        const mutation = structuredClone(input);
        const segments = path.split('.');
        let target = mutation;
        while (segments.length > 1) {
            target = target[segments.shift()];
        }
        target[segments[0]] = value;
        assert.equal(
            runtimeOwnersAcceptanceCheck(mutation, check).pass,
            false,
            path,
        );
        assert.equal(evaluateRuntimeOwnersAcceptance(mutation).pass, false);
    }

    for (const [field, error, check] of [
        ['apiErrors', { status: 500 }, 'runtimeOwnersApiErrors'],
        [
            'consoleMessages',
            { text: 'runtime failure', type: 'error', url: 'http://profile' },
            'runtimeOwnersConsoleErrors',
        ],
        ['pageErrors', 'runtime failure', 'runtimeOwnersPageErrors'],
    ]) {
        const mutation = structuredClone(input);
        mutation[field].push(error);
        assert.equal(
            runtimeOwnersAcceptanceCheck(mutation, check).pass,
            false,
            field,
        );
    }
});

test('runtime-owner acceptance rejects position, target, and zoom endpoint drift', () => {
    const input = createPassingRuntimeOwnersAcceptanceInput();

    for (const [label, mutateEndpoint] of [
        [
            'position',
            (snapshot) => {
                snapshot.position[0] += 0.02;
            },
        ],
        [
            'target',
            (snapshot) => {
                snapshot.target[0] += 0.02;
            },
        ],
        [
            'zoom',
            (snapshot) => {
                snapshot.zoom += 0.02;
            },
        ],
    ]) {
        const cameraDrift = structuredClone(input);
        mutateEndpoint(cameraDrift.sample.gameCameraSnapshotAtEnd);
        const cameraDriftAcceptance =
            evaluateRuntimeOwnersAcceptance(cameraDrift);
        assert.equal(cameraDriftAcceptance.pass, false, label);
        assert.equal(
            cameraDriftAcceptance.checks.find(
                (check) =>
                    check.name === 'runtimeOwnersCameraEndpointMaximumDelta',
            )?.pass,
            false,
            label,
        );
    }
});

test('candidate runtime-owner repeats stay outside canonical High and cross-tier medians', () => {
    const runs = [1, 2, 3].map((profileRun) => ({
        acceptance: { pass: true },
        baseName: 'game-runtime-owners-low-desktop',
        budget: { pass: true },
        name: `game-runtime-owners-low-desktop-run-${profileRun}`,
        performanceBudget: { pass: true },
        profileRun,
        requested: {
            gardenProfile: 'high-target',
            runtimeOwnersProfile: true,
        },
        sample: {},
    }));

    const highTargetMedians = buildHighTargetMedians(runs);
    assert.deepEqual(highTargetMedians, {});
    assert.deepEqual(buildCrossTierMedians(highTargetMedians), {});
    assert.deepEqual(buildProfileSummary(runs, highTargetMedians), {
        failedScenarioNames: [],
        failedScenarios: 0,
        failedRuns: 0,
        passedRuns: 3,
        passedScenarios: 1,
        totalRuns: 3,
        totalScenarios: 1,
    });
});

test('runtime-owner markdown reports cadence, owned work, and screenshot evidence', () => {
    const input = createPassingRuntimeOwnersAcceptanceInput();
    const scenario = {
        acceptance: { pass: true },
        baseName: 'game-runtime-owners-high-desktop',
        budget: { checks: [], pass: true },
        consoleMessages: [],
        environment: null,
        name: 'game-runtime-owners-high-desktop-run-1',
        pageErrors: [],
        profileRun: 1,
        requested: input.requested,
        runtime: input.runtime,
        runtimeOwners: input.sample.runtimeOwnerLeaseEvidence,
        sample: {
            ...input.sample,
            canvas: null,
            drawCallsPerFrame: 1,
            drawCallsPerRenderedFrame: 1,
            fps: 60,
            jsHeapMb: 1,
            longTaskCount: 0,
            maxFrameMs: 17,
            p95FrameMs: 17,
            rainUnmountMs: null,
            renderedFps: 30,
            trianglesPerFrame: 1,
            trianglesPerRenderedFrame: 1,
        },
        screenshotPath: '/tmp/runtime-owner.png',
        screenshotWitness: input.screenshotWitness,
    };
    const markdown = buildMarkdown({
        baseUrl: 'http://profile.local',
        generatedAt: '2026-09-01T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'runtime-owners',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [scenario],
        schemaVersion: 5,
        sourceCommit: 'test-sha',
        summary: { failedScenarios: 0 },
    });

    assert.match(markdown, /## Cross-tier runtime-owner cadence witness/);
    assert.match(markdown, /30 \/ 60/);
    assert.match(markdown, /\| 5 s \| 30: 4000 ms; 120/);
    assert.match(
        markdown,
        /30: 4000 ms; 120 \/ 120 \(1\) \/ 60: 1000 ms; 60 \/ 60 \(1\)/,
    );
    assert.match(markdown, /60 FPS across 5 frames/);
    assert.match(markdown, /weather-animation 30 FPS @ 95%/);
    assert.match(markdown, /900 ms \/ Δv4 \/ drift 0/);
    assert.match(markdown, /Δv5 \/ drift 0/);
    assert.match(markdown, /150 \/ 180 \/ 180/);
    assert.match(markdown, /\| yes \| pass \|/);
});

test('lifecycle summary groups three fresh-context repeats as one scenario outside High medians', () => {
    const runs = [1, 2, 3].map((profileRun) => ({
        acceptance: { pass: true },
        baseName: 'game-high-target-runtime-lifecycle-desktop',
        budget: { pass: true },
        name: `game-high-target-runtime-lifecycle-desktop-run-${profileRun}`,
        lifecycle: {
            cold: {
                canvasAttachedMs: 100 + profileRun,
                canvasSizedMs: 120 + profileRun,
                domContentLoadedMs: 80 + profileRun,
                firstSubmittedFrameMs: 140 + profileRun,
                fixtureReadyMs: 160 + profileRun,
                interactionReadyMs: 180 + profileRun,
            },
            context: {
                restored: {
                    contextLost: false,
                    restoredEventCount: 1,
                    sameCanvas: true,
                    sameContext: true,
                },
            },
            hidden: {
                ownedSchedulingZeroObserved: true,
                residual: residualLifecycleFixture(profileRun),
                resumeTransition: lifecycleTransitionFixture(profileRun),
                resumeWindow: lifecycleTransitionFixture(profileRun),
                runtimeSchedulerZeroObserved: true,
                suspendTransition: lifecycleTransitionFixture(profileRun),
                zeroWorkObserved: true,
            },
            offscreen: {
                ownedSchedulingZeroObserved: true,
                residual: residualLifecycleFixture(profileRun),
                resumeTransition: lifecycleTransitionFixture(profileRun),
                resumeWindow: lifecycleTransitionFixture(profileRun),
                runtimeSchedulerZeroObserved: true,
                suspendTransition: lifecycleTransitionFixture(profileRun),
                zeroWorkObserved: true,
            },
        },
        profileRun,
        requested: {
            gardenProfile: 'high-target',
            lifecycleProfile: true,
        },
    }));
    const summary = buildLifecycleSummary(runs);

    assert.equal(summary.baseScenarioCount, 1);
    assert.equal(summary.runCount, 3);
    assert.equal(summary.passedRunCount, 3);
    assert.equal(summary.contextPersistentRunCount, 3);
    assert.equal(summary.offscreen.ownedSchedulingZeroObservedRunCount, 3);
    assert.equal(summary.offscreen.runtimeSchedulerZeroObservedRunCount, 3);
    assert.equal(summary.offscreen.zeroWorkObservedRunCount, 3);
    assert.deepEqual(summary.offscreen.resumeTransition.renderedFrames, {
        max: 3,
        median: 2,
        min: 1,
    });
    assert.deepEqual(summary.hidden.resumeWindow.sceneTimeDeltaSeconds, {
        max: 3,
        median: 2,
        min: 1,
    });
    const legacyCompatibleRuns = structuredClone(runs);
    for (const run of legacyCompatibleRuns) {
        delete run.lifecycle.hidden.ownedSchedulingZeroObserved;
        delete run.lifecycle.offscreen.ownedSchedulingZeroObserved;
    }
    assert.equal(
        buildLifecycleSummary(legacyCompatibleRuns).offscreen
            .ownedSchedulingZeroObservedRunCount,
        3,
    );
    assert.deepEqual(buildHighTargetMedians(runs), {});
    assert.deepEqual(buildProfileSummary(runs, {}), {
        failedScenarioNames: [],
        failedScenarios: 0,
        failedRuns: 0,
        passedRuns: 3,
        passedScenarios: 1,
        totalRuns: 3,
        totalScenarios: 1,
    });
    const switchRuns = [1, 2, 3].map((profileRun) => ({
        baseName: 'game-garden-switch-high-fauna-single-context-desktop',
        budget: { pass: true },
        name: `game-garden-switch-high-fauna-single-context-desktop-run-${profileRun}`,
        requested: { gardenSwitchProfile: true },
    }));
    const faunaRuns = [1, 2, 3].map((profileRun) => ({
        baseName: 'game-fauna-heavy-day-interaction-desktop',
        budget: { pass: true },
        name: `game-fauna-heavy-day-interaction-desktop-run-${profileRun}`,
        requested: { faunaProfile: true, gardenProfile: 'fauna-heavy' },
    }));
    assert.deepEqual(
        buildProfileSummary([...faunaRuns, ...switchRuns, ...runs], {
            fauna: { pass: true },
        }),
        {
            failedScenarioNames: [],
            failedScenarios: 0,
            failedRuns: 0,
            passedRuns: 9,
            passedScenarios: 3,
            totalRuns: 9,
            totalScenarios: 3,
        },
    );
});

test('lifecycle markdown separates owned scheduling from full zero-work witnesses', () => {
    const lifecyclePhase = (zeroWorkObserved) => ({
        ownedSchedulingZeroObserved: true,
        residual: {
            cdp: { scriptDuration: 0.01 },
            sample: {
                drawCalls: zeroWorkObserved ? 0 : 1,
                renderedFrames: zeroWorkObserved ? 0 : 1,
                submittedTriangles: zeroWorkObserved ? 0 : 1,
            },
        },
        runtimeSchedulerZeroObserved: true,
        zeroWorkObserved,
    });
    const markdown = buildMarkdown({
        baseUrl: 'http://profile.local',
        generatedAt: '2026-08-30T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'runtime-lifecycle',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                baseName: 'game-high-target-runtime-lifecycle-desktop',
                budget: { checks: [], pass: true },
                consoleMessages: [],
                environment: null,
                lifecycle: {
                    active: { sample: { drawCalls: 10, renderedFrames: 2 } },
                    cold: {},
                    context: { restored: {} },
                    hidden: lifecyclePhase(false),
                    offscreen: lifecyclePhase(true),
                },
                name: 'game-high-target-runtime-lifecycle-desktop-run-1',
                profileRun: 1,
                requested: {
                    controls: '0',
                    debugHud: '0',
                    details: '1',
                    gardenProfile: 'high-target',
                    hud: '0',
                    lifecycleProfile: true,
                    mode: 'details',
                    motion: 'none',
                },
                runtime: null,
                sample: {
                    canvas: null,
                    drawCallsPerFrame: 1,
                    drawCallsPerRenderedFrame: 5,
                    fps: 60,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    renderedFps: 2,
                    trianglesPerFrame: 1,
                    trianglesPerRenderedFrame: 5,
                },
                pageErrors: [],
                screenshotPath: null,
            },
        ],
        schemaVersion: 5,
        sourceCommit: 'test-sha',
        summary: { failedScenarios: 0 },
    });

    assert.match(
        markdown,
        /Owned-scheduling zero witnesses — offscreen 1\/1, synthetic hidden 1\/1\./,
    );
    assert.match(
        markdown,
        /Full render\/runtime zero-work witnesses — offscreen 1\/1, synthetic hidden 0\/1\./,
    );
    assert.match(markdown, /owned scheduling zero\/full zero/);
    assert.match(markdown, /0\/0\/0\/0\.01 s; yes\/yes/);
    assert.match(markdown, /1\/1\/1\/0\.01 s; yes\/no/);
    assert.match(markdown, /Canonical compatibility runs \(1\)/);
    assert.doesNotMatch(markdown, /Candidate-only live runs/);
});

test('live lifecycle markdown exposes suspension, resume transition, and steady cadence evidence', () => {
    const input = createPassingLifecycleLiveAcceptanceInput();
    const markdown = buildMarkdown({
        baseUrl: 'http://profile.local',
        generatedAt: '2026-09-01T00:00:00.000Z',
        highTargetMedians: {},
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'runtime-lifecycle-live',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                baseName: 'game-high-target-runtime-lifecycle-live-desktop',
                budget: { checks: [], pass: true },
                consoleMessages: [],
                environment: null,
                lifecycle: input,
                name: 'game-high-target-runtime-lifecycle-live-desktop-run-1',
                pageErrors: [],
                profileRun: 1,
                requested: input.requested,
                runtime: null,
                sample: {
                    canvas: null,
                    drawCallsPerFrame: 1,
                    drawCallsPerRenderedFrame: 5,
                    fps: 60,
                    longTaskCount: 0,
                    maxFrameMs: 20,
                    p95FrameMs: 16,
                    rainUnmountMs: null,
                    renderedFps: 30,
                    trianglesPerFrame: 1,
                    trianglesPerRenderedFrame: 5,
                },
                screenshotPath: null,
            },
        ],
        schemaVersion: 5,
        sourceCommit: 'test-sha',
        summary: { failedScenarios: 0 },
    });

    assert.match(markdown, /measure from before each visibility mutation/);
    assert.match(markdown, /action-plus-R3F drain by observed browser frames/);
    assert.match(markdown, /Candidate-live visibility transition evidence/);
    assert.match(
        markdown,
        /offscreen \| 250 ms; 0\/0\/0; 1\/1\/1; 0 s; yes \| 0\/0\/0 s; yes/,
    );
    assert.match(
        markdown,
        /hidden \| 250 ms; 1\/1\/1; 1\/1\/1; 0\.03 s; yes \| 0\/0\/0 s; yes/,
    );
    assert.match(markdown, /900 ms; 33\/33\/27\/6; 0\.9 s; 0/);
    assert.match(markdown, /2000 ms; 60\/60\/60; 2 s; 0\/0/);
});

function residualLifecycleFixture(value) {
    return {
        cdp: { scriptDuration: value },
        sample: {
            drawCalls: value,
            renderedFrames: value,
            submittedTriangles: value,
        },
    };
}

function lifecycleTransitionFixture(value) {
    return {
        counterDeltas: {
            ownedInvalidationCount: value,
            r3fFrameCallbackCount: value,
        },
        r3fOwnedInvalidationSurplus: 0,
        sample: {
            elapsedMs: value * 100,
            renderedFrames: value,
        },
        sceneTimeDeltaSeconds: value,
    };
}

test('local profiler console filtering only ignores the known missing analytics asset', () => {
    const knownLocalAnalyticsError = {
        type: 'error',
        text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
        url: 'http://127.0.0.1:3101/_vercel/insights/script.js',
    };

    assert.equal(
        isIgnoredLocalProfilerConsoleError(knownLocalAnalyticsError),
        true,
    );
    for (const message of [
        { ...knownLocalAnalyticsError, text: 'application crashed' },
        {
            ...knownLocalAnalyticsError,
            url: 'http://localhost:3101/_vercel/speed-insights/script.js',
        },
        {
            ...knownLocalAnalyticsError,
            url: 'https://garden.example.com/_vercel/insights/script.js',
        },
    ]) {
        assert.equal(isIgnoredLocalProfilerConsoleError(message), false);
    }
});

test('building profile signed-out filtering is local, status-bound, and path-exact', () => {
    const expectedError = {
        status: 401,
        url: 'http://localhost:3101/api/gredice/api/gardens/99999/operations?cursor=0',
    };
    assert.equal(isExpectedGardenBuildingProfileApiError(expectedError), true);
    assert.equal(
        isExpectedGardenBuildingProfileApiError({
            ...expectedError,
            url: 'http://[::1]:3101/api/gredice/api/accounts/current',
        }),
        true,
    );

    for (const error of [
        { ...expectedError, status: 500 },
        {
            ...expectedError,
            url: 'http://localhost:3101/api/gredice/api/gardens/99998/operations',
        },
        {
            ...expectedError,
            url: 'https://garden.example.com/api/gredice/api/gardens/99999/operations',
        },
    ]) {
        assert.equal(isExpectedGardenBuildingProfileApiError(error), false);
    }

    const expectedConsoleError = {
        type: 'error',
        text: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
        url: expectedError.url,
    };
    assert.equal(
        isExpectedGardenBuildingProfileConsoleError(expectedConsoleError),
        true,
    );
    for (const message of [
        { ...expectedConsoleError, type: 'warning' },
        { ...expectedConsoleError, text: 'THREE.WebGLProgram: Shader Error' },
        {
            ...expectedConsoleError,
            url: 'https://garden.example.com/api/gredice/api/gardens/99999/operations',
        },
    ]) {
        assert.equal(
            isExpectedGardenBuildingProfileConsoleError(message),
            false,
        );
    }
});

test('operation-visual High acceptance gates batching, uploads, mulch, and highlight identity', () => {
    const input = {
        apiErrors: [],
        pageErrors: [],
        requested: {
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

test('foliage-budget High acceptance admits one normal-view detail bed', () => {
    const input = {
        apiErrors: [],
        pageErrors: [],
        requested: {
            foliageBudget: '1',
            gardenProfile: 'high-target',
            mode: 'details',
            motion: 'foliage-detail-zoom',
            quality: 'high',
        },
        runtime: {
            actorGroundingShadowBatchCount: 1,
            actorGroundingShadowCount: 5,
            actorGroundingShadowDroppedCount: 0,
            actorGroundingShadowPrimaryCasterCount: 0,
            actorGroundingShadowVisibleCount: 5,
            animatedCasterShadowRefreshCount: 0,
            generatedPlantClusterInstanceCount: 358,
            generatedPlantClusterPrimitiveTriangleCount: 2_740,
            generatedPlantDetailedInstanceCount: 179,
            generatedPlantDetailAdmittedBedCount: 1,
            generatedPlantDetailAdmittedInstanceCount: 179,
            generatedPlantDetailBudgetInstanceCount: 179,
            generatedPlantDetailDemotedBedCount: 2,
            generatedPlantDetailOverflowInstanceCount: 0,
            generatedPlantDetailRequestedBedCount: 3,
            generatedPlantDetailRequestedInstanceCount: 537,
            generatedPlantDetailTransitionCount: 0,
            generatedPlantDetailUsedBudgetInstanceCount: 179,
            generatedPlantExpectedInstanceCount: 537,
            generatedPlantFarFieldCount: 9,
            generatedPlantFarInstanceCount: 81,
            generatedPlantFieldCount: 54,
            generatedPlantInstanceCount: 537,
            generatedPlantMidFieldCount: 27,
            generatedPlantMidInstanceCount: 277,
            generatedPlantNearFieldCount: 18,
            generatedPlantNearInstanceCount: 179,
            generatedPlantPendingDetailInstanceCount: 0,
            generatedPlantRenderBatchCount: 6,
            generatedPlantVisibleFieldCount: 54,
            generatedPlantVisibleInstanceCount: 537,
            groundDecorationCount: 596,
            groundDecorationDensity: 1,
            groundDecorationVisibleCount: 571,
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
            renderedFps: 12,
            renderedFrames: 60,
            reportedDpr: 2,
            submittedTriangles: 1_000_000,
        },
    };

    assert.equal(evaluateHighTargetAcceptance(input).pass, true);
    const missingDetail = evaluateHighTargetAcceptance({
        ...input,
        runtime: {
            ...input.runtime,
            generatedPlantDetailedInstanceCount: 0,
        },
    });
    assert.equal(missingDetail.pass, false);
    assert.equal(
        missingDetail.checks.find(
            (check) =>
                check.name === 'highTargetFoliageDetailedRenderInstances',
        )?.pass,
        false,
    );

    const expensiveClusters = evaluateHighTargetAcceptance({
        ...input,
        runtime: {
            ...input.runtime,
            generatedPlantClusterPrimitiveTriangleCount: 10_000,
        },
    });
    assert.equal(expensiveClusters.pass, false);
    assert.equal(
        expensiveClusters.checks.find(
            (check) =>
                check.name === 'highTargetFoliageClusterPrimitiveTriangles',
        )?.pass,
        false,
    );
});

test('weather-surface High acceptance proves integrated work without hiding fallbacks', () => {
    const input = ({ mode, weatherSurface }) => {
        const integrated = weatherSurface === 'integrated';
        const rain = mode === 'rain';
        return {
            apiErrors: [],
            pageErrors: [],
            requested: {
                gardenProfile: 'high-target',
                mode,
                motion: 'none',
                quality: 'high',
                weatherSurface,
            },
            runtime: {
                actorGroundingShadowBatchCount: 1,
                actorGroundingShadowCount: 4,
                actorGroundingShadowDroppedCount: 0,
                actorGroundingShadowPrimaryCasterCount: 0,
                actorGroundingShadowVisibleCount: 4,
                animatedCasterShadowRefreshCount: 0,
                generatedPlantExpectedInstanceCount: 537,
                generatedPlantFieldCount: 54,
                generatedPlantInstanceCount: 537,
                generatedPlantVisibleFieldCount: 54,
                generatedPlantVisibleInstanceCount: 537,
                groundDecorationCount: rain ? 596 : 0,
                groundDecorationDensity: 1,
                groundDecorationVisibleCount: rain ? 571 : null,
                qualityTier: 'high',
                rainParticleCount: rain ? 2_000 : 0,
                rendererShaders: rain
                    ? integrated
                        ? 38
                        : 39
                    : integrated
                      ? 42
                      : 43,
                shadowMapSize: 4_096,
                shadowsEnabled: true,
                snowParticleCapacity: rain ? 0 : 5_000,
                snowParticleCount: rain ? 0 : 3_500,
                weatherSurfaceAvoidedOverlaySubmissionCount: integrated
                    ? rain
                        ? 16
                        : 8
                    : 0,
                weatherSurfaceAvoidedOverlayTriangleCount: integrated
                    ? rain
                        ? 2_556
                        : 11_880
                    : 0,
                weatherSurfaceFallbackOverlaySubmissionCount: integrated
                    ? rain
                        ? 29
                        : 48
                    : rain
                      ? 45
                      : 56,
                weatherSurfaceFallbackOverlayTriangleCount: integrated
                    ? rain
                        ? 13_562
                        : 72_608
                    : rain
                      ? 16_118
                      : 84_488,
                weatherSurfaceIntegratedInstanceCount: integrated
                    ? rain
                        ? 213
                        : 270
                    : 0,
                weatherSurfaceIntegratedMaterialCount: integrated
                    ? rain
                        ? 2
                        : 1
                    : 0,
                weatherSurfaceMode: weatherSurface,
                weatherSurfacePluginVariantCount: integrated ? 1 : 0,
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
    };

    for (const mode of ['rain', 'snow']) {
        assert.equal(
            evaluateHighTargetAcceptance(
                input({ mode, weatherSurface: 'legacy' }),
            ).pass,
            true,
        );
        assert.equal(
            evaluateHighTargetAcceptance(
                input({ mode, weatherSurface: 'integrated' }),
            ).pass,
            true,
        );
    }

    const snowIntegrated = input({
        mode: 'snow',
        weatherSurface: 'integrated',
    });
    for (const [field, value, checkName] of [
        [
            'weatherSurfaceIntegratedInstanceCount',
            213,
            'highTargetWeatherSurfaceIntegratedInstances',
        ],
        [
            'weatherSurfaceIntegratedMaterialCount',
            2,
            'highTargetWeatherSurfaceIntegratedMaterials',
        ],
        [
            'weatherSurfaceAvoidedOverlaySubmissionCount',
            16,
            'highTargetWeatherSurfaceAvoidedOverlaySubmissions',
        ],
        [
            'weatherSurfaceAvoidedOverlayTriangleCount',
            9_372,
            'highTargetWeatherSurfaceAvoidedOverlayTriangles',
        ],
        [
            'weatherSurfaceFallbackOverlaySubmissionCount',
            56,
            'highTargetWeatherSurfaceFallbackOverlaySubmissions',
        ],
        [
            'weatherSurfaceFallbackOverlayTriangleCount',
            74_500,
            'highTargetWeatherSurfaceFallbackOverlayTriangles',
        ],
    ]) {
        const result = evaluateHighTargetAcceptance({
            ...snowIntegrated,
            runtime: {
                ...snowIntegrated.runtime,
                [field]: value,
            },
        });
        assert.equal(
            result.checks.find((check) => check.name === checkName)?.pass,
            false,
            `${checkName} should keep steady snow separate from the threshold transition fixture`,
        );
    }

    const rainIntegrated = input({
        mode: 'rain',
        weatherSurface: 'integrated',
    });
    for (const [field, value, checkName] of [
        [
            'weatherSurfaceIntegratedInstanceCount',
            212,
            'highTargetWeatherSurfaceIntegratedInstances',
        ],
        [
            'weatherSurfaceIntegratedMaterialCount',
            0,
            'highTargetWeatherSurfaceIntegratedMaterials',
        ],
        [
            'weatherSurfacePluginVariantCount',
            2,
            'highTargetWeatherSurfacePluginVariants',
        ],
        [
            'weatherSurfaceAvoidedOverlaySubmissionCount',
            15,
            'highTargetWeatherSurfaceAvoidedOverlaySubmissions',
        ],
        [
            'weatherSurfaceAvoidedOverlayTriangleCount',
            2_555,
            'highTargetWeatherSurfaceAvoidedOverlayTriangles',
        ],
        [
            'weatherSurfaceFallbackOverlaySubmissionCount',
            28,
            'highTargetWeatherSurfaceFallbackOverlaySubmissions',
        ],
        [
            'weatherSurfaceFallbackOverlayTriangleCount',
            13_561,
            'highTargetWeatherSurfaceFallbackOverlayTriangles',
        ],
        ['rendererShaders', 0, 'highTargetWeatherSurfaceRendererPrograms'],
    ]) {
        const result = evaluateHighTargetAcceptance({
            ...rainIntegrated,
            runtime: {
                ...rainIntegrated.runtime,
                [field]: value,
            },
        });
        assert.equal(
            result.checks.find((check) => check.name === checkName)?.pass,
            false,
            `${checkName} should reject ${field}=${value}`,
        );
    }

    assert.equal(
        evaluateHighTargetAcceptance({
            ...rainIntegrated,
            runtime: {
                ...rainIntegrated.runtime,
                rainParticleCount: 1_999,
            },
        }).pass,
        false,
    );

    const onsetIntegrated = {
        ...input({ mode: 'rain', weatherSurface: 'integrated' }),
        requested: {
            ...rainIntegrated.requested,
            mode: 'snow-onset',
        },
        runtime: {
            ...rainIntegrated.runtime,
            rainParticleCount: 0,
            snowParticleCount: 0,
            weatherSurfaceAvoidedOverlaySubmissionCount: 0,
            weatherSurfaceAvoidedOverlayTriangleCount: 0,
            weatherSurfaceFallbackOverlaySubmissionCount: 51,
            weatherSurfaceFallbackOverlayTriangleCount: 31_900,
            weatherSurfaceIntegratedInstanceCount: 0,
            weatherSurfaceIntegratedMaterialCount: 0,
            weatherSurfacePluginVariantCount: 0,
        },
    };
    assert.equal(evaluateHighTargetAcceptance(onsetIntegrated).pass, true);
    for (const [field, value, checkName] of [
        [
            'weatherSurfaceMode',
            'legacy',
            'highTargetWeatherSurfaceOnsetRuntimeMode',
        ],
        [
            'weatherSurfaceIntegratedInstanceCount',
            1,
            'highTargetWeatherSurfaceOnsetIntegratedInstances',
        ],
        [
            'weatherSurfaceIntegratedMaterialCount',
            1,
            'highTargetWeatherSurfaceOnsetIntegratedMaterials',
        ],
        [
            'weatherSurfacePluginVariantCount',
            1,
            'highTargetWeatherSurfaceOnsetPluginVariants',
        ],
        [
            'weatherSurfaceAvoidedOverlaySubmissionCount',
            1,
            'highTargetWeatherSurfaceOnsetAvoidedOverlaySubmissions',
        ],
        [
            'weatherSurfaceAvoidedOverlayTriangleCount',
            1,
            'highTargetWeatherSurfaceOnsetAvoidedOverlayTriangles',
        ],
        [
            'weatherSurfaceFallbackOverlaySubmissionCount',
            50,
            'highTargetWeatherSurfaceOnsetFallbackOverlaySubmissions',
        ],
        [
            'weatherSurfaceFallbackOverlayTriangleCount',
            31_899,
            'highTargetWeatherSurfaceOnsetFallbackOverlayTriangles',
        ],
        ['snowParticleCount', 1, 'highTargetWeatherSurfaceOnsetSnowParticles'],
    ]) {
        const result = evaluateHighTargetAcceptance({
            ...onsetIntegrated,
            runtime: {
                ...onsetIntegrated.runtime,
                [field]: value,
            },
        });
        assert.equal(
            result.checks.find((check) => check.name === checkName)?.pass,
            false,
            `${checkName} should reject ${field}=${value}`,
        );
    }

    const sparseSnapshot = {
        avoidedOverlaySubmissionCount: 0,
        avoidedOverlayTriangleCount: 0,
        fallbackOverlaySubmissionCount: 51,
        fallbackOverlayTriangleCount: 31_900,
        integratedInstanceCount: 0,
        integratedMaterialCount: 0,
        pluginVariantCount: 0,
        readyCount: 0,
        snowParticleCount: 0,
        trackedCount: 2,
        transitionCount: 0,
    };
    const integratedSnapshot = {
        avoidedOverlaySubmissionCount: 16,
        avoidedOverlayTriangleCount: 9_372,
        fallbackOverlaySubmissionCount: 56,
        fallbackOverlayTriangleCount: 74_500,
        integratedInstanceCount: 213,
        integratedMaterialCount: 2,
        pluginVariantCount: 1,
        readyCount: 2,
        snowParticleCount: 0,
        trackedCount: 2,
        transitionCount: 2,
    };
    const transitionRun = {
        ...onsetIntegrated,
        requested: {
            ...onsetIntegrated.requested,
            weatherSurfaceTransition: 'snow-integration-cycle',
        },
        runtime: {
            ...onsetIntegrated.runtime,
            weatherSurfaceSnowIntegrationReadyCount: 0,
            weatherSurfaceSnowIntegrationTrackedCount: 2,
            weatherSurfaceSnowIntegrationTransitionCount: 4,
        },
        sample: {
            ...onsetIntegrated.sample,
            weatherSurfaceTransitionProfile: {
                dwell: integratedSnapshot,
                enterDispatched: true,
                entered: integratedSnapshot,
                error: null,
                exitDispatched: true,
                exited: {
                    ...sparseSnapshot,
                    transitionCount: 4,
                },
                initial: sparseSnapshot,
                request: 'snow-integration-cycle',
            },
        },
    };
    assert.equal(evaluateHighTargetAcceptance(transitionRun).pass, true);

    const thrashedTransition = {
        ...transitionRun,
        sample: {
            ...transitionRun.sample,
            weatherSurfaceTransitionProfile: {
                ...transitionRun.sample.weatherSurfaceTransitionProfile,
                dwell: {
                    ...integratedSnapshot,
                    transitionCount: 4,
                },
            },
        },
    };
    const thrashedResult = evaluateHighTargetAcceptance(thrashedTransition);
    assert.equal(thrashedResult.pass, false);
    assert.equal(
        thrashedResult.checks.find(
            (check) =>
                check.name ===
                'highTargetWeatherSurfaceTransitionDwellNoThrash',
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
        hoverOutlineCompositePassCount: 7,
        hoverOutlineCropClippedCount: 0,
        hoverOutlineCropPixelCount: 100_000,
        hoverOutlineDrawingBufferPixelCount: 3_686_400,
        hoverOutlineFormat: 'r8',
        hoverOutlineHorizontalPassCount: 2,
        hoverOutlineKernelSampleCount: 23,
        hoverOutlineMaskPassCount: 2,
        hoverOutlineMaskCacheBypassCount: 0,
        hoverOutlineMaskCacheEligibleTargetCount: 2,
        hoverOutlineMaskCacheHitCount: 5,
        hoverOutlineMaskCacheMissCount: 2,
        hoverOutlineMaxKernelSampleCount: 51,
        hoverOutlinePipeline: 'cropped-bounded-separable-r8-content-cache',
        hoverOutlineProfileCommandAction: 'show',
        hoverOutlineProfileTargetBlockId: 'profile-raised-bed:2:0',
        hoverOutlineProfileTargetRaisedBedId: 2,
        hoverOutlineRenderTargetCount: 2,
        hoverOutlineRoiRatio: 0.04,
        hoverOutlineStyleGroupCount: 1,
        hoverOutlineThickness: 5,
    };
    const validOutlineSample = {
        hoverOutlineCompositePassCountDelta: 5,
        hoverOutlineHorizontalPassCountDelta: 0,
        hoverOutlineMaskCacheBypassCountDelta: 0,
        hoverOutlineMaskCacheHitCountDelta: 5,
        hoverOutlineMaskCacheMissCountDelta: 0,
        hoverOutlineMaskPassCountDelta: 0,
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
            ...validOutlineSample,
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

    for (const [field, invalidValue, checkName] of [
        [
            'hoverOutlineMaskCacheBypassCountDelta',
            1,
            'highTargetOutlineSampleWindowBypasses',
        ],
        [
            'hoverOutlineMaskCacheHitCountDelta',
            0,
            'highTargetOutlineSampleWindowHits',
        ],
        [
            'hoverOutlineMaskPassCountDelta',
            1,
            'highTargetOutlineSampleWindowMaskConservation',
        ],
        [
            'hoverOutlineHorizontalPassCountDelta',
            1,
            'highTargetOutlineSampleWindowHorizontalAlignment',
        ],
        [
            'hoverOutlineCompositePassCountDelta',
            4,
            'highTargetOutlineSampleWindowCompositeConservation',
        ],
    ]) {
        const result = evaluateHighTargetAcceptance(
            createInput({
                runtime: validOutlineRuntime,
                sample: {
                    [field]: invalidValue,
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

    const motionWithoutMeasuredMiss = evaluateHighTargetAcceptance(
        createInput({
            requested: { motion: 'pan-zoom-rotate' },
            runtime: validOutlineRuntime,
            sample: { outlineProfileTelemetryAvailable: true },
        }),
    );
    assert.equal(
        motionWithoutMeasuredMiss.checks.find(
            (check) => check.name === 'highTargetOutlineSampleWindowMisses',
        )?.pass,
        false,
    );

    const legacyOutlineRuntime = {
        ...validOutlineRuntime,
        hoverOutlineCompositePassCount: 2,
        hoverOutlinePipeline: 'cropped-bounded-separable-r8',
    };
    delete legacyOutlineRuntime.hoverOutlineMaskCacheBypassCount;
    delete legacyOutlineRuntime.hoverOutlineMaskCacheEligibleTargetCount;
    delete legacyOutlineRuntime.hoverOutlineMaskCacheHitCount;
    delete legacyOutlineRuntime.hoverOutlineMaskCacheMissCount;
    const legacyOutline = evaluateHighTargetAcceptance(
        createInput({
            requested: { legacyOutlinePipeline: true },
            runtime: legacyOutlineRuntime,
            sample: { outlineProfileTelemetryAvailable: true },
        }),
    );
    assert.equal(
        legacyOutline.checks
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
            'hoverOutlineMaskCacheBypassCount',
            1,
            'highTargetOutlineCacheBypasses',
        ],
        [
            'hoverOutlineMaskCacheEligibleTargetCount',
            1,
            'highTargetOutlineCacheEligibleTargets',
        ],
        ['hoverOutlineMaskCacheHitCount', 0, 'highTargetOutlineCacheHits'],
        ['hoverOutlineMaskCacheMissCount', 0, 'highTargetOutlineCacheMisses'],
        [
            'hoverOutlineHorizontalPassCount',
            1,
            'highTargetOutlineHorizontalPassAlignment',
        ],
        [
            'hoverOutlineCompositePassCount',
            1,
            'highTargetOutlineCacheConservation',
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

test('static scene-cache acceptance requires a warm, stable timed window', () => {
    const requested = {
        comparisonPair: 'static-opaque-scene-cache',
        comparisonRole: 'cache',
        gardenProfile: 'high-target',
        mode: 'details',
        quality: 'high',
        staticSceneCache: 'cache',
    };
    const runtime = {
        staticOpaqueSceneCacheBoundaryCount: 19,
        staticOpaqueSceneCacheCaptureSubmissionCount: 19,
        staticOpaqueSceneCacheCaptureTriangleCount: 12_000,
        staticOpaqueSceneCacheEnabled: true,
        staticOpaqueSceneCacheIneligibleBoundaryCount: 0,
        staticOpaqueSceneCacheMeshCount: 19,
        staticOpaqueSceneCacheReplayEstimatedBytes: 36,
        staticOpaqueSceneCacheReplayStatus: 'ready',
        staticOpaqueSceneCacheReplaySubmissionCount: 1,
        staticOpaqueSceneCacheReplayTriangleCount: 1,
        staticOpaqueSceneCacheState: 'ready',
        staticOpaqueSceneCacheSupported: true,
        staticOpaqueSceneCacheTargetHeight: 1440,
        staticOpaqueSceneCacheTargetSampleCount: 4,
        staticOpaqueSceneCacheTargetWidth: 2560,
        staticOpaqueSceneCacheTotalEstimatedBytes: 162_201_636,
        staticOpaqueSceneCacheTriangleCount: 12_000,
    };
    const sample = {
        canvas: {
            clientHeight: 720,
            clientWidth: 1280,
            height: 1440,
            width: 2560,
        },
        drawCalls: 100,
        elapsedMs: 5_000,
        renderedFps: 60,
        renderedFrames: 300,
        reportedDpr: 2,
        staticOpaqueSceneCacheBypassFrameCountDelta: 0,
        staticOpaqueSceneCacheCaptureCountAtStart: 1,
        staticOpaqueSceneCacheCaptureCountDelta: 0,
        staticOpaqueSceneCacheCompositePassCountDelta: 300,
        staticOpaqueSceneCacheHitFrameCountAtStart: 3,
        staticOpaqueSceneCacheHitFrameCountDelta: 300,
        staticOpaqueSceneCacheHitRatio: 1,
        staticOpaqueSceneCacheInvalidationCountDelta: 0,
        staticOpaqueSceneCacheLiveFrameCountDelta: 0,
        staticOpaqueSceneCacheReplayStatusAtStart: 'ready',
        staticOpaqueSceneCacheSavedSubmissionCountDelta: 5_700,
        staticOpaqueSceneCacheSavedTriangleCountDelta: 3_600_000,
        staticOpaqueSceneCacheStateAtStart: 'ready',
        staticOpaqueSceneCacheSupportedAtStart: true,
        staticOpaqueSceneCacheUnexpectedStaticSubmissionCountAtEnd: 0,
        submittedTriangles: 1_000_000,
    };
    const evaluate = ({ runtimeOverride = {}, sampleOverride = {} } = {}) =>
        evaluateHighTargetAcceptance({
            apiErrors: [],
            consoleMessages: [],
            pageErrors: [],
            requested,
            runtime: { ...runtime, ...runtimeOverride },
            sample: { ...sample, ...sampleOverride },
        });
    const checks = evaluate().checks.filter((check) =>
        check.name.startsWith('highTargetStaticSceneCache'),
    );

    assert.equal(checks.length, 32);
    assert.equal(
        checks.every((check) => check.pass),
        true,
    );
    assert.deepEqual(
        evaluate({
            sampleOverride: {
                staticOpaqueSceneCacheCaptureCountDelta: 1,
            },
        }).checks.find(
            (check) => check.name === 'highTargetStaticSceneCacheTimedCaptures',
        ),
        {
            actual: 1,
            comparison: 'equal',
            limit: 0,
            name: 'highTargetStaticSceneCacheTimedCaptures',
            pass: false,
        },
    );
    assert.equal(
        evaluate({
            runtimeOverride: {
                staticOpaqueSceneCacheReplayStatus: 'pending',
            },
        }).checks.find(
            (check) =>
                check.name === 'highTargetStaticSceneCacheFinalReplayStatus',
        )?.pass,
        false,
    );
    assert.equal(
        evaluate({
            runtimeOverride: {
                staticOpaqueSceneCacheReplaySubmissionCount: 2,
            },
        }).checks.find(
            (check) =>
                check.name === 'highTargetStaticSceneCacheReplaySubmissions',
        )?.pass,
        false,
    );
    assert.equal(
        evaluate({
            runtimeOverride: {
                staticOpaqueSceneCacheTargetSampleCount: 2,
            },
        }).checks.find(
            (check) =>
                check.name === 'highTargetStaticSceneCacheTargetSampleCount',
        )?.pass,
        false,
    );
    assert.equal(
        evaluate({
            runtimeOverride: {
                staticOpaqueSceneCacheTotalEstimatedBytes:
                    160 * 1024 * 1024 + 1,
            },
        }).checks.find(
            (check) =>
                check.name === 'highTargetStaticSceneCacheTotalEstimatedBytes',
        )?.pass,
        false,
    );
    assert.equal(
        evaluate({
            sampleOverride: {
                staticOpaqueSceneCacheHitRatio: 0.99,
            },
        }).checks.find(
            (check) => check.name === 'highTargetStaticSceneCacheTimedHitRatio',
        )?.pass,
        false,
    );
});

test('cloudy static scene-cache acceptance proves live cloud attenuation without shadow recaptures', () => {
    const input = {
        apiErrors: [],
        consoleMessages: [],
        pageErrors: [],
        requested: {
            comparisonPair: 'static-opaque-scene-cache-cloudy',
            comparisonRole: 'cache',
            fixedTimeSeconds: 12,
            gardenProfile: 'high-target',
            mode: 'cloudy',
            quality: 'high',
            staticSceneCache: 'cache',
        },
        runtime: {
            cloudAttenuationMaskResolution: 192,
            cloudAttenuationMaterialCount: 19,
            cloudAttenuationUpdateMs: 96,
            cloudProjectedShadowCount: 8,
            cloudRealShadowCasterCount: 0,
            cloudVisualCount: 8,
            staticOpaqueSceneCacheBoundaryCount: 19,
            staticOpaqueSceneCacheCaptureSubmissionCount: 19,
            staticOpaqueSceneCacheCaptureTriangleCount: 12_000,
            staticOpaqueSceneCacheEnabled: true,
            staticOpaqueSceneCacheIneligibleBoundaryCount: 0,
            staticOpaqueSceneCacheMeshCount: 19,
            staticOpaqueSceneCacheReplayEstimatedBytes: 36,
            staticOpaqueSceneCacheReplayStatus: 'ready',
            staticOpaqueSceneCacheReplaySubmissionCount: 1,
            staticOpaqueSceneCacheReplayTriangleCount: 1,
            staticOpaqueSceneCacheState: 'ready',
            staticOpaqueSceneCacheSupported: true,
            staticOpaqueSceneCacheTargetHeight: 1440,
            staticOpaqueSceneCacheTargetSampleCount: 4,
            staticOpaqueSceneCacheTargetWidth: 2560,
            staticOpaqueSceneCacheTotalEstimatedBytes: 162_201_636,
            staticOpaqueSceneCacheTriangleCount: 12_000,
        },
        sample: {
            canvas: {
                clientHeight: 720,
                clientWidth: 1280,
                height: 1440,
                width: 2560,
            },
            cloudAttenuationUpdateCountDelta: 52,
            drawCalls: 100,
            elapsedMs: 5_000,
            primaryShadowRefreshCountDelta: 0,
            renderedFps: 60,
            renderedFrames: 300,
            reportedDpr: 2,
            staticOpaqueSceneCacheBypassFrameCountDelta: 0,
            staticOpaqueSceneCacheCaptureCountAtStart: 1,
            staticOpaqueSceneCacheCaptureCountDelta: 0,
            staticOpaqueSceneCacheCompositePassCountDelta: 300,
            staticOpaqueSceneCacheHitFrameCountAtStart: 3,
            staticOpaqueSceneCacheHitFrameCountDelta: 300,
            staticOpaqueSceneCacheHitRatio: 1,
            staticOpaqueSceneCacheInvalidationCountDelta: 0,
            staticOpaqueSceneCacheLiveFrameCountDelta: 0,
            staticOpaqueSceneCacheReplayStatusAtStart: 'ready',
            staticOpaqueSceneCacheSavedSubmissionCountDelta: 5_700,
            staticOpaqueSceneCacheSavedTriangleCountDelta: 3_600_000,
            staticOpaqueSceneCacheStateAtStart: 'ready',
            staticOpaqueSceneCacheSupportedAtStart: true,
            staticOpaqueSceneCacheUnexpectedStaticSubmissionCountAtEnd: 0,
            submittedTriangles: 1_000_000,
        },
    };
    const result = evaluateHighTargetAcceptance(input);
    const checks = result.checks.filter((check) =>
        check.name.startsWith('highTargetStaticSceneCacheCloud'),
    );

    assert.equal(checks.length, 9);
    assert.equal(
        checks.every((check) => check.pass),
        true,
    );
    assert.equal(
        evaluateHighTargetAcceptance({
            ...input,
            sample: {
                ...input.sample,
                cloudAttenuationUpdateCountDelta: 1,
            },
        }).checks.find(
            (check) =>
                check.name ===
                'highTargetStaticSceneCacheCloudAttenuationUpdates',
        )?.pass,
        false,
    );
});

test('static scene-cache occlusion acceptance requires cached depth and live layers on verified hits', () => {
    const requested = {
        gardenProfile: 'high-target',
        mode: 'details',
        quality: 'high',
        staticSceneCache: 'cache',
        staticSceneCacheOcclusionFixture: '1',
    };
    const runtime = {
        staticOpaqueSceneCacheBoundaryCount: 20,
        staticOpaqueSceneCacheCaptureCount: 1,
        staticOpaqueSceneCacheCaptureSubmissionCount: 20,
        staticOpaqueSceneCacheCaptureTriangleCount: 12_002,
        staticOpaqueSceneCacheEnabled: true,
        staticOpaqueSceneCacheHitFrameCount: 7,
        staticOpaqueSceneCacheIneligibleBoundaryCount: 0,
        staticOpaqueSceneCacheMeshCount: 20,
        staticOpaqueSceneCacheOcclusionBackgroundWitnessMinimumMatchRatio: 1,
        staticOpaqueSceneCacheOcclusionCaptureCountAtTransition: 1,
        staticOpaqueSceneCacheOcclusionFixtureEnabled: true,
        staticOpaqueSceneCacheOcclusionFixturePass: true,
        staticOpaqueSceneCacheOcclusionFixtureState: 'passed',
        staticOpaqueSceneCacheOcclusionForegroundMinimumMatchRatio: 1,
        staticOpaqueSceneCacheOcclusionHitFrameCountAtTransition: 3,
        staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio: 0,
        staticOpaqueSceneCacheOcclusionOccluderMinimumMatchRatio: 1,
        staticOpaqueSceneCacheOcclusionTransitionCount: 1,
        staticOpaqueSceneCacheOcclusionVerifiedHitFrameCount: 3,
        staticOpaqueSceneCacheReplayEstimatedBytes: 36,
        staticOpaqueSceneCacheReplayStatus: 'ready',
        staticOpaqueSceneCacheReplaySubmissionCount: 1,
        staticOpaqueSceneCacheReplayTriangleCount: 1,
        staticOpaqueSceneCacheState: 'ready',
        staticOpaqueSceneCacheSupported: true,
        staticOpaqueSceneCacheTargetHeight: 1440,
        staticOpaqueSceneCacheTargetSampleCount: 4,
        staticOpaqueSceneCacheTargetWidth: 2560,
        staticOpaqueSceneCacheTotalEstimatedBytes: 162_201_636,
        staticOpaqueSceneCacheTriangleCount: 12_002,
    };
    const sample = {
        canvas: {
            clientHeight: 720,
            clientWidth: 1280,
            height: 1440,
            width: 2560,
        },
        drawCalls: 100,
        elapsedMs: 5_000,
        renderedFps: 60,
        renderedFrames: 300,
        reportedDpr: 2,
        staticOpaqueSceneCacheBypassFrameCountDelta: 0,
        staticOpaqueSceneCacheCaptureCountAtStart: 1,
        staticOpaqueSceneCacheCaptureCountDelta: 0,
        staticOpaqueSceneCacheCompositePassCountDelta: 300,
        staticOpaqueSceneCacheHitFrameCountAtStart: 7,
        staticOpaqueSceneCacheHitFrameCountDelta: 300,
        staticOpaqueSceneCacheHitRatio: 1,
        staticOpaqueSceneCacheInvalidationCountDelta: 0,
        staticOpaqueSceneCacheLiveFrameCountDelta: 0,
        staticOpaqueSceneCacheReplayStatusAtStart: 'ready',
        staticOpaqueSceneCacheSavedSubmissionCountDelta: 6_000,
        staticOpaqueSceneCacheSavedTriangleCountDelta: 3_600_600,
        staticOpaqueSceneCacheStateAtStart: 'ready',
        staticOpaqueSceneCacheSupportedAtStart: true,
        staticOpaqueSceneCacheUnexpectedStaticSubmissionCountAtEnd: 0,
        submittedTriangles: 1_000_000,
    };
    const evaluate = (runtimeOverride = {}) =>
        evaluateHighTargetAcceptance({
            apiErrors: [],
            consoleMessages: [],
            pageErrors: [],
            requested,
            runtime: { ...runtime, ...runtimeOverride },
            sample,
        });
    const checks = evaluate().checks.filter((check) =>
        check.name.startsWith('highTargetStaticSceneCacheOcclusion'),
    );

    assert.equal(checks.length, 11);
    assert.equal(
        checks.every((check) => check.pass),
        true,
    );
    assert.equal(
        evaluate({
            staticOpaqueSceneCacheCaptureCount: 2,
        }).checks.find(
            (check) =>
                check.name === 'highTargetStaticSceneCacheOcclusionRecaptures',
        )?.pass,
        false,
    );
    assert.equal(
        evaluate({
            staticOpaqueSceneCacheOcclusionOccludedBackgroundLeakMaximumRatio: 0.08,
        }).checks.find(
            (check) =>
                check.name ===
                'highTargetStaticSceneCacheOcclusionBackgroundLeak',
        )?.pass,
        false,
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
            scenarioSet: 'high-target-static-scene-cache',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [
            {
                budget: { checks, pass: true },
                consoleMessages: [],
                environment: null,
                name: 'game-high-target-static-scene-cache-occlusion-fixture-desktop',
                pageErrors: [],
                requested: {
                    controls: '0',
                    debugHud: '0',
                    details: '1',
                    hud: '0',
                    motion: 'none',
                    ...requested,
                },
                runtime,
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
                    ...sample,
                },
                screenshotPath: null,
            },
        ],
        schemaVersion: 2,
        sourceCommit: null,
        staticSceneCacheComparisons: {},
        summary: { failedScenarios: 0 },
        weatherSurfaceComparisons: {},
    });
    assert.match(
        markdown,
        /Static opaque scene-cache occlusion fixture[\s\S]*passed \| 1 \| 1\/1 \| 4\/3 \| 1 \| 1 \| 1 \| 0 \| pass/,
    );
});

test('high target acceptance rejects a demand-render scene with one frame', () => {
    const result = evaluateHighTargetAcceptance({
        apiErrors: [],
        pageErrors: [],
        requested: {
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
        consoleMessages: [
            { type: 'error', text: 'THREE.WebGLProgram: Shader Error' },
        ],
        pageErrors: ['render failed'],
        requested: {
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
        memory: { retainedJsHeapMb: 200 },
        name: `game-high-target-clear-idle-desktop-run-${index + 1}`,
        performanceBudget: { pass: performancePass },
        profileRun: index + 1,
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

test('cross-tier medians retain tier identity and render in a separate report section', () => {
    const crossTierRuns = [10, 20, 30].map((value, index) => {
        const run = highTargetRun(value, index);
        const baseName = 'game-cross-tier-low-steady-desktop';
        return {
            ...run,
            baseName,
            name: `${baseName}-run-${index + 1}`,
            requested: {
                ...run.requested,
                crossTierProfile: true,
                quality: 'low',
            },
            runtime: { qualityTier: 'low' },
            sample: {
                ...run.sample,
                generatedPlantVisibleFieldCountMin: 54,
                generatedPlantVisibleInstanceCountMin: 537,
            },
        };
    });
    const regularRuns = [10, 20, 30].map((value, index) => {
        const run = highTargetRun(value, index);
        const baseName = 'game-high-target-clear-idle-desktop';
        return {
            ...run,
            baseName,
            name: `${baseName}-run-${index + 1}`,
            requested: { ...run.requested, quality: 'high' },
            runtime: { qualityTier: 'high' },
        };
    });
    const highTargetMedians = buildHighTargetMedians([
        ...crossTierRuns,
        ...regularRuns,
    ]);
    const crossTierMedians = buildCrossTierMedians(highTargetMedians);
    const crossTier = crossTierMedians['game-cross-tier-low-steady-desktop'];

    assert.deepEqual(Object.keys(crossTierMedians), [
        'game-cross-tier-low-steady-desktop',
    ]);
    assert.equal(crossTier.crossTierProfile, true);
    assert.equal(crossTier.requestedQuality, 'low');
    assert.equal(crossTier.resolvedQualityTier, 'low');
    assert.equal(crossTier.generatedPlantVisibleFieldCountMin.min, 54);
    assert.equal(crossTier.generatedPlantVisibleInstanceCountMin.min, 537);

    const markdown = buildMarkdown({
        adaptiveHighComparisons: {},
        baseUrl: 'http://profile.local',
        crossTierMedians,
        generatedAt: '2026-08-30T00:00:00.000Z',
        highTargetMedians,
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'cross-tier',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [],
        schemaVersion: 2,
        sourceCommit: null,
        staticSceneCacheComparisons: {},
        summary: { failedScenarios: 0 },
        weatherSurfaceComparisons: {},
    });
    const section = (heading) => {
        const start = markdown.indexOf(`## ${heading}`);
        const end = markdown.indexOf('\n## ', start + 3);
        return markdown.slice(start, end === -1 ? undefined : end);
    };
    const highTargetSection = section('High-target repeated-run summary');
    const crossTierSection = section('Cross-tier repeated-run summary');

    assert.match(highTargetSection, /game-high-target-clear-idle-desktop/);
    assert.doesNotMatch(
        highTargetSection,
        /game-cross-tier-low-steady-desktop/,
    );
    assert.match(crossTierSection, /Requested → resolved/);
    assert.match(
        crossTierSection,
        /game-cross-tier-low-steady-desktop.*low → low.*54\/537/,
    );
    assert.doesNotMatch(
        crossTierSection,
        /game-high-target-clear-idle-desktop/,
    );

    crossTier.acceptancePass = false;
    crossTier.failedAcceptanceRuns = [
        'game-cross-tier-low-steady-desktop-run-2',
    ];
    crossTier.performanceBudget = {
        pass: false,
        checks: [
            {
                actual: 25,
                limit: 20,
                name: 'p95 frame time',
                pass: false,
            },
        ],
    };
    const failureMarkdown = buildMarkdown({
        adaptiveHighComparisons: {},
        baseUrl: 'http://profile.local',
        crossTierMedians,
        generatedAt: '2026-08-30T00:00:00.000Z',
        highTargetMedians,
        options: {
            build: false,
            managedServer: false,
            sampleMs: 5_000,
            scenarios: [],
            scenarioSet: 'cross-tier',
            soakMs: 0,
            warmupMs: 0,
        },
        plantCloseupMedians: {},
        scenarios: [],
        schemaVersion: 3,
        sourceCommit: null,
        staticSceneCacheComparisons: {},
        summary: { failedScenarios: 1 },
        weatherSurfaceComparisons: {},
    });
    const failureSectionStart = failureMarkdown.indexOf(
        '## High-target Aggregate Failures',
    );
    const failureSectionEnd = failureMarkdown.indexOf(
        '\n## ',
        failureSectionStart + 3,
    );
    const failureSection = failureMarkdown.slice(
        failureSectionStart,
        failureSectionEnd,
    );
    assert.match(
        failureSection,
        /game-cross-tier-low-steady-desktop: acceptance failed for game-cross-tier-low-steady-desktop-run-2/,
    );
    assert.match(
        failureSection,
        /game-cross-tier-low-steady-desktop median: p95 frame time 25 > 20/,
    );
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

test('static scene-cache comparison gates paired render work, GPU, and resources', () => {
    const visualComparisons = {
        'static-opaque-scene-cache': {
            maximumMismatchRatio: 0.001,
            maximumP99ByteError: 1,
            pairedRuns: Array.from({ length: 5 }, (_, index) => ({
                mismatchRatio: 0.001,
                p99ByteError: 1,
                profileRun: index + 1,
                valid: true,
            })),
            pass: true,
            validRunCount: 5,
        },
    };
    const pairedRun = ({ comparisonRole, index }) => {
        const cached = comparisonRole === 'cache';
        const baseName = `game-high-target-static-scene-cache-${cached ? 'cached' : 'legacy'}-desktop`;
        const run = highTargetRun(cached ? 21 : 20, index);
        return {
            ...run,
            baseName,
            name: `${baseName}-run-${index + 1}`,
            requested: {
                ...run.requested,
                comparisonPair: 'static-opaque-scene-cache',
                comparisonRole,
            },
            runtime: {
                rendererShaders: cached ? 31 : 30,
                rendererTextures: cached ? 24 : 20,
                ...(cached
                    ? {
                          staticOpaqueSceneCacheCaptureSubmissionCount: 19,
                          staticOpaqueSceneCacheCaptureTriangleCount: 12_000,
                          staticOpaqueSceneCacheReplayEstimatedBytes: 36,
                          staticOpaqueSceneCacheReplayStatus: 'ready',
                          staticOpaqueSceneCacheReplaySubmissionCount: 1,
                          staticOpaqueSceneCacheReplayTriangleCount: 1,
                          staticOpaqueSceneCacheTargetSampleCount: 4,
                          staticOpaqueSceneCacheTotalEstimatedBytes: 162_201_636,
                      }
                    : {}),
            },
            sample: {
                ...run.sample,
                drawCallsPerRenderedFrame: cached ? 180 : 200,
                gpu: {
                    elapsedP95Ms: cached ? 9.5 : 10,
                    valid: true,
                },
                staticOpaqueSceneCacheHitRatio: cached ? 1 : null,
                staticOpaqueSceneCacheSavedSubmissionCountDelta: cached
                    ? 5_700
                    : null,
                staticOpaqueSceneCacheSavedTriangleCountDelta: cached
                    ? 3_600_000
                    : null,
                trianglesPerRenderedFrame: cached ? 900_000 : 1_000_000,
            },
        };
    };
    const runs = [
        ...[0, 1, 2, 3, 4].map((index) =>
            pairedRun({ comparisonRole: 'legacy', index }),
        ),
        ...[0, 1, 2, 3, 4].map((index) =>
            pairedRun({ comparisonRole: 'cache', index }),
        ),
    ];
    const medians = buildHighTargetMedians(runs);
    const comparisons = buildStaticSceneCacheComparisons(
        medians,
        visualComparisons,
    );
    const comparison = comparisons['static-opaque-scene-cache'];

    assert.deepEqual(comparison.acceptancePassRate, {
        cached: 100,
        legacy: 100,
    });
    assert.equal(comparison.drawCallRatio, 0.9);
    assert.equal(comparison.triangleRatio, 0.9);
    assert.equal(comparison.cpuMedianRatio, 1.05);
    assert.equal(comparison.gpuTimingStatus, 'valid');
    assert.equal(comparison.gpuMedianRatio, 0.95);
    assert.equal(comparison.gpuMaximumRunRatio, 0.95);
    assert.equal(comparison.rendererProgramMaximumIncrease, 1);
    assert.equal(comparison.rendererTextureMaximumIncrease, 4);
    assert.equal(comparison.visualComparison.pass, true);
    assert.equal(comparison.staticOpaqueSceneCacheHitRatio.median, 1);
    assert.equal(comparison.staticOpaqueSceneCacheReplayReadyRunCount, 5);
    assert.equal(
        comparison.staticOpaqueSceneCacheReplaySubmissionCount.median,
        1,
    );
    assert.equal(
        comparison.staticOpaqueSceneCacheReplayTriangleCount.median,
        1,
    );
    assert.equal(
        comparison.staticOpaqueSceneCacheTotalEstimatedBytes.max,
        162_201_636,
    );
    assert.equal(
        comparison.staticOpaqueSceneCacheSavedSubmissionCountDelta.median,
        5_700,
    );
    assert.equal(comparison.relativePerformancePass, true);
    assert.equal(comparison.aggregatePass.cached, true);
    assert.equal(
        buildProfileSummary(runs, medians, comparisons).failedScenarios,
        0,
    );
    assert.match(
        buildMarkdown({
            adaptiveHighComparisons: {},
            baseUrl: 'http://profile.local',
            generatedAt: '2026-07-27T00:00:00.000Z',
            highTargetMedians: medians,
            options: {
                build: false,
                managedServer: false,
                sampleMs: 5_000,
                scenarios: [],
                scenarioSet: 'high-target-static-scene-cache',
                soakMs: 0,
                warmupMs: 0,
            },
            plantCloseupMedians: {},
            scenarios: [],
            schemaVersion: 2,
            sourceCommit: null,
            staticSceneCacheComparisons: comparisons,
            summary: { failedScenarios: 0 },
            weatherSurfaceComparisons: {},
        }),
        /Static opaque scene-cache paired comparison[\s\S]*0\.9\/0\.9\/1\.05[\s\S]*0\.95\/0\.95[\s\S]*30 → 31 \(3\.3%\) \(1\)[\s\S]*20 → 24 \(20%\) \(4\)[\s\S]*5\/5 \/ 19→1 \/ 12000→1[\s\S]*154\.69\/154\.69 MiB @ 4x[\s\S]*5700\/3600000/,
    );

    const gpuOutlierRuns = runs.map((run) =>
        run.requested.comparisonRole === 'cache' && run.profileRun === 1
            ? {
                  ...run,
                  sample: {
                      ...run.sample,
                      gpu: {
                          elapsedP95Ms: 10.6,
                          valid: true,
                      },
                  },
              }
            : run,
    );
    const gpuOutlierMedians = buildHighTargetMedians(gpuOutlierRuns);
    const gpuOutlierComparison = buildStaticSceneCacheComparisons(
        gpuOutlierMedians,
        visualComparisons,
    )['static-opaque-scene-cache'];
    assert.equal(gpuOutlierComparison.gpuMedianRatio, 0.95);
    assert.equal(gpuOutlierComparison.gpuMaximumRunRatio, 1.06);
    assert.equal(gpuOutlierComparison.relativePerformancePass, false);
    assert.deepEqual(
        buildProfileSummary(
            gpuOutlierRuns,
            gpuOutlierMedians,
            buildStaticSceneCacheComparisons(
                gpuOutlierMedians,
                visualComparisons,
            ),
        ).failedScenarioNames,
        ['game-high-target-static-scene-cache-cached-desktop'],
    );

    const incompleteTextureRuns = runs.map((run) =>
        run.requested.comparisonRole === 'cache' && run.profileRun === 1
            ? {
                  ...run,
                  runtime: {
                      ...run.runtime,
                      rendererTextures: null,
                  },
              }
            : run,
    );
    const incompleteTextureMedians = buildHighTargetMedians(
        incompleteTextureRuns,
    );
    const incompleteTextureComparison = buildStaticSceneCacheComparisons(
        incompleteTextureMedians,
        visualComparisons,
    )['static-opaque-scene-cache'];
    assert.equal(
        incompleteTextureComparison.rendererTextureMaximumIncrease,
        null,
    );
    assert.equal(incompleteTextureComparison.relativePerformancePass, false);
    assert.deepEqual(
        buildProfileSummary(
            incompleteTextureRuns,
            incompleteTextureMedians,
            buildStaticSceneCacheComparisons(
                incompleteTextureMedians,
                visualComparisons,
            ),
        ).failedScenarioNames,
        ['game-high-target-static-scene-cache-cached-desktop'],
    );

    const visualRegression = {
        'static-opaque-scene-cache': {
            ...visualComparisons['static-opaque-scene-cache'],
            maximumMismatchRatio: 0.02,
            pass: false,
        },
    };
    const visualRegressionComparison = buildStaticSceneCacheComparisons(
        medians,
        visualRegression,
    )['static-opaque-scene-cache'];
    assert.equal(visualRegressionComparison.relativePerformancePass, false);
});

test('static scene-cache image parity measures RGB errors per pixel', () => {
    const legacy = new Uint8Array(100 * 4);
    const cached = new Uint8Array(100 * 4);
    cached[0] = 10;
    const withinBudget = measureStaticSceneCacheImageParity(
        {
            data: legacy,
            info: { channels: 4, height: 10, width: 10 },
        },
        {
            data: cached,
            info: { channels: 4, height: 10, width: 10 },
        },
    );
    assert.equal(withinBudget.valid, true);
    assert.equal(withinBudget.mismatchRatio, 0.01);
    assert.equal(withinBudget.p99ByteError, 0);

    cached[4] = 10;
    const regressed = measureStaticSceneCacheImageParity(
        {
            data: legacy,
            info: { channels: 4, height: 10, width: 10 },
        },
        {
            data: cached,
            info: { channels: 4, height: 10, width: 10 },
        },
    );
    assert.equal(regressed.mismatchRatio, 0.02);
    assert.equal(regressed.p99ByteError, 10);
});

test('static scene-cache visual comparison fails closed without a deterministic clock contract', async () => {
    const visualComparisons = await buildStaticSceneCacheVisualComparisons([
        {
            profileRun: 1,
            requested: {
                comparisonPair: 'static-opaque-scene-cache-cloudy',
                comparisonRole: 'legacy',
                staticSceneCacheVisualDeterministic: false,
            },
        },
        {
            profileRun: 1,
            requested: {
                comparisonPair: 'static-opaque-scene-cache-cloudy',
                comparisonRole: 'cache',
                staticSceneCacheVisualDeterministic: false,
            },
        },
    ]);
    const comparison = visualComparisons['static-opaque-scene-cache-cloudy'];

    assert.equal(comparison.status, 'unavailable');
    assert.equal(comparison.pass, false);
    assert.equal(comparison.validRunCount, 0);
    assert.match(comparison.reason, /no deterministic scene-time/);
});

test('weather-surface comparison gates render work, GPU time, and renderer programs', () => {
    const pairedRun = ({ comparisonRole, index }) => {
        const integrated = comparisonRole === 'integrated';
        const baseName = `game-high-target-rain-${comparisonRole}-weather-surfaces-desktop`;
        const run = highTargetRun(20, index);
        return {
            ...run,
            baseName,
            name: `${baseName}-run-${index + 1}`,
            requested: {
                ...run.requested,
                comparisonPair: 'rain-weather-surfaces',
                comparisonRole,
            },
            runtime: {
                rendererShaders: integrated ? 41 : 40,
                weatherSurfaceAvoidedOverlaySubmissionCount: integrated
                    ? 16
                    : 0,
                weatherSurfaceAvoidedOverlayTriangleCount: integrated
                    ? 2_556
                    : 0,
                weatherSurfaceFallbackOverlaySubmissionCount: integrated
                    ? 29
                    : 45,
                weatherSurfaceFallbackOverlayTriangleCount: integrated
                    ? 13_562
                    : 16_118,
                weatherSurfaceIntegratedInstanceCount: integrated ? 213 : 0,
                weatherSurfaceIntegratedMaterialCount: integrated ? 16 : 0,
                weatherSurfaceMode: comparisonRole,
                weatherSurfacePluginVariantCount: integrated ? 1 : 0,
            },
            sample: {
                ...run.sample,
                drawCallsPerRenderedFrame: integrated ? 104 : 120,
                gpu: {
                    elapsedP95Ms: integrated ? 9.7 : 10,
                    valid: true,
                },
                trianglesPerRenderedFrame: integrated ? 900_000 : 1_100_000,
            },
        };
    };
    const runs = [
        ...[0, 1, 2, 3, 4].map((index) =>
            pairedRun({ comparisonRole: 'legacy', index }),
        ),
        ...[0, 1, 2, 3, 4].map((index) =>
            pairedRun({ comparisonRole: 'integrated', index }),
        ),
    ];
    const medians = buildHighTargetMedians(runs);
    const comparisons = buildWeatherSurfaceComparisons(medians);
    const comparison = comparisons['rain-weather-surfaces'];

    assert.deepEqual(comparison.acceptancePassRate, {
        integrated: 100,
        legacy: 100,
    });
    assert.deepEqual(comparison.fallbackOverlaySubmissions, {
        delta: -16,
        integrated: 29,
        legacy: 45,
        percentDelta: -35.6,
    });
    assert.deepEqual(comparison.fallbackOverlayTriangles, {
        delta: -2_556,
        integrated: 13_562,
        legacy: 16_118,
        percentDelta: -15.9,
    });
    assert.deepEqual(comparison.gpuElapsedP95Ms, {
        delta: -0.3,
        integrated: 9.7,
        legacy: 10,
        percentDelta: -3,
    });
    assert.equal(comparison.gpuTimingStatus, 'valid');
    assert.equal(comparison.gpuMedianRatio, 0.97);
    assert.equal(comparison.gpuMaximumRunRatio, 0.97);
    assert.equal(comparison.pairedGpuRuns.length, 5);
    assert.deepEqual(comparison.rendererShaders, {
        delta: 1,
        integrated: 41,
        legacy: 40,
        percentDelta: 2.5,
    });
    assert.equal(comparison.rendererProgramMaximumIncrease, 1);
    assert.deepEqual(
        comparison.pairedRendererProgramRuns.map(
            ({ increase, integrated, legacy, profileRun, valid }) => ({
                increase,
                integrated,
                legacy,
                profileRun,
                valid,
            }),
        ),
        [1, 2, 3, 4, 5].map((profileRun) => ({
            increase: 1,
            integrated: 41,
            legacy: 40,
            profileRun,
            valid: true,
        })),
    );
    assert.equal(comparison.structuralPass, true);
    assert.equal(comparison.relativePerformancePass, true);
    assert.equal(comparison.pairedPass, true);
    assert.equal(comparison.aggregatePass.integrated, true);
    assert.equal(
        comparison.relativePerformanceChecks.every((check) => check.pass),
        true,
    );
    assert.equal(buildProfileSummary(runs, medians).failedScenarios, 0);
    assert.match(
        buildMarkdown({
            adaptiveHighComparisons: {},
            baseUrl: 'http://profile.local',
            generatedAt: '2026-07-27T00:00:00.000Z',
            highTargetMedians: medians,
            options: {
                build: false,
                managedServer: false,
                sampleMs: 5_000,
                scenarios: [],
                scenarioSet: 'high-target-weather-materials',
                soakMs: 0,
                warmupMs: 0,
            },
            plantCloseupMedians: {},
            scenarios: [],
            schemaVersion: 2,
            sourceCommit: null,
            summary: { failedScenarios: 0 },
            weatherSurfaceComparisons: comparisons,
        }),
        /Integrated weather-surface paired comparison[\s\S]*overlay-triangle proxy[\s\S]*0\.97\/0\.97[\s\S]*40 → 41 \(2\.5%\)[\s\S]*45 → 29 \(-35\.6%\)[\s\S]*16118 → 13562 \(-15\.9%\)[\s\S]*213\/16\/1[\s\S]*16\/2556/,
    );

    const snowRuns = runs.map((run) => {
        const comparisonRole = run.requested.comparisonRole;
        const baseName = `game-high-target-snow-${comparisonRole}-weather-surfaces-desktop`;
        return {
            ...run,
            baseName,
            name: `${baseName}-run-${run.profileRun}`,
            requested: {
                ...run.requested,
                comparisonPair: 'snow-weather-surfaces',
            },
            runtime: {
                ...run.runtime,
                rendererShaders: comparisonRole === 'integrated' ? 24 : 23,
            },
        };
    });
    const snowComparison = buildWeatherSurfaceComparisons(
        buildHighTargetMedians(snowRuns),
    )['snow-weather-surfaces'];
    assert.equal(snowComparison.rendererProgramMaximumIncrease, 1);
    assert.equal(snowComparison.relativePerformancePass, true);
    assert.equal(snowComparison.pairedPass, true);

    for (const [outlierCount, outlierValue, expectedMaximumIncrease] of [
        [1, 42, 2],
        [2, 100, 60],
    ]) {
        const programOutlierRuns = runs.map((run) =>
            run.requested.comparisonRole === 'integrated' &&
            run.profileRun <= outlierCount
                ? {
                      ...run,
                      runtime: {
                          ...run.runtime,
                          rendererShaders: outlierValue,
                      },
                  }
                : run,
        );
        const programOutlierMedians =
            buildHighTargetMedians(programOutlierRuns);
        const programOutlierComparison = buildWeatherSurfaceComparisons(
            programOutlierMedians,
        )['rain-weather-surfaces'];
        const programBoundCheck =
            programOutlierComparison.relativePerformanceChecks.find(
                (check) => check.name === 'weatherSurfaceRendererProgramBound',
            );

        assert.equal(
            programOutlierComparison.rendererShaders.integrated,
            41,
            'the median-only gate would not see these outliers',
        );
        assert.equal(
            programOutlierComparison.rendererProgramMaximumIncrease,
            expectedMaximumIncrease,
        );
        assert.deepEqual(programBoundCheck, {
            actual: expectedMaximumIncrease,
            comparison: 'maximum-increase',
            limit: 1,
            name: 'weatherSurfaceRendererProgramBound',
            pass: false,
        });
        assert.equal(programOutlierComparison.relativePerformancePass, false);
        assert.deepEqual(
            buildProfileSummary(programOutlierRuns, programOutlierMedians)
                .failedScenarioNames,
            ['game-high-target-rain-integrated-weather-surfaces-desktop'],
        );
    }

    const noFallbackReductionRuns = runs.map((run) =>
        run.requested.comparisonRole === 'integrated'
            ? {
                  ...run,
                  runtime: {
                      ...run.runtime,
                      weatherSurfaceFallbackOverlaySubmissionCount: 45,
                  },
              }
            : run,
    );
    const noFallbackReductionMedians = buildHighTargetMedians(
        noFallbackReductionRuns,
    );
    const failedComparison = buildWeatherSurfaceComparisons(
        noFallbackReductionMedians,
    )['rain-weather-surfaces'];
    assert.equal(failedComparison.structuralPass, false);
    assert.deepEqual(
        buildProfileSummary(noFallbackReductionRuns, noFallbackReductionMedians)
            .failedScenarioNames,
        ['game-high-target-rain-integrated-weather-surfaces-desktop'],
    );

    for (const [name, mutate] of [
        [
            'draw calls',
            (run) => ({
                ...run,
                sample: {
                    ...run.sample,
                    drawCallsPerRenderedFrame: 120,
                },
            }),
        ],
        [
            'triangles',
            (run) => ({
                ...run,
                sample: {
                    ...run.sample,
                    trianglesPerRenderedFrame: 1_100_000,
                },
            }),
        ],
        [
            'GPU time',
            (run) => ({
                ...run,
                sample: {
                    ...run.sample,
                    gpu: {
                        elapsedP95Ms: 10,
                        valid: true,
                    },
                },
            }),
        ],
        [
            'renderer programs',
            (run) => ({
                ...run,
                runtime: {
                    ...run.runtime,
                    rendererShaders: 42,
                },
            }),
        ],
    ]) {
        const regressedRuns = runs.map((run) =>
            run.requested.comparisonRole === 'integrated' ? mutate(run) : run,
        );
        const regressedMedians = buildHighTargetMedians(regressedRuns);
        const regressedComparison =
            buildWeatherSurfaceComparisons(regressedMedians)[
                'rain-weather-surfaces'
            ];

        assert.equal(
            regressedComparison.relativePerformancePass,
            false,
            `${name} must fail the paired relative gate`,
        );
        assert.deepEqual(
            buildProfileSummary(regressedRuns, regressedMedians)
                .failedScenarioNames,
            ['game-high-target-rain-integrated-weather-surfaces-desktop'],
        );
    }

    const individualGpuOutlierRuns = runs.map((run) =>
        run.requested.comparisonRole === 'integrated' && run.profileRun === 1
            ? {
                  ...run,
                  sample: {
                      ...run.sample,
                      gpu: {
                          elapsedP95Ms: 10.6,
                          valid: true,
                      },
                  },
              }
            : run,
    );
    const individualGpuOutlierComparison = buildWeatherSurfaceComparisons(
        buildHighTargetMedians(individualGpuOutlierRuns),
    )['rain-weather-surfaces'];
    assert.equal(individualGpuOutlierComparison.gpuMedianRatio, 0.97);
    assert.equal(individualGpuOutlierComparison.gpuMaximumRunRatio, 1.06);
    assert.equal(individualGpuOutlierComparison.relativePerformancePass, false);

    for (const invalidGpu of [
        {
            disjoint: true,
            elapsedP95Ms: null,
            reason: 'GPU timer query results became disjoint',
            valid: false,
        },
        {
            elapsedP95Ms: null,
            reason: 'EXT_disjoint_timer_query_webgl2 is unavailable',
            valid: false,
        },
    ]) {
        const incompleteGpuRuns = runs.map((run) =>
            run.requested.comparisonRole === 'integrated' &&
            run.profileRun === 1
                ? {
                      ...run,
                      sample: {
                          ...run.sample,
                          gpu: invalidGpu,
                      },
                  }
                : run,
        );
        const incompleteComparison = buildWeatherSurfaceComparisons(
            buildHighTargetMedians(incompleteGpuRuns),
        )['rain-weather-surfaces'];
        assert.equal(incompleteComparison.gpuTimingStatus, 'inconclusive');
        assert.equal(incompleteComparison.relativePerformancePass, false);
        assert.equal(incompleteComparison.aggregatePass.integrated, false);
    }
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
                    topologyGenerationDurationMaxMs: value * 2,
                    topologyGenerationDurationTotalMs: value * 4,
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
        summary.cold.pipeline.packedTopologyGenerationDurationTotalMs,
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
