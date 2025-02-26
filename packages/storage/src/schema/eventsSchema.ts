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

import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable('events', {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    version: integer('version').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('events_e_type_idx').on(table.type),
    index('events_e_aggregate_id_idx').on(table.aggregateId),
    index('events_e_created_at_idx').on(table.createdAt),
]);