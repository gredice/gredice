'use server';

import {
    getAiAnalysisEvents,
    getAiAnalysisTotals,
    getAllOperations,
    getAnalyticsTotals,
    getEntitiesFormatted,
    getEntitiesRaw,
    getEntityTypes,
    getPlantUpdateEvents,
    getSunflowersDailyTotals,
    getUserRegistrationsByWeekday,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

type OperationsDurationPoint = {
    date: string;
    operationsMinutes: number;
    sowingMinutes: number;
    totalMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        operationsMinutes: number;
    }[];
};

type OperationsDurationData = {
    totalMinutes: number;
    operationsMinutes: number;
    sowingMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        operationsMinutes: number;
        operationsCount: number;
    }[];
    daily: OperationsDurationPoint[];
};

type DateRange = {
    startDate: Date;
    endDate: Date;
};

type SunflowersDailyTotalsPoint = {
    date: string;
    spent: number;
    earned: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = [
    'Nedjelja',
    'Ponedjeljak',
    'Utorak',
    'Srijeda',
    'Četvrtak',
    'Petak',
    'Subota',
];
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
        byUser: [],
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
        byUser: [],
        daily,
    };
}

function parseDateInput(value?: string) {
    if (!value) {
        return null;
    }

    const parts = value.split('-').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        return null;
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function createDateRange(days: number, from?: string, to?: string): DateRange {
    const now = new Date();
    const defaultDays = Number.isFinite(days) && days > 0 ? days : 1;
    const defaultStartDate = new Date(now);
    defaultStartDate.setHours(0, 0, 0, 0);
    defaultStartDate.setDate(defaultStartDate.getDate() - (defaultDays - 1));
    const defaultEndDate = new Date(now);
    defaultEndDate.setHours(23, 59, 59, 999);

    const parsedFrom = parseDateInput(from);
    const parsedTo = parseDateInput(to);

    if (!parsedFrom || !parsedTo) {
        return { startDate: defaultStartDate, endDate: defaultEndDate };
    }

    const customStartDate = new Date(parsedFrom);
    customStartDate.setHours(0, 0, 0, 0);
    const customEndDate = new Date(parsedTo);
    customEndDate.setHours(23, 59, 59, 999);

    if (customStartDate > customEndDate) {
        return { startDate: defaultStartDate, endDate: defaultEndDate };
    }

    return { startDate: customStartDate, endDate: customEndDate };
}

function getRangeDays(startDate: Date, endDate: Date) {
    const timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.floor(timeDiff / ONE_DAY_MS) + 1;
}

export async function getAnalyticsData(
    days: number | undefined,
    from?: string,
    to?: string,
) {
    const { startDate, endDate } = createDateRange(days, from, to);
    const rangeDays = getRangeDays(startDate, endDate);

    const [
        analyticsResult,
        entityTypes,
        operationsList,
        operationsData,
        weekdayRegistrationsRaw,
        aiTotals,
        aiEvents,
        sunflowersDailyTotalsRaw,
    ] = await Promise.all([
        getAnalyticsTotals(rangeDays),
        getEntityTypes(),
        getAllOperations({
            completedFrom: startDate,
            completedTo: endDate,
        }),
        getEntitiesFormatted<EntityStandardized>('operation'),
        getUserRegistrationsByWeekday(startDate, endDate),
        getAiAnalysisTotals({ from: startDate, to: endDate }),
        getAiAnalysisEvents({ from: startDate, to: endDate }),
        getSunflowersDailyTotals({ from: startDate, to: endDate }),
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
        rangeDays,
    );

    const operationDurations = new Map<number, number>();
    for (const operation of operationsData ?? []) {
        const duration = parseDuration(
            (operation.attributes as { duration?: unknown } | undefined)
                ?.duration,
        );
        operationDurations.set(operation.id, duration);
    }

    const operationsByUser = new Map<
        string,
        {
            userId: string;
            userName: string;
            operationsMinutes: number;
            operationsCount: number;
        }
    >();
    const dailyOperationsByUser = new Map<
        string,
        Map<
            string,
            { userId: string; userName: string; operationsMinutes: number }
        >
    >();

    for (const operation of operationsList) {
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

        const userId = operation.assignedUser?.id ?? 'unassigned';
        const userName =
            operation.assignedUser?.displayName ??
            operation.assignedUser?.userName ??
            'Nedodijeljeno';
        const dateUserStats = dailyOperationsByUser.get(key) ?? new Map();
        const existingDailyStats = dateUserStats.get(userId);
        if (!existingDailyStats) {
            dateUserStats.set(userId, {
                userId,
                userName,
                operationsMinutes: durationMinutes,
            });
        } else {
            existingDailyStats.operationsMinutes += durationMinutes;
        }
        dailyOperationsByUser.set(key, dateUserStats);

        const existingUserStats = operationsByUser.get(userId);
        if (!existingUserStats) {
            operationsByUser.set(userId, {
                userId,
                userName,
                operationsMinutes: durationMinutes,
                operationsCount: 1,
            });
            continue;
        }

        existingUserStats.operationsMinutes += durationMinutes;
        existingUserStats.operationsCount += 1;
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

    operationsDuration.byUser = Array.from(operationsByUser.values()).sort(
        (a, b) => b.operationsMinutes - a.operationsMinutes,
    );
    operationsDuration.daily = operationsDuration.daily.map((day) => ({
        ...day,
        byUser: Array.from(dailyOperationsByUser.get(day.date)?.values() ?? [])
            .filter((user) => user.operationsMinutes > 0)
            .sort((a, b) => b.operationsMinutes - a.operationsMinutes),
    }));

    const weekdayRegistrations = WEEKDAY_LABELS.map((label, index) => ({
        label,
        count: weekdayRegistrationsRaw[index] ?? 0,
    }));

    const sunflowersByDate = new Map<string, SunflowersDailyTotalsPoint>();
    for (const day of sunflowersDailyTotalsRaw) {
        sunflowersByDate.set(day.date, day);
    }
    const sunflowersDailyTotals = dateKeys.map((date) => {
        const day = sunflowersByDate.get(date);
        return {
            date,
            spent: day?.spent ?? 0,
            earned: day?.earned ?? 0,
        };
    });

    const aiTotalTokens = aiEvents.reduce(
        (sum, e) => sum + (e.data?.totalTokens ?? 0),
        0,
    );

    return {
        analytics: analyticsResult,
        entities: entitiesCounts,
        operationsDuration,
        weekdayRegistrations,
        ai: {
            count: aiTotals.count,
            totalTokens: aiTotalTokens,
        },
        sunflowers: sunflowersDailyTotals,
    };
}
