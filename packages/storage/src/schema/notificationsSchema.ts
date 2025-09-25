import { relations } from 'drizzle-orm';
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
import { gardenBlocks, gardens, raisedBeds } from './gardenSchema';
import { accounts, users } from './usersSchema';

export const notifications = pgTable(
    'notifications',
    {
        id: text('id').primaryKey(),
        header: text('header').notNull(),
        content: text('content').notNull(), // markdown content
        iconUrl: text('icon_url'), // URL to an icon image
        imageUrl: text('image'),
        linkUrl: text('link_url'), // optional link to more details
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        userId: text('user_id').references(() => users.id), // optional, for user-specific notifications
        gardenId: integer('garden_id').references(() => gardens.id), // optional, for garden-specific notifications
        raisedBedId: integer('raised_bed_id').references(() => raisedBeds.id), // optional, for raised bed-specific notifications
        blockId: text('block_id').references(() => gardenBlocks.id), // optional, for block-specific notifications
        readAt: timestamp('read_at'), // null if not read
        readWhere: text('read_where'), // e.g. 'web', 'mobile', ...
        timestamp: timestamp('timestamp').notNull(), // when the notification was created
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('notifications_account_id_idx').on(table.accountId),
        index('notifications_user_id_idx').on(table.userId),
        index('notifications_readAt_idx').on(table.readAt),
        index('notifications_created_at_idx').on(table.createdAt),
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
    emailEnabled: boolean('email_enabled').notNull().default(true), // user can disable all emails
    dailyDigest: boolean('daily_digest').notNull().default(true), // true = daily summary, false = immediate emails
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

export const webPushSubscriptions = pgTable(
    'web_push_subscriptions',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id, { onDelete: 'cascade' }),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        endpoint: text('endpoint').notNull(),
        auth: text('auth').notNull(),
        p256dh: text('p256dh').notNull(),
        expirationTime: timestamp('expiration_time'),
        userAgent: text('user_agent'),
        platform: text('platform'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('web_push_subscriptions_endpoint_idx').on(table.endpoint),
        index('web_push_subscriptions_account_id_idx').on(table.accountId),
        index('web_push_subscriptions_user_id_idx').on(table.userId),
    ],
);

export type InsertWebPushSubscription = Omit<
    typeof webPushSubscriptions.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectWebPushSubscription =
    typeof webPushSubscriptions.$inferSelect;
