export type ScheduleTaskAssignment = 'mine' | 'other' | 'shared';

type ScheduleTaskAssignmentInput = {
    assignedUserId?: string | null;
    assignedUserIds?: readonly string[] | null;
};

function normalizeAssignedUserIds(
    assignedUserIds: readonly string[] | null | undefined,
) {
    return Array.from(
        new Set(
            (assignedUserIds ?? []).filter(
                (value) => typeof value === 'string' && value.length > 0,
            ),
        ),
    );
}

function classifyAssignedUserIds(
    assignedUserIds: string[],
    userId: string,
): ScheduleTaskAssignment {
    if (assignedUserIds.length === 0) {
        return 'shared';
    }

    return assignedUserIds.includes(userId) ? 'mine' : 'other';
}

export function getScheduleOperationTaskAssignment(
    task: ScheduleTaskAssignmentInput,
    userId: string,
): ScheduleTaskAssignment {
    if (task.assignedUserId) {
        return task.assignedUserId === userId ? 'mine' : 'other';
    }

    return classifyAssignedUserIds(
        normalizeAssignedUserIds(task.assignedUserIds),
        userId,
    );
}

export function getSchedulePlantingTaskAssignment(
    task: ScheduleTaskAssignmentInput,
    userId: string,
): ScheduleTaskAssignment {
    const assignedUserIds = normalizeAssignedUserIds(task.assignedUserIds);
    if (assignedUserIds.length > 0) {
        return classifyAssignedUserIds(assignedUserIds, userId);
    }

    return classifyAssignedUserIds(
        task.assignedUserId ? [task.assignedUserId] : [],
        userId,
    );
}
