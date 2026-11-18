import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedSensorHistoryFixture } from './RaisedBedSensorHistoryFixture';

test('Garden shows unavailable history and preserves a real zero when the next range succeeds', async ({
    page,
    mount,
}) => {
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
            if (url.searchParams.get('duration') === '3') {
                return route.fulfill({
                    status: 503,
                    json: { error: 'Sensor history unavailable' },
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
    await expect(dialog.getByRole('status')).toHaveCount(0);
});
