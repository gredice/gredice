import { expect, test } from '@playwright/experimental-ct-react';
import { CustomerDeliveryTrackingFromRequest } from './CustomerDeliveryTrackingStory';
import '../app/globals.css';

const lastAcceptedAt = '2026-07-15T10:00:00.000Z';

test('customer sees a live server-acknowledged location and map', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-15T10:00:10.000Z'),
    });
    await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-live"
            tracking={{
                status: 'live',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 110_000,
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

test('keeps polling timestamps outside the polite tracking announcement', async ({
    mount,
}) => {
    const component = await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-announcement"
            tracking={{
                status: 'live',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 110_000,
            }}
        />,
    );
    const announcement = component.getByRole('status');

    await expect(announcement).toHaveText('Lokacija vozača je uživo.');
    const initialAnnouncement = await announcement.textContent();
    await component.update(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-announcement"
            tracking={{
                status: 'live',
                lastAcceptedAt: '2026-07-15T10:00:10.000Z',
                mapAvailable: true,
                exactLocationExpiresInMs: 110_000,
            }}
        />,
    );

    await expect(announcement).toHaveText(initialAnnouncement ?? '');
    await expect(component.locator('time')).toHaveAttribute(
        'datetime',
        '2026-07-15T10:00:10.000Z',
    );

    await component.update(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-announcement"
            tracking={{
                status: 'delayed',
                lastAcceptedAt: '2026-07-15T10:00:10.000Z',
                mapAvailable: true,
                exactLocationExpiresInMs: 60_000,
            }}
        />,
    );
    await expect(announcement).toHaveText('Lokacija vozača kasni.');
    await expect(component.getByRole('alert')).toHaveCount(0);
});

test('ages a live location to delayed when dashboard polling stalls', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-15T10:00:29.000Z'),
    });
    await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-aging"
            tracking={{
                status: 'live',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 91_000,
            }}
        />,
    );

    await expect(page.getByText(/Lokacija vozača je uživo/)).toBeVisible();
    await page.clock.fastForward(1_001);
    await expect(page.getByText(/Lokacija vozača kasni/)).toBeVisible();
    await expect(
        page.getByRole('img', {
            name: 'Posljednja potvrđena lokacija vozača i moja dostava',
        }),
    ).toBeVisible();
});

test('customer sees delayed copy while the last exact location remains available', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-15T10:01:00.000Z'),
    });
    await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-delayed"
            tracking={{
                status: 'delayed',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 60_000,
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

test('removes exact map data at the TTL without waiting for a dashboard poll', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-15T10:01:59.000Z'),
    });
    await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-expiring"
            tracking={{
                status: 'delayed',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 1_000,
            }}
        />,
    );

    await expect(page.getByRole('img')).toBeVisible();
    await page.clock.fastForward(1_001);
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(
        page.getByText(/Praćenje je trenutačno izvan mreže/),
    ).toBeVisible();
});

test('subtracts request and render transit from the server TTL remainder', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-15T10:01:59.000Z'),
    });
    await mount(
        <CustomerDeliveryTrackingFromRequest
            requestAgeMs={900}
            mapPath="/api/map/run-transit-delay"
            tracking={{
                status: 'delayed',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 1_000,
            }}
        />,
    );

    await expect(page.getByRole('img')).toBeVisible();
    await page.clock.fastForward(101);
    await expect(page.getByRole('img')).toHaveCount(0);
});

test('uses the server TTL remainder instead of the customer device clock', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2099-01-01T00:00:00.000Z'),
    });
    await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-clock-skew"
            tracking={{
                status: 'delayed',
                lastAcceptedAt,
                mapAvailable: true,
                exactLocationExpiresInMs: 1_000,
            }}
        />,
    );

    await expect(page.getByRole('img')).toBeVisible();
    await page.clock.setSystemTime(new Date('1999-01-01T00:00:00.000Z'));
    await expect(page.getByRole('img')).toBeVisible();
    await page.clock.fastForward(1_000);
    await expect(page.getByRole('img')).toHaveCount(0);
});

test('customer sees offline state without a stale exact-location map', async ({
    mount,
    page,
}) => {
    await mount(
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-offline"
            tracking={{
                status: 'offline',
                lastAcceptedAt,
                mapAvailable: false,
                exactLocationExpiresInMs: null,
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
        <CustomerDeliveryTrackingFromRequest
            mapPath="/api/map/run-unavailable"
            tracking={{
                status: 'unavailable',
                lastAcceptedAt: null,
                mapAvailable: false,
                exactLocationExpiresInMs: null,
            }}
        />,
    );

    await expect(
        page.getByText(/Lokacija vozača još nije dostupna/),
    ).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
});
