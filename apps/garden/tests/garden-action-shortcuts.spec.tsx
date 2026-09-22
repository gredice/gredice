import { expect, test } from '@playwright/experimental-ct-react';
import { GardenActionStory } from './GardenActionStory';

test('plant link focuses the first available field and opens variety selection', async ({
    mount,
    page,
}) => {
    const mutations: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'POST') mutations.push(request.url());
    });
    await mount(<GardenActionStory />);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Odabir sorte', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('garden-action-target')).toContainText(
        '"gredica":"Mock gredica","polje":null',
    );
    await expect(
        page.getByText('Mock gredica · Polje 2', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('garden-action-target')).toContainText(
        '"view":"closeup"',
    );
    expect(mutations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('variety link preselects the variety without adding to the cart', async ({
    mount,
    page,
}) => {
    const posts: unknown[] = [];
    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() === 'POST')
            posts.push(route.request().postDataJSON());
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, items: [] }),
        });
    });
    await mount(<GardenActionStory searchParams="sijanje=1&sorta=101" />);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru', exact: true }),
    ).toBeEnabled();
    expect(posts).toEqual([]);
    await page
        .getByRole('button', { name: 'Dodaj u košaru', exact: true })
        .click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
        gardenId: 1,
        raisedBedId: 1,
        positionIndex: 1,
        entityTypeName: 'plantSort',
        entityId: '101',
        amount: 1,
    });
});

test('unavailable varieties retain the existing purchase guard', async ({
    mount,
    page,
}) => {
    await mount(
        <GardenActionStory
            searchParams="sijanje=1&sorta=101"
            unavailableSort
        />,
    );
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru', exact: true }),
    ).toBeDisabled();
});

test('plant shortcut opens the variety picker on mobile', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<GardenActionStory />);
    await expect(
        page.getByRole('heading', { name: 'Odabir sorte', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText('Mock gredica · Polje 2', { exact: true }),
    ).toBeVisible();
});

for (const application of ['raisedBedFull', 'plant', 'garden']) {
    test(`operation link opens scheduling for ${application}`, async ({
        mount,
        page,
    }) => {
        const posts: unknown[] = [];
        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() === 'POST')
                posts.push(route.request().postDataJSON());
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, items: [] }),
            });
        });
        await mount(
            <GardenActionStory
                searchParams="radnja=501"
                application={application}
            />,
        );
        await expect(
            page.getByRole('dialog', { name: 'Zakaži radnju: Okopavanje' }),
        ).toBeVisible();
        expect(posts).toEqual([]);
        await page
            .getByRole('textbox', { name: 'Napomena za vrtlara (neobavezno)' })
            .fill('  Molim sačuvajte listove.  ');
        await page
            .getByRole('button', { name: 'Potvrdi', exact: true })
            .click();
        await expect.poll(() => posts.length).toBe(1);
        expect(posts[0]).toMatchObject({
            gardenId: 1,
            entityId: '501',
            entityTypeName: 'operation',
            amount: 1,
            additionalData: expect.stringContaining(
                '"requestNote":"Molim sačuvajte listove."',
            ),
            ...(application !== 'garden' ? { raisedBedId: 1 } : {}),
            ...(application === 'plant' ? { positionIndex: 1 } : {}),
        });
    });
}

test('full beds explain why the plant shortcut cannot start', async ({
    mount,
    page,
}) => {
    await mount(<GardenActionStory full />);
    await expect(
        page.getByText(/Nema slobodnog polja za sjetvu/),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Odabir sorte' }),
    ).toHaveCount(0);
});

test('mismatched plant and variety links are rejected', async ({
    mount,
    page,
}) => {
    await mount(<GardenActionStory searchParams="sijanje=2&sorta=101" />);
    await expect(
        page.getByText(/Ova biljka ili sorta više nije dostupna/),
    ).toBeVisible();
});

test('sowing switches to another owned garden when the current garden is full', async ({
    mount,
    page,
}) => {
    await mount(
        <GardenActionStory
            full
            anotherGarden
            searchParams="sijanje=1&sorta=101"
        />,
    );
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(
        page.getByText('Druga gredica · Polje 1', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('garden-action-target')).toContainText(
        '"gredica":"Druga gredica"',
    );
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru', exact: true }),
    ).toBeEnabled();
});

test('operation shortcut switches gardens before opening its target', async ({
    mount,
    page,
}) => {
    await mount(
        <GardenActionStory inactive anotherGarden searchParams="radnja=501" />,
    );
    await expect(
        page.getByRole('dialog', { name: 'Zakaži radnju: Okopavanje' }),
    ).toBeVisible();
    await expect(
        page.getByText('Druga gredica', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('garden-action-target')).toContainText(
        '"gredica":"Druga gredica"',
    );
});
