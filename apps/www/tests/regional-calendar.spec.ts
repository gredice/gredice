import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('regional sowing calendar', () => {
    test.use({ javaScriptEnabled: false });
    test.setTimeout(60_000);

    for (const width of [360, 1280]) {
        test(`readable table and GET filters work without JavaScript at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('/kalendar-sjetve', {
                waitUntil: 'domcontentloaded',
            });
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
                'Kalendar sjetve i sadnje za kontinentalnu Hrvatsku',
            );
            const table = page.getByRole('table', {
                name: 'Moguće vrijeme uzgoja — kontinentalna Hrvatska',
            });
            await expect(table.getByRole('columnheader')).toHaveCount(13);
            await expect(
                table.getByRole('columnheader', {
                    name: 'Siječanj',
                    exact: true,
                }),
            ).toBeVisible();
            await expect(table.getByRole('rowheader')).toHaveCount(20);
            for (const crop of [
                'salata',
                'spinat',
                'matovilac',
                'cesnjak',
                'rajcica',
            ]) {
                await expect(
                    table.locator(`a[href="/biljke/${crop}"]`),
                ).toHaveCount(4);
            }
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        window.innerWidth,
                ),
            ).toBe(true);
            const region = page.getByRole('region', {
                name: 'Kalendar po mjesecima',
            });
            await region.focus();
            await expect(region).toBeFocused();
            if (width === 360) {
                await page.keyboard.press('ArrowRight');
                await expect
                    .poll(() => region.evaluate((node) => node.scrollLeft))
                    .toBeGreaterThan(0);
            }
            await page
                .getByLabel('Radnja', { exact: true })
                .selectOption('harvest');
            await page
                .getByRole('button', { name: 'Prikaži', exact: true })
                .click();
            await expect(table.getByRole('rowheader')).toHaveCount(5);
            await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
                'href',
                'https://www.gredice.com/kalendar-sjetve',
            );
            await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
                'content',
                /noindex/,
            );
            await page
                .getByRole('link', { name: 'Prikaži sve', exact: true })
                .click();
            await expect(table.getByRole('rowheader')).toHaveCount(20);
        });
    }
});

test('regional calendar has accessible headings, filters, table and breadcrumbs', async ({
    page,
}) => {
    test.setTimeout(60_000);
    await page.goto('/kalendar-sjetve', { waitUntil: 'domcontentloaded' });
    const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
    expect(result.violations).toEqual([]);
    const breadcrumbs = page.locator('script[type="application/ld+json"]');
    expect(await breadcrumbs.allTextContents()).toEqual(
        expect.arrayContaining([expect.stringContaining('BreadcrumbList')]),
    );
});
