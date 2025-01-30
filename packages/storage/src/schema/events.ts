// Event Sourcing
// References:
//   - https://github.com/eugene-khyst/postgresql-event-sourcing
// 
// Events --Stream--> Snapshot
// TODO: Snapshotting
//   - On every nth event make aggregate snapshot
// TODO: Generating Projection:
//   - Load last snapshot
//   - Load events after snapshot and replay them

import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable('events', {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    version: integer('version').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});