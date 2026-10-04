import type {
    RaisedBedPlantingWithFields,
    SelectedRaisedBedPlantingTaskCommandIdentity,
    SelectedRaisedBedPlantingTaskReadModel,
} from '@gredice/storage';

type SelectedPlantingPresentationTask = Pick<
    SelectedRaisedBedPlantingTaskReadModel,
    | 'assignedUserIds'
    | 'block'
    | 'completion'
    | 'identity'
    | 'scheduledDate'
    | 'sowingLocation'
    | 'status'
>;

export type SelectedPlantingPresentationSource = Pick<
    RaisedBedPlantingWithFields,
    | 'configurationSource'
    | 'id'
    | 'lifecycleStatus'
    | 'plantCount'
    | 'plantSortId'
    | 'plantsPerAxis'
    | 'selectedSeedingDistanceCm'
    | 'spanColumns'
    | 'spanRows'
> & {
    memberships: readonly {
        isAnchor: boolean;
        raisedBedFieldId: number;
    }[];
    selectedTask: SelectedPlantingPresentationTask | null;
};

export type AdminSelectedPlantingScheduleItem = {
    anchorRaisedBedFieldId: number;
    assignedUserIds: string[];
    block: {
        blockedAt: string;
        images: string[];
        note: string | null;
        reasonLabel: string;
    } | null;
    completion: {
        completedAt: string;
        images: string[];
        notes: string | null;
    } | null;
    identity: SelectedRaisedBedPlantingTaskCommandIdentity;
    label: string;
    lifecycleStatus: RaisedBedPlantingWithFields['lifecycleStatus'];
    physicalPositionNumbers: number[];
    plantCount: number;
    plantingId: number;
    plantName: string;
    plantsPerAxis: number;
    raisedBedId: number;
    scheduledDate: string | null;
    selectedSeedingDistanceCm: number;
    sowingLocation: SelectedRaisedBedPlantingTaskReadModel['sowingLocation'];
    spanColumns: number;
    spanRows: number;
    status: SelectedRaisedBedPlantingTaskReadModel['status'];
};

function getPlantCountNoun(count: number) {
    if (count === 1) {
        return 'biljka';
    }
    if (count >= 2 && count <= 4) {
        return 'biljke';
    }
    return 'biljaka';
}

export function buildAdminSelectedPlantingScheduleItem({
    physicalPositionNumbers,
    planting,
    plantName,
    raisedBedId,
}: {
    physicalPositionNumbers: readonly number[];
    planting: SelectedPlantingPresentationSource;
    plantName?: string | null;
    raisedBedId: number;
}): AdminSelectedPlantingScheduleItem | null {
    const task = planting.selectedTask;
    const anchorMembership = planting.memberships.find(
        (membership) => membership.isAnchor,
    );
    if (
        planting.configurationSource !== 'selected' ||
        !task ||
        !anchorMembership ||
        planting.plantCount === null ||
        planting.plantsPerAxis === null ||
        planting.selectedSeedingDistanceCm === null
    ) {
        return null;
    }

    const resolvedPlantName = plantName?.trim() || 'Nepoznata biljka';
    const taskName =
        task.sowingLocation === 'greenhouse'
            ? 'Sijanje u stakleniku'
            : 'Sijanje';

    return {
        anchorRaisedBedFieldId: anchorMembership.raisedBedFieldId,
        assignedUserIds: [...task.assignedUserIds],
        block: task.block
            ? {
                  blockedAt: task.block.blockedAt.toISOString(),
                  images: [...(task.block.images ?? [])],
                  note: task.block.note ?? null,
                  reasonLabel: task.block.reasonLabel,
              }
            : null,
        completion: task.completion
            ? {
                  completedAt: task.completion.completedAt.toISOString(),
                  images: [...task.completion.images],
                  notes: task.completion.notes ?? null,
              }
            : null,
        identity: task.identity,
        label: `${taskName}: ${resolvedPlantName} · ${planting.spanRows.toString()} × ${planting.spanColumns.toString()} polja · gustoća ${planting.plantsPerAxis.toString()} × ${planting.plantsPerAxis.toString()} · ukupno ${planting.plantCount.toString()} ${getPlantCountNoun(planting.plantCount)} · razmak ${planting.selectedSeedingDistanceCm.toString()} cm`,
        lifecycleStatus: planting.lifecycleStatus,
        physicalPositionNumbers: [...physicalPositionNumbers].sort(
            (left, right) => left - right,
        ),
        plantCount: planting.plantCount,
        plantingId: planting.id,
        plantName: resolvedPlantName,
        plantsPerAxis: planting.plantsPerAxis,
        raisedBedId,
        scheduledDate: task.scheduledDate,
        selectedSeedingDistanceCm: planting.selectedSeedingDistanceCm,
        sowingLocation: task.sowingLocation,
        spanColumns: planting.spanColumns,
        spanRows: planting.spanRows,
        status: task.status,
    };
}
