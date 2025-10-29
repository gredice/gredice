import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { storage } from '..';
import {
    type InsertNotificationSetting,
    notificationSettings,
    type SelectNotificationSetting,
} from '../schema';

export const NotificationSettingKeys = {
    SlackDeliveryChannel: 'slack.delivery.channel',
    SlackNewUsersChannel: 'slack.new_users.channel',
    SlackShoppingChannel: 'slack.shopping.channel',
} as const;

export type NotificationSettingKey =
    (typeof NotificationSettingKeys)[keyof typeof NotificationSettingKeys];

export function isNotificationSettingKey(
    value: unknown,
): value is NotificationSettingKey {
    return Object.values(NotificationSettingKeys).includes(
        value as NotificationSettingKey,
    );
}

export async function getNotificationSetting(
    key: NotificationSettingKey,
): Promise<SelectNotificationSetting | undefined> {
    return storage().query.notificationSettings.findFirst({
        where: eq(notificationSettings.key, key),
    });
}

export async function getNotificationSettings(
    keys?: NotificationSettingKey[],
): Promise<SelectNotificationSetting[]> {
    if (Array.isArray(keys) && keys.length > 0) {
        return storage().query.notificationSettings.findMany({
            where: inArray(notificationSettings.key, keys),
        });
    }

    return storage().query.notificationSettings.findMany();
}

export async function upsertNotificationSetting(
    key: NotificationSettingKey,
    values: InsertNotificationSetting,
): Promise<SelectNotificationSetting> {
    const payload = { key, ...values };
    const [result] = await storage()
        .insert(notificationSettings)
        .values(payload)
        .onConflictDoUpdate({
            target: notificationSettings.key,
            set: {
                ...values,
                updatedAt: new Date(),
            },
        })
        .returning();

    return result;
}
