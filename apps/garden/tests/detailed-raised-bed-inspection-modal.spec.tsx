import { expect, test } from '@playwright/experimental-ct-react';
import { DetailedRaisedBedInspectionModalStory } from './DetailedRaisedBedInspectionModalStory';

test('shows the farmer notes for every inspected raised bed', async ({
    mount,
    page,
}) => {
    await mount(<DetailedRaisedBedInspectionModalStory />);

    await expect(
        page
            .getByRole('heading', { name: 'OPG - Detaljan pregled gredica' })
            .last(),
    ).toBeVisible();
    await expect(page.getByText(/Broj pregledanih gredica/)).toHaveCount(0);
    await expect(page.getByText('Gredica Sjever')).toBeVisible();
    await expect(
        page.getByAltText('Najnovija fotografija gredice Gredica Sjever'),
    ).toBeVisible();
    await expect(
        page.getByLabel('Dodijeljeni farmer Ana Farmer'),
    ).toBeVisible();
    await expect(
        page.getByText('Tlo je rahlo i dovoljno vlažno.'),
    ).toBeVisible();
    await expect(page.getByText('Gredica Jug')).toBeVisible();
    await expect(
        page.locator('[data-raised-bed-review-fallback]'),
    ).toContainText('18');
    await expect(
        page.getByLabel('Dodijeljeni farmer Ivan Marić'),
    ).toBeVisible();
    await expect(
        page.getByText('Pregled je završen bez dodatne bilješke.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Zatvori' }).first().click();
    await expect(
        page.getByRole('heading', {
            name: 'OPG - Detaljan pregled gredica',
        }),
    ).toHaveCount(0);
});

test('offers a retry when cross-device dismissal fails', async ({
    mount,
    page,
}) => {
    const story = await mount(
        <DetailedRaisedBedInspectionModalStory withDismissError />,
    );

    await expect(
        page.getByText(
            'Bilješke su prikazane, ali pregled nije označen kao pročitan na drugim uređajima.',
        ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(story).toHaveAttribute('data-retry-count', '1');
});
