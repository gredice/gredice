import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const socialProviderEnum = pgEnum('social_provider', ['reddit']);

export const socialPostStatusEnum = pgEnum('social_post_status', [
    'created',
    'submitting',
    'submitted',
    'published',
    'failed',
]);

export const socialPostTypeEnum = pgEnum('social_post_type', [
    'text',
    'link',
    'image',
    'video',
    'other',
]);

export const socialPosts = pgTable(
    'social_posts',
    {
        id: serial('id').primaryKey(),
        provider: socialProviderEnum('provider').notNull(),
        providerAccountKey: text('provider_account_key').notNull(),
        destination: text('destination').notNull(),
        status: socialPostStatusEnum('status').notNull().default('created'),
        postType: socialPostTypeEnum('post_type').notNull(),
        title: text('title'),
        body: text('body'),
        url: text('url'),
        providerSubmissionId: text('provider_submission_id'),
        providerPermalink: text('provider_permalink'),
        providerMetadata: jsonb('provider_metadata'),
        failureCode: text('failure_code'),
        failureMessage: text('failure_message'),
        failureMetadata: jsonb('failure_metadata'),
        submittedAt: timestamp('submitted_at'),
        publishedAt: timestamp('published_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('social_posts_provider_idx').on(table.provider),
        index('social_posts_status_idx').on(table.status),
        index('social_posts_created_at_idx').on(table.createdAt),
        index('social_posts_provider_destination_idx').on(
            table.provider,
            table.destination,
        ),
    ],
);

export type SocialProvider = (typeof socialProviderEnum.enumValues)[number];
export type SocialPostStatus = (typeof socialPostStatusEnum.enumValues)[number];
export type SocialPostType = (typeof socialPostTypeEnum.enumValues)[number];

export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type SelectSocialPost = typeof socialPosts.$inferSelect;
