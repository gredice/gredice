import 'server-only';

import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import pg from 'pg';
import { liveEventCatalog, liveEventTypeEntries } from './eventCatalog';
import type {
    LiveActivityCategory,
    LiveActivityEvent,
    LiveActivitySnapshot,
} from './types';

const { Pool } = pg;
const EVENTS_PER_CATEGORY = 96;
const SOURCE_WINDOW_HOURS = 3;
const CACHE_SECONDS = 30;

type LiveEventRow = {
    id: number;
    type: string;
    created_at: Date;
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
        .update(`${row.id}:${row.type}:${row.created_at.toISOString()}`)
        .digest('base64url')
        .slice(0, 12);
}

function visualValue(id: number, divisor: number) {
    return Math.abs(id) % divisor;
}

function toPublicEvent(row: LiveEventRow): LiveActivityEvent | null {
    const definition = liveEventCatalog[row.type];
    if (!definition) {
        return null;
    }

    return {
        id: publicEventId(row),
        category: definition.category,
        label: definition.label,
        title: definition.title,
        detail: definition.detail,
        occurredAt: row.created_at.toISOString(),
        lane: visualValue(row.id, 12),
        intensity: visualValue(row.id, 3) + 1,
    };
}

async function queryLiveActivitySnapshot(): Promise<LiveActivitySnapshot> {
    const database = getPool();
    if (!database) {
        return unavailableSnapshot();
    }

    try {
        const sourceTypes = liveEventTypeEntries.map((entry) => entry.type);
        const sourceCategories = liveEventTypeEntries.map(
            (entry) => entry.category,
        );
        const result = await database.query<LiveEventRow>(
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

        const events = result.rows
            .map(toPublicEvent)
            .filter((event): event is LiveActivityEvent => event !== null);
        const categoryTotals = emptyCategoryTotals();

        for (const event of events) {
            categoryTotals[event.category] += 1;
        }

        const firstEvent = events[0];
        const lastEvent = events.at(-1);

        return {
            capturedAt: new Date().toISOString(),
            windowStart: firstEvent?.occurredAt ?? null,
            windowEnd: lastEvent?.occurredAt ?? null,
            source: 'domain-events',
            events,
            categoryTotals,
        };
    } catch (error) {
        console.error(
            'Unable to load the privacy-safe live activity snapshot.',
            error instanceof Error ? error.message : 'Unknown source error',
        );
        return unavailableSnapshot();
    }
}

const getCachedLiveActivitySnapshot = unstable_cache(
    queryLiveActivitySnapshot,
    ['status-live-activity-v3'],
    { revalidate: CACHE_SECONDS },
);

export async function getLiveActivitySnapshot() {
    return getCachedLiveActivitySnapshot();
}
