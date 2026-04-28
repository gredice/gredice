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

const SNAPSHOT_SCENARIOS = [
    {
        name: 'midday',
        fixedTimeIso: '2026-01-15T12:00:00+01:00',
        colorScheme: 'light' as const,
    },
    {
        name: 'midnight',
        fixedTimeIso: '2026-01-15T00:00:00+01:00',
        colorScheme: 'dark' as const,
    },
];

test.describe('visual snapshots', () => {
    test.describe.configure({ timeout: 60_000 });

    for (const url of getRoutesToCheck()) {
        for (const scenario of SNAPSHOT_SCENARIOS) {
            test(`page ${url} (${scenario.name})`, async ({ page }) => {
                const fixedTime = new Date(scenario.fixedTimeIso).getTime();
                await page.emulateMedia({ colorScheme: scenario.colorScheme });
                await page.addInitScript((timeMs) => {
                    const NativeDate = Date;
                    class MockDate extends NativeDate {
                        constructor(
                            ...args: ConstructorParameters<typeof Date>
                        ) {
                            if (args.length === 0) {
                                super(timeMs);
                                return;
                            }
                            super(...args);
                        }

                        static now() {
                            return timeMs;
                        }
                    }
                    Object.defineProperty(MockDate, 'name', { value: 'Date' });
                    // @ts-expect-error - Intentionally replacing Date for deterministic visual snapshots
                    window.Date = MockDate;
                }, fixedTime);

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

                // TODO: Evaluate and execute this only on needed pages that have lazy loaded images
                // await page.evaluate(async () => {
                //     const step = Math.max(window.innerHeight * 0.8, 400);
                //     let prev = -1;
                //     while (
                //         document.documentElement.scrollHeight !== prev &&
                //         window.scrollY + window.innerHeight <
                //             document.documentElement.scrollHeight
                //     ) {
                //         prev = document.documentElement.scrollHeight;
                //         window.scrollBy(0, step);
                //         await new Promise((r) => requestAnimationFrame(() => r(null)));
                //         await new Promise((r) => setTimeout(r, 100));
                //     }
                //     window.scrollTo(0, 0);
                //     await new Promise((r) => setTimeout(r, 100));
                // });

                await page.waitForLoadState('networkidle').catch(() => {});

                const screenshot = await page.screenshot({
                    fullPage: true,
                    animations: 'disabled',
                    caret: 'hide',
                });

                await vizzlyScreenshot(
                    `${nameForUrl(url)}-${scenario.name}`,
                    screenshot,
                    {
                        properties: { url, timeOfDay: scenario.name },
                        fullPage: true,
                    },
                );
            });
        }
    }
});
