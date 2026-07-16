import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    check,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { gardenBlocks, gardens, raisedBeds } from './gardenSchema';
import { accounts, users } from './usersSchema';

export const notificationChannelEnum = pgEnum('notification_channel', [
    'in_app',
    'email',
    'push',
    'sms',
]);

export const notificationPriorityEnum = pgEnum('notification_priority', [
    'low',
    'normal',
    'high',
    'critical',
]);

export const notificationPreferenceScopeEnum = pgEnum(
    'notification_preference_scope',
    ['global', 'account'],
);

export const digestFrequencyEnum = pgEnum('notification_digest_frequency', [
    'off',
    'hourly',
    'daily',
    'weekly',
]);

export const pushPermissionStateEnum = pgEnum('push_permission_state', [
    'default',
    'granted',
    'denied',
]);

export const deliveryAttemptStatusEnum = pgEnum(
    'notification_delivery_status',
    ['queued', 'accepted', 'sent', 'failed', 'dropped'],
);

export const deliveryEventTypeEnum = pgEnum(
    'notification_delivery_event_type',
    [
        'queued',
        'accepted',
        'sent',
        'failed',
        'opened',
        'clicked',
        'dismissed',
        'unsubscribed',
    ],
);

export const notificationCampaignStatusEnum = pgEnum(
    'notification_campaign_status',
    ['draft', 'scheduled', 'queued', 'sending', 'sent', 'cancelled', 'failed'],
);

export type NotificationCampaignAudience =
    | {
          type: 'all';
      }
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
          type: 'gardens';
          gardenIds: number[];
      }
    | {
          type: 'explicit';
          recipients: Array<{
              accountId: string;
              userId: string;
              gardenId?: number;
          }>;
      };

export type NotificationCampaignChannelPolicy = {
    inApp: boolean;
    email: boolean;
    push: boolean;
    digest: boolean;
    required: boolean;
    respectPreferences: boolean;
};

export type NotificationCampaignFailure = {
    code: string;
    message: string;
    occurredAt: string;
};

export type NotificationCampaignDeliveryMetadata = Record<string, unknown> & {
    router?: 'preference_aware_delivery_router';
    preferenceAware?: boolean;
};

