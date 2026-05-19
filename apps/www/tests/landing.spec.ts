import { expect, test } from './fixtures';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gredice/);
});
