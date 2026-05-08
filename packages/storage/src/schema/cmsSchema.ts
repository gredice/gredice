import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

export const attributeDefinitionCategories = pgTable(
    'attribute_definition_categories',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        label: text('label').notNull(),
        entityTypeName: text('entity_type').notNull(),
        order: text('order'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('cms_adc_entity_type_name_idx').on(table.entityTypeName),
        index('cms_adc_order_idx').on(table.order),
        index('cms_adc_is_deleted_idx').on(table.isDeleted),
    ],
);

export const attributeDefinitionCategoriesRelation = relations(
    attributeDefinitionCategories,
    ({ one }) => ({
        entityType: one(entityTypes, {
            fields: [attributeDefinitionCategories.entityTypeName],
            references: [entityTypes.name],
            relationName: 'entityType',
        }),
    }),
);

export type InsertAttributeDefinitionCategory =
    typeof attributeDefinitionCategories.$inferInsert;
export type SelectAttributeDefinitionCategory =
    typeof attributeDefinitionCategories.$inferSelect;
export type UpdateAttributeDefinitionCategory = Partial<
    Omit<
        typeof attributeDefinitionCategories.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof attributeDefinitionCategories.$inferSelect, 'id'>;

export const attributeDefinitions = pgTable(
    'attribute_definitions',
    {
        id: serial('id').primaryKey(),
        category: text('category').notNull(),
        name: text('name').notNull(),
        label: text('label').notNull(),
        description: text('description'),
        entityTypeName: text('entity_type').notNull(),
        dataType: text('data_type').notNull(),
        defaultValue: text('default_value'),
        unit: text('unit'),
        order: text('order'),
        multiple: boolean('multiple').notNull().default(false),
        required: boolean('required').notNull().default(false),
        display: boolean('display').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('cms_ad_category_idx').on(table.category),
        index('cms_ad_entity_type_name_idx').on(table.entityTypeName),
        index('cms_ad_order_idx').on(table.order),
        index('cms_ad_is_deleted_idx').on(table.isDeleted),
    ],
);

export const attributeDefinitionRelation = relations(
    attributeDefinitions,
    ({ one }) => ({
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
    }),
);

export type InsertAttributeDefinition =
    typeof attributeDefinitions.$inferInsert;
export type UpdateAttributeDefinition = Partial<
    Omit<
        typeof attributeDefinitions.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof attributeDefinitions.$inferSelect, 'id'>;
export type SelectAttributeDefinition =
    typeof attributeDefinitions.$inferSelect;
export type ExtendedAttributeDefinition = SelectAttributeDefinition & {
    categoryDefinition: SelectAttributeDefinitionCategory;
    entityType: SelectEntityType;
};

export const attributeValues = pgTable(
    'attribute_values',
    {
        id: serial('id').primaryKey(),
        attributeDefinitionId: integer('attribute_definition_id')
            .notNull()
            .references(() => attributeDefinitions.id),
        entityTypeName: text('entity_type').notNull(),
        entityId: integer('entity_id')
            .notNull()
            .references(() => entities.id),
        value: text('value'),
        order: text('order'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('cms_av_attribute_definition_id_idx').on(
            table.attributeDefinitionId,
        ),
        index('cms_av_entity_type_name_idx').on(table.entityTypeName),
        index('cms_av_entity_id_idx').on(table.entityId),
        index('cms_av_order_idx').on(table.order),
        index('cms_av_is_deleted_idx').on(table.isDeleted),
    ],
);

export const attributeValuesDefinitionRelation = relations(
    attributeValues,
    ({ one }) => ({
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
    }),
);

export type InsertAttributeValue = typeof attributeValues.$inferInsert;
export type SelectAttributeValue = typeof attributeValues.$inferSelect;

export const entityTypeCategories = pgTable(
    'entity_type_categories',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        label: text('label').notNull(),
        icon: text('icon'),
        order: text('order'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('cms_etc_order_idx').on(table.order),
        index('cms_etc_is_deleted_idx').on(table.isDeleted),
    ],
);

export const entityTypeCategoriesRelation = relations(
    entityTypeCategories,
    ({ many }) => ({
        entityTypes: many(entityTypes),
    }),
);

export type InsertEntityTypeCategory = typeof entityTypeCategories.$inferInsert;
export type UpdateEntityTypeCategory = Partial<
    Omit<
        typeof entityTypeCategories.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof entityTypeCategories.$inferSelect, 'id'>;
export type SelectEntityTypeCategory = typeof entityTypeCategories.$inferSelect;

export const entityTypes = pgTable(
    'entity_types',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        label: text('label').notNull(),
        icon: text('icon'),
        categoryId: integer('category_id').references(
            () => entityTypeCategories.id,
        ),
        order: text('order'),
        parentId: integer('parent_id').references(() => entityTypes.id),
        hierarchyOrder: integer('hierarchy_order').notNull().default(0),
        isRoot: boolean('is_root').notNull().default(true),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('cms_et_category_id_idx').on(table.categoryId),
        index('cms_et_order_idx').on(table.order),
        index('cms_et_parent_id_idx').on(table.parentId),
        index('cms_et_hierarchy_order_idx').on(table.hierarchyOrder),
        index('cms_et_is_deleted_idx').on(table.isDeleted),
        index('cms_et_is_root_idx').on(table.isRoot),
    ],
);

export const entityTypesRelation = relations(entityTypes, ({ one, many }) => ({
    category: one(entityTypeCategories, {
        fields: [entityTypes.categoryId],
        references: [entityTypeCategories.id],
        relationName: 'category',
    }),
    attributeDefinitions: many(attributeDefinitions),
    attributeDefinitionCategories: many(attributeDefinitionCategories),
    entities: many(entities),
    parent: one(entityTypes, {
        fields: [entityTypes.parentId],
        references: [entityTypes.id],
        relationName: 'entityTypeHierarchy',
    }),
    children: many(entityTypes, {
        relationName: 'entityTypeHierarchy',
    }),
}));

