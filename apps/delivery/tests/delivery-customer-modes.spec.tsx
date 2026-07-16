import { expect, test } from '@playwright/experimental-ct-react';
import {
    DeliveryUserDashboardStory,
    EmptyCustomerDashboardStory,
    MixedCustomerDashboardStory,
    PickupFarmerDashboardStory,
} from './CustomerDashboardModesStory';
import '../app/globals.css';

test('keeps delivery tracking while presenting pickup location and instructions separately', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-16T08:45:10.000Z'),
    });
    await mount(<MixedCustomerDashboardStory />);

    await expect(
        page.getByRole('heading', {
            level: 2,
            name: 'Moje dostave i preuzimanja',
        }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Statusi uroda, planirani termini, lokacije preuzimanja i praćenje aktivne dostave na jednom mjestu.',
            { exact: true },
        ),
    ).toBeVisible();
    await expect(
        page.getByText('Lokacija vozača je uživo.', { exact: false }),
    ).toBeVisible();

    const delivery = page.getByTestId('customer-delivery-card');
    await expect(delivery).toHaveCount(1);
    await expect(
        delivery.getByRole('heading', { name: 'Rajčica za dostavu' }),
    ).toBeVisible();
    await expect(delivery.getByText('Dostava', { exact: true })).toBeVisible();
    await expect(
        delivery.getByText('Procijenjeni dolazak', { exact: true }),
    ).toBeVisible();
    await expect(
        delivery.getByText('Ažurna procjena prema prometu', { exact: true }),
    ).toBeVisible();
    await expect(
        delivery.getByText('Tvoja dostava je sljedeća.', { exact: true }),
    ).toBeVisible();
    await expect(delivery.locator('time')).toHaveCount(5);
    const deliveryText = await delivery.innerText();
    expect(deliveryText).not.toMatch(/Vožnja|Udaljenost/);

    const map = page.getByRole('img', {
        name: 'Trenutna lokacija vozača i moja dostava',
    });
    await expect(map).toBeVisible();
    const mapSource = await map.getAttribute('src');
    expect(mapSource).toContain('/api/map/customer-mixed-run-4135');

    const pickup = page.getByTestId('customer-pickup-card');
    await expect(pickup).toHaveCount(1);
    await expect(
        pickup.getByRole('heading', {
            name: 'Vrlo dugačka sorta salate za provjeru prikaza na uskom zaslonu',
        }),
    ).toBeVisible();
    await expect(
        pickup.getByText('Preuzimanje', { exact: true }),
    ).toBeVisible();
    await expect(
        pickup.getByText('Spremno za preuzimanje', { exact: true }),
    ).toBeVisible();
    await expect(pickup.getByText('Gredice HQ', { exact: true })).toBeVisible();
    await expect(
        pickup.getByText('Vrtna 1, 10000 Zagreb, HR', { exact: true }),
    ).toBeVisible();
    await expect(
        pickup.getByText(
            'Urod je spreman. Preuzmi ga na ovoj lokaciji tijekom odabranog termina.',
            { exact: true },
        ),
    ).toBeVisible();
    await expect(pickup.locator('time')).toHaveCount(2);
    await expect(pickup.locator('time').first()).toHaveAttribute(
        'datetime',
        '2026-07-16T12:00:00.000Z',
    );
    await expect(pickup.locator('time').nth(1)).toHaveAttribute(
        'datetime',
        '2026-07-16T14:00:00.000Z',
    );

    const locationHref = await pickup
        .getByRole('link', { name: /Otvori lokaciju preuzimanja:/ })
        .getAttribute('href');
    if (!locationHref) throw new Error('Pickup location link is missing.');
    expect(new URL(locationHref).searchParams.get('destination')).toBe(
        'Vrtna 1, 10000 Zagreb, HR',
    );
    const pickupText = await pickup.innerText();
    expect(pickupText).not.toMatch(
        /Lokacija vozača|Vožnja|Udaljenost|Potvrda o dostavi/,
    );
    await expect(pickup.getByTestId('customer-delivery-receipt')).toHaveCount(
        0,
    );
});

test('shows farmer pickup-only copy without delivery promises or receipts', async ({
    mount,
    page,
}) => {
    await mount(<PickupFarmerDashboardStory />);

    await expect(page.getByText('Farmer Fran', { exact: true })).toBeVisible();
    await expect(
        page.getByText('Gredice preuzimanje', { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText('Gredice dostava', { exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('heading', { level: 2, name: 'Moja preuzimanja' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Statusi uroda, lokacije i planirani termini preuzimanja na jednom mjestu.',
            { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByTestId('customer-pickup-card')).toHaveCount(2);
    await expect(page.getByTestId('customer-delivery-card')).toHaveCount(0);
    await expect(page.getByTestId('customer-delivery-receipt')).toHaveCount(0);
    await expect(
        page.getByText('Lokacija vozača je uživo.', { exact: false }),
    ).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(
        /Gredice dostava|Dostava uroda|Vozač|Vožnja|Udaljenost|Potvrda o dostavi/,
    );
    const fulfilled = page
        .getByTestId('customer-pickup-card')
        .filter({ hasText: 'Mrkva za osobno preuzimanje' });
    await expect(
        fulfilled.getByText('Preuzeto', { exact: true }),
    ).toBeVisible();
    await expect(fulfilled.locator('time').last()).toHaveAttribute(
        'datetime',
        '2026-07-16T13:15:00.000Z',
    );
});

test('keeps the user delivery-only heading and tracking experience', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-16T08:45:10.000Z'),
    });
    await mount(<DeliveryUserDashboardStory />);

    await expect(
        page.getByRole('heading', { level: 2, name: 'Moje dostave' }),
    ).toBeVisible();
    await expect(
        page.getByText('Korisnik Korina', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('customer-delivery-card')).toHaveCount(1);
    await expect(page.getByTestId('customer-pickup-card')).toHaveCount(0);
    await expect(
        page.getByText('Lokacija vozača je uživo.', { exact: false }),
    ).toBeVisible();
});

test('uses a mode-neutral empty state', async ({ mount, page }) => {
    await mount(<EmptyCustomerDashboardStory />);

    await expect(
        page.getByRole('heading', {
            level: 2,
            name: 'Moje dostave i preuzimanja',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', {
            level: 3,
            name: 'Još nema dostava ni preuzimanja',
        }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Kada zatražiš dostavu ili preuzimanje uroda, ovdje ćeš vidjeti termin, status i dostupne informacije o preuzimanju.',
            { exact: true },
        ),
    ).toBeVisible();
});

test.describe('pickup presentation on a small touch screen', () => {
    test.use({
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
    });

    test('contains long content and keeps pickup actions touch-sized', async ({
        mount,
        page,
    }) => {
        await mount(<MixedCustomerDashboardStory />);
        const pickup = page.getByTestId('customer-pickup-card');

        const fitsViewport = await pickup.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        );
        expect(fitsViewport).toBe(true);
        for (const link of await pickup.getByRole('link').all()) {
            const box = await link.boundingBox();
            expect(box?.height).toBeGreaterThanOrEqual(44);
        }
    });
});
