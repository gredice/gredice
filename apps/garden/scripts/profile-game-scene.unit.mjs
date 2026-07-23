import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildPlantCloseupAcceptance,
    buildPlantCloseupMedians,
    getScenarioRequest,
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
