import AxeBuilder from '@axe-core/playwright';
import { PublicChromeProvider, PublicFooter } from '@gredice/ui/PublicChrome';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import '../app/globals.css';
import { PublicEnvironmentHarness } from './PublicEnvironmentHarness';

test.afterEach(async ({ page }) => {
    // Let in-flight image responses finish before Playwright closes the page.
    await page.unrouteAll({ behavior: 'wait' });
});

async function mockPublicEnvironmentRequests(page: Page, debug = true) {
    // Keep Next's image component in both the full suite and focused CT run.
    // Vite serves the real assets but has no Next image optimizer endpoint.
    await page.route('**/_next/image?**', async (route) => {
        const requestUrl = new URL(route.request().url());
        const source = requestUrl.searchParams.get('url');
        if (!source?.startsWith('/assets/footer-')) {
            await route.continue();
            return;
        }
        const response = await route.fetch({
            url: new URL(source, requestUrl.origin).toString(),
        });
        await route.fulfill({ response });
    });
    await page.route('**/api/auth/current-claims', async (route) => {
        await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    });
    await page.route('**/api/public-environment/debug', async (route) => {
        await route.fulfill({ status: 200, json: { enabled: debug } });
    });
    await page.route('**/api/data/weather/now', async (route) => {
        await route.fulfill({
            status: 200,
            json: {
                cloudy: 0.1,
                foggy: 0,
                rainy: 0,
                snowy: 0,
                thundery: 0,
            },
        });
    });
}

test('keeps the sky on and applies deterministic debug conditions', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    await page.evaluate(() => {
        localStorage.setItem('gredice-public-environment-enabled', 'false');
    });
    await mount(<PublicEnvironmentHarness />);

    await expect(
        page.getByRole('switch', { name: 'Ambijentalna pozadina' }),
    ).toHaveCount(0);
    await expect(page.getByTestId('public-environment-backdrop')).toBeVisible();
    const stars = page.locator('.public-environment-stars');
    await expect(stars).toHaveAttribute('height', '100%');
    await expect(stars).toHaveAttribute('width', '100%');
    const starPattern = page.locator('.public-environment-stars pattern');
    await expect(starPattern).toHaveAttribute('width', '1280');
    await expect(starPattern).toHaveAttribute('height', '896');
    await expect(page.locator('html')).toHaveAttribute(
        'data-public-environment',
        'on',
    );

    await page.getByText('Debug prikaza').click();
    await page.getByLabel('Fiksiraj vrijeme').check();
    await page.getByLabel('Vrijeme dana').fill('1380');
    await expect(page.locator('output')).toHaveText('23:00');
    await expect(page.locator('html')).toHaveClass(/dark/u);
    await expect
        .poll(() =>
            page
                .locator('html')
                .evaluate((root) => root.style.getPropertyValue('--baseHue')),
        )
        .toBe('218');

    await page.getByLabel('Vremenski uvjeti').selectOption('storm');
    await expect
        .poll(() =>
            page
                .locator('.public-environment-storm')
                .evaluate((element) => getComputedStyle(element).opacity),
        )
        .toBe('0.34');

    await expect
        .poll(() =>
            page
                .locator('html')
                .evaluate((root) =>
                    root.style.getPropertyValue('--environmentHue'),
                ),
        )
        .toBe('208');
});

test('restores document ambience styles when the provider unmounts', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    await page.evaluate(() => {
        const root = document.documentElement;
        root.style.setProperty('--baseHue', '50');
        root.style.setProperty('--environmentHue', '60');
        root.dataset.publicEnvironment = 'before';
    });

    const component = await mount(<PublicEnvironmentHarness />);
    await expect(page.locator('html')).toHaveAttribute(
        'data-public-environment',
        'on',
    );
    await component.unmount();

    await expect(page.locator('html')).toHaveAttribute(
        'data-public-environment',
        'before',
    );
    expect(
        await page.locator('html').evaluate((root) => ({
            baseHue: root.style.getPropertyValue('--baseHue'),
            environmentHue: root.style.getPropertyValue('--environmentHue'),
        })),
    ).toEqual({ baseHue: '50', environmentHue: '60' });
});

test('fits the debug controls on mobile', async ({ mount, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockPublicEnvironmentRequests(page);
    await mount(<PublicEnvironmentHarness />);

    await page.getByText('Debug prikaza').click();

    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
    await expect(page.getByLabel('Vremenski uvjeti')).toBeVisible();
});

test('keeps debug controls above the footer social links', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    await mount(
        <PublicChromeProvider>
            <PublicFooter />
        </PublicChromeProvider>,
    );

    const footer = page.locator('footer');
    const debugControls = footer.getByText('Debug prikaza');
    const instagram = footer.getByLabel('Instagram', { exact: true });
    await expect(debugControls).toBeVisible();
    await expect(footer.getByRole('switch')).toHaveCount(0);
    await expect(instagram).toBeVisible();

    const controlsBox = await debugControls.boundingBox();
    const instagramBox = await instagram.boundingBox();
    expect(controlsBox).not.toBeNull();
    expect(instagramBox).not.toBeNull();

    if (!controlsBox || !instagramBox) {
        throw new Error('Footer controls must have measurable bounds');
    }

    expect(controlsBox.y).toBeLessThan(instagramBox.y);
});

