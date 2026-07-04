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
