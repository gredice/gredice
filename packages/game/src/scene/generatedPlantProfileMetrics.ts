'use client';

import type { GeneratedLSystemTaskSchedulerSnapshot } from '../generators/plant/hooks/generatedLSystemTaskScheduler';
import type { GeneratedPlantTemplateCacheSnapshot } from '../generators/plant/hooks/generatedPlantTemplateCache';
import {
    getGeneratedPlantInstanceBufferMetricsSnapshot,
    setGeneratedPlantInstanceBufferMetricsEnabled,
} from '../generators/plant/lib/plantInstanceBufferMetrics';
import type { PlantLodLevel } from '../generators/plant/lib/plantLod';
import {
    type GeneratedPlantProfilePartCounts,
    type GeneratedPlantProfilePipelineCounts,
    type GeneratedPlantProfileRenderCounts,
    type GeneratedPlantProfileSnapshot,
    type GeneratedPlantShaderPrewarmStatus,
    updateGameProfileMetadata,
} from './gameProfileMetadata';

type ProfileField = {
    fieldKey: string;
    instanceCount: number;
    lodLevel: PlantLodLevel;
    raisedBedId: number;
    visible: boolean;
};

export type GeneratedPlantProfileBatchField = {
    billboardInstanceCount?: number;
    fieldKey: string;
    instanceCount: number;
    parts?: Partial<GeneratedPlantProfilePartCounts>;
    raisedBedId: number;
    resolvedInstanceCount?: number;
};

export type GeneratedPlantProfileBatch = {
    activeArchetypeCount?: number;
    failedArchetypeCount?: number;
    fields: GeneratedPlantProfileBatchField[];
    status: 'billboard' | 'detailed' | 'pending-near';
};

export type GeneratedPlantProfilePackedWorkerTimings = {
    packingDurationMs: number;
    renderDataBuildDurationMs: number;
    rootBatchingDurationMs: number;
    symbolGenerationDurationMs: number;
    totalDurationMs: number;
};

type ProfileBuild = {
    durationMs: number;
    instanceCount: number;
};

type ProfileState = {
    active: boolean;
    batches: Map<string, GeneratedPlantProfileBatch>;
    builds: Map<string, ProfileBuild>;
    camera: GeneratedPlantProfileSnapshot['camera'];
    error: string | null;
    fields: Map<string, ProfileField>;
    lSystem: GeneratedPlantProfileSnapshot['lSystem'];
    lodEvaluation: GeneratedPlantProfileSnapshot['lodEvaluation'];
    milestonesAt: Record<
        keyof GeneratedPlantProfileSnapshot['milestonesMs'],
        number | null
    >;
    pipeline: GeneratedPlantProfilePipelineCounts;
    schedulerBaseline: GeneratedLSystemTaskSchedulerSnapshot | null;
    selectedBlockId: string;
    selectedRaisedBedId: number;
    sessionId: number;
    startedAt: number;
    templateCacheBaseline: GeneratedPlantTemplateCacheSnapshot | null;
};

const emptyPartCounts = (): GeneratedPlantProfilePartCounts => ({
    billboardInstances: 0,
    compactLeafInstances: 0,
    flowers: 0,
    leafTriangles: 0,
    leaves: 0,
    produce: 0,
    shadowCasterSubmissions: 0,
    shadowPrimitiveInstances: 0,
    stems: 0,
    thorns: 0,
});

const emptyRenderCounts = (): GeneratedPlantProfileRenderCounts => ({
    detailedFields: 0,
    detailedPlantInstances: 0,
    farFields: 0,
    farPlantInstances: 0,
    invisibleFields: 0,
    invisiblePlantInstances: 0,
    midFields: 0,
    midPlantInstances: 0,
    nearFields: 0,
    nearPlantInstances: 0,
    parts: emptyPartCounts(),
    pendingNearFields: 0,
    pendingNearPlantInstances: 0,
    totalFields: 0,
    totalPlantInstances: 0,
});

