import type {
    RaisedBedFieldPlantCycle,
    RaisedBedFieldWithEvents,
} from '@gredice/storage';

type PrivateAssignmentFields =
    | 'assignedAt'
    | 'assignedBy'
    | 'assignedUserId'
    | 'assignedUserIds';

export type PublicRaisedBedFieldPlantCycle = Omit<
    RaisedBedFieldPlantCycle,
    PrivateAssignmentFields
>;

export type PublicRaisedBedField = Omit<
    RaisedBedFieldWithEvents,
    PrivateAssignmentFields | 'plantCycles'
> & {
    plantCycles: PublicRaisedBedFieldPlantCycle[];
};

function serializePublicPlantCycle(
    plantCycle: RaisedBedFieldPlantCycle,
): PublicRaisedBedFieldPlantCycle {
    const {
        assignedAt,
        assignedBy,
        assignedUserId,
        assignedUserIds,
        ...publicPlantCycle
    } = plantCycle;
    void assignedAt;
    void assignedBy;
    void assignedUserId;
    void assignedUserIds;

    return publicPlantCycle;
}

export function serializePublicRaisedBedField(
    field: RaisedBedFieldWithEvents,
): PublicRaisedBedField {
    const {
        assignedAt,
        assignedBy,
        assignedUserId,
        assignedUserIds,
        plantCycles,
        ...publicField
    } = field;
    void assignedAt;
    void assignedBy;
    void assignedUserId;
    void assignedUserIds;

    return {
        ...publicField,
        plantCycles: plantCycles.map(serializePublicPlantCycle),
    };
}

export function countPublicGardenActivePlants(
    raisedBeds: Array<{ fields: RaisedBedFieldWithEvents[] }>,
): number {
    return raisedBeds.reduce(
        (total, raisedBed) =>
            total +
            raisedBed.fields.filter(
                (field) =>
                    field.active && typeof field.plantSortId === 'number',
            ).length,
        0,
    );
}
