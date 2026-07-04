import { expect, test } from '@playwright/experimental-ct-react';
import { CommunityEditButtonHarness } from './CommunityEditButtonHarness';
import '../app/globals.css';

test('prompts anonymous users before editing', async ({ mount, page }) => {
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
        page.getByText('Za slanje prijedloga treba se prijaviti.'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Prijavi se i nastavi' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Prijavi se u vrt' }),
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
    await page.getByRole('button', { name: 'Prijavi se i nastavi' }).click();
    await expect(
        page.getByRole('button', { name: 'Google prijava' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Email prijava' }).click();
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
    await page.getByRole('button', { name: 'Prijavi se i nastavi' }).click();
    const authRequestPromise = page.waitForRequest(authRequestPattern);

    await page.getByRole('button', { name: 'Google prijava' }).click();

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
        page.getByText('Prijedlog #42 je poslan na odobrenje.'),
    ).toBeVisible();
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
                            helpText:
                                'ID-jeve biljaka unesi odvojene zarezom ili svaki u novi red.',
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
    await expect(page.getByLabel('Dobri susjedi')).toHaveValue('12\n34');

    await page.getByLabel('Dobri susjedi').fill('12\n34\n56');
    await page.getByLabel('Izbjegavati blizinu').fill('78');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByText('Prijedlog #45 je poslan na odobrenje.'),
    ).toBeVisible();
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

    const dialogBackground = await page
        .getByRole('dialog')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    const fieldBackground = await page
        .getByLabel('Skladištenje')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(fieldBackground).not.toBe(dialogBackground);

    await page.getByLabel('Skladištenje').fill('Zamotati u vlažnu krpu.');
    await page.getByLabel('Radnja').selectOption('987');
    await page.getByLabel('Izvor').fill('Terenska bilješka');
    await page
        .getByRole('textbox', { name: 'Napomena', exact: true })
        .fill('Radnja pripada skladištenju.');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect(
        page.getByText('Prijedlog #44 je poslan na odobrenje.'),
    ).toBeVisible();
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
        page.getByText('Prijedlog #43 je poslan na odobrenje.'),
    ).toBeVisible();
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
