import { expect, type Locator, test } from '@playwright/test';

async function typeSearch(locator: Locator, value: string) {
    await locator.click();
    await locator.pressSequentially(value);
    await expect(locator).toHaveValue(value);
    await expect(locator).toBeFocused();
}

test.describe('public search filters', () => {
    test('plant search keeps keyboard focus and ignores Croatian diacritics', async ({
        page,
    }) => {
        await page.goto('/biljke', { waitUntil: 'domcontentloaded' });

        const searchInput = page.getByPlaceholder('Pretraži...');
        await typeSearch(searchInput, 'rajcica');

        await expect(page).toHaveURL(/pretraga=rajcica/);
        await expect(page.getByText('Rajčica', { exact: true })).toBeVisible();
        await expect(page.getByText('Nema rezultata pretrage.')).toBeHidden();
    });

    test('operation search keeps keyboard focus and ignores Croatian diacritics', async ({
        page,
    }) => {
        await page.goto('/radnje', { waitUntil: 'domcontentloaded' });

        const searchInput = page.getByPlaceholder('Pretraži...');
        await typeSearch(searchInput, 'ciscenje');

        await expect(
            page.getByText('Čišćenje gredice', { exact: true }),
        ).toBeVisible();
        await expect(page).toHaveURL(/pretraga=ciscenje/);
        await expect(page.getByText('Nema dostupnih radnji.')).toBeHidden();
    });
});
