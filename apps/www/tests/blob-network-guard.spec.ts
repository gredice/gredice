import { installBlobImageFixtures } from './blob-network-fixtures';
import { expect, test } from './fixtures';

const blobImage = 'https://ci-fixture.public.blob.vercel-storage.com/photo.jpg';

test('isolated browsers preserve online and explicit offline behavior', async ({
    context,
    page,
}) => {
    test.skip(
        process.env.GREDICE_CI_NETWORK_ISOLATION !== '1',
        'Requires the Linux CI namespace.',
    );
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
});

test('Blob images load from local fixtures in every page of the context', async ({
    context,
    page,
}) => {
    for (const target of [page, await context.newPage()]) {
        await target.setContent(`<img src="${blobImage}" alt="Test photo">`);
        await expect
            .poll(() =>
                target
                    .locator('img')
                    .evaluate((image: HTMLImageElement) => image.naturalWidth),
            )
            .toBeGreaterThan(0);
    }
});

test('unexpected Blob data requests fail with a fixture instruction', async ({
    browser,
}) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const verify = await installBlobImageFixtures(context);
    try {
        const page = await context.newPage();
        await expect(
            page.goto(
                'https://ci-fixture.public.blob.vercel-storage.com/export.json',
            ),
        ).rejects.toThrow();
        await expect(verify()).rejects.toThrow('Use a local fixture');
    } finally {
        await context.close();
    }
});

test('CI DNS backstop blocks contexts that bypass the image fixtures', async ({
    browser,
}) => {
    test.skip(
        process.env.GREDICE_CI_BLOB_FIXTURES !== '1',
        'CI DNS guard is opt-in.',
    );
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await expect(page.goto(blobImage)).rejects.toThrow(
            /ERR_NAME_NOT_RESOLVED/,
        );
    } finally {
        await context.close();
    }
});
