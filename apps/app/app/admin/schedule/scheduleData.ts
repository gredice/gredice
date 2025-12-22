import 'server-only';

import {
    getAllOperations,
    getAllRaisedBeds,
    getDeliveryRequests,
    getEntitiesFormatted,
} from '@gredice/storage';
import { cache } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

const operationsBackDays = 90;

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

export const getScheduleOperations = cache(async () => {
    const [newOrScheduledOperations, completedOperationsTodayOrLater] =
        await Promise.all([
            getAllOperations({
                from: new Date(
                    new Date().setDate(
                        new Date().getDate() - operationsBackDays,
                    ),
                ),
                status: ['new', 'planned'],
            }),
            getAllOperations({
                completedFrom: new Date(new Date().setHours(0, 0, 0, 0)),
                status: 'completed',
            }),
        ]);

    const operations = [
        ...newOrScheduledOperations,
        ...completedOperationsTodayOrLater,
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return dedupeById(operations);
});

export const getScheduleDeliveryRequests = cache(async () => {
    return getDeliveryRequests();
});
