import 'server-only';

import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserAcceptedOperations,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { cache } from 'react';

const operationsBackDays = 90;
const SCHEDULE_FIELD_STATUSES = new Set([
    'planned',
    'pendingVerification',
    'sowed',
]);
const SCHEDULE_OPERATION_STATUSES = new Set([
    'new',
    'planned',
    'pendingVerification',
    'completed',
]);

function dedupeById<T extends { id: number }>(items: T[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function isOperationCompleted(status?: string) {
    return status === 'completed' || status === 'pendingVerification';
}

function isFieldCompleted(status?: string) {
    return status === 'sowed' || status === 'pendingVerification';
}

function getScheduledFieldsForDay(
    isToday: boolean,
    date: Date,
    raisedBeds: FarmScheduleRaisedBed[],
) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((raisedBed) => raisedBed.fields)
        .filter((field) => {
            if (!field.plantSortId) {
                return false;
            }

            if (!SCHEDULE_FIELD_STATUSES.has(field.plantStatus ?? 'new')) {
                return false;
            }

            if (isFieldCompleted(field.plantStatus) && field.plantSowDate) {
                const sowDate = new Date(field.plantSowDate);
                return sowDate.toDateString() === normalizedDate.toDateString();
            }

            if (!field.plantScheduledDate) {
                return isToday;
            }

            const scheduledDate = new Date(field.plantScheduledDate);

            return (
                normalizedDate.toDateString() ===
                    scheduledDate.toDateString() ||
                (isToday && normalizedDate > scheduledDate)
            );
        });
}

function getScheduledOperationsForDay(
    isToday: boolean,
    date: Date,
    operations: FarmScheduleOperation[],
) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return operations.filter((operation) => {
        if (!SCHEDULE_OPERATION_STATUSES.has(operation.status)) {
            return false;
        }

        if (operation.raisedBedId === null) {
            return false;
        }

        if (isOperationCompleted(operation.status) && operation.completedAt) {
            const completedDate = new Date(operation.completedAt);
            return (
                completedDate.toDateString() === normalizedDate.toDateString()
            );
        }

        const scheduledDate = operation.scheduledDate
            ? new Date(operation.scheduledDate)
            : undefined;
        const sameDay =
            scheduledDate !== undefined &&
            normalizedDate.toDateString() === scheduledDate.toDateString();
        const isUnscheduledToday = scheduledDate === undefined && isToday;
        const isOverdueToday =
            scheduledDate !== undefined &&
            isToday &&
            normalizedDate > scheduledDate &&
            !isOperationCompleted(operation.status);

        return sameDay || isUnscheduledToday || isOverdueToday;
    });
}

export type FarmScheduleRaisedBed = Awaited<
    ReturnType<typeof getFarmUserRaisedBeds>
>[number];
export type FarmScheduleOperation = Awaited<
    ReturnType<typeof getFarmUserAcceptedOperations>
>[number];
export type FarmScheduleDayData = {
    raisedBeds: FarmScheduleRaisedBed[];
    scheduledFields: FarmScheduleRaisedBed['fields'];
    scheduledOperations: FarmScheduleOperation[];
};

export const getFarmScheduleRaisedBeds = cache(async (userId: string) => {
    return getFarmUserRaisedBeds(userId);
});

export const getFarmSchedulePlantSorts = cache(async () => {
    return getEntitiesFormatted<EntityStandardized>('plantSort');
});

export const getFarmScheduleOperationsData = cache(async () => {
    return getEntitiesFormatted<EntityStandardized>('operation');
});

export const getFarmScheduleOperations = cache(async (userId: string) => {
    const [newOrScheduledOperations, completedOperationsTodayOrLater] =
        await Promise.all([
            getFarmUserAcceptedOperations(userId, {
                from: new Date(
                    new Date().setDate(
                        new Date().getDate() - operationsBackDays,
                    ),
                ),
                status: ['new', 'planned'],
            }),
            getFarmUserAcceptedOperations(userId, {
                completedFrom: new Date(
                    new Date().setDate(
                        new Date().getDate() - operationsBackDays,
                    ),
                ),
                status: ['pendingVerification', 'completed'],
            }),
        ]);

    const operations = [
        ...newOrScheduledOperations,
        ...completedOperationsTodayOrLater,
    ].sort(
        (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    );

    return dedupeById(operations);
});

export const getFarmScheduleDayData = cache(
    async (
        userId: string,
        dateKey: string,
        isToday: boolean,
    ): Promise<FarmScheduleDayData> => {
        const date = new Date(dateKey);
        const [raisedBeds, operations] = await Promise.all([
            getFarmScheduleRaisedBeds(userId),
            getFarmScheduleOperations(userId),
        ]);

        return {
            raisedBeds,
            scheduledFields: getScheduledFieldsForDay(
                isToday,
                date,
                raisedBeds,
            ),
            scheduledOperations: getScheduledOperationsForDay(
                isToday,
                date,
                operations,
            ),
        };
    },
);
