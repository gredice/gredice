import 'server-only';

import { and, asc, gte, lte } from 'drizzle-orm';
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
