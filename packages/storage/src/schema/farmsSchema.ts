import { relations } from "drizzle-orm";
import { boolean, pgTable, serial, text, timestamp, real } from "drizzle-orm/pg-core";
import { accounts } from "./usersSchema";

export const farms = pgTable('farms', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export type InsertFarm = typeof farms.$inferInsert;
export type UpdateFarm =
    Partial<Omit<typeof farms.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof farms.$inferSelect, 'id'>;
export type SelectFarm = typeof farms.$inferSelect;