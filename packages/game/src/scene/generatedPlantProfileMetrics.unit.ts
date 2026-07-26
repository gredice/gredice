import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGeneratedPlantProfileSnapshot,
    recordGeneratedPlantProfileBatch,
    recordGeneratedPlantProfileBuild,
    recordGeneratedPlantProfileFields,
    recordGeneratedPlantProfileLodEvaluation,
    recordGeneratedPlantProfileLSystemCancellation,
    recordGeneratedPlantProfileLSystemCompletion,
    recordGeneratedPlantProfileLSystemRequest,
    recordGeneratedPlantProfileLSystemSyncFallback,
    recordGeneratedPlantProfilePackedWorkerResult,
    recordGeneratedPlantProfilePostSwapCompilation,
    recordGeneratedPlantProfileSchedulerSnapshot,
    recordGeneratedPlantProfileShaderPrewarm,
    recordGeneratedPlantProfileTemplateCacheSnapshot,
    resetGeneratedPlantProfile,
    startGeneratedPlantProfile,
} from './generatedPlantProfileMetrics';

type SchedulerSnapshot = Parameters<
    typeof recordGeneratedPlantProfileSchedulerSnapshot
>[0];
type TemplateCacheSnapshot = Parameters<
    typeof recordGeneratedPlantProfileTemplateCacheSnapshot
>[0];

function schedulerSnapshot(
    overrides: Partial<SchedulerSnapshot> = {},
): SchedulerSnapshot {
    return {
        activeSubscriberCount: 0,
        cancelledSubscriberCount: 0,
        completedTaskCount: 0,
        deduplicatedSubscriberCount: 0,
        deliveredSubscriberCount: 0,
        enqueuedTaskCount: 0,
        failedTaskCount: 0,
        focusedPromotionCount: 0,
        focusedQueuedTaskCount: 0,
        inFlightTaskKey: null,
        peakQueuedTaskCount: 0,
        priorityPromotionCount: 0,
        queuedTaskCount: 0,
        queuedTaskRemovalCount: 0,
        staleResultCount: 0,
        startedTaskCount: 0,
        submittedSubscriberCount: 0,
        ...overrides,
    };
}

function templateCacheSnapshot(
    overrides: Partial<TemplateCacheSnapshot> = {},
): TemplateCacheSnapshot {
    return {
        entryCount: 0,
        estimatedBytes: 0,
        evictionCount: 0,
        hitCount: 0,
        maxEntryCount: 256,
        maxEstimatedBytes: 16 * 1024 * 1024,
        missCount: 0,
        oversizeSkipCount: 0,
        peakEstimatedBytes: 0,
        writeCount: 0,
        ...overrides,
    };
}

test('generated plant profile separates intent, pending, and detailed readiness', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        selectedBlockId: 'bed:1:0',
        selectedRaisedBedId: 1,
    });
    recordGeneratedPlantProfileFields([
        {
            fieldKey: 'selected:0',
            instanceCount: 4,
            lodLevel: 'near',
            raisedBedId: 1,
            visible: true,
        },
        {
            fieldKey: 'background:0',
            instanceCount: 1,
            lodLevel: 'mid',
            raisedBedId: 2,
            visible: true,
        },
    ]);

    let snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.nearFields, 1);
    assert.equal(snapshot?.selected.pendingNearFields, 0);
    assert.equal(snapshot?.selected.detailedFields, 0);
    assert.notEqual(snapshot?.milestonesMs.nearIntent, null);

    recordGeneratedPlantProfileBatch('selected', {
        fields: [
            {
                fieldKey: 'selected:0',
                instanceCount: 4,
                raisedBedId: 1,
            },
        ],
        status: 'pending-near',
    });
    snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.pendingNearFields, 1);
    assert.equal(snapshot?.selected.parts.billboardInstances, 4);
    assert.notEqual(snapshot?.milestonesMs.pendingNear, null);

    recordGeneratedPlantProfileBatch('selected', {
        fields: [
            {
                fieldKey: 'selected:0',
                instanceCount: 4,
                parts: {
                    leaves: 20,
                    stems: 12,
                },
                raisedBedId: 1,
            },
        ],
        status: 'detailed',
    });
    snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.pendingNearFields, 0);
    assert.equal(snapshot?.selected.detailedFields, 1);
    assert.equal(snapshot?.selected.parts.billboardInstances, 0);
    assert.equal(snapshot?.selected.parts.leaves, 20);
    assert.equal(snapshot?.selected.parts.stems, 12);
    assert.notEqual(snapshot?.milestonesMs.firstDetailedField, null);
    assert.notEqual(snapshot?.milestonesMs.fullyDetailed, null);
});

