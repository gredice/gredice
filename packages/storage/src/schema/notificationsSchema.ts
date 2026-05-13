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
}));

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
