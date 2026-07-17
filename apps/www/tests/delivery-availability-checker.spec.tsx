import { expect, test } from '@playwright/experimental-ct-react';
import { DeliveryAvailabilityChecker } from '../app/dostava/DeliveryAvailabilityChecker';
import '../app/globals.css';

test('calculates paid delivery from the driving distance', async ({
    mount,
    page,
}) => {
    await page.route('**/api/public/delivery-quote', (route) =>
        route.fulfill({
            status: 200,
            json: {
                distanceKilometres: 20,
                formattedAddress: 'Testna ulica 1, Velika Gorica, Hrvatska',
                isAvailable: true,
                isFree: false,
                price: 4,
            },
        }),
    );
    await mount(<DeliveryAvailabilityChecker />);
    await page
        .getByLabel('Adresa dostave')
        .fill('Testna ulica 1, Velika Gorica');
    await page.getByRole('button', { name: 'Izračunaj' }).click();

    const result = page.getByRole('alert');
    await expect(result).toContainText('Dostava je dostupna.');
    await expect(result).toContainText('20,0 km');
    await expect(result).toContainText('4,00 €');
});

test('recognizes free delivery inside the City of Zagreb', async ({
    mount,
    page,
}) => {
    await page.route('**/api/public/delivery-quote', (route) =>
        route.fulfill({
            status: 200,
            json: {
                distanceKilometres: 5,
                formattedAddress: 'Testna ulica 1, Zagreb, Hrvatska',
                isAvailable: true,
                isFree: true,
                price: 0,
            },
        }),
    );
    await mount(<DeliveryAvailabilityChecker />);
    await page.getByLabel('Adresa dostave').fill('Testna ulica 1, Zagreb');
    await page.getByRole('button', { name: 'Izračunaj' }).click();

    const result = page.getByRole('alert');
    await expect(result).toContainText('Dostava je dostupna i besplatna.');
    await expect(result).toContainText('području Grada Zagreba');
});

test('reports addresses beyond the delivery area', async ({ mount, page }) => {
    await page.route('**/api/public/delivery-quote', (route) =>
        route.fulfill({
            status: 200,
            json: {
                distanceKilometres: 100.1,
                formattedAddress: 'Testna ulica 1, Pula, Hrvatska',
                isAvailable: false,
                isFree: false,
                price: 0,
            },
        }),
    );
    await mount(<DeliveryAvailabilityChecker />);
    await page.getByLabel('Adresa dostave').fill('Testna ulica 1, Pula');
    await page.getByRole('button', { name: 'Izračunaj' }).click();

    const result = page.getByRole('alert');
    await expect(result).toContainText('Dostava nije dostupna na ovu adresu.');
    await expect(result).toContainText('100,1 km');
    await expect(result).toContainText('Dostavljamo do 100 km');
});

test('explains when address checking is temporarily unavailable', async ({
    mount,
    page,
}) => {
    await page.route('**/api/public/delivery-quote', (route) =>
        route.fulfill({
            status: 503,
            json: { error: 'Delivery lookup unavailable.' },
        }),
    );
    await mount(<DeliveryAvailabilityChecker />);
    await page.getByLabel('Adresa dostave').fill('Testna ulica 1, Zagreb');
    await page.getByRole('button', { name: 'Izračunaj' }).click();

    await expect(page.getByRole('alert')).toContainText(
        'Trenutačno ne možemo izračunati dostavu',
    );
});

test('asks the user to correct an unknown Croatian address', async ({
    mount,
    page,
}) => {
    await page.route('**/api/public/delivery-quote', (route) =>
        route.fulfill({
            status: 404,
            json: { error: 'Address not found.' },
        }),
    );
    await mount(<DeliveryAvailabilityChecker />);
    await page.getByLabel('Adresa dostave').fill('Nepoznata adresa 123');
    await page.getByRole('button', { name: 'Izračunaj' }).click();

    await expect(page.getByRole('alert')).toContainText(
        'Nismo pronašli tu adresu u Hrvatskoj',
    );
});