const emptyShaderPrewarm =
    (): GeneratedPlantProfilePipelineCounts['shaderPrewarm'] => ({
        deduplicated: null,
        durationMs: null,
        observed: false,
        postSwapCompilationCount: null,
        postSwapProgramCount: null,
        programCountAfter: null,
        programCountBefore: null,
        readyAtFirstDetailSwap: null,
        status: 'idle',
    });

const emptyPipelineCounts = (): GeneratedPlantProfilePipelineCounts => ({
    packedWorker: {
        buildCount: 0,
        buildDurationMaxMs: 0,
        buildDurationTotalMs: 0,
        observed: false,
        packingDurationMaxMs: 0,
        packingDurationTotalMs: 0,
        renderDataBuildDurationMaxMs: 0,
        renderDataBuildDurationTotalMs: 0,
        rootBatchingDurationMaxMs: 0,
        rootBatchingDurationTotalMs: 0,
        symbolGenerationDurationMaxMs: 0,
        symbolGenerationDurationTotalMs: 0,
        totalDurationMaxMs: 0,
        totalDurationTotalMs: 0,
        transferByteLengthMax: 0,
        transferByteLengthTotal: 0,
        transferCount: 0,
    },
    scheduler: {
        activeSubscriberCount: 0,
        cancelledSubscriberCount: 0,
        completedTaskCount: 0,
        deduplicatedSubscriberCount: 0,
        deliveredSubscriberCount: 0,
        enqueuedTaskCount: 0,
        failedTaskCount: 0,
        focusedPromotionCount: 0,
        focusedQueuedTaskCount: 0,
        inFlightTaskCount: 0,
        lifetimePeakQueuedTaskCount: 0,
        observed: false,
        peakQueuedTaskCount: 0,
        priorityPromotionCount: 0,
        queuedTaskCount: 0,
        queuedTaskRemovalCount: 0,
        staleResultCount: 0,
        startedTaskCount: 0,
        submittedSubscriberCount: 0,
    },
    shaderPrewarm: emptyShaderPrewarm(),
    templateCache: {
        entryCount: 0,
        estimatedBytes: 0,
        evictionCount: 0,
        hitCount: 0,
        lifetimePeakEstimatedBytes: 0,
        maxEntryCount: 0,
        maxEstimatedBytes: 0,
        missCount: 0,
        observed: false,
        oversizeSkipCount: 0,
        peakEstimatedBytes: 0,
        writeCount: 0,
    },
});

function createState(sessionId = 0): ProfileState {
    return {
        active: false,
        batches: new Map(),
        builds: new Map(),
        camera: {
            active: false,
            settled: false,
            view: 'normal',
            zoom: null,
        },
        error: null,
        fields: new Map(),
        lSystem: {
            cancelledTaskCount: 0,
            completedTaskCount: 0,
            requestedTaskCount: 0,
            syncFallbackTaskCount: 0,
            workerDurationMaxMs: 0,
            workerDurationTotalMs: 0,
            workerFailureCount: 0,
            workerRequestCount: 0,
            workerTaskCount: 0,
        },
        lodEvaluation: {
            durationMaxMs: 0,
            durationTotalMs: 0,
            fieldEvaluationCount: 0,
            fieldProjectionTestCount: 0,
            groupRejectionCount: 0,
            groupTestCount: 0,
            updateCount: 0,
        },
        milestonesAt: {
            cameraSettled: null,
            firstDetailedChunk: null,
            firstDetailedField: null,
            fullyDetailed: null,
            nearIntent: null,
            pendingNear: null,
        },
        pipeline: emptyPipelineCounts(),
        schedulerBaseline: null,
        selectedBlockId: '',
        selectedRaisedBedId: 0,
        sessionId,
        startedAt: 0,
        templateCacheBaseline: null,
    };
}

let state = createState();
let latestShaderPrewarm = emptyShaderPrewarm();

function now() {
    return typeof performance === 'undefined' ? 0 : performance.now();
}

function toRelativeMilliseconds(value: number | null) {
    return value === null ? null : Math.max(0, value - state.startedAt);
}

function counterDelta(current: number, baseline: number) {
    return Math.max(0, current - baseline);
}

function acceptsSession(sessionId?: number) {
    return (
        state.active &&
        (sessionId === undefined || sessionId === state.sessionId)
    );
}

