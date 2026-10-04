import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    filterWeatherAlertsForNotifications,
    resolveWeatherAlertOptInRecipients,
    weatherAlertNotificationCollapseKey,
    weatherAlertNotificationLookupCollapseKeys,
} from './alertNotifications';
import type { DhmzWeatherAlert } from './alerts';

const bjelovarFarm = {
    latitude: 45.9,
    longitude: 16.84,
};

const yellowAlert = {
    id: 'yellow-alert',
    source: 'dhmz-cap',
    sourceUrl: 'https://example.com/cap.xml',
    language: 'hr',
    event: 'Zuto upozorenje za kisu',
    description: 'Mjestimice obilna kisa.',
    instruction: 'Budite na oprezu.',
    urgency: 'Future',
    severity: 'Moderate',
    certainty: 'Likely',
    onset: '2026-06-04T00:00:00+02:00',
    expires: '2026-06-05T00:00:00+02:00',
    sent: '2026-06-03T17:46:47+02:00',
    senderName: 'DHMZ',
    awarenessLevel: {
        id: '2',
        color: 'yellow',
        label: 'Moderate',
    },
    awarenessType: {
        id: '10',
        label: 'Rain',
    },
    area: {
        name: 'Zagrebacka regija',
        regionCode: 'HR002',
    },
    deduplicationKey:
        'HR002:10:2:2026-06-04T00:00:00+02:00:2026-06-05T00:00:00+02:00',
} satisfies DhmzWeatherAlert;

const greenNoWarningAlert = {
    ...yellowAlert,
    id: 'green-no-warning-alert',
    event: 'Zeleno upozorenje za vjetar',
    description: 'Nema upozorenja!',
    instruction: null,
    severity: 'Minor',
    awarenessLevel: {
        id: '1',
        color: 'green',
        label: 'Minor',
    },
    awarenessType: {
        id: '1',
        label: 'Wind',
    },
    deduplicationKey:
        'HR002:1:1:2026-06-04T00:00:00+02:00:2026-06-05T00:00:00+02:00',
} satisfies DhmzWeatherAlert;

const duplicateYellowAlert = {
    ...yellowAlert,
    id: 'duplicate-yellow-alert',
    sourceUrl: 'https://example.com/duplicate-cap.xml',
} satisfies DhmzWeatherAlert;

describe('filterWeatherAlertsForNotifications', () => {
    it('does not select green no-warning CAP records for notifications', () => {
        const alerts = filterWeatherAlertsForNotifications({
            farm: bjelovarFarm,
            now: new Date('2026-06-03T18:00:00+02:00'),
            sourceAlerts: [greenNoWarningAlert],
        });

        assert.equal(alerts.length, 0);
    });

    it('keeps real warnings when green no-warning records are present', () => {
        const alerts = filterWeatherAlertsForNotifications({
            farm: bjelovarFarm,
            now: new Date('2026-06-03T18:00:00+02:00'),
            sourceAlerts: [greenNoWarningAlert, yellowAlert],
        });

        assert.deepEqual(
            alerts.map((alert) => alert.id),
            ['yellow-alert'],
        );
    });

    it('deduplicates repeated CAP records for the same warning', () => {
        const alerts = filterWeatherAlertsForNotifications({
            farm: bjelovarFarm,
            now: new Date('2026-06-03T18:00:00+02:00'),
            sourceAlerts: [yellowAlert, duplicateYellowAlert],
        });

        assert.equal(alerts.length, 1);
        assert.equal(alerts[0]?.deduplicationKey, yellowAlert.deduplicationKey);
    });
});

describe('weather alert notification collapse keys', () => {
    it('uses an account-level warning key and keeps all account legacy garden keys for lookup', () => {
        assert.equal(
            weatherAlertNotificationCollapseKey(yellowAlert),
            `weather-risk:${yellowAlert.deduplicationKey}`,
        );
        assert.deepEqual(
            weatherAlertNotificationLookupCollapseKeys([42, 43], yellowAlert),
            [
                `weather-risk:${yellowAlert.deduplicationKey}`,
                `weather-risk:42:${yellowAlert.deduplicationKey}`,
                `weather-risk:43:${yellowAlert.deduplicationKey}`,
            ],
        );
    });
});

describe('resolveWeatherAlertOptInRecipients', () => {
    it('defaults weather alert recipients off until a user opts in', () => {
        const recipients = resolveWeatherAlertOptInRecipients(
            [
                { accountId: 'account-1', userId: 'enabled-user' },
                { accountId: 'account-1', userId: 'missing-user' },
                { accountId: 'account-2', userId: 'disabled-user' },
            ],
            [
                {
                    accountId: null,
                    enabled: true,
                    scope: 'global',
                    userId: 'enabled-user',
                },
                {
                    accountId: null,
                    enabled: false,
                    scope: 'global',
                    userId: 'disabled-user',
                },
            ],
        );

        assert.deepEqual(Array.from(recipients.entries()), [
            ['account-1', ['enabled-user']],
        ]);
    });

    it('lets account-level preferences override global weather alert opt-ins', () => {
        const recipients = resolveWeatherAlertOptInRecipients(
            [
                { accountId: 'account-1', userId: 'globally-enabled' },
                { accountId: 'account-1', userId: 'account-enabled' },
                { accountId: 'account-2', userId: 'account-enabled' },
            ],
            [
                {
                    accountId: null,
                    enabled: true,
                    scope: 'global',
                    userId: 'globally-enabled',
                },
                {
                    accountId: 'account-1',
                    enabled: false,
                    scope: 'account',
                    userId: 'globally-enabled',
                },
                {
                    accountId: null,
                    enabled: false,
                    scope: 'global',
                    userId: 'account-enabled',
                },
                {
                    accountId: 'account-2',
                    enabled: true,
                    scope: 'account',
                    userId: 'account-enabled',
                },
            ],
        );

        assert.deepEqual(Array.from(recipients.entries()), [
            ['account-2', ['account-enabled']],
        ]);
    });
});
