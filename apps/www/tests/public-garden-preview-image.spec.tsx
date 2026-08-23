import { expect, test } from '@playwright/experimental-ct-react';
import '../app/globals.css';
import { PublicGardenPreviewImage } from '../app/vrtovi/PublicGardenPreviewImage';

test('shows an honest neutral state while a garden preview is unavailable', async ({
    mount,
    page,
}) => {
    await mount(
        <PublicGardenPreviewImage
            gardenName="Moj vrt"
            previewImageUrl={null}
        />,
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
    const previewImageUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"%3E%3Crect width="1200" height="630" fill="green"/%3E%3C/svg%3E';

    await mount(
        <PublicGardenPreviewImage
            gardenName="Zeleni vrt"
            previewImageUrl={previewImageUrl}
        />,
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
    await page.route('**/missing-garden-preview.webp', (route) =>
        route.fulfill({ status: 404 }),
    );

    await mount(
        <PublicGardenPreviewImage
            gardenName="Nedostupan vrt"
            previewImageUrl="https://cdn.gredice.com/missing-garden-preview.webp"
        />,
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
