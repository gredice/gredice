import type {
    RaisedBedFieldPlantCycle,
    RaisedBedFieldWithEvents,
    RaisedBedPlantingWithFields,
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

type GardenRaisedBedPlantingSource = Pick<
    RaisedBedPlantingWithFields,
    | 'anchorPositionIndex'
    | 'configurationSource'
    | 'id'
    | 'isActive'
    | 'layoutKey'
    | 'layoutVersion'
    | 'lifecycleStatus'
    | 'lifecycleStartedAt'
    | 'lifecycleStoppedAt'
    | 'lifecycleVersionEventId'
    | 'maxSeedingDistanceCm'
    | 'minSeedingDistanceCm'
    | 'optimalSeedingDistanceCm'
    | 'plantCount'
    | 'plantSortId'
    | 'plantsPerAxis'
    | 'selectedSeedingDistanceCm'
    | 'spanColumns'
    | 'spanRows'
> & {
    selectedTask: RaisedBedPlantingWithFields['selectedTask'];
    memberships: Array<
        Pick<
            RaisedBedPlantingWithFields['memberships'][number],
            'isAnchor' | 'raisedBedFieldId' | 'relativeColumn' | 'relativeRow'
        > & {
            raisedBedField: Pick<
                RaisedBedPlantingWithFields['memberships'][number]['raisedBedField'],
                'positionIndex'
            >;
        }
    >;
};

export type GardenRaisedBedPlanting = Omit<
    GardenRaisedBedPlantingSource,
    'memberships' | 'selectedTask'
> & {
    memberships: Array<
        Omit<
            GardenRaisedBedPlantingSource['memberships'][number],
            'raisedBedField'
        > & {
            positionIndex: number;
        }
    >;
    selectedTask: {
        status: NonNullable<
            RaisedBedPlantingWithFields['selectedTask']
        >['status'];
        scheduledDate: string | null;
        sowingLocation: NonNullable<
            RaisedBedPlantingWithFields['selectedTask']
        >['sowingLocation'];
        block: null | {
            reasonCode: string;
            reasonLabel: string;
            note?: string;
            images?: string[];
            blockedAt: Date;
        };
        completion: null | {
            completedAt: Date;
            images: string[];
            notes?: string;
            status: 'pendingVerification' | 'sowed';
        };
        verification: null | { verifiedAt: Date };
        cancellation: null | {
            cancelledAt: Date;
            reason: string;
        };
    } | null;
};

function serializeGardenSelectedTask(
    task: RaisedBedPlantingWithFields['selectedTask'],
): GardenRaisedBedPlanting['selectedTask'] {
    if (!task) {
        return null;
    }
    return {
        status: task.status,
        scheduledDate: task.scheduledDate,
        sowingLocation: task.sowingLocation,
        block: task.block
            ? {
                  reasonCode: task.block.reasonCode,
                  reasonLabel: task.block.reasonLabel,
                  ...(task.block.note ? { note: task.block.note } : {}),
                  ...(task.block.images ? { images: task.block.images } : {}),
                  blockedAt: task.block.blockedAt,
              }
            : null,
        completion: task.completion
            ? {
                  completedAt: task.completion.completedAt,
                  images: task.completion.images,
                  ...(task.completion.notes
                      ? { notes: task.completion.notes }
                      : {}),
                  status: task.completion.status,
              }
            : null,
        verification: task.verification
            ? { verifiedAt: task.verification.verifiedAt }
            : null,
        cancellation: task.cancellation
            ? {
                  cancelledAt: task.cancellation.cancelledAt,
                  reason: task.cancellation.reason,
              }
            : null,
    };
}

function serializeGardenRaisedBedPlanting(
    planting: GardenRaisedBedPlantingSource,
): GardenRaisedBedPlanting {
    return {
        id: planting.id,
        plantSortId: planting.plantSortId,
        anchorPositionIndex: planting.anchorPositionIndex,
        minSeedingDistanceCm: planting.minSeedingDistanceCm,
        optimalSeedingDistanceCm: planting.optimalSeedingDistanceCm,
        maxSeedingDistanceCm: planting.maxSeedingDistanceCm,
        selectedSeedingDistanceCm: planting.selectedSeedingDistanceCm,
        plantsPerAxis: planting.plantsPerAxis,
        plantCount: planting.plantCount,
        layoutKey: planting.layoutKey,
        spanRows: planting.spanRows,
        spanColumns: planting.spanColumns,
        layoutVersion: planting.layoutVersion,
        configurationSource: planting.configurationSource,
        isActive: planting.isActive,
        lifecycleStartedAt: planting.lifecycleStartedAt,
        lifecycleStoppedAt: planting.lifecycleStoppedAt,
        lifecycleVersionEventId: planting.lifecycleVersionEventId,
        lifecycleStatus: planting.lifecycleStatus,
        selectedTask: serializeGardenSelectedTask(planting.selectedTask),
        memberships: planting.memberships.map((membership) => ({
            raisedBedFieldId: membership.raisedBedFieldId,
            relativeRow: membership.relativeRow,
            relativeColumn: membership.relativeColumn,
            isAnchor: membership.isAnchor,
            positionIndex: membership.raisedBedField.positionIndex,
        })),
    };
}

/**
 * Authenticated Garden reads expose an allowlisted domain projection. Storage
 * row timestamps are intentionally omitted: lifecycleStartedAt is the crop's
 * event-derived start, while row createdAt is only projection audit metadata.
 */
export function serializeRaisedBedPlantingsForGardenView(
    plantings: GardenRaisedBedPlantingSource[],
    options: { publicView?: boolean } = {},
) {
    return options.publicView
        ? {}
        : { plantings: plantings.map(serializeGardenRaisedBedPlanting) };
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
