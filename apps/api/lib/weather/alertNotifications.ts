import {
    createNotification,
    gardens,
    grediceCached,
    grediceCacheKeys,
    notifications,
    storage,
} from '@gredice/storage';
import { and, eq, inArray } from 'drizzle-orm';
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

async function notificationExists(accountId: string, collapseKeys: string[]) {
    const existing = await storage().query.notifications.findFirst({
        where: and(
            eq(notifications.accountId, accountId),
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

    for (const garden of gardenRows) {
        const alerts = filterWeatherAlertsForNotifications({
            farm: garden.farm,
            now,
            sourceAlerts,
        });
        alertsMatched += alerts.length;

        for (const alert of alerts) {
            const collapseKey = weatherAlertNotificationCollapseKey(alert);
            const accountNotificationKey = `${garden.accountId}:${collapseKey}`;
            if (processedNotificationKeys.has(accountNotificationKey)) {
                duplicatesSkipped += 1;
                continue;
            }
            processedNotificationKeys.add(accountNotificationKey);

            if (
                await notificationExists(
                    garden.accountId,
                    weatherAlertNotificationLookupCollapseKeys(
                        accountGardenIds.get(garden.accountId) ?? [garden.id],
                        alert,
                    ),
                )
            ) {
                duplicatesSkipped += 1;
                continue;
            }

            await createNotification({
                accountId: garden.accountId,
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
            notificationsCreated += 1;
        }
    }

    return {
        gardensScanned: gardenRows.length,
        alertsMatched,
        notificationsCreated,
        duplicatesSkipped,
    };
}
