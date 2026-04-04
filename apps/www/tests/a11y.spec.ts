import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const FALLBACK_ROUTES = ['/', '/recepti'];

function getRoutesToCheck(): string[] {
    try {
        const sitemapRoutes = JSON.parse(
            readFileSync('./tests/sitemap-pages.json', 'utf8'),
        ) as string[];
        return sitemapRoutes.length > 0 ? sitemapRoutes : FALLBACK_ROUTES;
    } catch {
        return FALLBACK_ROUTES;
    }
}

test.describe('accessibility axe smoke tests', () => {
    test.describe.configure({ timeout: 60_000 });

    for (const url of getRoutesToCheck()) {
        test(`page ${url} has no serious axe violations`, async ({ page }) => {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();

            const seriousViolations = results.violations.filter(
                (violation) =>
                    violation.impact === 'serious' ||
                    violation.impact === 'critical',
            );

            expect(
                seriousViolations,
                JSON.stringify(seriousViolations, null, 2),
            ).toEqual([]);
        });
    }
});
