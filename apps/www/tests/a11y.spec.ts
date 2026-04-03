import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

function getRoutesToCheck(): string[] {
    try {
        const sitemapRoutes = JSON.parse(
            readFileSync('./tests/sitemap-pages.json', 'utf8'),
        ) as string[];
        return sitemapRoutes.length > 0 ? sitemapRoutes : ['/', '/recepti'];
    } catch {
        return ['/', '/recepti'];
    }
}

test.describe('accessibility axe smoke tests', () => {
    for (const url of getRoutesToCheck()) {
        test(`page ${url} has no critical axe violations`, async ({ page }) => {
            test.slow();

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            const results = await new AxeBuilder({ page }).analyze();

            expect(
                results.violations,
                JSON.stringify(results.violations, null, 2),
            ).toEqual([]);
        });
    }
});
