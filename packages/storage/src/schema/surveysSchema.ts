import { sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { notifications } from './notificationsSchema';
import { accounts, users } from './usersSchema';

export const surveyStatusEnum = pgEnum('survey_status', [
    'draft',
    'published',
    'archived',
]);

export const surveyVersionStatusEnum = pgEnum('survey_version_status', [
    'draft',
    'published',
    'archived',
]);

export const surveyQuestionTypeEnum = pgEnum('survey_question_type', [
    'opinion_scale',
    'long_text',
    'contact_info',
]);

export const surveyAssignmentStatusEnum = pgEnum('survey_assignment_status', [
    'pending',
    'started',
    'submitted',
    'expired',
    'canceled',
]);

export const surveyResponseSourceEnum = pgEnum('survey_response_source', [
    'in_app',
    'typeform',
    'admin_import',
]);

export const surveySendStatusEnum = pgEnum('survey_send_status', [
    'draft',
    'scheduled',
    'sent',
    'canceled',
    'failed',
]);

export const surveySendDeliveryChannelEnum = pgEnum(
    'survey_send_delivery_channel',
    ['in_app', 'email'],
);

export const surveySendDeliveryStatusEnum = pgEnum(
    'survey_send_delivery_status',
    ['queued', 'sent', 'failed', 'skipped'],
);

export type SurveyQuestionSettings =
    | {
          type: 'opinion_scale';
          min: number;
          max: number;
          step?: number;
          minLabel?: string | null;
          maxLabel?: string | null;
      }
    | {
          type: 'long_text';
          maxLength?: number;
          placeholder?: string | null;
      }
    | {
          type: 'contact_info';
          fields: Array<'first_name' | 'last_name' | 'phone' | 'email'>;
          phoneDefaultCountry?: string | null;
      };

export type SurveyQuestionScoreMetadata = {
    internalScore?: boolean;
    publicScore?: boolean;
    npsLike?: boolean;
};

export type SurveyAssignmentContext = Record<string, unknown> & {
    deliveryRequestIds?: string[];
    operationIds?: number[];
    monthKey?: string;
    fulfillmentPeriod?: {
        from?: string;
        to?: string;
    };
    sourceWorkflow?: string;
};

export type SurveySendAudience =
    | {
          type: 'accounts';
          accountIds: string[];
      }
    | {
          type: 'users';
          userIds: string[];
          accountIds?: string[];
      }
    | {
          type: 'explicit';
          recipients: Array<{
              accountId: string;
              userId?: string | null;
          }>;
      };

export type SurveySendChannelPolicy = {
    inApp: boolean;
    email: boolean;
};

export type SurveyContactAnswer = {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
};

export const surveys = pgTable(
    'surveys',
    {
        id: text('id').primaryKey(),
        key: text('key').notNull(),
        title: text('title').notNull(),
        description: text('description'),
        category: text('category').notNull().default('general'),
        status: surveyStatusEnum('status').notNull().default('draft'),
        activeVersionId: text('active_version_id'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdByUserId: text('created_by_user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        archivedAt: timestamp('archived_at'),
    },
    (table) => [
        uniqueIndex('surveys_key_unique').on(table.key),
        index('surveys_status_idx').on(table.status),
        index('surveys_category_idx').on(table.category),
    ],
);

export const surveyVersions = pgTable(
    'survey_versions',
    {
        id: text('id').primaryKey(),
        surveyId: text('survey_id')
            .notNull()
            .references(() => surveys.id, { onDelete: 'cascade' }),
        versionNumber: integer('version_number').notNull(),
        status: surveyVersionStatusEnum('status').notNull().default('draft'),
        title: text('title').notNull(),
        description: text('description'),
        introTitle: text('intro_title'),
        introDescription: text('intro_description'),
        thankYouTitle: text('thank_you_title'),
        thankYouDescription: text('thank_you_description'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        publishedAt: timestamp('published_at'),
        archivedAt: timestamp('archived_at'),
    },
    (table) => [
        uniqueIndex('survey_versions_survey_number_unique').on(
            table.surveyId,
            table.versionNumber,
        ),
        index('survey_versions_survey_status_idx').on(
            table.surveyId,
            table.status,
        ),
    ],
);

export const surveyQuestions = pgTable(
    'survey_questions',
    {
        id: text('id').primaryKey(),
        versionId: text('version_id')
            .notNull()
            .references(() => surveyVersions.id, { onDelete: 'cascade' }),
        key: text('key').notNull(),
        type: surveyQuestionTypeEnum('type').notNull(),
        title: text('title').notNull(),
        description: text('description'),
        sortOrder: integer('sort_order').notNull(),
        required: boolean('required').notNull().default(false),
        settings: jsonb('settings').$type<SurveyQuestionSettings>().notNull(),
        scoreMetadata: jsonb('score_metadata')
            .$type<SurveyQuestionScoreMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('survey_questions_version_key_unique').on(
            table.versionId,
            table.key,
        ),
        uniqueIndex('survey_questions_version_order_unique').on(
            table.versionId,
            table.sortOrder,
        ),
        index('survey_questions_version_idx').on(table.versionId),
    ],
);

export const surveySends = pgTable(
    'survey_sends',
    {
        id: text('id').primaryKey(),
        surveyId: text('survey_id')
            .notNull()
            .references(() => surveys.id, { onDelete: 'restrict' }),
        versionId: text('version_id')
            .notNull()
            .references(() => surveyVersions.id, { onDelete: 'restrict' }),
        status: surveySendStatusEnum('status').notNull().default('draft'),
        name: text('name').notNull(),
        audience: jsonb('audience').$type<SurveySendAudience>().notNull(),
        channelPolicy: jsonb('channel_policy')
            .$type<SurveySendChannelPolicy>()
            .notNull(),
        contextKey: text('context_key').notNull(),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        targetCount: integer('target_count').notNull().default(0),
        assignedCount: integer('assigned_count').notNull().default(0),
        skippedDuplicateCount: integer('skipped_duplicate_count')
            .notNull()
            .default(0),
        failedCount: integer('failed_count').notNull().default(0),
        createdByUserId: text('created_by_user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        createdFromAccountId: text('created_from_account_id').references(
            () => accounts.id,
            { onDelete: 'set null' },
        ),
        scheduledAt: timestamp('scheduled_at'),
        sentAt: timestamp('sent_at'),
        canceledAt: timestamp('canceled_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('survey_sends_survey_idx').on(table.surveyId),
        index('survey_sends_version_idx').on(table.versionId),
        index('survey_sends_status_idx').on(table.status),
        index('survey_sends_context_key_idx').on(table.contextKey),
    ],
);

export const surveyAssignments = pgTable(
    'survey_assignments',
    {
        id: text('id').primaryKey(),
        surveyId: text('survey_id')
            .notNull()
            .references(() => surveys.id, { onDelete: 'restrict' }),
        versionId: text('version_id')
            .notNull()
            .references(() => surveyVersions.id, { onDelete: 'restrict' }),
        sendId: text('send_id').references(() => surveySends.id, {
            onDelete: 'set null',
        }),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        userId: text('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        targetKey: text('target_key').notNull(),
        contextKey: text('context_key').notNull(),
        status: surveyAssignmentStatusEnum('status')
            .notNull()
            .default('pending'),
        context: jsonb('context')
            .$type<SurveyAssignmentContext>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        expiresAt: timestamp('expires_at'),
        openedAt: timestamp('opened_at'),
        startedAt: timestamp('started_at'),
        submittedAt: timestamp('submitted_at'),
        canceledAt: timestamp('canceled_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('survey_assignments_version_target_context_unique').on(
            table.versionId,
            table.targetKey,
            table.contextKey,
        ),
        index('survey_assignments_survey_idx').on(table.surveyId),
        index('survey_assignments_version_idx').on(table.versionId),
        index('survey_assignments_account_idx').on(table.accountId),
        index('survey_assignments_user_idx').on(table.userId),
        index('survey_assignments_status_idx').on(table.status),
        index('survey_assignments_send_idx').on(table.sendId),
    ],
);

export const surveyResponses = pgTable(
    'survey_responses',
    {
        id: text('id').primaryKey(),
        assignmentId: text('assignment_id').references(
            () => surveyAssignments.id,
            { onDelete: 'set null' },
        ),
        surveyId: text('survey_id')
            .notNull()
            .references(() => surveys.id, { onDelete: 'restrict' }),
        versionId: text('version_id')
            .notNull()
            .references(() => surveyVersions.id, { onDelete: 'restrict' }),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        userId: text('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        source: surveyResponseSourceEnum('source').notNull().default('in_app'),
        status: surveyAssignmentStatusEnum('status')
            .notNull()
            .default('submitted'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        importedExternalId: text('imported_external_id'),
        startedAt: timestamp('started_at'),
        submittedAt: timestamp('submitted_at').notNull().defaultNow(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('survey_responses_assignment_unique').on(
            table.assignmentId,
        ),
        uniqueIndex('survey_responses_imported_external_unique').on(
            table.importedExternalId,
        ),
        index('survey_responses_survey_idx').on(table.surveyId),
        index('survey_responses_version_idx').on(table.versionId),
        index('survey_responses_account_idx').on(table.accountId),
        index('survey_responses_user_idx').on(table.userId),
        index('survey_responses_source_idx').on(table.source),
        index('survey_responses_submitted_at_idx').on(table.submittedAt),
    ],
);

export const surveyAnswers = pgTable(
    'survey_answers',
    {
        id: text('id').primaryKey(),
        responseId: text('response_id')
            .notNull()
            .references(() => surveyResponses.id, { onDelete: 'cascade' }),
        questionId: text('question_id')
            .notNull()
            .references(() => surveyQuestions.id, { onDelete: 'restrict' }),
        questionKey: text('question_key').notNull(),
        type: surveyQuestionTypeEnum('type').notNull(),
        numericValue: integer('numeric_value'),
        textValue: text('text_value'),
        contactValue: jsonb('contact_value').$type<SurveyContactAnswer>(),
        skipped: boolean('skipped').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('survey_answers_response_question_unique').on(
            table.responseId,
            table.questionId,
        ),
        index('survey_answers_response_idx').on(table.responseId),
        index('survey_answers_question_idx').on(table.questionId),
        index('survey_answers_question_key_idx').on(table.questionKey),
    ],
);

export const surveySendDeliveries = pgTable(
    'survey_send_deliveries',
    {
        id: text('id').primaryKey(),
        sendId: text('send_id')
            .notNull()
            .references(() => surveySends.id, { onDelete: 'cascade' }),
        assignmentId: text('assignment_id').references(
            () => surveyAssignments.id,
            { onDelete: 'set null' },
        ),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        userId: text('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        channel: surveySendDeliveryChannelEnum('channel').notNull(),
        status: surveySendDeliveryStatusEnum('status').notNull(),
        email: text('email'),
        notificationId: text('notification_id').references(
            () => notifications.id,
            { onDelete: 'set null' },
        ),
        errorMessage: text('error_message'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('survey_send_deliveries_send_idx').on(table.sendId),
        index('survey_send_deliveries_assignment_idx').on(table.assignmentId),
        index('survey_send_deliveries_status_idx').on(table.status),
        index('survey_send_deliveries_notification_idx').on(
            table.notificationId,
        ),
    ],
);

export type InsertSurvey = typeof surveys.$inferInsert;
export type SelectSurvey = typeof surveys.$inferSelect;
export type InsertSurveyVersion = typeof surveyVersions.$inferInsert;
export type SelectSurveyVersion = typeof surveyVersions.$inferSelect;
export type InsertSurveyQuestion = typeof surveyQuestions.$inferInsert;
export type SelectSurveyQuestion = typeof surveyQuestions.$inferSelect;
export type InsertSurveyAssignment = typeof surveyAssignments.$inferInsert;
export type SelectSurveyAssignment = typeof surveyAssignments.$inferSelect;
export type InsertSurveyResponse = typeof surveyResponses.$inferInsert;
export type SelectSurveyResponse = typeof surveyResponses.$inferSelect;
export type InsertSurveyAnswer = typeof surveyAnswers.$inferInsert;
export type SelectSurveyAnswer = typeof surveyAnswers.$inferSelect;
export type InsertSurveySend = typeof surveySends.$inferInsert;
export type SelectSurveySend = typeof surveySends.$inferSelect;
export type InsertSurveySendDelivery = typeof surveySendDeliveries.$inferInsert;
export type SelectSurveySendDelivery = typeof surveySendDeliveries.$inferSelect;
