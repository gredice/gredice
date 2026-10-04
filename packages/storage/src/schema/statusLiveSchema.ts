import { sql } from 'drizzle-orm';
import {
    check,
    index,
    integer,
    pgTable,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const statusLiveEvents = pgTable(
    'status_live_events',
    {
        id: text('id').primaryKey(),
        source: text('source').notNull(),
        type: text('type').notNull(),
        occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
        eventCount: integer('event_count').notNull().default(1),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            'status_live_events_source_check',
            sql`${table.source} in ('vercel', 'github')`,
        ),
        check(
            'status_live_events_event_count_check',
            sql`${table.eventCount} > 0`,
        ),
        index('status_live_events_occurred_at_idx').on(table.occurredAt),
        index('status_live_events_source_occurred_at_idx').on(
            table.source,
            table.occurredAt,
        ),
    ],
);

export const statusLiveIngestDeliveries = pgTable(
    'status_live_ingest_deliveries',
    {
        id: text('id').primaryKey(),
        source: text('source').notNull(),
        receivedAt: timestamp('received_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            'status_live_ingest_deliveries_source_check',
            sql`${table.source} in ('vercel', 'github')`,
        ),
        index('status_live_ingest_deliveries_received_at_idx').on(
            table.receivedAt,
        ),
    ],
);
