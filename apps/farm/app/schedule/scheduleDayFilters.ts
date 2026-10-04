import type { OperationStatus } from '@gredice/storage';
import { getFarmScheduleDateKey } from './scheduleShared';
import {
    getOperationTaskState,
    getPlantingTaskState,
    isActionableTaskState,
    isBlockedTaskState,
    isCompletedTaskState,
    isPendingTaskState,
} from './scheduleTaskState';

type ScheduleDate = Date | string | null | undefined;

type ScheduleField = {
    blockedAt?: ScheduleDate;
    plantScheduledDate?: ScheduleDate;
    plantSortId?: number | null;
    plantSowDate?: ScheduleDate;
    plantStatus?: string | null;
};

type ScheduleRaisedBed<TField extends ScheduleField> = {
    fields: TField[];
    physicalId?: string | null;
    status?: string | null;
};

type ScheduleOperation = {
    blockedAt?: ScheduleDate;
    completedAt?: ScheduleDate;
    farmId?: number | null;
    raisedBedId?: number | null;
    scheduledDate?: ScheduleDate;
    status?: OperationStatus | null;
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

function hasScheduleLocation(operation: ScheduleOperation) {
    return (
        typeof operation.raisedBedId === 'number' ||
        typeof operation.farmId === 'number'
    );
}

/**
 * Selects planting tasks for a calendar day. Submitted and verified sowing is
 * historical and follows its actual sow date without becoming carryover work.
 */
export function getScheduledFieldsForDay<TField extends ScheduleField>(
    isToday: boolean,
    dateKey: string,
    raisedBeds: ScheduleRaisedBed<TField>[],
) {
    return raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((raisedBed) =>
            raisedBed.fields.filter((field) => {
                const taskState = getPlantingTaskState(field.plantStatus);
                return (
                    raisedBed.status !== 'abandoned' ||
                    !isActionableTaskState(taskState)
                );
            }),
        )
        .filter((field) => {
            if (!field.plantSortId) {
                return false;
            }

            const taskState = getPlantingTaskState(field.plantStatus);

            if (!taskState) {
                return false;
            }

            const sowDateKey = getDateKey(field.plantSowDate);

            if (isBlockedTaskState(taskState)) {
                const blockedDateKey = getDateKey(field.blockedAt);
                return (
                    (blockedDateKey ?? getDateKey(field.plantScheduledDate)) ===
                    dateKey
                );
            }

            if (
                (isPendingTaskState(taskState) ||
                    isCompletedTaskState(taskState)) &&
                sowDateKey
            ) {
                return sowDateKey === dateKey;
            }

            const scheduledDateKey = getDateKey(field.plantScheduledDate);

            if (!scheduledDateKey) {
                return isToday;
            }

            return (
                scheduledDateKey === dateKey ||
                (isToday && scheduledDateKey < dateKey)
            );
        });
}

export function filterUnavailableRaisedBedOperations<
    TOperation extends ScheduleOperation,
>(
    operations: TOperation[],
    raisedBeds: { id: number; status?: string | null }[],
) {
    const abandonedRaisedBedIds = new Set(
        raisedBeds
            .filter((raisedBed) => raisedBed.status === 'abandoned')
            .map((raisedBed) => raisedBed.id),
    );

    return operations.filter((operation) => {
        if (
            typeof operation.raisedBedId !== 'number' ||
            !abandonedRaisedBedIds.has(operation.raisedBedId) ||
            !operation.status
        ) {
            return true;
        }

        return !isActionableTaskState(getOperationTaskState(operation.status));
    });
}

/**
 * Selects operations for the requested calendar date. Submitted and verified
 * work follows the actual completion date; actionable work follows its planned
 * date. Carryover into Today is handled separately so the range queries remain
 * bounded to the requested date.
 */
export function getSelectedDateOperationsForDay<
    TOperation extends ScheduleOperation,
>(dateKey: string, operations: TOperation[]) {
    return operations.filter((operation) => {
        if (!operation.status) {
            return false;
        }

        if (!hasScheduleLocation(operation)) {
            return false;
        }

        const taskState = getOperationTaskState(operation.status);

        if (isBlockedTaskState(taskState)) {
            return (
                (getDateKey(operation.blockedAt) ??
                    getDateKey(operation.scheduledDate)) === dateKey
            );
        }

        if (
            !isActionableTaskState(taskState) &&
            !isPendingTaskState(taskState) &&
            !isCompletedTaskState(taskState)
        ) {
            return false;
        }

        if (isPendingTaskState(taskState) || isCompletedTaskState(taskState)) {
            const completedDateKey = getDateKey(operation.completedAt);
            if (completedDateKey) {
                return completedDateKey === dateKey;
            }
        }

        return getDateKey(operation.scheduledDate) === dateKey;
    });
}

/**
 * Carries unfinished actionable work into Today. Pending verification,
 * verified, failed, and canceled work never becomes an overdue task.
 */
export function getCarryoverOperationsForToday<
    TOperation extends ScheduleOperation,
>(isToday: boolean, dateKey: string, operations: TOperation[]) {
    if (!isToday) {
        return [];
    }

    return operations.filter((operation) => {
        if (!operation.status) {
            return false;
        }

        if (!hasScheduleLocation(operation)) {
            return false;
        }

        const taskState = getOperationTaskState(operation.status);

        if (!isActionableTaskState(taskState)) {
            return false;
        }

        const scheduledDateKey = getDateKey(operation.scheduledDate);
        return !scheduledDateKey || scheduledDateKey < dateKey;
    });
}
