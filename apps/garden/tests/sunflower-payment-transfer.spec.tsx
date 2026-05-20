import { expect, test } from '@playwright/experimental-ct-react';
import { SunflowerPaymentTransferStory } from './SunflowerPaymentTransferStory';

test.describe('sunflower payment transfer', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    test('animates from the HUD to the payment method when enabling sunflower payment', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowerPaymentTransferStory />);

        await page.getByRole('switch').click();

        await expect(page.getByRole('switch')).toHaveAttribute(
            'aria-checked',
            'true',
        );
        await expect(
            page.locator('[data-sunflower-transfer-layer]'),
        ).toHaveCount(1);
        await expect(
            page.locator('[data-sunflower-transfer-particle]').first(),
        ).toBeVisible();
        await expect(
            page.locator('[data-sunflower-transfer-layer]'),
        ).toHaveCount(0, { timeout: 2000 });
    });

    test('collapses rapid reversed transfers into one active layer', async ({
        mount,
        page,
    }) => {
        await mount(
            <SunflowerPaymentTransferStory initialIsSunflower={true} />,
        );
        const paymentSwitch = page.getByRole('switch');

        await paymentSwitch.click();
        await expect(paymentSwitch).toHaveAttribute('aria-checked', 'false');
        await paymentSwitch.click();

        await expect(paymentSwitch).toHaveAttribute('aria-checked', 'true');
        await expect(
            page.locator('[data-sunflower-transfer-layer]'),
        ).toHaveCount(1);
        await expect(
            page.locator('[data-sunflower-transfer-layer]'),
        ).toHaveCount(0, { timeout: 2000 });
    });

    test('skips flying particles for reduced-motion users', async ({
        mount,
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(<SunflowerPaymentTransferStory />);

        await page.getByRole('switch').click();

        await expect(page.getByRole('switch')).toHaveAttribute(
            'aria-checked',
            'true',
        );
        await expect(
            page.locator('[data-sunflower-transfer-layer]'),
        ).toHaveCount(0);
    });
});
