import { expect, test } from '@playwright/experimental-ct-react';
import type { Page, Route } from '@playwright/test';
import { NotificationSettingsStory } from './NotificationSettingsStory';
import type { PushSetupStatus } from './usePushSubscription';

type MockDevice = {
    createdAt: string;
    deviceId: string;
    deviceLabel: string;
    enabled: boolean;
    id: string;
    lastFailureReason: string | null;
    lastSeenAt: string;
    lastSuccessAt: string | null;
    permissionState: 'default' | 'denied' | 'granted';
    platform: string;
    revokedAt: string | null;
    revokedReason: string | null;
    updatedAt: string;
    userAgent: string;
};

type RecordedNotificationRequests = {
    deviceDeletes: string[];
    devicePatches: unknown[];
    testSends: number;
};

const currentDevice: MockDevice = {
    createdAt: '2026-07-04T08:00:00.000Z',
    deviceId: 'current-device',
    deviceLabel: 'Ovaj uređaj (MacIntel)',
    enabled: true,
    id: 'device-1',
    lastFailureReason: null,
    lastSeenAt: '2026-07-04T09:30:00.000Z',
    lastSuccessAt: null,
    permissionState: 'granted',
    platform: 'MacIntel',
    revokedAt: null,
    revokedReason: null,
    updatedAt: '2026-07-04T09:30:00.000Z',
    userAgent: 'Chrome farm settings test',
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
    await route.fulfill({
        body: JSON.stringify(body),
        contentType: 'application/json',
        status,
    });
}

function pushStatus(devices: MockDevice[]) {
    const activeDevices = devices.filter((device) => !device.revokedAt);
    const hasDeliverableDevice = activeDevices.some(
        (device) => device.enabled && device.permissionState === 'granted',
    );
    const hasDeniedDevice = activeDevices.some(
        (device) => device.permissionState === 'denied',
    );

    return {
        hasDevices: activeDevices.length > 0,
        status: hasDeliverableDevice
            ? 'subscribed'
            : activeDevices.length === 0
              ? 'unsubscribed'
              : hasDeniedDevice
                ? 'denied'
                : 'disabled',
    };
}

async function mockNotificationSettingsApi(
    page: Page,
    options: {
        devices?: MockDevice[];
        failDevices?: boolean;
        failPushStatus?: boolean;
        testResult?: unknown;
    } = {},
) {
    const recorded: RecordedNotificationRequests = {
        deviceDeletes: [],
        devicePatches: [],
        testSends: 0,
    };
    const devices = options.devices ? [...options.devices] : [currentDevice];
    const testResult = options.testResult ?? {
        accepted: 1,
        failed: 0,
        notificationId: 'notification-1',
        retried: 0,
        success: true,
        targeted: 1,
    };

    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const method = request.method();
        const { pathname } = new URL(request.url());

        if (
            pathname.includes('/api/notifications/devices/device-1') &&
            method === 'PATCH'
        ) {
            const payload = request.postDataJSON();
            recorded.devicePatches.push(payload);
            if (
                payload &&
                typeof payload === 'object' &&
                'enabled' in payload &&
                typeof payload.enabled === 'boolean'
            ) {
                const device = devices.find((item) => item.id === 'device-1');
                if (device) {
                    device.enabled = payload.enabled;
                    device.updatedAt = '2026-07-04T10:00:00.000Z';
                }
            }
            await fulfillJson(route, { success: true });
            return;
        }

        if (
            pathname.includes('/api/notifications/devices/device-1') &&
            method === 'DELETE'
        ) {
            recorded.deviceDeletes.push('device-1');
            const device = devices.find((item) => item.id === 'device-1');
            if (device) {
                device.enabled = false;
                device.revokedAt = '2026-07-04T10:05:00.000Z';
                device.revokedReason = 'user_revoked';
            }
            await fulfillJson(route, { success: true });
            return;
        }

        if (
            pathname.includes('/api/notifications/devices') &&
            method === 'GET'
        ) {
            await fulfillJson(
                route,
                options.failDevices
                    ? { error: 'Mock device failure' }
                    : { devices },
                options.failDevices ? 500 : 200,
            );
            return;
        }

        if (
            pathname.includes('/api/notifications/push-status') &&
            method === 'GET'
        ) {
            await fulfillJson(
                route,
                options.failPushStatus
                    ? { error: 'Mock push status failure' }
                    : pushStatus(devices),
                options.failPushStatus ? 500 : 200,
            );
            return;
        }

        if (pathname.includes('/api/notifications/test') && method === 'POST') {
            recorded.testSends += 1;
            await fulfillJson(route, testResult);
            return;
        }

        throw new Error(
            `Unexpected notification settings request: ${method} ${pathname}`,
        );
    });

    return recorded;
}

