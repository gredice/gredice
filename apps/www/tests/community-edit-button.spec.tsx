import type { Page } from '@playwright/test';
import { CommunityEditButtonHarness } from './CommunityEditButtonHarness';
import { expect, test } from './component-fixtures';
import '../app/globals.css';

for (const width of [375, 1280]) {
    test(`loads editing on demand and restores keyboard focus at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        let authRequests = 0;
        await page.route('**/api/gredice/api/auth/current-claims', (route) => {
            authRequests += 1;
            return route.fulfill({
                status: 401,
                json: { error: 'Unauthorized' },
            });
        });
        await mount(
            <CommunityEditButtonHarness
                entityTypeName="plant"
                entityId={1}
                publicPath="/biljke/rajcica"
                sectionKey="overview"
            />,
        );

        const trigger = page.getByTitle('Predloži izmjenu', { exact: true });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(authRequests).toBe(0);
        for (let attempt = 0; attempt < 2; attempt += 1) {
            await trigger.focus();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('dialog')).toHaveCount(1);
            await expect(
                page.getByRole('heading', { name: 'Prijava u Gredice' }),
            ).toBeVisible();
            await expect(trigger).toHaveAttribute('aria-expanded', 'true');
            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(trigger).toBeFocused();
        }
    });
}

test('reopens the matching edit dialog after an OAuth return', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
    await page.evaluate(() => {
        window.history.replaceState(
            window.history.state,
            '',
            '?communityEditEntity=plant%3A1&communityEditSection=overview&keep=1#rast',
        );
    });
    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="overview"
        />,
    );

    await expect(
        page.getByRole('heading', { name: 'Prijava u Gredice' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\?keep=1#rast$/u);
});

test('opens only the sign-in dialog for anonymous users', async ({
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
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="overview"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();

    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toContainText(
        'Za slanje prijedloga treba se prijaviti.',
    );
    await expect(
        page.getByRole('button', { name: 'Prijavi se i nastavi' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Pošalji prijedlog' }),
    ).toHaveCount(0);
});

test('loads the same edit context after inline email login', async ({
    mount,
    page,
}) => {
    let authenticated = false;
    await page.route('**/api/gredice/api/auth/current-claims', (route) => {
        if (!authenticated) {
            return route.fulfill({
                status: 401,
                json: { error: 'Unauthorized' },
            });
        }

        return route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        });
    });
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );
    await page.route('**/api/gredice/api/auth/login', (route) => {
        authenticated = true;
        return route.fulfill({ status: 200, json: { ok: true } });
    });
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'overview',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.description',
                            sectionKey: 'overview',
                            attributeDefinitionId: 10,
                            attributeValueId: 20,
                            attributePath: 'information.description',
                            dataType: 'text',
                            controlType: 'text',
                            multiple: false,
                            publicLabel: 'Opis biljke',
                            currentValue: 'Stari opis',
                            baseValueHash: 'hash-1',
                        },
                    ],
                },
            }),
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="overview"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await page.locator('#inline-login-email').fill('ana@example.com');
    await page.locator('#inline-login-password').fill('tajna-lozinka');
    await page.getByRole('button', { name: 'Prijavi se' }).click();

    await expect(page.getByLabel('Opis biljke')).toHaveValue('Stari opis');
});

test('preserves the community edit context in OAuth return paths', async ({
    mount,
    page,
}) => {
    const authRequestPattern = 'http://localhost:3005/api/auth/google**';
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );
    await page.route(authRequestPattern, (route) =>
        route.fulfill({ status: 204 }),
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="overview"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    const authRequestPromise = page.waitForRequest(authRequestPattern);

    await page.getByRole('button', { name: 'Nastavi sa Google' }).click();

    const authRequest = await authRequestPromise;
    const authUrl = new URL(authRequest.url());
    const redirect = authUrl.searchParams.get('redirect');
    expect(redirect).not.toBeNull();

    if (!redirect) {
        throw new Error('Expected OAuth redirect query parameter.');
    }

    const returnTo = new URL(redirect).searchParams.get('returnTo');
    expect(returnTo).not.toBeNull();
    expect(returnTo).toContain('communityEditEntity=plant%3A1');
    expect(returnTo).toContain('communityEditSection=overview');
});

test('submits a changed section edit for authenticated users', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'overview',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.description',
                            sectionKey: 'overview',
                            attributeDefinitionId: 10,
                            attributeValueId: 20,
                            attributePath: 'information.description',
                            dataType: 'text',
                            controlType: 'text',
                            multiple: false,
                            publicLabel: 'Opis biljke',
                            helpText: 'Kratak opis.',
                            currentValue: 'Stari opis',
                            baseValueHash: 'hash-1',
                        },
                    ],
                },
            }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            const body = route.request().postDataJSON();
            expect(body).toMatchObject({
                entityTypeName: 'plant',
                entityId: 1,
                publicPath: '/biljke/rajcica',
                sectionKey: 'overview',
                changes: [
                    {
                        fieldKey: 'plant.description',
                        proposedValue: 'Novi opis',
                        baseValueHash: 'hash-1',
                    },
                ],
            });

            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 42,
                    requestStatus: 'pending',
                    changeCount: 1,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="overview"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await page.getByLabel('Opis biljke').fill('Novi opis');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #42')).toBeVisible();
});

test('submits multiple reference edits for plant relationships', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'relationships',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.relationships.companions',
                            sectionKey: 'relationships',
                            attributeDefinitionId: 30,
                            attributeValueId: 40,
                            attributePath: 'relationships.companions',
                            dataType: 'ref:plant',
                            controlType: 'reference',
                            multiple: true,
                            publicLabel: 'Dobri susjedi',
                            helpText: 'Odaberi jednu ili više biljaka.',
                            options: [
                                { value: '12', label: 'Bosiljak' },
                                { value: '34', label: 'Kadifica' },
                                { value: '56', label: 'Mrkva' },
                                { value: '78', label: 'Krumpir' },
                            ],
                            currentValue: JSON.stringify(['12', '34']),
                            baseValueHash: 'hash-companions',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.relationships.antagonists',
                            sectionKey: 'relationships',
                            attributeDefinitionId: 31,
                            attributeValueId: null,
                            attributePath: 'relationships.antagonists',
                            dataType: 'ref:plant',
                            controlType: 'reference',
                            multiple: true,
                            publicLabel: 'Izbjegavati blizinu',
                            helpText: 'Odaberi jednu ili više biljaka.',
                            options: [
                                { value: '12', label: 'Bosiljak' },
                                { value: '34', label: 'Kadifica' },
                                { value: '56', label: 'Mrkva' },
                                { value: '78', label: 'Krumpir' },
                            ],
                            currentValue: '[]',
                            baseValueHash: 'hash-antagonists',
                        },
                    ],
                },
            }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            const body = route.request().postDataJSON();
            expect(body).toMatchObject({
                entityTypeName: 'plant',
                entityId: 1,
                publicPath: '/biljke/rajcica',
                sectionKey: 'relationships',
                changes: [
                    {
                        fieldKey: 'plant.relationships.companions',
                        proposedValue: ['12', '34', '56'],
                        baseValueHash: 'hash-companions',
                    },
                    {
                        fieldKey: 'plant.relationships.antagonists',
                        proposedValue: ['78'],
                        baseValueHash: 'hash-antagonists',
                    },
                ],
            });

            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 45,
                    requestStatus: 'pending',
                    changeCount: 2,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="relationships"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(
        page.getByRole('button', { name: 'Ukloni biljku Bosiljak' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Ukloni biljku Kadifica' }),
    ).toBeVisible();

    await page
        .getByRole('combobox', { name: 'Dodaj biljku — Dobri susjedi' })
        .click();
    await page
        .getByRole('dialog', { name: 'Dodaj biljku — Dobri susjedi' })
        .getByPlaceholder('Pretraži biljke...')
        .fill('mrk');
    await page.getByRole('option', { name: 'Mrkva' }).click();

    await page
        .getByRole('combobox', {
            name: 'Dodaj biljku — Izbjegavati blizinu',
        })
        .click();
    await page
        .getByRole('dialog', { name: 'Dodaj biljku — Izbjegavati blizinu' })
        .getByPlaceholder('Pretraži biljke...')
        .fill('krump');
    await page.getByRole('option', { name: 'Krumpir' }).click();
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #45')).toBeVisible();
});

test('shows storage content and operation suggestions in the edit modal', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'storage',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.storage',
                            sectionKey: 'storage',
                            attributeDefinitionId: 12,
                            attributeValueId: 22,
                            attributePath: 'information.storage',
                            dataType: 'markdown',
                            controlType: 'text',
                            multiple: false,
                            publicLabel: 'Skladištenje',
                            helpText: 'Savjeti za čuvanje nakon berbe.',
                            currentValue: 'Čuvati na hladnom.',
                            baseValueHash: 'hash-storage',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.stage-operations.storage',
                            sectionKey: 'storage',
                            attributeDefinitionId: 13,
                            attributeValueId: null,
                            attributePath: 'information.operations',
                            dataType: 'ref:operation',
                            controlType: 'operationSuggestion',
                            multiple: true,
                            publicLabel: 'Radnje: Skladištenje',
                            helpText:
                                'Predloži dodavanje ili uklanjanje radnje.',
                            operationSuggestionStage: {
                                name: 'storage',
                                label: 'Skladištenje',
                            },
                            currentValue: '[]',
                            baseValueHash: 'hash-operations',
                            options: [
                                {
                                    value: '987',
                                    label: 'Uklanjanje biljke',
                                    description:
                                        'Uklanjanje cijele biljke iz gredice.',
                                    iconKey: 'storage',
                                },
                            ],
                        },
                    ],
                },
            }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            const body = route.request().postDataJSON();
            expect(body).toMatchObject({
                entityTypeName: 'plant',
                entityId: 1,
                publicPath: '/biljke/blitva',
                sectionKey: 'storage',
                changes: [
                    {
                        fieldKey: 'plant.storage',
                        proposedValue: 'Zamotati u vlažnu krpu.',
                        baseValueHash: 'hash-storage',
                    },
                    {
                        fieldKey: 'plant.stage-operations.storage',
                        proposedValue: {
                            intent: 'add',
                            operationMode: 'existing',
                            operationId: 987,
                            stageName: 'storage',
                            source: 'Terenska bilješka',
                            note: 'Radnja pripada skladištenju.',
                        },
                        baseValueHash: 'hash-operations',
                    },
                ],
            });

            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 44,
                    requestStatus: 'pending',
                    changeCount: 2,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/blitva"
            sectionKey="storage"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(
        page.getByText('Ova sekcija trenutno nema javno uređivih polja.'),
    ).toHaveCount(0);
    await expect(page.getByText('Radnje: Skladištenje')).toBeVisible();
    await expect(page.getByText('Trenutne radnje')).toBeVisible();

    const dialogBackground = await page
        .getByRole('dialog')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    const fieldBackground = await page
        .getByLabel('Skladištenje')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(fieldBackground).not.toBe(dialogBackground);
    await expect(
        page.getByLabel('Izvor za radnju (opcionalno)').locator('..'),
    ).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.getByRole('combobox', { name: /Radnja/u })).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
    );

    await page.getByLabel('Skladištenje').fill('Zamotati u vlažnu krpu.');
    await page.getByRole('combobox', { name: /Radnja/u }).selectOption('987');
    await expect(
        page.getByText('Uklanjanje cijele biljke iz gredice.'),
    ).toBeVisible();
    await page
        .getByLabel('Izvor za radnju (opcionalno)')
        .fill('Terenska bilješka');
    await page
        .getByRole('textbox', { name: 'Napomena uz radnju (opcionalno)' })
        .fill('Radnja pripada skladištenju.');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #44')).toBeVisible();
});

test('submits operation removal suggestions from current operation cards', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'storage',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.stage-operations.storage',
                            sectionKey: 'storage',
                            attributeDefinitionId: 13,
                            attributeValueId: null,
                            attributePath: 'information.operations',
                            dataType: 'ref:operation',
                            controlType: 'operationSuggestion',
                            multiple: true,
                            publicLabel: 'Radnje: Skladištenje',
                            operationSuggestionStage: {
                                name: 'storage',
                                label: 'Skladištenje',
                            },
                            currentValue: JSON.stringify(['987']),
                            baseValueHash: 'hash-operations',
                            options: [
                                {
                                    value: '987',
                                    label: 'Uklanjanje biljke',
                                    description:
                                        'Uklanjanje cijele biljke iz gredice.',
                                    iconKey: 'storage',
                                },
                            ],
                        },
                    ],
                },
            }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            const body = route.request().postDataJSON();
            expect(body).toMatchObject({
                entityTypeName: 'plant',
                entityId: 1,
                publicPath: '/biljke/blitva',
                sectionKey: 'storage',
                changes: [
                    {
                        fieldKey: 'plant.stage-operations.storage',
                        proposedValue: {
                            intent: 'remove',
                            operationMode: 'existing',
                            operationId: 987,
                            stageName: 'storage',
                            source: null,
                            note: 'Ne treba se prikazivati u skladištenju.',
                        },
                        baseValueHash: 'hash-operations',
                    },
                ],
            });

            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 46,
                    requestStatus: 'pending',
                    changeCount: 1,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/blitva"
            sectionKey="storage"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.getByText('Uklanjanje biljke')).toBeVisible();
    await expect(
        page.getByText('Uklanjanje cijele biljke iz gredice.'),
    ).toBeVisible();

    await page.getByRole('button', { name: /Ukloni/u }).click();
    await expect(page.getByText(/Prijedlog će tražiti/u)).toBeVisible();
    await page
        .getByRole('textbox', { name: 'Napomena uz radnju (opcionalno)' })
        .fill('Ne treba se prikazivati u skladištenju.');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #46')).toBeVisible();
});

test('submits new operation suggestions with name and expectation', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'watering',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.stage-operations.watering',
                            sectionKey: 'watering',
                            attributeDefinitionId: 13,
                            attributeValueId: null,
                            attributePath: 'information.operations',
                            dataType: 'ref:operation',
                            controlType: 'operationSuggestion',
                            multiple: true,
                            publicLabel: 'Radnje: Zalijevanje',
                            operationSuggestionStage: {
                                name: 'watering',
                                label: 'Zalijevanje',
                            },
                            currentValue: '[]',
                            baseValueHash: 'hash-operations',
                            options: [],
                        },
                    ],
                },
            }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            const body = route.request().postDataJSON();
            expect(body).toMatchObject({
                entityTypeName: 'plant',
                entityId: 1,
                publicPath: '/biljke/blitva',
                sectionKey: 'watering',
                changes: [
                    {
                        fieldKey: 'plant.stage-operations.watering',
                        proposedValue: {
                            intent: 'add',
                            operationMode: 'new',
                            stageName: 'watering',
                            newOperationName: 'Provjera vlage supstrata',
                            newOperationDescription:
                                'Korisnik očekuje podsjetnik za provjeru vlage prije zalijevanja.',
                            source: null,
                            note: 'Nema odgovarajuće postojeće radnje.',
                        },
                        baseValueHash: 'hash-operations',
                    },
                ],
            });

            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 47,
                    requestStatus: 'pending',
                    changeCount: 1,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/blitva"
            sectionKey="watering"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await page.getByText('Nova radnja', { exact: true }).click();
    await page.getByLabel('Naziv nove radnje').fill('Provjera vlage supstrata');
    await page
        .getByLabel('Što očekuješ od radnje?')
        .fill(
            'Korisnik očekuje podsjetnik za provjeru vlage prije zalijevanja.',
        );
    await page
        .getByRole('textbox', { name: 'Napomena uz radnju (opcionalno)' })
        .fill('Nema odgovarajuće postojeće radnje.');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #47')).toBeVisible();
});

test('submits select field edits for authenticated users', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'growth',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.light',
                            sectionKey: 'growth',
                            attributeDefinitionId: 11,
                            attributeValueId: 21,
                            attributePath: 'attributes.light',
                            dataType: 'number',
                            controlType: 'select',
                            multiple: false,
                            publicLabel: 'Svjetlost',
                            currentValue: '1',
                            baseValueHash: 'hash-2',
                            options: [
                                { value: '1', label: 'Sunce' },
                                { value: '0.5', label: 'Polu-sjena' },
                                { value: '0', label: 'Hlad' },
                            ],
                        },
                    ],
                },
            }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            const body = route.request().postDataJSON();
            expect(body).toMatchObject({
                entityTypeName: 'plant',
                entityId: 1,
                publicPath: '/biljke/rajcica',
                sectionKey: 'growth',
                changes: [
                    {
                        fieldKey: 'plant.light',
                        proposedValue: '0.5',
                        baseValueHash: 'hash-2',
                    },
                ],
            });

            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 43,
                    requestStatus: 'pending',
                    changeCount: 1,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="growth"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await page.getByLabel('Svjetlost').selectOption('0.5');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #43')).toBeVisible();
});

test('organizes harvest edit fields into grouped sections with attribute icons', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
    await page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'harvest',
                    fields: [
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.harvest',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 10,
                            attributeValueId: 20,
                            attributePath: 'information.harvest',
                            dataType: 'markdown',
                            controlType: 'text',
                            multiple: false,
                            publicLabel: 'Berba',
                            currentValue: 'Berba počinje nakon sijanja.',
                            baseValueHash: 'hash-harvest',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.harvest-window-min',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 11,
                            attributeValueId: 21,
                            attributePath: 'attributes.harvestWindowMin',
                            dataType: 'number',
                            controlType: 'number',
                            multiple: false,
                            publicLabel: 'Najranija berba',
                            helpText: 'Vrijednost u danima.',
                            currentValue: '30',
                            baseValueHash: 'hash-harvest-min',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.harvest-window-max',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 12,
                            attributeValueId: 22,
                            attributePath: 'attributes.harvestWindowMax',
                            dataType: 'number',
                            controlType: 'number',
                            multiple: false,
                            publicLabel: 'Najkasnija berba',
                            helpText: 'Vrijednost u danima.',
                            currentValue: '60',
                            baseValueHash: 'hash-harvest-max',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.yield-min',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 13,
                            attributeValueId: 23,
                            attributePath: 'attributes.yieldMin',
                            dataType: 'number',
                            controlType: 'number',
                            multiple: false,
                            publicLabel: 'Najmanji očekivani prinos',
                            helpText: 'Vrijednost u gramima.',
                            currentValue: '300',
                            baseValueHash: 'hash-yield-min',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.yield-max',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 14,
                            attributeValueId: 24,
                            attributePath: 'attributes.yieldMax',
                            dataType: 'number',
                            controlType: 'number',
                            multiple: false,
                            publicLabel: 'Najveći očekivani prinos',
                            helpText: 'Vrijednost u gramima.',
                            currentValue: '1500',
                            baseValueHash: 'hash-yield-max',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.yield-type',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 15,
                            attributeValueId: 25,
                            attributePath: 'attributes.yieldType',
                            dataType: 'text',
                            controlType: 'select',
                            multiple: false,
                            publicLabel: 'Mjera prinosa',
                            currentValue: 'perField',
                            baseValueHash: 'hash-yield-type',
                            options: [
                                { value: 'perField', label: 'Po polju' },
                                { value: 'perPlant', label: 'Po biljci' },
                            ],
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.clean-harvest',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 16,
                            attributeValueId: 26,
                            attributePath: 'attributes.cleanHarvest',
                            dataType: 'boolean',
                            controlType: 'boolean',
                            multiple: false,
                            publicLabel: 'Uklanjanje biljke nakon berbe',
                            currentValue: 'false',
                            baseValueHash: 'hash-clean-harvest',
                        },
                        {
                            entityTypeName: 'plant',
                            entityId: 1,
                            fieldKey: 'plant.stage-operations.harvest',
                            sectionKey: 'harvest',
                            attributeDefinitionId: 17,
                            attributeValueId: null,
                            attributePath: 'information.operations',
                            dataType: 'ref:operation',
                            controlType: 'operationSuggestion',
                            multiple: true,
                            publicLabel: 'Radnje: Berba',
                            operationSuggestionStage: {
                                name: 'harvest',
                                label: 'Berba',
                            },
                            currentValue: '[]',
                            baseValueHash: 'hash-harvest-operations',
                            options: [
                                {
                                    value: '987',
                                    label: 'Branje zrelih plodova',
                                },
                            ],
                        },
                    ],
                },
            }),
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/blitva"
            sectionKey="harvest"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.getByText('Sadržaj', { exact: true })).toBeVisible();
    await expect(page.getByText('Svojstva', { exact: true })).toBeVisible();
    await expect(page.getByText('Radnje', { exact: true })).toBeVisible();

    const visibleGroups = await page
        .locator('[data-community-edit-group]')
        .evaluateAll((elements) =>
            elements.map((element) =>
                element.getAttribute('data-community-edit-group'),
            ),
        );
    expect(visibleGroups).toEqual(['content', 'attributes', 'operations']);
    for (const input of await page.getByRole('spinbutton').all()) {
        await expect(input.locator('..')).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)',
        );
    }
    for (const select of await page.getByRole('combobox').all()) {
        await expect(select).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)',
        );
    }

    await expect(
        page.locator(
            '[data-community-edit-group="attributes"] [data-field-key]',
        ),
    ).toHaveCount(6);
    await expect(
        page.locator('[data-community-edit-group="attributes"] > div'),
    ).toHaveClass(/md:grid-cols-2/);

    for (const fieldKey of [
        'plant.harvest-window-min',
        'plant.harvest-window-max',
        'plant.yield-min',
        'plant.yield-max',
        'plant.yield-type',
        'plant.clean-harvest',
    ]) {
        await expect(
            page.locator(`[data-field-icon="${fieldKey}"] svg`),
        ).toHaveCount(1);
    }
});

function mockSignedInUser(page: Page) {
    return page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            status: 200,
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
            },
        }),
    );
}

function mockSowingFields(page: Page, fields: Record<string, unknown>[]) {
    return page.route(
        '**/api/gredice/api/directories/community-edits/entities/plant/1/fields**',
        (route) =>
            route.fulfill({
                status: 200,
                json: {
                    entityTypeName: 'plant',
                    entityId: 1,
                    sectionKey: 'sowing',
                    fields: fields.map((field) => ({
                        entityTypeName: 'plant',
                        entityId: 1,
                        sectionKey: 'sowing',
                        attributeValueId: null,
                        multiple: false,
                        ...field,
                    })),
                },
            }),
    );
}

const sowingDescriptionField = {
    fieldKey: 'plant.sowing',
    attributeDefinitionId: 10,
    attributePath: 'information.sowing',
    dataType: 'text',
    controlType: 'text',
    publicLabel: 'Opis faze',
    currentValue: 'Stari opis',
    baseValueHash: 'hash-sowing',
};

const sowingDepthField = {
    fieldKey: 'plant.seeding-depth',
    attributeDefinitionId: 11,
    attributePath: 'attributes.seedingDepth',
    dataType: 'number',
    controlType: 'number',
    publicLabel: 'Dubina sijanja',
    helpText: 'Vrijednost u centimetrima.',
    currentValue: '1',
    baseValueHash: 'hash-depth',
};

test('keeps the draft when the dialog is closed and reopened', async ({
    mount,
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockSignedInUser(page);
    await mockSowingFields(page, [sowingDescriptionField]);

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            entityName="Rajčica"
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
            sectionLabel="Sijanje"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.getByRole('dialog')).toContainText('Rajčica · Sijanje');
    await expect(page.getByRole('dialog')).toContainText(
        'Pregledamo svaki prijedlog prije objave i javimo ti ishod.',
    );
    const summary = page.locator('[data-community-edit-summary]');
    await expect(summary).toHaveText(
        'Promijeni barem jedno polje da pošalješ prijedlog.',
    );
    await expect(
        page.getByRole('button', { name: 'Pošalji prijedlog' }),
    ).toBeDisabled();

    await page.getByLabel('Opis faze').fill('Novi opis sijanja');
    await expect(summary).toHaveText('1 izmjena: Opis faze');
    await expect(page.getByText('Izmijenjeno')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByTitle('Predloži izmjenu').click();

    await expect(page.getByLabel('Opis faze')).toHaveValue('Novi opis sijanja');
    await expect(summary).toHaveText('1 izmjena: Opis faze');

    await page.getByRole('button', { name: 'Odustani' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.getByLabel('Opis faze')).toHaveValue('Novi opis sijanja');

    await page.getByRole('button', { name: 'Vrati – Opis faze' }).click();
    await expect(page.getByLabel('Opis faze')).toHaveValue('Stari opis');
    await expect(page.getByLabel('Opis faze')).toBeFocused();
    await expect(page.getByText('Izmijenjeno')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Pošalji prijedlog' }),
    ).toBeDisabled();
});

test('lists every change beside the send button and sends source and reason', async ({
    mount,
    page,
}) => {
    await mockSignedInUser(page);
    await mockSowingFields(page, [sowingDescriptionField, sowingDepthField]);
    let submittedBody: unknown;
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            submittedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 201,
                json: {
                    status: 'pending_admin_approval',
                    requestId: 50,
                    requestStatus: 'pending',
                    changeCount: 2,
                },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            entityName="Rajčica"
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
            sectionLabel="Sijanje"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await page.getByLabel('Opis faze').fill('Novi opis sijanja');
    await page.getByLabel('Dubina sijanja').fill('2');
    await expect(page.locator('[data-community-edit-summary]')).toHaveText(
        '2 izmjene: Opis faze, Dubina sijanja',
    );
    await expect(page.getByText('Objavljeno: 1')).toBeVisible();
    await page
        .getByLabel('Izvor (opcionalno)')
        .fill('Priručnik za vrtlare, str. 12');
    await page
        .getByLabel('Zašto predlažeš izmjenu? (opcionalno)')
        .fill('Sjeme niče ravnomjernije.');
    await page.getByRole('button', { name: 'Pošalji prijedlog' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    await expect(page.getByText('Prijedlog #50 · 2 izmjene')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(
        'Ishod ti stiže kao obavijest.',
    );
    await expect(
        page.getByRole('link', { name: 'Moji prijedlozi' }),
    ).toHaveAttribute('href', '/moji-prijedlozi');
    expect(submittedBody).toEqual({
        entityTypeName: 'plant',
        entityId: 1,
        publicPath: '/biljke/rajcica',
        sectionKey: 'sowing',
        submitterNote:
            'Izvor: Priručnik za vrtlare, str. 12\n\nSjeme niče ravnomjernije.',
        changes: [
            {
                fieldKey: 'plant.sowing',
                proposedValue: 'Novi opis sijanja',
                baseValueHash: 'hash-sowing',
            },
            {
                fieldKey: 'plant.seeding-depth',
                proposedValue: '2',
                baseValueHash: 'hash-depth',
            },
        ],
    });

    // The footer action and the dialog's corner button both close it.
    await page.getByRole('button', { name: 'Zatvori' }).first().click();
    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.getByLabel('Opis faze')).toHaveValue('Stari opis');
});

test('does not send a range until both ends are valid', async ({
    mount,
    page,
}) => {
    await mockSignedInUser(page);
    await mockSowingFields(page, [
        {
            fieldKey: 'plant.seeding-distance-range',
            attributeDefinitionId: 12,
            attributePath: 'attributes.seedingDistanceRange',
            dataType: 'json',
            controlType: 'range',
            publicLabel: 'Razmak sijanja',
            currentValue: JSON.stringify({ min: 20, max: 30 }),
            baseValueHash: 'hash-range',
        },
    ]);
    let submittedBody: unknown;
    await page.route(
        '**/api/gredice/api/directories/community-edits',
        async (route) => {
            submittedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 201,
                json: { status: 'pending_admin_approval', requestId: 51 },
            });
        },
    );

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    const send = page.getByRole('button', { name: 'Pošalji prijedlog' });
    const summary = page.locator('[data-community-edit-summary]');

    await page.getByLabel('Najmanje').fill('40');
    await expect(
        page.getByText('Najmanja vrijednost ne može biti veća od najveće.'),
    ).toBeVisible();
    await expect(summary).toHaveText('Ispravi označena polja prije slanja.');
    await expect(send).toBeDisabled();

    await page.getByLabel('Najviše').fill('');
    await expect(
        page.getByText('Upiši i najmanju i najveću vrijednost.'),
    ).toBeVisible();
    await expect(send).toBeDisabled();

    await page.getByLabel('Najviše').fill('50');
    await expect(summary).toHaveText('1 izmjena: Razmak sijanja');
    await send.click();

    await expect(
        page.getByRole('heading', { name: 'Prijedlog je poslan' }),
    ).toBeVisible();
    expect(submittedBody).toMatchObject({
        changes: [
            {
                fieldKey: 'plant.seeding-distance-range',
                proposedValue: { min: 40, max: 50 },
                baseValueHash: 'hash-range',
            },
        ],
    });
});

test('shows a notice instead of raw ID and JSON inputs', async ({
    mount,
    page,
}) => {
    await mockSignedInUser(page);
    await mockSowingFields(page, [
        {
            fieldKey: 'plant.reference',
            attributeDefinitionId: 13,
            attributePath: 'information.reference',
            dataType: 'ref:plant',
            controlType: 'reference',
            publicLabel: 'Povezani zapis',
            currentValue: '12',
            baseValueHash: 'hash-reference',
        },
        {
            fieldKey: 'plant.references',
            attributeDefinitionId: 14,
            attributePath: 'information.references',
            dataType: 'ref:plant',
            controlType: 'reference',
            multiple: true,
            publicLabel: 'Povezani zapisi',
            currentValue: JSON.stringify(['12', '34']),
            baseValueHash: 'hash-references',
        },
        {
            fieldKey: 'plant.calendar',
            attributeDefinitionId: 15,
            attributePath: 'information.calendar',
            dataType: 'json',
            controlType: 'json',
            publicLabel: 'Kalendar',
            currentValue: '{"sowing":[3,4]}',
            baseValueHash: 'hash-calendar',
        },
    ]);

    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(
        page.getByText('Ovo polje trenutno nije moguće uređivati ovdje.'),
    ).toHaveCount(3);
    await expect(page.getByPlaceholder('Npr. 12, 34, 56')).toHaveCount(0);
    await expect(page.locator('[data-field-key] textarea')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Pošalji prijedlog' }),
    ).toBeDisabled();
});

test('names the next badge from the accepted suggestion count', async ({
    mount,
    page,
}) => {
    await mockSignedInUser(page);
    await mockSowingFields(page, [sowingDescriptionField]);
    let acceptedCount = 0;
    await page.route(
        '**/api/gredice/api/directories/community-edits/mine',
        (route) =>
            route.fulfill({
                status: 200,
                json: { acceptedCount, items: [] },
            }),
    );

    const component = await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
        />,
    );

    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.locator('[data-community-reward-hint]')).toHaveText(
        'Tvoj prvi prihvaćeni prijedlog donosi značku Prvi doprinos i 100 suncokreta.',
    );

    acceptedCount = 3;
    await component.unmount();
    await mount(
        <CommunityEditButtonHarness
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
        />,
    );
    await page.getByTitle('Predloži izmjenu').click();
    await expect(page.locator('[data-community-reward-hint]')).toHaveText(
        'Još 2 prihvaćena prijedloga do značke Pouzdani urednik i 250 suncokreta.',
    );
});

test('offers the trigger as a plain text button and as a card', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <CommunityEditButtonHarness
            buttonStyle="plain"
            entityTypeName="plant"
            entityId={1}
            publicPath="/biljke/rajcica"
            sectionKey="sowing"
        />,
    );
    const plain = page.getByRole('button', { name: 'Predloži izmjenu' });
    await expect(plain).toBeVisible();
    await expect(plain).toHaveText('Predloži izmjenu');
    await expect(plain).toHaveCSS('border-top-width', '0px');

    await component.unmount();
    await mount(
        <CommunityEditButtonHarness
            buttonStyle="card"
            entityTypeName="plant"
            entityId={1}
            label="Predloži dobrog susjeda"
            publicPath="/biljke/rajcica"
            sectionKey="relationships"
        />,
    );
    const card = page.getByRole('button', {
        name: 'Predloži dobrog susjeda',
    });
    await expect(card).toHaveCSS('border-top-style', 'dashed');
    await expect(card).toHaveAttribute('aria-haspopup', 'dialog');
});

for (const width of [375, 1280]) {
    test(`keeps the send button in view while a long form scrolls at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 700 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mockSignedInUser(page);
        await mockSowingFields(
            page,
            Array.from({ length: 8 }, (_, index) => ({
                ...sowingDescriptionField,
                fieldKey: `plant.sowing-${index.toString()}`,
                publicLabel: `Opis faze ${(index + 1).toString()}`,
                baseValueHash: `hash-sowing-${index.toString()}`,
            })),
        );

        await mount(
            <CommunityEditButtonHarness
                entityTypeName="plant"
                entityId={1}
                entityName="Rajčica"
                publicPath="/biljke/rajcica"
                sectionKey="sowing"
                sectionLabel="Sijanje"
            />,
        );

        await page.getByTitle('Predloži izmjenu').click();
        const send = page.getByRole('button', { name: 'Pošalji prijedlog' });
        await page.getByLabel('Opis faze 1').fill('Novi opis');
        await expect(send).toBeInViewport({ ratio: 1 });
        await expect(page.getByLabel('Opis faze 8')).not.toBeInViewport();
        await page.screenshot({
            path: testInfo.outputPath('edit-dialog-top.png'),
        });

        await page.getByLabel('Opis faze 8').scrollIntoViewIfNeeded();
        await expect(page.getByLabel('Opis faze 8')).toBeInViewport();
        await expect(send).toBeInViewport({ ratio: 1 });
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
            path: testInfo.outputPath('edit-dialog-scrolled.png'),
        });
    });
}
