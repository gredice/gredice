import AxeBuilder from '@axe-core/playwright';
import { PublicChromeProvider, PublicFooter } from '@gredice/ui/PublicChrome';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import '../app/globals.css';
import { PublicEnvironmentHarness } from './PublicEnvironmentHarness';

async function mockPublicEnvironmentRequests(page: Page) {
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
        await route.fulfill({ status: 200, json: { enabled: true } });
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

test('toggles the sky and applies deterministic debug conditions', async ({
    mount,
    page,
}) => {
    await mockPublicEnvironmentRequests(page);
    await mount(<PublicEnvironmentHarness />);

    const toggle = page.getByRole('switch', {
        name: 'Ambijentalna pozadina',
    });
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId('public-environment-backdrop')).toHaveCount(
        0,
    );
    await expect
        .poll(() =>
            page
                .locator('html')
                .evaluate((root) =>
                    root.style.getPropertyValue('--environmentHue'),
                ),
        )
        .toBe('');

    await toggle.click();
    await expect(toggle).toBeChecked();
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

    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect
        .poll(() =>
            page
                .locator('html')
                .evaluate((root) =>
                    root.style.getPropertyValue('--environmentHue'),
                ),
        )
        .toBe('');
});

test('fits the footer controls on mobile and supports keyboard toggling', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockPublicEnvironmentRequests(page);
    await mount(<PublicEnvironmentHarness />);

    const toggle = page.getByRole('switch', {
        name: 'Ambijentalna pozadina',
    });
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await page.getByText('Debug prikaza').click();

    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
    await expect(page.getByLabel('Vremenski uvjeti')).toBeVisible();
});

test('keeps the ambient switch compact above the footer social links', async ({
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
    const toggle = footer.getByRole('switch', {
        name: 'Ambijentalna pozadina',
    });
    const instagram = footer.getByLabel('Instagram', { exact: true });
    await expect(toggle).toBeVisible();
    await expect(instagram).toBeVisible();

    const toggleBox = await toggle.boundingBox();
    const instagramBox = await instagram.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(instagramBox).not.toBeNull();

    if (!toggleBox || !instagramBox) {
        throw new Error('Footer controls must have measurable bounds');
    }

    expect(toggleBox.height).toBeLessThanOrEqual(24);
    expect(toggleBox.y).toBeLessThan(instagramBox.y);
});

for (const width of [360, 768, 1280]) {
    test(`footer garden follows all ambient phases at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
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

        await page
            .getByRole('switch', { name: 'Ambijentalna pozadina' })
            .click();
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

        await page
            .getByRole('switch', { name: 'Ambijentalna pozadina' })
            .click();
        await expect(landscape).toHaveAttribute('data-footer-phase', 'day');
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
        const accessibility = await new AxeBuilder({ page })
            .include('.site-footer')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);
    });
}

test('uses the night garden in dark mode with ambient disabled', async ({
    mount,
    page,
}) => {
    await page.clock.setFixedTime(new Date('2026-08-24T21:00:00Z'));
    await mockPublicEnvironmentRequests(page);
    await mount(
        <PublicChromeProvider>
            <PublicFooter />
        </PublicChromeProvider>,
    );

    const landscape = page.getByTestId('public-footer-landscape');
    await expect(
        page.getByRole('switch', { name: 'Ambijentalna pozadina' }),
    ).not.toBeChecked();
    await expect(page.locator('html')).toHaveClass(/dark/u);
    await expect(landscape).toHaveAttribute('data-footer-phase', 'night');
    await landscape.scrollIntoViewIfNeeded();
    await expect(landscape.locator('img')).toHaveAttribute(
        'src',
        /footer-night/u,
    );

    // The existing day/night preference must continue to control the footer.
    await page.evaluate(() => {
        localStorage.setItem('game-day-night-cycle-disabled', 'true');
        window.dispatchEvent(new Event('game-day-night-cycle-disabled-change'));
    });
    await expect(page.locator('html')).not.toHaveClass(/dark/u);
    await expect(landscape).toHaveAttribute('data-footer-phase', 'day');
});
