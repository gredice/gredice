import {
    accountUsers,
    createNotification,
    gardens,
    grediceCached,
    grediceCacheKeys,
    notifications,
    notificationUserChannelPreferences,
    storage,
} from '@gredice/storage';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
    type DhmzWeatherAlert,
    filterWeatherAlertsForFarm,
    getDhmzWeatherAlerts,
    isWeatherWarningAlert,
    type WeatherAlertFarm,
} from './alerts';

export type WeatherAlertNotificationResult = {
    gardensScanned: number;
    alertsMatched: number;
    notificationsCreated: number;
    duplicatesSkipped: number;
    optInRecipientsMatched: number;
    optInSkipped: number;
};

type WeatherAlertAccountMembership = {
    accountId: string;
    userId: string;
};

type WeatherAlertPreference = {
    accountId: string | null;
    enabled: boolean;
    scope: 'account' | 'global';
    userId: string;
};

function formatAlertWindow(alert: DhmzWeatherAlert) {
    const formatter = new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Zagreb',
    });
    return `${formatter.format(new Date(alert.onset))} - ${formatter.format(new Date(alert.expires))}`;
}

export function weatherAlertNotificationCollapseKey(
    alert: Pick<DhmzWeatherAlert, 'deduplicationKey'>,
) {
    return `weather-risk:${alert.deduplicationKey}`;
}

function legacyWeatherAlertNotificationCollapseKey(
    gardenId: number,
    alert: Pick<DhmzWeatherAlert, 'deduplicationKey'>,
) {
    return `weather-risk:${gardenId}:${alert.deduplicationKey}`;
}

export function weatherAlertNotificationLookupCollapseKeys(
    gardenIds: number[],
    alert: Pick<DhmzWeatherAlert, 'deduplicationKey'>,
) {
    return [
        weatherAlertNotificationCollapseKey(alert),
        ...gardenIds.map((gardenId) =>
            legacyWeatherAlertNotificationCollapseKey(gardenId, alert),
        ),
    ];
}

function weatherAlertContent(alert: DhmzWeatherAlert) {
    const instruction = alert.instruction ? ` ${alert.instruction}` : '';
    return `${alert.description} Vrijedi ${formatAlertWindow(alert)}.${instruction}`;
}

function dedupeWeatherAlertsByWarning(alerts: DhmzWeatherAlert[]) {
    const seenAlertKeys = new Set<string>();
    const dedupedAlerts: DhmzWeatherAlert[] = [];

    for (const alert of alerts) {
        if (seenAlertKeys.has(alert.deduplicationKey)) continue;
        seenAlertKeys.add(alert.deduplicationKey);
        dedupedAlerts.push(alert);
    }

    return dedupedAlerts;
}

export function filterWeatherAlertsForNotifications({
    farm,
    now,
    sourceAlerts,
}: {
    farm?: WeatherAlertFarm | null;
    now: Date;
    sourceAlerts: DhmzWeatherAlert[];
}) {
    return dedupeWeatherAlertsByWarning(
        filterWeatherAlertsForFarm(sourceAlerts, farm, { now }).filter(
            isWeatherWarningAlert,
        ),
    );
}

export function resolveWeatherAlertOptInRecipients(
    memberships: WeatherAlertAccountMembership[],
    preferences: WeatherAlertPreference[],
) {
    const globalPreferences = new Map<string, boolean>();
    const accountPreferences = new Map<string, boolean>();

    for (const preference of preferences) {
        if (preference.scope === 'account' && preference.accountId) {
            accountPreferences.set(
                `${preference.accountId}:${preference.userId}`,
                preference.enabled,
            );
            continue;
        }

        if (preference.scope === 'global') {
            globalPreferences.set(preference.userId, preference.enabled);
        }
    }

    const recipientsByAccount = new Map<string, string[]>();
    const seenRecipients = new Set<string>();

    for (const membership of memberships) {
        const recipientKey = `${membership.accountId}:${membership.userId}`;
        if (seenRecipients.has(recipientKey)) continue;
        seenRecipients.add(recipientKey);

        const enabled =
            accountPreferences.get(recipientKey) ??
            globalPreferences.get(membership.userId) ??
            false;
        if (!enabled) continue;

        const accountRecipients =
            recipientsByAccount.get(membership.accountId) ?? [];
        accountRecipients.push(membership.userId);
        recipientsByAccount.set(membership.accountId, accountRecipients);
    }

    return recipientsByAccount;
}

