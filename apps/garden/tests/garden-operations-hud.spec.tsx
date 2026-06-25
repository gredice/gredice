import { expect, test } from '@playwright/experimental-ct-react';
import {
    DenseGardenOperationsHudStory,
    GardenOperationsHudStory,
} from './GardenOperationsHudStory';

test.describe('Garden operations HUD', () => {
    test('shows operation items that are still in the shopping cart', async ({
        mount,
        page,
    }) => {
        await mount(<GardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();

        await expect(page.getByText('Radnje u košari')).toBeVisible();
        await expect(page.getByText('Zalijevanje u košari')).toHaveCount(2);
        await expect(page.getByText('Sadnja: Maslac salata')).toBeVisible();
        await expect(
            page.getByRole('img', { name: 'Maslac salata' }),
        ).toBeVisible();
        await expect(
            page.getByTitle('Identifikator gredice').first(),
        ).toBeVisible();
        await expect(
            page.getByLabel('Raised Bed 1 › Polje 3').first(),
        ).toBeVisible();
        await expect(
            page.getByLabel('Raised Bed 1 › Polje 4').first(),
        ).toBeVisible();
        await expect(
            page.getByLabel('Raised Bed 1 › Polje 5').first(),
        ).toBeVisible();
        await expect(
            page.getByText('Zakazano: 20. svibnja 2026.'),
        ).toBeVisible();
        await expect(
            page.getByText('Zakazano: 21. svibnja 2026.'),
        ).toBeVisible();
        await expect(page.getByText('Zakazano: sutra')).toBeVisible();
        await expect(page.getByText('U košari').last()).toBeVisible();

        await expect(page.getByText('Zakazano', { exact: true })).toHaveCount(
            2,
        );
        await expect(page.getByText('Planirano', { exact: true })).toHaveCount(
            0,
        );
        await expect(page.getByText('Zakazano: 22. svibnja 2026.')).toHaveCount(
            0,
        );
        const operationDateButton = page.getByRole('button', {
            name: '22. svibnja 2026.',
        });
        await expect(operationDateButton).toBeVisible();
        await expect(
            page.locator('[data-operation-media="plant"]').first(),
        ).toBeVisible();
        await expect(page.getByText('Sadnja', { exact: true })).toBeVisible();
        await expect(page.getByText('Sadnja: Klasični bosiljak')).toBeVisible();
        await expect(
            page.getByLabel('Raised Bed 1 › Polje 6').first(),
        ).toBeVisible();
        await expect(page.getByText('Zakazano: 23. svibnja 2026.')).toHaveCount(
            0,
        );
        await expect(
            page.getByRole('button', { name: '23. svibnja 2026.' }),
        ).toBeVisible();
        await expect(page.getByLabel('Tijek radnje')).toHaveCount(0);
        await expect(page.locator('.animate-progress')).toHaveCount(0);
        await expect(page.getByText(/^Kreirano:/)).toHaveCount(0);
        await expect(page.getByText(/Sljedeći korak/)).toHaveCount(0);
        await expect(page.getByText('Nema nedovršenih radnji.')).toHaveCount(0);

        const rescheduleButtons = page.getByRole('button', {
            name: /svibnja 2026\./,
        });
        await expect(rescheduleButtons).toHaveCount(2);

        await operationDateButton.click();
        await expect(
            page.getByText('Novi datum', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Spremi' }),
        ).toBeVisible();
    });

    test('shows completed sowing tasks in operation history', async ({
        mount,
        page,
    }) => {
        await mount(<GardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();
        await page.getByRole('button', { name: 'Prikaži sve radnje' }).click();

        const dialog = page
            .getByRole('dialog')
            .filter({ hasText: 'Povijest radnji' });
        await expect(dialog.getByText('Sadnja: Cherry rajčica')).toBeVisible();
        await expect(dialog.getByLabel('Raised Bed 1 › Polje 3')).toBeVisible();
        await expect(dialog.getByText('Završeno')).toBeVisible();
        await expect(dialog.getByLabel('Tijek radnje').first()).toBeVisible();
        await expect(dialog.locator('.animate-progress')).toHaveCount(0);
    });

    test('keeps active operation cards full height in scrollable lists', async ({
        mount,
        page,
    }) => {
        await mount(<DenseGardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();

        const scrollView = page.locator('[data-scroll-view]').first();
        const topFade = scrollView.locator('[data-scroll-view-top-fade]');
        const bottomFade = scrollView.locator('[data-scroll-view-bottom-fade]');
        await expect(scrollView).toBeVisible();
        await expect(topFade).toHaveAttribute('data-visible', 'false');
        await expect(bottomFade).toHaveAttribute('data-visible', 'true');

        const cards = page.locator('[data-garden-operation-card]');
        await expect(cards.nth(10)).toBeVisible();
        expect(await cards.count()).toBeGreaterThan(10);
        await expect(cards.first().getByLabel('Tijek radnje')).toBeVisible();
        await expect(cards.nth(5).getByLabel('Tijek radnje')).toBeVisible();

        const firstCardBox = await cards.first().boundingBox();
        const sixthCardBox = await cards.nth(5).boundingBox();
        expect(firstCardBox).not.toBeNull();
        expect(sixthCardBox).not.toBeNull();
        expect(firstCardBox?.height ?? 0).toBeGreaterThan(90);
        expect(sixthCardBox?.height ?? 0).toBeGreaterThan(90);

        await scrollView
            .locator('[data-scroll-view-viewport]')
            .evaluate((element) => {
                element.scrollTop = 120;
                element.dispatchEvent(new Event('scroll', { bubbles: true }));
            });
        await expect(topFade).toHaveAttribute('data-visible', 'true');
    });

    test('keeps history operation cards full height in scrollable modal', async ({
        mount,
        page,
    }) => {
        await mount(<DenseGardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();
        await page.getByRole('button', { name: 'Prikaži sve radnje' }).click();

        const dialog = page
            .getByRole('dialog')
            .filter({ hasText: 'Povijest radnji' });
        const scrollView = dialog.locator('[data-scroll-view]').first();
        const viewport = scrollView.locator('[data-scroll-view-viewport]');
        const topFade = scrollView.locator('[data-scroll-view-top-fade]');
        const bottomFade = scrollView.locator('[data-scroll-view-bottom-fade]');
        await expect(scrollView).toBeVisible();
        await expect(topFade).toHaveAttribute('data-visible', 'false');
        await expect(bottomFade).toHaveAttribute('data-visible', 'true');

        await expect
            .poll(async () => {
                const dialogBox = await dialog.boundingBox();
                const viewportBox = await viewport.boundingBox();
                if (!dialogBox || !viewportBox) {
                    return Number.POSITIVE_INFINITY;
                }
                return Math.abs(
                    viewportBox.x +
                        viewportBox.width -
                        (dialogBox.x + dialogBox.width),
                );
            })
            .toBeLessThanOrEqual(2);

        const cards = dialog.locator('[data-garden-operation-card]');
        await expect(cards.nth(10)).toBeVisible();
        expect(await cards.count()).toBeGreaterThan(10);
        await expect(cards.first().getByLabel('Tijek radnje')).toBeVisible();
        await expect(cards.nth(8)).toBeVisible();

        const firstCardBox = await cards.first().boundingBox();
        const ninthCardBox = await cards.nth(8).boundingBox();
        expect(firstCardBox).not.toBeNull();
        expect(ninthCardBox).not.toBeNull();
        expect(firstCardBox?.height ?? 0).toBeGreaterThan(90);
        expect(ninthCardBox?.height ?? 0).toBeGreaterThan(90);

        await viewport.evaluate((element) => {
            element.scrollTop = 120;
            element.dispatchEvent(new Event('scroll', { bubbles: true }));
        });
        await expect(topFade).toHaveAttribute('data-visible', 'true');
    });
});
