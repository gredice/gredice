import type { EntityStandardized } from '@gredice/storage';
import type { FarmScheduleDayData } from './scheduleData';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmRaisedBedField = FarmRaisedBed['fields'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];
type ScheduleTaskAgeIndicatorLevel = 'warning' | 'critical';

export type FarmScheduleOperationsMode = 'all' | 'watering' | 'withoutWatering';

const RAISED_BED_FIELDS_PER_BLOCK = 9;
export const FARM_SCHEDULE_TIME_ZONE = 'Europe/Zagreb';

export type RaisedBedScheduleGroup = {
    key: string;
    physicalId: string | null;
    raisedBeds: FarmRaisedBed[];
};

export type ScheduleTaskAgeIndicator = {
    level: ScheduleTaskAgeIndicatorLevel;
    label: string;
    title: string;
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const WARNING_TASK_AGE_DAYS = 2;
const CRITICAL_TASK_AGE_DAYS = 3;

export function getFarmScheduleDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: FARM_SCHEDULE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
}

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

export function getScheduleDateFormat(
    scheduledDate: Date | string | null | undefined,
    referenceDate = new Date(),
): Intl.DateTimeFormatOptions {
    const parsedScheduledDate = parseScheduleDate(scheduledDate);
    const scheduledYear = parsedScheduledDate
        ? getFarmScheduleDateKey(parsedScheduledDate).slice(0, 4)
        : null;
    const referenceYear = getFarmScheduleDateKey(referenceDate).slice(0, 4);
    const includeYear = !parsedScheduledDate || scheduledYear !== referenceYear;

    return includeYear
        ? {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: FARM_SCHEDULE_TIME_ZONE,
          }
        : {
              day: '2-digit',
              month: '2-digit',
              timeZone: FARM_SCHEDULE_TIME_ZONE,
          };
}

export function isScheduleDatePast(
    scheduledDate: Date | string | null | undefined,
    referenceDate = new Date(),
) {
    const parsedScheduledDate = parseScheduleDate(scheduledDate);
    if (!parsedScheduledDate) {
        return false;
    }

    return (
        getLocalDayNumber(parsedScheduledDate) <
        getLocalDayNumber(referenceDate)
    );
}

function getScheduleDateSortValue(date: Date | string | null | undefined) {
    const parsedDate = parseScheduleDate(date);

    return parsedDate
        ? getLocalDayNumber(parsedDate)
        : Number.POSITIVE_INFINITY;
}

export function compareScheduleDates(
    left: Date | string | null | undefined,
    right: Date | string | null | undefined,
) {
    return getScheduleDateSortValue(left) - getScheduleDateSortValue(right);
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

export function isWateringOperationData(
    operationData: EntityStandardized | undefined,
) {
    return operationData?.attributes?.visualReward === 'watering';
}

export function isGroupedWateringScheduleOperation(
    operation: Pick<FarmOperation, 'raisedBedId'>,
    operationData: EntityStandardized | undefined,
) {
    return (
        operation.raisedBedId !== null && isWateringOperationData(operationData)
    );
}

export function shouldDisplayScheduleOperation(
    operation: Pick<FarmOperation, 'raisedBedId'>,
    operationData: EntityStandardized | undefined,
    mode: FarmScheduleOperationsMode,
) {
    const isGroupedWatering = isGroupedWateringScheduleOperation(
        operation,
        operationData,
    );

    if (mode === 'watering') {
        return isGroupedWatering;
    }

    if (mode === 'withoutWatering') {
        return !isGroupedWatering;
    }

    return true;
}

export const PLANTING_TASK_DURATION_MINUTES = 5;

export function getFieldPhysicalPositionIndex(
    field: Pick<FarmRaisedBedField, 'positionIndex' | 'raisedBedId'>,
    raisedBeds: FarmRaisedBed[],
) {
    const raisedBedIndex = [...raisedBeds]
        .sort((left, right) => left.id - right.id)
        .findIndex((raisedBed) => raisedBed.id === field.raisedBedId);

    return (
        field.positionIndex +
        1 +
        Math.max(raisedBedIndex, 0) * RAISED_BED_FIELDS_PER_BLOCK
    );
}

function getLocalDayNumber(date: Date) {
    const [year, month, day] = getFarmScheduleDateKey(date)
        .split('-')
        .map(Number);

    return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY;
}

function parseScheduleDate(date: Date | string | null | undefined) {
    if (!date) {
        return null;
    }

    const parsedDate = typeof date === 'string' ? new Date(date) : date;

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatTaskAgeDays(days: number) {
    const dayLabel = days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana';
    return `${days} ${dayLabel}`;
}

export function getScheduleTaskAgeIndicator(
    scheduledDate: Date | string | null | undefined,
    referenceDate = new Date(),
): ScheduleTaskAgeIndicator | null {
    const parsedScheduledDate = parseScheduleDate(scheduledDate);
    if (!parsedScheduledDate) {
        return null;
    }

    const ageDays =
        getLocalDayNumber(referenceDate) -
        getLocalDayNumber(parsedScheduledDate);
    const formattedAgeDays = formatTaskAgeDays(ageDays);

    if (ageDays >= CRITICAL_TASK_AGE_DAYS) {
        return {
            level: 'critical',
            label: `Kritično ${formattedAgeDays}`,
            title: `Zadatak kasni ${formattedAgeDays} prema planiranom datumu.`,
        };
    }

    if (ageDays >= WARNING_TASK_AGE_DAYS) {
        return {
            level: 'warning',
            label: `Kasni ${formattedAgeDays}`,
            title: `Zadatak kasni ${formattedAgeDays} prema planiranom datumu.`,
        };
    }

    return null;
}

export function isOperationCompleted(status?: string) {
    return status === 'completed' || status === 'pendingVerification';
}

export function isFieldApproved(status?: string) {
    return status === 'planned';
}

export function isFieldCompleted(status?: string) {
    return status === 'sowed' || status === 'pendingVerification';
}
