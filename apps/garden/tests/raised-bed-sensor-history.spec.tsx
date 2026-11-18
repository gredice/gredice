import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedSensorHistoryFixture } from './RaisedBedSensorHistoryFixture';

test('Garden distinguishes unavailable, cached, pending, and empty sensor history', async ({
    page,
    mount,
}) => {
    let oneDayRefreshStatus: 404 | 503 | undefined;
    await page.route('**/api/gredice/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/sensors')) {
            return route.fulfill({
                json: [
                    {
                        id: 31,
                        status: 'active',
                        type: 'soil_moisture',
                        value: '34.5',
                        updatedAt: new Date().toISOString(),
                    },
                ],
            });
        }
        if (url.pathname.endsWith('/soil_moisture')) {
            const duration = url.searchParams.get('duration');
            if (
                duration === '3' ||
                (duration === '1' && oneDayRefreshStatus === 503)
            ) {
                return route.fulfill({
                    status: 503,
                    json: { error: 'Sensor history unavailable' },
                });
            }
            if (
                duration === '30' ||
                (duration === '1' && oneDayRefreshStatus === 404)
            ) {
                return route.fulfill({
                    status: 404,
                    json: { error: 'Sensor not found' },
                });
            }
            if (duration === '10') {
                return route.fulfill({
                    json: { id: 31, type: 'soil_moisture', values: [] },
                });
            }
            return route.fulfill({
                json: {
                    id: 31,
                    type: 'soil_moisture',
                    values: [
                        {
                            timeStamp: new Date().toISOString(),
                            valueSerialized: '0',
                        },
                        {
                            timeStamp: new Date(
                                Date.now() + 1_000,
                            ).toISOString(),
                            valueSerialized: null,
                        },
                    ],
                },
            });
        }
        if (url.pathname.endsWith('/soil_temperature')) {
            return route.fulfill({
                json: { id: 31, type: 'soil_temperature', values: [] },
            });
        }
        return route.fulfill({ status: 401, json: {} });
    });
    await mount(<RaisedBedSensorHistoryFixture />);
    await page.getByRole('button', { name: /Vlažnost tla/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('status')).toHaveText(
        'Povijest očitanja senzora trenutačno nije dostupna.',
    );
    await expect(dialog.getByText('–', { exact: true })).toHaveCount(3);
    await expect(dialog.getByText('0%', { exact: true })).toHaveCount(0);
    await dialog.getByRole('tab', { name: '1 dan' }).click();
    await expect(dialog.getByText('0%', { exact: true })).toHaveCount(2);
    await expect(dialog.getByText('–', { exact: true })).toHaveCount(1);
    await expect(dialog.getByRole('status')).toBeEmpty();
    const chart = dialog.getByRole('application');
    await expect(chart).toBeVisible();

    oneDayRefreshStatus = 503;
    await page.context().setOffline(true);
    await page.context().setOffline(false);
    await expect(dialog.getByRole('status')).toHaveText(
        'Povijest očitanja nije moguće osvježiti. Prikazana su posljednja dostupna očitanja.',
    );
    await expect(dialog.getByText('Posljednje dostupno')).toBeVisible();
    await expect(dialog.getByText('0%', { exact: true })).toHaveCount(2);

    oneDayRefreshStatus = 404;
    await page.context().setOffline(true);
    await page.context().setOffline(false);
    await expect(dialog.getByRole('status')).toHaveText(
        'Povijest očitanja senzora trenutačno nije dostupna.',
    );
    await expect(chart).toBeHidden();
    await expect(dialog.getByText('Prosjek', { exact: true })).toBeHidden();

    oneDayRefreshStatus = 503;
    await page.context().setOffline(true);
    await page.context().setOffline(false);
    await expect(dialog.getByText('Prosjek', { exact: true })).toBeVisible();
    await expect(dialog.getByText('–', { exact: true })).toHaveCount(3);
    await expect(dialog.getByText('0%', { exact: true })).toHaveCount(0);

    await page.context().setOffline(true);
    await dialog.getByRole('tab', { name: '10 dana' }).click();
    await expect(dialog.getByRole('status')).toHaveText(
        'Učitavanje očitanja senzora…',
    );
    await page.context().setOffline(false);
    await expect(dialog.getByRole('status')).toHaveText(
        'Nema očitanja za odabrano razdoblje.',
    );

    await dialog.getByRole('tab', { name: '30 dana' }).click();
    await expect(dialog.getByRole('status')).toHaveText(
        'Povijest očitanja senzora trenutačno nije dostupna.',
    );
});
