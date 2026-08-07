import type {
    OperationAssignableFarmUser,
    OperationAssignedUser,
} from '@gredice/storage';
import {
    canAcceptOperationTask,
    isFieldApproved,
    isFieldBlocked,
    isFieldCompleted,
    isFieldPendingVerification,
    isOperationBlocked,
    isOperationCancelled,
    isOperationCompleted,
    isOperationPendingVerification,
} from './scheduleShared';

type AssignableOperationUser = Pick<
    OperationAssignableFarmUser,
    'avatarUrl' | 'displayName' | 'id' | 'userName'
>;

export function parseScheduledDateInput(value: string) {
    const [year, month, day] = value
        .split('-')
        .map((part) => Number.parseInt(part, 10));

    if (!year || !month || !day) {
        return undefined;
    }

    return new Date(year, month - 1, day);
}

export function createOperationAssignedUsers(
    selectedUserIds: string[],
    farmUsers: AssignableOperationUser[],
    assignedUsers: OperationAssignedUser[] | undefined,
) {
    const usersById = new Map<string, OperationAssignedUser>();

    for (const farmUser of farmUsers) {
        usersById.set(farmUser.id, {
            id: farmUser.id,
            userName: farmUser.userName,
            displayName: farmUser.displayName,
            avatarUrl: farmUser.avatarUrl,
        });
    }

    for (const assignedUser of assignedUsers ?? []) {
        usersById.set(assignedUser.id, assignedUser);
    }

    return selectedUserIds.map(
        (selectedUserId) =>
            usersById.get(selectedUserId) ?? {
                id: selectedUserId,
                userName: selectedUserId,
                displayName: null,
                avatarUrl: null,
            },
    );
}

type DayBulkOperationPatch = {
    assignedUserId?: string | null;
    isAccepted?: boolean;
    status?: string;
};

type DayBulkFieldPatch = {
    assignedUserId?: string | null;
    isDeleted?: boolean;
    plantStatus?: string;
};

function hasOptimisticUnassignment(
    patch: { assignedUserId?: string | null } | undefined,
) {
    return (
        patch !== undefined &&
        Object.hasOwn(patch, 'assignedUserId') &&
        !patch.assignedUserId
    );
}

export function isDayBulkOperationApprovalTargetVisible(
    patch: DayBulkOperationPatch | undefined,
) {
    return (
        !patch?.isAccepted &&
        !hasOptimisticUnassignment(patch) &&
        (patch?.status === undefined || canAcceptOperationTask(patch.status)) &&
        !isOperationBlocked(patch?.status) &&
        !isOperationCompleted(patch?.status) &&
        !isOperationPendingVerification(patch?.status) &&
        !isOperationCancelled(patch?.status)
    );
}

export function isDayBulkOperationAssignmentTargetVisible(
    patch: DayBulkOperationPatch | undefined,
) {
    return (
        !patch?.assignedUserId &&
        !isOperationBlocked(patch?.status) &&
        !isOperationCompleted(patch?.status) &&
        !isOperationPendingVerification(patch?.status) &&
        !isOperationCancelled(patch?.status)
    );
}

export function isDayBulkOperationCancelTargetVisible(
    patch: DayBulkOperationPatch | undefined,
) {
    return (
        !isOperationBlocked(patch?.status) &&
        !isOperationCompleted(patch?.status) &&
        !isOperationPendingVerification(patch?.status) &&
        !isOperationCancelled(patch?.status) &&
        patch?.status !== 'failed'
    );
}

export function isDayBulkFieldApprovalTargetVisible(
    patch: DayBulkFieldPatch | undefined,
) {
    return (
        !patch?.isDeleted &&
        !hasOptimisticUnassignment(patch) &&
        !isFieldBlocked(patch?.plantStatus) &&
        !isFieldApproved(patch?.plantStatus) &&
        !isFieldPendingVerification(patch?.plantStatus) &&
        !isFieldCompleted(patch?.plantStatus)
    );
}

export function isDayBulkFieldCancelTargetVisible(
    patch: DayBulkFieldPatch | undefined,
) {
    return (
        !patch?.isDeleted &&
        !isFieldBlocked(patch?.plantStatus) &&
        !isFieldPendingVerification(patch?.plantStatus) &&
        !isFieldCompleted(patch?.plantStatus)
    );
}

export function isDayBulkFieldAssignmentTargetVisible(
    patch: DayBulkFieldPatch | undefined,
) {
    return (
        !patch?.isDeleted &&
        !patch?.assignedUserId &&
        !isFieldBlocked(patch?.plantStatus) &&
        !isFieldPendingVerification(patch?.plantStatus) &&
        !isFieldCompleted(patch?.plantStatus)
    );
}
