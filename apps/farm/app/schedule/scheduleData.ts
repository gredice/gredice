import 'server-only';

import {
    cacheScheduleRead,
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserAcceptedOperations,
    getFarmUserAcceptedOperationsByScheduleRange,
    getFarmUserRaisedBeds,
    getRaisedBedPhotoPreviews,
    scheduleCacheKeys,
    scheduleCacheTtls,
} from '@gredice/storage';
import { cache } from 'react';

const operationsBackDays = 90;
const raisedBedPhotoPreviewImageLimit = 3;
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

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function startOfDaysAgo(days: number) {
    const date = startOfToday();
    date.setDate(date.getDate() - days);
    return date;
}

function getDayRange(date: Date) {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);

    const to = new Date(date);
    to.setHours(23, 59, 59, 999);

    return { from, to };
}

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

function getSelectedDateOperationsForDay(
    date: Date,
    operations: FarmScheduleOperation[],
) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return operations.filter((operation) => {
        if (!SCHEDULE_OPERATION_STATUSES.has(operation.status)) {
            return false;
        }

        if (
            operation.raisedBedId === null &&
            typeof operation.farmId !== 'number'
        ) {
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

        return (
            scheduledDate !== undefined &&
            normalizedDate.toDateString() === scheduledDate.toDateString()
        );
    });
}

function getCarryoverOperationsForToday(
    isToday: boolean,
    date: Date,
    operations: FarmScheduleOperation[],
) {
    if (!isToday) {
        return [];
    }

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return operations.filter((operation) => {
        if (!SCHEDULE_OPERATION_STATUSES.has(operation.status)) {
            return false;
        }

        if (isOperationCompleted(operation.status)) {
            return false;
        }

        if (
            operation.raisedBedId === null &&
            typeof operation.farmId !== 'number'
        ) {
            return false;
        }

        if (!operation.scheduledDate) {
            return true;
        }

        return normalizedDate > new Date(operation.scheduledDate);
    });
}

