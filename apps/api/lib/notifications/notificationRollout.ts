function readBooleanFlag(name: string, defaultValue: boolean) {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) return defaultValue;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(value);
}

export function readNotificationRolloutFlags() {
    return {
        premiumControlsEnabled: readBooleanFlag(
            'GREDICE_NOTIFICATIONS_PREMIUM_CONTROLS_ENABLED',
            true,
        ),
        bulkCampaignsEnabled: readBooleanFlag(
            'GREDICE_NOTIFICATIONS_BULK_CAMPAIGNS_ENABLED',
            false,
        ),
        richPushEnabled: readBooleanFlag(
            'GREDICE_NOTIFICATIONS_RICH_PUSH_ENABLED',
            true,
        ),
    };
}

export const notificationRolloutFlags = readNotificationRolloutFlags();
const deliveryPreferenceChannels = new Set(['in_app', 'email', 'push']);

export function notificationPreferencesWritable({
    preferences,
    premiumControlsEnabled = notificationRolloutFlags.premiumControlsEnabled,
}: {
    preferences: ReadonlyArray<{ category: string; channel: string }>;
    premiumControlsEnabled?: boolean;
}) {
    return (
        premiumControlsEnabled ||
        preferences.every(
            (preference) =>
                preference.category === 'delivery_updates' &&
                deliveryPreferenceChannels.has(preference.channel),
        )
    );
}
