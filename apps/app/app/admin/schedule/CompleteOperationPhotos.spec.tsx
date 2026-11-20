import { once } from 'node:events';
import { createServer } from 'node:http';
import { buffer } from 'node:stream/consumers';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { CompleteOperationModal } from './CompleteOperationModal';

test('edits original photos locally and attaches the approved files on confirmation', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    const original = await sharp({
        create: { width: 96, height: 64, channels: 3, background: '#d95524' },
    })
        .png()
        .toBuffer();
    const uploads: Buffer[] = [];
    const urls: string[] = [];
    const paths: string[] = [];

    await page.route('**/api/operations/images/upload', async (route) => {
        const { payload } = route.request().postDataJSON();
        expect(JSON.parse(payload.clientPayload)).toEqual({
            operationId: 5089,
        });
        expect(payload.pathname).toMatch(/^operations\/5089\/.+\.png$/);
        paths.push(payload.pathname);
        await route.fulfill({
            json: { clientToken: 'vercel_blob_client_fixture_unused' },
        });
    });
    // Use the SDK's local HTTP transport so the receiver can inspect the bytes
    // Chromium omits from Playwright's intercepted streaming request bodies.
    await using receiver = createServer(async (request, response) => {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'PUT, GET, OPTIONS');
        response.setHeader(
            'Access-Control-Allow-Headers',
            request.headers['access-control-request-headers'] ?? '*',
        );
        if (request.method === 'OPTIONS') {
            response.writeHead(204).end();
            return;
        }
        if (request.method === 'PUT') {
            uploads.push(await buffer(request));
            const url = `http://${request.headers.host}/approved-${uploads.length}.png`;
            urls.push(url);
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ url, contentType: 'image/png' }));
            return;
        }
        const index = urls.indexOf(
            `http://${request.headers.host}${request.url}`,
        );
        if (index < 0) {
            response.writeHead(404).end();
            return;
        }
        response
            .writeHead(200, { 'content-type': 'image/png' })
            .end(uploads[index]);
    });
    receiver.listen(0, '127.0.0.1');
    await once(receiver, 'listening');
    const address = receiver.address();
    if (!address || typeof address === 'string')
        throw new Error('Expected a TCP port');
    await page.evaluate((url) => {
        Reflect.set(globalThis, '__testBlobApiUrl', url);
    }, `http://localhost:${address.port}`);
    await page.route('https://vercel.com/api/blob/**', (route) =>
        route.abort(),
    );

    const completion = await mount(
        <CompleteOperationModal
            operationId={5089}
            expectedEntityId={17}
            expectedTaskVersionEventId={20}
            label="Fotografiranje gredice"
            conditions={{ completionAttachImagesRequired: true }}
        />,
    );
    await page.getByRole('checkbox').click();
    await page
        .locator('input[type=file]')
        .first()
        .setInputFiles(
            ['Gr1.png', 'Gr2.png'].map((name) => ({
                name,
                mimeType: 'image/png',
                buffer: original,
            })),
        );

    const editFirst = page.getByRole('button', { name: 'Uredi sliku Gr1.png' });
    await editFirst.click();
    const editor = page.getByRole('dialog', { name: 'Uredi sliku Gr1.png' });
    await editor.getByLabel('Predložak').selectOption({ label: 'Crno-bijelo' });
    await editor.getByRole('button', { name: '1:1', exact: true }).click();
    await editor
        .getByRole('checkbox', { name: /Primijeni izgled na sve/ })
        .check();
    await editor
        .getByRole('button', { name: 'Primijeni', exact: true })
        .click();
    await expect(editor).not.toBeVisible();

    // Reopen from the original. Cancel must retain the last applied crop and look.
    await editFirst.click();
    await expect(editor.getByLabel('Predložak')).toHaveValue('builtin:bw');
    await editor.getByRole('button', { name: 'Cijela slika' }).click();
    await editor.getByRole('button', { name: 'Odustani' }).click();
    expect(paths).toEqual([]);
    await page.getByRole('button', { name: 'Potvrdi', exact: true }).click();
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.dataset.completedPhotoOperation,
            ),
        )
        .toBeTruthy();
    expect(
        JSON.parse(
            (await page
                .locator('html')
                .getAttribute('data-completed-photo-operation')) ?? 'null',
        ),
    ).toEqual([5089, 17, 20, urls, null]);
    expect(uploads).toHaveLength(2);
    for (const [index, url] of urls.entries()) {
        const readback = await page.request.get(url);
        expect(readback.ok()).toBe(true);
        const bytes = await readback.body();
        const { data, info } = await sharp(bytes)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        expect([info.width, info.height]).toEqual(
            index === 0 ? [64, 64] : [96, 64],
        );
        expect(data[0]).toBeGreaterThan(30);
        expect(data[0]).toBeLessThan(245);
        expect(
            Math.max(...data.subarray(0, 3)) - Math.min(...data.subarray(0, 3)),
        ).toBeLessThanOrEqual(1);
    }
    // The customer diary opens these same operation URLs in ImageGallery.
    await completion.unmount();
    await mount(
        <ImageGallery
            images={urls.map((src) => ({ src, alt: 'Fotografiranje gredice' }))}
        />,
    );
    await page
        .getByRole('button', { name: /Otvori sliku 1 u punoj veličini/ })
        .click();
    const displayed = page.getByRole('dialog').locator(`img[src="${urls[0]}"]`);
    await expect
        .poll(() =>
            displayed.evaluate((img: HTMLImageElement) => [
                img.naturalWidth,
                img.naturalHeight,
            ]),
        )
        .toEqual([64, 64]);
});

