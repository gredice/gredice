type TimestampValue = Date | string | null | undefined;

export type AppliedRaisedBedOperation = {
    raisedBedId?: number | null;
    raisedBedFieldId?: number | null;
    createdAt: TimestampValue;
    completedAt?: TimestampValue;
};

export type SerializableAppliedRaisedBedOperation =
    AppliedRaisedBedOperation & {
        id: number;
        entityId: number;
        scheduledDate?: TimestampValue;
        status: string;
    };

export type AppliedRaisedBedField = {
    id: number;
    active?: boolean | null;
    plantSowDate?: TimestampValue;
    plantCycles?: Array<{
        active?: boolean | null;
        plantSowDate?: TimestampValue;
        startedAt?: TimestampValue;
    }> | null;
};

function timestampMs(value: TimestampValue) {
    if (!value) {
        return null;
    }

    const timestamp =
        value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
}

function timestampIso(value: TimestampValue) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();

    return Number.isFinite(timestamp) ? date.toISOString() : null;
}

function requiredTimestampIso(value: TimestampValue, fieldName: string) {
    const isoValue = timestampIso(value);
    if (!isoValue) {
        throw new Error(`Applied operation is missing ${fieldName}.`);
    }

    return isoValue;
}

function activePlantRewardBoundaryMs(field: AppliedRaisedBedField) {
    const activePlantCycle = field.plantCycles?.find(
        (plantCycle) => plantCycle.active,
    );
    const timestamps = [
        timestampMs(activePlantCycle?.startedAt),
        timestampMs(activePlantCycle?.plantSowDate),
        timestampMs(field.plantSowDate),
    ].filter((value): value is number => value != null);

    return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

export function isAppliedOperationCurrentForRaisedBedFields(
    operation: AppliedRaisedBedOperation,
    fields: AppliedRaisedBedField[],
) {
    if (!operation.raisedBedFieldId) {
        return true;
    }

    const field = fields.find(
        (candidate) =>
            candidate.id === operation.raisedBedFieldId && candidate.active,
    );
    if (!field) {
        return false;
    }

    const rewardBoundaryMs = activePlantRewardBoundaryMs(field);
    if (rewardBoundaryMs == null) {
        return true;
    }

    const appliedAtMs = timestampMs(
        operation.completedAt ?? operation.createdAt,
    );
    if (appliedAtMs == null) {
        return true;
    }

    return appliedAtMs >= rewardBoundaryMs;
}

export function serializeAppliedRaisedBedOperation(
    operation: SerializableAppliedRaisedBedOperation,
) {
    return {
        id: operation.id,
        entityId: operation.entityId,
        raisedBedId: operation.raisedBedId ?? null,
        raisedBedFieldId: operation.raisedBedFieldId ?? null,
        status: operation.status,
        createdAt: requiredTimestampIso(operation.createdAt, 'createdAt'),
        completedAt: timestampIso(operation.completedAt),
        scheduledDate: timestampIso(operation.scheduledDate),
    };
}
