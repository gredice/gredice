import { expect, test } from '@playwright/experimental-ct-react';
import { MobileAdminNavHarness } from '../playwright/MobileAdminNavHarness';

test('mobile drawer contains keyboard focus and restores it on close', async ({
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
    const opener = page.getByRole('button', { name: 'Otvori izbornik' });
    const dialog = page.getByRole('dialog', {
        name: 'Administracijski izbornik',
    });
    const review = dialog.getByRole('button', { name: 'Povratne informacije' });
    await expect(dialog).not.toBeVisible();
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Zatvori', exact: true });
    await expect(close).toBeFocused();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.height).toBe(844);
    expect(bounds && bounds.width < 390).toBeTruthy();
    // Reverse from the first control, then tab forward across the last boundary.
    await page.keyboard.press('Shift+Tab');
    await expect
        .poll(() =>
            dialog.evaluate((element) =>
                element.contains(document.activeElement),
            ),
        )
        .toBe(true);
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(review).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
        page.getByRole('textbox', { name: 'Polje iza izbornika' }),
    ).toBeFocused();
    // The close button follows the same restoration path.
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(close).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
});
