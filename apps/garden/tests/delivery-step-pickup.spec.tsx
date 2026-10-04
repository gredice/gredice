import { expect, test } from '@playwright/experimental-ct-react';
import { DeliveryStepPickupStory } from './DeliveryStepPickupStory';

test('explains a pickup-location failure and recovers through retry', async ({
    mount,
    page,
}) => {
    const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
    const effectiveClosesAt = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
    let pickupLocationRequestCount = 0;
    let releaseFirstPickupRequest: () => void = () => undefined;
    const firstPickupRequest = new Promise<void>((resolve) => {
        releaseFirstPickupRequest = resolve;
    });

    await page.route(
        '**/api/gredice/api/delivery/pickup-locations**',
        async (route) => {
            pickupLocationRequestCount += 1;

            if (pickupLocationRequestCount === 1) {
                await firstPickupRequest;
                await route.fulfill({
                    body: JSON.stringify({ error: 'Unavailable' }),
                    contentType: 'application/json',
                    status: 503,
                });
                return;
            }

            await route.fulfill({
                body: JSON.stringify([
                    {
                        id: 7,
                        name: 'Gredice Maksimir',
                        street1: 'Maksimirska 1',
                        street2: null,
                        city: 'Zagreb',
                        postalCode: '10000',
                        countryCode: 'HR',
                        isActive: true,
                        createdAt: startAt.toISOString(),
                        updatedAt: startAt.toISOString(),
                    },
                ]),
                contentType: 'application/json',
                status: 200,
            });
        },
    );
    await page.route('**/api/gredice/api/delivery/slots**', async (route) => {
        await route.fulfill({
            body: JSON.stringify([
                {
                    id: 41,
                    locationId: 7,
                    type: 'pickup',
                    startAt: startAt.toISOString(),
                    endAt: endAt.toISOString(),
                    closesAt: null,
                    effectiveClosesAt: effectiveClosesAt.toISOString(),
                    status: 'scheduled',
                    createdAt: startAt.toISOString(),
                    updatedAt: startAt.toISOString(),
                    location: null,
                },
            ]),
            contentType: 'application/json',
            status: 200,
        });
    });
    await page.route(
        '**/api/gredice/api/delivery/addresses**',
        async (route) => {
            await route.fulfill({
                body: '[]',
                contentType: 'application/json',
                status: 200,
            });
        },
    );

    await mount(<DeliveryStepPickupStory />);

    await expect(
        page.getByRole('status', {
            name: 'Učitavanje lokacije za osobno preuzimanje',
        }),
    ).toBeVisible();
    releaseFirstPickupRequest();

    await expect(
        page.getByText('Nije moguće učitati lokaciju', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nastavi' })).toBeDisabled();

    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();

    await expect(
        page.getByText('Gredice Maksimir — Maksimirska 1, 10000 Zagreb', {
            exact: false,
        }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nastavi' })).toBeEnabled();

    await page.getByRole('button', { name: 'Nastavi' }).click();
    await expect(page.getByLabel('Sažetak osobnog preuzimanja')).toHaveText(
        'Gredice Maksimir — Maksimirska 1, 10000 Zagreb',
    );
});
