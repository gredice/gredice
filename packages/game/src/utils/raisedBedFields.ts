type RaisedBedFieldLike = {
    active?: boolean | null;
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

export function countRaisedBedOccupiedFields<T extends RaisedBedFieldLike>(
    fields: T[] | null | undefined,
) {
    return (
        fields?.filter((field) => isRaisedBedFieldOccupied(field)).length ?? 0
    );
}
