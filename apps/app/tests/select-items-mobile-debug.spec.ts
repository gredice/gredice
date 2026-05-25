import { expect, test } from '@playwright/test';

test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
});

test('debug page select stays open while using search on mobile touch', async ({
    page,
}) => {
    await page.goto('/debug/select-items');

    const trigger = page.getByRole('combobox', { name: 'Status' });
    await trigger.tap();

    const search = page.getByRole('searchbox', { name: 'Pretraži opcije...' });
    await expect(search).toBeVisible();

    await search.tap();
    await search.fill('done');

    await expect(search).toBeVisible();
    await expect(page.getByRole('option', { name: 'Done' })).toBeVisible();

    await page.getByRole('option', { name: 'Done' }).tap();
    await expect(page.getByTestId('selected-value')).toHaveText(
        'Selected: done',
    );
});
