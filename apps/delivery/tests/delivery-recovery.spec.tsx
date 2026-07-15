import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { DeliveryCustomerRecovery } from '../components/DeliveryCustomerRecovery';
import { DeliveryExceptionSheetStory } from './DeliveryExceptionSheetStory';
import {
    DeliveryCustomerStopCardStory,
    DeliveryDriverTerminalStopCardStory,
    DeliveryStopCardStory,
} from './DeliveryStopCardStory';
import { duplicateIdentityStop } from './deliveryRecoveryFixtures';
import '../app/globals.css';

const reasonLabels = [
    'Korisnik nije dostupan',
    'Adresi se ne može prići',
    'Adresa je pogrešna',
    'Urod je oštećen',
    'Urod nedostaje',
    'Dostava je otkazana',
    'Drugi operativni problem',
];

async function openExceptionDialog(page: Page) {
    await page.getByRole('button', { name: 'Prijavi problem' }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Prijavi problem s dostavom',
    });
    await expect(dialog).toBeVisible();
    return dialog;
}

async function submissionBody(page: Page, index: number) {
    const body = await page
        .getByTestId(`delivery-exception-submission-${index}`)
        .textContent();
    if (!body) throw new Error(`Missing exception submission ${index}.`);
    return body;
}

test.describe('mobile bulk exception entry', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });

    test('requires a deliberate bulk selection and records a deferred subset', async ({
        mount,
        page,
    }) => {
        await mount(<DeliveryExceptionSheetStory />);
        const dialog = await openExceptionDialog(page);
        const harvests = dialog.getByRole('checkbox', {
            name: /Rajčica Roma|Bosiljak Genovese|Salata puterica/,
        });

        await expect(harvests).toHaveCount(3);
        for (let index = 0; index < 3; index += 1) {
            await expect(harvests.nth(index)).not.toBeChecked();
        }
        for (const label of reasonLabels) {
            await expect(
                dialog.getByRole('radio', { name: new RegExp(label) }),
            ).toBeVisible();
        }

        await dialog.getByRole('button', { name: 'Odaberi sve' }).tap();
        for (let index = 0; index < 3; index += 1) {
            await expect(harvests.nth(index)).toBeChecked();
        }
        await dialog.getByRole('button', { name: 'Poništi odabir' }).tap();
        await dialog.getByRole('checkbox', { name: /Rajčica Roma/ }).tap();
        await expect(
            dialog.getByRole('checkbox', { name: /Rajčica Roma/ }),
        ).toBeChecked();

        await dialog
            .getByRole('button', { name: 'Spremi i nastavi rutu' })
            .tap();
        const mutation = JSON.parse(await submissionBody(page, 0));
        expect(mutation).toMatchObject({
            expectedRouteRevision: 8,
            exceptions: [
                {
                    stopId: 101,
                    outcome: 'deferred',
                    reason: 'customer-unavailable',
                },
            ],
        });
        expect(mutation.clientOperationId).toEqual(expect.any(String));
        expect(mutation.occurredAt).toEqual(expect.any(String));
        await expect(dialog).toHaveCount(0);
    });
});

test('confirms the exact harvests before recording a failed bulk subset', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryExceptionSheetStory />);
    const dialog = await openExceptionDialog(page);
    await dialog.getByRole('checkbox', { name: /Rajčica Roma/ }).click();
    await dialog.getByRole('checkbox', { name: /Bosiljak Genovese/ }).click();
    await dialog
        .locator('label')
        .filter({ hasText: 'Završi bez dostave' })
        .click();

    const terminalSummary = dialog
        .getByText('Potvrdi završni ishod za 2 uroda')
        .locator('..');
    await expect(terminalSummary).toContainText(
        'Rajčica Roma · Gredica A · Ana Anić',
    );
    await expect(terminalSummary).toContainText(
        'Bosiljak Genovese · Gredica B · Borna Babić',
    );

    const confirmation = dialog.getByRole('checkbox', {
        name: 'Potvrđujem da samo navedeni urodi dobivaju završni ishod.',
    });
    await expect(confirmation).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Potvrdi završni ishod' }).click();
    await expect(
        dialog.getByRole('alert').filter({
            hasText: 'Potvrdi završni ishod za točno navedene urode',
        }),
    ).toBeVisible();

    await confirmation.click();
    await dialog.getByRole('button', { name: 'Potvrdi završni ishod' }).click();
    expect(JSON.parse(await submissionBody(page, 0))).toMatchObject({
        exceptions: [
            { stopId: 101, outcome: 'failed' },
            { stopId: 102, outcome: 'failed' },
        ],
    });
});

