import { expect, test } from '@playwright/experimental-ct-react';
import { MobileModalForm } from './ModalMobileKeyboardStory';
import '../app/globals.css';

test('keeps the mobile modal anchored after the keyboard is dismissed', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<MobileModalForm />);

    const dialog = page.getByRole('dialog', { name: 'Uredi podatke' });
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

        Object.defineProperty(visualViewport, 'height', {
            configurable: true,
            value: window.innerHeight - 80,
        });
        visualViewport.dispatchEvent(new Event('resize'));
    });

    await expect(dialog).not.toHaveAttribute('style', /(?:bottom|height):/);
});
