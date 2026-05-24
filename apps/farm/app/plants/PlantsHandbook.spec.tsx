import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
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
        page.getByRole('button', { name: /Cherry rajčica/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Genovese bosiljak/ }),
    ).toHaveCount(0);
});
