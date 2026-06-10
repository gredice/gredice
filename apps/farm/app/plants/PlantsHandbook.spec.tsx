import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { PlantSortDetails } from './PlantSortDetails';
import { PlantsHandbook } from './PlantsHandbook';

const tomatoPlant = {
    id: 1,
    information: {
        name: 'Rajčica',
        label: 'Rajčica',
        alternativeName: ['Paradajz', 'Pomidor'],
    },
} satisfies EntityStandardized;

const tomatoSort = {
    id: 101,
    information: {
        name: 'Cherry rajčica',
        plant: tomatoPlant,
    },
} satisfies EntityStandardized;

const basilSort = {
    id: 102,
    information: {
        name: 'Genovese bosiljak',
        plant: {
            id: 2,
            information: {
                name: 'Bosiljak',
                alternativeName: ['Bazilikum'],
            },
        },
    },
} satisfies EntityStandardized;

const pepperSort = {
    id: 103,
    information: {
        name: 'Paprika',
        description: 'Njega uključuje:\n- zalijevanje\n- berbu',
    },
} satisfies EntityStandardized;

test('plant handbook search includes parent plant alternative names', async ({
    mount,
    page,
}) => {
    await mount(<PlantsHandbook plantSortsData={[tomatoSort, basilSort]} />);

    const searchInput = page.getByPlaceholder('Pretraži biljke');
    await searchInput.click();
    await searchInput.pressSequentially('paradajz');

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('paradajz');
    await expect(
        page.getByRole('link', { name: /Cherry rajčica/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: /Genovese bosiljak/ }),
    ).toHaveCount(0);
});

test('plant sort details render description markdown', async ({
    mount,
    page,
}) => {
    await mount(<PlantSortDetails plantSort={pepperSort} />);

    await expect(page.getByText('Njega uključuje:')).toBeVisible();
    await expect(
        page.getByRole('listitem').filter({ hasText: 'zalijevanje' }),
    ).toBeVisible();
    await expect(
        page.getByRole('listitem').filter({ hasText: 'berbu' }),
    ).toBeVisible();
    await expect(page.getByText('- zalijevanje')).toHaveCount(0);
});