test('distinguishes duplicate harvest identities and targets exactly one stop', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryExceptionSheetStory stop={duplicateIdentityStop} />);
    const dialog = await openExceptionDialog(page);
    const firstIdentity =
        'Rajčica duplikat · Gredica Z · Iva Ista · trag duplicate-harvest-one-0001';
    const secondIdentity =
        'Rajčica duplikat · Gredica Z · Iva Ista · trag duplicate-harvest-two-0001';
    const firstHarvest = dialog.getByRole('checkbox', {
        name: firstIdentity,
        exact: true,
    });

    await expect(firstHarvest).toBeVisible();
    await expect(
        dialog.getByRole('checkbox', {
            name: secondIdentity,
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('link', {
            name: `Nazovi kontakt za ${firstIdentity}`,
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('link', {
            name: `Nazovi kontakt za ${secondIdentity}`,
            exact: true,
        }),
    ).toBeVisible();

    await firstHarvest.click();
    await dialog
        .locator('label')
        .filter({ hasText: 'Završi bez dostave' })
        .click();
    const confirmation = dialog
        .getByText('Potvrdi završni ishod za 1 urod')
        .locator('..');
    await expect(confirmation).toContainText(firstIdentity);
    await expect(confirmation).not.toContainText(secondIdentity);
    await dialog
        .getByRole('checkbox', {
            name: 'Potvrđujem da samo navedeni urodi dobivaju završni ishod.',
        })
        .click();
    await dialog.getByRole('button', { name: 'Potvrdi završni ishod' }).click();

    expect(JSON.parse(await submissionBody(page, 0))).toMatchObject({
        exceptions: [{ stopId: 601, outcome: 'failed' }],
    });
});

test('pairs cancellation with a terminal cancelled outcome', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryExceptionSheetStory />);
    const dialog = await openExceptionDialog(page);
    await dialog.getByRole('checkbox', { name: /Salata puterica/ }).click();
    await dialog.getByText('Dostava je otkazana', { exact: true }).click();
    await expect(
        dialog.getByText('Otkazivanje je terminalno.', { exact: false }),
    ).toBeVisible();
    await dialog
        .getByRole('checkbox', {
            name: 'Potvrđujem da samo navedeni urodi dobivaju završni ishod.',
        })
        .click();
    await dialog.getByRole('button', { name: 'Potvrdi završni ishod' }).click();

    expect(JSON.parse(await submissionBody(page, 0))).toMatchObject({
        exceptions: [
            {
                stopId: 103,
                outcome: 'cancelled',
                reason: 'cancellation',
            },
        ],
    });
});

test('retries an uncertain response with the exact immutable mutation', async ({
    mount,
    page,
}) => {
    await mount(
        <DeliveryExceptionSheetStory
            responseStatuses={['retryable', 'saved']}
        />,
    );
    const dialog = await openExceptionDialog(page);
    await dialog.getByRole('checkbox', { name: /Rajčica Roma/ }).click();
    await dialog
        .getByPlaceholder(
            'Informacije korisne dispečeru (ne prikazuju se korisniku)',
        )
        .fill('Portafon nije odgovorio.');

    const submit = dialog.getByRole('button', {
        name: 'Spremi i nastavi rutu',
    });
    await submit.click();
    await expect(
        dialog.getByRole('alert').filter({
            hasText: 'Veza s poslužiteljem je prekinuta',
        }),
    ).toBeVisible();
    const firstBody = await submissionBody(page, 0);

    await submit.click();
    const secondBody = await submissionBody(page, 1);
    expect(secondBody).toBe(firstBody);
    await expect(dialog).toHaveCount(0);
});

