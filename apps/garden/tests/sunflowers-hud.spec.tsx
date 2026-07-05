import { expect, test } from '@playwright/experimental-ct-react';
import {
    SunflowerPackagesPanelStory,
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

    test('shows sunflower packages and master upsell in the purchase panel', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowerPackagesPanelStory />);

        await expect(page.getByText('Početna ponuda')).toBeVisible();
        await expect(
            page.getByText('Puna gredica', { exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Glavni paketi')).toBeVisible();
        await expect(
            page.getByText('Mali zalogaj', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Vrtna košarica', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Mirna sezona', { exact: true }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Kupi mirnu sezonu' }).click();

        await expect(page.getByText('Želiš veći saldo?')).toBeVisible();
        await expect(page.getByText('Majstor vrtlar')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Odaberi majstor paket' }),
        ).toBeVisible();
    });

    test('disables the one-time package after it has been used', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowerPackagesPanelStory initialOfferUsed />);

        await expect(
            page.getByText('Ova ponuda je već iskorištena na tvom računu.'),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Kupi početni paket' }),
        ).toBeDisabled();
    });
});
