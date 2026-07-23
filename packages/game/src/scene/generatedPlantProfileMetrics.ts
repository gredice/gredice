'use client';

import type { PlantLodLevel } from '../generators/plant/lib/plantLod';
import {
    type GeneratedPlantProfilePartCounts,
    type GeneratedPlantProfileRenderCounts,
    type GeneratedPlantProfileSnapshot,
    updateGameProfileMetadata,
} from './gameProfileMetadata';

type ProfileField = {
    fieldKey: string;
    instanceCount: number;
    lodLevel: PlantLodLevel;
    raisedBedId: number;
    visible: boolean;
};

type ProfileBatchField = {
    fieldKey: string;
    instanceCount: number;
    parts?: Partial<GeneratedPlantProfilePartCounts>;
    raisedBedId: number;
};

type ProfileBatch = {
    fields: ProfileBatchField[];
    status: 'billboard' | 'detailed' | 'pending-near';
};

type ProfileBuild = {
    durationMs: number;
    instanceCount: number;
};

type ProfileState = {
    active: boolean;
    batches: Map<string, ProfileBatch>;
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
    selectedBlockId: string;
    selectedRaisedBedId: number;
    sessionId: number;
    startedAt: number;
};

const emptyPartCounts = (): GeneratedPlantProfilePartCounts => ({
    billboardInstances: 0,
    flowers: 0,
    leaves: 0,
    produce: 0,
    shadowCasterSubmissions: 0,
    shadowPrimitiveInstances: 0,
    stems: 0,
    thorns: 0,
});

const emptyRenderCounts = (): GeneratedPlantProfileRenderCounts => ({
    detailedFields: 0,
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
            workerDurationMaxMs: 0,
            workerDurationTotalMs: 0,
            workerFailureCount: 0,
            workerRequestCount: 0,
            workerTaskCount: 0,
        },
        lodEvaluation: {
            fieldEvaluationCount: 0,
            updateCount: 0,
        },
        milestonesAt: {
            cameraSettled: null,
            firstDetailedField: null,
            fullyDetailed: null,
            nearIntent: null,
            pendingNear: null,
        },
        selectedBlockId: '',
        selectedRaisedBedId: 0,
        sessionId,
        startedAt: 0,
    };
}

let state = createState();

function now() {
    return typeof performance === 'undefined' ? 0 : performance.now();
}

function toRelativeMilliseconds(value: number | null) {
    return value === null ? null : Math.max(0, value - state.startedAt);
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
            parts: GeneratedPlantProfilePartCounts;
            status: ProfileBatch['status'];
        }
    >();
    const statusPriority: Record<ProfileBatch['status'], number> = {
        billboard: 0,
        'pending-near': 1,
        detailed: 2,
    };

    for (const batch of state.batches.values()) {
        for (const field of batch.fields) {
            const current = fieldStates.get(field.fieldKey);
            if (
                current &&
                statusPriority[current.status] > statusPriority[batch.status]
            ) {
                continue;
            }

            const parts = emptyPartCounts();
            if (batch.status === 'detailed') {
                addParts(parts, field.parts);
            } else {
                parts.billboardInstances = field.instanceCount;
            }
            fieldStates.set(field.fieldKey, {
                parts,
                status: batch.status,
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
              parts: GeneratedPlantProfilePartCounts;
              status: ProfileBatch['status'];
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
        counts.pendingNearPlantInstances += field.instanceCount;
    }
    if (renderState?.status === 'detailed') {
        counts.detailedFields += 1;
    }
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
    return {
        active: state.active,
        camera: { ...state.camera },
        error: state.error,
        lSystem: { ...state.lSystem },
        lodEvaluation: { ...state.lodEvaluation },
        milestonesMs: {
            cameraSettled: toRelativeMilliseconds(
                state.milestonesAt.cameraSettled,
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
        renderData: {
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

export function startGeneratedPlantProfile({
    selectedBlockId,
    selectedRaisedBedId,
}: {
    selectedBlockId: string;
    selectedRaisedBedId: number;
}) {
    state = createState(state.sessionId + 1);
    state.active = true;
    state.selectedBlockId = selectedBlockId;
    state.selectedRaisedBedId = selectedRaisedBedId;
    state.startedAt = now();
    publish();
    return state.sessionId;
}

export function resetGeneratedPlantProfile() {
    state = createState(state.sessionId);
    updateGameProfileMetadata({ generatedPlantProfile: null });
}

export function failGeneratedPlantProfile(error: string) {
    if (!state.active) {
        return;
    }
    state.error = error;
    publish();
}

export function recordGeneratedPlantProfileCamera(
    camera: Partial<GeneratedPlantProfileSnapshot['camera']>,
) {
    if (!state.active) {
        return;
    }
    state.camera = { ...state.camera, ...camera };
    if (state.camera.settled && state.milestonesAt.cameraSettled === null) {
        state.milestonesAt.cameraSettled = now();
    }
    publish();
}

export function recordGeneratedPlantProfileFields(fields: ProfileField[]) {
    if (!state.active) {
        return;
    }
    state.fields = new Map(fields.map((field) => [field.fieldKey, field]));
    publish();
}

export function recordGeneratedPlantProfileLodEvaluation(fieldCount: number) {
    if (!state.active) {
        return;
    }
    state.lodEvaluation.updateCount += 1;
    state.lodEvaluation.fieldEvaluationCount += fieldCount;
}

export function recordGeneratedPlantProfileBatch(
    batchId: string,
    batch: ProfileBatch,
) {
    if (!state.active) {
        return;
    }
    state.batches.set(batchId, batch);
    publish();
}

export function removeGeneratedPlantProfileBatch(batchId: string) {
    if (!state.active || !state.batches.delete(batchId)) {
        return;
    }
    publish();
}

export function recordGeneratedPlantProfileBuild({
    buildId,
    durationMs,
    instanceCount,
}: {
    buildId: string;
    durationMs: number;
    instanceCount: number;
}) {
    if (!state.active || state.builds.has(buildId)) {
        return;
    }
    state.builds.set(buildId, { durationMs, instanceCount });
    publish();
}

export function recordGeneratedPlantProfileLSystemRequest({
    requestedTaskCount,
    workerTaskCount,
}: {
    requestedTaskCount: number;
    workerTaskCount: number;
}) {
    if (!state.active) {
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
    workerFailed = false,
}: {
    completedTaskCount: number;
    durationMs: number;
    workerFailed?: boolean;
}) {
    if (!state.active) {
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

export function recordGeneratedPlantProfileLSystemCancellation(
    cancelledTaskCount: number,
) {
    if (!state.active || cancelledTaskCount <= 0) {
        return;
    }
    state.lSystem.cancelledTaskCount += cancelledTaskCount;
    publish();
}

export function getGeneratedPlantProfileSnapshot() {
    return state.active ? createSnapshot() : null;
}