function sortOperationsNewestFirst(operations: FarmScheduleOperation[]) {
    return operations.sort(
        (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    );
}

export type FarmScheduleRaisedBed = Awaited<
    ReturnType<typeof getFarmUserRaisedBeds>
>[number];
export type FarmScheduleOperation = Awaited<
    ReturnType<typeof getFarmUserAcceptedOperations>
>[number];
export type FarmSchedulePlantingsDayData = {
    raisedBeds: FarmScheduleRaisedBed[];
    scheduledFields: FarmScheduleRaisedBed['fields'];
};
export type FarmScheduleOperationsDayData = {
    raisedBeds: FarmScheduleRaisedBed[];
    scheduledOperations: FarmScheduleOperation[];
};
export type FarmScheduleDayData = FarmSchedulePlantingsDayData &
    FarmScheduleOperationsDayData;
export type FarmScheduleRaisedBedPhotoPreviewImage = {
    src: string;
    alt: string;
};
export type FarmScheduleRaisedBedPhotoPreview = {
    images: FarmScheduleRaisedBedPhotoPreviewImage[];
    photoCount: number;
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

export async function getFarmScheduleRaisedBedPhotoPreviewsForDay(
    dayDataPromise: Promise<FarmScheduleDayData>,
) {
    const dayData = await dayDataPromise;
    const visibleRaisedBedIds = Array.from(
        new Set([
            ...dayData.scheduledFields.map((field) => field.raisedBedId),
            ...dayData.scheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ]),
    ).sort((left, right) => left - right);

    if (visibleRaisedBedIds.length === 0) {
        return new Map<number, FarmScheduleRaisedBedPhotoPreview>();
    }

    const visibleRaisedBedIdSet = new Set(visibleRaisedBedIds);
    const visibleRaisedBeds = dayData.raisedBeds.filter((raisedBed) =>
        visibleRaisedBedIdSet.has(raisedBed.id),
    );
    const previews = await cacheScheduleRead(
        scheduleCacheKeys.farmRaisedBedPhotoPreviews(visibleRaisedBedIds),
        () =>
            getRaisedBedPhotoPreviews(
                visibleRaisedBedIds,
                raisedBedPhotoPreviewImageLimit,
            ),
        scheduleCacheTtls.operations,
    );
    const previewByRaisedBedId = new Map(
        previews.map((preview) => [preview.raisedBedId, preview]),
    );

    return new Map<number, FarmScheduleRaisedBedPhotoPreview>(
        visibleRaisedBeds.map(
            (raisedBed): [number, FarmScheduleRaisedBedPhotoPreview] => {
                const preview = previewByRaisedBedId.get(raisedBed.id);
                const label = raisedBed.physicalId
                    ? `Gr ${raisedBed.physicalId}`
                    : `gredice ${raisedBed.id}`;

                return [
                    raisedBed.id,
                    {
                        images: (preview?.imageUrls ?? []).map(
                            (imageUrl, index) => ({
                                src: imageUrl,
                                alt: `Fotografija ${label} ${index + 1}`,
                            }),
                        ),
                        photoCount: preview?.photoCount ?? 0,
                    },
                ];
            },
        ),
    );
}

export const getFarmScheduleOperations = cache(async (userId: string) => {
    const from = startOfDaysAgo(operationsBackDays);

    return cacheScheduleRead(
        scheduleCacheKeys.farmUserActiveOperations(userId, from),
        async () => {
            const [newOrScheduledOperations, completedOperationsTodayOrLater] =
                await Promise.all([
                    getFarmUserAcceptedOperations(userId, {
                        from,
                        status: ['new', 'planned'],
                    }),
                    getFarmUserAcceptedOperations(userId, {
                        completedFrom: from,
                        status: ['pendingVerification', 'completed'],
                    }),
                ]);

            const operations = [
                ...newOrScheduledOperations,
                ...completedOperationsTodayOrLater,
            ].sort(
                (left, right) =>
                    right.timestamp.getTime() - left.timestamp.getTime(),
            );

            return dedupeById(operations);
        },
        scheduleCacheTtls.operations,
    );
});

export const getFarmScheduleOperationsForDay = cache(
    async (userId: string, dateKey: string, isToday: boolean) => {
        const [selectedDateOperations, carryoverOperations] = await Promise.all(
            [
                getFarmScheduleSelectedDateOperationsForDay(userId, dateKey),
                getFarmScheduleCarryoverOperationsForDay(
                    userId,
                    dateKey,
                    isToday,
                ),
            ],
        );

        return sortOperationsNewestFirst(
            dedupeById([...carryoverOperations, ...selectedDateOperations]),
        );
    },
);

export const getFarmScheduleSelectedDateOperationsForDay = cache(
    async (userId: string, dateKey: string) => {
        const date = new Date(dateKey);
        const { from, to } = getDayRange(date);
        const [scheduledOperations, completedOperations] = await Promise.all([
            getFarmUserAcceptedOperationsByScheduleRange({
                userId,
                from,
                to,
            }),
            getFarmUserAcceptedOperations(userId, {
                completedFrom: from,
                completedTo: to,
                status: ['pendingVerification', 'completed'],
            }),
        ]);

        return getSelectedDateOperationsForDay(
            date,
            sortOperationsNewestFirst(
                dedupeById([...scheduledOperations, ...completedOperations]),
            ),
        );
    },
);

export const getFarmScheduleCarryoverOperationsForDay = cache(
    async (userId: string, dateKey: string, isToday: boolean) => {
        if (!isToday) {
            return [];
        }

        const date = new Date(dateKey);
        const operations = await getFarmScheduleOperations(userId);

        return getCarryoverOperationsForToday(isToday, date, operations);
    },
);

export const getFarmSchedulePlantingsDayData = cache(
    async (
        userId: string,
        dateKey: string,
        isToday: boolean,
    ): Promise<FarmSchedulePlantingsDayData> => {
        const date = new Date(dateKey);
        const raisedBeds = await getFarmScheduleRaisedBeds(userId);

        return {
            raisedBeds,
            scheduledFields: getScheduledFieldsForDay(
                isToday,
                date,
                raisedBeds,
            ),
        };
    },
);

export const getFarmScheduleOperationsDayData = cache(
    async (
        userId: string,
        dateKey: string,
        isToday: boolean,
    ): Promise<FarmScheduleOperationsDayData> => {
        const [raisedBeds, scheduledOperations] = await Promise.all([
            getFarmScheduleRaisedBeds(userId),
            getFarmScheduleOperationsForDay(userId, dateKey, isToday),
        ]);

        return {
            raisedBeds,
            scheduledOperations,
        };
    },
);

export const getFarmScheduleDayData = cache(
    async (
        userId: string,
        dateKey: string,
        isToday: boolean,
    ): Promise<FarmScheduleDayData> => {
        return cacheScheduleRead(
            scheduleCacheKeys.farmUserDay(userId, dateKey, isToday),
            async () => {
                const [plantingsDayData, scheduledOperations] =
                    await Promise.all([
                        getFarmSchedulePlantingsDayData(
                            userId,
                            dateKey,
                            isToday,
                        ),
                        getFarmScheduleOperationsForDay(
                            userId,
                            dateKey,
                            isToday,
                        ),
                    ]);

                return {
                    raisedBeds: plantingsDayData.raisedBeds,
                    scheduledFields: plantingsDayData.scheduledFields,
                    scheduledOperations,
                };
            },
            scheduleCacheTtls.day,
        );
    },
);
