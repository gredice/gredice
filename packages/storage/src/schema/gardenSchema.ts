import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { farms } from './farmsSchema';
import { accounts } from './usersSchema';

export const gardens = pgTable(
    'gardens',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        farmId: integer('farm_id')
            .notNull()
            .references(() => farms.id),
        name: text('name').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('garden_g_account_id_idx').on(table.accountId),
        index('garden_g_farm_id_idx').on(table.farmId),
        index('garden_g_is_deleted_idx').on(table.isDeleted),
    ],
);

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
    }),
    raisedBeds: many(raisedBeds, {
        relationName: 'raisedBedsGarden',
    }),
}));

export type InsertGarden = typeof gardens.$inferInsert;
export type UpdateGarden = Partial<
    Omit<
        typeof gardens.$inferInsert,
        'id' | 'farmId' | 'accountId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof gardens.$inferSelect, 'id'>;
export type SelectGarden = typeof gardens.$inferSelect;

export const gardenStacks = pgTable(
    'garden_stacks',
    {
        id: serial('id').primaryKey(),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        positionX: integer('position_x').notNull(),
        positionY: integer('position_y').notNull(),
        blocks: text('blocks').array().notNull().default(sql`'{}'::text[]`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('garden_gs_garden_id_idx').on(table.gardenId),
        index('garden_gs_is_deleted_idx').on(table.isDeleted),
    ],
);

export const gardenStackRelations = relations(gardenStacks, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenStacks.gardenId],
        references: [gardens.id],
        relationName: 'gardenStacks',
    }),
}));

export type InsertGardenStack = typeof gardenStacks.$inferInsert;
export type UpdateGardenStack = Partial<
    Omit<
        typeof gardenStacks.$inferInsert,
        | 'id'
        | 'gardenId'
        | 'positionX'
        | 'positionY'
        | 'createdAt'
        | 'updatedAt'
        | 'isDeleted'
    >
> &
    Pick<typeof gardenStacks.$inferSelect, 'id'>;
export type SelectGardenStack = typeof gardenStacks.$inferSelect;

export const gardenBlocks = pgTable(
    'garden_blocks',
    {
        id: text('id').primaryKey(),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        name: text('name').notNull(),
        rotation: integer('rotation'),
        variant: integer('variant'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('garden_gb_garden_id_idx').on(table.gardenId),
        index('garden_gb_is_deleted_idx').on(table.isDeleted),
    ],
);

export const gardenBlockRelations = relations(gardenBlocks, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenBlocks.gardenId],
        references: [gardens.id],
        relationName: 'gardenBlocks',
    }),
}));

export type InsertGardenBlock = typeof gardenBlocks.$inferInsert;
export type UpdateGardenBlock = Partial<
    Omit<
        typeof gardenBlocks.$inferInsert,
        'id' | 'gardenId' | 'name' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof gardenBlocks.$inferSelect, 'id'>;
export type SelectGardenBlock = typeof gardenBlocks.$inferSelect;

export const raisedBedOrientations = ['vertical', 'horizontal'] as const;
export type RaisedBedOrientation = (typeof raisedBedOrientations)[number];

export const raisedBeds = pgTable(
    'raised_beds',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        accountId: text('account_id').references(() => accounts.id),
        gardenId: integer('garden_id').references(() => gardens.id),
        blockId: text('block_id').references(() => gardenBlocks.id),
        orientation: text('orientation')
            .notNull()
            .default('vertical')
            .$type<RaisedBedOrientation>(),
        status: text('status').notNull().default('new'), // Possible values: 'new', 'approved', 'built'
        physicalId: text('physical_id'), // Optional physical ID for the raised bed
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('raised_beds_account_id_idx').on(table.accountId),
        index('raised_beds_garden_id_idx').on(table.gardenId),
        index('raised_beds_block_id_idx').on(table.blockId),
        index('raised_beds_is_deleted_idx').on(table.isDeleted),
    ],
);

export const raisedBedRelations = relations(raisedBeds, ({ one, many }) => ({
    account: one(accounts, {
        fields: [raisedBeds.accountId],
        references: [accounts.id],
        relationName: 'raisedBedsAccount',
    }),
    garden: one(gardens, {
        fields: [raisedBeds.gardenId],
        references: [gardens.id],
        relationName: 'raisedBedsGarden',
    }),
    block: one(gardenBlocks, {
        fields: [raisedBeds.blockId],
        references: [gardenBlocks.id],
        relationName: 'raisedBedsBlock',
    }),
    fields: many(raisedBedFields, {
        relationName: 'raisedBedFieldsRaisedBed',
    }),
}));

export type InsertRaisedBed = typeof raisedBeds.$inferInsert;
export type UpdateRaisedBed = Partial<
    Omit<
        typeof raisedBeds.$inferInsert,
        'id' | 'gardenId' | 'blockId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof raisedBeds.$inferSelect, 'id'>;
export type SelectRaisedBed = typeof raisedBeds.$inferSelect;

export const raisedBedFields = pgTable(
    'raised_bed_fields',
    {
        id: serial('id').primaryKey(),
        raisedBedId: integer('raised_bed_id')
            .notNull()
            .references(() => raisedBeds.id),
        positionIndex: integer('position_index').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('raised_bed_fields_raised_bed_id_idx').on(table.raisedBedId),
        index('raised_bed_fields_is_deleted_idx').on(table.isDeleted),
    ],
);

export const raisedBedFieldRelations = relations(
    raisedBedFields,
    ({ one }) => ({
        raisedBed: one(raisedBeds, {
            fields: [raisedBedFields.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedFieldsRaisedBed',
        }),
    }),
);

export type InsertRaisedBedField = typeof raisedBedFields.$inferInsert;
export type UpdateRaisedBedField = Partial<
    Omit<
        typeof raisedBedFields.$inferInsert,
        'id' | 'raisedBedId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof raisedBedFields.$inferSelect, 'id'>;
export type SelectRaisedBedField = typeof raisedBedFields.$inferSelect;

export const raisedBedSensors = pgTable(
    'raised_bed_sensors',
    {
        id: serial('id').primaryKey(),
        raisedBedId: integer('raised_bed_id')
            .notNull()
            .references(() => raisedBeds.id),
        status: text('status').notNull().default('new'), // Possible values: 'new', 'installed', 'active'
        sensorSignalcoId: text('sensor_signalco_id'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('raised_bed_sensors_raised_bed_id_idx').on(table.raisedBedId),
        index('raised_bed_sensors_is_deleted_idx').on(table.isDeleted),
    ],
);

export const raisedBedSensorRelations = relations(
    raisedBedSensors,
    ({ one }) => ({
        raisedBed: one(raisedBeds, {
            fields: [raisedBedSensors.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedSensorsRaisedBed',
        }),
    }),
);

export type InsertRaisedBedSensor = typeof raisedBedSensors.$inferInsert;
export type UpdateRaisedBedSensor = Partial<
    Omit<
        typeof raisedBedSensors.$inferInsert,
        'id' | 'raisedBedId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof raisedBedSensors.$inferSelect, 'id'>;
export type SelectRaisedBedSensor = typeof raisedBedSensors.$inferSelect;
