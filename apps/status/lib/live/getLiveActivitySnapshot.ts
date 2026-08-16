import 'server-only';

import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import pg from 'pg';
import { domainLiveEventTypeEntries, liveEventCatalog } from './eventCatalog';
import {
    type LiveActivityCategory,
    type LiveActivityEvent,
    type LiveActivitySnapshot,
    type LiveActivitySource,
    liveActivitySources,
} from './types';

const { Pool } = pg;
const EVENTS_PER_CATEGORY = 96;
const SYSTEM_EVENT_LIMIT = 384;
const SOURCE_WINDOW_HOURS = 3;
const CACHE_SECONDS = 30;

type DomainEventRow = {
    id: number;
    type: string;
    created_at: Date;
};

type SystemEventRow = {
    id: string;
    source: string;
    type: string;
    occurred_at: Date;
    event_count: number;
};

type LiveEventRow = {
    id: string;
    source: LiveActivitySource;
    type: string;
    occurredAt: Date;
    eventCount: number;
};

let pool: pg.Pool | undefined;

function normalizeConnectionString(connectionString: string) {
    const url = new URL(connectionString);

    if (url.searchParams.get('sslmode') === 'require') {
        url.searchParams.set('sslmode', 'verify-full');
    }

    return url.toString();
}

function emptyCategoryTotals(): Record<LiveActivityCategory, number> {
    return {
        garden: 0,
        care: 0,
        journey: 0,
        community: 0,
        exchange: 0,
        platform: 0,
        code: 0,
    };
}

function emptySourceTotals(): Record<LiveActivitySource, number> {
    return {
        gredice: 0,
        vercel: 0,
        github: 0,
    };
}

function unavailableSnapshot(): LiveActivitySnapshot {
    return {
        capturedAt: new Date().toISOString(),
        windowStart: null,
        windowEnd: null,
        source: 'unavailable',
        events: [],
        categoryTotals: emptyCategoryTotals(),
        sourceTotals: emptySourceTotals(),
        connectedSources: [],
    };
}

function getPool() {
    const connectionString = process.env.GREDICE_LIVE_DATABASE_URL?.trim();
    if (!connectionString) {
        return null;
    }

    pool ??= new Pool({
        connectionString: normalizeConnectionString(connectionString),
        max: 2,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
    });

    return pool;
}

function publicEventId(row: LiveEventRow) {
    return createHash('sha256')
        .update(
            `${row.source}:${row.id}:${row.type}:${row.occurredAt.toISOString()}`,
        )
        .digest('base64url')
        .slice(0, 12);
}

function visualValue(row: LiveEventRow, divisor: number) {
    const hash = createHash('sha256')
        .update(`${row.source}:${row.id}`)
        .digest();
    return (hash[0] ?? 0) % divisor;
}

function visualIntensity(row: LiveEventRow) {
    if (row.source === 'vercel') {
        return Math.min(
            3,
            Math.max(1, Math.floor(Math.log10(row.eventCount)) + 1),
        );
    }

    return visualValue(row, 3) + 1;
}

function toPublicEvent(row: LiveEventRow): LiveActivityEvent | null {
    const definition = liveEventCatalog[row.type];
    if (!definition || definition.source !== row.source) {
        return null;
    }

    return {
        id: publicEventId(row),
        source: definition.source,
        category: definition.category,
        label: definition.label,
        title: definition.title,
        detail: definition.detail,
        occurredAt: row.occurredAt.toISOString(),
        lane: visualValue(row, 12),
        intensity: visualIntensity(row),
    };
}

