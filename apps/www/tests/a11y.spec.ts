import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const FALLBACK_ROUTES = ['/', '/recepti'];
const CI_DEFAULT_MAX_ROUTES = 8;
const LOCAL_DEFAULT_MAX_ROUTES = 20;

function getMaxRoutes(): number {
    const rawLimit =
        process.env.A11Y_MAX_PAGES ??
        (process.env.CI
            ? String(CI_DEFAULT_MAX_ROUTES)
            : String(LOCAL_DEFAULT_MAX_ROUTES));

    const parsedLimit = Number.parseInt(rawLimit, 10);

    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return process.env.CI
            ? CI_DEFAULT_MAX_ROUTES
            : LOCAL_DEFAULT_MAX_ROUTES;
    }

    return parsedLimit;
}

function getRoutesToCheck(): string[] {
    try {
        const sitemapRoutes = JSON.parse(
            readFileSync('./tests/sitemap-pages.json', 'utf8'),
        ) as string[];
        const routes =
            sitemapRoutes.length > 0 ? sitemapRoutes : FALLBACK_ROUTES;
        return routes.slice(0, getMaxRoutes());
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