function clampCount(value: number, maximum: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(maximum, Math.max(0, value));
}

function addParts(
    target: GeneratedPlantProfilePartCounts,
    source: Partial<GeneratedPlantProfilePartCounts> | undefined,
) {
    if (!source) {
        return;
    }

    for (const key of Object.keys(target) as Array<
        keyof GeneratedPlantProfilePartCounts
    >) {
        target[key] += source[key] ?? 0;
    }
}

function buildBatchFieldStates() {
    const fieldStates = new Map<
        string,
        {
            billboardInstanceCount: number;
            parts: GeneratedPlantProfilePartCounts;
            resolvedInstanceCount: number;
            status: GeneratedPlantProfileBatch['status'];
        }
    >();
    const statusPriority: Record<GeneratedPlantProfileBatch['status'], number> =
        {
            billboard: 0,
            'pending-near': 1,
            detailed: 2,
        };

    for (const batch of state.batches.values()) {
        for (const field of batch.fields) {
            const instanceCount = Math.max(0, field.instanceCount);
            const resolvedInstanceCount = clampCount(
                field.resolvedInstanceCount ??
                    (batch.status === 'detailed' ? instanceCount : 0),
                instanceCount,
            );
            const billboardInstanceCount = clampCount(
                field.billboardInstanceCount ??
                    (batch.status === 'detailed' ? 0 : instanceCount),
                instanceCount,
            );
            const status =
                resolvedInstanceCount >= instanceCount &&
                billboardInstanceCount === 0
                    ? 'detailed'
                    : batch.status === 'billboard'
                      ? 'billboard'
                      : 'pending-near';
            const current = fieldStates.get(field.fieldKey);
            if (
                current &&
                (statusPriority[current.status] > statusPriority[status] ||
                    (statusPriority[current.status] ===
                        statusPriority[status] &&
                        current.resolvedInstanceCount > resolvedInstanceCount))
            ) {
                continue;
            }

            const parts = emptyPartCounts();
            addParts(parts, field.parts);
            parts.billboardInstances = billboardInstanceCount;
            fieldStates.set(field.fieldKey, {
                billboardInstanceCount,
                parts,
                resolvedInstanceCount,
                status,
            });
        }
    }

    return fieldStates;
}

function addField(
    counts: GeneratedPlantProfileRenderCounts,
    field: ProfileField,
    renderState:
        | {
              billboardInstanceCount: number;
              parts: GeneratedPlantProfilePartCounts;
              resolvedInstanceCount: number;
              status: GeneratedPlantProfileBatch['status'];
          }
        | undefined,
) {
    counts.totalFields += 1;
    counts.totalPlantInstances += field.instanceCount;

    if (!field.visible) {
        counts.invisibleFields += 1;
        counts.invisiblePlantInstances += field.instanceCount;
    } else if (field.lodLevel === 'near') {
        counts.nearFields += 1;
        counts.nearPlantInstances += field.instanceCount;
    } else if (field.lodLevel === 'mid') {
        counts.midFields += 1;
        counts.midPlantInstances += field.instanceCount;
    } else {
        counts.farFields += 1;
        counts.farPlantInstances += field.instanceCount;
    }

    if (renderState?.status === 'pending-near') {
        counts.pendingNearFields += 1;
        counts.pendingNearPlantInstances += renderState.billboardInstanceCount;
    }
    if (renderState?.status === 'detailed') {
        counts.detailedFields += 1;
    }
    counts.detailedPlantInstances += renderState?.resolvedInstanceCount ?? 0;
    addParts(counts.parts, renderState?.parts);
}

