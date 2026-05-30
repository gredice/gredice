import 'server-only';

import { and, asc, desc, gte, lte } from 'drizzle-orm';
import {
    type InsertWeatherHistory,
    storage,
    weatherHistory,
} from '..';

export async function insertWeatherHistory(data: InsertWeatherHistory) {
    const result = await storage()
        .insert(weatherHistory)
        .values(data)
        .returning({ id: weatherHistory.id });

    return result[0] ?? null;
}

export async function getWeatherHistory(from?: Date, to?: Date) {
    const conditions = [];
    if (from) conditions.push(gte(weatherHistory.recordedAt, from));
    if (to) conditions.push(lte(weatherHistory.recordedAt, to));

    return storage().query.weatherHistory.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: asc(weatherHistory.recordedAt),
    });
}

/**
 * Returns the earliest and latest `recordedAt` timestamps available in the
 * weather history, or `null` values when no history has been recorded yet.
 */
export async function getWeatherHistoryBounds(): Promise<{
    from: Date | null;
    to: Date | null;
}> {
    const [earliest, latest] = await Promise.all([
        storage().query.weatherHistory.findFirst({
            orderBy: asc(weatherHistory.recordedAt),
            columns: { recordedAt: true },
        }),
        storage().query.weatherHistory.findFirst({
            orderBy: desc(weatherHistory.recordedAt),
            columns: { recordedAt: true },
        }),
    ]);

    return {
        from: earliest?.recordedAt ?? null,
        to: latest?.recordedAt ?? null,
    };
}
