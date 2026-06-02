import {
    createNotification,
    gardens,
    grediceCached,
    grediceCacheKeys,
    notifications,
    storage,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
    type DhmzWeatherAlert,
    filterWeatherAlertsForFarm,
    getDhmzWeatherAlerts,
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

function collapseKeyForWeatherAlert(gardenId: number, alert: DhmzWeatherAlert) {
    return `weather-risk:${gardenId}:${alert.deduplicationKey}`;
}

function weatherAlertContent(alert: DhmzWeatherAlert) {
    const instruction = alert.instruction ? ` ${alert.instruction}` : '';
    return `${alert.description} Vrijedi ${formatAlertWindow(alert)}.${instruction}`;
}

async function notificationExists(accountId: string, collapseKey: string) {
    const existing = await storage().query.notifications.findFirst({
        where: and(
            eq(notifications.accountId, accountId),
            eq(notifications.collapseKey, collapseKey),
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

    for (const garden of gardenRows) {
        const alerts = filterWeatherAlertsForFarm(sourceAlerts, garden.farm, {
            now,
        });
        alertsMatched += alerts.length;

        for (const alert of alerts) {
            const collapseKey = collapseKeyForWeatherAlert(garden.id, alert);
            if (await notificationExists(garden.accountId, collapseKey)) {
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
