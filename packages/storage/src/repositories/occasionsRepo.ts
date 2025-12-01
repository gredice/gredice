import { and, asc, eq, sql } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';
import {
    type AdventCalendarOpenPayload,
    createEvent,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';

export class AdventCalendarDayAlreadyOpenedError extends Error {
    constructor(public day: number) {
        super(`Advent dan ${day} je već otvoren.`);
        this.name = 'AdventCalendarDayAlreadyOpenedError';
    }
}

type AdventEvent = {
    data: AdventCalendarOpenPayload;
} & typeof events.$inferSelect;

export async function getAdventCalendarOpenEvents(
    accountId: string,
    year: number,
) {
    const items = await storage().query.events.findMany({
        where: and(
            eq(events.aggregateId, accountId),
            eq(events.type, knownEventTypes.occasions.adventCalendarOpen),
        ),
        orderBy: [asc(events.createdAt)],
    });

    return items
        .filter((item): item is AdventEvent => {
            const data = item.data as AdventCalendarOpenPayload | null;
            return data?.year === year;
        })
        .map((item) => ({
            ...item,
            data: item.data as AdventCalendarOpenPayload,
        }));
}

export async function createAdventCalendarOpenEvent(
    accountId: string,
    payload: AdventCalendarOpenPayload,
) {
    const db = storage();
    return db.transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${accountId} || '-' || ${payload.year}::text || '-' || ${payload.day}::text));`,
        );

        const existingEvents = await tx.query.events.findMany({
            where: and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.occasions.adventCalendarOpen),
            ),
            orderBy: [asc(events.createdAt)],
        });

        const alreadyOpened = existingEvents.some((event) => {
            const data = event.data as AdventCalendarOpenPayload | null;
            return data?.year === payload.year && data?.day === payload.day;
        });

        if (alreadyOpened) {
            throw new AdventCalendarDayAlreadyOpenedError(payload.day);
        }

        await createEvent(
            knownEvents.occasions.adventCalendarOpenedV1(accountId, payload),
            tx,
        );

        return payload;
    });
}