export type InsertEntityType = typeof entityTypes.$inferInsert;
export type UpdateEntityType = Partial<
    Omit<
        typeof entityTypes.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof entityTypes.$inferSelect, 'id'>;
export type SelectEntityType = typeof entityTypes.$inferSelect;

export const entities = pgTable(
    'entities',
    {
        id: serial('id').primaryKey(),
        entityTypeName: text('entity_type').notNull(),
        parentId: integer('parent_id').references(() => entities.id),
        hierarchyOrder: integer('hierarchy_order').notNull().default(0),
        state: text('state').notNull().default('draft'),
        publishedAt: timestamp('published_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('cms_e_entity_type_name_idx').on(table.entityTypeName),
        index('cms_e_parent_id_idx').on(table.parentId),
        index('cms_e_hierarchy_order_idx').on(table.hierarchyOrder),
        index('cms_e_state_idx').on(table.state),
        index('cms_e_is_deleted_idx').on(table.isDeleted),
    ],
);

export const entityRelation = relations(entities, ({ one, many }) => ({
    attributes: many(attributeValues),
    entityType: one(entityTypes, {
        fields: [entities.entityTypeName],
        references: [entityTypes.name],
        relationName: 'entityType',
    }),
    parent: one(entities, {
        fields: [entities.parentId],
        references: [entities.id],
        relationName: 'entityHierarchy',
    }),
    children: many(entities, {
        relationName: 'entityHierarchy',
    }),
}));

export type InsertEntity = typeof entities.$inferInsert;
export type UpdateEntity = Partial<
    Omit<
        typeof entities.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof entities.$inferSelect, 'id'>;
export type SelectEntity = typeof entities.$inferSelect;

export const cmsPages = pgTable(
    'cms_pages',
    {
        id: serial('id').primaryKey(),
        slug: text('slug').notNull(),
        title: text('title').notNull(),
        content: text('content'),
        state: text('state').notNull().default('draft'),
        publishedAt: timestamp('published_at'),
        metaTitle: text('meta_title'),
        metaDescription: text('meta_description'),
        metaImageUrl: text('meta_image_url'),
        canonicalPath: text('canonical_path'),
        noIndex: boolean('no_index').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        uniqueIndex('cms_pages_slug_active_uq')
            .on(table.slug)
            .where(sql`${table.isDeleted} = false`),
        index('cms_pages_state_idx').on(table.state),
        index('cms_pages_published_at_idx').on(table.publishedAt),
        index('cms_pages_is_deleted_idx').on(table.isDeleted),
    ],
);

export type InsertCmsPage = typeof cmsPages.$inferInsert;
export type UpdateCmsPage = Partial<
    Omit<
        typeof cmsPages.$inferInsert,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof cmsPages.$inferSelect, 'id'>;
export type SelectCmsPage = typeof cmsPages.$inferSelect;

export const cmsPageRevisions = pgTable(
    'cms_page_revisions',
    {
        id: serial('id').primaryKey(),
        cmsPageId: integer('cms_page_id')
            .notNull()
            .references(() => cmsPages.id),
        action: text('action').notNull(),
        actorId: text('actor_id'),
        actorName: text('actor_name'),
        previousSlug: text('previous_slug'),
        nextSlug: text('next_slug'),
        previousTitle: text('previous_title'),
        nextTitle: text('next_title'),
        previousContent: text('previous_content'),
        nextContent: text('next_content'),
        previousState: text('previous_state'),
        nextState: text('next_state'),
        previousMetaTitle: text('previous_meta_title'),
        nextMetaTitle: text('next_meta_title'),
        previousMetaDescription: text('previous_meta_description'),
        nextMetaDescription: text('next_meta_description'),
        previousMetaImageUrl: text('previous_meta_image_url'),
        nextMetaImageUrl: text('next_meta_image_url'),
        previousCanonicalPath: text('previous_canonical_path'),
        nextCanonicalPath: text('next_canonical_path'),
        previousNoIndex: boolean('previous_no_index'),
        nextNoIndex: boolean('next_no_index'),
        previousPublishedAt: timestamp('previous_published_at'),
        nextPublishedAt: timestamp('next_published_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('cms_page_revisions_page_id_idx').on(table.cmsPageId),
        index('cms_page_revisions_action_idx').on(table.action),
        index('cms_page_revisions_created_at_idx').on(table.createdAt),
    ],
);

export type InsertCmsPageRevision = typeof cmsPageRevisions.$inferInsert;
export type SelectCmsPageRevision = typeof cmsPageRevisions.$inferSelect;

export const entityRevisions = pgTable(
    'entity_revisions',
    {
        id: serial('id').primaryKey(),
        entityId: integer('entity_id')
            .notNull()
            .references(() => entities.id),
        entityTypeName: text('entity_type').notNull(),
        action: text('action').notNull(),
        actorId: text('actor_id'),
        actorName: text('actor_name'),
        attributeValueId: integer('attribute_value_id'),
        attributeDefinitionId: integer('attribute_definition_id'),
        previousValue: text('previous_value'),
        nextValue: text('next_value'),
        previousState: text('previous_state'),
        nextState: text('next_state'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('cms_er_entity_id_idx').on(table.entityId),
        index('cms_er_entity_type_name_idx').on(table.entityTypeName),
        index('cms_er_action_idx').on(table.action),
    ],
);

export type InsertEntityRevision = typeof entityRevisions.$inferInsert;
export type SelectEntityRevision = typeof entityRevisions.$inferSelect;
