import type {
    OperationAssignableFarmUser,
    OperationAssignedUser,
} from '@gredice/storage';

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