test('keeps the draft but requires a new operation after a route conflict', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <DeliveryExceptionSheetStory
            routeRevision={8}
            responseStatuses={['review-required', 'saved']}
        />,
    );
    const dialog = await openExceptionDialog(page);
    await dialog.getByRole('checkbox', { name: /Rajčica Roma/ }).click();
    await dialog
        .locator('label')
        .filter({ hasText: 'Završi bez dostave' })
        .click();
    const note = dialog.getByPlaceholder(
        'Informacije korisne dispečeru (ne prikazuju se korisniku)',
    );
    await note.fill('Adresa se promijenila.');
    const confirmation = dialog.getByRole('checkbox', {
        name: 'Potvrđujem da samo navedeni urodi dobivaju završni ishod.',
    });
    await confirmation.click();
    await dialog.getByRole('button', { name: 'Potvrdi završni ishod' }).click();
    await expect(
        dialog.getByRole('alert').filter({
            hasText: 'Ruta se promijenila. Pregledaj odabir',
        }),
    ).toBeVisible();

    await component.update(
        <DeliveryExceptionSheetStory
            routeRevision={9}
            responseStatuses={['review-required', 'saved']}
        />,
    );
    await expect(
        dialog.getByRole('checkbox', { name: /Rajčica Roma/ }),
    ).toBeChecked();
    await expect(
        dialog.getByRole('radio', { name: /Završi bez dostave/ }),
    ).toBeChecked();
    await expect(note).toHaveValue('Adresa se promijenila.');
    await expect(confirmation).not.toBeChecked();
    await expect(
        page.getByTestId('delivery-exception-route-revision'),
    ).toHaveText('9');

    await confirmation.click();
    await dialog.getByRole('button', { name: 'Potvrdi završni ishod' }).click();
    const firstMutation = JSON.parse(await submissionBody(page, 0));
    const secondMutation = JSON.parse(await submissionBody(page, 1));
    expect(firstMutation.expectedRouteRevision).toBe(8);
    expect(secondMutation.expectedRouteRevision).toBe(9);
    expect(secondMutation.clientOperationId).not.toBe(
        firstMutation.clientOperationId,
    );
});

