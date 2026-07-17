'use server';

import {
    getAiAnalysisEvents,
    getAiAnalysisTotals,
    getAllOperations,
    getAnalyticsTotals,
    getAttributeDefinitions,
    getEntitiesFormatted,
    getEntitiesRaw,
    getEntityTypes,
    getIncompleteEntityCountsByState,
    getPlantUpdateEvents,
    getSunflowersDailyTotals,
    getUserRegistrationsByWeekday,
    redisCached,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { sumAiAnalysisCostUsd } from '../../../src/ai/aiAnalyticsCost';
import {
    analyticsDateKey,
    analyticsTimeZone,
    createAnalyticsDateRange,
} from './analyticsDateRange';

type OperationsDurationPoint = {
    date: string;
    operationsMinutes: number;
    plannedMinutes: number;
    sowingMinutes: number;
    totalMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        userAvatarUrl: string | null;
        operationsMinutes: number;
        plannedMinutes: number;
    }[];
};

type OperationsDurationData = {
    totalMinutes: number;
    operationsMinutes: number;
    plannedMinutes: number;
    sowingMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        userAvatarUrl: string | null;
        operationsMinutes: number;
        plannedMinutes: number;
        operationsCount: number;
        plannedCount: number;
    }[];
    daily: OperationsDurationPoint[];
};

type OperationUserStats = {
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    operationsMinutes: number;
    plannedMinutes: number;
    operationsCount: number;
    plannedCount: number;
};

type DailyOperationUserStats = {
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    operationsMinutes: number;
    plannedMinutes: number;
};

type SunflowersDailyTotalsPoint = {
    date: string;
    spent: number;
    earned: number;
};

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
const UNASSIGNED_USER = {
    userId: 'unassigned',
    userName: 'Nedodijeljeno',
    userAvatarUrl: null,
};

function cacheKeyPart(value: string | number | undefined) {
    if (typeof value === 'undefined' || value === '') {
        return 'none';
    }

    return encodeURIComponent(String(value));
}

