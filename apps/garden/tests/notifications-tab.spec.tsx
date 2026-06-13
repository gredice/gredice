import { expect, test } from '@playwright/experimental-ct-react';
import type { Page, Route } from '@playwright/test';
import { NotificationsTabStory } from './NotificationsTabStory';

type Deferred = {
    promise: Promise<void>;
    resolve: () => void;
};

type MockEndpoint<T> = {
    body: T;
    delay?: Deferred;
    status?: number;
};

type RecordedNotificationRequests = {
    deviceDeletes: string[];
    devicePatches: unknown[];
    notificationReads: Array<string | null>;
    preferencesUpdates: unknown[];
    testSends: number;
    userPatches: unknown[];
};

const defaultPreferences = [
    {
        category: 'garden',
        channel: 'push',
        digestFrequency: 'off',
        enabled: false,
        quietHoursEndMinute: null,
        quietHoursStartMinute: null,
        scope: 'global',
    },
    {
        category: 'weather_alerts',
        channel: 'push',
        digestFrequency: 'off',
        enabled: true,
        quietHoursEndMinute: null,
        quietHoursStartMinute: null,
        scope: 'global',
    },
    {
        category: 'reminders',
        channel: 'push',
        digestFrequency: 'weekly',
        enabled: true,
        quietHoursEndMinute: 7 * 60,
        quietHoursStartMinute: 22 * 60,
        scope: 'global',
    },
    {
        category: 'admin_campaigns',
        channel: 'push',
        digestFrequency: 'off',
        enabled: false,
        quietHoursEndMinute: null,
        quietHoursStartMinute: null,
        scope: 'global',
    },
    {
        category: 'promotional',
        channel: 'push',
        digestFrequency: 'off',
        enabled: false,
        quietHoursEndMinute: null,
        quietHoursStartMinute: null,
        scope: 'global',
    },
];

const defaultDevices = [
    {
        createdAt: '2026-05-20T08:00:00.000Z',
        deviceId: 'current-device',
        deviceLabel: 'Ovaj uređaj (MacIntel)',
        enabled: true,
        id: 'device-1',
        lastSeenAt: '2026-05-20T10:00:00.000Z',
        locale: 'hr-HR',
        permissionState: 'granted',
        platform: 'MacIntel',
        revokedAt: null,
        revokedReason: null,
        timezone: 'Europe/Zagreb',
        updatedAt: '2026-05-20T10:00:00.000Z',
        userAgent: 'Chrome test browser',
    },
];

function createDeferred(): Deferred {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((next) => {
        resolve = () => next();
    });
    return { promise, resolve };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
    await route.fulfill({
        body: JSON.stringify(body),
        contentType: 'application/json',
        status,
    });
}

async function resolveEndpoint<T>(endpoint: MockEndpoint<T>) {
    if (endpoint.delay) {
        await endpoint.delay.promise;
    }

    return endpoint.status && endpoint.status >= 400
        ? {
              body: { error: 'Mock notification settings failure' },
              status: endpoint.status,
          }
        : { body: endpoint.body, status: endpoint.status ?? 200 };
}

