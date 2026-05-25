type TimestampValue = Date | string | null | undefined;

export type AppliedRaisedBedOperation = {
    raisedBedFieldId?: number | null;
    createdAt: TimestampValue;
    completedAt?: TimestampValue;
};

export type AppliedRaisedBedField = {
    id: number;
    active?: boolean | null;
    plantCycles?: Array<{
        active?: boolean | null;
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

function activePlantCycleStartMs(field: AppliedRaisedBedField) {
    const activePlantCycle = field.plantCycles?.find(
        (plantCycle) => plantCycle.active,
    );

    return timestampMs(activePlantCycle?.startedAt);
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

    const cycleStartMs = activePlantCycleStartMs(field);
    if (cycleStartMs == null) {
        return true;
    }

    const appliedAtMs = timestampMs(
        operation.completedAt ?? operation.createdAt,
    );
    if (appliedAtMs == null) {
        return true;
    }

    return appliedAtMs >= cycleStartMs;
}
