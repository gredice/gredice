'use server';

import {
    type AdminGeneralSettingValue,
    DEFAULT_ADMIN_TIME_ZONE,
    SettingsKeys,
    upsertSetting,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

type UpdateAdminGeneralSettingsState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

function getStringValue(formData: FormData, name: string): string {
    const value = formData.get(name);

    return typeof value === 'string' ? value.trim() : '';
}

function isValidTimeZone(timeZone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

export async function updateAdminGeneralSettingsAction(
    _prevState: UpdateAdminGeneralSettingsState,
    formData: FormData,
): Promise<UpdateAdminGeneralSettingsState> {
    await auth(['admin']);

    const timeZone =
        getStringValue(formData, 'timeZone') || DEFAULT_ADMIN_TIME_ZONE;

    if (!isValidTimeZone(timeZone)) {
        return {
            success: false,
            message: 'Odabrana vremenska zona nije valjana.',
        };
    }

    const value: AdminGeneralSettingValue = {
        timeZone,
    };

    await upsertSetting({
        key: SettingsKeys.AdminGeneral,
        value,
    });

    revalidatePath(KnownPages.Settings);

    return {
        success: true,
        message: 'Opće postavke su uspješno spremljene.',
    };
}