export const notificationCampaigns = pgTable(
    'notification_campaigns',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        status: notificationCampaignStatusEnum('status')
            .notNull()
            .default('draft'),
        audience: jsonb('audience')
            .$type<NotificationCampaignAudience>()
            .notNull(),
        channelPolicy: jsonb('channel_policy')
            .$type<NotificationCampaignChannelPolicy>()
            .notNull(),
        header: text('header').notNull(),
        content: text('content').notNull(),
        iconUrl: text('icon_url'),
        imageUrl: text('image_url'),
        linkUrl: text('link_url'),
        actionUrl: text('action_url'),
        actionLabel: text('action_label'),
        safeImageUrl: text('safe_image_url'),
        safeLinkUrl: text('safe_link_url'),
        safeActionUrl: text('safe_action_url'),
        category: text('category').notNull(),
        eventType: text('event_type').notNull(),
        primaryChannel: notificationChannelEnum('primary_channel')
            .notNull()
            .default('in_app'),
        priority: notificationPriorityEnum('priority')
            .notNull()
            .default('normal'),
        collapseKey: text('collapse_key'),
        threadKey: text('thread_key'),
        ttlSeconds: integer('ttl_seconds'),
        urgency: text('urgency'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        deliveryMetadata: jsonb('delivery_metadata')
            .$type<NotificationCampaignDeliveryMetadata>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        failures: jsonb('failures')
            .$type<NotificationCampaignFailure[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        targetCount: integer('target_count').notNull().default(0),
        queuedCount: integer('queued_count').notNull().default(0),
        sentCount: integer('sent_count').notNull().default(0),
        failedCount: integer('failed_count').notNull().default(0),
        suppressedCount: integer('suppressed_count').notNull().default(0),
        scheduledAt: timestamp('scheduled_at'),
        enqueuedAt: timestamp('enqueued_at'),
        startedAt: timestamp('started_at'),
        completedAt: timestamp('completed_at'),
        cancelledAt: timestamp('cancelled_at'),
        createdByUserId: text('created_by_user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        createdFromAccountId: text('created_from_account_id').references(
            () => accounts.id,
            { onDelete: 'set null' },
        ),
        cancelledByUserId: text('cancelled_by_user_id').references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('notification_campaigns_status_idx').on(table.status),
        index('notification_campaigns_scheduled_at_idx').on(table.scheduledAt),
        index('notification_campaigns_created_by_user_id_idx').on(
            table.createdByUserId,
        ),
        index('notification_campaigns_category_idx').on(table.category),
        index('notification_campaigns_event_type_idx').on(table.eventType),
    ],
);

export const notifications = pgTable(
    'notifications',
    {
        id: text('id').primaryKey(),
        header: text('header').notNull(),
        content: text('content').notNull(),
        iconUrl: text('icon_url'),
        imageUrl: text('image'),
        linkUrl: text('link_url'),
        category: text('category').notNull().default('general'),
        type: text('type').notNull().default('general'),
        primaryChannel: notificationChannelEnum('primary_channel')
            .notNull()
            .default('in_app'),
        priority: notificationPriorityEnum('priority')
            .notNull()
            .default('normal'),
        campaignId: text('campaign_id'),
        bulkId: text('bulk_id'),
        collapseKey: text('collapse_key'),
        threadKey: text('thread_key'),
        actionUrl: text('action_url'),
        actionLabel: text('action_label'),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        ttlSeconds: integer('ttl_seconds'),
        urgency: text('urgency'),
        safeImageUrl: text('safe_image_url'),
        safeLinkUrl: text('safe_link_url'),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        userId: text('user_id').references(() => users.id),
        gardenId: integer('garden_id').references(() => gardens.id),
        raisedBedId: integer('raised_bed_id').references(() => raisedBeds.id),
        blockId: text('block_id').references(() => gardenBlocks.id),
        readAt: timestamp('read_at'),
        readWhere: text('read_where'),
        timestamp: timestamp('timestamp').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('notifications_account_id_idx').on(table.accountId),
        index('notifications_user_id_idx').on(table.userId),
        index('notifications_readAt_idx').on(table.readAt),
        index('notifications_created_at_idx').on(table.createdAt),
        index('notifications_category_idx').on(table.category),
        index('notifications_campaign_id_idx').on(table.campaignId),
    ],
);

export const notificationUserChannelPreferences = pgTable(
    'notification_user_channel_preferences',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'cascade',
        }),
        scope: notificationPreferenceScopeEnum('scope')
            .notNull()
            .default('global'),
        category: text('category').notNull(),
        channel: notificationChannelEnum('channel').notNull(),
        enabled: boolean('enabled').notNull().default(true),
        required: boolean('required').notNull().default(false),
        quietHoursStartMinute: integer('quiet_hours_start_minute'),
        quietHoursEndMinute: integer('quiet_hours_end_minute'),
        deliveryWindowStartMinute: integer('delivery_window_start_minute'),
        deliveryWindowEndMinute: integer('delivery_window_end_minute'),
        timezone: text('timezone'),
        locale: text('locale'),
        digestFrequency: digestFrequencyEnum('digest_frequency')
            .notNull()
            .default('off'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        check(
            'notification_user_channel_preferences_scope_account_id_check',
            sql`(scope = 'global' and account_id is null) or (scope = 'account' and account_id is not null)`,
        ),
        uniqueIndex('notification_user_channel_preferences_global_unique_idx')
            .on(table.userId, table.category, table.channel)
            .where(sql`${table.scope} = 'global'`),
        uniqueIndex('notification_user_channel_preferences_account_unique_idx')
            .on(table.userId, table.accountId, table.category, table.channel)
            .where(sql`${table.scope} = 'account'`),
    ],
);

export const webPushSubscriptions = pgTable(
    'web_push_subscriptions',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'cascade',
        }),
        userId: text('user_id').references(() => users.id, {
            onDelete: 'cascade',
        }),
        endpoint: text('endpoint').notNull(),
        p256dh: text('p256dh').notNull(),
        auth: text('auth').notNull(),
        enabled: boolean('enabled').notNull().default(true),
        deviceId: text('device_id'),
        deviceLabel: text('device_label'),
        browserName: text('browser_name'),
        browserVersion: text('browser_version'),
        platform: text('platform'),
        userAgent: text('user_agent'),
        locale: text('locale'),
        timezone: text('timezone'),
        permissionState: pushPermissionStateEnum('permission_state')
            .notNull()
            .default('default'),
        failCount: integer('fail_count').notNull().default(0),
        lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
        lastSuccessAt: timestamp('last_success_at'),
        lastFailureAt: timestamp('last_failure_at'),
        lastFailureCode: text('last_failure_code'),
        lastFailureReason: text('last_failure_reason'),
        revokedAt: timestamp('revoked_at'),
        revokedReason: text('revoked_reason'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('web_push_subscriptions_endpoint_unique_idx').on(
            table.endpoint,
        ),
        index('web_push_subscriptions_user_id_idx').on(table.userId),
        index('web_push_subscriptions_account_id_idx').on(table.accountId),
        index('web_push_subscriptions_device_id_idx').on(table.deviceId),
    ],
);

