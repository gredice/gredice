import { expect, test } from '@playwright/experimental-ct-react';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { AutumnPhotoStory } from './AutumnPhotoStory';

async function directoryRoutes(page: import('@playwright/test').Page) {
    await page.route('**/api/gredice/api/directories/entities/**', (route) => {
        const pathname = new URL(route.request().url()).pathname;
        return route.fulfill({
            json: pathname.endsWith('/block') ? getLocalSandboxBlockData() : [],
        });
    });
    await page.route('**/api/gredice/api/data/weather/now**', (route) =>
        route.fulfill({
            json: {
                cloudy: 0,
                foggy: 0,
                temperature: 15,
                rainy: 0,
                snowy: 0,
                windSpeed: 0,
            },
        }),
    );
}

test('optional private photo captures the actual selected camera as a nonblank PNG, saves locally, and releases preview on close', async ({
    mount,
    page,
}) => {
    test.setTimeout(90_000);
    await directoryRoutes(page);
    const writes: string[] = [];
    const gardenReads: string[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'GET') writes.push(request.url());
        if (/\/api\/.*(?:gardens|share)/u.test(new URL(request.url()).pathname))
            gardenReads.push(request.url());
    });
    await mount(<AutumnPhotoStory />);
    await expect(page.getByTestId('photo-camera')).toContainText('zoom', {
        timeout: 15000,
    });
    const before = await page.getByTestId('photo-camera').textContent();
    await page.getByRole('button', { name: 'Select rotated view' }).click();
    await expect(page.getByTestId('photo-camera')).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Select one-block scene' }).click();
    await page.getByRole('button', { name: 'Jesenski foto trenuci' }).click();
    await page.getByRole('radio', { name: /Prvi list/u }).check();
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    await expect(
        page.getByRole('img', {
            name: 'Pregled odabranog vrta bez osobnih oznaka',
        }),
    ).toBeVisible({ timeout: 60_000 });
    const image = page.getByRole('img', {
        name: 'Pregled odabranog vrta bez osobnih oznaka',
    });
    const result = await image.evaluate(async (node) => {
        const url = node.getAttribute('src');
        if (!url) throw new Error('No preview');
        const blob = await (await fetch(url)).blob();
        const bytes = new DataView(await blob.arrayBuffer());
        const chunks: string[] = [];
        for (let offset = 8; offset + 12 <= bytes.byteLength; ) {
            const length = bytes.getUint32(offset);
            chunks.push(
                String.fromCharCode(
                    ...[4, 5, 6, 7].map((index) =>
                        bytes.getUint8(offset + index),
                    ),
                ),
            );
            offset += length + 12;
        }
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2D context');
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
        ).data;
        const colors = new Set<string>();
        for (let i = 0; i < pixels.length; i += 16)
            colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        bitmap.close();
        return {
            type: blob.type,
            size: blob.size,
            width: canvas.width,
            height: canvas.height,
            colors: colors.size,
            chunks,
        };
    });
    expect(result.type).toBe('image/png');
    expect(result.width).toBe(800);
    expect(result.height).toBe(500);
    expect(result.colors).toBeGreaterThan(10);
    expect(result.size).toBeGreaterThan(1000);
    expect(
        result.chunks.filter((chunk) =>
            ['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(chunk),
        ),
    ).toEqual([]);
    await expect(page.locator('[data-private-photo-renderer]')).toHaveCount(0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Spremi PNG na uređaj' }).click();
    expect((await download).suggestedFilename()).toBe('prvi-list.png');
    expect(writes).toEqual([]);
    expect(gardenReads).toEqual([]);
    const url = await image.getAttribute('src');
    await page.keyboard.press('Escape');
    await expect(image).toHaveCount(0);
    expect(
        await page.evaluate(async (capturedUrl) => {
            try {
                await fetch(capturedUrl ?? '');
                return true;
            } catch {
                return false;
            }
        }, url),
    ).toBe(false);
});

