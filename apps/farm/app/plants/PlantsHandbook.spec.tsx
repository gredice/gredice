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

test('plant sort details show configurable sowing distances and density', async ({
    mount,
    page,
}) => {
    await mount(
        <PlantSortDetails
            plantSort={{
                id: 105,
                information: {
                    name: 'Gusta sadnja',
                    plant: {
                        id: 5,
                        information: { name: 'Testna biljka' },
                        attributes: {
                            seedingDistance: 15,
                            seedingDistanceMin: 10,
                            seedingDistanceMax: 30,
                        },
                    },
                },
            }}
        />,
    );

    await expect(
        page.getByText('Raspored za novu naprednu sjetvu/sadnju'),
    ).toBeVisible();
    await expect(page.getByText('4 biljke u jednom polju')).toBeVisible();
    await expect(
        page.getByText('Minimalni razmak sijanja/sadnje'),
    ).toBeVisible();
    await expect(page.getByText('10 cm', { exact: true })).toBeVisible();
    await expect(
        page.getByText('Preporučeni razmak sijanja/sadnje'),
    ).toBeVisible();
    await expect(page.getByText('15 cm', { exact: true })).toBeVisible();
    await expect(
        page.getByText('Maksimalni razmak sijanja/sadnje'),
    ).toBeVisible();
    await expect(page.getByText('30 cm', { exact: true })).toBeVisible();
});

test('plant sort details keep legacy spacing compact and derive its footprint', async ({
    mount,
    page,
}) => {
    await mount(
        <PlantSortDetails
            plantSort={{
                id: 106,
                information: {
                    name: 'Široka sadnja',
                    plant: {
                        id: 6,
                        information: { name: 'Tikvica' },
                        attributes: { seedingDistance: 60 },
                    },
                },
            }}
        />,
    );

    await expect(
        page.getByText('Raspored za novu naprednu sjetvu/sadnju'),
    ).toBeVisible();
    await expect(page.getByText('1 biljka preko 2 x 2 polja')).toBeVisible();
    await expect(
        page.getByText(
            'Za postojeće zadatke slijedite raspored spremljen u zadatku.',
        ),
    ).toBeVisible();
    await expect(
        page.getByText('Preporučeni razmak sijanja/sadnje'),
    ).toBeVisible();
    await expect(page.getByText('60 cm', { exact: true })).toBeVisible();
    await expect(page.getByText('Minimalni razmak sijanja/sadnje')).toHaveCount(
        0,
    );
    await expect(
        page.getByText('Maksimalni razmak sijanja/sadnje'),
    ).toHaveCount(0);
});

test('plant sort details warn about a footprint wider than the raised bed', async ({
    mount,
    page,
}) => {
    await mount(
        <PlantSortDetails
            plantSort={{
                id: 107,
                information: {
                    name: 'Nepodržana široka sadnja',
                    plant: {
                        id: 7,
                        information: { name: 'Široka biljka' },
                        attributes: {
                            seedingDistance: 30,
                            seedingDistanceMax: 95,
                        },
                    },
                },
            }}
        />,
    );

    await expect(
        page.getByText('Raspored za novu naprednu sjetvu/sadnju'),
    ).toBeVisible();
    await expect(
        page.getByText('Raspon razmaka nije podržan za gredicu 3 x 6 polja.'),
    ).toBeVisible();
    await expect(page.getByText('30 cm', { exact: true })).toBeVisible();
    await expect(page.getByText('95 cm', { exact: true })).toBeVisible();
});

test('plant sort details warn about contradictory sowing distances', async ({
    mount,
    page,
}) => {
    await mount(
        <PlantSortDetails
            plantSort={{
                id: 108,
                information: {
                    name: 'Neispravan razmak',
                    plant: {
                        id: 8,
                        information: { name: 'Neispravna biljka' },
                        attributes: {
                            seedingDistance: 25,
                            seedingDistanceMin: 30,
                        },
                    },
                },
            }}
        />,
    );

    await expect(
        page.getByText('Raspored za novu naprednu sjetvu/sadnju'),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Neispravna konfiguracija razmaka (min ≤ preporučeni ≤ max).',
        ),
    ).toBeVisible();
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
