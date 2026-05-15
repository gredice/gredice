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
        await expect(page.getByText('Zalijevanje u košari')).toBeVisible();
        await expect(page.getByText('Polje 3 • Raised Bed 1')).toBeVisible();
        await expect(page.getByText('U košari').last()).toBeVisible();
        await expect(page.getByText('Nema nedovršenih radnji.')).toHaveCount(0);
    });
});