test('mobile prompt controls support keyboard, cancellation and account changes without retaining a photo', async ({
    mount,
    page,
}) => {
    test.setTimeout(30000);
    await page.setViewportSize({ width: 390, height: 844 });
    await directoryRoutes(page);
    await mount(<AutumnPhotoStory />);
    await expect(page.getByTestId('photo-camera')).toContainText('zoom', {
        timeout: 15000,
    });
    await page.getByRole('button', { name: 'Jesenski foto trenuci' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('radio', { name: /Moja jesenska gredica/u }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(
        page.getByRole('radio', { name: /Pod svjetlom fenjera/u }),
    ).toBeChecked();
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    await page.getByRole('button', { name: 'Prekini fotografiranje' }).click();
    await expect(page.locator('[data-private-photo-renderer]')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Spremi PNG na uređaj' }),
    ).toHaveCount(0);
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    // A separate browser/account event can occur while the modal owns focus.
    await page
        .getByRole('button', {
            name: 'Switch fixture account',
            includeHidden: true,
        })
        .evaluate((button) =>
            button.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
    await expect(page.locator('[data-private-photo-renderer]')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Spremi PNG na uređaj' }),
    ).toHaveCount(0);
});

test('an encoder failure offers retry, and cancel followed by a fresh capture discards obsolete work', async ({
    mount,
    page,
}) => {
    test.setTimeout(90_000);
    await directoryRoutes(page);
    await mount(<AutumnPhotoStory />);
    await expect(page.getByTestId('photo-camera')).toContainText('zoom', {
        timeout: 15000,
    });
    await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.toBlob;
        let attempt = 0;
        HTMLCanvasElement.prototype.toBlob = function (callback, type) {
            attempt += 1;
            document.documentElement.dataset.photoEncodeAttempt =
                String(attempt);
            if (attempt === 1) callback(null);
            else if (attempt === 2) {
                // Hold real encoder completion across cancel and a new capture.
                document.addEventListener(
                    'release-obsolete-photo',
                    () => {
                        callback(null);
                        document.documentElement.dataset.obsoletePhotoReleased =
                            'true';
                    },
                    { once: true },
                );
            } else original.call(this, callback, type);
        };
    });
    await page.getByRole('button', { name: 'Jesenski foto trenuci' }).click();
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    await expect(page.getByRole('alert')).toContainText(
        'Fotografiranje nije uspjelo',
        { timeout: 60_000 },
    );
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => document.documentElement.dataset.photoEncodeAttempt,
                ),
            { timeout: 60000 },
        )
        .toBe('2');
    await page.getByRole('button', { name: 'Prekini fotografiranje' }).click();
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    await expect(page.locator('[data-private-photo-renderer]')).toHaveCount(1);
    await page.evaluate(() =>
        document.dispatchEvent(new Event('release-obsolete-photo')),
    );
    await expect(
        page.getByRole('button', { name: 'Prekini fotografiranje' }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
        page.getByRole('img', {
            name: 'Pregled odabranog vrta bez osobnih oznaka',
        }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(
        await page.evaluate(
            () => document.documentElement.dataset.obsoletePhotoReleased,
        ),
    ).toBe('true');
    expect(
        await page.getByRole('img').evaluate(async (image) => {
            const bitmap = await createImageBitmap(
                await (await fetch(image.getAttribute('src') ?? '')).blob(),
            );
            const width = bitmap.width;
            bitmap.close();
            return width;
        }),
    ).toBe(800);
    await expect(page.locator('[data-private-photo-renderer]')).toHaveCount(0);
});

test('private cached scenes require the current owner, preserve privacy, and discard a photo when the scene date changes', async ({
    mount,
    page,
}) => {
    test.setTimeout(90000);
    await directoryRoutes(page);
    const privateRequests: string[] = [];
    page.on('request', (request) => {
        if (
            request.method() !== 'GET' ||
            /\/api\/.*(?:gardens|share)/u.test(new URL(request.url()).pathname)
        )
            privateRequests.push(request.url());
    });
    const wrongOwner = await mount(<AutumnPhotoStory privateOwner="other" />);
    await expect(page.getByTestId('photo-camera')).toContainText('zoom', {
        timeout: 15000,
    });
    await page.getByRole('button', { name: 'Jesenski foto trenuci' }).click();
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    await expect(page.getByRole('alert')).toContainText(
        'Odabrani pogled još nije spreman',
    );
    await expect(page.locator('[data-private-photo-renderer]')).toHaveCount(0);
    await wrongOwner.unmount();
    await mount(<AutumnPhotoStory privateOwner="current" />);
    await expect(page.getByTestId('photo-camera')).toContainText('zoom', {
        timeout: 15000,
    });
    const privacy = await page.getByTestId('photo-privacy').textContent();
    expect(privacy).toBe('{"isPublic":false}');
    await page.getByRole('button', { name: 'Jesenski foto trenuci' }).click();
    await page
        .getByRole('button', { name: 'Fotografiraj odabrani pogled' })
        .click();
    const image = page.getByRole('img', {
        name: 'Pregled odabranog vrta bez osobnih oznaka',
    });
    await expect(image).toBeVisible({ timeout: 60000 });
    const url = await image.getAttribute('src');
    await expect(page.getByTestId('photo-privacy')).toHaveText(privacy ?? '');
    expect(privateRequests).toEqual([]);
    await page
        .getByRole('button', { name: 'Change scene date', includeHidden: true })
        .evaluate((button) =>
            button.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
    await expect(image).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Spremi PNG na uređaj' }),
    ).toHaveCount(0);
    expect(
        await page.evaluate(async (capturedUrl) => {
            try {
                await fetch(capturedUrl ?? '');
                return true;
            } catch {
                return false;
            }
        }, url),
    ).toBe(false);
});
