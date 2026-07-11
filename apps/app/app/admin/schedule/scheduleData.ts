import 'server-only';

import {
    cacheScheduleRead,
    DEFAULT_ADMIN_TIME_ZONE,
    getAllOperations,
    getAllRaisedBeds,
    getDeliveryRequestsSummary,
    getEntitiesFormatted,
    getSetting,
    isAdminGeneralSettingValue,
    SettingsKeys,
    scheduleCacheKeys,
    scheduleCacheTtls,
} from '@gredice/storage';
import { cache } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import {
    getDayDeliveryRequests,
    getScheduledFieldsForDay,
    getScheduledOperationsForDay,
} from './scheduleDayFilters';

const operationsBackDays = 90;

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

function dedupeById<T extends { id: number }>(items: T[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const getScheduleRaisedBeds = cache(async () => {
    return getAllRaisedBeds();
});

export const getSchedulePlantSorts = cache(async () => {
    return getEntitiesFormatted<EntityStandardized>('plantSort');
});

export const getScheduleOperationsData = cache(async () => {
    return getEntitiesFormatted<EntityStandardized>('operation');
});

export const getScheduleTimeZone = cache(async () => {
    const setting = await getSetting(SettingsKeys.AdminGeneral);

    return isAdminGeneralSettingValue(setting?.value)
        ? setting.value.timeZone
        : DEFAULT_ADMIN_TIME_ZONE;
});

export const getScheduleOperations = cache(async () => {
    const from = startOfDaysAgo(operationsBackDays);
    const completedFrom = startOfToday();

    return cacheScheduleRead(
        scheduleCacheKeys.adminActiveOperations(from, completedFrom),
        async () => {
            const [
                newOrScheduledOperations,
                pendingVerificationOperations,
                completedOperationsTodayOrLater,
            ] = await Promise.all([
                getAllOperations({
                    from,
                    status: ['new', 'planned'],
                }),
                getAllOperations({
                    completedFrom: from,
                    status: 'pendingVerification',
                }),
                getAllOperations({
                    completedFrom,
                    status: 'completed',
                }),
            ]);

            const operations = [
                ...newOrScheduledOperations,
                ...pendingVerificationOperations,
                ...completedOperationsTodayOrLater,
            ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            return dedupeById(operations);
        },
        scheduleCacheTtls.operations,
    );
});

export const getScheduleDeliveryRequests = cache(async () => {
    return getDeliveryRequestsSummary();
});

export const getScheduleDayData = cache(
    async (dateKey: string, isToday: boolean) => {
        const timeZone = await getScheduleTimeZone();

        return cacheScheduleRead(
            `${scheduleCacheKeys.adminDay(dateKey, isToday)}:timeZone:${encodeURIComponent(timeZone)}`,
            async () => {
                const date = new Date(dateKey);
                const [raisedBeds, operations, deliveryRequests] =
                    await Promise.all([
                        getScheduleRaisedBeds(),
                        getScheduleOperations(),
                        getScheduleDeliveryRequests(),
                    ]);

                return {
                    raisedBeds,
                    timeZone,
                    scheduledFields: getScheduledFieldsForDay(
                        isToday,
                        date,
                        raisedBeds,
                        timeZone,
                    ),
                    scheduledOperations: getScheduledOperationsForDay(
                        isToday,
                        date,
                        operations,
                        timeZone,
                    ),
                    todaysDeliveryRequests: getDayDeliveryRequests(
                        isToday,
                        date,
                        deliveryRequests,
                        timeZone,
                    ),
                };
            },
            scheduleCacheTtls.day,
        );
    },
);
