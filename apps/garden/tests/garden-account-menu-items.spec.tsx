import { expect, test } from '@playwright/experimental-ct-react';
import { GardenAccountMenuItemsStory } from './GardenAccountMenuItemsStory';

test.describe('Garden account menu items', () => {
    test('selects a garden before refreshing account-scoped queries', async ({
        mount,
        page,
    }) => {
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );
        await mount(<GardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await page.getByRole('menuitem', { name: /Drugi vrt/ }).click();

        await expect(page.getByTestId('selected-garden-id')).toHaveText('3', {
            timeout: 1_000,
        });
    });

    test('shows sandbox gardens inline on mobile', async ({ mount, page }) => {
        await page.setViewportSize({ width: 600, height: 800 });
        await mount(<GardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();

        await expect(page.getByText('Vrtovi za igru')).toBeVisible();
        await expect(page.getByText('Vrt za igru 1')).toBeVisible();
        await expect(
            page.getByRole('menuitem', { name: /Računi/ }),
        ).toHaveAttribute('href', '/racun/naplata');
        await expect(page.getByText('Kreiraj vrt za igru')).toBeVisible();

        const sandboxGardenBox = await page
            .getByText('Vrt za igru 1')
            .boundingBox();
        expect(sandboxGardenBox).not.toBeNull();
        expect(
            (sandboxGardenBox?.x ?? 0) + (sandboxGardenBox?.width ?? 0),
        ).toBeLessThanOrEqual(600);
    });
});
