import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

export const socialProviderValues = [
    'reddit',
    'instagram',
    'facebook',
    'google_business',
    'x',
    'tiktok',
    'threads',
    'linkedin',
    'whatsapp',
] as const;

export const socialProviderEnum = pgEnum(
    'social_provider',
    socialProviderValues,
);

export const socialPostStatusValues = [
    'created',
    'queued',
    'scheduled',
    'submitting',
    'submitted',
    'published',
    'failed',
    'canceled',
] as const;

export const socialPostStatusEnum = pgEnum(
    'social_post_status',
    socialPostStatusValues,
);

export const socialPostTypeValues = [
    'text',
    'link',
    'image',
    'video',
    'reel',
    'story',
    'carousel',
    'other',
] as const;

export const socialPostTypeEnum = pgEnum(
    'social_post_type',
    socialPostTypeValues,
);

export const socialAccountStatusValues = [
    'active',
    'disabled',
    'needs_reauth',
] as const;

export const socialAccountStatusEnum = pgEnum(
    'social_account_status',
    socialAccountStatusValues,
);

export const socialAccounts = pgTable(
    'social_accounts',
    {
        id: serial('id').primaryKey(),
        provider: socialProviderEnum('provider').notNull(),
        providerAccountKey: text('provider_account_key').notNull(),
        label: text('label').notNull(),
        handle: text('handle'),
        externalAccountId: text('external_account_id'),
        status: socialAccountStatusEnum('status').notNull().default('active'),
        defaultDestination: text('default_destination'),
        allowedDestinations: jsonb('allowed_destinations'),
        credentialReference: text('credential_reference'),
        providerMetadata: jsonb('provider_metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('social_accounts_provider_account_key_idx').on(
            table.provider,
            table.providerAccountKey,
        ),
        index('social_accounts_provider_idx').on(table.provider),
        index('social_accounts_status_idx').on(table.status),
    ],
);

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
        mediaUrls: jsonb('media_urls'),
        providerSubmissionId: text('provider_submission_id'),
        providerPermalink: text('provider_permalink'),
        providerMetadata: jsonb('provider_metadata'),
        failureCode: text('failure_code'),
        failureMessage: text('failure_message'),
        failureMetadata: jsonb('failure_metadata'),
        scheduledAt: timestamp('scheduled_at'),
        queuedAt: timestamp('queued_at'),
        submittedAt: timestamp('submitted_at'),
        publishedAt: timestamp('published_at'),
        canceledAt: timestamp('canceled_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('social_posts_provider_idx').on(table.provider),
        index('social_posts_status_idx').on(table.status),
        index('social_posts_scheduled_at_idx').on(table.scheduledAt),
        index('social_posts_queued_at_idx').on(table.queuedAt),
        index('social_posts_created_at_idx').on(table.createdAt),
        index('social_posts_provider_destination_idx').on(
            table.provider,
            table.destination,
        ),
    ],
);

export type SocialProvider = (typeof socialProviderEnum.enumValues)[number];
export type SocialAccountStatus =
    (typeof socialAccountStatusEnum.enumValues)[number];
export type SocialPostStatus = (typeof socialPostStatusEnum.enumValues)[number];
export type SocialPostType = (typeof socialPostTypeEnum.enumValues)[number];

export type InsertSocialAccount = typeof socialAccounts.$inferInsert;
export type SelectSocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type SelectSocialPost = typeof socialPosts.$inferSelect;
