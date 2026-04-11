import type { EntityStandardized } from '@gredice/storage';
import type { FarmScheduleDayData } from './scheduleData';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];

export type RaisedBedScheduleGroup = {
    key: string;
    physicalId: string | null;
    raisedBeds: FarmRaisedBed[];
};

function comparePhysicalIds(left: string | null, right: string | null) {
    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
    }

    return left.localeCompare(right, undefined, { numeric: true });
}

export function groupRaisedBedsForSchedule(
    raisedBeds: FarmRaisedBed[],
    affectedRaisedBedIds: number[],
) {
    const affectedRaisedBedIdSet = new Set(affectedRaisedBedIds);
    const groups = new Map<string, RaisedBedScheduleGroup>();

    for (const raisedBed of raisedBeds) {
        if (!affectedRaisedBedIdSet.has(raisedBed.id)) {
            continue;
        }

        const key = [
            raisedBed.physicalId ?? `missing-${raisedBed.id}`,
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
            raisedBeds: [...group.raisedBeds].sort(
                (left, right) => left.id - right.id,
            ),
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

export function formatMinutes(minutes: number) {
    return `${Math.ceil(Math.max(0, minutes))} min`;
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

export const PLANTING_TASK_DURATION_MINUTES = 5;

export function isOperationCompleted(status?: string) {
    return status === 'completed' || status === 'pendingVerification';
}

export function isFieldApproved(status?: string) {
    return status === 'planned';
}

export function isFieldCompleted(status?: string) {
    return status === 'sowed' || status === 'pendingVerification';
}
