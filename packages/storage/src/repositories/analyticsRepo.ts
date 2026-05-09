import { and, count, eq, gte, lt, lte, sql } from 'drizzle-orm';
import {
    accounts,
    accountUsers,
    deliveryRequests,
    events,
    farms,
    gardenBlocks,
    gardens,
    raisedBeds,
    transactions,
    users,
} from '../schema';
import { storage } from '../storage';
import { knownEventTypes } from './events/knownEventTypes';

type ActiveUserRow = {
    userId: string;
    activityDate: Date | string;
};

type ActiveUsersMetrics = {
    daily: number;
    weekly: number;
    monthly: number;
};

function calculateActiveUsersMetrics(
    rows: ActiveUserRow[],
    now: Date,
    lastMonthThreshold: Date,
): ActiveUsersMetrics {
    const lastDayThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeekThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthlyThreshold = new Date(lastMonthThreshold);

    const dailyActiveUsers = new Set<string>();
    const weeklyActiveUsers = new Set<string>();
    const monthlyActiveUsers = new Set<string>();

    for (const row of rows) {
        const activityDate = new Date(row.activityDate);

        if (activityDate >= lastDayThreshold) {
            dailyActiveUsers.add(row.userId);
        }
        if (activityDate >= lastWeekThreshold) {
            weeklyActiveUsers.add(row.userId);
        }
        if (activityDate >= monthlyThreshold) {
            monthlyActiveUsers.add(row.userId);
        }
    }

    return {
        daily: dailyActiveUsers.size,
        weekly: weeklyActiveUsers.size,
        monthly: monthlyActiveUsers.size,
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
                userId: accountUsers.userId,
                activityDate: sql<Date>`max(${events.createdAt})`,
            })
            .from(accountUsers)
            .innerJoin(events, eq(events.aggregateId, accountUsers.accountId))
            .where(
                and(
                    eq(events.type, knownEventTypes.accounts.earnSunflowers),
                    gte(events.createdAt, lastMonthThreshold),
                    sql`${events.data}->>'reason' like 'daily:%'`,
                ),
            )
            .groupBy(accountUsers.userId),
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

export async function getUserRegistrationsByWeekday(from: Date, to: Date) {
    // EXTRACT(DOW) returns 0 for Sunday through 6 for Saturday, matching JS Date.getDay() indexing
    const rows = await storage()
        .select({
            dayOfWeek: sql<number>`EXTRACT(DOW FROM ${users.createdAt})::integer`,
            registrations: count(),
        })
        .from(users)
        .where(and(gte(users.createdAt, from), lte(users.createdAt, to)))
        .groupBy(sql`EXTRACT(DOW FROM ${users.createdAt})`);

    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const row of rows) {
        weekdayCounts[row.dayOfWeek] = row.registrations;
    }

    return weekdayCounts;
}