test('generated plant profile accounts for partial detailed and billboard instances per field', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        selectedBlockId: 'bed:29:0',
        selectedRaisedBedId: 29,
    });
    recordGeneratedPlantProfileFields([
        {
            fieldKey: 'selected:partial',
            instanceCount: 4,
            lodLevel: 'near',
            raisedBedId: 29,
            visible: true,
        },
    ]);
    recordGeneratedPlantProfileBatch('selected:partial', {
        activeArchetypeCount: 2,
        failedArchetypeCount: 1,
        fields: [
            {
                billboardInstanceCount: 1,
                fieldKey: 'selected:partial',
                instanceCount: 4,
                parts: {
                    leaves: 15,
                    stems: 9,
                },
                raisedBedId: 29,
                resolvedInstanceCount: 3,
            },
        ],
        status: 'pending-near',
    });

    let snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.pendingNearFields, 1);
    assert.equal(snapshot?.selected.pendingNearPlantInstances, 1);
    assert.equal(snapshot?.selected.detailedFields, 0);
    assert.equal(snapshot?.selected.parts.billboardInstances, 1);
    assert.equal(snapshot?.selected.parts.leaves, 15);
    assert.equal(snapshot?.renderData.activeArchetypeCount, 2);
    assert.equal(snapshot?.renderData.detailedPlantInstanceCount, 3);
    assert.equal(snapshot?.renderData.failedArchetypeCount, 1);
    assert.equal(snapshot?.renderData.maxArchetypeCountPerBatch, 2);

    recordGeneratedPlantProfileBatch('selected:partial', {
        activeArchetypeCount: 2,
        fields: [
            {
                billboardInstanceCount: 0,
                fieldKey: 'selected:partial',
                instanceCount: 4,
                parts: {
                    leaves: 20,
                    stems: 12,
                },
                raisedBedId: 29,
                resolvedInstanceCount: 4,
            },
        ],
        status: 'pending-near',
    });
    snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.pendingNearFields, 0);
    assert.equal(snapshot?.selected.detailedFields, 1);
    assert.equal(snapshot?.renderData.detailedPlantInstanceCount, 4);
    assert.notEqual(snapshot?.milestonesMs.fullyDetailed, null);
});

test('generated plant profile reset prevents counts leaking between sessions', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        selectedBlockId: 'bed:1:0',
        selectedRaisedBedId: 1,
    });
    recordGeneratedPlantProfileLSystemRequest({
        requestedTaskCount: 8,
        workerTaskCount: 6,
    });
    recordGeneratedPlantProfileLSystemCompletion({
        completedTaskCount: 6,
        durationMs: 12,
    });
    recordGeneratedPlantProfileLSystemCancellation(2);
    recordGeneratedPlantProfileBuild({
        buildId: 'first',
        durationMs: 5,
        instanceCount: 4,
    });
    const firstSessionId = getGeneratedPlantProfileSnapshot()?.sessionId;

    startGeneratedPlantProfile({
        selectedBlockId: 'bed:2:0',
        selectedRaisedBedId: 2,
    });
    const snapshot = getGeneratedPlantProfileSnapshot();

    assert.equal(snapshot?.sessionId, (firstSessionId ?? 0) + 1);
    assert.equal(snapshot?.selectedRaisedBedId, 2);
    assert.equal(snapshot?.lSystem.requestedTaskCount, 0);
    assert.equal(snapshot?.lSystem.completedTaskCount, 0);
    assert.equal(snapshot?.lSystem.cancelledTaskCount, 0);
    assert.equal(snapshot?.lSystem.syncFallbackTaskCount, 0);
    assert.equal(snapshot?.renderData.buildCount, 0);
    assert.equal(snapshot?.selected.totalFields, 0);
});

