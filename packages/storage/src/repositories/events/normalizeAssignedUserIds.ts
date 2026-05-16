export function normalizeAssignedUserIds(
    assignedUserIds: string[] | undefined,
    assignedUserId: string | null | undefined,
) {
    if (Array.isArray(assignedUserIds)) {
        const uniqueAssignedUserIds = Array.from(
            new Set(
                assignedUserIds.filter(
                    (value): value is string =>
                        typeof value === 'string' && value.length > 0,
                ),
            ),
        );
        if (uniqueAssignedUserIds.length > 0) {
            return uniqueAssignedUserIds;
        }
    }

    if (typeof assignedUserId === 'string' && assignedUserId.length > 0) {
        return [assignedUserId];
    }

    return [] as string[];
}
