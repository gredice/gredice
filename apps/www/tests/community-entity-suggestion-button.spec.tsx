import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { PlantHealthIssueOperations } from '../components/plant-health/PlantHealthIssueOperations';
import { CommunityEntitySuggestionButtonHarness } from './CommunityEntitySuggestionButtonHarness';
import '../app/globals.css';

function mockAuthenticatedUser(page: Page) {
    return page.route('**/api/gredice/api/auth/current-claims', (route) =>
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
}

test('submits a new plant sort suggestion for the current plant', async ({
    mount,
    page,
}) => {
    await mockAuthenticatedUser(page);
    let submittedBody: unknown;
    await page.route(
        '**/api/gredice/api/directories/community-edits/entity-suggestions',
        async (route) => {
            submittedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 201,
                json: { requestId: 42, status: 'pending_admin_approval' },
            });
        },
    );

    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="plantSort"
            parentPlantId={7}
            parentPlantName="Blitva"
            publicPath="/biljke/blitva"
        />,
    );

    await page.getByRole('button', { name: 'Predloži novu sortu' }).click();
    await expect(page.getByText('Biljka: Blitva')).toBeVisible();
    await page.getByLabel('Naziv sorte').fill('Blitva rubin');
    await page
        .getByLabel('Po čemu je sorta posebna?')
        .fill('Sorta s izraženim crvenim peteljkama.');
    await page
        .getByLabel('Izvor ili poveznica (opcionalno)')
        .fill('https://example.com/blitva-rubin');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(page.getByText('Prijedlog #42 je poslan')).toBeVisible();
    expect(submittedBody).toEqual({
        kind: 'plantSort',
        parentPlantId: 7,
        name: 'Blitva rubin',
        description: 'Sorta s izraženim crvenim peteljkama.',
        source: 'https://example.com/blitva-rubin',
        note: null,
        publicPath: '/biljke/blitva',
    });
});

test('submits a new operation with stage and application', async ({
    mount,
    page,
}) => {
    await mockAuthenticatedUser(page);
    let submittedBody: unknown;
    await page.route(
        '**/api/gredice/api/directories/community-edits/entity-suggestions',
        async (route) => {
            submittedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 201,
                json: { requestId: 43, status: 'pending_admin_approval' },
            });
        },
    );

    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="operation"
            publicPath="/radnje"
            stages={[
                { id: 10, label: 'Održavanje' },
                { id: 11, label: 'Zalijevanje' },
            ]}
        />,
    );

    await page.getByRole('button', { name: 'Predloži novu radnju' }).click();
    await page.getByLabel('Stadij biljke').selectOption('10');
    await page.getByLabel('Primjena').selectOption('raisedBedFull');
    await page.getByLabel('Naziv radnje').fill('Provjera drenaže');
    await page
        .getByLabel('Što se radnjom radi?')
        .fill('Provjeriti odvodi li se višak vode iz cijele gredice.');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(page.getByText('Prijedlog #43 je poslan')).toBeVisible();
    expect(submittedBody).toEqual({
        kind: 'operation',
        plantStageId: 10,
        application: 'raisedBedFull',
        name: 'Provjera drenaže',
        description: 'Provjeriti odvodi li se višak vode iz cijele gredice.',
        source: null,
        note: null,
        publicPath: '/radnje',
    });
});

test('submits a new disease with named affected plants', async ({
    mount,
    page,
}) => {
    await mockAuthenticatedUser(page);
    let submittedBody: unknown;
    await page.route(
        '**/api/gredice/api/directories/community-edits/entity-suggestions',
        async (route) => {
            submittedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 201,
                json: { requestId: 44, status: 'pending_admin_approval' },
            });
        },
    );

    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="disease"
            plants={[
                { value: '7', label: 'Blitva' },
                { value: '11', label: 'Špinat' },
            ]}
            publicPath="/bolesti"
        />,
    );

    await page.getByRole('button', { name: 'Predloži novu bolest' }).click();
    await page
        .getByRole('combobox', {
            name: 'Dodaj biljku — Pogođene biljke',
        })
        .click();
    await page.getByPlaceholder('Pretraži biljke...').fill('blit');
    await page.getByRole('option', { name: 'Blitva' }).click();
    await page.getByLabel('Naziv bolesti').fill('Nova pjegavost blitve');
    await page
        .getByLabel('Kratki opis bolesti')
        .fill('Bolest koja stvara sitne pjege na listovima.');
    await page
        .getByLabel('Simptomi')
        .fill('Sitne tamne pjege i postupno žućenje listova.');
    await page
        .getByLabel('Uvjeti pojave')
        .fill('Dugotrajno vlažno i toplo vrijeme.');
    await page.getByLabel('Ozbiljnost (opcionalno)').fill('Srednje');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(page.getByText('Prijedlog #44 je poslan')).toBeVisible();
    expect(submittedBody).toEqual({
        kind: 'disease',
        affectedPlantIds: [7],
        name: 'Nova pjegavost blitve',
        description: 'Bolest koja stvara sitne pjege na listovima.',
        symptoms: 'Sitne tamne pjege i postupno žućenje listova.',
        favorableConditions: 'Dugotrajno vlažno i toplo vrijeme.',
        severity: 'Srednje',
        source: null,
        note: null,
        publicPath: '/bolesti',
    });
});

test('shows a placeholder when there are no recommended operations', async ({
    mount,
    page,
}) => {
    await mount(<PlantHealthIssueOperations operations={null} />);

    await expect(
        page.getByText('Trenutno nema preporučenih radnji.'),
    ).toBeVisible();
});

test('requires sign-in before opening a suggestion form', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );

    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="plantSort"
            parentPlantId={7}
            parentPlantName="Blitva"
            publicPath="/biljke/blitva"
        />,
    );

    await page.getByRole('button', { name: 'Predloži novu sortu' }).click();
    await expect(
        page.getByText('Za slanje prijedloga treba se prijaviti.'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Prijavi se i nastavi' }),
    ).toBeVisible();
});
