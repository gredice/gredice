import { expect, test } from '@playwright/experimental-ct-react';
import { DeliveryHandoffVerificationStory } from './DeliveryHandoffVerificationStory';
import '../app/globals.css';

test('keeps controlled handoff progress across scanner close and component refresh while reporting safe failures', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryHandoffVerificationStory />);

    await page.getByRole('button', { name: 'Provjeri QR kodove' }).click();
    const manualInput = page.getByLabel('Ručni unos');
    await manualInput.fill('https://www.gredice.com/trag/tomato-trace-0001');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(
        page.getByText('Rajčica Roma · Ana Anić potvrđen je za ovu dostavu.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Završi provjeru' }).click();
    await expect(page.getByLabel('Sažetak provjere predaje')).toContainText(
        '1 provjereno',
    );
    const scannedTomato = page.getByRole('listitem').filter({
        hasText: 'Rajčica Roma',
    });
    await expect(scannedTomato).toContainText('Provjereno');
    await scannedTomato
        .getByRole('button', { name: /Promijeni ishod/ })
        .click();
    await expect(
        scannedTomato.getByRole('button', { name: /Označi da nedostaje/ }),
    ).toBeVisible();
    await scannedTomato
        .getByRole('button', { name: 'Odustani od promjene' })
        .click();

    await page
        .getByRole('button', { name: 'Simuliraj osvježavanje prikaza' })
        .click();
    await expect(page.getByLabel('Sažetak provjere predaje')).toContainText(
        '1 provjereno',
    );

    await page.getByRole('button', { name: 'Provjeri QR kodove' }).click();
    await manualInput.fill('tomato-trace-0001');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(
        page.getByText(
            'Rajčica Roma · Ana Anić već je provjeren na ovoj stanici.',
        ),
    ).toBeVisible();

    await manualInput.fill('nije-kod');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(
        page.getByText('Kod nije valjana Gredice poveznica traga uroda.'),
    ).toBeVisible();

    await manualInput.fill('/trag/wrong-stop-trace-0001');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(
        page.getByText(
            'Ovaj QR kod nije na popisu uroda za trenutačnu stanicu.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('log', { name: 'Posljednja očitanja' }),
    ).toBeVisible();
    await expect(page.getByTestId('handoff-events')).toContainText(
        'scanned:101|duplicate|invalid|wrong-stop',
    );
    await expect(page.getByLabel('Sažetak provjere predaje')).toContainText(
        '1 provjereno',
    );
});

test('records nonblocking outcomes and keeps bulk completion enabled with unresolved and pending verification', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryHandoffVerificationStory syncState="failed" />);

    const tomato = page.getByRole('listitem').filter({
        hasText: 'Rajčica Roma',
    });
    await tomato.getByRole('button', { name: /Označi bez etikete/ }).click();
    await expect(
        tomato.getByRole('button', { name: /Promijeni ishod/ }),
    ).toBeVisible();
    await tomato.getByRole('button', { name: /Promijeni ishod/ }).click();
    await tomato.getByRole('button', { name: /Označi da nedostaje/ }).click();

    const basil = page.getByRole('listitem').filter({
        hasText: 'Bosiljak Genovese',
    });
    await basil.getByRole('button', { name: /Označi bez etikete/ }).click();

    const lettuce = page.getByRole('listitem').filter({
        hasText: 'Salata puterica',
    });
    await lettuce
        .getByLabel(/Razlog preskakanja/)
        .selectOption('scanner-unavailable');
    await lettuce.getByRole('button', { name: /Preskoči provjeru/ }).click();

    await page.getByRole('button', { name: 'Dostavi 4 uroda · dalje' }).click();
    const confirmation = page.getByRole('dialog', {
        name: 'Potvrdi dostavu',
    });
    await expect(confirmation).toContainText(
        '3 primatelja · 4 očekivana uroda',
    );
    await expect(confirmation).toContainText('1 neskenirano');
    await expect(confirmation).toContainText('2 iznimke');
    await expect(confirmation).toContainText(
        'Sinkronizacija nekih provjera nije uspjela. Dostavu i dalje možeš potvrditi.',
    );
    const overrideReason = confirmation.getByLabel('Razlog operativne iznimke');
    const confirmOverride = confirmation.getByRole('button', {
        name: 'Potvrdi iznimku i dostavu',
    });
    await expect(confirmOverride).toBeDisabled();
    await overrideReason.selectOption('manual-handoff');
    await expect(confirmOverride).toBeEnabled();
    await confirmation.getByRole('button', { name: 'Natrag' }).click();

    await page
        .getByRole('button', {
            name: 'Označi preostalo kao ručno provjereno',
        })
        .click();
    await expect(page.getByTestId('handoff-events')).toContainText(
        'mark:101:no-label|mark:101:missing|mark:102:no-label|mark:103:skipped:scanner-unavailable|manual:104',
    );

    await page.getByRole('button', { name: 'Dostavi 4 uroda · dalje' }).click();
    await expect(confirmation).toContainText('0 neskenirano');
    await expect(confirmation).toContainText('3 iznimke');
    await expect(confirmation).toContainText('2 preskočeno');
    await overrideReason.selectOption('workflow-recovery');
    await confirmation
        .getByRole('button', { name: 'Potvrdi iznimku i dostavu' })
        .click();
    await expect(page.getByTestId('completion-result')).toHaveText('delivered');
});

