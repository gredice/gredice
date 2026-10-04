import { expect, test } from '@playwright/experimental-ct-react';
import { ImageUploadManagerGridStory } from './ImageUploadManagerGridStory';

const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

test('shows selected uploads once in a compact image grid', async ({
    mount,
    page,
}) => {
    await mount(<ImageUploadManagerGridStory />);

    await page.locator('input[type="file"]').setInputFiles([
        { name: 'Gr1.jpg', mimeType: 'image/png', buffer: PNG_BYTES },
        { name: 'Gr2.jpg', mimeType: 'image/png', buffer: PNG_BYTES },
    ]);

    const grid = page.locator('[data-image-upload-layout="grid"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator('img')).toHaveCount(2);
    await expect(grid.getByText('Gr1.jpg')).toHaveCount(1);
    await expect(grid.getByText('Gr2.jpg')).toHaveCount(1);
    await expect(grid.getByText('Gr1', { exact: true })).toBeVisible();
    await expect(
        grid.getByRole('button', { name: 'Ukloni sliku Gr1.jpg' }),
    ).toBeVisible();
});
