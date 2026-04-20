import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { events } from '../../schema';
import { storage } from '../../storage';
import { knownEventTypes } from './knownEventTypes';
import type {
    Event,
    RaisedBedFieldAiAnalysisPayload,
    UserBirthdayRewardPayload,
} from './types';

type DatabaseClient = ReturnType<typeof storage>;

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

export async function countEventsSince(
    type: string,
    since: Date,
    aggregateIds: string[],
) {
    if (aggregateIds.length === 0) {
        return 0;
    }

    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(
            and(
                eq(events.type, type),
                gte(events.createdAt, since),
                inArray(events.aggregateId, aggregateIds),
            ),
        );
    return result[0]?.count ?? 0;
}

export function createEvent(
    { type, version, aggregateId, data, createdAt }: Event,
    db: DatabaseClient = storage(),
) {
    return db.insert(events).values({
        type,
        version,
        aggregateId,
        data,
        ...(createdAt && { createdAt }),
    });
}

export async function getAiAnalysisEvents(filter?: { from?: Date; to?: Date }) {
    const results = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.raisedBedFields.aiAnalysis),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [desc(events.createdAt)],
    });

    return results.map((event) => ({
        ...event,
        data: event.data as RaisedBedFieldAiAnalysisPayload | null,
    }));
}

export async function getAiAnalysisTotals(filter?: { from?: Date; to?: Date }) {
    const whereConditions = [
        eq(events.type, knownEventTypes.raisedBedFields.aiAnalysis),
        ...(filter?.from ? [gte(events.createdAt, filter.from)] : []),
        ...(filter?.to ? [lte(events.createdAt, filter.to)] : []),
    ];

    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(and(...whereConditions));

    return {
        count: result[0]?.count ?? 0,
    };
}

type SunflowersDailyPoint = {
    date: string;
    spent: number;
    gifted: number;
};

export async function getSunflowersDailyTotals(filter?: {
    from?: Date;
    to?: Date;
}) {
    const results = await storage().query.events.findMany({
        where: and(
            inArray(events.type, [
                knownEventTypes.accounts.earnSunflowers,
                knownEventTypes.accounts.spendSunflowers,
            ]),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [asc(events.createdAt)],
    });

    const byDay = new Map<string, SunflowersDailyPoint>();

    for (const event of results) {
        const key = event.createdAt.toISOString().split('T')[0];
        const existing = byDay.get(key) ?? { date: key, spent: 0, gifted: 0 };
        const payload = event.data as
            | { amount?: unknown; reason?: unknown }
            | null
            | undefined;
        const amount =
            typeof payload?.amount === 'number' &&
            Number.isFinite(payload.amount)
                ? Math.max(0, payload.amount)
                : 0;
        const reason =
            typeof payload?.reason === 'string' ? payload.reason : undefined;

        if (event.type === knownEventTypes.accounts.spendSunflowers) {
            existing.spent += amount;
        } else if (
            event.type === knownEventTypes.accounts.earnSunflowers &&
            reason === 'gift'
        ) {
            existing.gifted += amount;
        }

        byDay.set(key, existing);
    }

    return Array.from(byDay.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
    );
}

export function deleteEventById(eventId: number) {
    return storage().delete(events).where(eq(events.id, eventId));
}

export async function getLastBirthdayRewardEvent(userId: string) {
    const event = await storage().query.events.findFirst({
        where: and(
            eq(events.aggregateId, userId),
            eq(events.type, knownEventTypes.users.birthdayReward),
        ),
        orderBy: [desc(events.createdAt)],
    });
    if (!event) {
        return null;
    }
    return {
        ...event,
        data: event.data as UserBirthdayRewardPayload,
    };
}
