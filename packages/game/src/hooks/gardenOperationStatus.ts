export type GardenOperationStatus =
    | 'new'
    | 'planned'
    | 'assigned'
    | 'confirmed'
    | 'completed'
    | 'blocked'
    | 'failed'
    | 'canceled';

const backendStatusMap: Record<string, GardenOperationStatus> = {
    new: 'new',
    planned: 'planned',
    assigned: 'assigned',
    pendingVerification: 'confirmed',
    confirmed: 'confirmed',
    completed: 'completed',
    blocked: 'blocked',
    failed: 'failed',
    canceled: 'canceled',
};

const completedSowingStatuses = new Set([
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
    'notSprouted',
    'died',
    'removed',
]);

type SowingOperationStatusInput = {
    assignedUserId?: string | null;
    assignedUserIds?: string[] | null;
    plantScheduledDate?: string | Date | null;
    plantStatus?: string | null;
};

export function hasAssignedSowingUser(entry: SowingOperationStatusInput) {
    return (
        (entry.assignedUserIds?.length ?? 0) > 0 ||
        Boolean(entry.assignedUserId)
    );
}

export function getSowingGardenOperationStatus(
    entry: SowingOperationStatusInput,
): GardenOperationStatus | null {
    const status = entry.plantStatus ?? 'new';

    if (status === 'blocked') {
        return 'blocked';
    }
    if (status === 'deleted' || status === 'canceled') {
        return 'canceled';
    }
    if (completedSowingStatuses.has(status)) {
        return 'completed';
    }
    if (status === 'pendingVerification') {
        return 'confirmed';
    }
    if (hasAssignedSowingUser(entry)) {
        return 'assigned';
    }
    if (status === 'planned' || entry.plantScheduledDate) {
        return 'planned';
    }
    if (status === 'new') {
        return 'new';
    }

    return null;
}

export function parseGardenOperationStatus(
    status: string,
): GardenOperationStatus {
    const mapped = backendStatusMap[status];
    if (!mapped) {
        throw new Error(`Unknown garden operation status: ${status}`);
    }

    return mapped;
}
