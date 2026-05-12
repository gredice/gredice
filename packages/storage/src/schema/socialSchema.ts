import {
    index,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const socialPostProviderEnum = pgEnum('social_post_provider', [
    'reddit',
]);

export const socialPostTypeEnum = pgEnum('social_post_type', ['text', 'link']);

export const socialPostStatusEnum = pgEnum('social_post_status', [
    'draft',
    'submitting',
    'published',
    'failed',
]);

export const socialPosts = pgTable(
    'social_posts',
    {
        id: serial('id').primaryKey(),
        provider: socialPostProviderEnum('provider')
            .notNull()
            .default('reddit'),
        subreddit: text('subreddit').notNull(),
        postType: socialPostTypeEnum('post_type').notNull(),
        title: text('title').notNull(),
        bodyText: text('body_text'),
        url: text('url'),
        status: socialPostStatusEnum('status').notNull().default('draft'),
        redditSubmissionId: text('reddit_submission_id'),
        redditPermalink: text('reddit_permalink'),
        failureReason: text('failure_reason'),
        failureCode: text('failure_code'),
        failureContext: text('failure_context'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('social_posts_provider_idx').on(table.provider),
        index('social_posts_subreddit_idx').on(table.subreddit),
        index('social_posts_status_idx').on(table.status),
        index('social_posts_created_at_idx').on(table.createdAt),
    ],
);

export type SocialPostProvider =
    (typeof socialPostProviderEnum.enumValues)[number];
export type SocialPostType = (typeof socialPostTypeEnum.enumValues)[number];
export type SocialPostStatus = (typeof socialPostStatusEnum.enumValues)[number];

export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type SelectSocialPost = typeof socialPosts.$inferSelect;
