import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { type SocialProvider, socialProviderValues } from './socialPostsSchema';

export const DEFAULT_ADMIN_TIME_ZONE = 'Europe/Zagreb';

export const SettingsKeys = {
    AdminGeneral: 'admin.general',
    DashboardQuickActions: 'dashboard.quick_actions',
    GoogleCalendar: 'integrations.google_calendar',
    SocialPublishing: 'integrations.social_publishing',
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

export type SocialProviderIntegrationSettingValue = {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    userAgent?: string;
    publishEndpoint?: string;
    apiKey?: string;
    defaultDestination?: string;
    allowedDestinations?: string[];
};

export type SocialPublishingSettingValue = {
    providers: Partial<
        Record<SocialProvider, SocialProviderIntegrationSettingValue>
    >;
};

export type SettingValue =
    | AdminGeneralSettingValue
    | DashboardQuickActionsSettingValue
    | GoogleCalendarSettingValue
    | SocialPublishingSettingValue;

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

export function isSocialPublishingSettingValue(
    value: unknown,
): value is SocialPublishingSettingValue {
    if (!isRecord(value) || !isRecord(value.providers)) {
        return false;
    }

    return Object.entries(value.providers).every(([provider, config]) => {
        if (!isSocialProviderKey(provider)) return false;
        return isSocialProviderIntegrationSettingValue(config);
    });
}

function isSocialProviderIntegrationSettingValue(
    value: unknown,
): value is SocialProviderIntegrationSettingValue {
    return (
        isRecord(value) &&
        typeof value.enabled === 'boolean' &&
        isOptionalString(value.clientId) &&
        isOptionalString(value.clientSecret) &&
        isOptionalString(value.userAgent) &&
        isOptionalString(value.publishEndpoint) &&
        isOptionalString(value.apiKey) &&
        isOptionalString(value.defaultDestination) &&
        isOptionalStringArray(value.allowedDestinations)
    );
}

function isSocialProviderKey(value: string): value is SocialProvider {
    return socialProviderValues.some((provider) => provider === value);
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
    return (
        value === undefined ||
        (Array.isArray(value) &&
            value.every((entry) => typeof entry === 'string'))
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
