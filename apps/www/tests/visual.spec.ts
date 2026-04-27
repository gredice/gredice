import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { vizzlyScreenshot } from '@vizzly-testing/cli/client';

const FALLBACK_ROUTES = ['/'];

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

function nameForUrl(url: string): string {
    if (url === '/') return 'home';
    return url.replace(/^\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

test.describe('visual snapshots', () => {
    test.describe.configure({ timeout: 60_000 });

    for (const url of getRoutesToCheck()) {
        test(`page ${url}`, async ({ page }, testInfo) => {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('load');

            await page.addStyleTag({
                content: `
                    *, *::before, *::after {
                        animation-duration: 0s !important;
                        animation-delay: 0s !important;
                        transition-duration: 0s !important;
                        transition-delay: 0s !important;
                        caret-color: transparent !important;
                    }
                    html { scroll-behavior: auto !important; }
                `,
            });

            await page.evaluate(() => document.fonts?.ready);

            await page.evaluate(async () => {
                const step = Math.max(window.innerHeight * 0.8, 400);
                let prev = -1;
                while (
                    document.documentElement.scrollHeight !== prev &&
                    window.scrollY + window.innerHeight <
                        document.documentElement.scrollHeight
                ) {
                    prev = document.documentElement.scrollHeight;
                    window.scrollBy(0, step);
                    await new Promise((r) => requestAnimationFrame(() => r(null)));
                    await new Promise((r) => setTimeout(r, 100));
                }
                window.scrollTo(0, 0);
                await new Promise((r) => setTimeout(r, 100));
            });

            await page.waitForLoadState('networkidle').catch(() => {});

            const screenshot = await page.screenshot({
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
            });

            const viewport = testInfo.project.use.viewport;
            const viewportLabel = viewport
                ? `${viewport.width}x${viewport.height}`
                : 'unknown';

            await vizzlyScreenshot(nameForUrl(url), screenshot, {
                browser: 'chromium',
                viewport: viewportLabel,
                properties: { url },
            });
        });
    }
});
