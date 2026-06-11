import { expect, test } from '@playwright/experimental-ct-react';
import { VisitSummaryModalFixture } from './GardenVisitSummaryModalStory';

test('garden visit summary modal renders facts and closes cleanly', async ({
    mount,
    page,
}) => {
    await mount(<VisitSummaryModalFixture />);

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toBeVisible();
    await expect(page.getByText('Pojavio se korov na 4 polja.')).toBeVisible();
    await expect(page.getByText('Rajčice su vidljivo narasle.')).toBeVisible();
    await expect(page.getByText('Polje 4')).toHaveCount(2);

    await page
        .getByRole('button', {
            name: 'Prikaži u vrtu: Pojavio se korov na 4 polja.',
        })
        .click();
    await expect(page.locator('output')).toHaveText('weed:fields');

    await page.getByRole('button', { name: 'Kreni u obilazak' }).click();

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toHaveCount(0);
});
