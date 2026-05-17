'use server';

import {
    cancelNotificationCampaign,
    createNotification,
    createNotificationCampaign,
    enqueueNotificationCampaign,
    getNotificationCampaign,
    previewNotificationCampaignAudience,
} from '@gredice/storage';
import { auth } from '../../../../lib/auth/auth';

function textField(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : '';
}

export async function previewAudienceAction() {
    await auth(['admin']);
    const preview = await previewNotificationCampaignAudience({ type: 'all' });
    return { success: true, preview };
}

export async function createCampaignAction(_prev: unknown, formData: FormData) {
    const { userId, accountId } = await auth(['admin']);
    const name = textField(formData, 'name');
    const header = textField(formData, 'header');
    const content = textField(formData, 'content');
    const category = textField(formData, 'category');
    const eventType = textField(formData, 'eventType');

    if (!name || !header || !content || !category || !eventType) {
        return { success: false, error: 'Required fields are missing' };
    }

    const campaignId = await createNotificationCampaign({
        name,
        audience: { type: 'all' },
        channelPolicy: {
            inApp: formData.get('inApp') === 'on',
            push: formData.get('push') === 'on',
            email: formData.get('email') === 'on',
            digest: formData.get('digest') === 'on',
            required: false,
            respectPreferences: true,
        },
        header,
        content,
        category,
        eventType,
        primaryChannel: 'in_app',
        priority: 'normal',
        iconUrl: textField(formData, 'iconUrl') || null,
        imageUrl: textField(formData, 'imageUrl') || null,
        linkUrl: textField(formData, 'linkUrl') || null,
        actionUrl: textField(formData, 'actionUrl') || null,
        actionLabel: textField(formData, 'actionLabel') || null,
        safeImageUrl: textField(formData, 'imageUrl') || null,
        safeLinkUrl: textField(formData, 'linkUrl') || null,
        safeActionUrl: textField(formData, 'actionUrl') || null,
        collapseKey: null,
        threadKey: null,
        ttlSeconds: null,
        urgency: null,
        scheduledAt: textField(formData, 'scheduledAt')
            ? new Date(textField(formData, 'scheduledAt'))
            : null,
        metadata: {},
        deliveryMetadata: { source: 'admin_composer' },
        createdByUserId: userId,
        createdFromAccountId: accountId,
    });

    const campaign = await getNotificationCampaign(campaignId);
    return { success: true, campaign };
}

export async function enqueueCampaignAction(campaignId: string) {
    const { userId } = await auth(['admin']);
    const campaign = await enqueueNotificationCampaign({
        id: campaignId,
        queuedByUserId: userId,
    });
    return { success: true, campaign };
}

export async function cancelCampaignAction(campaignId: string) {
    const { userId } = await auth(['admin']);
    const campaign = await cancelNotificationCampaign({
        id: campaignId,
        cancelledByUserId: userId,
    });
    return { success: true, campaign };
}

export async function sendTestNotificationAction(formData: FormData) {
    const { userId, accountId } = await auth(['admin']);
    await createNotification({
        accountId,
        userId,
        header: textField(formData, 'header') || 'Test notification',
        content: textField(formData, 'content') || 'Composer test send',
        iconUrl: null,
        imageUrl: null,
        linkUrl: textField(formData, 'linkUrl') || null,
        gardenId: undefined,
        raisedBedId: undefined,
        blockId: undefined,
        timestamp: new Date(),
        readAt: null,
        readWhere: undefined,
    });
    return { success: true };
}
