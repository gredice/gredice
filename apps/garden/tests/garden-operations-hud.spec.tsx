import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    DenseGardenOperationsHudStory,
    GardenOperationsHudStory,
} from './GardenOperationsHudStory';

async function expectSameControlRow(
    leftControl: Locator,
    rightControl: Locator,
) {
    const leftBox = await leftControl.boundingBox();
    const rightBox = await rightControl.boundingBox();

    if (!leftBox || !rightBox) {
        throw new Error('Expected both controls to be visible');
    }

    const leftCenterY = leftBox.y + leftBox.height / 2;
    const rightCenterY = rightBox.y + rightBox.height / 2;

    expect(Math.abs(leftCenterY - rightCenterY)).toBeLessThanOrEqual(8);
}

test.describe('Garden operations HUD', () => {
    test('shows operation items that are still in the shopping cart', async ({
        mount,
        page,
    }) => {
        await mount(<GardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();

        await expect(page.getByText('Radnje u košari')).toBeVisible();
        await expect(
            page.getByRole('tooltip').filter({ hasText: 'Statusi radnje' }),
        ).toHaveCount(0);
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
        await expect(page.getByText('U košari', { exact: true })).toHaveCount(
            0,
        );
        await expect(page.getByText('U košari, još nije kupljeno')).toHaveCount(
            0,
        );
        await expect(
            page.getByRole('button', { name: 'Otvori košaru' }),
        ).toHaveCount(1);

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
        const reschedulableOperationCard = page
            .locator('[data-garden-operation-card]')
            .filter({ has: operationDateButton })
            .first();
        await expectSameControlRow(
            operationDateButton,
            reschedulableOperationCard.getByRole('button', { name: 'Otkaži' }),
        );
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

    test('shows internal operation labels in operation cards', async ({
        mount,
        page,
    }) => {
        await mount(<GardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();
        await page.getByRole('button', { name: 'Prikaži sve radnje' }).click();

        const dialog = page
            .getByRole('dialog')
            .filter({ hasText: 'Povijest radnji' });
        await expect(
            dialog.getByText('Detaljan pregled gredice'),
        ).toBeVisible();
        await expect(dialog.getByText('Radnja #611')).toHaveCount(0);
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
        const reschedulableHistoryCard = dialog
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Zalijevanje u košari' });
        const historyDateButton = reschedulableHistoryCard.getByRole('button', {
            name: '20. svibnja 2026.',
        });
        await expect(historyDateButton).toBeVisible();
        await expectSameControlRow(
            historyDateButton,
            reschedulableHistoryCard.getByRole('button', { name: 'Otkaži' }),
        );
        await expect(
            reschedulableHistoryCard.getByRole('button', { name: 'Otkaži' }),
        ).toBeVisible();
        const completedSowingCard = dialog
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Sadnja: Cherry rajčica' });
        await expect(completedSowingCard).toBeVisible();
        await expect(
            completedSowingCard.getByLabel('Raised Bed 1 › Polje 3'),
        ).toBeVisible();
        await expect(completedSowingCard.getByText('Završeno')).toBeVisible();
        await expect(
            completedSowingCard.getByText('13. svibnja 2026.'),
        ).toBeVisible();
        await expect(
            completedSowingCard.getByText('10. svibnja 2026.'),
        ).toHaveCount(0);
        await expect(
            completedSowingCard.getByLabel('Tijek radnje'),
        ).toHaveCount(0);
        await expect(
            completedSowingCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        const canceledSowingCard = dialog
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Sadnja: Maslac salata' });
        await expect(canceledSowingCard.getByText('Otkazano')).toBeVisible();
        await expect(
            canceledSowingCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        await expect(
            canceledSowingCard.locator('[data-operation-cancellation-reason]'),
        ).toHaveCount(1);
        await canceledSowingCard
            .getByRole('button', { name: /Razlog otkazivanja/ })
            .click();
        const reasonTooltip = page
            .getByRole('tooltip')
            .filter({ hasText: 'Razlog otkazivanja' });
        await expect(
            reasonTooltip.getByText('Korisnik je otkazao sijanje.'),
        ).toBeVisible();
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
        const statusTooltip = page
            .getByRole('tooltip')
            .filter({ hasText: 'Statusi radnje' });
        await expect(statusTooltip).toHaveCount(0);
        const firstStatusTrigger = cards.first().getByRole('button', {
            name: /Status radnje:/,
        });
        await firstStatusTrigger.click();
        await expect(statusTooltip).toHaveCount(1);
        await expect(
            statusTooltip.getByText(/\d{1,2}:\d{2}:\d{2}/),
        ).toHaveCount(0);
        await page.mouse.move(0, 0);
        await expect(statusTooltip).toHaveCount(0);
        await expect(cards.first().getByLabel('Tijek radnje')).toHaveCount(0);
        await expect(
            cards.first().locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        await expect(cards.nth(5).getByLabel('Tijek radnje')).toBeVisible();
        await expect(
            cards.nth(5).locator('[data-operation-status-progress]'),
        ).toHaveCount(1);
        await cards.nth(5).getByLabel('Tijek radnje').hover();
        await expect(statusTooltip).toHaveCount(1);
        await expect(
            statusTooltip.getByText(/\d{1,2}:\d{2}:\d{2}/),
        ).toHaveCount(0);

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

    test('lets operation names use the space before the status badge', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 448, height: 720 });
        await mount(<DenseGardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();

        const card = page
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Površinsko zalijevanje gredice' })
            .first();
        const operationName = card.getByText('Površinsko zalijevanje gredice');
        const statusButton = card
            .getByRole('button', { name: /Status radnje:/ })
            .first();

        await expect(operationName).toBeVisible();
        await expect(statusButton).toBeVisible();

        const nameBox = await operationName.boundingBox();
        const statusBox = await statusButton.boundingBox();

        if (!nameBox || !statusBox) {
            throw new Error('Expected operation name and status to be visible');
        }

        const gapBeforeStatus = statusBox.x - (nameBox.x + nameBox.width);

        expect(gapBeforeStatus).toBeLessThanOrEqual(16);
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
        const completedCard = cards.filter({ hasText: 'Završeno' }).first();
        const confirmedCard = cards.filter({ hasText: 'Potvrđeno' }).first();
        const failedCard = cards.filter({ hasText: 'Neuspjelo' }).first();
        const canceledCard = cards.filter({ hasText: 'Otkazano' }).first();
        await expect(completedCard).toBeVisible();
        await expect(confirmedCard).toBeVisible();
        await expect(failedCard).toBeVisible();
        await expect(canceledCard).toBeVisible();
        await expect(
            completedCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        await expect(
            confirmedCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        await expect(
            failedCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        await expect(
            canceledCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
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
