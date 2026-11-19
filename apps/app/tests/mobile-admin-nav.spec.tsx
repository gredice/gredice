import { expect, test } from '@playwright/experimental-ct-react';
import { MobileAdminNavHarness } from '../playwright/MobileAdminNavHarness';

test('closed mobile drawer keeps review control out of keyboard focus', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/users/current-claims', (route) =>
        route.fulfill({
            json: {
                id: 'admin',
                displayName: 'Ana',
                userName: 'ana@example.test',
            },
        }),
    );
    await mount(<MobileAdminNavHarness />);
    const drawer = page.locator(
        'aside[aria-label="Administracijski izbornik"]',
    );
    const review = drawer.locator('button[aria-label="Povratne informacije"]');
    await expect(drawer).toHaveAttribute('inert', '');
    await expect(review).toBeEnabled();
    await review.evaluate((element) => element.focus());
    await expect(review).not.toBeFocused();
    await page.getByRole('button', { name: 'Otvori izbornik' }).click();
    await expect(drawer).not.toHaveAttribute('inert');
    await review.focus();
    await expect(review).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('inert', '');
    await review.evaluate((element) => element.focus());
    await expect(review).not.toBeFocused();
});
