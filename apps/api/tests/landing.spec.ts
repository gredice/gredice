import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gredice API/);
});

test('links to MCP test console', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/test"]')).toContainText('/api/mcp');
});

test('serves MCP test console', async ({ page }) => {
    await page.goto('/test');
    await expect(
        page.getByRole('heading', {
            name: 'Gredice MCP docs and test console',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /public read tool/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /authenticated read tool/ }),
    ).toBeVisible();
});
