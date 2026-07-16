import { expect, test } from '@playwright/test';
import {
    getScheduleOperationTaskAssignment,
    getSchedulePlantingTaskAssignment,
} from './scheduleTaskAssignment';

const userId = 'farmer-1';
const otherUserId = 'farmer-2';

test('keeps the operation primary assignee authoritative and supports array-only events', () => {
    expect(
        getScheduleOperationTaskAssignment(
            {
                assignedUserId: otherUserId,
                assignedUserIds: [otherUserId, userId],
            },
            userId,
        ),
    ).toBe('other');
    expect(
        getScheduleOperationTaskAssignment(
            { assignedUserId: null, assignedUserIds: [userId] },
            userId,
        ),
    ).toBe('mine');
    expect(
        getScheduleOperationTaskAssignment(
            { assignedUserId: null, assignedUserIds: [otherUserId] },
            userId,
        ),
    ).toBe('other');
    expect(
        getScheduleOperationTaskAssignment(
            { assignedUserId: null, assignedUserIds: [] },
            userId,
        ),
    ).toBe('shared');
});

test('uses planting assignment arrays before the legacy primary assignee', () => {
    expect(
        getSchedulePlantingTaskAssignment(
            {
                assignedUserId: otherUserId,
                assignedUserIds: [otherUserId, userId],
            },
            userId,
        ),
    ).toBe('mine');
    expect(
        getSchedulePlantingTaskAssignment(
            { assignedUserId: userId, assignedUserIds: [otherUserId] },
            userId,
        ),
    ).toBe('other');
    expect(
        getSchedulePlantingTaskAssignment(
            { assignedUserId: null, assignedUserIds: [] },
            userId,
        ),
    ).toBe('shared');
});