export const notificationDeliveryAttempts = pgTable(
    'notification_delivery_attempts',
    {
        id: serial('id').primaryKey(),
        notificationId: text('notification_id')
            .notNull()
            .references(() => notifications.id, { onDelete: 'cascade' }),
        userId: text('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        channel: notificationChannelEnum('channel').notNull(),
        status: deliveryAttemptStatusEnum('status').notNull().default('queued'),
        provider: text('provider'),
        providerMessageId: text('provider_message_id'),
        providerResponseCode: text('provider_response_code'),
        providerResponseBody: text('provider_response_body'),
        campaignId: text('campaign_id'),
        bulkId: text('bulk_id'),
        pushSubscriptionId: text('push_subscription_id').references(
            () => webPushSubscriptions.id,
            { onDelete: 'set null' },
        ),
        attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
        acceptedAt: timestamp('accepted_at'),
        failedAt: timestamp('failed_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('notification_delivery_attempts_notification_id_idx').on(
            table.notificationId,
        ),
        index('notification_delivery_attempts_status_idx').on(table.status),
        index('notification_delivery_attempts_attempted_at_idx').on(
            table.attemptedAt,
        ),
        index('notification_delivery_attempts_queued_attempted_at_idx')
            .on(table.attemptedAt)
            .where(sql`${table.status} = 'queued'`),
    ],
);

export const notificationDeliveryEvents = pgTable(
    'notification_delivery_events',
    {
        id: serial('id').primaryKey(),
        deliveryAttemptId: integer('delivery_attempt_id')
            .notNull()
            .references(() => notificationDeliveryAttempts.id, {
                onDelete: 'cascade',
            }),
        notificationId: text('notification_id')
            .notNull()
            .references(() => notifications.id, { onDelete: 'cascade' }),
        type: deliveryEventTypeEnum('type').notNull(),
        occurredAt: timestamp('occurred_at').notNull().defaultNow(),
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('notification_delivery_events_attempt_id_idx').on(
            table.deliveryAttemptId,
        ),
        index('notification_delivery_events_occurred_at_idx').on(
            table.occurredAt,
        ),
        index('notification_delivery_events_retry_exhausted_at_idx')
            .on(table.occurredAt)
            .where(
                sql`${table.type} = 'failed' and ${table.metadata}->>'reason' = 'attempts_exhausted'`,
            ),
    ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
    account: one(accounts, {
        fields: [notifications.accountId],
        references: [accounts.id],
        relationName: 'notificationsAccount',
    }),
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
        relationName: 'notificationsUser',
    }),
    garden: one(gardens, {
        fields: [notifications.gardenId],
        references: [gardens.id],
        relationName: 'notificationsGarden',
    }),
    raisedBed: one(raisedBeds, {
        fields: [notifications.raisedBedId],
        references: [raisedBeds.id],
        relationName: 'notificationsRaisedBed',
    }),
    block: one(gardenBlocks, {
        fields: [notifications.blockId],
        references: [gardenBlocks.id],
        relationName: 'notificationsBlock',
    }),
    campaign: one(notificationCampaigns, {
        fields: [notifications.campaignId],
        references: [notificationCampaigns.id],
        relationName: 'notificationCampaignNotifications',
    }),
}));

export const notificationCampaignsRelations = relations(
    notificationCampaigns,
    ({ one, many }) => ({
        creator: one(users, {
            fields: [notificationCampaigns.createdByUserId],
            references: [users.id],
            relationName: 'notificationCampaignCreator',
        }),
        createdFromAccount: one(accounts, {
            fields: [notificationCampaigns.createdFromAccountId],
            references: [accounts.id],
            relationName: 'notificationCampaignCreatedFromAccount',
        }),
        cancelledByUser: one(users, {
            fields: [notificationCampaigns.cancelledByUserId],
            references: [users.id],
            relationName: 'notificationCampaignCancelledByUser',
        }),
        notifications: many(notifications, {
            relationName: 'notificationCampaignNotifications',
        }),
    }),
);

export type InsertNotificationCampaign = Omit<
    typeof notificationCampaigns.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectNotificationCampaign =
    typeof notificationCampaigns.$inferSelect;

export type InsertNotification = Omit<
    typeof notifications.$inferInsert,
    'id' | 'createdAt'
>;
export type UpdateNotification = Partial<
    Omit<typeof notifications.$inferInsert, 'id' | 'createdAt'>
> & { id: number };
export type SelectNotification = typeof notifications.$inferSelect;

export const userNotificationSettings = pgTable('user_notification_settings', {
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' })
        .primaryKey(),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    dailyDigest: boolean('daily_digest').notNull().default(true),
});

export const notificationEmailLog = pgTable('notification_email_log', {
    id: serial('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    notificationId: text('notification_id')
        .notNull()
        .references(() => notifications.id),
    emailedAt: timestamp('emailed_at').notNull().defaultNow(),
});

export type InsertNotificationUserChannelPreference = InferInsertModel<
    typeof notificationUserChannelPreferences
>;
export type SelectNotificationUserChannelPreference = InferSelectModel<
    typeof notificationUserChannelPreferences
>;
