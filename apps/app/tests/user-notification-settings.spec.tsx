import { expect, test } from '@playwright/experimental-ct-react';
import { UserNotificationSettingsStory } from './UserNotificationSettingsStory';

const device = {
    id: 'device-1',
    deviceLabel: 'Ovaj uređaj (MacIntel)',
    userAgent: 'Mozilla/5.0 (Macintosh)',
    enabled: true,
    lastSeenAt: '2026-11-20T10:15:00.000Z',
};

test('shows only the error of the last device action', async ({
    mount,
    page,
}) => {
    let failToggle = true;
    let enabled = device.enabled;

    await page.route('**/api/notifications/push-status', (route) =>
        route.fulfill({ json: { status: 'unsubscribed' } }),
    );
    await page.route('**/api/notifications/devices', (route) =>
        route.fulfill({ json: { devices: [{ ...device, enabled }] } }),
    );
    await page.route('**/api/notifications/devices/*', (route) => {
        const method = route.request().method();
        if (method === 'DELETE' || failToggle) {
            return route.fulfill({ status: 500, json: {} });
        }

        enabled = !enabled;
        return route.fulfill({ json: { success: true } });
    });

    await mount(<UserNotificationSettingsStory />);

    const devices = page.getByRole('list');
    const removalError = page.getByText(
        'Uređaj nije uklonjen. Pokušaj ponovno.',
    );
    const toggleError = page.getByText(
        'Uređaj nije ažuriran. Pokušaj ponovno.',
    );
    await expect(devices.getByText('Aktivan')).toBeVisible();

    await devices.getByRole('button', { name: 'Ukloni' }).click();
    await expect(removalError).toBeVisible();

    // A failed switch replaces the removal error with its own.
    await devices.getByRole('button', { name: 'Isključi' }).click();
    await expect(toggleError).toBeVisible();
    await expect(removalError).toBeHidden();

    await devices.getByRole('button', { name: 'Ukloni' }).click();
    await expect(removalError).toBeVisible();
    await expect(toggleError).toBeHidden();

    // A switch that works leaves no error behind.
    failToggle = false;
    await devices.getByRole('button', { name: 'Isključi' }).click();
    await expect(devices.getByText('Isključen')).toBeVisible();
    await expect(removalError).toBeHidden();
    await expect(toggleError).toBeHidden();
    await expect(page.getByRole('alert')).toHaveCount(0);
});