async function mockNotificationSettingsApi(
    page: Page,
    options: {
        devices?: MockEndpoint<{ devices: typeof defaultDevices }>;
        preferences?: MockEndpoint<{ preferences: typeof defaultPreferences }>;
        pushStatus?: MockEndpoint<{ hasDevices: boolean; status: string }>;
        testResult?: unknown;
    } = {},
) {
    const recorded: RecordedNotificationRequests = {
        deviceDeletes: [],
        devicePatches: [],
        notificationReads: [],
        preferencesUpdates: [],
        testSends: 0,
        userPatches: [],
    };
    const preferences = options.preferences ?? {
        body: { preferences: defaultPreferences },
    };
    const devices = options.devices ?? { body: { devices: defaultDevices } };
    const pushStatus = options.pushStatus ?? {
        body: { hasDevices: true, status: 'subscribed' },
    };
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

        if (pathname.includes('/api/users/current')) {
            await fulfillJson(route, {
                avatarUrl: null,
                birthday: null,
                birthdayLastRewardAt: null,
                birthdayLastUpdatedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                displayName: 'Test User',
                email: 'test@example.com',
                id: 'test-user',
                userName: 'test-user',
                whatsNewLastSeenAt: null,
                whatsNewPopupDisabled: false,
            });
            return;
        }

        if (pathname.includes('/api/users/test-user') && method === 'PATCH') {
            recorded.userPatches.push(request.postDataJSON());
            await fulfillJson(route, {
                avatarUrl: null,
                birthday: null,
                birthdayLastRewardAt: null,
                birthdayLastUpdatedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                displayName: 'Test User',
                email: 'test@example.com',
                id: 'test-user',
                userName: 'test-user',
                whatsNewLastSeenAt: null,
                whatsNewPopupDisabled:
                    request.postDataJSON().whatsNewPopupDisabled,
            });
            return;
        }

        if (
            pathname.includes('/api/notifications/preferences') &&
            method === 'GET'
        ) {
            const response = await resolveEndpoint(preferences);
            await fulfillJson(route, response.body, response.status);
            return;
        }

        if (
            pathname.includes('/api/notifications/preferences') &&
            method === 'PUT'
        ) {
            recorded.preferencesUpdates.push(request.postDataJSON());
            await fulfillJson(route, { success: true });
            return;
        }

        if (
            pathname.includes('/api/notifications/devices') &&
            !pathname.includes('/api/notifications/devices/device-1') &&
            method === 'GET'
        ) {
            const response = await resolveEndpoint(devices);
            await fulfillJson(route, response.body, response.status);
            return;
        }

        if (
            pathname.includes('/api/notifications/push-status') &&
            method === 'GET'
        ) {
            const response = await resolveEndpoint(pushStatus);
            await fulfillJson(route, response.body, response.status);
            return;
        }

        if (
            pathname.includes('/api/notifications/devices/device-1') &&
            method === 'PATCH'
        ) {
            recorded.devicePatches.push(request.postDataJSON());
            await fulfillJson(route, { success: true });
            return;
        }

        if (
            pathname.includes('/api/notifications/devices/device-1') &&
            method === 'DELETE'
        ) {
            recorded.deviceDeletes.push('device-1');
            await fulfillJson(route, { success: true });
            return;
        }

        if (pathname.includes('/api/notifications/test') && method === 'POST') {
            recorded.testSends += 1;
            await fulfillJson(route, testResult);
            return;
        }

        if (pathname.endsWith('/api/notifications') && method === 'GET') {
            recorded.notificationReads.push(
                new URL(request.url()).searchParams.get('read'),
            );
            await fulfillJson(route, []);
            return;
        }

        throw new Error(
            `Unexpected notification settings request: ${method} ${pathname}`,
        );
    });

    return recorded;
}

test('notification tabs size to their labels', async ({ mount, page }) => {
    await mockNotificationSettingsApi(page);
    await mount(<NotificationsTabStory />);

    const tabList = page.getByRole('tablist');
    const widths = await tabList.evaluate((element) => {
        const listRect = element.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();

        return {
            list: listRect.width,
            parent: parentRect?.width ?? 0,
        };
    });

    expect(widths.list).toBeLessThan(widths.parent * 0.75);
});

test('notification list starts with the requested all filter', async ({
    mount,
    page,
}) => {
    const recorded = await mockNotificationSettingsApi(page);

    await mount(<NotificationsTabStory initialFilter="all" />);

    await expect.poll(() => recorded.notificationReads).toContain('true');
});

test('notification settings shows loading, status, and empty device states', async ({
    mount,
    page,
}) => {
    const preferencesDelay = createDeferred();
    const devicesDelay = createDeferred();
    const pushStatusDelay = createDeferred();
    await mockNotificationSettingsApi(page, {
        devices: {
            body: { devices: [] },
            delay: devicesDelay,
        },
        preferences: {
            body: { preferences: [] },
            delay: preferencesDelay,
        },
        pushStatus: {
            body: { hasDevices: false, status: 'unsubscribed' },
            delay: pushStatusDelay,
        },
    });

    await mount(<NotificationsTabStory />);
    await page.getByRole('tab', { name: 'Postavke' }).click();

    await expect(page.getByText('Postavke se učitavaju.')).toBeVisible();
    await expect(page.getByText('Uređaji se učitavaju.')).toBeVisible();
    await expect(page.getByText('Učitavanje')).toBeVisible();

    preferencesDelay.resolve();
    devicesDelay.resolve();
    pushStatusDelay.resolve();

    await expect(
        page.getByText('Nema uređaja prijavljenih za obavijesti.'),
    ).toBeVisible();
    await expect(page.getByText('Isključeno')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Od' })).toHaveCount(0);
    await expect(page.getByText('Razdoblje sažetka')).toHaveCount(0);
});

test('notification settings explains required groups and hydrates saved preference timing', async ({
    mount,
    page,
}) => {
    await mockNotificationSettingsApi(page);

    await mount(<NotificationsTabStory />);
    await page.getByRole('tab', { name: 'Postavke' }).click();

    await expect(
        page.getByText('Sigurnost računa i pravne obavijesti'),
    ).toBeVisible();
    await expect(
        page.getByText('Plaćanja, računi i potvrde narudžbi'),
    ).toBeVisible();
    await expect(page.getByText('Vrste obavijesti')).toBeVisible();
    await expect(
        page.getByRole('checkbox', { name: /sigurnost računa/u }),
    ).toHaveCount(0);
    await expect(
        page.getByText('Promotivne ponude i sezonske preporuke'),
    ).toBeVisible();
    await expect(
        page.getByRole('checkbox', { name: 'Uključi podsjetnici i zadaci' }),
    ).toBeChecked();
    await expect(
        page.getByRole('checkbox', { name: 'Ne ometaj' }),
    ).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Od' })).toHaveValue(
        '22:00',
    );
    await expect(page.getByRole('textbox', { name: 'Do' })).toHaveValue(
        '07:00',
    );
    await expect(page.getByText('Tjedno')).toBeVisible();
});

