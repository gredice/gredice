import { and, asc, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { events } from '../../schema';
import { storage } from '../../storage';
import { knownEventTypes } from './knownEventTypes';
import type { Event } from './types';

export function getEvents(
    type: string | string[],
    aggregateIds: string[],
    offset: number = 0,
    limit: number = 1000,
) {
    return storage().query.events.findMany({
        where: and(
            inArray(events.aggregateId, aggregateIds),
            Array.isArray(type)
                ? inArray(events.type, type)
                : eq(events.type, type),
        ),
        orderBy: [asc(events.createdAt)],
        offset,
        limit,
    });
}

export async function getPlantUpdateEvents(filter?: {
    status?: string;
    from?: Date;
    to?: Date;
}) {
    const results = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.raisedBedFields.plantUpdate),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (!filter?.status) {
        return results;
    }

    return results.filter((event) => {
        const status = (event.data as { status?: unknown } | null | undefined)
            ?.status;
        return status === filter.status;
    });
}

export async function getPlantPlaceEventsCount() {
    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(eq(events.type, knownEventTypes.raisedBedFields.plantPlace));
    return result[0]?.count ?? 0;
}

export function createEvent({ type, version, aggregateId, data }: Event) {
    return storage().insert(events).values({
        type,
        version,
        aggregateId,
        data,
    });
}

export function deleteEventById(eventId: number) {
    return storage().delete(events).where(eq(events.id, eventId));
}
