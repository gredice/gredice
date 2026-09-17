import { expect, test } from '@playwright/experimental-ct-react';
import {
    SunflowerPackagesPanelStory,
    SunflowersHudLoadingStory,
    SunflowersHudStory,
    SunflowersPendingDetailsStory,
} from './SunflowersHudStory';

test.describe('Sunflowers HUD', () => {
    test('keeps the HUD visible with an amount skeleton while the account loads', async ({
        mount,
        page,
    }) => {
        await mount(<SunflowersHudLoadingStory />);

        const hud = page.locator('[data-sunflowers-hud-target]');
        await expect(hud).toBeVisible();
        await expect(hud).toHaveAttribute('aria-busy', 'true');
        await expect(
            page.locator('[data-sunflowers-hud-amount-skeleton="true"]'),
        ).toBeVisible();
        await expect(hud).toHaveAccessibleName(
            /Suncokret Učitavanje broja suncokreta/u,
        );
    });

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

    test('keeps grouped spending and earned amounts beside the new artwork', async ({
        mount,
        page,
    }) => {
        await mount(
            <SunflowersPendingDetailsStory
                cartSunflowers={0}
                history={[
                    {
                        id: 1,
                        amount: -3000,
                        createdAt: '2026-09-17T08:00:00.000Z',
                        reason: 'shoppingCart:1',
                    },
                    {
                        id: 2,
                        amount: -3000,
                        createdAt: '2026-09-17T08:00:00.000Z',
                        reason: 'shoppingCart:2',
                    },
                    {
                        id: 3,
                        amount: 200,
                        createdAt: '2026-09-17T08:00:00.000Z',
                        reason: 'refund:operation:1',
                    },
                    {
                        id: 4,
                        amount: 1000,
                        createdAt: '2026-09-17T08:00:00.000Z',
                        reason: 'birthday:2026',
                    },
                ]}
            />,
        );
        await expect(page.getByText('Kupnja')).toBeVisible();
        await expect(page.getByText('x2')).toBeVisible();
        await expect(page.getByText(/[\u2212-]6\.000/u)).toBeVisible();
        await expect(page.getByText('+200', { exact: true })).toBeVisible();
        await expect(page.getByText('+1.000', { exact: true })).toBeVisible();
        await expect(page.locator('image[href*="refund"]')).toHaveCount(1);
        await expect(page.locator('image[href*="birthday"]')).toHaveCount(1);
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
        await expect(page.locator('[data-package-cta]')).toHaveCount(4);

        for (const [code, filename] of Object.entries({
            mali_zalogaj: 'package-small',
            vrtna_kosarica: 'package-basket',
            mirna_sezona: 'package-season',
            puna_gredica: 'package-starter',
        })) {
            await expect(
                page.locator(
                    `[data-sunflower-package="${code}"] [data-sunflower-package-artwork="${code}"] image`,
                ),
            ).toHaveAttribute(
                'href',
                new RegExp(`/${filename}(?:-[\\w-]+)?\\.webp$`, 'u'),
            );
        }

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
            initialOffer.locator('[data-package-cta]').boundingBox(),
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

        const popularPackage = mainPackageCards[1];
        const bestValuePackage = mainPackageCards[2];
        await expect(popularPackage).toHaveClass(/bg-amber-50\/70/u);
        await expect(bestValuePackage).not.toHaveClass(/bg-amber-50\/70/u);
        await expect(
            popularPackage.locator('[data-package-price]'),
        ).toContainText('39,99');
        await expect(
            bestValuePackage.locator('[data-package-price]'),
        ).toContainText('99,99');

        await page
            .locator('[data-sunflower-package="mirna_sezona"]')
            .getByRole('button', {
                name: /Odaberi Mirna sezona za 99,99/u,
            })
            .click();

        await expect(page.getByText('Želiš veći saldo?')).toBeVisible();
        await expect(page.getByText('Majstor vrtlar')).toBeVisible();
        await expect(
            page.locator(
                '[data-sunflower-package-artwork="majstor_vrtlar"] image',
            ),
        ).toHaveAttribute('href', /\/package-master(?:-[\w-]+)?\.webp$/u);
        await expect(
            page.getByRole('button', { name: 'Odaberi majstor paket' }),
        ).toBeVisible();
    });

    test('keeps mobile package totals compact and reveals only useful breakdowns', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 320, height: 844 });
        await mount(<SunflowerPackagesPanelStory panelWidth={320} />);

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

        const panelOverflow = await page
            .locator('[data-sunflower-packages-panel]')
            .evaluate((panel) => ({
                clientWidth: panel.clientWidth,
                scrollWidth: panel.scrollWidth,
            }));
        expect(panelOverflow.scrollWidth).toBeLessThanOrEqual(
            panelOverflow.clientWidth + 1,
        );

        const smallPackage = mainPackageCards[0];
        await expect(
            smallPackage.locator('[data-package-total]'),
        ).toBeVisible();
        await expect(
            smallPackage.locator('[data-package-breakdown]'),
        ).toHaveCount(0);

        const popularPackage = mainPackageCards[1];
        const mobileBreakdown = popularPackage.locator(
            '[data-package-breakdown="compact"]',
        );
        await expect(mobileBreakdown).not.toHaveClass(/border|bg-/u);
        await expect(mobileBreakdown).not.toHaveAttribute('open', '');
        await expect(
            mobileBreakdown.getByText('42.000 Suncokreti', { exact: true }),
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

    test('adapts desktop package cards to the narrow profile column', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 950, height: 760 });
        await mount(<SunflowerPackagesPanelStory panelWidth={400} />);

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

        const bestValuePackage = mainPackageCards[2];
        await expect(
            bestValuePackage.locator('[data-package-breakdown="desktop"]'),
        ).not.toBeVisible();
        await expect(
            bestValuePackage.locator('[data-package-breakdown="compact"]'),
        ).toBeVisible();
        await expect(
            bestValuePackage
                .locator('[data-package-breakdown="compact"]')
                .getByText('110.000 Suncokreti', { exact: true }),
        ).toBeVisible();

        const panelOverflow = await page
            .locator('[data-sunflower-packages-panel]')
            .evaluate((panel) => ({
                clientWidth: panel.clientWidth,
                scrollWidth: panel.scrollWidth,
            }));
        expect(panelOverflow.scrollWidth).toBeLessThanOrEqual(
            panelOverflow.clientWidth + 1,
        );
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
        await expect(page.locator('[data-package-cta]')).toHaveCount(3);
    });
});
