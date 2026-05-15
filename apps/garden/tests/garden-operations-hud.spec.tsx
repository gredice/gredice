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
        await expect(page.getByText('Nema nedovršenih radnji.')).toHaveCount(0);
    });
});