test('shows no ambience controls in the public footer', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page, false);
    await mount(
        <PublicChromeProvider>
            <PublicFooter />
        </PublicChromeProvider>,
    );

    await expect(page.getByTestId('public-environment-backdrop')).toBeVisible();
    await expect(page.locator('footer').getByText('Ambijent vrta')).toHaveCount(
        0,
    );
    await expect(page.locator('footer').getByText('Debug prikaza')).toHaveCount(
        0,
    );
    await expect(page.locator('footer').getByLabel('Instagram')).toBeVisible();
});

for (const width of [360, 768, 1280]) {
    test(`footer garden follows all ambient phases at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width, height: 900 });
        await page.clock.setFixedTime(new Date('2026-08-24T11:00:00Z'));
        await mockPublicEnvironmentRequests(page);
        await mount(
            <PublicChromeProvider>
                <PublicFooter />
            </PublicChromeProvider>,
        );

        const landscape = page.getByTestId('public-footer-landscape');
        const image = landscape.locator('img');
        await expect(landscape).toHaveAttribute('data-footer-phase', 'day');
        await expect(image).toHaveAttribute('alt', '');
        await expect(image).toHaveAttribute('loading', 'lazy');
        await expect(landscape).toHaveAttribute('aria-hidden', 'true');
        const initialHeight = (await landscape.boundingBox())?.height;

        await page.getByText('Debug prikaza').click();
        await page.getByLabel('Fiksiraj vrijeme').check();

        for (const { minutes, phase } of [
            { minutes: 360, phase: 'sunrise' },
            { minutes: 780, phase: 'day' },
            { minutes: 1200, phase: 'sunset' },
            { minutes: 1380, phase: 'night' },
        ]) {
            await page.getByLabel('Vrijeme dana').fill(String(minutes));
            await expect(landscape).toHaveAttribute('data-footer-phase', phase);
            await expect(image).toHaveAttribute(
                'src',
                new RegExp(`footer-${phase}`),
            );
            await landscape.scrollIntoViewIfNeeded();
            await expect
                .poll(() =>
                    image.evaluate(
                        (element: HTMLImageElement) =>
                            element.complete && element.naturalWidth > 0,
                    ),
                )
                .toBe(true);
            expect((await landscape.boundingBox())?.height).toBe(initialHeight);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(width);
            await landscape.screenshot({
                path: testInfo.outputPath(`${phase}.png`),
            });
        }

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document
                            .getAnimations()
                            .filter(
                                (animation) =>
                                    animation instanceof CSSTransition &&
                                    animation.playState === 'running',
                            ).length,
                ),
            )
            .toBe(0);
        await page.getByLabel('Vrijeme dana').fill('780');
        await expect(landscape).toHaveAttribute('data-footer-phase', 'day');
        // Axe cannot resolve the fixed sky and translucent reading veil as a
        // background at night. The sky's reading surface has a pixel test.
        const accessibility = await new AxeBuilder({ page })
            .include('.site-footer')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);
    });
}

test('uses the night garden despite the old off preference', async ({
    mount,
    page,
}) => {
    await page.clock.setFixedTime(new Date('2026-08-24T21:00:00Z'));
    await mockPublicEnvironmentRequests(page);
    await page.evaluate(() => {
        localStorage.setItem('gredice-public-environment-enabled', 'false');
        localStorage.setItem('game-day-night-cycle-disabled', 'true');
    });
    await mount(
        <PublicChromeProvider>
            <PublicFooter />
        </PublicChromeProvider>,
    );

    const landscape = page.getByTestId('public-footer-landscape');
    await expect(
        page.getByRole('switch', { name: 'Ambijentalna pozadina' }),
    ).toHaveCount(0);
    await expect(page.getByTestId('public-environment-backdrop')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/u);
    await expect(landscape).toHaveAttribute('data-footer-phase', 'night');
    await landscape.scrollIntoViewIfNeeded();
    await expect(landscape.locator('img')).toHaveAttribute(
        'src',
        /footer-night/u,
    );

    await page.evaluate(() => {
        window.dispatchEvent(new Event('game-day-night-cycle-disabled-change'));
    });
    await expect(page.locator('html')).toHaveClass(/dark/u);
    await expect(landscape).toHaveAttribute('data-footer-phase', 'night');
    await expect
        .poll(() =>
            landscape
                .locator('img')
                .evaluate(
                    (element: HTMLImageElement) =>
                        element.complete && element.naturalWidth > 0,
                ),
        )
        .toBe(true);
});