async function loadWeatherAlertOptInRecipients(accountIds: string[]) {
    if (accountIds.length === 0) return new Map<string, string[]>();

    const memberships = await storage()
        .select({
            accountId: accountUsers.accountId,
            userId: accountUsers.userId,
        })
        .from(accountUsers)
        .where(inArray(accountUsers.accountId, accountIds));
    const userIds = Array.from(
        new Set(memberships.map((membership) => membership.userId)),
    );
    if (userIds.length === 0) return new Map<string, string[]>();

    const preferences = await storage()
        .select({
            accountId: notificationUserChannelPreferences.accountId,
            enabled: notificationUserChannelPreferences.enabled,
            scope: notificationUserChannelPreferences.scope,
            userId: notificationUserChannelPreferences.userId,
        })
        .from(notificationUserChannelPreferences)
        .where(
            and(
                inArray(notificationUserChannelPreferences.userId, userIds),
                eq(
                    notificationUserChannelPreferences.category,
                    'weather_alerts',
                ),
                eq(notificationUserChannelPreferences.channel, 'push'),
                or(
                    eq(notificationUserChannelPreferences.scope, 'global'),
                    inArray(
                        notificationUserChannelPreferences.accountId,
                        accountIds,
                    ),
                ),
            ),
        );

    return resolveWeatherAlertOptInRecipients(memberships, preferences);
}

async function notificationExists({
    accountId,
    collapseKeys,
    userId,
}: {
    accountId: string;
    collapseKeys: string[];
    userId: string;
}) {
    const existing = await storage().query.notifications.findFirst({
        where: and(
            eq(notifications.accountId, accountId),
            or(eq(notifications.userId, userId), isNull(notifications.userId)),
            inArray(notifications.collapseKey, collapseKeys),
        ),
    });
    return Boolean(existing);
}

export async function notifyWeatherRiskAlerts({
    now = new Date(),
}: {
    now?: Date;
} = {}): Promise<WeatherAlertNotificationResult> {
    const sourceAlerts = await grediceCached(
        grediceCacheKeys.weatherAlertsCroatia,
        getDhmzWeatherAlerts,
        30 * 60,
    );
    const gardenRows = await storage().query.gardens.findMany({
        where: eq(gardens.isDeleted, false),
        with: {
            farm: true,
        },
    });

    let alertsMatched = 0;
    let notificationsCreated = 0;
    let duplicatesSkipped = 0;
    const processedNotificationKeys = new Set<string>();
    const accountGardenIds = new Map<string, number[]>();

    for (const garden of gardenRows) {
        const gardenIds = accountGardenIds.get(garden.accountId) ?? [];
        gardenIds.push(garden.id);
        accountGardenIds.set(garden.accountId, gardenIds);
    }
    const optInRecipientsByAccount = await loadWeatherAlertOptInRecipients(
        Array.from(accountGardenIds.keys()),
    );
    let optInRecipientsMatched = 0;
    let optInSkipped = 0;

    for (const garden of gardenRows) {
        const alerts = filterWeatherAlertsForNotifications({
            farm: garden.farm,
            now,
            sourceAlerts,
        });
        alertsMatched += alerts.length;
        const optInUserIds =
            optInRecipientsByAccount.get(garden.accountId) ?? [];

        for (const alert of alerts) {
            const collapseKey = weatherAlertNotificationCollapseKey(alert);
            if (optInUserIds.length === 0) {
                optInSkipped += 1;
                continue;
            }

            for (const userId of optInUserIds) {
                const userNotificationKey = `${garden.accountId}:${userId}:${collapseKey}`;
                if (processedNotificationKeys.has(userNotificationKey)) {
                    duplicatesSkipped += 1;
                    continue;
                }
                processedNotificationKeys.add(userNotificationKey);

                if (
                    await notificationExists({
                        accountId: garden.accountId,
                        collapseKeys:
                            weatherAlertNotificationLookupCollapseKeys(
                                accountGardenIds.get(garden.accountId) ?? [
                                    garden.id,
                                ],
                                alert,
                            ),
                        userId,
                    })
                ) {
                    duplicatesSkipped += 1;
                    continue;
                }

                await createNotification({
                    accountId: garden.accountId,
                    userId,
                    gardenId: garden.id,
                    header: alert.event,
                    content: weatherAlertContent(alert),
                    category: 'weather_alerts',
                    type: 'weather_risk_alert',
                    primaryChannel: 'push',
                    priority: 'high',
                    collapseKey,
                    threadKey: `weather-risk:${garden.id}`,
                    metadata: {
                        alertId: alert.id,
                        awarenessLevel: alert.awarenessLevel?.id ?? null,
                        awarenessType: alert.awarenessType?.id ?? null,
                        expires: alert.expires,
                        onset: alert.onset,
                        regionCode: alert.area.regionCode,
                        source: alert.source,
                    },
                    timestamp: now,
                });
                optInRecipientsMatched += 1;
                notificationsCreated += 1;
            }
        }
    }

    return {
        gardensScanned: gardenRows.length,
        alertsMatched,
        notificationsCreated,
        duplicatesSkipped,
        optInRecipientsMatched,
        optInSkipped,
    };
}