function createSnapshot(): GeneratedPlantProfileSnapshot {
    const selected = emptyRenderCounts();
    const nonSelected = emptyRenderCounts();
    const batchFieldStates = buildBatchFieldStates();

    for (const field of state.fields.values()) {
        addField(
            field.raisedBedId === state.selectedRaisedBedId
                ? selected
                : nonSelected,
            field,
            batchFieldStates.get(field.fieldKey),
        );
    }

    const builds = Array.from(state.builds.values());
    const batches = Array.from(state.batches.values());
    const activeArchetypeCount = batches.reduce(
        (total, batch) => total + (batch.activeArchetypeCount ?? 0),
        0,
    );
    const failedArchetypeCount = batches.reduce(
        (total, batch) => total + (batch.failedArchetypeCount ?? 0),
        0,
    );
    const maxArchetypeCountPerBatch = Math.max(
        0,
        ...batches.map((batch) => batch.activeArchetypeCount ?? 0),
    );
    const detailedPlantInstanceCount = Array.from(state.fields.values()).reduce(
        (total, field) =>
            total +
            (batchFieldStates.get(field.fieldKey)?.resolvedInstanceCount ?? 0),
        0,
    );
    return {
        active: state.active,
        camera: { ...state.camera },
        error: state.error,
        instanceBuffers: getGeneratedPlantInstanceBufferMetricsSnapshot(),
        lSystem: { ...state.lSystem },
        lodEvaluation: { ...state.lodEvaluation },
        milestonesMs: {
            cameraSettled: toRelativeMilliseconds(
                state.milestonesAt.cameraSettled,
            ),
            firstDetailedChunk: toRelativeMilliseconds(
                state.milestonesAt.firstDetailedChunk,
            ),
            firstDetailedField: toRelativeMilliseconds(
                state.milestonesAt.firstDetailedField,
            ),
            fullyDetailed: toRelativeMilliseconds(
                state.milestonesAt.fullyDetailed,
            ),
            nearIntent: toRelativeMilliseconds(state.milestonesAt.nearIntent),
            pendingNear: toRelativeMilliseconds(state.milestonesAt.pendingNear),
        },
        nonSelected,
        pipeline: {
            packedWorker: { ...state.pipeline.packedWorker },
            scheduler: { ...state.pipeline.scheduler },
            shaderPrewarm: { ...state.pipeline.shaderPrewarm },
            templateCache: { ...state.pipeline.templateCache },
        },
        renderData: {
            activeArchetypeCount,
            buildCount: builds.length,
            buildDurationMaxMs: Math.max(
                0,
                ...builds.map((build) => build.durationMs),
            ),
            buildDurationTotalMs: builds.reduce(
                (total, build) => total + build.durationMs,
                0,
            ),
            builtPlantInstanceCount: builds.reduce(
                (total, build) => total + build.instanceCount,
                0,
            ),
            detailedPlantInstanceCount,
            failedArchetypeCount,
            maxArchetypeCountPerBatch,
        },
        selected,
        selectedBlockId: state.selectedBlockId,
        selectedRaisedBedId: state.selectedRaisedBedId,
        sessionId: state.sessionId,
    };
}

function updateMilestones() {
    const snapshot = createSnapshot();
    const currentTime = now();
    if (
        state.milestonesAt.nearIntent === null &&
        snapshot.selected.totalFields > 0 &&
        snapshot.selected.nearFields === snapshot.selected.totalFields
    ) {
        state.milestonesAt.nearIntent = currentTime;
    }
    if (
        state.milestonesAt.pendingNear === null &&
        snapshot.selected.pendingNearFields > 0
    ) {
        state.milestonesAt.pendingNear = currentTime;
    }
    if (
        state.milestonesAt.firstDetailedChunk === null &&
        snapshot.selected.detailedPlantInstances > 0
    ) {
        state.milestonesAt.firstDetailedChunk = currentTime;
    }
    if (
        state.milestonesAt.firstDetailedField === null &&
        snapshot.selected.detailedFields > 0
    ) {
        state.milestonesAt.firstDetailedField = currentTime;
    }
    if (
        state.milestonesAt.fullyDetailed === null &&
        snapshot.selected.totalFields > 0 &&
        snapshot.selected.detailedFields === snapshot.selected.totalFields
    ) {
        state.milestonesAt.fullyDetailed = currentTime;
    }
}

function publish() {
    if (!state.active) {
        return;
    }

    updateMilestones();
    updateGameProfileMetadata({
        generatedPlantProfile: createSnapshot(),
    });
}

export function isGeneratedPlantProfileActive() {
    return state.active;
}

