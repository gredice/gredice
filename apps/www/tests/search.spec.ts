import { expect, type Locator, test } from './fixtures';

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

    test('global search page supports category filtering and no-results state', async ({
        page,
    }) => {
        await page.goto('/pretraga?pretraga=rajcica', {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.getByRole('heading', { name: 'Pretraga' })).toBeVisible();
        await page.getByRole('button', { name: 'Radnje' }).click();
        await expect(page).toHaveURL(/kategorija=operations/);

        await page.goto('/pretraga?pretraga=zzzzzz-nema-rezultata', {
            waitUntil: 'domcontentloaded',
        });
        await expect(
            page.getByText('Nema rezultata za zadani pojam.'),
        ).toBeVisible();
    });

    test('global search keeps keyboard submit flow on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/pretraga', { waitUntil: 'domcontentloaded' });
        const input = page.getByPlaceholder('Pretraži...');
        await input.click();
        await input.fill('bosiljak');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/pretraga=bosiljak/);
    });
});
