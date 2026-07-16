import type { OperationStatus } from '@gredice/storage';
import { expect, test } from '@playwright/test';
import {
    getOperationTaskState,
    getPlantingTaskState,
    getScheduleTaskPresentation,
    getScheduleTaskSummary,
    isActionableTaskState,
    isCompletedTaskState,
    isPendingTaskState,
    type SchedulePlantingStatus,
    type ScheduleTaskState,
    type ScheduleTaskSummaryItem,
} from './scheduleTaskState';

const operationStateCases = [
    { status: 'new', expectedState: 'actionable' },
    { status: 'planned', expectedState: 'actionable' },
    {
        status: 'pendingVerification',
        expectedState: 'pendingVerification',
    },
    { status: 'completed', expectedState: 'completed' },
    { status: 'failed', expectedState: 'failed' },
    { status: 'canceled', expectedState: 'canceled' },
] satisfies Array<{
    status: OperationStatus;
    expectedState: ScheduleTaskState;
}>;

const plantingStateCases = [
    { status: 'planned', expectedState: 'actionable' },
    {
        status: 'pendingVerification',
        expectedState: 'pendingVerification',
    },
    { status: 'sowed', expectedState: 'completed' },
] satisfies Array<{
    status: SchedulePlantingStatus;
    expectedState: ScheduleTaskState;
}>;

test('maps every operation status to a distinct schedule task state', () => {
    for (const { status, expectedState } of operationStateCases) {
        expect(getOperationTaskState(status)).toBe(expectedState);
    }
});

test('maps every scheduled planting status to its task state', () => {
    for (const { status, expectedState } of plantingStateCases) {
        expect(getPlantingTaskState(status)).toBe(expectedState);
    }
});

test('keeps submitted work pending instead of treating it as completed', () => {
    const operationState = getOperationTaskState('pendingVerification');
    const plantingState = getPlantingTaskState('pendingVerification');

    expect(isPendingTaskState(operationState)).toBe(true);
    expect(isPendingTaskState(plantingState)).toBe(true);
    expect(isCompletedTaskState(operationState)).toBe(false);
    expect(isCompletedTaskState(plantingState)).toBe(false);
    expect(isActionableTaskState(operationState)).toBe(false);
    expect(isActionableTaskState(plantingState)).toBe(false);

    expect(getScheduleTaskPresentation(operationState)).toEqual({
        isActionable: false,
        isCompleted: false,
        isPendingVerification: true,
        showAgeIndicator: false,
        showCompletionAttachments: true,
        showCompletionControl: false,
        showRequirementIndicators: false,
    });
    expect(getScheduleTaskPresentation('completed')).toEqual({
        isActionable: false,
        isCompleted: true,
        isPendingVerification: false,
        showAgeIndicator: false,
        showCompletionAttachments: true,
        showCompletionControl: false,
        showRequirementIndicators: false,
    });
});

test('summarizes task counts and duration with consistent state totals', () => {
    const items = [
        { state: 'actionable', durationMinutes: 15 },
        { state: 'actionable', durationMinutes: 5 },
        { state: 'pendingVerification', durationMinutes: 10 },
        { state: 'completed', durationMinutes: 7 },
        { state: 'failed', durationMinutes: 3 },
        { state: 'canceled', durationMinutes: -2 },
    ] satisfies ScheduleTaskSummaryItem[];

    const summary = getScheduleTaskSummary(items);
    const stateMetrics = [
        summary.actionable,
        summary.pendingVerification,
        summary.completed,
        summary.failed,
        summary.canceled,
    ];

    expect(summary.actionable).toEqual({ count: 2, durationMinutes: 20 });
    expect(summary.pendingVerification).toEqual({
        count: 1,
        durationMinutes: 10,
    });
    expect(summary.completed).toEqual({ count: 1, durationMinutes: 7 });
    expect(summary.failed).toEqual({ count: 1, durationMinutes: 3 });
    expect(summary.canceled).toEqual({ count: 1, durationMinutes: 0 });
    expect(summary.total).toEqual({ count: 6, durationMinutes: 40 });
    expect(
        stateMetrics.reduce((total, metrics) => total + metrics.count, 0),
    ).toBe(summary.total.count);
    expect(
        stateMetrics.reduce(
            (total, metrics) => total + metrics.durationMinutes,
            0,
        ),
    ).toBe(summary.total.durationMinutes);
});
