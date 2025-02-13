import { relations, sql } from "drizzle-orm";
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

export const gardenRelations = relations(gardens, ({ one, many }) => ({
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
    stacks: many(gardenStacks, {
        relationName: 'gardenStacks',
    })
}));

export type InsertGarden = typeof gardens.$inferInsert;
export type UpdateGarden =
    Partial<Omit<typeof gardens.$inferInsert, 'id' | 'farmId' | 'accountId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof gardens.$inferSelect, 'id'>;
export type SelectGarden = typeof gardens.$inferSelect;

export const gardenStacks = pgTable('garden_stacks', {
    id: serial('id').primaryKey(),
    gardenId: integer('garden_id').notNull(),
    positionX: integer('position_x').notNull(),
    positionY: integer('position_y').notNull(),
    blocks: text('blocks').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const gardenStackRelations = relations(gardenStacks, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenStacks.gardenId],
        references: [gardens.id],
        relationName: 'gardenStacks',
    }),
}));

export type InsertGardenStack = typeof gardenStacks.$inferInsert;
export type UpdateGardenStack =
    Partial<Omit<typeof gardenStacks.$inferInsert, 'id' | 'gardenId' | 'positionX' | 'positionY' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof gardenStacks.$inferSelect, 'id'>;
export type SelectGardenStack = typeof gardenStacks.$inferSelect;

export const gardenBlocks = pgTable('garden_blocks', {
    id: text('id').primaryKey(),
    gardenId: integer('garden_id').notNull(),
    name: text('name').notNull(),
    rotation: integer('rotation'),
    variant: integer('variant'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const gardenBlockRelations = relations(gardenBlocks, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenBlocks.gardenId],
        references: [gardens.id],
        relationName: 'gardenBlocks',
    }),
}));

export type InsertGardenBlock = typeof gardenBlocks.$inferInsert;
export type UpdateGardenBlock =
    Partial<Omit<typeof gardenBlocks.$inferInsert, 'id' | 'gardenId' | 'name' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof gardenBlocks.$inferSelect, 'id'>;
export type SelectGardenBlock = typeof gardenBlocks.$inferSelect;