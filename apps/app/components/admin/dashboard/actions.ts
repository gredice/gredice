'use server';

import {
    getAllOperations,
    getAnalyticsTotals,
    getAdventCalendarTopUsers,
    getEntitiesFormatted,
    getEntitiesRaw,
    getEntityTypes,
    getPlantUpdateEvents,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

type OperationsDurationPoint = {
    date: string;
    operationsMinutes: number;
    sowingMinutes: number;
    totalMinutes: number;
};

type OperationsDurationData = {
    totalMinutes: number;
    operationsMinutes: number;
    sowingMinutes: number;
    daily: OperationsDurationPoint[];
};

const PLANT_SOWING_DURATION_MINUTES = 5;

function toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDuration(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
            return Math.max(0, parsed);
        }
    }
    return 0;
}

function createDurationBuckets(startDate: Date, days: number) {
    const dateKeys: string[] = [];
    const operationsTotals = new Map<string, number>();
    const sowingTotals = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + i);
        const key = toDateKey(current);
        dateKeys.push(key);
        operationsTotals.set(key, 0);
        sowingTotals.set(key, 0);
    }

    return {
        dateKeys,
        operationsTotals,
        sowingTotals,
    };
}

function formatOperationsDurationData(
    dateKeys: string[],
    operationsTotals: Map<string, number>,
    sowingTotals: Map<string, number>,
): OperationsDurationData {
    const daily = dateKeys.map((date) => ({
        date,
        operationsMinutes: operationsTotals.get(date) ?? 0,
        sowingMinutes: sowingTotals.get(date) ?? 0,
        totalMinutes:
            (operationsTotals.get(date) ?? 0) + (sowingTotals.get(date) ?? 0),
    }));
    const operationsMinutes = daily.reduce(
        (total, day) => total + day.operationsMinutes,
        0,
    );
    const sowingMinutes = daily.reduce(
        (total, day) => total + day.sowingMinutes,
        0,
    );
    const totalMinutes = operationsMinutes + sowingMinutes;

    return {
        totalMinutes,
        operationsMinutes,
        sowingMinutes,
        daily,
    };
}

export async function getAnalyticsData(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? days : 1;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (safeDays - 1));
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    const [analyticsResult, entityTypes, operationsList, operationsData] =
        await Promise.all([
            getAnalyticsTotals(safeDays),
            getEntityTypes(),
            getAllOperations({
                completedFrom: startDate,
                completedTo: endDate,
            }),
            getEntitiesFormatted<EntityStandardized>('operation'),
        ]);

    const entitiesCounts = await Promise.all(
        entityTypes.map(async (entityType) => {
            const entities = await getEntitiesRaw(entityType.name);
            return {
                entityTypeName: entityType.name,
                label: entityType.label,
                count: entities.length,
            };
        }),
    );

    const { dateKeys, operationsTotals, sowingTotals } = createDurationBuckets(
        startDate,
        safeDays,
    );

    const operationDurations = new Map<number, number>();
    for (const operation of operationsData ?? []) {
        const duration = parseDuration(
            (operation.attributes as { duration?: unknown } | undefined)
                ?.duration,
        );
        operationDurations.set(operation.id, duration);
    }

    for (const operation of operationsList) {
        // Operations are already filtered by completion date and status,
        // but double-check for safety
        if (operation.status !== 'completed' || !operation.completedAt) {
            continue;
        }

        const key = toDateKey(operation.completedAt);
        if (!operationsTotals.has(key)) {
            continue;
        }

        const durationMinutes = operationDurations.get(operation.entityId) ?? 0;
        if (!durationMinutes) {
            continue;
        }

        operationsTotals.set(
            key,
            (operationsTotals.get(key) ?? 0) + durationMinutes,
        );
    }

    const sowingEvents = await getPlantUpdateEvents({
        from: startDate,
        to: endDate,
        status: 'sowed',
    });

    for (const event of sowingEvents) {
        const key = toDateKey(event.createdAt);
        if (!sowingTotals.has(key)) {
            continue;
        }

        sowingTotals.set(
            key,
            (sowingTotals.get(key) ?? 0) + PLANT_SOWING_DURATION_MINUTES,
        );
    }

    const operationsDuration = formatOperationsDurationData(
        dateKeys,
        operationsTotals,
        sowingTotals,
    );

    const topAdventUsers = await getAdventCalendarTopUsers(today.getFullYear());

    return {
        analytics: analyticsResult,
        entities: entitiesCounts,
        operationsDuration,
        topAdventUsers,
    };
}
