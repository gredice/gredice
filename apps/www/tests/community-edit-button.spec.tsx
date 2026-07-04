import { expect, test } from '@playwright/experimental-ct-react';
import { CommunityEditButtonHarness } from './CommunityEditButtonHarness';
import '../app/globals.css';

test('prompts anonymous users before editing', async ({ mount, page }) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
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