function analyticsCacheKey(
    days: number | undefined,
    from?: string,
    to?: string,
) {
    return `dashboard:admin:analytics:days:${cacheKeyPart(days)}:from:${cacheKeyPart(from)}:to:${cacheKeyPart(to)}:v3`;
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

function addDurationToUsers({
    date,
    durationMinutes,
    userId,
    userName,
    userAvatarUrl,
    operationsByUser,
    dailyOperationsByUser,
    includeInDailyTotals = true,
    kind = 'completed',
}: {
    date: string;
    durationMinutes: number;
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    operationsByUser: Map<string, OperationUserStats>;
    dailyOperationsByUser: Map<string, Map<string, DailyOperationUserStats>>;
    includeInDailyTotals?: boolean;
    kind?: 'completed' | 'planned';
}) {
    if (includeInDailyTotals) {
        const dateUserStats = dailyOperationsByUser.get(date) ?? new Map();
        const existingDailyStats = dateUserStats.get(userId);
        if (!existingDailyStats) {
            dateUserStats.set(userId, {
                userId,
                userName,
                userAvatarUrl,
                operationsMinutes: kind === 'completed' ? durationMinutes : 0,
                plannedMinutes: kind === 'planned' ? durationMinutes : 0,
            });
        } else {
            if (kind === 'completed') {
                existingDailyStats.operationsMinutes += durationMinutes;
            } else {
                existingDailyStats.plannedMinutes += durationMinutes;
            }
        }
        dailyOperationsByUser.set(date, dateUserStats);
    }

    const existingUserStats = operationsByUser.get(userId);
    if (!existingUserStats) {
        operationsByUser.set(userId, {
            userId,
            userName,
            userAvatarUrl,
            operationsMinutes: kind === 'completed' ? durationMinutes : 0,
            plannedMinutes: kind === 'planned' ? durationMinutes : 0,
            operationsCount: kind === 'completed' ? 1 : 0,
            plannedCount: kind === 'planned' ? 1 : 0,
        });
        return;
    }

    if (kind === 'completed') {
        existingUserStats.operationsMinutes += durationMinutes;
        existingUserStats.operationsCount += 1;
    } else {
        existingUserStats.plannedMinutes += durationMinutes;
        existingUserStats.plannedCount += 1;
    }
}

function createDurationBuckets(dateKeys: string[]) {
    const operationsTotals = new Map<string, number>();
    const plannedTotals = new Map<string, number>();
    const sowingTotals = new Map<string, number>();
    for (const date of dateKeys) {
        operationsTotals.set(date, 0);
        plannedTotals.set(date, 0);
        sowingTotals.set(date, 0);
    }

    return {
        dateKeys,
        operationsTotals,
        plannedTotals,
        sowingTotals,
    };
}

function formatOperationsDurationData(
    dateKeys: string[],
    operationsTotals: Map<string, number>,
    plannedTotals: Map<string, number>,
    sowingTotals: Map<string, number>,
): OperationsDurationData {
    const daily = dateKeys.map((date) => ({
        date,
        operationsMinutes: operationsTotals.get(date) ?? 0,
        plannedMinutes: plannedTotals.get(date) ?? 0,
        sowingMinutes: sowingTotals.get(date) ?? 0,
        totalMinutes:
            (operationsTotals.get(date) ?? 0) +
            (plannedTotals.get(date) ?? 0) +
            (sowingTotals.get(date) ?? 0),
        byUser: [],
    }));
    const operationsMinutes = daily.reduce(
        (total, day) => total + day.operationsMinutes,
        0,
    );
    const plannedMinutes = daily.reduce(
        (total, day) => total + day.plannedMinutes,
        0,
    );
    const sowingMinutes = daily.reduce(
        (total, day) => total + day.sowingMinutes,
        0,
    );
    const totalMinutes = operationsMinutes + plannedMinutes + sowingMinutes;

    return {
        totalMinutes,
        operationsMinutes,
        plannedMinutes,
        sowingMinutes,
        byUser: [],
        daily,
    };
}

function getOperationUser(operation: {
    assignedUser?: {
        id: string;
        userName: string;
        displayName: string | null;
        avatarUrl: string | null;
    } | null;
}) {
    if (!operation.assignedUser) {
        return UNASSIGNED_USER;
    }

    return {
        userId: operation.assignedUser.id,
        userName:
            operation.assignedUser.displayName ??
            operation.assignedUser.userName,
        userAvatarUrl: operation.assignedUser.avatarUrl,
    };
}

export async function getAnalyticsData(
    days: number | undefined,
    from?: string,
    to?: string,
) {
    return redisCached(
        analyticsCacheKey(days, from, to),
        () => getAnalyticsDataUncached(days, from, to),
        {
            ttl: 60,
            maxPayloadBytes: 2 * 1024 * 1024,
        },
    );
}

async function getAnalyticsDataUncached(
    days: number | undefined,
    from?: string,
    to?: string,
) {
    const { startDate, endDate, dateKeys } = createAnalyticsDateRange(
        days,
        from,
        to,
    );
    const rangeDays = dateKeys.length;

    const [
        analyticsResult,
        entityTypes,
        operationsList,
        plannedOperationsList,
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
        getAllOperations({
            status: 'planned',
        }),
        getEntitiesFormatted<EntityStandardized>('operation'),
        getUserRegistrationsByWeekday(startDate, endDate, analyticsTimeZone),
        getAiAnalysisTotals({ from: startDate, to: endDate }),
        getAiAnalysisEvents({ from: startDate, to: endDate }),
        getSunflowersDailyTotals({
            from: startDate,
            to: endDate,
            timeZone: analyticsTimeZone,
        }),
    ]);

    const entitiesCounts = await Promise.all(
        entityTypes.map(async (entityType) => {
            const entities = await getEntitiesRaw(entityType.name);
            const definitions = await getAttributeDefinitions(entityType.name);
            const incompleteCounts = getIncompleteEntityCountsByState(
                entities,
                definitions,
            );
            return {
                entityTypeName: entityType.name,
                label: entityType.label,
                count: entities.length,
                incompleteDraftCount: incompleteCounts.draft,
                incompletePublishedCount: incompleteCounts.published,
            };
        }),
    );

    const { operationsTotals, plannedTotals, sowingTotals } =
        createDurationBuckets(dateKeys);

    const operationDurations = new Map<number, number>();
    for (const operation of operationsData ?? []) {
        const duration = parseDuration(
            (operation.attributes as { duration?: unknown } | undefined)
                ?.duration,
        );
        operationDurations.set(operation.id, duration);
    }

    const operationsByUser = new Map<string, OperationUserStats>();
    const dailyOperationsByUser = new Map<
        string,
        Map<string, DailyOperationUserStats>
    >();

    for (const operation of operationsList) {
        if (operation.status !== 'completed' || !operation.completedAt) {
            continue;
        }

        const key = analyticsDateKey(operation.completedAt);
        if (!operationsTotals.has(key)) {
            continue;
        }

        const durationMinutes = operationDurations.get(operation.entityId) ?? 0;

        operationsTotals.set(
            key,
            (operationsTotals.get(key) ?? 0) + durationMinutes,
        );

        const user = getOperationUser(operation);
        addDurationToUsers({
            date: key,
            durationMinutes,
            userId: user.userId,
            userName: user.userName,
            userAvatarUrl: user.userAvatarUrl,
            operationsByUser,
            dailyOperationsByUser,
        });
    }

    for (const operation of plannedOperationsList) {
        if (operation.status !== 'planned' || !operation.scheduledDate) {
            continue;
        }

        if (
            operation.scheduledDate < startDate ||
            operation.scheduledDate > endDate
        ) {
            continue;
        }

        const key = analyticsDateKey(operation.scheduledDate);
        if (!plannedTotals.has(key)) {
            continue;
        }

        const durationMinutes = operationDurations.get(operation.entityId) ?? 0;
        plannedTotals.set(key, (plannedTotals.get(key) ?? 0) + durationMinutes);

        const user = getOperationUser(operation);
        addDurationToUsers({
            date: key,
            durationMinutes,
            userId: user.userId,
            userName: user.userName,
            userAvatarUrl: user.userAvatarUrl,
            operationsByUser,
            dailyOperationsByUser,
            kind: 'planned',
        });
    }

    const sowingEvents = await getPlantUpdateEvents({
        from: startDate,
        to: endDate,
        status: 'sowed',
    });

    for (const event of sowingEvents) {
        const key = analyticsDateKey(event.createdAt);
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
        plannedTotals,
        sowingTotals,
    );

    operationsDuration.byUser = Array.from(operationsByUser.values()).sort(
        (a, b) =>
            b.operationsMinutes +
            b.plannedMinutes -
            (a.operationsMinutes + a.plannedMinutes),
    );
    operationsDuration.daily = operationsDuration.daily.map((day) => ({
        ...day,
        byUser: Array.from(dailyOperationsByUser.get(day.date)?.values() ?? [])
            .filter(
                (user) => user.operationsMinutes > 0 || user.plannedMinutes > 0,
            )
            .sort(
                (a, b) =>
                    b.operationsMinutes +
                    b.plannedMinutes -
                    (a.operationsMinutes + a.plannedMinutes),
            ),
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
    const aiTotalCostUsd = sumAiAnalysisCostUsd(aiEvents);

    return {
        analytics: analyticsResult,
        entities: entitiesCounts,
        operationsDuration,
        weekdayRegistrations,
        ai: {
            count: aiTotals.count,
            totalTokens: aiTotalTokens,
            totalCostUsd: aiTotalCostUsd,
        },
        sunflowers: sunflowersDailyTotals,
    };
}
