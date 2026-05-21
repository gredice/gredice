import { expect, test } from '@playwright/experimental-ct-react';
import {
    SunflowersHudStory,
    SunflowersPendingDetailsStory,
} from './SunflowersHudStory';

test.describe('Sunflowers HUD', () => {
    test('deducts sunflower cart total and shows the cart indicator', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowersHudStory />);

        const hud = page.locator('[data-sunflowers-hud-target]');
        await expect(hud).toContainText(/[\u2212-]1\.436/u);
        await expect(
            page.locator('[data-sunflowers-cart-indicator]'),
        ).toBeVisible();
    });

    test('shows pending cart amount in sunflower details', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowersPendingDetailsStory />);

        await expect(page.getByText('U košari')).toBeVisible();
        await expect(page.getByText(/[\u2212-]10\.470/u)).toBeVisible();
    });
});