const capabilityScenarios: Array<{
    expectedText: string;
    status: PushSetupStatus;
}> = [
    {
        expectedText:
            'Ovaj preglednik, uređaj ili nesigurna veza ne podržava web push obavijesti.',
        status: 'unsupported',
    },
    {
        expectedText:
            'Obavijesti su blokirane u pregledniku. Otvori postavke preglednika i omogući obavijesti za ovu stranicu.',
        status: 'denied',
    },
    {
        expectedText:
            'Web push obavijesti nisu konfigurirane na ovom okruženju.',
        status: 'unconfigured',
    },
    {
        expectedText:
            'Zahtjev za dozvolu nije dovršen. Možeš ponovno pokušati kada želiš primati obavijesti na ovom uređaju.',
        status: 'prompt-dismissed',
    },
];

function expectedPermissionLabel(status: PushSetupStatus) {
    switch (status) {
        case 'prompt-dismissed':
            return 'odgođeno';
        case 'denied':
            return 'blokirano';
        case 'unsupported':
            return 'nije podržano';
        case 'unconfigured':
            return 'nije konfigurirano';
        default:
            return status;
    }
}

for (const scenario of capabilityScenarios) {
    test(`notification settings explains ${scenario.status} push state`, async ({
        mount,
        page,
    }) => {
        await mockNotificationSettingsApi(page, { devices: [] });

        await mount(
            <NotificationSettingsStory initialStatus={scenario.status} />,
        );

        await expect(page.getByText(scenario.expectedText)).toBeVisible();
        await expect(
            page.getByText(
                `Dozvola: ${expectedPermissionLabel(scenario.status)}`,
            ),
        ).toBeVisible();
    });
}

test('notification settings recovers after a dismissed permission prompt', async ({
    mount,
    page,
}) => {
    await mockNotificationSettingsApi(page, { devices: [] });

    await mount(
        <NotificationSettingsStory
            initialStatus="prompt-dismissed"
            requestResult="subscribed"
        />,
    );

    await page.getByRole('button', { name: 'Uključi obavijesti' }).click();

    await expect(page.getByText('Dozvola: uključeno')).toBeVisible();
});

test('notification settings toggles, revokes, and sends test notifications', async ({
    mount,
    page,
}) => {
    const recorded = await mockNotificationSettingsApi(page);

    await mount(
        <NotificationSettingsStory
            currentDeviceId="current-device"
            initialStatus="subscribed"
        />,
    );

    await expect(
        page.getByRole('switch', {
            name: 'Isključi obavijesti na ovom uređaju',
        }),
    ).toBeChecked();
    await expect(
        page.getByText('Ovaj uređaj', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('ovaj uređaj', { exact: true })).toBeVisible();

    await page.getByRole('switch', { name: 'Isključi Ovaj uređaj' }).click();
    await expect.poll(() => recorded.devicePatches.length).toBe(1);
    expect(recorded.devicePatches[0]).toEqual({ enabled: false });
    await expect(page.getByText('Status: isključeno')).toBeVisible();

    await page
        .getByRole('switch', {
            name: 'Uključi obavijesti na ovom uređaju',
        })
        .click();
    await expect.poll(() => recorded.devicePatches.length).toBe(2);
    expect(recorded.devicePatches[1]).toEqual({ enabled: true });

    await page
        .getByRole('button', { name: 'Pošalji probnu obavijest' })
        .click();
    await expect.poll(() => recorded.testSends).toBe(1);
    await expect(
        page.getByText(
            'Probna obavijest je poslana. Ciljano: 1 · Prihvaćeno: 1 · Neuspjelo: 0',
        ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Ukloni Ovaj uređaj' }).click();
    await expect.poll(() => recorded.deviceDeletes).toEqual(['device-1']);
    await expect(
        page.getByText('Nema uređaja prijavljenih za obavijesti.'),
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(() =>
                window.localStorage.getItem(
                    'farm:test:browser-subscription-revoked',
                ),
            ),
        )
        .toBe('1');
});

test('notification settings keeps API errors visible and recoverable', async ({
    mount,
    page,
}) => {
    await mockNotificationSettingsApi(page, {
        failDevices: true,
        failPushStatus: true,
    });

    await mount(<NotificationSettingsStory initialStatus="setup-failed" />);

    await expect(page.getByText('Obavijesti nisu uključene.')).toBeVisible();
    await expect(
        page.getByText('Status obavijesti nije učitan.'),
    ).toBeVisible();
    await expect(
        page.getByText('Uređaji za obavijesti nisu učitani.'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Uključi obavijesti' }),
    ).toBeVisible();
});
