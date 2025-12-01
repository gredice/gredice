import { and, asc, eq, sql } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';
import {
    type AdventCalendarOpenPayload,
    createEvent,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';

type DatabaseClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<DatabaseClient['transaction']>[0]
>[0];

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

export type AdventCalendarOpenResult = {
    payload: AdventCalendarOpenPayload;
    openedDaysCount: number;
};

export type AdventCalendarOpenOptions = {
    accountId: string;
    payload:
        | AdventCalendarOpenPayload
        | ((
              openedDaysCount: number,
          ) => AdventCalendarOpenPayload | Promise<AdventCalendarOpenPayload>);
    onSuccess?: (
        tx: TransactionClient,
        payload: AdventCalendarOpenPayload,
    ) => Promise<void>;
};

export async function createAdventCalendarOpenEvent({
    accountId,
    payload: payloadOrFactory,
    onSuccess,
}: AdventCalendarOpenOptions): Promise<AdventCalendarOpenResult> {
    const db = storage();
    return db.transaction(async (tx) => {
        const existingEvents = await tx.query.events.findMany({
            where: and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.occasions.adventCalendarOpen),
            ),
            orderBy: [asc(events.createdAt)],
        });

        // Resolve the payload - it can be a factory function that receives opened count
        const payload =
            typeof payloadOrFactory === 'function'
                ? await payloadOrFactory(
                      existingEvents.filter((event) => {
                          const data =
                              event.data as AdventCalendarOpenPayload | null;
                          return data?.year !== undefined; // Count all opened days for the year
                      }).length,
                  )
                : payloadOrFactory;

        // Now acquire the lock with the resolved payload
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${accountId} || '-' || ${payload.year}::text || '-' || ${payload.day}::text));`,
        );

        const openedDaysForYear = existingEvents.filter((event) => {
            const data = event.data as AdventCalendarOpenPayload | null;
            return data?.year === payload.year;
        });

        const alreadyOpened = openedDaysForYear.some((event) => {
            const data = event.data as AdventCalendarOpenPayload | null;
            return data?.day === payload.day;
        });

        if (alreadyOpened) {
            throw new AdventCalendarDayAlreadyOpenedError(payload.day);
        }

        await createEvent(
            knownEvents.occasions.adventCalendarOpenedV1(accountId, payload),
            tx,
        );

        // Execute callback within the same transaction if provided
        if (onSuccess) {
            await onSuccess(tx, payload);
        }

        return {
            payload,
            openedDaysCount: openedDaysForYear.length,
        };
    });
}
