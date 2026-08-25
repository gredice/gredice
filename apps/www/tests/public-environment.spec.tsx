import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import '../app/globals.css';
import { PublicEnvironmentHarness } from './PublicEnvironmentHarness';

async function mockPublicEnvironmentRequests(page: Page) {
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
