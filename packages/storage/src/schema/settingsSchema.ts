import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const SettingsKeys = {
    DashboardQuickActions: 'dashboard.quick_actions',
} as const;

export type SettingKey = (typeof SettingsKeys)[keyof typeof SettingsKeys];

export type DashboardQuickActionConfigItem = {
    type: 'builtin' | 'entity';
    value: string;
};

export type DashboardQuickActionsSettingValue = {
    actions: DashboardQuickActionConfigItem[];
};

export type SettingValue = DashboardQuickActionsSettingValue;

export const settings = pgTable('settings', {
    key: text('key').primaryKey().$type<SettingKey>(),
    value: jsonb('value').$type<SettingValue>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export type SelectSetting = typeof settings.$inferSelect;
export type InsertSetting = Omit<
    typeof settings.$inferInsert,
    'createdAt' | 'updatedAt'
>;
