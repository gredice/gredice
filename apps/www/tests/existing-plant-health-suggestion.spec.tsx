import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { CommunityEntitySuggestionButtonHarness } from './CommunityEntitySuggestionButtonHarness';
import '../app/globals.css';

async function mockIssues(
    page: Page,
    kind: 'disease' | 'pest',
    linked = false,
) {
    const entityType = kind === 'disease' ? 'plantDisease' : 'plantPest';
    await page.route(`**/api/directories/entities/${entityType}`, (route) =>
        route.fulfill({
            json: [
                {
                    id: 20,
                    information: { name: 'Već povezano' },
                    relationships: { affectedPlants: [{ id: 7 }] },
                },
                {
                    id: 21,
                    information: {
                        name: 'Postojeći problem',
                        shortDescription: 'Prepoznatljiv opis problema.',
                    },
                    relationships: {
                        affectedPlants: [{ id: linked ? 7 : 11 }],
                    },
                },
            ],
        }),
    );
    await page.route(
        `**/community-edits/entities/${entityType}/21/fields**`,
        (route) =>
            route.fulfill({
                json: {
                    fields: [
                        {
                            fieldKey: `${entityType}.affected-plants`,
                            currentValue: '["11","12"]',
                            baseValueHash: 'latest-hash',
                        },
                    ],
                },
            }),
    );
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
                role: 'user',
            },
        }),
    );
});

for (const kind of ['disease', 'pest'] as const) {
    for (const sort of [false, true]) {
        test(`links an existing ${kind} from a ${sort ? 'sort' : 'plant'} with current relationships intact`, async ({
            mount,
            page,
        }, testInfo) => {
            await page.setViewportSize({
                width: sort ? 375 : 1280,
                height: 900,
            });
            await mockIssues(page, kind);
            const publicPath = sort
                ? '/biljke/bamija/sorte/clemson'
                : '/biljke/bamija';
            let submittedBody: unknown;
            let newRecordRequests = 0;
            await page.route(
                '**/community-edits/entity-suggestions',
                (route) => {
                    newRecordRequests++;
                    return route.fulfill({ status: 500 });
                },
            );
            await page.route('**/api/directories/community-edits', (route) => {
                submittedBody = route.request().postDataJSON();
                return route.fulfill({ status: 201, json: { requestId: 70 } });
            });
            await mount(
                <CommunityEntitySuggestionButtonHarness
                    kind={kind}
                    plants={[{ value: '7', label: 'Bamija' }]}
                    defaultAffectedPlantId={7}
                    publicPath={publicPath}
                />,
            );
            await page
                .getByRole('button', {
                    name:
                        kind === 'disease'
                            ? 'Predloži bolest'
                            : 'Predloži štetnika',
                })
                .click();
            await expect(
                page.getByRole('radio', { name: 'Odaberi postojeće' }),
            ).toBeChecked();
            await expect(
                page.getByText(/Povezivanje s biljkom: Bamija/),
            ).toBeVisible();
            const picker = page.getByRole('combobox', {
                name:
                    kind === 'disease'
                        ? 'Postojeća bolest'
                        : 'Postojeći štetnik',
                exact: true,
            });
            await expect(picker).toHaveCSS(
                'background-color',
                'rgb(255, 255, 255)',
            );
            await expect(
                page.getByRole('button', { name: 'Pošalji' }),
            ).toBeDisabled();
            await picker.focus();
            await page.keyboard.press('Enter');
            await expect(
                page.getByRole('option', { name: 'Već povezano' }),
            ).toHaveCount(0);
            await page
                .getByPlaceholder(
                    kind === 'disease'
                        ? 'Pretraži bolesti...'
                        : 'Pretraži štetnike...',
                )
                .fill('Postojeći');
            expect(
                (
                    await new AxeBuilder({ page })
                        .include('[role="dialog"]')
                        .analyze()
                ).violations,
            ).toEqual([]);
            await page
                .getByRole('option', { name: 'Postojeći problem' })
                .click();
            await expect(
                page.getByText('Prepoznatljiv opis problema.'),
            ).toBeVisible();
            await page
                .getByLabel('Izvor ili poveznica (opcionalno)')
                .fill('https://example.com/izvor');
            await page
                .getByLabel('Napomena za administratora (opcionalno)')
                .fill('Uočeno na listovima.');
            expect(
                (
                    await new AxeBuilder({ page })
                        .include('[role="dialog"]')
                        .analyze()
                ).violations,
            ).toEqual([]);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(sort ? 375 : 1280);
            await page.screenshot({
                path: testInfo.outputPath('existing-suggestion.png'),
                fullPage: true,
            });
            await page.getByRole('button', { name: 'Pošalji' }).click();
            await expect(
                page.getByText('Prijedlog #70 je poslan'),
            ).toBeVisible();
            expect(submittedBody).toEqual({
                entityTypeName:
                    kind === 'disease' ? 'plantDisease' : 'plantPest',
                entityId: 21,
                publicPath,
                sectionKey: 'relationships',
                submitterNote:
                    'Izvor: https://example.com/izvor\n\nUočeno na listovima.',
                changes: [
                    {
                        fieldKey: `${kind === 'disease' ? 'plantDisease' : 'plantPest'}.affected-plants`,
                        proposedValue: ['11', '12', '7'],
                        baseValueHash: 'latest-hash',
                    },
                ],
            });
            expect(newRecordRequests).toBe(0);
        });
    }
}