export function getGeneratedPlantProfileSessionId() {
    return state.active ? state.sessionId : null;
}

export function startGeneratedPlantProfile({
    schedulerBaseline,
    selectedBlockId,
    selectedRaisedBedId,
    templateCacheBaseline,
}: {
    schedulerBaseline?: GeneratedLSystemTaskSchedulerSnapshot;
    selectedBlockId: string;
    selectedRaisedBedId: number;
    templateCacheBaseline?: GeneratedPlantTemplateCacheSnapshot;
}) {
    setGeneratedPlantInstanceBufferMetricsEnabled(true);
    state = createState(state.sessionId + 1);
    state.active = true;
    state.pipeline.shaderPrewarm = { ...latestShaderPrewarm };
    state.schedulerBaseline = schedulerBaseline
        ? { ...schedulerBaseline }
        : null;
    state.selectedBlockId = selectedBlockId;
    state.selectedRaisedBedId = selectedRaisedBedId;
    state.startedAt = now();
    state.templateCacheBaseline = templateCacheBaseline
        ? { ...templateCacheBaseline }
        : null;
    publish();
    return state.sessionId;
}

export function resetGeneratedPlantProfile(sessionId?: number) {
    if (state.active && sessionId !== undefined && !acceptsSession(sessionId)) {
        return;
    }
    setGeneratedPlantInstanceBufferMetricsEnabled(false);
    state = createState(state.sessionId);
    updateGameProfileMetadata({ generatedPlantProfile: null });
}

export function failGeneratedPlantProfile(error: string, sessionId?: number) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    state.error = error;
    publish();
}

export function recordGeneratedPlantProfileCamera(
    camera: Partial<GeneratedPlantProfileSnapshot['camera']>,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    state.camera = { ...state.camera, ...camera };
    if (state.camera.settled && state.milestonesAt.cameraSettled === null) {
        state.milestonesAt.cameraSettled = now();
    }
    publish();
}

export function recordGeneratedPlantProfileFields(
    fields: ProfileField[],
    sessionId?: number,
) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    state.fields = new Map(fields.map((field) => [field.fieldKey, field]));
    publish();
}

export function recordGeneratedPlantProfileLodEvaluation(
    evaluation:
        | number
        | {
              durationMs: number;
              fieldEvaluationCount: number;
              fieldProjectionTestCount: number;
              groupRejectionCount: number;
              groupTestCount: number;
          },
    sessionId?: number,
) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    const resolved =
        typeof evaluation === 'number'
            ? {
                  durationMs: 0,
                  fieldEvaluationCount: evaluation,
                  fieldProjectionTestCount: evaluation,
                  groupRejectionCount: 0,
                  groupTestCount: 0,
              }
            : evaluation;
    state.lodEvaluation.updateCount += 1;
    state.lodEvaluation.durationMaxMs = Math.max(
        state.lodEvaluation.durationMaxMs,
        resolved.durationMs,
    );
    state.lodEvaluation.durationTotalMs += resolved.durationMs;
    state.lodEvaluation.fieldEvaluationCount += resolved.fieldEvaluationCount;
    state.lodEvaluation.fieldProjectionTestCount +=
        resolved.fieldProjectionTestCount;
    state.lodEvaluation.groupRejectionCount += resolved.groupRejectionCount;
    state.lodEvaluation.groupTestCount += resolved.groupTestCount;
    publish();
}

export function recordGeneratedPlantProfileBatch(
    batchId: string,
    batch: GeneratedPlantProfileBatch,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    state.batches.set(batchId, batch);
    publish();
}

export function removeGeneratedPlantProfileBatch(
    batchId: string,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId) || !state.batches.delete(batchId)) {
        return;
    }
    publish();
}

export function recordGeneratedPlantProfileBuild({
    buildId,
    durationMs,
    instanceCount,
    sessionId,
}: {
    buildId: string;
    durationMs: number;
    instanceCount: number;
    sessionId?: number;
}) {
    if (!acceptsSession(sessionId) || state.builds.has(buildId)) {
        return;
    }
    state.builds.set(buildId, { durationMs, instanceCount });
    publish();
}

