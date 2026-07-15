import { expect, test } from '@playwright/experimental-ct-react';
import { CustomerDeliveryTracking } from '../components/CustomerDeliveryTracking';
import '../app/globals.css';

const lastAcceptedAt = '2026-07-15T10:00:00.000Z';

test('customer sees a live server-acknowledged location and map', async ({
    mount,
    page,
}) => {
    await mount(
        <CustomerDeliveryTracking
            runId="run-live"
            tracking={{
                status: 'live',
                lastAcceptedAt,
                mapAvailable: true,
            }}
        />,
    );

    await expect(page.getByRole('status')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/Lokacija vozača je uživo/)).toBeVisible();
    await expect(
        page.getByRole('img', {
            name: 'Trenutna lokacija vozača i moja dostava',
        }),
    ).toBeVisible();
});

test('customer sees delayed copy while the last exact location remains available', async ({
    mount,
    page,
}) => {
    await mount(
        <CustomerDeliveryTracking
            runId="run-delayed"
            tracking={{
                status: 'delayed',
                lastAcceptedAt,
                mapAvailable: true,
            }}
        />,
    );

    await expect(page.getByText(/Lokacija vozača kasni/)).toBeVisible();
    await expect(
        page.getByRole('img', {
            name: 'Posljednja potvrđena lokacija vozača i moja dostava',
        }),
    ).toBeVisible();
});

test('customer sees offline state without a stale exact-location map', async ({
    mount,
    page,
}) => {
    await mount(
        <CustomerDeliveryTracking
            runId="run-offline"
            tracking={{
                status: 'offline',
                lastAcceptedAt,
                mapAvailable: false,
            }}
        />,
    );

    await expect(
        page.getByText(/Praćenje je trenutačno izvan mreže/),
    ).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
});

test('customer sees unavailable state before the first accepted location', async ({
    mount,
    page,
}) => {
    await mount(
        <CustomerDeliveryTracking
            runId="run-unavailable"
            tracking={{
                status: 'unavailable',
                lastAcceptedAt: null,
                mapAvailable: false,
            }}
        />,
    );

    await expect(
        page.getByText(/Lokacija vozača još nije dostupna/),
    ).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
});
