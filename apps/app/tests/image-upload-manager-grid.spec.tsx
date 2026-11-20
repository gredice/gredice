import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
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

test('bounds individual and batch edits that expand beyond the upload limit', async ({
    mount,
    page,
}) => {
    const width = 256;
    const pixels = Buffer.alloc(width * width * 3);
    let seed = 1;
    for (let i = 0; i < pixels.length; i++) {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        pixels[i] = seed >>> 24;
    }
    const original = await sharp(pixels, {
        raw: { width, height: width, channels: 3 },
    })
        .avif({ quality: 10, effort: 0 })
        .toBuffer();
    const maxFileBytes = original.length;
    expect((await sharp(original).png().toBuffer()).length).toBeGreaterThan(
        maxFileBytes,
    );
    await mount(<ImageUploadManagerGridStory maxFileBytes={maxFileBytes} />);
    await page
        .locator('input[type=file]')
        .setInputFiles(
            ['Gr1.avif', 'Gr2.avif'].map((name) => ({
                name,
                mimeType: 'image/avif',
                buffer: original,
            })),
        );
    await page.getByRole('button', { name: 'Uredi sliku Gr1.avif' }).click();
    const editor = page.getByRole('dialog', { name: 'Uredi sliku Gr1.avif' });
    await editor.getByLabel('Predložak').selectOption({ label: 'Prirodno' });
    await editor
        .getByRole('checkbox', { name: /Primijeni izgled na sve/ })
        .check();
    await editor
        .getByRole('button', { name: 'Primijeni', exact: true })
        .click();
    await expect(editor).not.toBeVisible();
    for (const stem of ['Gr1', 'Gr2']) {
        await expect(
            page.getByRole('button', { name: `Uredi sliku ${stem}.webp` }),
        ).toBeVisible();
    }
    const sizes = await page
        .locator('[data-image-upload-layout] img')
        .evaluateAll(async (images) =>
            Promise.all(
                images.map(async (image) => {
                    if (!(image instanceof HTMLImageElement))
                        throw new Error('Expected a thumbnail');
                    const blob = await (await fetch(image.src)).blob();
                    return {
                        bytes: blob.size,
                        type: blob.type,
                        width: image.naturalWidth,
                    };
                }),
            ),
        );
    expect(sizes).toHaveLength(2);
    for (const size of sizes) {
        expect(size.type).toBe('image/webp');
        expect(size.bytes).toBeGreaterThan(0);
        expect(size.bytes).toBeLessThanOrEqual(maxFileBytes);
        expect(size.width).toBeGreaterThan(0);
        expect(size.width).toBeLessThan(width);
    }
});