test('generated plant profile exposes synchronous worker fallback tasks', () => {
    resetGeneratedPlantProfile();
    const sessionId = startGeneratedPlantProfile({
        selectedBlockId: 'bed:29:0',
        selectedRaisedBedId: 29,
    });

    recordGeneratedPlantProfileLSystemSyncFallback(2, sessionId);
    recordGeneratedPlantProfileLSystemSyncFallback(4, sessionId + 1);

    assert.equal(
        getGeneratedPlantProfileSnapshot()?.lSystem.syncFallbackTaskCount,
        2,
    );
});

test('generated plant profile attributes hierarchical LOD work', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        selectedBlockId: 'bed:1:0',
        selectedRaisedBedId: 1,
    });

    recordGeneratedPlantProfileLodEvaluation({
        durationMs: 1.5,
        fieldEvaluationCount: 18,
        fieldProjectionTestCount: 0,
        groupRejectionCount: 3,
        groupTestCount: 4,
    });
    recordGeneratedPlantProfileLodEvaluation({
        durationMs: 2.5,
        fieldEvaluationCount: 6,
        fieldProjectionTestCount: 6,
        groupRejectionCount: 1,
        groupTestCount: 2,
    });

    assert.deepEqual(getGeneratedPlantProfileSnapshot()?.lodEvaluation, {
        durationMaxMs: 2.5,
        durationTotalMs: 4,
        fieldEvaluationCount: 24,
        fieldProjectionTestCount: 6,
        groupRejectionCount: 4,
        groupTestCount: 6,
        updateCount: 2,
    });
});

test('generated plant profile instrumentation is inert without a debug session', () => {
    resetGeneratedPlantProfile();
    recordGeneratedPlantProfileFields([
        {
            fieldKey: 'ignored',
            instanceCount: 1,
            lodLevel: 'near',
            raisedBedId: 1,
            visible: true,
        },
    ]);

    assert.equal(getGeneratedPlantProfileSnapshot(), null);
});

test('generated plant profile accepts scheduler and cache baselines at session start', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        schedulerBaseline: schedulerSnapshot({
            completedTaskCount: 10,
            submittedSubscriberCount: 20,
        }),
        selectedBlockId: 'bed:29:0',
        selectedRaisedBedId: 29,
        templateCacheBaseline: templateCacheSnapshot({
            hitCount: 30,
            missCount: 5,
        }),
    });
    recordGeneratedPlantProfileSchedulerSnapshot(
        schedulerSnapshot({
            completedTaskCount: 12,
            submittedSubscriberCount: 23,
        }),
    );
    recordGeneratedPlantProfileTemplateCacheSnapshot(
        templateCacheSnapshot({
            hitCount: 34,
            missCount: 6,
        }),
    );

    const pipeline = getGeneratedPlantProfileSnapshot()?.pipeline;
    assert.equal(pipeline?.scheduler.completedTaskCount, 2);
    assert.equal(pipeline?.scheduler.submittedSubscriberCount, 3);
    assert.equal(pipeline?.templateCache.hitCount, 4);
    assert.equal(pipeline?.templateCache.missCount, 1);
});

