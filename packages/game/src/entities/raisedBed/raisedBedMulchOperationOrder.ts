export type AppliedRaisedBedMulchOperationOrderInput = {
    completedAt?: Date | string | null;
    createdAt?: Date | string | null;
    id: number;
};

function timestampMs(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const timestamp =
        value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
}

function operationTimestampMs(
    operation: AppliedRaisedBedMulchOperationOrderInput,
) {
    return (
        timestampMs(operation.completedAt) ??
        timestampMs(operation.createdAt) ??
        0
    );
}

function compareAppliedMulchOperationRecency(
    left: AppliedRaisedBedMulchOperationOrderInput,
    right: AppliedRaisedBedMulchOperationOrderInput,
) {
    const timestampDiff =
        operationTimestampMs(left) - operationTimestampMs(right);
    if (timestampDiff !== 0) {
        return timestampDiff;
    }

    return left.id - right.id;
}

export function appliedMulchOperationsOldestFirst<
    T extends AppliedRaisedBedMulchOperationOrderInput,
>(operations: T[]) {
    return [...operations].sort(compareAppliedMulchOperationRecency);
}

export function latestAppliedMulchOperation<
    T extends AppliedRaisedBedMulchOperationOrderInput,
>(operations: T[], predicate: (operation: T) => boolean) {
    return (
        [...operations]
            .sort((left, right) =>
                compareAppliedMulchOperationRecency(right, left),
            )
            .find(predicate) ?? null
    );
}
