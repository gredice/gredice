import 'server-only';

import {
    addCalendarDays,
    cacheScheduleRead,
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserAcceptedOperations,
    getFarmUserAcceptedOperationsByScheduleRange,
    getFarmUserPendingVerificationOperations,
    getFarmUserRaisedBeds,
    getRaisedBedPhotoPreviews,
    getTimeZoneDateKey,
    getTimeZoneDayRange,
    scheduleCacheKeys,
    scheduleCacheTtls,
} from '@gredice/storage';
import { cache } from 'react';
import {
    getCarryoverOperationsForToday,
    getScheduledFieldsForDay,
    getSelectedDateOperationsForDay,
} from './scheduleDayFilters';
import { FARM_SCHEDULE_TIME_ZONE } from './scheduleShared';

const operationsBackDays = 90;
const raisedBedPhotoPreviewImageLimit = 3;

function startOfDaysAgo(days: number) {
    const todayKey = getTimeZoneDateKey(new Date(), FARM_SCHEDULE_TIME_ZONE);
    return getTimeZoneDayRange(
        addCalendarDays(todayKey, -days),
        FARM_SCHEDULE_TIME_ZONE,
    ).from;
}

function dedupeById<T extends { id: number }>(items: T[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
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

export const getFarmSchedulePendingOperations = cache(async (userId: string) =>
    getFarmUserPendingVerificationOperations(userId),
);

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
        const { from, to } = getTimeZoneDayRange(
            dateKey,
            FARM_SCHEDULE_TIME_ZONE,
        );
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
            dateKey,
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

        const operations = await getFarmScheduleOperations(userId);

        return getCarryoverOperationsForToday(isToday, dateKey, operations);
    },
);

export const getFarmSchedulePlantingsDayData = cache(
    async (
        userId: string,
        dateKey: string,
        isToday: boolean,
    ): Promise<FarmSchedulePlantingsDayData> => {
        const raisedBeds = await getFarmScheduleRaisedBeds(userId);

        return {
            raisedBeds,
            scheduledFields: getScheduledFieldsForDay(
                isToday,
                dateKey,
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