export function recordGeneratedPlantProfileLSystemRequest({
    requestedTaskCount,
    sessionId,
    workerTaskCount,
}: {
    requestedTaskCount: number;
    sessionId?: number;
    workerTaskCount: number;
}) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    state.lSystem.requestedTaskCount += requestedTaskCount;
    if (workerTaskCount > 0) {
        state.lSystem.workerRequestCount += 1;
        state.lSystem.workerTaskCount += workerTaskCount;
    }
    publish();
}

export function recordGeneratedPlantProfileLSystemCompletion({
    completedTaskCount,
    durationMs,
    sessionId,
    workerFailed = false,
}: {
    completedTaskCount: number;
    durationMs: number;
    sessionId?: number;
    workerFailed?: boolean;
}) {
    if (!acceptsSession(sessionId)) {
        return;
    }
    state.lSystem.completedTaskCount += completedTaskCount;
    state.lSystem.workerDurationTotalMs += durationMs;
    state.lSystem.workerDurationMaxMs = Math.max(
        state.lSystem.workerDurationMaxMs,
        durationMs,
    );
    if (workerFailed) {
        state.lSystem.workerFailureCount += 1;
    }
    publish();
}

export function recordGeneratedPlantProfileLSystemSyncFallback(
    taskCount: number,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId) || taskCount <= 0) {
        return;
    }
    state.lSystem.syncFallbackTaskCount += taskCount;
    publish();
}

export function recordGeneratedPlantProfileLSystemCancellation(
    cancelledTaskCount: number,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId) || cancelledTaskCount <= 0) {
        return;
    }
    state.lSystem.cancelledTaskCount += cancelledTaskCount;
    publish();
}

export function recordGeneratedPlantProfileSchedulerSnapshot(
    snapshot: GeneratedLSystemTaskSchedulerSnapshot,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId)) {
        return;
    }

    state.schedulerBaseline ??= { ...snapshot };
    const baseline = state.schedulerBaseline;
    const previous = state.pipeline.scheduler;
    const lifetimePeakIncreased =
        snapshot.peakQueuedTaskCount > baseline.peakQueuedTaskCount;
    state.pipeline.scheduler = {
        activeSubscriberCount: snapshot.activeSubscriberCount,
        cancelledSubscriberCount: counterDelta(
            snapshot.cancelledSubscriberCount,
            baseline.cancelledSubscriberCount,
        ),
        completedTaskCount: counterDelta(
            snapshot.completedTaskCount,
            baseline.completedTaskCount,
        ),
        deduplicatedSubscriberCount: counterDelta(
            snapshot.deduplicatedSubscriberCount,
            baseline.deduplicatedSubscriberCount,
        ),
        deliveredSubscriberCount: counterDelta(
            snapshot.deliveredSubscriberCount,
            baseline.deliveredSubscriberCount,
        ),
        enqueuedTaskCount: counterDelta(
            snapshot.enqueuedTaskCount,
            baseline.enqueuedTaskCount,
        ),
        failedTaskCount: counterDelta(
            snapshot.failedTaskCount,
            baseline.failedTaskCount,
        ),
        focusedPromotionCount: counterDelta(
            snapshot.focusedPromotionCount,
            baseline.focusedPromotionCount,
        ),
        focusedQueuedTaskCount: snapshot.focusedQueuedTaskCount,
        inFlightTaskCount: snapshot.inFlightTaskKey === null ? 0 : 1,
        lifetimePeakQueuedTaskCount: snapshot.peakQueuedTaskCount,
        observed: true,
        peakQueuedTaskCount: Math.max(
            previous.peakQueuedTaskCount,
            snapshot.queuedTaskCount,
            lifetimePeakIncreased ? snapshot.peakQueuedTaskCount : 0,
        ),
        priorityPromotionCount: counterDelta(
            snapshot.priorityPromotionCount,
            baseline.priorityPromotionCount,
        ),
        queuedTaskCount: snapshot.queuedTaskCount,
        queuedTaskRemovalCount: counterDelta(
            snapshot.queuedTaskRemovalCount,
            baseline.queuedTaskRemovalCount,
        ),
        staleResultCount: counterDelta(
            snapshot.staleResultCount,
            baseline.staleResultCount,
        ),
        startedTaskCount: counterDelta(
            snapshot.startedTaskCount,
            baseline.startedTaskCount,
        ),
        submittedSubscriberCount: counterDelta(
            snapshot.submittedSubscriberCount,
            baseline.submittedSubscriberCount,
        ),
    };
    publish();
}

