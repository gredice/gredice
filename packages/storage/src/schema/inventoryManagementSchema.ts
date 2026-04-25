import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { entities, entityTypes } from './cmsSchema';

export const inventoryConfigs = pgTable(
    'inventory_configs',
    {
        id: serial('id').primaryKey(),
        entityTypeName: text('entity_type_name').notNull(),
        label: text('label').notNull(),
        defaultTrackingType: text('default_tracking_type')
            .notNull()
            .default('pieces'), // 'pieces' | 'serialNumber'
        statusAttributeName: text('status_attribute_name'),
        emptyStatusValue: text('empty_status_value'),
        amountAttributeName: text('amount_attribute_name'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('inv_configs_entity_type_name_idx').on(table.entityTypeName),
        index('inv_configs_is_deleted_idx').on(table.isDeleted),
    ],
);

export const inventoryConfigRelations = relations(
    inventoryConfigs,
    ({ one, many }) => ({
        entityType: one(entityTypes, {
            fields: [inventoryConfigs.entityTypeName],
            references: [entityTypes.name],
            relationName: 'entityType',
        }),
        items: many(inventoryItems, {
            relationName: 'inventoryConfigItems',
        }),
        fieldDefinitions: many(inventoryItemFieldDefinitions, {
            relationName: 'inventoryConfigFieldDefinitions',
        }),
    }),
);

export type InsertInventoryConfig = typeof inventoryConfigs.$inferInsert;
export type UpdateInventoryConfig = Partial<
    Omit<
        typeof inventoryConfigs.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof inventoryConfigs.$inferSelect, 'id'>;
export type SelectInventoryConfig = typeof inventoryConfigs.$inferSelect;

export const inventoryItemFieldDefinitions = pgTable(
    'inventory_item_field_definitions',
    {
        id: serial('id').primaryKey(),
        inventoryConfigId: integer('inventory_config_id')
            .notNull()
            .references(() => inventoryConfigs.id),
        name: text('name').notNull(),
        label: text('label').notNull(),
        dataType: text('data_type').notNull().default('text'), // 'text' | 'number' | 'date' | 'boolean'
        required: boolean('required').notNull().default(false),
        order: text('order'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('inv_field_defs_inventory_config_id_idx').on(
            table.inventoryConfigId,
        ),
        index('inv_field_defs_is_deleted_idx').on(table.isDeleted),
    ],
);

export const inventoryItemFieldDefinitionRelations = relations(
    inventoryItemFieldDefinitions,
    ({ one }) => ({
        inventoryConfig: one(inventoryConfigs, {
            fields: [inventoryItemFieldDefinitions.inventoryConfigId],
            references: [inventoryConfigs.id],
            relationName: 'inventoryConfigFieldDefinitions',
        }),
    }),
);

export type InsertInventoryItemFieldDefinition =
    typeof inventoryItemFieldDefinitions.$inferInsert;
export type UpdateInventoryItemFieldDefinition = Partial<
    Omit<
        typeof inventoryItemFieldDefinitions.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof inventoryItemFieldDefinitions.$inferSelect, 'id'>;
export type SelectInventoryItemFieldDefinition =
    typeof inventoryItemFieldDefinitions.$inferSelect;

export const inventoryItems = pgTable(
    'inventory_items',
    {
        id: serial('id').primaryKey(),
        inventoryConfigId: integer('inventory_config_id')
            .notNull()
            .references(() => inventoryConfigs.id),
        entityId: integer('entity_id').references(() => entities.id),
        trackingType: text('tracking_type').notNull().default('pieces'), // 'pieces' | 'serialNumber'
        serialNumber: text('serial_number'),
        quantity: integer('quantity').notNull().default(1),
        additionalFields:
            jsonb('additional_fields').$type<Record<string, unknown>>(), // configurable extra fields (e.g., expiry date)
        notes: text('notes'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('inv_items_inventory_config_id_idx').on(table.inventoryConfigId),
        index('inv_items_entity_id_idx').on(table.entityId),
        index('inv_items_is_deleted_idx').on(table.isDeleted),
        index('inv_items_tracking_type_idx').on(table.trackingType),
    ],
);

export const inventoryItemRelations = relations(
    inventoryItems,
    ({ one, many }) => ({
        inventoryConfig: one(inventoryConfigs, {
            fields: [inventoryItems.inventoryConfigId],
            references: [inventoryConfigs.id],
            relationName: 'inventoryConfigItems',
        }),
        entity: one(entities, {
            fields: [inventoryItems.entityId],
            references: [entities.id],
            relationName: 'entity',
        }),
        events: many(inventoryItemEvents, {
            relationName: 'inventoryItemEvents',
        }),
    }),
);

export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type UpdateInventoryItem = Partial<
    Omit<
        typeof inventoryItems.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof inventoryItems.$inferSelect, 'id'>;
export type SelectInventoryItem = typeof inventoryItems.$inferSelect;

export const inventoryItemEvents = pgTable(
    'inventory_item_events',
    {
        id: serial('id').primaryKey(),
        inventoryItemId: integer('inventory_item_id')
            .notNull()
            .references(() => inventoryItems.id),
        action: text('action').notNull(),
        previousQuantity: integer('previous_quantity'),
        newQuantity: integer('new_quantity'),
        previousState: text('previous_state'),
        newState: text('new_state'),
        notes: text('notes'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('inv_item_events_inventory_item_id_idx').on(
            table.inventoryItemId,
        ),
        index('inv_item_events_is_deleted_idx').on(table.isDeleted),
    ],
);

export const inventoryItemEventRelations = relations(
    inventoryItemEvents,
    ({ one }) => ({
        inventoryItem: one(inventoryItems, {
            fields: [inventoryItemEvents.inventoryItemId],
            references: [inventoryItems.id],
            relationName: 'inventoryItemEvents',
        }),
    }),
);

export type InsertInventoryItemEvent = typeof inventoryItemEvents.$inferInsert;
export type SelectInventoryItemEvent = typeof inventoryItemEvents.$inferSelect;
