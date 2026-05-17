import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const DEFAULT_ADMIN_TIME_ZONE = 'Europe/Zagreb';

export const SettingsKeys = {
    AdminGeneral: 'admin.general',
    DashboardQuickActions: 'dashboard.quick_actions',
    GoogleCalendar: 'integrations.google_calendar',
} as const;

export type SettingKey = (typeof SettingsKeys)[keyof typeof SettingsKeys];

export type DashboardQuickActionConfigItem = {
    type: 'builtin' | 'entity';
    value: string;
};

export type DashboardQuickActionsSettingValue = {
    actions: DashboardQuickActionConfigItem[];
};

export type AdminGeneralSettingValue = {
    timeZone: string;
};

export type GoogleCalendarSettingValue = {
    clientEmail: string;
    privateKey: string;
    calendarId: string;
};

export type SettingValue =
    | AdminGeneralSettingValue
    | DashboardQuickActionsSettingValue
    | GoogleCalendarSettingValue;

export function isAdminGeneralSettingValue(
    value: unknown,
): value is AdminGeneralSettingValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        'timeZone' in value &&
        typeof value.timeZone === 'string' &&
        value.timeZone.length > 0
    );
}

export function isGoogleCalendarSettingValue(
    value: unknown,
): value is GoogleCalendarSettingValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        'clientEmail' in value &&
        typeof value.clientEmail === 'string' &&
        value.clientEmail.length > 0 &&
        'privateKey' in value &&
        typeof value.privateKey === 'string' &&
        value.privateKey.length > 0 &&
        'calendarId' in value &&
        typeof value.calendarId === 'string' &&
        value.calendarId.length > 0
    );
}

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