export function recordGeneratedPlantProfileTemplateCacheSnapshot(
    snapshot: GeneratedPlantTemplateCacheSnapshot,
    sessionId?: number,
) {
    if (!acceptsSession(sessionId)) {
        return;
    }

    state.templateCacheBaseline ??= { ...snapshot };
    const baseline = state.templateCacheBaseline;
    const previous = state.pipeline.templateCache;
    const lifetimePeakIncreased =
        snapshot.peakEstimatedBytes > baseline.peakEstimatedBytes;
    state.pipeline.templateCache = {
        entryCount: snapshot.entryCount,
        estimatedBytes: snapshot.estimatedBytes,
        evictionCount: counterDelta(
            snapshot.evictionCount,
            baseline.evictionCount,
        ),
        hitCount: counterDelta(snapshot.hitCount, baseline.hitCount),
        lifetimePeakEstimatedBytes: snapshot.peakEstimatedBytes,
        maxEntryCount: snapshot.maxEntryCount,
        maxEstimatedBytes: snapshot.maxEstimatedBytes,
        missCount: counterDelta(snapshot.missCount, baseline.missCount),
        observed: true,
        oversizeSkipCount: counterDelta(
            snapshot.oversizeSkipCount,
            baseline.oversizeSkipCount,
        ),
        peakEstimatedBytes: Math.max(
            previous.peakEstimatedBytes,
            snapshot.estimatedBytes,
            lifetimePeakIncreased ? snapshot.peakEstimatedBytes : 0,
        ),
        writeCount: counterDelta(snapshot.writeCount, baseline.writeCount),
    };
    publish();
}

export function recordGeneratedPlantProfilePackedWorkerResult({
    buildDurationMs,
    sessionId,
    timings,
    transferByteLength,
}: {
    buildDurationMs?: number;
    sessionId?: number;
    timings?: GeneratedPlantProfilePackedWorkerTimings;
    transferByteLength: number;
}) {
    const resolvedTimings: GeneratedPlantProfilePackedWorkerTimings =
        timings ?? {
            packingDurationMs: 0,
            renderDataBuildDurationMs: 0,
            rootBatchingDurationMs: 0,
            symbolGenerationDurationMs: 0,
            totalDurationMs: buildDurationMs ?? Number.NaN,
        };
    const timingValues = Object.values(resolvedTimings);
    if (
        !acceptsSession(sessionId) ||
        timingValues.some(
            (durationMs) => !Number.isFinite(durationMs) || durationMs < 0,
        ) ||
        !Number.isFinite(transferByteLength) ||
        transferByteLength < 0
    ) {
        return;
    }

    const packedWorker = state.pipeline.packedWorker;
    packedWorker.buildCount += 1;
    packedWorker.buildDurationMaxMs = Math.max(
        packedWorker.buildDurationMaxMs,
        resolvedTimings.totalDurationMs,
    );
    packedWorker.buildDurationTotalMs += resolvedTimings.totalDurationMs;
    packedWorker.observed = true;
    packedWorker.packingDurationMaxMs = Math.max(
        packedWorker.packingDurationMaxMs,
        resolvedTimings.packingDurationMs,
    );
    packedWorker.packingDurationTotalMs += resolvedTimings.packingDurationMs;
    packedWorker.renderDataBuildDurationMaxMs = Math.max(
        packedWorker.renderDataBuildDurationMaxMs,
        resolvedTimings.renderDataBuildDurationMs,
    );
    packedWorker.renderDataBuildDurationTotalMs +=
        resolvedTimings.renderDataBuildDurationMs;
    packedWorker.rootBatchingDurationMaxMs = Math.max(
        packedWorker.rootBatchingDurationMaxMs,
        resolvedTimings.rootBatchingDurationMs,
    );
    packedWorker.rootBatchingDurationTotalMs +=
        resolvedTimings.rootBatchingDurationMs;
    packedWorker.symbolGenerationDurationMaxMs = Math.max(
        packedWorker.symbolGenerationDurationMaxMs,
        resolvedTimings.symbolGenerationDurationMs,
    );
    packedWorker.symbolGenerationDurationTotalMs +=
        resolvedTimings.symbolGenerationDurationMs;
    packedWorker.totalDurationMaxMs = Math.max(
        packedWorker.totalDurationMaxMs,
        resolvedTimings.totalDurationMs,
    );
    packedWorker.totalDurationTotalMs += resolvedTimings.totalDurationMs;
    packedWorker.transferByteLengthMax = Math.max(
        packedWorker.transferByteLengthMax,
        transferByteLength,
    );
    packedWorker.transferByteLengthTotal += transferByteLength;
    packedWorker.transferCount += 1;
    publish();
}

