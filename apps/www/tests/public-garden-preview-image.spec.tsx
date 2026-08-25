import {
    PublicChromeProvider,
    PublicEnvironmentFooterControls,
} from '@gredice/ui/PublicChrome';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import '../app/globals.css';
import { PublicGardenPreviewImage } from '../app/vrtovi/PublicGardenPreviewImage';

async function mockPublicEnvironmentRequests(page: Page, debug = false) {
    await page.route('**/api/auth/current-claims', async (route) => {
        await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    });
    await page.route('**/api/public-environment/debug', async (route) => {
        await route.fulfill({ status: 200, json: { enabled: debug } });
    });
    await page.route('**/api/data/weather/now', async (route) => {
        await route.fulfill({
            status: 200,
            json: {
                cloudy: 0,
                foggy: 0,
                rainy: 0,
                snowy: 0,
                thundery: 0,
            },
        });
    });
}

test('shows an honest neutral state while a garden preview is unavailable', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    await mount(
        <PublicChromeProvider>
            <PublicGardenPreviewImage
                dayPreviewImageUrl={null}
                gardenName="Moj vrt"
            />
        </PublicChromeProvider>,
    );

    await expect(
        page.getByRole('img', {
            name: 'Pregled vrta Moj vrt još nije dostupan',
        }),
    ).toBeVisible();
    await expect(page.getByText('Pregled se priprema')).toBeVisible();
    await expect(page.getByAltText('Prikaz vrta Moj vrt')).toHaveCount(0);
});

test('renders a persisted garden preview when one is available', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    const previewImageUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"%3E%3Crect width="1200" height="630" fill="green"/%3E%3C/svg%3E';

    await mount(
        <PublicChromeProvider>
            <PublicGardenPreviewImage
                dayPreviewImageUrl={previewImageUrl}
                gardenName="Zeleni vrt"
            />
        </PublicChromeProvider>,
    );

    await expect(page.getByAltText('Prikaz vrta Zeleni vrt')).toBeVisible();
    await expect(
        page.getByRole('img', {
            name: 'Pregled vrta Zeleni vrt još nije dostupan',
        }),
    ).toHaveCount(0);
});

test('returns to the neutral state when a persisted preview cannot load', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    await page.route('**/missing-garden-preview.webp', (route) =>
        route.fulfill({ status: 404 }),
    );

    await mount(
        <PublicChromeProvider>
            <PublicGardenPreviewImage
                dayPreviewImageUrl="https://cdn.gredice.com/missing-garden-preview.webp"
                gardenName="Nedostupan vrt"
            />
        </PublicChromeProvider>,
    );

    await expect(
        page.getByRole('img', {
            name: 'Pregled vrta Nedostupan vrt još nije dostupan',
        }),
    ).toBeVisible();
    await expect(page.getByAltText('Prikaz vrta Nedostupan vrt')).toHaveCount(
        0,
    );
});

test('switches between day and night previews with the public environment', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page, true);
    const dayPreviewImageUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"%3E%3Crect width="1200" height="630" fill="green"/%3E%3C/svg%3E';
    const nightPreviewImageUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"%3E%3Crect width="1200" height="630" fill="navy"/%3E%3C/svg%3E';

    await mount(
        <PublicChromeProvider>
            <PublicGardenPreviewImage
                dayPreviewImageUrl={dayPreviewImageUrl}
                gardenName="Dnevni i noćni vrt"
                nightPreviewImageUrl={nightPreviewImageUrl}
            />
            <PublicEnvironmentFooterControls />
        </PublicChromeProvider>,
    );

    await page.getByText('Debug prikaza').click();
    await page.getByLabel('Fiksiraj vrijeme').check();
    const timeOfDay = page.getByLabel('Vrijeme dana');
    const preview = page.getByAltText('Prikaz vrta Dnevni i noćni vrt');

    await timeOfDay.fill('720');
    await expect(preview).toHaveAttribute('src', dayPreviewImageUrl);

    await timeOfDay.fill('1380');
    await expect(preview).toHaveAttribute('src', nightPreviewImageUrl);
});
