'use server';

import {
    type GoogleCalendarSettingValue,
    getSetting,
    isGoogleCalendarSettingValue,
    SettingsKeys,
    upsertSetting,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

type UpdateGoogleCalendarSettingsState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

function getStringValue(formData: FormData, name: string): string {
    const value = formData.get(name);

    return typeof value === 'string' ? value.trim() : '';
}

export async function updateGoogleCalendarSettingsAction(
    _prevState: UpdateGoogleCalendarSettingsState,
    formData: FormData,
): Promise<UpdateGoogleCalendarSettingsState> {
    await auth(['admin']);

    const clientEmail = getStringValue(formData, 'clientEmail');
    const calendarId = getStringValue(formData, 'calendarId');
    const privateKeyInput = getStringValue(formData, 'privateKey');

    if (!clientEmail || !calendarId) {
        return {
            success: false,
            message: 'Google račun i kalendar su obavezni.',
        };
    }

    const existingSetting = await getSetting(SettingsKeys.GoogleCalendar);
    const existingConfig = isGoogleCalendarSettingValue(existingSetting?.value)
        ? existingSetting.value
        : undefined;
    const privateKey = privateKeyInput || existingConfig?.privateKey;

    if (!privateKey) {
        return {
            success: false,
            message: 'Privatni ključ je obavezan za povezivanje Googlea.',
        };
    }

    try {
        const value: GoogleCalendarSettingValue = {
            clientEmail,
            privateKey,
            calendarId,
        };

        await upsertSetting({
            key: SettingsKeys.GoogleCalendar,
            value,
        });

        revalidatePath(KnownPages.Settings);

        return {
            success: true,
            message: 'Google kalendar je uspješno povezan.',
        };
    } catch (error) {
        console.error('Failed to update Google Calendar setting', {
            error,
        });

        return {
            success: false,
            message: 'Greška pri spremanju Google kalendara.',
        };
    }
}