test('submits one irreversible bulk completion for same-frame repeat submits', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryHandoffVerificationStory />);
    await page.getByRole('button', { name: 'Dostavi 4 uroda · dalje' }).click();
    const confirmation = page.getByRole('dialog', {
        name: 'Potvrdi dostavu',
    });
    await confirmation
        .getByLabel('Razlog operativne iznimke')
        .selectOption('manual-handoff');
    await confirmation.locator('form').evaluate((element) => {
        if (!(element instanceof HTMLFormElement)) return;
        element.requestSubmit();
        element.requestSubmit();
    });

    await expect(page.getByTestId('completion-calls')).toHaveText('1');
    await expect(page.getByTestId('completion-result')).toHaveText('delivered');
});

test('counts a shared physical QR once while reporting every grouped harvest outcome', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryHandoffVerificationStory sharedTrace />);
    await page.getByRole('button', { name: 'Provjeri QR kodove' }).click();
    const scanner = page.getByRole('dialog', {
        name: 'Provjera uroda za dostavu',
    });
    await expect(scanner).toContainText('3 očekivanih QR kodova');

    await scanner.getByLabel('Ručni unos').fill('tomato-trace-0001');
    await scanner.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(scanner).toContainText('1 provjereno');
    await scanner.getByRole('button', { name: 'Završi provjeru' }).click();

    await expect(page.getByLabel('Sažetak provjere predaje')).toContainText(
        '2 provjereno',
    );
    await expect(page.getByTestId('handoff-events')).toContainText(
        'scanned:101,102',
    );
});

test('announces nonblocking server feedback after an advisory verification is reconciled', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryHandoffVerificationStory serverFeedback />);

    await expect(
        page.getByRole('status', {
            name: 'Povratne informacije provjere predaje',
        }),
    ).toContainText('QR kod pripada drugoj stanici na ruti.');
    await expect(
        page.getByRole('button', { name: 'Dostavi 4 uroda · dalje' }),
    ).toBeEnabled();
});

test('keeps verification controls hidden while persisted progress loads without blocking delivery', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryHandoffVerificationStory handoffUnavailable />);

    await expect(
        page.getByText('Učitavanje popisa uroda za ovu predaju…'),
    ).toBeVisible();
    await expect(
        page.getByRole('list', { name: 'Urodi na ovoj stanici' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Dostavi 4 uroda · dalje' }).click();
    const confirmation = page.getByRole('dialog', {
        name: 'Potvrdi dostavu',
    });
    await expect(confirmation).toContainText(
        'Spremljeni ishodi provjere još se učitavaju.',
    );
    await expect(
        confirmation.getByRole('button', {
            name: 'Potvrdi iznimku i dostavu',
        }),
    ).toBeDisabled();
    await confirmation
        .getByLabel('Razlog operativne iznimke')
        .selectOption('device-unavailable');
    await expect(
        confirmation.getByRole('button', {
            name: 'Potvrdi iznimku i dostavu',
        }),
    ).toBeEnabled();
});
