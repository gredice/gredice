import { Buffer } from 'node:buffer';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

const warningBudget = 1_000_000;
const hardBudget = 1_800_000;

for (const device of ['Desktop Chrome', 'Pixel 7']) {
    for (const path of ['/', '/biljke', '/biljke?pregled=kalendar']) {
        test(`${device} ${path} preserves crawlable content within the HTML budget`, async ({
            browser,
            baseURL,
        }, testInfo) => {
            test.setTimeout(60_000);
            const context = await browser.newContext({
                ...devices[device],
                javaScriptEnabled: false,
            });
            const page = await context.newPage();
            try {
                const response = await page.goto(`${baseURL}${path}`);
                expect(response?.status()).toBe(200);
                const html = (await response?.text()) ?? '';
                const bytes = Buffer.byteLength(html, 'utf8');
                const patterns = {
                    title: /<title/u,
                    canonical: /<link[^>]*rel="canonical"/u,
                    h1: /<h1/u,
                    main: /<main/u,
                    serializedData: /self\.__next_f\.push/u,
                };
                const positions = Object.fromEntries(
                    Object.entries(patterns).map(([name, pattern]) => {
                        const match = pattern.exec(html);
                        return [
                            name,
                            match
                                ? Buffer.byteLength(html.slice(0, match.index))
                                : null,
                        ];
                    }),
                );
                const inlineScriptBytes = [
                    ...html.matchAll(
                        /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gu,
                    ),
                ].reduce((sum, match) => sum + Buffer.byteLength(match[1]), 0);
                const report = {
                    path,
                    device,
                    bytes,
                    inlineScriptBytes,
                    positions,
                };
                await testInfo.attach('uncompressed-html', {
                    body: JSON.stringify(report, null, 2),
                    contentType: 'application/json',
                });
                if (bytes > warningBudget)
                    console.warn('Public HTML warning budget exceeded', report);
                expect(bytes).toBeLessThanOrEqual(hardBudget);
                for (const position of Object.values(positions)) {
                    expect(position).not.toBeNull();
                    expect(position).toBeLessThan(hardBudget);
                }
                await expect(page).toHaveTitle(/Gredice/u);
                await expect(
                    page.locator('link[rel="canonical"]'),
                ).toHaveAttribute(
                    'href',
                    `https://www.gredice.com${path === '/' ? '' : '/biljke'}`,
                );
                await expect(page.locator('main h1')).toBeVisible();
                if (path.startsWith('/biljke')) {
                    await expect(
                        page.getByText(
                            'Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.',
                        ),
                    ).toBeVisible();
                    expect(
                        await page.locator('main a[href^="/biljke/"]').count(),
                    ).toBeGreaterThan(10);
                    if (path === '/biljke') {
                        const items = await page
                            .locator('script[type="application/ld+json"]')
                            .evaluateAll((scripts) =>
                                scripts.flatMap((script) => {
                                    const data = JSON.parse(
                                        script.textContent ?? '{}',
                                    );
                                    return data['@type'] === 'ItemList'
                                        ? data.itemListElement
                                        : [];
                                }),
                            );
                        expect(items.length).toBeGreaterThan(10);
                        for (const entry of items) {
                            const href = new URL(entry.item.url).pathname;
                            await expect(
                                page.locator(`main a[href="${href}"]`).first(),
                            ).toBeVisible();
                        }
                        await expect(
                            page
                                .getByText('Vrijeme za sijanje', {
                                    exact: true,
                                })
                                .first(),
                        ).toBeAttached();
                    }
                } else {
                    for (const text of [
                        'Klikneš, mi sadimo - ti uživaš',
                        'Zasadi',
                        'Održavaj',
                        'Uberi i uživaj',
                        'Sve biljke',
                    ]) {
                        await expect(
                            page.getByText(text, { exact: true }).first(),
                        ).toBeVisible();
                    }
                    await expect(
                        page.locator('main a[href^="/biljke/"]').first(),
                    ).toBeVisible();
                    await expect(
                        page.locator('main a[href^="/vrtovi/"]').first(),
                    ).toBeAttached();
                }
            } finally {
                await context.close();
            }
        });
    }
}

test('archive search, seed-time filter and calendar switching retain the same plant', async ({
    page,
}) => {
    test.setTimeout(60_000);
    await page.goto('/biljke');
    const search = page.locator('#plant-search');
    await search.fill('paradajz');
    await expect(page.getByText('Poznato i kao: Paradajz')).toBeVisible();
    await search.fill('volovsko');
    await expect(page.getByText(/Sorta: .*Volovsko/iu)).toBeVisible();
    await page.getByRole('tab', { name: 'Kalendar' }).click();
    await expect(page).toHaveURL(/pregled=kalendar/u);
    await expect(
        page.locator('main a[href="/biljke/rajcica"]').first(),
    ).toBeVisible();
    await search.fill('');
    const filter = page.getByRole('switch', {
        name: /filter vrijeme za sijanje/,
    });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('tab', { name: 'Popis' }).click();
    await expect(page).toHaveURL(/vrijemeZaSijanje=1/u);
    await expect(filter).toHaveAttribute('aria-checked', 'true');
    await search.fill('zzzz-no-plant');
    await expect(page.getByText('Nema rezultata pretrage.')).toBeVisible();
});
