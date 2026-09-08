import type { RaisedBedFieldWithEvents } from '../repositories/raisedBedFieldsRepo';
import type { RaisedBedPlantingWithFields } from '../repositories/raisedBedPlantingsRepo';

export type RaisedBedPlantOccupancy = Pick<
    RaisedBedFieldWithEvents,
    | 'plantStatus'
    | 'sowingLocation'
    | 'plantScheduledDate'
    | 'plantSowDate'
    | 'plantGrowthDate'
    | 'plantReadyDate'
    | 'plantHarvestedDate'
    | 'plantDeadDate'
    | 'plantRemovedDate'
> & {
    key: string;
    plantSortId: number;
    positionIndex: number;
    positionNumbers: number[];
    legacyField: RaisedBedFieldWithEvents | null;
    planting: RaisedBedPlantingWithFields | null;
};

/** Display-only occupancy. Never substitute these rows for legacy mutation targets. */
export function getRaisedBedPlantOccupancy(raisedBed: {
    fields: readonly RaisedBedFieldWithEvents[];
    plantings: readonly RaisedBedPlantingWithFields[];
}): RaisedBedPlantOccupancy[] {
    const rows: RaisedBedPlantOccupancy[] = [];
    for (const field of raisedBed.fields) {
        if (
            !field.active ||
            field.isDeleted ||
            typeof field.plantSortId !== 'number'
        )
            continue;
        rows.push({
            key: `field-${field.id}`,
            plantSortId: field.plantSortId,
            positionIndex: field.positionIndex,
            positionNumbers: [field.positionIndex + 1],
            plantStatus: field.plantStatus,
            sowingLocation: field.sowingLocation,
            plantScheduledDate: field.plantScheduledDate,
            plantSowDate: field.plantSowDate,
            plantGrowthDate: field.plantGrowthDate,
            plantReadyDate: field.plantReadyDate,
            plantHarvestedDate: field.plantHarvestedDate,
            plantDeadDate: field.plantDeadDate,
            plantRemovedDate: field.plantRemovedDate,
            legacyField: field,
            planting: null,
        });
    }
    for (const planting of raisedBed.plantings) {
        // Legacy projections are already represented by the event-derived fields.
        if (
            planting.configurationSource !== 'selected' ||
            !planting.isActive ||
            planting.isDeleted
        )
            continue;
        const positions = [
            ...new Set(
                planting.memberships
                    .filter(
                        (membership) =>
                            !membership.isDeleted &&
                            !membership.raisedBedField.isDeleted,
                    )
                    .map(
                        (membership) => membership.raisedBedField.positionIndex,
                    ),
            ),
        ].sort((a, b) => a - b);
        const positionIndex = positions[0];
        if (positionIndex === undefined) continue;
        const dates: Pick<
            RaisedBedPlantOccupancy,
            | 'plantSowDate'
            | 'plantGrowthDate'
            | 'plantReadyDate'
            | 'plantHarvestedDate'
            | 'plantDeadDate'
            | 'plantRemovedDate'
        > = {
            plantSowDate: undefined,
            plantGrowthDate: undefined,
            plantReadyDate: undefined,
            plantDeadDate: undefined,
            plantHarvestedDate: undefined,
            plantRemovedDate: undefined,
        };
        for (const change of planting.lifecycleStatusChanges) {
            const status = change.status;
            if (
                [
                    'planned',
                    'pendingVerification',
                    'sowed',
                    'sprouted',
                    'firstFlowers',
                    'firstFruitSet',
                    'ready',
                ].includes(status)
            ) {
                dates.plantDeadDate = undefined;
                dates.plantHarvestedDate = undefined;
                dates.plantRemovedDate = undefined;
                if (status !== 'ready') dates.plantReadyDate = undefined;
            }
            if (status === 'planned') {
                dates.plantSowDate = undefined;
                dates.plantGrowthDate = undefined;
            } else if (status === 'sowed' || status === 'pendingVerification') {
                dates.plantSowDate ??= change.occurredAt;
                dates.plantGrowthDate = undefined;
            } else if (status === 'sprouted')
                dates.plantGrowthDate = change.occurredAt;
            else if (status === 'firstFlowers' || status === 'firstFruitSet')
                dates.plantGrowthDate ??= change.occurredAt;
            else if (status === 'ready')
                dates.plantReadyDate = change.occurredAt;
            else if (status === 'died' || status === 'notSprouted')
                dates.plantDeadDate = change.occurredAt;
            else if (status === 'harvested')
                dates.plantHarvestedDate = change.occurredAt;
            else if (status === 'removed')
                dates.plantRemovedDate = change.occurredAt;
        }
        const scheduledDate = planting.selectedTask?.scheduledDate;
        rows.push({
            key: `planting-${planting.id}`,
            plantSortId: planting.plantSortId,
            positionIndex,
            positionNumbers: positions.map((position) => position + 1),
            plantStatus: planting.lifecycleStatus ?? undefined,
            sowingLocation: planting.selectedTask?.sowingLocation ?? 'direct',
            plantScheduledDate: scheduledDate
                ? new Date(scheduledDate)
                : undefined,
            ...dates,
            plantSowDate: dates.plantSowDate
                ? (planting.selectedTask?.completion?.completedAt ??
                  dates.plantSowDate)
                : undefined,
            legacyField: null,
            planting,
        });
    }
    return rows.sort(
        (left, right) =>
            left.positionIndex - right.positionIndex ||
            left.key.localeCompare(right.key),
    );
}

const greenhouseStatuses = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

export function isRaisedBedPlantInGreenhouse(plant: RaisedBedPlantOccupancy) {
    return (
        plant.sowingLocation === 'greenhouse' &&
        greenhouseStatuses.has(plant.plantStatus ?? '') &&
        !plant.plantDeadDate &&
        !plant.plantHarvestedDate &&
        !plant.plantRemovedDate
    );
}
