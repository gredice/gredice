import { expect, test } from '@playwright/experimental-ct-react';
import { GardenOperationsHudStory } from './GardenOperationsHudStory';

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
        await expect(page.getByText('Polje 3 • Raised Bed 1')).toBeVisible();
        await expect(page.getByText('Polje 4 • Raised Bed 1')).toBeVisible();
        await expect(page.getByText('Polje 5 • Raised Bed 1')).toBeVisible();
        await expect(
            page.getByText('Zakazano: 20. svibnja 2026.'),
        ).toBeVisible();
        await expect(
            page.getByText('Zakazano: 21. svibnja 2026.'),
        ).toBeVisible();
        await expect(page.getByText('Zakazano: sutra')).toBeVisible();
        await expect(page.getByText('U košari').last()).toBeVisible();

        await expect(page.getByText('Sadnja', { exact: true })).toBeVisible();
        await expect(page.getByText('Polje 1 • Raised Bed 1')).toBeVisible();
        await expect(page.getByText('Sadnja: Klasični bosiljak')).toBeVisible();
        await expect(page.getByText('Polje 6 • Raised Bed 1')).toBeVisible();
        await expect(
            page.getByText('Zakazano: 23. svibnja 2026.'),
        ).toBeVisible();
        await expect(page.getByText('Nema nedovršenih radnji.')).toHaveCount(0);
    });

    test('shows completed sowing tasks in operation history', async ({
        mount,
        page,
    }) => {
        await mount(<GardenOperationsHudStory />);

        await page.getByTitle('Status radnji').click();
        await page.getByRole('button', { name: 'Prikaži sve radnje' }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('Sadnja: Cherry rajčica')).toBeVisible();
        await expect(dialog.getByText('Polje 3 • Raised Bed 1')).toBeVisible();
        await expect(dialog.getByText('Završeno')).toBeVisible();
    });
});
