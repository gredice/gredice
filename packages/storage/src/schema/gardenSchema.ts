import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./usersSchema";
import { farms } from "./farmsSchema";

export const gardens = pgTable('gardens', {
    id: serial('id').primaryKey(),
    accountId: text('account_id').notNull(),
    farmId: integer('farm_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const gardenRelations = relations(gardens, ({ one }) => ({
    account: one(accounts, {
        fields: [gardens.accountId],
        references: [accounts.id],
        relationName: 'gardenAccount',
    }),
    farm: one(farms, {
        fields: [gardens.farmId],
        references: [farms.id],
        relationName: 'gardenFarm',
    }),
}));

export type InsertGarden = typeof gardens.$inferInsert;
export type UpdateGarden =
    Partial<Omit<typeof gardens.$inferInsert, 'id' | 'farmId' | 'accountId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof gardens.$inferSelect, 'id'>;
export type SelectGarden = typeof gardens.$inferSelect;