async function queryDomainEvents(database: pg.Pool): Promise<LiveEventRow[]> {
    const sourceTypes = domainLiveEventTypeEntries.map((entry) => entry.type);
    const sourceCategories = domainLiveEventTypeEntries.map(
        (entry) => entry.category,
    );
    const result = await database.query<DomainEventRow>(
        `
            with typed_events(type, category) as (
                select * from unnest($2::text[], $3::text[])
            ),
            ranked_events as (
                select
                    events.id,
                    events.type,
                    events.created_at,
                    row_number() over (
                        partition by typed_events.category
                        order by events.created_at desc, events.id desc
                    ) as category_rank
                from events
                inner join typed_events on typed_events.type = events.type
                where events.created_at >= now() - ($1 * interval '1 hour')
            )
            select id, type, created_at
            from ranked_events
            where category_rank <= $4
            order by created_at asc, id asc
        `,
        [
            SOURCE_WINDOW_HOURS,
            sourceTypes,
            sourceCategories,
            EVENTS_PER_CATEGORY,
        ],
    );

    return result.rows.map((row) => ({
        id: String(row.id),
        source: 'gredice',
        type: row.type,
        occurredAt: row.created_at,
        eventCount: 1,
    }));
}

function isSystemSource(source: string): source is 'vercel' | 'github' {
    return source === 'vercel' || source === 'github';
}

async function querySystemEvents(database: pg.Pool): Promise<LiveEventRow[]> {
    const result = await database.query<SystemEventRow>(
        `
            select id, source, type, occurred_at, event_count
            from (
                select id, source, type, occurred_at, event_count
                from status_live_events
                where occurred_at >= now() - ($1 * interval '1 hour')
                order by occurred_at desc, id desc
                limit $2
            ) as recent_system_events
            order by occurred_at asc, id asc
        `,
        [SOURCE_WINDOW_HOURS, SYSTEM_EVENT_LIMIT],
    );

    return result.rows.flatMap((row) =>
        isSystemSource(row.source)
            ? [
                  {
                      id: row.id,
                      source: row.source,
                      type: row.type,
                      occurredAt: row.occurred_at,
                      eventCount: row.event_count,
                  },
              ]
            : [],
    );
}

function reportSourceFailure(source: LiveActivitySource, reason: unknown) {
    console.warn('Unable to load one live activity source.', {
        errorName: reason instanceof Error ? reason.name : 'UnknownError',
        source,
    });
}

async function queryLiveActivitySnapshot(): Promise<LiveActivitySnapshot> {
    const database = getPool();
    if (!database) {
        return unavailableSnapshot();
    }

    const [domainResult, systemResult] = await Promise.allSettled([
        queryDomainEvents(database),
        querySystemEvents(database),
    ]);
    const connectedSources: LiveActivitySource[] = [];
    const rows: LiveEventRow[] = [];

    if (domainResult.status === 'fulfilled') {
        connectedSources.push('gredice');
        rows.push(...domainResult.value);
    } else {
        reportSourceFailure('gredice', domainResult.reason);
    }

    if (systemResult.status === 'fulfilled') {
        connectedSources.push('vercel', 'github');
        rows.push(...systemResult.value);
    } else {
        reportSourceFailure('vercel', systemResult.reason);
        reportSourceFailure('github', systemResult.reason);
    }

    if (connectedSources.length === 0) {
        return unavailableSnapshot();
    }

    const events = rows
        .map(toPublicEvent)
        .filter((event): event is LiveActivityEvent => event !== null)
        .sort((first, second) =>
            first.occurredAt.localeCompare(second.occurredAt),
        );
    const categoryTotals = emptyCategoryTotals();
    const sourceTotals = emptySourceTotals();

    for (const event of events) {
        categoryTotals[event.category] += 1;
        sourceTotals[event.source] += 1;
    }

    const firstEvent = events[0];
    const lastEvent = events.at(-1);
    const allSourcesConnected = liveActivitySources.every((source) =>
        connectedSources.includes(source),
    );

    return {
        capturedAt: new Date().toISOString(),
        windowStart: firstEvent?.occurredAt ?? null,
        windowEnd: lastEvent?.occurredAt ?? null,
        source: allSourcesConnected ? 'combined-events' : 'domain-events',
        events,
        categoryTotals,
        sourceTotals,
        connectedSources,
    };
}

const getCachedLiveActivitySnapshot = unstable_cache(
    queryLiveActivitySnapshot,
    ['status-live-activity-v4'],
    { revalidate: CACHE_SECONDS },
);

export async function getLiveActivitySnapshot() {
    return getCachedLiveActivitySnapshot();
}
