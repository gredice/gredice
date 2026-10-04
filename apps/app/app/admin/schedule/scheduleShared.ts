import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { getScheduleDateKey } from './scheduleTimeZone';
import type { RaisedBed } from './types';

export type RaisedBedScheduleGroup = {
    key: string;
    physicalId: string;
    raisedBeds: RaisedBed[];
};

function comparePhysicalIds(left: string, right: string) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
    }

    return left.localeCompare(right, undefined, { numeric: true });
}

export function groupRaisedBedsForSchedule(
    raisedBeds: RaisedBed[],
    affectedRaisedBedIds: number[],
) {
    const affectedRaisedBedIdSet = new Set(affectedRaisedBedIds);
    const groups = new Map<string, RaisedBedScheduleGroup>();

    for (const raisedBed of raisedBeds) {
        if (
            !raisedBed.physicalId ||
            !affectedRaisedBedIdSet.has(raisedBed.id)
        ) {
            continue;
        }

        const key = [
            raisedBed.physicalId,
            raisedBed.gardenId ?? 'garden:null',
            raisedBed.accountId ?? 'account:null',
        ].join('|');
        const existingGroup = groups.get(key);

        if (existingGroup) {
            existingGroup.raisedBeds.push(raisedBed);
        } else {
            groups.set(key, {
                key,
                physicalId: raisedBed.physicalId,
                raisedBeds: [raisedBed],
            });
        }
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            raisedBeds: [...group.raisedBeds].sort((a, b) => a.id - b.id),
        }))
        .sort((left, right) => {
            const physicalIdComparison = comparePhysicalIds(
                left.physicalId,
                right.physicalId,
            );
            if (physicalIdComparison !== 0) {
                return physicalIdComparison;
            }

            return (
                (left.raisedBeds[0]?.id ?? 0) - (right.raisedBeds[0]?.id ?? 0)
            );
        });
}

export const PLANTING_TASK_DURATION_MINUTES = 5;

export const FIELD_STATUSES_TO_INCLUDE = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'blocked',
]);
export const FIELD_COMPLETED_STATUSES = new Set(['sowed']);
export const OPERATION_STATUSES_TO_INCLUDE = new Set([
    'new',
    'planned',
    'pendingVerification',
    'completed',
    'blocked',
    'canceled',
    'cancelled',
]);

export function isFieldApproved(status?: string) {
    return status === 'planned';
}

export function isFieldCompleted(status?: string) {
    if (!status) {
        return false;
    }

    return FIELD_COMPLETED_STATUSES.has(status);
}

export function isFieldPendingVerification(status?: string) {
    return status === 'pendingVerification';
}

export function isFieldBlocked(status?: string) {
    return status === 'blocked';
}

export function isOperationCompleted(status?: string) {
    return status === 'completed';
}

export function isOperationPendingVerification(status?: string) {
    return status === 'pendingVerification';
}

export function isOperationBlocked(status?: string) {
    return status === 'blocked';
}

export function isOperationCancelled(status?: string) {
    return status === 'canceled' || status === 'cancelled';
}

const recoverableOperationTaskStatuses = new Set([
    'new',
    'planned',
    'failed',
    'blocked',
]);
const directlyEditableOperationTaskStatuses = new Set([
    'new',
    'planned',
    'failed',
]);
const recoverablePlantingTaskStatuses = new Set(['new', 'planned', 'blocked']);

export function canRescheduleOperationTask(status?: string | null) {
    return Boolean(status && recoverableOperationTaskStatuses.has(status));
}

export function canAcceptOperationTask(status?: string | null) {
    return status === 'new' || status === 'planned';
}

export function canCancelOperationTask(status?: string | null) {
    return Boolean(status && recoverableOperationTaskStatuses.has(status));
}

export function canSwitchOperationTaskEntity(status?: string | null) {
    return Boolean(status && directlyEditableOperationTaskStatuses.has(status));
}

export function canUnacceptOperationTask(status?: string | null) {
    return Boolean(status && directlyEditableOperationTaskStatuses.has(status));
}

export function canAcceptPlantingTask(status?: string | null) {
    return status === 'new' || status === 'planned';
}

export function canSwitchPlantingTaskSort(status?: string | null) {
    return status === 'new' || status === 'planned';
}

export function canReschedulePlantingTask(status?: string | null) {
    return Boolean(status && recoverablePlantingTaskStatuses.has(status));
}

export function canCancelPlantingTask(status?: string | null) {
    return Boolean(status && recoverablePlantingTaskStatuses.has(status));
}

const plantingTaskEvidenceStatuses = new Set([
    'blocked',
    'pendingVerification',
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'notSprouted',
    'died',
    'ready',
    'harvested',
    'removed',
]);

export function canUpdatePlantingTaskStatus(
    currentStatus?: string | null,
    nextStatus?: string | null,
) {
    if (!currentStatus || !nextStatus) {
        return false;
    }
    if (currentStatus === nextStatus) {
        return true;
    }
    if (nextStatus === 'blocked' || nextStatus === 'pendingVerification') {
        return false;
    }
    if (
        plantingTaskEvidenceStatuses.has(currentStatus) &&
        (nextStatus === 'new' || nextStatus === 'planned')
    ) {
        return false;
    }
    if (currentStatus === 'blocked') {
        return false;
    }

    return true;
}

export function activePlantCycleEventId(field: {
    plantCycles?: Array<{
        active: boolean;
        plantPlaceEventId: number;
        endedEventId: number;
    }>;
}) {
    return field.plantCycles?.find((cycle) => cycle.active)?.plantPlaceEventId;
}

export function activePlantCycleVersionEventId(field: {
    plantCycles?: Array<{ active: boolean; endedEventId: number }>;
}) {
    return field.plantCycles?.find((cycle) => cycle.active)?.endedEventId;
}

export function formatMinutes(minutes: number, hideUnit = false) {
    const rounded = Math.ceil(Math.max(0, minutes));
    return hideUnit ? `${rounded}` : `${rounded} min`;
}

export function getScheduleTaskRowClassName({
    pendingAcceptance,
}: {
    accepted: boolean;
    pendingAcceptance: boolean;
}) {
    if (pendingAcceptance) {
        return 'min-w-0 flex-nowrap rounded bg-amber-50/80 text-foreground ring-1 ring-inset ring-amber-200/70 hover:bg-amber-100/80 md:px-2 md:py-1 dark:bg-amber-950/40 dark:ring-amber-900/70 dark:hover:bg-amber-950/60';
    }

    return 'min-w-0 flex-nowrap rounded hover:bg-muted md:px-2 md:py-1';
}

export function isSameScheduleDay(
    left: Date | string | null | undefined,
    rightDateKey: string,
    timeZone: string,
) {
    if (!left) {
        return false;
    }

    const leftDate = typeof left === 'string' ? new Date(left) : left;

    if (!Number.isFinite(leftDate.getTime())) {
        return false;
    }

    return getScheduleDateKey(leftDate, timeZone) === rightDateKey;
}

export function isTaskDateBeforeToday(date: Date | undefined) {
    if (!date) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    return Number.isFinite(taskDate.getTime()) && taskDate < today;
}

export function getOperationDurationMinutes(
    operationData: EntityStandardized | undefined,
) {
    if (!operationData) {
        return 0;
    }

    const durationValue = (
        operationData as { attributes?: { duration?: unknown } }
    )?.attributes?.duration;

    if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
        return Math.max(durationValue, 0);
    }

    if (typeof durationValue === 'string') {
        const parsed = Number.parseFloat(durationValue);
        if (Number.isFinite(parsed)) {
            return Math.max(parsed, 0);
        }
    }

    return 0;
}