test('generated plant profile reports per-session pipeline deltas and gauges', () => {
    resetGeneratedPlantProfile();
    const sessionId = startGeneratedPlantProfile({
        selectedBlockId: 'bed:29:0',
        selectedRaisedBedId: 29,
    });
    recordGeneratedPlantProfileSchedulerSnapshot(
        schedulerSnapshot({
            cancelledSubscriberCount: 10,
            completedTaskCount: 20,
            deduplicatedSubscriberCount: 30,
            peakQueuedTaskCount: 8,
            staleResultCount: 4,
            submittedSubscriberCount: 50,
        }),
    );
    recordGeneratedPlantProfileTemplateCacheSnapshot(
        templateCacheSnapshot({
            entryCount: 40,
            estimatedBytes: 4_000,
            evictionCount: 3,
            hitCount: 60,
            missCount: 20,
            peakEstimatedBytes: 5_000,
            writeCount: 40,
        }),
    );

    recordGeneratedPlantProfileSchedulerSnapshot(
        schedulerSnapshot({
            activeSubscriberCount: 3,
            cancelledSubscriberCount: 12,
            completedTaskCount: 26,
            deduplicatedSubscriberCount: 35,
            deliveredSubscriberCount: 7,
            enqueuedTaskCount: 8,
            focusedPromotionCount: 2,
            focusedQueuedTaskCount: 1,
            inFlightTaskKey: 'focused-task',
            peakQueuedTaskCount: 10,
            priorityPromotionCount: 3,
            queuedTaskCount: 4,
            queuedTaskRemovalCount: 1,
            staleResultCount: 5,
            startedTaskCount: 7,
            submittedSubscriberCount: 62,
        }),
    );
    recordGeneratedPlantProfileTemplateCacheSnapshot(
        templateCacheSnapshot({
            entryCount: 44,
            estimatedBytes: 4_800,
            evictionCount: 5,
            hitCount: 69,
            missCount: 24,
            peakEstimatedBytes: 5_400,
            writeCount: 46,
        }),
    );
    recordGeneratedPlantProfilePackedWorkerResult({
        buildDurationMs: 4,
        transferByteLength: 1_024,
    });
    recordGeneratedPlantProfilePackedWorkerResult({
        buildDurationMs: 7,
        transferByteLength: 2_048,
        timings: {
            packingDurationMs: 1,
            renderDataBuildDurationMs: 1.5,
            rootBatchingDurationMs: 2.5,
            symbolGenerationDurationMs: 2,
            totalDurationMs: 7,
        },
    });
    recordGeneratedPlantProfilePackedWorkerResult({
        buildDurationMs: 100,
        sessionId: sessionId + 1,
        transferByteLength: 100_000,
    });

    const pipeline = getGeneratedPlantProfileSnapshot()?.pipeline;
    assert.equal(pipeline?.scheduler.cancelledSubscriberCount, 2);
    assert.equal(pipeline?.scheduler.completedTaskCount, 6);
    assert.equal(pipeline?.scheduler.deduplicatedSubscriberCount, 5);
    assert.equal(pipeline?.scheduler.staleResultCount, 1);
    assert.equal(pipeline?.scheduler.queuedTaskCount, 4);
    assert.equal(pipeline?.scheduler.peakQueuedTaskCount, 10);
    assert.equal(pipeline?.scheduler.lifetimePeakQueuedTaskCount, 10);
    assert.equal(pipeline?.scheduler.inFlightTaskCount, 1);
    assert.equal(pipeline?.templateCache.hitCount, 9);
    assert.equal(pipeline?.templateCache.missCount, 4);
    assert.equal(pipeline?.templateCache.evictionCount, 2);
    assert.equal(pipeline?.templateCache.estimatedBytes, 4_800);
    assert.equal(pipeline?.templateCache.peakEstimatedBytes, 5_400);
    assert.equal(pipeline?.packedWorker.buildCount, 2);
    assert.equal(pipeline?.packedWorker.buildDurationTotalMs, 11);
    assert.equal(pipeline?.packedWorker.buildDurationMaxMs, 7);
    assert.equal(pipeline?.packedWorker.packingDurationTotalMs, 1);
    assert.equal(pipeline?.packedWorker.packingDurationMaxMs, 1);
    assert.equal(pipeline?.packedWorker.renderDataBuildDurationTotalMs, 1.5);
    assert.equal(pipeline?.packedWorker.rootBatchingDurationTotalMs, 2.5);
    assert.equal(pipeline?.packedWorker.symbolGenerationDurationTotalMs, 2);
    assert.equal(pipeline?.packedWorker.totalDurationTotalMs, 11);
    assert.equal(pipeline?.packedWorker.totalDurationMaxMs, 7);
    assert.equal(pipeline?.packedWorker.transferByteLengthTotal, 3_072);
    assert.equal(pipeline?.packedWorker.transferByteLengthMax, 2_048);

    startGeneratedPlantProfile({
        selectedBlockId: 'bed:29:0',
        selectedRaisedBedId: 29,
    });
    recordGeneratedPlantProfileSchedulerSnapshot(
        schedulerSnapshot({
            activeSubscriberCount: 3,
            cancelledSubscriberCount: 12,
            completedTaskCount: 26,
            deduplicatedSubscriberCount: 35,
            deliveredSubscriberCount: 7,
            enqueuedTaskCount: 8,
            focusedPromotionCount: 2,
            focusedQueuedTaskCount: 1,
            inFlightTaskKey: 'focused-task',
            peakQueuedTaskCount: 10,
            priorityPromotionCount: 3,
            queuedTaskCount: 4,
            queuedTaskRemovalCount: 1,
            staleResultCount: 5,
            startedTaskCount: 7,
            submittedSubscriberCount: 62,
        }),
    );
    recordGeneratedPlantProfileTemplateCacheSnapshot(
        templateCacheSnapshot({
            entryCount: 44,
            estimatedBytes: 4_800,
            evictionCount: 5,
            hitCount: 69,
            missCount: 24,
            peakEstimatedBytes: 5_400,
            writeCount: 46,
        }),
    );

    const warmPipeline = getGeneratedPlantProfileSnapshot()?.pipeline;
    assert.equal(warmPipeline?.scheduler.cancelledSubscriberCount, 0);
    assert.equal(warmPipeline?.scheduler.deduplicatedSubscriberCount, 0);
    assert.equal(warmPipeline?.scheduler.queuedTaskCount, 4);
    assert.equal(warmPipeline?.templateCache.hitCount, 0);
    assert.equal(warmPipeline?.templateCache.estimatedBytes, 4_800);
    assert.equal(warmPipeline?.packedWorker.buildCount, 0);
});

