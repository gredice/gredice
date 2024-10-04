import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const attributeDefinitions = pgTable('attribute_definitions', {
    id: serial('id').primaryKey(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    label: text('label'),
    entityType: text('entity_type').notNull(),
    dataType: text('data_type').notNull(),
    multiple: boolean('multiple').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

export type InsertAttributeDefinition = typeof attributeDefinitions.$inferInsert;
export type SelectAttributeDefinition = typeof attributeDefinitions.$inferSelect;

export const attributeValues = pgTable('attribute_values', {
    id: serial('id').primaryKey(),
    attributeDefinitionId: integer('attribute_definition_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    value: text('value'),
    order: text('order'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export type InsertAttributeValue = typeof attributeValues.$inferInsert;
export type SelectAttributeValue = typeof attributeValues.$inferSelect;

export const attributeValuesDefinitionRelation = relations(attributeValues, ({ one }) => ({
    definition: one(attributeDefinitions, {
        fields: [attributeValues.attributeDefinitionId],
        references: [attributeDefinitions.id],
        relationName: 'attributeDefinition',
    }),
}));

export const plants = pgTable('plants', {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

export type InsertPlant = typeof plants.$inferInsert;
export type SelectPlant = typeof plants.$inferSelect;