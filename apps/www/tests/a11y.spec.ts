import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const FALLBACK_ROUTES = ['/', '/recepti'];
const EXTERNAL_REWRITE_PREFIXES = ['/novosti'];
const REDIRECT_ONLY_ROUTES = [
    '/prijava/facebook-prijava/povratak',
    '/prijava/google-prijava/povratak',
];

function isExternalRewriteRoute(route: string): boolean {
    return EXTERNAL_REWRITE_PREFIXES.some(
        (prefix) => route === prefix || route.startsWith(`${prefix}/`),
    );
}

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
            test.skip(
                isExternalRewriteRoute(url),
                'Route is rendered by a different app behind a www rewrite.',
            );
            test.skip(
                REDIRECT_ONLY_ROUTES.includes(url),
                'Route immediately forwards the browser after an OAuth callback.',
            );

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                // Cross-origin embeds such as Google Maps expose third-party UI
                // that can change independently of Gredice and fail CI.
                .setLegacyMode()
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
