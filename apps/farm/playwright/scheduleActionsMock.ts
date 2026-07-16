type ScheduleActionTestState = {
    blockerCalls: number;
    blockerFailuresRemaining?: number;
    hold: boolean;
    lastBlockerTarget?: ScheduleTaskBlockerTarget;
    lastOperationSubmission?: {
        expectedEntityId: number;
        expectedRequirementsFingerprint: string;
        expectedTaskVersionEventId: number;
        operationId: number;
    };
    lastPlantingSubmission?: {
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
        positionIndex: number;
        raisedBedId: number;
    };
    operationCalls: number;
    operationFailuresRemaining?: number;
    plantingCalls: number;
    plantingFailuresRemaining?: number;
    refreshCalls?: number;
    release?: () => void;
    submissionFailure?: {
        canRetry: boolean;
        code:
            | 'assignment_changed'
            | 'invalid_input'
            | 'invalid_status'
            | 'not_authorized'
            | 'not_found'
            | 'task_changed';
        message: string;
        retryImageUrls?: string[];
        success: false;
    };
    uploadTargetFailure?: {
        canRetry: boolean;
        code:
            | 'assignment_changed'
            | 'invalid_input'
            | 'invalid_status'
            | 'not_authorized'
            | 'not_found'
            | 'task_changed';
        message: string;
        success: false;
    };
};

type ScheduleTaskBlockerTarget =
    | {
          expectedEntityId: number;
          expectedTaskVersionEventId: number;
          kind: 'operation';
          operationId: number;
      }
    | {
          expectedPlantCycleEventId: number;
          expectedPlantCycleVersionEventId: number;
          expectedPlantSortId: number;
          kind: 'planting';
          positionIndex: number;
          raisedBedId: number;
      };

declare global {
    interface Window {
        __farmScheduleActionTestState?: ScheduleActionTestState;
    }
}

function getTestState() {
    window.__farmScheduleActionTestState ??= {
        blockerCalls: 0,
        hold: false,
        operationCalls: 0,
        plantingCalls: 0,
    };

    return window.__farmScheduleActionTestState;
}

function failWhenRequested(
    state: ScheduleActionTestState,
    key:
        | 'blockerFailuresRemaining'
        | 'operationFailuresRemaining'
        | 'plantingFailuresRemaining',
) {
    const failuresRemaining = state[key] ?? 0;
    if (failuresRemaining <= 0) {
        return;
    }

    state[key] = failuresRemaining - 1;
    throw new Error('Controlled schedule action failure');
}

function success(state: 'blocked' | 'completed' | 'pendingVerification') {
    return {
        recordedAt: '2026-07-15T10:00:00.000Z',
        state,
        success: true as const,
    };
}

function takeSubmissionFailure(state: ScheduleActionTestState) {
    const failure = state.submissionFailure;
    state.submissionFailure = undefined;
    return failure;
}

async function waitForRelease(state: ScheduleActionTestState) {
    if (!state.hold) {
        return;
    }

    await new Promise<void>((resolve) => {
        state.release = resolve;
    });
}

export async function completeFarmOperation(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    expectedRequirementsFingerprint: string,
) {
    const state = getTestState();
    state.operationCalls += 1;
    state.lastOperationSubmission = {
        expectedEntityId,
        expectedRequirementsFingerprint,
        expectedTaskVersionEventId,
        operationId,
    };
    await waitForRelease(state);
    failWhenRequested(state, 'operationFailuresRemaining');
    return takeSubmissionFailure(state) ?? success('pendingVerification');
}

export async function completeFarmOperationWithImageUrls(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    expectedRequirementsFingerprint: string,
) {
    const state = getTestState();
    state.operationCalls += 1;
    state.lastOperationSubmission = {
        expectedEntityId,
        expectedRequirementsFingerprint,
        expectedTaskVersionEventId,
        operationId,
    };
    await waitForRelease(state);
    failWhenRequested(state, 'operationFailuresRemaining');
    return takeSubmissionFailure(state) ?? success('pendingVerification');
}

export async function completeFarmPlanting(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantCycleVersionEventId: number,
    expectedPlantSortId: number,
) {
    const state = getTestState();
    state.plantingCalls += 1;
    state.lastPlantingSubmission = {
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        positionIndex,
        raisedBedId,
    };
    await waitForRelease(state);
    failWhenRequested(state, 'plantingFailuresRemaining');
    return takeSubmissionFailure(state) ?? success('pendingVerification');
}

export async function blockFarmScheduleTask(target: ScheduleTaskBlockerTarget) {
    const state = getTestState();
    state.blockerCalls += 1;
    state.lastBlockerTarget = target;
    await waitForRelease(state);
    failWhenRequested(state, 'blockerFailuresRemaining');
    return takeSubmissionFailure(state) ?? success('blocked');
}

export async function validateFarmOperationUploadTarget() {
    const state = getTestState();
    const failure = state.uploadTargetFailure;
    state.uploadTargetFailure = undefined;
    return failure ?? { success: true as const };
}

export async function validateFarmScheduleBlockerUploadTarget() {
    const state = getTestState();
    const failure = state.uploadTargetFailure;
    state.uploadTargetFailure = undefined;
    return failure ?? { success: true as const };
}

export async function refreshFarmScheduleAfterSubmission() {
    const state = getTestState();
    state.refreshCalls = (state.refreshCalls ?? 0) + 1;
    return { success: true };
}

export async function markHarvestTraceLabelsPrintedAction() {
    return { success: true };
}
