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
        await page.setViewportSize({ width: 1200, height: 900 });
        await mount(<SunflowerPackagesPanelStory />);

        await expect(page.getByText('Početna ponuda')).toHaveCount(0);
        await expect(
            page.getByText('Puna gredica', { exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Glavni paketi')).toHaveCount(0);
        await expect(
            page.getByText('Mali zalogaj', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Vrtna košarica', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Mirna sezona', { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Odaberi' })).toHaveCount(
            4,
        );

        const initialOffer = page.locator(
            '[data-sunflower-package="puna_gredica"]',
        );
        const [
            initialOfferHeaderBox,
            initialOfferBreakdownBox,
            initialOfferCtaBox,
        ] = await Promise.all([
            initialOffer
                .getByText('Puna gredica', { exact: true })
                .boundingBox(),
            initialOffer
                .locator('[data-package-breakdown="desktop"]')
                .boundingBox(),
            initialOffer.getByRole('button', { name: 'Odaberi' }).boundingBox(),
        ]);
        expect(initialOfferHeaderBox?.y).toBeLessThan(
            initialOfferBreakdownBox?.y ?? 0,
        );
        expect(initialOfferBreakdownBox?.y).toBeLessThan(
            initialOfferCtaBox?.y ?? 0,
        );

        const mainPackageCards = [
            page.locator('[data-sunflower-package="mali_zalogaj"]'),
            page.locator('[data-sunflower-package="vrtna_kosarica"]'),
            page.locator('[data-sunflower-package="mirna_sezona"]'),
        ];
        const mainPackageBoxes = await Promise.all(
            mainPackageCards.map((card) => card.boundingBox()),
        );
        if (mainPackageBoxes.some((box) => box === null)) {
            throw new Error('Expected every main package card to be visible.');
        }
        const [smallPackageBox, popularPackageBox, bestValuePackageBox] =
            mainPackageBoxes;
        expect(smallPackageBox?.y).toBe(popularPackageBox?.y);
        expect(popularPackageBox?.y).toBe(bestValuePackageBox?.y);
        expect(smallPackageBox?.x).toBeLessThan(popularPackageBox?.x ?? 0);
        expect(popularPackageBox?.x).toBeLessThan(bestValuePackageBox?.x ?? 0);

        await page
            .locator('[data-sunflower-package="mirna_sezona"]')
            .getByRole('button', { name: 'Odaberi' })
            .click();

        await expect(page.getByText('Želiš veći saldo?')).toBeVisible();
        await expect(page.getByText('Majstor vrtlar')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Odaberi majstor paket' }),
        ).toBeVisible();
    });

    test('keeps mobile package totals compact and reveals only useful breakdowns', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await mount(<SunflowerPackagesPanelStory />);

        const smallPackage = page.locator(
            '[data-sunflower-package="mali_zalogaj"]',
        );
        await expect(
            smallPackage.locator('[data-package-total]'),
        ).toBeVisible();
        await expect(
            smallPackage.locator('[data-package-breakdown]'),
        ).toHaveCount(0);

        const popularPackage = page.locator(
            '[data-sunflower-package="vrtna_kosarica"]',
        );
        const mobileBreakdown = popularPackage.locator(
            '[data-package-breakdown="mobile"]',
        );
        await expect(mobileBreakdown).not.toHaveAttribute('open', '');
        await expect(
            mobileBreakdown.getByText('42.000 🌻', { exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Prikaži raščlambu')).toHaveCount(0);
        await expect(page.getByText('Sakrij raščlambu')).toHaveCount(0);
        await expect(
            mobileBreakdown.getByText('Osnovni iznos', { exact: true }),
        ).not.toBeVisible();

        await mobileBreakdown.locator('summary').click();

        await expect(mobileBreakdown).toHaveAttribute('open', '');
        await expect(
            mobileBreakdown.getByText('Osnovni iznos', { exact: true }),
        ).toBeVisible();
        await expect(
            mobileBreakdown.getByText('Bonus 5 %', { exact: true }),
        ).toBeVisible();
    });

    test('hides the one-time package after it has been used', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowerPackagesPanelStory initialOfferUsed />);

        await expect(
            page.getByText('Puna gredica', { exact: true }),
        ).toHaveCount(0);
        await expect(page.getByText('Jednokratna ponuda')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Odaberi' })).toHaveCount(
            3,
        );
    });
});
