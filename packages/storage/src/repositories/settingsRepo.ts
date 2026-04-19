import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { storage } from '..';
import {
    type InsertSetting,
    type SelectSetting,
    type SettingKey,
    SettingsKeys,
    settings,
} from '../schema';

export function isSettingKey(value: unknown): value is SettingKey {
    return Object.values(SettingsKeys).includes(value as SettingKey);
}

export async function getSetting(
    key: SettingKey,
): Promise<SelectSetting | undefined> {
    return storage().query.settings.findFirst({
        where: eq(settings.key, key),
    });
}

export async function getSettings(
    keys?: SettingKey[],
): Promise<SelectSetting[]> {
    if (Array.isArray(keys) && keys.length > 0) {
        return storage().query.settings.findMany({
            where: inArray(settings.key, keys),
        });
    }

    return storage().query.settings.findMany();
}

export async function upsertSetting(
    values: InsertSetting,
): Promise<SelectSetting> {
    const [result] = await storage()
        .insert(settings)
        .values(values)
        .onConflictDoUpdate({
            target: settings.key,
            set: {
                value: values.value,
                updatedAt: new Date(),
            },
        })
        .returning();

    return result;
}

export async function deleteSetting(key: SettingKey): Promise<void> {
    await storage().delete(settings).where(eq(settings.key, key));
}
