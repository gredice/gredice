import type {
    RaisedBedPlantingWithFields,
    SelectedRaisedBedPlantingTaskReadModel,
} from '@gredice/storage';
import { getFarmScheduleDateKey } from './scheduleShared';
import {
    getSelectedPlantingTaskState,
    isActionableTaskState,
    isBlockedTaskState,
    isCompletedTaskState,
    isPendingTaskState,
} from './scheduleTaskState';

type ScheduleDate = Date | string | null | undefined;

type SelectedPlantingScheduleTask = Pick<
    SelectedRaisedBedPlantingTaskReadModel,
    'block' | 'completion' | 'scheduledDate' | 'status'
>;

export type SelectedPlantingScheduleSource = {
    configurationSource: RaisedBedPlantingWithFields['configurationSource'];
    selectedTask: SelectedPlantingScheduleTask | null;
};

export type FarmScheduleSelectedPlanting<
    TPlanting extends
        SelectedPlantingScheduleSource = RaisedBedPlantingWithFields,
> = {
    planting: TPlanting;
    raisedBedId: number;
};

type FarmScheduleSelectedPlantingRaisedBed<
    TPlanting extends SelectedPlantingScheduleSource,
> = {
    id: number;
    physicalId?: string | null;
    plantings: readonly TPlanting[];
    status?: string | null;
};

function getDateKey(date: ScheduleDate) {
    if (!date) {
        return undefined;
    }

    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    return Number.isFinite(parsedDate.getTime())
        ? getFarmScheduleDateKey(parsedDate)
        : undefined;
}

/**
 * Selects one schedule item per persisted selected planting. Membership rows
 * and the snapshotted plant count never multiply task quantity or duration.
 */
export function getScheduledSelectedPlantingsForDay<
    TPlanting extends SelectedPlantingScheduleSource,
>(
    isToday: boolean,
    dateKey: string,
    raisedBeds: readonly FarmScheduleSelectedPlantingRaisedBed<TPlanting>[],
): FarmScheduleSelectedPlanting<TPlanting>[] {
    return raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((raisedBed) =>
            raisedBed.plantings.flatMap((planting) => {
                const task = planting.selectedTask;
                if (
                    planting.configurationSource !== 'selected' ||
                    !task ||
                    task.status === 'cancelled'
                ) {
                    return [];
                }

                const state = getSelectedPlantingTaskState(task.status);
                if (
                    raisedBed.status === 'abandoned' &&
                    isActionableTaskState(state)
                ) {
                    return [];
                }

                let visible = false;
                if (isBlockedTaskState(state)) {
                    visible =
                        (getDateKey(task.block?.blockedAt) ??
                            getDateKey(task.scheduledDate)) === dateKey;
                } else if (
                    isPendingTaskState(state) ||
                    isCompletedTaskState(state)
                ) {
                    visible =
                        getDateKey(task.completion?.completedAt) === dateKey;
                } else {
                    const scheduledDateKey = getDateKey(task.scheduledDate);
                    visible = scheduledDateKey
                        ? scheduledDateKey === dateKey ||
                          (isToday && scheduledDateKey < dateKey)
                        : isToday;
                }

                return visible ? [{ planting, raisedBedId: raisedBed.id }] : [];
            }),
        );
}
