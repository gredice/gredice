import AxeBuilder from '@axe-core/playwright';
import type { CommunityContributorView } from '../components/community-edits/communityContributors';
import { expect, test } from './component-fixtures';
import { SectionContributionBarHarness } from './SectionContributionBarHarness';
import '../app/globals.css';

const names = [
    'Ana Kovač',
    'Marko Marić',
    'Petra Horvat',
    'Luka Babić',
    'Iva Novak',
    'Ivan Jurić',
    'Maja Perić',
];

/** Newest editor first, as storage returns them. */
const contributors: CommunityContributorView[] = names.map((name, index) => ({
    publicId: `u_${index}`,
    displayName: name,
    avatarUrl: null,
    lastEditedAt: `2026-11-${String(12 - index).padStart(2, '0')}T10:00:00.000Z`,
    editCount: 1,
}));

const edit = {
    entityTypeName: 'plant',
    entityId: 7,
    publicPath: '/biljke/rajcica',
    sectionKey: 'sowing',
    entityName: 'Rajčica',
    sectionLabel: 'Sijanje',
} as const;

const feedback = {
    topic: 'www/plants/information',
    data: { plantId: 7, sectionId: 'sowing' },
};

test.beforeEach(async ({ page }) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: {} }),
    );
});

for (const width of [360, 1280]) {
    test(`the bar labels rating and editing and fits ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 });
        await mount(
            <SectionContributionBarHarness
                bar={{ feedback, edit, contributors }}
            />,
        );

        const rating = page.getByRole('group', { name: 'Je li ovo korisno?' });
        await expect(rating.getByRole('button', { name: 'Da' })).toBeVisible();
        await expect(rating.getByRole('button', { name: 'Ne' })).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Predloži izmjenu' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Urednici odjeljka – 7' }),
        ).toBeVisible();

        for (const control of await page
            .locator('[data-section-contribution-bar] button')
            .all()) {
            const box = await control.boundingBox();
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(28);
        }
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
    });
}

test('the bar keeps its controls in place when nobody has contributed yet', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const component = await mount(
        <SectionContributionBarHarness
            bar={{ feedback, edit, contributors }}
        />,
    );
    const editButton = page.getByRole('button', { name: 'Predloži izmjenu' });
    const withContributors = await editButton.boundingBox();

    await component.update(
        <SectionContributionBarHarness
            bar={{ feedback, edit, contributors: [] }}
        />,
    );
    await expect(
        page.getByRole('button', { name: /Urednici odjeljka/ }),
    ).toHaveCount(0);
    expect(await editButton.boundingBox()).toEqual(withContributors);
});

test('answering the question records the rating for that section', async ({
    mount,
    page,
}) => {
    const requests: unknown[] = [];
    await page.route('**/api/gredice/api/feedback**', async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
            status: 200,
            json: { id: '11111111-1111-4111-8111-111111111111' },
        });
    });
    await mount(<SectionContributionBarHarness bar={{ feedback, edit }} />);

    await page.getByRole('button', { name: 'Da' }).click();

    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
        topic: 'www/plants/information',
        data: { plantId: 7, sectionId: 'sowing' },
        score: '1',
    });
});

test('the avatar stack lists the latest editors on click and closes with Escape', async ({
    mount,
    page,
}) => {
    await mount(
        <SectionContributionBarHarness
            bar={{ feedback, edit, contributors }}
        />,
    );
    const stack = page.getByRole('button', { name: 'Urednici odjeljka – 7' });

    await stack.focus();
    await page.keyboard.press('Enter');

    const list = page.getByRole('dialog', { name: 'Urednici odjeljka – 7' });
    await expect(list).toBeVisible();
    const links = list.getByRole('link');
    await expect(links).toHaveCount(5);
    await expect(links.first()).toContainText('Ana Kovač');
    await expect(links.first()).toContainText('Zadnja izmjena 12. studenoga');
    await expect(links.first()).toHaveAttribute('href', '/korisnici/u_0');
    await expect(list).toContainText('i još 2 vrtlara');
    await expect(links.first()).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(stack).toBeFocused();
});

test('hovering previews the editors without taking keyboard focus', async ({
    mount,
    page,
}) => {
    await mount(
        <SectionContributionBarHarness
            bar={{ feedback, edit, contributors }}
        />,
    );
    const stack = page.getByRole('button', { name: 'Urednici odjeljka – 7' });
    const list = page.getByRole('dialog', { name: 'Urednici odjeljka – 7' });

    await stack.hover();
    await expect(list).toBeVisible();
    await expect(list.getByRole('link').first()).not.toBeFocused();

    // Moving into the list keeps it open so a profile can be opened.
    await list.getByRole('link').nth(1).hover();
    await expect(list).toBeVisible();

    await page.getByRole('heading', { level: 1 }).hover();
    await expect(list).toBeHidden();
});

test('pressing the stack while it previews keeps the list open', async ({
    mount,
    page,
}) => {
    await mount(
        <SectionContributionBarHarness
            bar={{ feedback, edit, contributors }}
        />,
    );
    const stack = page.getByRole('button', { name: 'Urednici odjeljka – 7' });
    const list = page.getByRole('dialog', { name: 'Urednici odjeljka – 7' });

    await stack.hover();
    await expect(list).toBeVisible();
    await stack.click();
    await page.getByRole('heading', { level: 1 }).hover();
    await expect(list).toBeVisible();

    await page.getByRole('heading', { level: 1 }).click();
    await expect(list).toBeHidden();
});

test('the page panel credits editors and invites the next suggestion', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mount(
        <SectionContributionBarHarness
            page={{
                contributors: {
                    contributors,
                    lastEditedAt: '2026-11-12T10:00:00.000Z',
                },
                edit: {
                    entityTypeName: 'plant',
                    entityId: 7,
                    publicPath: '/biljke/rajcica',
                    entityName: 'Rajčica',
                },
            }}
        />,
    );

    const panel = page.getByRole('region', {
        name: 'Ovu stranicu uređuje zajednica',
    });
    await expect(panel).toContainText('Zadnja izmjena 12. studenoga 2026.');
    await expect(panel).toContainText(
        'Ovu stranicu poboljšavaju Ana Kovač, Marko Marić i još 5 vrtlara.',
    );
    await expect(
        panel.getByRole('button', { name: 'Urednici stranice – 7' }),
    ).toBeVisible();
    await expect(
        panel.getByRole('button', { name: 'Predloži izmjenu' }),
    ).toBeVisible();
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the page panel invites a first suggestion when nobody has contributed', async ({
    mount,
    page,
}) => {
    await mount(
        <SectionContributionBarHarness
            page={{
                contributors: { contributors: [], lastEditedAt: null },
                edit: {
                    entityTypeName: 'operation',
                    entityId: 3,
                    publicPath: '/radnje/zalijevanje',
                    entityName: 'Zalijevanje',
                },
            }}
        />,
    );

    const panel = page.getByRole('region', {
        name: 'Ovu stranicu uređuje zajednica',
    });
    await expect(panel).toContainText(
        'Znaš nešto što ovdje nedostaje? Predloži izmjenu.',
    );
    await expect(panel.getByText('Zadnja izmjena')).toHaveCount(0);
    await expect(
        panel.getByRole('button', { name: /Urednici stranice/ }),
    ).toHaveCount(0);
});
