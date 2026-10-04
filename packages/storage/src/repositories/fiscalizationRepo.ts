import 'server-only';
import { and, eq } from 'drizzle-orm';
import {
    fiscalizationPosSettings,
    fiscalizationUserSettings,
    type SelectFiscalizationPosSettings,
    type SelectFiscalizationUserSettings,
} from '../schema';
import * as columnEncryption from '../security/columnEncryption';
import { storage } from '../storage';

// Get active fiscalization user settings for an account
export async function getFiscalizationUserSettings(): Promise<SelectFiscalizationUserSettings | null> {
    const results = await storage()
        .select()
        .from(fiscalizationUserSettings)
        .where(
            and(
                eq(fiscalizationUserSettings.isActive, true),
                eq(fiscalizationUserSettings.isDeleted, false),
            ),
        )
        .limit(1);

    const settings = results[0];
    if (!settings) {
        return null;
    }

    return {
        ...settings,
        certBase64: columnEncryption.decryptColumnValue(settings.certBase64),
        certPassword: columnEncryption.decryptColumnValue(
            settings.certPassword,
        ),
    };
}

// Get active fiscalization POS settings for an account
export async function getFiscalizationPosSettings(): Promise<SelectFiscalizationPosSettings | null> {
    const results = await storage()
        .select()
        .from(fiscalizationPosSettings)
        .where(
            and(
                eq(fiscalizationPosSettings.isActive, true),
                eq(fiscalizationPosSettings.isDeleted, false),
            ),
        )
        .limit(1);

    return results[0] || null;
}

// Get all fiscalization settings for an account (convenience function)
export async function getAllFiscalizationSettings() {
    const [userSettings, posSettings] = await Promise.all([
        getFiscalizationUserSettings(),
        getFiscalizationPosSettings(),
    ]);

    return {
        userSettings,
        posSettings,
    };
}
