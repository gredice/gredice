import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const notificationSettings = pgTable('notification_settings', {
    key: text('key').primaryKey(),
    slackChannelId: text('slack_channel_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export type SelectNotificationSetting =
    typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = Omit<
    typeof notificationSettings.$inferInsert,
    'key' | 'createdAt' | 'updatedAt'
>;
