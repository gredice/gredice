import { expect, test } from '@playwright/experimental-ct-react';
import {
    CustomerDeliveryActiveAndHistoryEmptyStory,
    CustomerDeliveryLongHistoryStory,
    CustomerDeliverySectionsStory,
    CustomerDeliveryUpcomingEmptyStory,
} from './CustomerDeliveryHistoryStory';
import '../app/globals.css';

test('leads with every active delivery and organizes upcoming requests and bounded history', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-16T08:45:10.000Z'),
    });
    await mount(<CustomerDeliverySectionsStory />);

    await expect
        .poll(() =>
            page
                .locator(
                    '[data-testid="customer-active-section"], [data-testid="customer-upcoming-section"], [data-testid="customer-history-section"]',
                )
                .evaluateAll((elements) =>
                    elements.map((element) =>
                        element.getAttribute('data-testid'),
                    ),
                ),
        )
        .toEqual([
            'customer-active-section',
            'customer-upcoming-section',
            'customer-history-section',
        ]);

    const active = page.getByTestId('customer-active-section');
    await expect(
        active.getByRole('heading', { level: 3, name: 'Aktivna dostava' }),
    ).toBeVisible();
    await expect(active.getByTestId('customer-delivery-card')).toHaveCount(2);
    await expect(active.getByRole('heading', { level: 4 })).toHaveText([
        'Aktivna rajčica',
        'Aktivni bosiljak',
    ]);
    await expect(
        active.getByRole('img', {
            name: 'Trenutna lokacija vozača i moja dostava',
        }),
    ).toHaveAttribute('src', /active-arrived-4137/);
    await expect(active.getByText('Primatelj Aktivna rajčica')).toBeVisible();
    await expect(active.getByText('Ilica 1, 10000 Zagreb, HR')).toHaveCount(2);
    await expect(
        active.getByText('Pozvoni na portafon i ostavi košaru kod vrata.', {
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        active.getByText('Nema posebnih uputa.', { exact: true }),
    ).toBeVisible();

    const activeSupportHref = await active
        .getByRole('link', {
            name: 'Prijavi problem za dostavu: Aktivna rajčica',
        })
        .getAttribute('href');
    if (!activeSupportHref) throw new Error('Active support link is missing.');
    const activeSupportBody =
        new URL(activeSupportHref).searchParams.get('body') ?? '';
    expect(activeSupportBody).toContain('active-arrived-4137');
    expect(activeSupportBody).not.toMatch(/Ilica|Primatelj/);

    const upcoming = page.getByTestId('customer-upcoming-section');
    await expect(
        upcoming.getByRole('heading', {
            level: 3,
            name: 'Nadolazeće i potrebne radnje',
        }),
    ).toBeVisible();
    await expect(upcoming.getByRole('heading', { level: 4 })).toHaveText([
        'Nadolazeća blitva',
        'Nadolazeći peršin',
    ]);
    const pickupSupportHref = await upcoming
        .getByRole('link', {
            name: 'Kontaktiraj podršku za preuzimanje: Nadolazeća blitva',
        })
        .getAttribute('href');
    if (!pickupSupportHref) throw new Error('Pickup support link is missing.');
    const pickupSupportUrl = new URL(pickupSupportHref);
    expect(pickupSupportUrl.searchParams.get('subject')).toContain(
        'Pitanje o preuzimanju',
    );
    expect(pickupSupportUrl.searchParams.get('body')).toContain(
        'upcoming-pickup-4137',
    );

    const history = page.getByTestId('customer-history-section');
    const historyCards = history.locator(
        '[data-testid="customer-delivery-card"], [data-testid="customer-pickup-card"]',
    );
    await expect(historyCards).toHaveCount(6);
    await expect(history.getByText('6 od 8', { exact: true })).toBeVisible();
    await expect(history.getByRole('heading', { level: 4 }).first()).toHaveText(
        'Urod s oporavkom',
    );
    await expect(
        history.getByText('Skriveni preuzeti grašak', { exact: true }),
    ).toHaveCount(0);
    await expect(
        history.getByText('Skriveni dostavljeni kelj', { exact: true }),
    ).toHaveCount(0);

    const receipt = history
        .getByTestId('customer-delivery-card')
        .filter({ hasText: 'Dostavljena paprika' });
    await expect(
        receipt.getByRole('heading', {
            level: 5,
            name: /Potvrda o dostavi · Dostavljena paprika/,
        }),
    ).toBeVisible();
    const receiptSupportHref = await receipt
        .getByRole('link', {
            name: 'Kontaktiraj podršku za dostavu: Dostavljena paprika',
        })
        .getAttribute('href');
    if (!receiptSupportHref) {
        throw new Error('Receipt support link is missing.');
    }
    expect(new URL(receiptSupportHref).searchParams.get('body')).toContain(
        'history-delivery-1-4137',
    );

    const disclosure = history.getByRole('button', {
        name: 'Prikaži još (2)',
    });
    await disclosure.click();
    await expect(historyCards).toHaveCount(8);
    await expect(history.getByText('8 od 8', { exact: true })).toBeVisible();
    await expect(
        history.getByText('Skriveni preuzeti grašak', { exact: true }),
    ).toBeVisible();
    await expect(
        history.getByRole('article', {
            name: 'Nova stavka povijesti: Skriveni preuzeti grašak',
        }),
    ).toBeFocused();
    await expect(history.getByRole('status')).toHaveText(
        'Prikazano 8 od 8 stavki povijesti.',
    );
    const collapse = history.getByRole('button', { name: 'Prikaži manje' });
    await collapse.click();
    await expect(historyCards).toHaveCount(6);
    await expect(
        history.getByRole('button', { name: 'Prikaži još (2)' }),
    ).toBeFocused();
});