test('generated plant profile carries shader prewarm evidence into a guarded session', () => {
    resetGeneratedPlantProfile();
    recordGeneratedPlantProfileShaderPrewarm({
        status: 'scheduled',
    });
    recordGeneratedPlantProfileShaderPrewarm({
        durationMs: 18,
        programCountAfter: 12,
        programCountBefore: 7,
        status: 'ready',
    });
    const sessionId = startGeneratedPlantProfile({
        selectedBlockId: 'bed:29:0',
        selectedRaisedBedId: 29,
    });

    recordGeneratedPlantProfilePostSwapCompilation({
        compilationCount: 2,
        prewarmReady: true,
        programCount: 14,
        sessionId,
    });
    recordGeneratedPlantProfilePostSwapCompilation({
        compilationCount: 100,
        prewarmReady: true,
        programCount: 114,
        sessionId: sessionId + 1,
    });

    const shaderPrewarm =
        getGeneratedPlantProfileSnapshot()?.pipeline.shaderPrewarm;
    assert.equal(shaderPrewarm?.observed, true);
    assert.equal(shaderPrewarm?.status, 'ready');
    assert.equal(shaderPrewarm?.durationMs, 18);
    assert.equal(shaderPrewarm?.programCountBefore, 7);
    assert.equal(shaderPrewarm?.programCountAfter, 12);
    assert.equal(shaderPrewarm?.postSwapCompilationCount, 2);
    assert.equal(shaderPrewarm?.postSwapProgramCount, 14);
    assert.equal(shaderPrewarm?.readyAtFirstDetailSwap, true);
});
