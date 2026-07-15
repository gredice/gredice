type ScheduleActionTestState = {
    hold: boolean;
    operationCalls: number;
    plantingCalls: number;
    release?: () => void;
};

declare global {
    interface Window {
        __farmScheduleActionTestState?: ScheduleActionTestState;
    }
}

function getTestState() {
    window.__farmScheduleActionTestState ??= {
        hold: false,
        operationCalls: 0,
        plantingCalls: 0,
    };

    return window.__farmScheduleActionTestState;
}

async function waitForRelease(state: ScheduleActionTestState) {
    if (!state.hold) {
        return;
    }

    await new Promise<void>((resolve) => {
        state.release = resolve;
    });
}

export async function completeFarmOperation() {
    const state = getTestState();
    state.operationCalls += 1;
    await waitForRelease(state);
    return { success: true };
}

export async function completeFarmOperationWithImageUrls() {
    const state = getTestState();
    state.operationCalls += 1;
    await waitForRelease(state);
    return { success: true };
}

export async function completeFarmPlanting() {
    const state = getTestState();
    state.plantingCalls += 1;
    await waitForRelease(state);
    return { success: true };
}

export async function markHarvestTraceLabelsPrintedAction() {
    return { success: true };
}