test('defines active and history empty states around an upcoming request', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDeliveryActiveAndHistoryEmptyStory />);

    const active = page.getByTestId('customer-active-section');
    await expect(
        active.getByText('Trenutačno nema dostave na putu.', { exact: true }),
    ).toBeVisible();
    await expect(active.getByTestId('customer-section-empty')).toHaveCount(1);

    const upcoming = page.getByTestId('customer-upcoming-section');
    await expect(upcoming.getByTestId('customer-delivery-card')).toHaveCount(1);
    await expect(upcoming.getByTestId('customer-section-empty')).toHaveCount(0);

    const history = page.getByTestId('customer-history-section');
    await expect(
        history.getByText('Još nema dovršenih zahtjeva.', { exact: true }),
    ).toBeVisible();
    await expect(history.getByTestId('customer-section-empty')).toHaveCount(1);
});

test('keeps the upcoming empty state between active delivery and history', async ({
    mount,
    page,
}) => {
    await page.clock.install({
        time: new Date('2026-07-16T08:45:10.000Z'),
    });
    await mount(<CustomerDeliveryUpcomingEmptyStory />);

    await expect(
        page
            .getByTestId('customer-active-section')
            .getByTestId('customer-delivery-card'),
    ).toHaveCount(1);
    await expect(
        page
            .getByTestId('customer-upcoming-section')
            .getByText('Nema nadolazećih termina ni radnji.', { exact: true }),
    ).toBeVisible();
    await expect(
        page
            .getByTestId('customer-history-section')
            .getByTestId('customer-delivery-card'),
    ).toHaveCount(1);
});

test('can collapse a multi-page history before loading every remaining receipt', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDeliveryLongHistoryStory />);
    const history = page.getByTestId('customer-history-section');
    const historyCards = history.getByTestId('customer-delivery-card');

    await expect(historyCards).toHaveCount(6);
    await history.getByRole('button', { name: 'Prikaži još (8)' }).click();
    await expect(historyCards).toHaveCount(12);
    await expect(
        history.getByRole('button', { name: 'Prikaži još (2)' }),
    ).toBeVisible();
    const collapse = history.getByRole('button', { name: 'Prikaži manje' });
    await expect(collapse).toBeVisible();
    await collapse.click();
    await expect(historyCards).toHaveCount(6);
    await expect(
        history.getByRole('button', { name: 'Prikaži još (8)' }),
    ).toBeVisible();
    await expect(
        history.getByRole('button', { name: 'Prikaži manje' }),
    ).toHaveCount(0);
});