test('recovers from catalogue and submission errors without losing the selected record or note', async ({
    mount,
    page,
}) => {
    await mockIssues(page, 'disease');
    await page.route(
        '**/api/directories/entities/plantDisease',
        (route) => route.fulfill({ status: 500 }),
        { times: 1 },
    );
    let attempts = 0;
    await page.route('**/api/directories/community-edits', (route) =>
        route.fulfill(
            ++attempts === 1
                ? {
                      status: 409,
                      json: {
                          message: 'Podaci su promijenjeni. Pokušaj ponovno.',
                      },
                  }
                : { status: 201, json: { requestId: 71 } },
        ),
    );
    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="disease"
            plants={[{ value: '7', label: 'Bamija' }]}
            defaultAffectedPlantId={7}
            publicPath="/biljke/bamija"
        />,
    );
    await page.getByRole('button', { name: 'Predloži bolest' }).click();
    await expect(
        page.getByText('Učitavanje postojećih zapisa nije uspjelo.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Postojeći problem' }).click();
    await page
        .getByLabel('Napomena za administratora (opcionalno)')
        .fill('Sačuvaj napomenu.');
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.getByRole('alert')).toHaveText(
        'Podaci su promijenjeni. Pokušaj ponovno.',
    );
    await expect(
        page.getByRole('combobox', { name: 'Postojeća bolest', exact: true }),
    ).toContainText('Postojeći problem');
    await expect(
        page.getByLabel('Napomena za administratora (opcionalno)'),
    ).toHaveValue('Sačuvaj napomenu.');
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.getByText('Prijedlog #71 je poslan')).toBeVisible();
});

test('empty choices allow a new suggestion with consistent input backgrounds', async ({
    mount,
    page,
}, testInfo) => {
    await mockIssues(page, 'disease', true);
    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="disease"
            plants={[
                { value: '7', label: 'Bamija' },
                { value: '11', label: 'Blitva' },
            ]}
            defaultAffectedPlantId={7}
            publicPath="/biljke/bamija"
        />,
    );
    await page.getByRole('button', { name: 'Predloži bolest' }).click();
    await expect(page.getByText(/Nema nepovezanih zapisa/)).toBeVisible();
    await page.getByRole('radio', { name: 'Predloži novu bolest' }).check();
    for (const label of [
        'Naziv bolesti',
        'Ozbiljnost (opcionalno)',
        'Izvor ili poveznica (opcionalno)',
    ]) {
        await expect(page.getByLabel(label).locator('..')).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)',
        );
    }
    await expect(page.getByRole('combobox')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
    );
    await expect(page.getByLabel('Kratki opis bolesti')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
    );
    await page.screenshot({
        path: testInfo.outputPath('new-suggestion.png'),
        fullPage: true,
    });
});

test('does not submit when the latest relationship already includes the plant', async ({
    mount,
    page,
}) => {
    await mockIssues(page, 'pest');
    await page.route(
        '**/community-edits/entities/plantPest/21/fields**',
        (route) =>
            route.fulfill({
                json: {
                    fields: [
                        {
                            fieldKey: 'plantPest.affected-plants',
                            currentValue: '["7","11"]',
                            baseValueHash: 'fresh-hash',
                        },
                    ],
                },
            }),
    );
    let submissions = 0;
    await page.route('**/api/directories/community-edits', (route) => {
        submissions++;
        return route.fulfill({ status: 201, json: { requestId: 1 } });
    });
    await mount(
        <CommunityEntitySuggestionButtonHarness
            kind="pest"
            plants={[{ value: '7', label: 'Bamija' }]}
            defaultAffectedPlantId={7}
            publicPath="/biljke/bamija"
        />,
    );
    await page.getByRole('button', { name: 'Predloži štetnika' }).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Postojeći problem' }).click();
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await expect(page.getByRole('alert')).toHaveText(
        'Odabrani zapis već je povezan s odabranim biljkama.',
    );
    expect(submissions).toBe(0);
});
