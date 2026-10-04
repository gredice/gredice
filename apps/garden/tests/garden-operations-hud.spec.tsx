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
    await expect
        .poll(async () => {
            const leftBox = await leftControl.boundingBox();
            const rightBox = await rightControl.boundingBox();

            if (!leftBox || !rightBox) {
                return Number.POSITIVE_INFINITY;
            }

            const leftCenterY = leftBox.y + leftBox.height / 2;
            const rightCenterY = rightBox.y + rightBox.height / 2;

            return Math.abs(leftCenterY - rightCenterY);
        })
        .toBeLessThanOrEqual(8);
}

async function scrollFadeSize(viewport: Locator, edge: 'b' | 't') {
    return viewport.evaluate((element, property) => {
        const value = getComputedStyle(element).getPropertyValue(property);
        const measurement = document.createElement('div');
        measurement.style.cssText = `position:fixed;visibility:hidden;width:${value}`;
        document.body.appendChild(measurement);
        const width = measurement.getBoundingClientRect().width;
        measurement.remove();
        return width;
    }, `--scroll-fade-${edge}`);
}

test.describe('Garden operations HUD', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-09-22T08:00:00.000Z'));
    });
    test('shows operation items that are still in the shopping cart', async ({
        mount,
        page,
    }) => {
        await mount(<GardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();

        await expect(
            page.getByText('Planirane radnje', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Aktivne radnje', { exact: true }),
        ).toHaveCount(0);
        await expect(page.getByText('Danas', { exact: true })).toHaveCount(0);

        const may22Group = page.getByRole('button', {
            name: /^petak, 22\. svibnja/,
        });
        const may23Group = page.getByRole('button', {
            name: /^subota, 23\. svibnja/,
        });
        await expect(may22Group).toHaveAttribute('aria-expanded', 'false');
        await expect(may23Group).toHaveAttribute('aria-expanded', 'false');
        await may22Group.click();
        await may23Group.click();

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
        await expect(page.getByText('Zakazano: 20. svibnja')).toBeVisible();
        await expect(page.getByText('Zakazano: 21. svibnja')).toBeVisible();
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
        await expect(page.getByText('Zakazano: 22. svibnja')).toHaveCount(0);
        const operationDateButton = page.getByRole('button', {
            name: '22. svibnja',
            exact: true,
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
        await expect(
            reschedulableOperationCard.getByText('Sadnja', { exact: true }),
        ).toBeVisible();
        await expect(
            page
                .locator('[data-garden-operation-card]')
                .getByText('Sadnja: Klasični bosiljak'),
        ).toBeVisible();
        await expect(
            page.getByLabel('Raised Bed 1 › Polje 6').first(),
        ).toBeVisible();
        await expect(page.getByText('Zakazano: 23. svibnja')).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: '23. svibnja', exact: true }),
        ).toBeVisible();
        await expect(page.getByLabel('Tijek radnje')).toHaveCount(0);
        await expect(page.locator('.animate-progress')).toHaveCount(0);
        await expect(page.getByText(/^Kreirano:/)).toHaveCount(0);
        await expect(page.getByText(/Sljedeći korak/)).toHaveCount(0);
        await expect(page.getByText('Nema nedovršenih radnji.')).toHaveCount(0);

        const rescheduleButtons = page.getByRole('button', {
            name: /^\d+\. svibnja$/,
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
        const internalOperationCard = dialog
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Detaljan pregled gredice' });
        await expect(internalOperationCard).toHaveCount(0);
        await dialog
            .getByRole('button', { name: /^utorak, 19\. svibnja/ })
            .click();
        await expect(internalOperationCard).toBeVisible();
        await expect(
            internalOperationCard.getByText('Radnja #611'),
        ).toHaveCount(0);
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
        const todayGroup = dialog.getByRole('button', {
            name: /^srijeda, 13\. svibnja/,
        });
        await expect(todayGroup).toHaveAttribute('aria-expanded', 'true');
        await expect(dialog.getByText('Danas', { exact: true })).toHaveCount(0);
        const reschedulableHistoryCard = dialog
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Zalijevanje u košari' });
        const historyDateButton = reschedulableHistoryCard.getByRole('button', {
            name: '20. svibnja',
            exact: true,
        });
        const historyDay = dialog.getByRole('button', {
            name: /^srijeda, 20\. svibnja/,
        });
        await expect(historyDay).toHaveAttribute('aria-expanded', 'false');
        await expect(reschedulableHistoryCard).toHaveCount(0);
        await historyDay.click();
        await expect(historyDay).toHaveAttribute('aria-expanded', 'true');
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
            completedSowingCard.getByText('13. svibnja'),
        ).toBeVisible();
        await expect(completedSowingCard.getByText('10. svibnja')).toHaveCount(
            0,
        );
        await expect(
            completedSowingCard.getByLabel('Tijek radnje'),
        ).toHaveCount(0);
        await expect(
            completedSowingCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        const canceledSowingCard = dialog
            .locator('[data-garden-operation-card]')
            .filter({ hasText: 'Sadnja: Maslac salata' });
        const canceledSowingDay = dialog.getByRole('button', {
            name: /^nedjelja, 24\. svibnja/,
        });
        await expect(canceledSowingDay).toHaveAttribute(
            'aria-expanded',
            'false',
        );
        await canceledSowingDay.click();
        await expect(canceledSowingCard.getByText('Otkazano')).toBeVisible();
        await expect(
            canceledSowingCard.locator('[data-operation-status-progress]'),
        ).toHaveCount(0);
        await expect(
            canceledSowingCard.locator('[data-operation-terminal-reason]'),
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
        for (const day of await page
            .locator('button[aria-controls^="garden-operations-day-"]')
            .all()) {
            await expect(day).toHaveAttribute('aria-expanded', 'false');
            await day.click();
        }

        const scrollArea = page.locator('[data-scroll-area]').first();
        const viewport = scrollArea.locator('[data-scroll-area-viewport]');
        await viewport.evaluate((element) => {
            element.scrollTop = 0;
        });
        await expect(scrollArea).toBeVisible();
        await expect(viewport).toHaveClass(/scroll-fade-y/);
        await expect.poll(() => scrollFadeSize(viewport, 't')).toBe(0);
        await expect
            .poll(() => scrollFadeSize(viewport, 'b'))
            .toBeGreaterThan(0);

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

        await viewport.evaluate((element) => {
            element.scrollTop = 120;
        });
        await expect
            .poll(() => scrollFadeSize(viewport, 't'))
            .toBeGreaterThan(0);
    });

    for (const width of [320, 360, 448, 768, 1280]) {
        test(`keeps operation rows inside the panel at ${width}px`, async ({
            mount,
            page,
        }) => {
            await page.setViewportSize({ width, height: 720 });
            await mount(<DenseGardenOperationsHudStory />);

            await page.getByTitle('Status radnji').click();
            const days = page.locator(
                'button[aria-controls^="garden-operations-day-"]',
            );
            const dayLabel = days.first().getByText('subota, 30. svibnja');
            const dayBubble = days
                .first()
                .getByTitle('Površinsko zalijevanje gredice (1)');
            await expectSameControlRow(dayLabel.locator('..'), dayBubble);
            await days.nth(0).click();
            await days.nth(1).click();

            const cards = page.locator('[data-garden-operation-card]');
            const card = cards.first();
            const operationName = card.getByText(
                'Površinsko zalijevanje gredice',
            );
            const statusButton = card.getByRole('button', {
                name: 'Status radnje: Potvrđeno',
            });
            const bedName = card.getByText(
                'Sunčana gredica s dugim imenom uz ogradu',
                {
                    exact: true,
                },
            );
            const date = card.getByText('30. svibnja', { exact: true });
            const viewport = page
                .locator('[data-scroll-area-viewport]')
                .first();

            await expect(operationName).toBeVisible();
            await expect(statusButton).toBeVisible();
            await expect(bedName).toHaveCSS('text-overflow', 'ellipsis');
            await expect(date).toBeVisible();
            await expect
                .poll(() =>
                    date.evaluate(
                        (element) => element.scrollWidth - element.clientWidth,
                    ),
                )
                .toBeLessThanOrEqual(1);
            await expect(statusButton.getByText('Potvrđeno')).toBeVisible({
                visible: width >= 640,
            });
            await expect
                .poll(() =>
                    bedName.evaluate(
                        (element) => element.scrollWidth > element.clientWidth,
                    ),
                )
                .toBe(true);
            await expect
                .poll(() =>
                    viewport.evaluate(
                        (element) => element.scrollWidth - element.clientWidth,
                    ),
                )
                .toBeLessThanOrEqual(1);

            const viewportBox = await viewport.boundingBox();
            const nameBox = await operationName.boundingBox();
            const statusBox = await statusButton.boundingBox();
            if (!viewportBox || !nameBox || !statusBox) {
                throw new Error(
                    'Expected operation row and panel to be visible',
                );
            }
            expect(
                statusBox.x - (nameBox.x + nameBox.width),
            ).toBeLessThanOrEqual(16);

            for (const row of await cards.all()) {
                const controls = row.locator(
                    'button, [data-operation-status-progress]',
                );
                for (const element of [row, ...(await controls.all())]) {
                    const box = await element.boundingBox();
                    expect(box).not.toBeNull();
                    if (!box) continue;
                    expect(box.x).toBeGreaterThanOrEqual(viewportBox.x);
                    expect(box.x + box.width).toBeLessThanOrEqual(
                        viewportBox.x + viewportBox.width + 1,
                    );
                }
            }
            const targetBox = await bedName.boundingBox();
            const dateBox = await date.boundingBox();
            expect(
                (targetBox?.x ?? 0) + (targetBox?.width ?? 0),
            ).toBeLessThanOrEqual(dateBox?.x ?? 0);

            await statusButton.click();
            await expect(
                page.getByRole('tooltip').getByText('Statusi radnje'),
            ).toBeVisible();

            // Wrapping follows the header's available width, even on desktop.
            await days.first().evaluate((element) => {
                element.style.width = '180px';
            });
            await expect
                .poll(async () => {
                    const labelBox = await dayLabel.boundingBox();
                    const bubbleBox = await dayBubble.boundingBox();
                    if (!labelBox || !bubbleBox) return false;
                    return bubbleBox.y >= labelBox.y + labelBox.height;
                })
                .toBe(true);
        });
    }

    test('keeps the year for dates outside the current year', async ({
        mount,
        page,
    }) => {
        await page.clock.setFixedTime(new Date('2027-01-01T12:00:00.000Z'));
        await mount(<GardenOperationsHudStory />);
        await page.getByTitle('Status radnji').click();
        await expect(
            page.getByText('Zakazano: 20. svibnja 2026.'),
        ).toBeVisible();
        await page
            .getByRole('button', { name: /^petak, 22\. svibnja 2026/ })
            .click();
        await expect(
            page.getByRole('button', {
                name: '22. svibnja 2026.',
                exact: true,
            }),
        ).toBeVisible();
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
        for (const day of await dialog
            .locator('button[aria-controls^="garden-operations-day-"]')
            .all()) {
            if ((await day.getAttribute('aria-expanded')) === 'false') {
                await day.click();
            }
        }

        const scrollArea = dialog.locator('[data-scroll-area]').first();
        const viewport = scrollArea.locator('[data-scroll-area-viewport]');
        await viewport.evaluate((element) => {
            element.scrollTop = 0;
        });
        await expect(scrollArea).toBeVisible();
        await expect(viewport).toHaveClass(/scroll-fade-y/);
        await expect.poll(() => scrollFadeSize(viewport, 't')).toBe(0);
        await expect
            .poll(() => scrollFadeSize(viewport, 'b'))
            .toBeGreaterThan(0);

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
        });
        await expect
            .poll(() => scrollFadeSize(viewport, 't'))
            .toBeGreaterThan(0);
    });
});
