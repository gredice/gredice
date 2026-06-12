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

    test('shows tutorial reward history as a known activity', async ({
        mount,
        page,
    }) => {
        await mount(
            <SunflowersPendingDetailsStory
                cartSunflowers={0}
                history={[
                    {
                        amount: 25,
                        createdAt: '2026-06-12T08:00:00.000Z',
                        id: 1,
                        reason: 'tutorial:open-cart',
                    },
                ]}
            />,
        );

        await expect(page.getByText('Zadaci za novi vrt')).toBeVisible();
        await expect(page.getByText('+25')).toBeVisible();
        await expect(page.getByText('Nepoznato')).toHaveCount(0);
    });
});
