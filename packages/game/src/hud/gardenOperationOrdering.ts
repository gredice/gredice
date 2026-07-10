type OperationOrderingItem = {
    id: number;
    createdAt: string;
    scheduledDate: string | null;
    completedAt: string | null;
    verifiedAt: string | null;
    canceledAt: string | null;
    statusHistory: {
        changedAt: string;
    }[];
};

function getTimestamp(value: string | Date | null | undefined) {
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getLatestOperationChangeTime(operation: OperationOrderingItem) {
    let latest = getTimestamp(operation.createdAt);

    for (const entry of operation.statusHistory) {
        const changedAt = getTimestamp(entry.changedAt);
        if (changedAt > latest) {
            latest = changedAt;
        }
    }

    return latest;
}

export function getOperationOrderingTime(operation: OperationOrderingItem) {
    return (
        getTimestamp(operation.completedAt) ||
        getTimestamp(operation.scheduledDate) ||
        getTimestamp(operation.verifiedAt) ||
        getTimestamp(operation.canceledAt) ||
        getLatestOperationChangeTime(operation) ||
        getTimestamp(operation.createdAt)
    );
}

export function sortOperationTasksNewestFirst<
    Operation extends OperationOrderingItem,
>(operations: Operation[]) {
    return [...operations].sort((a, b) => {
        const dateDiff =
            getOperationOrderingTime(b) - getOperationOrderingTime(a);

        return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });
}
