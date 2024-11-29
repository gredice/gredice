import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const attributeDefinitionCategories = pgTable('attribute_definition_categories', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    label: text('label').notNull(),
    entityTypeName: text('entity_type').notNull(),
    order: text('order'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const attributeDefinitionCategoriesRelation = relations(attributeDefinitionCategories, ({ one }) => ({
    entityType: one(entityTypes, {
        fields: [attributeDefinitionCategories.entityTypeName],
        references: [entityTypes.name],
        relationName: 'entityType',
    }),
}));

export type InsertAttributeDefinitionCategory = typeof attributeDefinitionCategories.$inferInsert;
export type SelectAttributeDefinitionCategory = typeof attributeDefinitionCategories.$inferSelect;
export type UpdateAttributeDefinitionCategory =
    Partial<Omit<typeof attributeDefinitionCategories.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof attributeDefinitionCategories.$inferSelect, 'id'>;

export const attributeDefinitions = pgTable('attribute_definitions', {
    id: serial('id').primaryKey(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    entityTypeName: text('entity_type').notNull(),
    dataType: text('data_type').notNull(),
    defaultValue: text('default_value'),
    order: text('order'),
    multiple: boolean('multiple').notNull().default(false),
    required: boolean('required').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const attributeDefinitionRelation = relations(attributeDefinitions, ({ one }) => ({
    categoryDefinition: one(attributeDefinitionCategories, {
        fields: [attributeDefinitions.category],
        references: [attributeDefinitionCategories.name],
        relationName: 'category',
    }),
    entityType: one(entityTypes, {
        fields: [attributeDefinitions.entityTypeName],
        references: [entityTypes.name],
        relationName: 'entityType',
    }),
}));

export type InsertAttributeDefinition = typeof attributeDefinitions.$inferInsert;
export type UpdateAttributeDefinition =
    Partial<Omit<typeof attributeDefinitions.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof attributeDefinitions.$inferSelect, 'id'>;
export type SelectAttributeDefinition = typeof attributeDefinitions.$inferSelect;
export type ExtendedAttributeDefinition = SelectAttributeDefinition & {
    categoryDefinition: SelectAttributeDefinitionCategory,
    entityType: SelectEntityType
};

export const attributeValues = pgTable('attribute_values', {
    id: serial('id').primaryKey(),
    attributeDefinitionId: integer('attribute_definition_id').notNull(),
    entityTypeName: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    value: text('value'),
    order: text('order'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const attributeValuesDefinitionRelation = relations(attributeValues, ({ one }) => ({
    attributeDefinition: one(attributeDefinitions, {
        fields: [attributeValues.attributeDefinitionId],
        references: [attributeDefinitions.id],
        relationName: 'attributeDefinition',
    }),
    entity: one(entities, {
        fields: [attributeValues.entityId],
        references: [entities.id],
        relationName: 'entity',
    }),
    entityType: one(entityTypes, {
        fields: [attributeValues.entityTypeName],
        references: [entityTypes.name],
        relationName: 'entityType',
    }),
}));

export type InsertAttributeValue = typeof attributeValues.$inferInsert;
export type SelectAttributeValue = typeof attributeValues.$inferSelect;

export const entityTypes = pgTable('entity_types', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    label: text('label').notNull(),
    order: text('order'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export type InsertEntityType = typeof entityTypes.$inferInsert;
export type UpdateEntityType =
    Partial<Omit<typeof entityTypes.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof entityTypes.$inferSelect, 'id'>;
export type SelectEntityType = typeof entityTypes.$inferSelect;

export const entities = pgTable('entities', {
    id: serial('id').primaryKey(),
    entityTypeName: text('entity_type').notNull(),
    state: text('state').notNull().default('draft'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
});

export const entityRelation = relations(entities, ({ one, many }) => ({
    attributes: many(attributeValues),
    entityType: one(entityTypes, {
        fields: [entities.entityTypeName],
        references: [entityTypes.name],
        relationName: 'entityType',
    }),
}));

export type InsertEntity = typeof entities.$inferInsert;
export type UpdateEntity =
    Partial<Omit<typeof entities.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof entities.$inferSelect, 'id'>;
export type SelectEntity = typeof entities.$inferSelect;
