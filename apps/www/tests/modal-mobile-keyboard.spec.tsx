import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    MobileModalForm,
    ModalConfirmInteractionStory,
    ModalInteractionStory,
} from './ModalMobileKeyboardStory';

test('keeps the focused field available while the mobile keyboard changes', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<MobileModalForm />);

    const dialog = page.getByRole('dialog', { name: 'Uredi podatke' });
    const drawerViewport = page.locator('[data-modal-drawer-viewport]');
    await expect
        .poll(() =>
            dialog.evaluate((element) =>
                element.contains(document.activeElement),
            ),
        )
        .toBe(true);
    await page.getByLabel('Naziv').focus();

    await page.evaluate(() => {
        const visualViewport = window.visualViewport;
        if (!visualViewport) {
            throw new Error('Visual Viewport API is unavailable.');
        }

        Object.defineProperty(visualViewport, 'height', {
            configurable: true,
            value: window.innerHeight - 320,
        });
        visualViewport.dispatchEvent(new Event('resize'));
    });

    await expect
        .poll(() =>
            drawerViewport.evaluate((element) =>
                element.style.getPropertyValue('--drawer-keyboard-inset'),
            ),
        )
        .toBe('320px');
    await expect(page.getByLabel('Naziv')).toBeFocused();
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
        const visualViewport = window.visualViewport;
        if (!visualViewport) {
            throw new Error('Visual Viewport API is unavailable.');
        }

        Object.defineProperty(visualViewport, 'height', {
            configurable: true,
            value: window.innerHeight,
        });
        visualViewport.dispatchEvent(new Event('resize'));
    });

    await expect
        .poll(() =>
            drawerViewport.evaluate((element) =>
                element.style.getPropertyValue('--drawer-keyboard-inset'),
            ),
        )
        .toBe('0px');
});

test('supports nested overlays, long content, safe areas, and focus return', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<ModalInteractionStory mobileOverride />);

    const trigger = page.getByRole('button', { name: 'Otvori postavke' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Postavke prikaza' });
    const scrollContent = dialog.locator('[data-modal-scroll-content]');
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: 'Otvori pomoć' }).click();
    await expect(page.getByText('Dodatne postavke prikaza')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Dodatne postavke prikaza')).not.toBeVisible();
    await expect(dialog).toBeVisible();

    const tooltipTrigger = dialog.getByRole('button', {
        name: 'Prikaži savjet',
    });
    await tooltipTrigger.focus();
    await expect(
        dialog.getByRole('tooltip', {
            name: 'Savjet unutar aktivnog modala',
        }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Otvori akcije' }).click();
    const menu = dialog.getByRole('menu');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Otvori akcije' }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Prikaz detalja' }).click();
    await expect(
        page.locator('output[aria-label="Odabrana akcija"]'),
    ).toHaveText('details');
    await expect(dialog).toBeVisible();

    await page.getByRole('combobox', { name: 'Gustoća prikaza' }).click();
    await page.getByRole('option', { name: 'Udobno' }).click();
    await expect(
        page.locator('output[aria-label="Odabrana gustoća"]'),
    ).toHaveText('comfortable');
    await expect(dialog).toBeVisible();

    const safeAreaPadding = await scrollContent.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingBottom),
    );
    expect(safeAreaPadding).toBeGreaterThanOrEqual(16);

    await page
        .getByRole('button', { name: 'Završna radnja' })
        .scrollIntoViewIfNeeded();
    await expect(
        page.getByRole('button', { name: 'Završna radnja' }),
    ).toBeVisible();
    expect(
        await scrollContent.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('dismisses a mobile drawer with a downward swipe', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<ModalInteractionStory mobileOverride />);

    const trigger = page.getByRole('button', { name: 'Otvori postavke' });
    await trigger.click();
    await swipeDrawerDown(page);

    await expect(
        page.getByRole('dialog', { name: 'Postavke prikaza' }),
    ).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('blocks Escape, outside press, and swipe when a mobile drawer is not dismissible', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<ModalInteractionStory dismissible={false} mobileOverride />);

    await page.getByRole('button', { name: 'Otvori postavke' }).click();
    const dialog = page.getByRole('dialog', { name: 'Postavke prikaza' });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();

    await swipeDrawerDown(page);
    await expect(dialog).toBeVisible();
});

test('blocks Escape and outside press when a desktop dialog is not dismissible', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await mount(<ModalInteractionStory dismissible={false} />);

    await page.getByRole('button', { name: 'Otvori postavke' }).click();
    const dialog = page.getByRole('dialog', { name: 'Postavke prikaza' });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();
});

test('preserves confirmation cancellation, prompt validation, and form submission', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await mount(<ModalConfirmInteractionStory />);

    const trigger = page.getByRole('button', { name: 'Obriši zapis' });
    await trigger.click();
    await page.getByRole('button', { name: 'Odustani' }).click();
    await expect(trigger).toBeFocused();
    await expect(
        page.getByRole('status', { name: 'Rezultat potvrde' }),
    ).toHaveText('nije potvrđeno');

    await trigger.click();
    const prompt = page.getByLabel('Upiši "IZBRIŠI" za potvrdu');
    const confirm = page.getByRole('button', { name: 'Potvrdi' });
    await expect(prompt).toBeFocused();
    await expect(confirm).toBeDisabled();
    await prompt.fill('IZBRIŠI');
    await expect(confirm).toBeEnabled();
    await prompt.press('Enter');

    await expect(
        page.getByRole('alertdialog', { name: 'Obrisati zapis?' }),
    ).not.toBeVisible();
    await expect(
        page.getByRole('status', { name: 'Rezultat potvrde' }),
    ).toHaveText('potvrđeno');
    await expect(trigger).toBeFocused();
});

async function swipeDrawerDown(page: Page) {
    const handle = page.locator('[data-modal-drawer-handle]');
    const bounds = await handle.boundingBox();
    if (!bounds) {
        throw new Error('Expected the mobile drawer handle to be visible.');
    }

    const startX = bounds.x + bounds.width / 2;
    const startY = bounds.y + bounds.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 420, { steps: 12 });
    await page.mouse.up();
}