test('provides keyboard focus management and screen-reader form semantics', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryExceptionSheetStory />);
    const trigger = page.getByRole('button', { name: 'Prijavi problem' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {
        name: 'Prijavi problem s dostavom',
    });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole('radio', { name: /Korisnik nije dostupan/ }),
    ).toBeChecked();
    await expect(
        dialog.getByRole('radio', { name: /Pokušaj ponovno kasnije/ }),
    ).toBeChecked();

    for (let index = 0; index < 5; index += 1) {
        await expect
            .poll(() =>
                page.evaluate(() =>
                    Boolean(document.activeElement?.closest('[role="dialog"]')),
                ),
            )
            .toBe(true);
        await page.keyboard.press('Tab');
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test('renders every customer recovery state with only customer-safe actions', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <DeliveryCustomerRecovery recovery={{ kind: 'retry-planned' }} />,
    );
    await expect(page.getByText('Ponovni pokušaj je planiran')).toBeVisible();
    await expect(page.getByText(/vratit će se kasnije/)).toBeVisible();

    await component.update(
        <DeliveryCustomerRecovery
            recovery={{
                kind: 'hq-pickup',
                pickupAddress: 'Konfigurirani HQ, Testna 42, Zagreb',
                pickupDeadlineAt: '2026-07-18T08:30:00.000Z',
                pickupWindowHours: 72,
            }}
        />,
    );
    await expect(page.getByText('Osobno preuzimanje u HQ-u')).toBeVisible();
    await expect(page.getByText(/rok od 72 sata/)).toBeVisible();
    await expect(
        page.getByText('Konfigurirani HQ, Testna 42, Zagreb'),
    ).toBeVisible();
    await expect(page.getByText(/najkasnije/)).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Potvrdi preuzimanje' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Otvori lokaciju HQ' }),
    ).toHaveAttribute('href', /google\.com\/maps\/dir/);

    await component.update(
        <DeliveryCustomerRecovery recovery={{ kind: 'support' }} />,
    );
    await expect(
        page.getByText('Podrška će dogovoriti sljedeći korak'),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Kontaktiraj podršku' }),
    ).toBeVisible();
    await expect(
        page.getByText(/harvest-missing|operational-other/),
    ).toHaveCount(0);

    await component.update(
        <DeliveryCustomerRecovery recovery={{ kind: 'hq-pickup-expired' }} />,
    );
    await expect(
        page.getByText('Rok za osobno preuzimanje je istekao'),
    ).toBeVisible();
    await expect(page.getByText(/više nije aktivan/)).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Kontaktiraj podršku' }),
    ).toBeVisible();

    await component.update(
        <DeliveryCustomerRecovery recovery={{ kind: 'cancelled' }} />,
    );
    await expect(page.getByText('Dostava je otkazana')).toBeVisible();
    await expect(page.getByText(/otkazivanje nisi očekivao/)).toBeVisible();
});

test('keeps terminal siblings as history but excludes them from current delivery work', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryStopCardStory />);

    await expect(page.getByText('1 urod · skupna dostava')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dostavi 1 urod · dalje' }),
    ).toBeVisible();
    await expect(page.getByText('Provjereno 0 od 1.')).toBeVisible();
    const verificationList = page.getByRole('list', {
        name: 'Urodi na ovoj stanici',
    });
    await expect(verificationList).toContainText('Rajčica za predaju');
    await expect(verificationList).not.toContainText('Blitva s iznimkom');

    await expect(page.getByText('Blitva s iznimkom')).toBeVisible();
    await expect(page.getByText('Neuspjela dostava')).toBeVisible();
    await expect(page.getByText('Urod nedostaje')).toBeVisible();
    await expect(
        page.getByText('Sanduk nije pronađen u vozilu.'),
    ).toBeVisible();

    await expect(page.getByText('2 uroda · skupna dostava')).toBeVisible();
    await expect(page.getByText('0 uroda · skupna dostava')).toHaveCount(0);
    await expect(page.getByText('Ponovni pokušaj je na redu')).toBeVisible();
});

test('hides stale route estimates after a customer delivery reaches terminal recovery', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryCustomerStopCardStory />);

    await expect(page.getByText('Dostava nije uspjela')).toBeVisible();
    await expect(page.getByText('Osobno preuzimanje u HQ-u')).toBeVisible();
    await expect(page.getByText('Dolazak')).toHaveCount(0);
    await expect(page.getByText('Vožnja')).toHaveCount(0);
    await expect(page.getByText('Udaljenost')).toHaveCount(0);
    await expect(
        page.getByText(/Prikaz će se ažurirati kada vozač nastavi rutu/),
    ).toHaveCount(0);
});

test('hides stale route guidance on completed driver exception history', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryDriverTerminalStopCardStory />);

    await expect(
        page.getByText('Tikvica iz završene dostave', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Prilaz je zatvoren.')).toBeVisible();
    await expect(page.getByText('Dolazak')).toHaveCount(0);
    await expect(
        page.getByText(/Obavijesti korisnika o kašnjenju/),
    ).toHaveCount(0);
});
