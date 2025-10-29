import { and, count, gte, isNotNull, lt } from 'drizzle-orm';
import {
    accounts,
    deliveryRequests,
    events,
    farms,
    gardenBlocks,
    gardens,
    raisedBeds,
    transactions,
    userLogins,
    users,
} from '../schema';
import { storage } from '../storage';

type ActiveUserRow = {
    userId: string;
    lastLogin: Date | null;
};

type ActiveUsersSeriesPoint = { date: string; count: number };

type ActiveUsersMetrics = {
    daily: { value: number; series: ActiveUsersSeriesPoint[] };
    weekly: { value: number; series: ActiveUsersSeriesPoint[] };
    monthly: { value: number; series: ActiveUsersSeriesPoint[] };
};

function buildRollingSeries(
    baseSeries: ActiveUsersSeriesPoint[],
    windowSize: number,
): ActiveUsersSeriesPoint[] {
    const result: ActiveUsersSeriesPoint[] = [];
    const queue: number[] = [];
    let sum = 0;

    baseSeries.forEach((point) => {
        queue.push(point.count);
        sum += point.count;

        if (queue.length > windowSize) {
            const removed = queue.shift();
            if (typeof removed === 'number') {
                sum -= removed;
            }
        }

        result.push({ date: point.date, count: sum });
    });

    return result;
}

function calculateActiveUsersMetrics(
    rows: ActiveUserRow[],
    now: Date,
    lastMonthThreshold: Date,
    seriesDays: number = 30,
): ActiveUsersMetrics {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const lastDayThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeekThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthlyThreshold = new Date(lastMonthThreshold);

    const seriesStartDate = new Date(startOfToday);
    seriesStartDate.setDate(seriesStartDate.getDate() - (seriesDays - 1));

    const dailyBuckets = new Map<string, Set<string>>();
    for (let i = 0; i < seriesDays; i += 1) {
        const current = new Date(seriesStartDate);
        current.setDate(seriesStartDate.getDate() + i);
        const key = current.toISOString().slice(0, 10);
        dailyBuckets.set(key, new Set());
    }

    const dailyActiveUsers = new Set<string>();
    const weeklyActiveUsers = new Set<string>();
    const monthlyActiveUsers = new Set<string>();

    for (const row of rows) {
        if (!row.lastLogin) {
            continue;
        }

        const lastLoginDate = new Date(row.lastLogin);

        if (lastLoginDate >= lastDayThreshold) {
            dailyActiveUsers.add(row.userId);
        }
        if (lastLoginDate >= lastWeekThreshold) {
            weeklyActiveUsers.add(row.userId);
        }
        if (lastLoginDate >= monthlyThreshold) {
            monthlyActiveUsers.add(row.userId);
        }

        const key = lastLoginDate.toISOString().slice(0, 10);
        const bucket = dailyBuckets.get(key);
        if (bucket) {
            bucket.add(row.userId);
        }
    }

    const dailySeries: ActiveUsersSeriesPoint[] = [];
    for (let i = 0; i < seriesDays; i += 1) {
        const current = new Date(seriesStartDate);
        current.setDate(seriesStartDate.getDate() + i);
        const key = current.toISOString().slice(0, 10);
        const bucket = dailyBuckets.get(key);
        dailySeries.push({ date: key, count: bucket ? bucket.size : 0 });
    }

    const weeklySeries = buildRollingSeries(dailySeries, 7);
    const monthlySeries = buildRollingSeries(dailySeries, 30);

    return {
        daily: {
            value: dailyActiveUsers.size,
            series: dailySeries,
        },
        weekly: {
            value: weeklyActiveUsers.size,
            series: weeklySeries,
        },
        monthly: {
            value: monthlyActiveUsers.size,
            series: monthlySeries,
        },
    };
}

export async function getAnalyticsTotals(days: number = 7) {
    const now = new Date();
    const beforeDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const lastMonthThreshold = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    const [
        usersCount,
        usersBeforeCount,
        accountsCount,
        accountsBeforeCount,
        farmsCount,
        farmsBeforeCount,
        gardensCount,
        gardensBeforeCount,
        blocksCount,
        blocksBeforeCount,
        eventsCount,
        eventsBeforeCount,
        raisedBedsCount,
        raisedBedsBeforeCount,
        transactionsCount,
        transactionsBeforeCount,
        deliveryRequestsCount,
        deliveryRequestsBeforeCount,
        activeUsersRows,
    ] = await Promise.all([
        storage().select({ count: count() }).from(users),
        storage()
            .select({ count: count() })
            .from(users)
            .where(lt(users.createdAt, beforeDate)),
        storage().select({ count: count() }).from(accounts),
        storage()
            .select({ count: count() })
            .from(accounts)
            .where(lt(accounts.createdAt, beforeDate)),
        storage().select({ count: count() }).from(farms),
        storage()
            .select({ count: count() })
            .from(farms)
            .where(lt(farms.createdAt, beforeDate)),
        storage().select({ count: count() }).from(gardens),
        storage()
            .select({ count: count() })
            .from(gardens)
            .where(lt(gardens.createdAt, beforeDate)),
        storage().select({ count: count() }).from(gardenBlocks),
        storage()
            .select({ count: count() })
            .from(gardenBlocks)
            .where(lt(gardenBlocks.createdAt, beforeDate)),
        storage().select({ count: count() }).from(events),
        storage()
            .select({ count: count() })
            .from(events)
            .where(lt(events.createdAt, beforeDate)),
        storage().select({ count: count() }).from(raisedBeds),
        storage()
            .select({ count: count() })
            .from(raisedBeds)
            .where(lt(raisedBeds.createdAt, beforeDate)),
        storage().select({ count: count() }).from(transactions),
        storage()
            .select({ count: count() })
            .from(transactions)
            .where(lt(transactions.createdAt, beforeDate)),
        storage().select({ count: count() }).from(deliveryRequests),
        storage()
            .select({ count: count() })
            .from(deliveryRequests)
            .where(lt(deliveryRequests.createdAt, beforeDate)),
        storage()
            .select({
                userId: userLogins.userId,
                lastLogin: userLogins.lastLogin,
            })
            .from(userLogins)
            .where(
                and(
                    gte(userLogins.lastLogin, lastMonthThreshold),
                    isNotNull(userLogins.lastLogin),
                ),
            ),
    ]);

    const activeUsers = calculateActiveUsersMetrics(
        activeUsersRows as ActiveUserRow[],
        now,
        lastMonthThreshold,
    );

    return {
        users: usersCount[0].count,
        usersBefore: usersBeforeCount[0].count,
        accounts: accountsCount[0].count,
        accountsBefore: accountsBeforeCount[0].count,
        farms: farmsCount[0].count,
        farmsBefore: farmsBeforeCount[0].count,
        gardens: gardensCount[0].count,
        gardensBefore: gardensBeforeCount[0].count,
        blocks: blocksCount[0].count,
        blocksBefore: blocksBeforeCount[0].count,
        events: eventsCount[0].count,
        eventsBefore: eventsBeforeCount[0].count,
        raisedBeds: raisedBedsCount[0].count,
        raisedBedsBefore: raisedBedsBeforeCount[0].count,
        transactions: transactionsCount[0].count,
        transactionsBefore: transactionsBeforeCount[0].count,
        deliveryRequests: deliveryRequestsCount[0].count,
        deliveryRequestsBefore: deliveryRequestsBeforeCount[0].count,
        activeUsers,
    };
}
