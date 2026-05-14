'use server';

import {
    IntegrationTypes,
    isNotificationSettingKey,
    type NotificationSettingKey,
    type SlackConfig,
    upsertNotificationSetting,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

type UpdateNotificationSettingState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

function toSettingKey(
    value: FormDataEntryValue | null,
): NotificationSettingKey | null {
    if (typeof value !== 'string') {
        return null;
    }

    return isNotificationSettingKey(value) ? value : null;
}

export async function updateSlackNotificationChannelAction(
    _prevState: UpdateNotificationSettingState,
    formData: FormData,
): Promise<UpdateNotificationSettingState> {
    await auth(['admin']);

    const settingKey = toSettingKey(formData.get('settingKey'));

    if (!settingKey) {
        return {
            success: false,
            message: 'Nepoznati ključ postavke.',
        };
    }

    const slackChannelIdRaw = formData.get('slackChannelId');
    const slackChannelId =
        typeof slackChannelIdRaw === 'string' ? slackChannelIdRaw.trim() : '';

    if (!slackChannelId) {
        return {
            success: false,
            message: 'Slack kanal ID je obavezan.',
        };
    }

    try {
        const config: SlackConfig = {
            channelId: slackChannelId,
        };

        await upsertNotificationSetting(settingKey, {
            integrationType: IntegrationTypes.Slack,
            config,
            enabled: 'true',
        });

        revalidatePath(KnownPages.Settings);
        revalidatePath(KnownPages.CommunicationSlack);

        return {
            success: true,
            message: 'Slack kanal je uspješno spremljen.',
        };
    } catch (error) {
        console.error('Failed to update Slack notification setting', {
            settingKey,
            error,
        });

        return {
            success: false,
            message: 'Greška pri spremanju Slack kanala.',
        };
    }
}
