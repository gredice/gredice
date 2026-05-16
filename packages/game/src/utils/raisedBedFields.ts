type RaisedBedFieldPlantLifecycleLike = {
    assignedAt?: Date | string | null;
    createdAt?: Date | string | null;
    endedAt?: Date | string | null;
    plantDeadDate?: Date | string | null;
    plantGrowthDate?: Date | string | null;
    plantHarvestedDate?: Date | string | null;
    plantReadyDate?: Date | string | null;
    plantRemovedDate?: Date | string | null;
    plantScheduledDate?: Date | string | null;
    plantSowDate?: Date | string | null;
    plantStatus?: string | null;
    startedAt?: Date | string | null;
    stoppedDate?: Date | string | null;
    toBeRemoved?: boolean | null;
    updatedAt?: Date | string | null;
};

export type RaisedBedFieldPlantHistoryEntry =
    RaisedBedFieldPlantLifecycleLike & {
        active?: boolean | null;
        plantPlaceEventId?: number | null;
        plantSortId?: number | null;
        positionIndex: number;
    };

type RaisedBedFieldPlantCycleLike = RaisedBedFieldPlantLifecycleLike & {
    active?: boolean | null;
    plantPlaceEventId?: number | null;
    plantSortId?: number | null;
    positionIndex?: number | null;
};

type RaisedBedFieldLike = RaisedBedFieldPlantLifecycleLike & {
    active?: boolean | null;
    plantCycles?: RaisedBedFieldPlantCycleLike[] | null;
    plantSortId?: number | null;
    positionIndex: number;
};

export function isRaisedBedFieldOccupied(
    field: Omit<RaisedBedFieldLike, 'positionIndex'> | null | undefined,
) {
    return Boolean(field?.active && typeof field.plantSortId === 'number');
}

export function findRaisedBedOccupiedField<T extends RaisedBedFieldLike>(
    fields: T[] | null | undefined,
    positionIndex: number,
) {
    return fields?.find(
        (field) =>
            field.positionIndex === positionIndex &&
            isRaisedBedFieldOccupied(field),
    );
}

export function findRaisedBedFieldWithPlant<T extends RaisedBedFieldLike>(
    fields: T[] | null | undefined,
    positionIndex: number,
) {
    return fields?.find(
        (field) =>
            field.positionIndex === positionIndex &&
            typeof field.plantSortId === 'number',
    );
}

function getHistoryTimestamp(field: RaisedBedFieldPlantHistoryEntry) {
    const value =
        field.startedAt ??
        field.plantSowDate ??
        field.createdAt ??
        field.endedAt ??
        field.updatedAt;
    if (!value) {
        return 0;
    }

    return new Date(value).getTime();
}

export function getRaisedBedFieldPlantHistory<T extends RaisedBedFieldLike>(
    fields: T[] | null | undefined,
    positionIndex: number,
): RaisedBedFieldPlantHistoryEntry[] {
    const fieldsAtPosition =
        fields?.filter((field) => field.positionIndex === positionIndex) ?? [];
    const plantCycles = fieldsAtPosition.flatMap((field) =>
        (field.plantCycles ?? []).map((plantCycle) => ({
            ...plantCycle,
            positionIndex: plantCycle.positionIndex ?? field.positionIndex,
        })),
    );
    const entries = plantCycles.length
        ? plantCycles
        : fieldsAtPosition.map((field) => ({ ...field }));

    return entries
        .filter(
            (field): field is RaisedBedFieldPlantHistoryEntry =>
                !isRaisedBedFieldOccupied(field) &&
                typeof field.plantSortId === 'number',
        )
        .sort(
            (left, right) =>
                getHistoryTimestamp(left) - getHistoryTimestamp(right),
        );
}

export function countRaisedBedOccupiedFields<T extends RaisedBedFieldLike>(
    fields: T[] | null | undefined,
) {
    return (
        fields?.filter((field) => isRaisedBedFieldOccupied(field)).length ?? 0
    );
}