export function recordGeneratedPlantProfileShaderPrewarm({
    deduplicated,
    durationMs,
    programCountAfter,
    programCountBefore,
    sessionId,
    status,
}: {
    deduplicated?: boolean | null;
    durationMs?: number | null;
    programCountAfter?: number | null;
    programCountBefore?: number | null;
    sessionId?: number;
    status: GeneratedPlantShaderPrewarmStatus;
}) {
    if (
        (durationMs !== undefined &&
            durationMs !== null &&
            (!Number.isFinite(durationMs) || durationMs < 0)) ||
        (programCountBefore !== undefined &&
            programCountBefore !== null &&
            (!Number.isFinite(programCountBefore) || programCountBefore < 0)) ||
        (programCountAfter !== undefined &&
            programCountAfter !== null &&
            (!Number.isFinite(programCountAfter) || programCountAfter < 0))
    ) {
        return;
    }

    if (!state.active && sessionId !== undefined) {
        return;
    }
    if (state.active && !acceptsSession(sessionId)) {
        return;
    }

    const previous =
        status === 'scheduled'
            ? emptyShaderPrewarm()
            : state.active
              ? state.pipeline.shaderPrewarm
              : latestShaderPrewarm;
    const next = {
        ...previous,
        deduplicated:
            deduplicated === undefined ? previous.deduplicated : deduplicated,
        durationMs: durationMs === undefined ? previous.durationMs : durationMs,
        observed: true,
        programCountAfter:
            programCountAfter === undefined
                ? previous.programCountAfter
                : programCountAfter,
        programCountBefore:
            programCountBefore === undefined
                ? previous.programCountBefore
                : programCountBefore,
        status,
    };
    latestShaderPrewarm = {
        ...next,
        postSwapCompilationCount: null,
        postSwapProgramCount: null,
        readyAtFirstDetailSwap: null,
    };
    if (!state.active) {
        return;
    }

    state.pipeline.shaderPrewarm = next;
    publish();
}

export function recordGeneratedPlantProfilePostSwapCompilation({
    compilationCount,
    prewarmReady,
    programCount,
    sessionId,
}: {
    compilationCount: number | null;
    prewarmReady: boolean;
    programCount?: number | null;
    sessionId?: number;
}) {
    if (
        !acceptsSession(sessionId) ||
        (compilationCount !== null &&
            (!Number.isFinite(compilationCount) || compilationCount < 0)) ||
        (programCount !== undefined &&
            programCount !== null &&
            (!Number.isFinite(programCount) || programCount < 0))
    ) {
        return;
    }

    const shaderPrewarm = state.pipeline.shaderPrewarm;
    if (shaderPrewarm.readyAtFirstDetailSwap !== null) {
        return;
    }
    shaderPrewarm.observed = true;
    shaderPrewarm.postSwapCompilationCount = compilationCount;
    if (programCount !== undefined) {
        shaderPrewarm.postSwapProgramCount = programCount;
    }
    shaderPrewarm.readyAtFirstDetailSwap = prewarmReady;
    publish();
}

export function getGeneratedPlantProfileSnapshot() {
    return state.active ? createSnapshot() : null;
}
