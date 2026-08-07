import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { PlantSortDetails } from './PlantSortDetails';
import { PlantSortPublicLink } from './PlantSortPublicLink';
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

test('keeps long plant guidance contained on a narrow phone', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const component = await mount(
        <PlantSortDetails
            plantSort={{
                id: 104,
                information: {
                    name: 'Duga sorta',
                    description: [
                        '## VrloDugNaslovBezRazmakaKojiSeMoraPrelomitiNaMalomZaslonuVrloDugNaslovBezRazmaka',
                        '',
                        'VrloDugNePrekinutTekstKojiSeMoraPrelomitiNaMalomZaslonuBezHorizontalnogPomicanjaVrloDugNePrekinutTekst',
                        '',
                        '`vrlo-duga-naredba-bez-razmaka-koja-ne-smije-prosiriti-stranicu-na-telefonu`',
                        '',
                        '```',
                        'vrlo-duga-naredba-u-bloku-bez-razmaka-koja-se-pomice-unutar-kartice',
                        '```',
                    ].join('\n'),
                },
            }}
        />,
    );

    await expect(
        component.getByRole('heading', {
            name: /VrloDugNaslovBezRazmaka/,
        }),
    ).toBeVisible();
    await expect(component.locator('pre')).toBeVisible();
    expect(
        await component.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
});

test('names the public plant link and its new-tab behavior', async ({
    mount,
    page,
}) => {
    await mount(
        <PlantSortPublicLink
            label="Cherry rajčica"
            publicUrl="https://gredice.com/biljke/cherry-rajcica"
        />,
    );

    const publicLink = page.getByRole('link', {
        name: 'Otvori javnu stranicu sorte Cherry rajčica u novoj kartici',
    });
    await expect(publicLink).toHaveAttribute('target', '_blank');
    await expect(publicLink).toHaveAttribute('rel', 'noreferrer');
});
