import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import {
    BaseUiOverlayIntegrationStory,
    ResponsiveModalIntegrationStory,
} from './BaseUiOverlayIntegrationStory';

test('keeps tooltip keyboard and pointer behavior accessible', async ({
    mount,
    page,
}) => {
    await mount(<BaseUiOverlayIntegrationStory />);

    const trigger = page.getByRole('button', { name: 'Fokusiraj savjet' });
    const tooltip = page.getByRole('tooltip', { name: 'Tipkovnički savjet' });

    await trigger.focus();
    await expect(tooltip).toBeVisible();
    const tooltipId = await tooltip.getAttribute('id');
    expect(tooltipId).not.toBeNull();
    await expect(trigger).toHaveAttribute('aria-describedby', tooltipId ?? '');
    await page.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await page.locator('output[aria-label="Zadnja radnja"]').hover();
    await expect(tooltip).not.toBeVisible();
});

test('closes a popper before returning focus to its trigger', async ({
    mount,
    page,
}) => {
    await mount(<BaseUiOverlayIntegrationStory />);

    const trigger = page.getByRole('button', { name: 'Otvori detalje' });
    await trigger.click();
    const popper = page.getByRole('dialog', { name: 'Detalji prikaza' });
    await expect(popper).toBeVisible();
    await page.getByLabel('Napomena').focus();
    await page.keyboard.press('Escape');

    await expect(popper).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('output[aria-label="Zadnja radnja"]')).toHaveText(
        'escape',
    );
});

test('supports disabled items, submenus, links, and keyboard return in menus', async ({
    mount,
    page,
}) => {
    await mount(<BaseUiOverlayIntegrationStory />);

    const trigger = page.getByRole('button', { name: 'Otvori izbornik' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const menu = page.getByRole('menu').first();
    const edit = menu.getByRole('menuitem', { name: 'Uredi' });
    const disabled = menu.getByRole('menuitem', { name: 'Nedostupno' });
    const submenuTrigger = menu.getByRole('menuitem', {
        name: 'Više opcija',
    });
    await expect(edit).toBeFocused();
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');

    await page.keyboard.press('v');
    await expect(submenuTrigger).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const duplicate = page.getByRole('menuitem', { name: 'Dupliciraj' });
    await expect(duplicate).toBeVisible();
    await expect(duplicate).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(duplicate).not.toBeVisible();
    await expect(submenuTrigger).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    const link = page.getByRole('menuitem', { name: 'Otvori odjeljak' });
    await expect(link).toHaveAttribute('href', '#overlay-target');
    await link.click();
    await expect(page.locator('output[aria-label="Zadnja radnja"]')).toHaveText(
        'link',
    );
    await expect(trigger).toBeFocused();
});

for (const [width, expectedSurface] of [
    [375, 'mobile'],
    [768, 'desktop'],
    [1280, 'desktop'],
    [1440, 'desktop'],
] as const) {
    test(`selects the ${expectedSurface} modal contract at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 900 });
        await mount(<ResponsiveModalIntegrationStory />);

        const trigger = page.getByRole('button', {
            name: 'Otvori responzivni modal',
        });
        await trigger.click();

        const dialog = page.getByRole('dialog', {
            name: 'Provjera responzivnog modala',
        });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAccessibleDescription(
            'Opis koji povezuje pristupačni naziv i sadržaj.',
        );
        await expect(
            page.locator(`[data-modal-backdrop="${expectedSurface}"]`),
        ).toBeVisible();
        await expect(dialog).toHaveCSS('transition-property', 'none');

        const bounds = await dialog.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
            width,
        );

        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
    });
}

test('has no serious accessibility violations across the combined overlay fixture', async ({
    mount,
    page,
}) => {
    await mount(<BaseUiOverlayIntegrationStory />);
    await page.getByRole('button', { name: 'Otvori izbornik' }).click();

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .setLegacyMode()
        .analyze();
    const seriousViolations = results.violations.filter(
        (violation) =>
            violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(
        seriousViolations,
        JSON.stringify(seriousViolations, null, 2),
    ).toEqual([]);
});
