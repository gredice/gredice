import 'server-only';
import { and, eq } from "drizzle-orm";
import { storage } from "../storage";
import {
    fiscalizationUserSettings,
    fiscalizationPosSettings,
    SelectFiscalizationUserSettings,
    SelectFiscalizationPosSettings,
} from "../schema";

// Get active fiscalization user settings for an account
export async function getFiscalizationUserSettings(accountId: string): Promise<SelectFiscalizationUserSettings | null> {
    const results = await storage()
        .select()
        .from(fiscalizationUserSettings)
        .where(
            and(
                eq(fiscalizationUserSettings.isActive, true),
                eq(fiscalizationUserSettings.isDeleted, false)
            )
        )
        .limit(1);

    return results[0] || null;
}

// Get active fiscalization POS settings for an account
export async function getFiscalizationPosSettings(accountId: string): Promise<SelectFiscalizationPosSettings | null> {
    const results = await storage()
        .select()
        .from(fiscalizationPosSettings)
        .where(
            and(
                eq(fiscalizationPosSettings.isActive, true),
                eq(fiscalizationPosSettings.isDeleted, false)
            )
        )
        .limit(1);

    return results[0] || null;
}

// Get all fiscalization settings for an account (convenience function)
export async function getAllFiscalizationSettings(accountId: string) {
    const [userSettings, posSettings] = await Promise.all([
        getFiscalizationUserSettings(accountId),
        getFiscalizationPosSettings(accountId),
    ]);

    return {
        userSettings,
        posSettings
    };
}