test('notification settings toggles the what is new widget', async ({
    mount,
    page,
}) => {
    const recorded = await mockNotificationSettingsApi(page);

    await mount(<NotificationsTabStory />);
    await page.getByRole('tab', { name: 'Postavke' }).click();

    const whatsNewSwitch = page.getByRole('switch', {
        name: 'Prikaži widget Što je novo u vrtu',
    });
    await expect(whatsNewSwitch).toBeChecked();

    await whatsNewSwitch.click();

    await expect.poll(() => recorded.userPatches.length).toBe(1);
    expect(recorded.userPatches[0]).toMatchObject({
        whatsNewPopupDisabled: true,
    });
});

test('notification settings keeps current device off without a local device id', async ({
    mount,
    page,
}) => {
    const recorded = await mockNotificationSettingsApi(page);

    await mount(<NotificationsTabStory />);
    await page.getByRole('tab', { name: 'Postavke' }).click();

    const currentDeviceSwitch = page.getByRole('switch', {
        name: 'Uključi obavijesti na ovom uređaju',
    });
    await expect(currentDeviceSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(
        page.getByRole('switch', { name: 'Isključi Ovaj uređaj' }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => recorded.devicePatches.length).toBe(0);
});

test('notification settings shows endpoint errors without hiding the settings tab', async ({
    mount,
    page,
}) => {
    await mockNotificationSettingsApi(page, {
        devices: {
            body: { devices: [] },
            status: 500,
        },
        preferences: {
            body: { preferences: [] },
            status: 500,
        },
        pushStatus: {
            body: { hasDevices: false, status: 'unsubscribed' },
            status: 500,
        },
    });

    await mount(<NotificationsTabStory />);
    await page.getByRole('tab', { name: 'Postavke' }).click();

    await expect(
        page.getByText('Postavke obavijesti nisu učitane.'),
    ).toBeVisible();
    await expect(
        page.getByText('Uređaji za obavijesti nisu učitani.'),
    ).toBeVisible();
    await expect(
        page.getByText('Status obavijesti nije učitan.'),
    ).toBeVisible();
});

test('notification settings calls preference, device, and test notification APIs', async ({
    mount,
    page,
}) => {
    const recorded = await mockNotificationSettingsApi(page);
    await page.evaluate(() =>
        window.localStorage.setItem('game:push:device-id', 'current-device'),
    );

    await mount(<NotificationsTabStory />);
    await page.getByRole('tab', { name: 'Postavke' }).click();

    await expect(page.getByText('Ovaj uređaj')).toBeVisible();
    await expect(page.getByText('Chrome test browser')).toHaveCount(0);
    await page
        .getByRole('checkbox', { name: 'Uključi radovi i berba u vrtu' })
        .click();

    await expect
        .poll(() => recorded.preferencesUpdates.length)
        .toBeGreaterThan(0);
    expect(recorded.preferencesUpdates[0]).toEqual({
        preferences: [
            {
                category: 'garden',
                channel: 'push',
                digestFrequency: 'weekly',
                enabled: true,
                quietHoursEndMinute: 420,
                quietHoursStartMinute: 1320,
                scope: 'global',
            },
        ],
    });

    await page
        .getByRole('switch', {
            name: 'Isključi obavijesti na ovom uređaju',
        })
        .click();
    await expect.poll(() => recorded.devicePatches.length).toBe(1);
    expect(recorded.devicePatches[0]).toEqual({ enabled: false });

    await page
        .getByRole('button', { name: 'Pošalji probnu obavijest' })
        .click();
    await expect.poll(() => recorded.testSends).toBe(1);
    await expect(
        page.getByText(
            'Probna obavijest je poslana. Ciljano: 1 · Prihvaćeno: 1 · Neuspjelo: 0',
        ),
    ).toBeVisible();
});
