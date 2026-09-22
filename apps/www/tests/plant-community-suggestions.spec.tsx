import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { PlantCommunitySuggestionsHarness } from './PlantCommunitySuggestionsHarness';
import '../app/globals.css';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
                role: 'user',
            },
        }),
    );
});

for (const width of [375, 768, 1280]) {
    test(`empty sections offer compact accessible suggestions at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(<PlantCommunitySuggestionsHarness />);
        for (const name of [
            'Predloži novi savjet',
            'Predloži novu bolest',
            'Predloži novog štetnika',
        ]) {
            const button = page.getByRole('button', { name });
            await expect(button).toBeVisible();
            const bounds = await button.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds?.height).toBeGreaterThanOrEqual(44);
            expect(bounds?.height).toBeLessThanOrEqual(64);
        }
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page
            .getByRole('button', { name: 'Predloži novi savjet' })
            .focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(
            page.getByRole('button', { name: 'Predloži novi savjet' }),
        ).toBeFocused();
    });
}

test('submits a plant tip and preserves text after a failed submission', async ({
    mount,
    page,
}) => {
    let submittedBody: unknown;
    let attempts = 0;
    await page.route(
        '**/api/gredice/api/directories/community-edits/entity-suggestions',
        async (route) => {
            attempts += 1;
            submittedBody = route.request().postDataJSON();
            await route.fulfill(
                attempts === 1
                    ? { status: 500, json: { message: 'Pokušaj ponovno.' } }
                    : {
                          status: 201,
                          json: {
                              requestId: 45,
                              status: 'pending_admin_approval',
                          },
                      },
            );
        },
    );
    await mount(<PlantCommunitySuggestionsHarness />);
    await page.getByRole('button', { name: 'Predloži novi savjet' }).click();
    await expect(page.getByText('Biljka: Bob')).toBeVisible();
    await page.getByLabel('Naslov savjeta').fill('Zaštita od vjetra');
    await page
        .getByLabel('Tvoj savjet')
        .fill('Visoke biljke po potrebi podupri.');
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.getByText('Pokušaj ponovno.')).toBeVisible();
    await expect(page.getByLabel('Tvoj savjet')).toHaveValue(
        'Visoke biljke po potrebi podupri.',
    );
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.getByText('Prijedlog #45 je poslan')).toBeVisible();
    expect(submittedBody).toEqual({
        kind: 'plantTip',
        parentPlantId: 7,
        name: 'Zaštita od vjetra',
        description: 'Visoke biljke po potrebi podupri.',
        source: null,
        note: null,
        publicPath: '/biljke/bob',
    });
});

for (const kind of ['disease', 'pest']) {
    test(`submits ${kind} for the current plant and retains its default after reopening`, async ({
        mount,
        page,
    }) => {
        let submittedBody: unknown;
        await page.route(
            '**/api/gredice/api/directories/community-edits/entity-suggestions',
            async (route) => {
                submittedBody = route.request().postDataJSON();
                await route.fulfill({
                    status: 201,
                    json: { requestId: 46, status: 'pending_admin_approval' },
                });
            },
        );
        await mount(<PlantCommunitySuggestionsHarness />);
        const trigger = page.getByRole('button', {
            name:
                kind === 'disease'
                    ? 'Predloži novu bolest'
                    : 'Predloži novog štetnika',
        });
        await trigger.click();
        await expect(
            page.getByRole('button', { name: 'Ukloni biljku Bob' }),
        ).toBeVisible();
        await page
            .getByLabel(kind === 'disease' ? 'Naziv bolesti' : 'Naziv štetnika')
            .fill('Novi problem');
        await page
            .getByLabel(
                kind === 'disease'
                    ? 'Kratki opis bolesti'
                    : 'Kratki opis štetnika',
            )
            .fill('Opis problema.');
        await page
            .getByLabel('Simptomi')
            .fill('Vidljivi znakovi na listovima.');
        await page.getByLabel('Uvjeti pojave').fill('Toplo i vlažno vrijeme.');
        await page.getByRole('button', { name: 'Pošalji' }).click();
        await expect(page.getByText('Prijedlog #46 je poslan')).toBeVisible();
        expect(submittedBody).toMatchObject({
            kind,
            affectedPlantIds: [7],
            publicPath: '/biljke/bob',
        });
        await page.keyboard.press('Escape');
        await trigger.click();
        await expect(
            page.getByRole('button', { name: 'Ukloni biljku Bob' }),
        ).toBeVisible();
        await expect(
            page.getByLabel(
                kind === 'disease' ? 'Naziv bolesti' : 'Naziv štetnika',
            ),
        ).toHaveValue('');
    });
}

test('tip suggestions require sign-in', async ({ mount, page }) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );
    await mount(<PlantCommunitySuggestionsHarness />);
    await page.getByRole('button', { name: 'Predloži novi savjet' }).click();
    await expect(
        page.getByText('Za slanje prijedloga treba se prijaviti.'),
    ).toBeVisible();
    await expect(page.getByLabel('Naslov savjeta')).toHaveCount(0);
});

for (const width of [375, 1280]) {
    test(`populated sections retain their content and compact suggestions at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(<PlantCommunitySuggestionsHarness populated />);
        await expect(
            page.getByRole('heading', { name: 'Zaštita od vjetra' }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: /Čokoladna pjegavost boba/ }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: /Lisne uši/ }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Predloži nov/ }),
        ).toHaveCount(3);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.screenshot({
            path: testInfo.outputPath('suggestions.png'),
            fullPage: true,
        });
    });
}
