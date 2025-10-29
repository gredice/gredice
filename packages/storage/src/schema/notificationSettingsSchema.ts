import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const IntegrationTypes = {
    Slack: 'slack',
} as const;

export type IntegrationType =
    (typeof IntegrationTypes)[keyof typeof IntegrationTypes];

export type SlackConfig = {
    channelId: string;
};

export type IntegrationConfig = SlackConfig;

export const notificationSettings = pgTable('notification_settings', {
    key: text('key').primaryKey(),
    integrationType: text('integration_type')
        .$type<IntegrationType>()
        .notNull(),
    config: jsonb('config').$type<IntegrationConfig>().notNull(),
    enabled: text('enabled')
        .notNull()
        .default('true')
        .$type<'true' | 'false'>(),
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
