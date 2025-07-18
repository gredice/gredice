import { boolean, index, integer, pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const operations = pgTable('operations', {
    id: serial('id').primaryKey(),
    entityId: integer('entity_id').notNull(),
    entityTypeName: text('entity_type_name').notNull(),
    accountId: text('account_id').notNull(),
    gardenId: integer('garden_id'),
    raisedBedId: integer('raised_bed_id'),
    raisedBedFieldId: integer('raised_bed_field_id'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('operations_entity_id_idx').on(table.entityId),
    index('operations_entity_type_name_idx').on(table.entityTypeName),
    index('operations_account_id_idx').on(table.accountId),
    index('operations_garden_id_idx').on(table.gardenId),
    index('operations_raised_bed_id_idx').on(table.raisedBedId),
    index('operations_raised_bed_field_id_idx').on(table.raisedBedFieldId),
    index('operations_timestamp_idx').on(table.timestamp),
    index('operations_is_deleted_idx').on(table.isDeleted),
]);

export type InsertOperation = Omit<typeof operations.$inferInsert, 'id' | 'createdAt'>;
export type SelectOperation = typeof operations.$inferSelect;
