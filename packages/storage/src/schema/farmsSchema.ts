import { boolean, pgTable, serial, text, timestamp, real, index } from "drizzle-orm/pg-core";

export const farms = pgTable('farms', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('farms_f_is_deleted_idx').on(table.isDeleted),
]);

export type InsertFarm = Omit<typeof farms.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>;
export type UpdateFarm =
    Partial<Omit<typeof farms.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof farms.$inferSelect, 'id'>;
export type SelectFarm = typeof farms.$inferSelect;