test('a photo the editor cannot decode can still be kept or removed', async ({
    mount,
    page,
}) => {
    await mount(
        <CompleteOperationModal
            operationId={2}
            expectedEntityId={1}
            expectedTaskVersionEventId={3}
            label="Pregled"
            conditions={{ completionAttachImagesRequired: true }}
        />,
    );
    await page.getByRole('checkbox').click();
    await page
        .locator('input[type=file]')
        .first()
        .setInputFiles({
            name: 'camera.heic',
            mimeType: 'image/heic',
            buffer: Buffer.from('unreadable'),
        });
    await page.getByRole('button', { name: 'Uredi sliku camera.heic' }).click();
    const editor = page.getByRole('dialog', {
        name: 'Uredi sliku camera.heic',
    });
    await expect(editor.getByRole('alert')).toBeVisible();
    await expect(
        editor.getByRole('button', { name: 'Primijeni' }),
    ).toBeDisabled();
    await editor.getByRole('button', { name: 'Odustani' }).click();
    await expect(
        page.getByRole('button', { name: 'Potvrdi', exact: true }),
    ).toBeEnabled();
    await page
        .getByRole('button', { name: 'Ukloni sliku camera.heic' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Potvrdi', exact: true }),
    ).toBeDisabled();
});

test.describe('phone camera', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });
    test('can reopen a camera photo and restore the original bytes', async ({
        mount,
        page,
    }) => {
        const original = await sharp({
            create: {
                width: 1600,
                height: 1200,
                channels: 3,
                background: '#50903c',
            },
        })
            .jpeg()
            .toBuffer();
        await mount(
            <CompleteOperationModal
                operationId={2}
                expectedEntityId={1}
                expectedTaskVersionEventId={3}
                label="Pregled"
                conditions={{ completionAttachImages: true }}
            />,
        );
        await page.getByRole('checkbox').click();
        await page.locator('input[capture=environment]').setInputFiles({
            name: 'camera.jpg',
            mimeType: 'image/jpeg',
            buffer: original,
        });
        const edit = page.getByRole('button', {
            name: 'Uredi sliku camera.jpg',
        });
        const editor = page.getByRole('dialog', {
            name: 'Uredi sliku camera.jpg',
        });
        await edit.click();
        await editor
            .getByLabel('Predložak')
            .selectOption({ label: 'Prirodno' });
        await editor.getByRole('button', { name: '1:1', exact: true }).click();
        await editor
            .getByRole('button', { name: 'Primijeni', exact: true })
            .click();
        const thumbnail = page.locator('[data-image-upload-layout] img');
        await expect
            .poll(() =>
                thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth),
            )
            .toBe(1200);
        await edit.click();
        await editor.getByRole('button', { name: 'Poništi izmjene' }).click();
        await editor
            .getByRole('button', { name: 'Primijeni', exact: true })
            .click();
        await expect
            .poll(() =>
                thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth),
            )
            .toBe(1600);
        const bytes = await thumbnail.evaluate(async (img: HTMLImageElement) =>
            Array.from(
                new Uint8Array(await (await fetch(img.src)).arrayBuffer()),
            ),
        );
        expect(Buffer.from(bytes).equals(original)).toBe(true);
    });
});
