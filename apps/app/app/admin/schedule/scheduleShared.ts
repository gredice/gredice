import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
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
]);
export const FIELD_COMPLETED_STATUSES = new Set(['sowed']);
export const OPERATION_STATUSES_TO_INCLUDE = new Set([
    'new',
    'planned',
    'pendingVerification',
    'completed',
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

export function isOperationCompleted(status?: string) {
    return status === 'completed';
}

export function isOperationPendingVerification(status?: string) {
    return status === 'pendingVerification';
}

export function isOperationCancelled(status?: string) {
    return status === 'canceled' || status === 'cancelled';
}

export function formatMinutes(minutes: number, hideUnit = false) {
    const rounded = Math.ceil(Math.max(0, minutes));
    return hideUnit ? `${rounded}` : `${rounded} min`;
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
