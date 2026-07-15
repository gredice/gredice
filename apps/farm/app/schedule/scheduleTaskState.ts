import type { OperationStatus } from '@gredice/storage';

export type ScheduleTaskState =
    | 'actionable'
    | 'pendingVerification'
    | 'completed'
    | 'failed'
    | 'canceled';

export type SchedulePlantingStatus =
    | 'planned'
    | 'pendingVerification'
    | 'sowed';

type SchedulePlantingTaskState = Extract<
    ScheduleTaskState,
    'actionable' | 'pendingVerification' | 'completed'
>;

export type ScheduleTaskSummaryItem = {
    state: ScheduleTaskState;
    durationMinutes: number;
};

export type ScheduleTaskMetrics = {
    count: number;
    durationMinutes: number;
};

export type ScheduleTaskSummary = {
    total: ScheduleTaskMetrics;
    actionable: ScheduleTaskMetrics;
    pendingVerification: ScheduleTaskMetrics;
    completed: ScheduleTaskMetrics;
    failed: ScheduleTaskMetrics;
    canceled: ScheduleTaskMetrics;
};

export type ScheduleTaskPresentation = {
    isActionable: boolean;
    isCompleted: boolean;
    isPendingVerification: boolean;
    showAgeIndicator: boolean;
    showCompletionAttachments: boolean;
    showCompletionControl: boolean;
    showRequirementIndicators: boolean;
};

const operationTaskStateByStatus = {
    new: 'actionable',
    planned: 'actionable',
    pendingVerification: 'pendingVerification',
    completed: 'completed',
    failed: 'failed',
    canceled: 'canceled',
} satisfies Record<OperationStatus, ScheduleTaskState>;

export function getOperationTaskState(status: OperationStatus) {
    return operationTaskStateByStatus[status];
}

export function getPlantingTaskState(
    status: SchedulePlantingStatus,
): SchedulePlantingTaskState;
export function getPlantingTaskState(
    status: string | null | undefined,
): SchedulePlantingTaskState | null;
export function getPlantingTaskState(status: string | null | undefined) {
    switch (status) {
        case 'planned':
            return 'actionable';
        case 'pendingVerification':
            return 'pendingVerification';
        case 'sowed':
            return 'completed';
        default:
            return null;
    }
}

export function isActionableTaskState(
    state: ScheduleTaskState | null | undefined,
): state is 'actionable' {
    return state === 'actionable';
}

export function isPendingTaskState(
    state: ScheduleTaskState | null | undefined,
): state is 'pendingVerification' {
    return state === 'pendingVerification';
}

export function isCompletedTaskState(
    state: ScheduleTaskState | null | undefined,
): state is 'completed' {
    return state === 'completed';
}

export function getScheduleTaskPresentation(
    state: ScheduleTaskState,
): ScheduleTaskPresentation {
    const isActionable = isActionableTaskState(state);
    const isCompleted = isCompletedTaskState(state);
    const isPendingVerification = isPendingTaskState(state);

    return {
        isActionable,
        isCompleted,
        isPendingVerification,
        showAgeIndicator: isActionable,
        showCompletionAttachments: isPendingVerification || isCompleted,
        showCompletionControl: isActionable,
        showRequirementIndicators: isActionable,
    };
}

function createEmptyMetrics(): ScheduleTaskMetrics {
    return {
        count: 0,
        durationMinutes: 0,
    };
}

function normalizeDurationMinutes(durationMinutes: number) {
    return Number.isFinite(durationMinutes) ? Math.max(0, durationMinutes) : 0;
}

export function getScheduleTaskSummary(
    items: ScheduleTaskSummaryItem[],
): ScheduleTaskSummary {
    const summary: ScheduleTaskSummary = {
        total: createEmptyMetrics(),
        actionable: createEmptyMetrics(),
        pendingVerification: createEmptyMetrics(),
        completed: createEmptyMetrics(),
        failed: createEmptyMetrics(),
        canceled: createEmptyMetrics(),
    };

    for (const item of items) {
        const durationMinutes = normalizeDurationMinutes(item.durationMinutes);
        const stateMetrics = summary[item.state];

        summary.total.count += 1;
        summary.total.durationMinutes += durationMinutes;
        stateMetrics.count += 1;
        stateMetrics.durationMinutes += durationMinutes;
    }

    return summary;
}
