import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { attributeDefinitions, attributeValues, entities } from './cmsSchema';
import { users } from './usersSchema';

export const communityEditRequests = pgTable(
    'community_edit_requests',
    {
        id: serial('id').primaryKey(),
        status: text('status').notNull().default('pending'),
        entityTypeName: text('entity_type').notNull(),
        entityId: integer('entity_id')
            .notNull()
            .references(() => entities.id),
        publicPath: text('public_path').notNull(),
        sectionKey: text('section_key'),
        submitterUserId: text('submitter_user_id')
            .notNull()
            .references(() => users.id),
        submitterName: text('submitter_name'),
        submitterEmail: text('submitter_email'),
        submitterNote: text('submitter_note'),
        reviewerUserId: text('reviewer_user_id').references(() => users.id),
        reviewerName: text('reviewer_name'),
        reviewerNote: text('reviewer_note'),
        applicationFailureReason: text('application_failure_reason'),
        reviewedAt: timestamp('reviewed_at'),
        appliedAt: timestamp('applied_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('community_edit_requests_status_idx').on(table.status),
        index('community_edit_requests_entity_type_idx').on(
            table.entityTypeName,
        ),
        index('community_edit_requests_entity_id_idx').on(table.entityId),
        index('community_edit_requests_submitter_idx').on(
            table.submitterUserId,
        ),
        index('community_edit_requests_created_at_idx').on(table.createdAt),
    ],
);

export const communityEditRequestChanges = pgTable(
    'community_edit_request_changes',
    {
        id: serial('id').primaryKey(),
        requestId: integer('request_id')
            .notNull()
            .references(() => communityEditRequests.id),
        fieldKey: text('field_key').notNull(),
        sectionKey: text('section_key'),
        attributeDefinitionId: integer('attribute_definition_id')
            .notNull()
            .references(() => attributeDefinitions.id),
        attributeValueId: integer('attribute_value_id').references(
            () => attributeValues.id,
        ),
        attributePath: text('attribute_path').notNull(),
        dataType: text('data_type').notNull(),
        previousValue: text('previous_value'),
        proposedValue: text('proposed_value'),
        baseValueHash: text('base_value_hash').notNull(),
        valuePatch: text('value_patch'),
        reviewDiff: text('review_diff'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('community_edit_changes_request_id_idx').on(table.requestId),
        index('community_edit_changes_field_key_idx').on(table.fieldKey),
        index('community_edit_changes_attribute_definition_idx').on(
            table.attributeDefinitionId,
        ),
    ],
);

export const communityEditRequestsRelation = relations(
    communityEditRequests,
    ({ many, one }) => ({
        changes: many(communityEditRequestChanges),
        entity: one(entities, {
            fields: [communityEditRequests.entityId],
            references: [entities.id],
        }),
        submitter: one(users, {
            fields: [communityEditRequests.submitterUserId],
            references: [users.id],
            relationName: 'communityEditSubmitter',
        }),
        reviewer: one(users, {
            fields: [communityEditRequests.reviewerUserId],
            references: [users.id],
            relationName: 'communityEditReviewer',
        }),
    }),
);

export const communityEditRequestChangesRelation = relations(
    communityEditRequestChanges,
    ({ one }) => ({
        request: one(communityEditRequests, {
            fields: [communityEditRequestChanges.requestId],
            references: [communityEditRequests.id],
        }),
        attributeDefinition: one(attributeDefinitions, {
            fields: [communityEditRequestChanges.attributeDefinitionId],
            references: [attributeDefinitions.id],
        }),
        attributeValue: one(attributeValues, {
            fields: [communityEditRequestChanges.attributeValueId],
            references: [attributeValues.id],
        }),
    }),
);

export type InsertCommunityEditRequest =
    typeof communityEditRequests.$inferInsert;
export type SelectCommunityEditRequest =
    typeof communityEditRequests.$inferSelect;
export type InsertCommunityEditRequestChange =
    typeof communityEditRequestChanges.$inferInsert;
export type SelectCommunityEditRequestChange =
    typeof communityEditRequestChanges.$inferSelect;
