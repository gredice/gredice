'use server';

import {
    getAllOperations,
    getAnalyticsTotals,
    getEntitiesFormatted,
    getEntitiesRaw,
    getEntityTypes,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';

type OperationsDurationPoint = {
    date: string;
    durationMinutes: number;
};

type OperationsDurationData = {
    totalMinutes: number;
    daily: OperationsDurationPoint[];
};

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
    const dailyTotals = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + i);
        const key = toDateKey(current);
        dateKeys.push(key);
        dailyTotals.set(key, 0);
    }

    return {
        dateKeys,
        dailyTotals,
    };
}

function formatOperationsDurationData(
    dateKeys: string[],
    dailyTotals: Map<string, number>,
): OperationsDurationData {
    const daily = dateKeys.map((date) => ({
        date,
        durationMinutes: dailyTotals.get(date) ?? 0,
    }));
    const totalMinutes = daily.reduce(
        (total, day) => total + day.durationMinutes,
        0,
    );

    return {
        totalMinutes,
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
            getAllOperations({ from: startDate, to: endDate }),
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

    const { dateKeys, dailyTotals } = createDurationBuckets(
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
        if (operation.status !== 'completed' || !operation.completedAt) {
            continue;
        }

        if (
            operation.completedAt < startDate ||
            operation.completedAt > endDate
        ) {
            continue;
        }

        const key = toDateKey(operation.completedAt);
        if (!dailyTotals.has(key)) {
            continue;
        }

        const durationMinutes = operationDurations.get(operation.entityId) ?? 0;
        if (!durationMinutes) {
            continue;
        }

        dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + durationMinutes);
    }

    const operationsDuration = formatOperationsDurationData(
        dateKeys,
        dailyTotals,
    );

    return {
        analytics: analyticsResult,
        entities: entitiesCounts,
        operationsDuration,
    };
}
