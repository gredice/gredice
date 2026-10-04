import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gredice/);
});

test('allows the mobile shell to extend into device safe areas', async ({
    page,
}) => {
    await page.goto('/');

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        'content',
        /(?:^|,\s*)viewport-fit=cover(?:\s*,|$)/,
    );
});
