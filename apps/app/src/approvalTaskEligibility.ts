import type { getAllRaisedBeds } from '@gredice/storage';

type Bed = Awaited<ReturnType<typeof getAllRaisedBeds>>[number];
type Field = Bed['fields'][number];
type Planting = Bed['plantings'][number];

export function getPendingLegacyPlantCycle(field: Field) {
    if (
        !field.active ||
        field.plantStatus !== 'pendingVerification' ||
        !field.plantSortId
    ) {
        return undefined;
    }
    return field.plantCycles.find((cycle) => cycle.active);
}

export function isPendingSelectedPlanting(bed: Bed, planting: Planting) {
    return (
        bed.status !== 'abandoned' &&
        planting.configurationSource === 'selected' &&
        planting.isActive &&
        !planting.isDeleted &&
        planting.selectedTask?.status === 'pendingVerification' &&
        Boolean(planting.selectedTask.completion) &&
        planting.memberships.some(
            (membership) =>
                !membership.isDeleted && !membership.raisedBedField.isDeleted,
        )
    );
}

export function countPendingPlantingTasks(raisedBeds: readonly Bed[]) {
    return raisedBeds.reduce(
        (count, bed) =>
            count +
            bed.fields.filter((field) => getPendingLegacyPlantCycle(field))
                .length +
            (bed.plantings ?? []).filter((planting) =>
                isPendingSelectedPlanting(bed, planting),
            ).length,
        0,
    );
}
