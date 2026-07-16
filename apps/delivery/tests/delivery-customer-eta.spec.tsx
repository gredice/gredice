import { expect, test } from '@playwright/experimental-ct-react';
import {
    CrossMidnightCustomerEtaStory,
    DelayedCustomerEtaStory,
    ExpiredCustomerEtaStory,
    FallbackCustomerEtaStory,
    FreshCustomerEtaStory,
    InvalidCustomerWindowStory,
    StaleCustomerEtaStory,
    UnavailableCustomerEtaStory,
    UpdatingCustomerEtaStory,
} from './CustomerDeliveryEtaStory';
import '../app/globals.css';

test('shows the full promise and a text-qualified fresh ETA range', async ({
    mount,
    page,
}) => {
    await mount(<FreshCustomerEtaStory />);
    const card = page.getByTestId('customer-delivery-card');

    await expect(card.locator('time')).toHaveCount(5);
    await expect(card.locator('time').first()).toHaveAttribute(
        'datetime',
        '2026-07-16T08:00:00.000Z',
    );
    await expect(card.locator('time').nth(1)).toHaveAttribute(
        'datetime',
        '2026-07-16T10:00:00.000Z',
    );
    await expect(
        card.getByText('Ažurna procjena prema prometu', { exact: true }),
    ).toBeVisible();
    await expect(
        card.getByText('Tvoja dostava je sljedeća.', { exact: true }),
    ).toBeVisible();
    expect(await card.innerText()).not.toMatch(/Vožnja|Udaljenost/);
    await expect(
        card.getByText('Preostalo: 10 min – 20 min', { exact: true }),
    ).toBeVisible();
});

test('uses the promised window as an explicit approximate fallback', async ({
    mount,
    page,
}) => {
    await mount(<FallbackCustomerEtaStory />);

    await expect(
        page.getByText('Prema odabranom terminu', { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText('3 zaustavljanja prije tvoje dostave.', {
            exact: true,
        }),
    ).toBeVisible();
});

test('labels a stale estimate without exposing another route stop', async ({
    mount,
    page,
}) => {
    await mount(<StaleCustomerEtaStory />);

    await expect(
        page.getByText(
            'Procjena rute nije ažurna; prikazujemo odabrani termin.',
            { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByText(/Zadnja procjena rute:/)).toBeVisible();
    await expect(
        page.getByText('2 zaustavljanja prije tvoje dostave.', {
            exact: true,
        }),
    ).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(
        /adresa|kupac|pickup|stopId|PRIVATE/i,
    );
});

test('announces a late ETA politely and keeps the genuine late range', async ({
    mount,
    page,
}) => {
    await mount(<DelayedCustomerEtaStory />);

    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(1);
    await expect(
        page.getByText(
            'Procjena dolaska je nakon završetka odabranog termina.',
            { exact: true },
        ),
    ).toBeVisible();
    const etaTimes = page
        .getByTestId('customer-delivery-promise')
        .locator('time');
    await expect(etaTimes.first()).toHaveAttribute(
        'datetime',
        '2026-07-16T10:10:00.000Z',
    );
    await expect(etaTimes.nth(1)).toHaveAttribute(
        'datetime',
        '2026-07-16T10:25:00.000Z',
    );
});

test('does not present an expired fallback window as an imminent ETA', async ({
    mount,
    page,
}) => {
    await mount(<ExpiredCustomerEtaStory />);

    await expect(
        page.getByText(
            'Odabrani termin je prošao, a nova procjena dolaska trenutačno nije dostupna.',
            { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByText(/Procijenjeni dolazak/)).toHaveCount(0);
    await expect(page.getByText(/uskoro/)).toHaveCount(0);
});

test('includes dates for cross-midnight promises and next-day ETA ranges', async ({
    mount,
    page,
}) => {
    await mount(<CrossMidnightCustomerEtaStory />);
    const times = page.getByTestId('customer-delivery-card').locator('time');

    await expect(times.nth(0)).toContainText(/16\. srp.*23:00/);
    await expect(times.nth(1)).toContainText(/17\. srp.*01:00/);
    await expect(times.nth(2)).toContainText(/17\. srp.*23:55/);
    await expect(times.nth(3)).toContainText(/18\. srp.*00:10/);
});

test('keeps missing legacy data explicit instead of hiding the promise row', async ({
    mount,
    page,
}) => {
    await mount(<UnavailableCustomerEtaStory />);

    await expect(
        page.getByText('Termin još nije dostupan.', { exact: true }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('group', { name: 'Dostupnost procjene dolaska' })
            .getByText(/Procjena dolaska trenutačno nije dostupna/),
    ).toBeVisible();
    await expect(
        page.getByText('Napredak rute trenutačno nije dostupan.', {
            exact: true,
        }),
    ).toBeVisible();
});

test('fails closed for malformed and reversed legacy promise windows', async ({
    mount,
    page,
}) => {
    const component = await mount(<InvalidCustomerWindowStory />);

    await expect(
        page.getByText('Termin još nije dostupan.', { exact: true }),
    ).toBeVisible();
    await component.update(<InvalidCustomerWindowStory reversed />);
    await expect(
        page.getByText('Termin još nije dostupan.', { exact: true }),
    ).toBeVisible();
});

test('keeps a stable polite announcement for meaningful ETA and progress updates', async ({
    mount,
}) => {
    const component = await mount(<UpdatingCustomerEtaStory />);
    const announcement = component.getByRole('status');

    await expect(announcement).toContainText(
        '3 zaustavljanja prije tvoje dostave.',
    );
    await expect(announcement).toContainText(
        'Procijenjeni dolazak od 10:00 do 12:00.',
    );
    const initialAnnouncement = await announcement.textContent();
    await component.update(
        <UpdatingCustomerEtaStory
            remainingMinSeconds={300}
            remainingMaxSeconds={900}
        />,
    );
    await expect(
        component.getByText('Preostalo: 5 min – 15 min', { exact: true }),
    ).toBeVisible();
    await expect(announcement).toHaveText(initialAnnouncement ?? '');
    await component.update(
        <UpdatingCustomerEtaStory
            rangeStartAt="2026-07-16T09:15:00.000Z"
            rangeEndAt="2026-07-16T09:30:00.000Z"
        />,
    );
    await expect(announcement).not.toHaveText(initialAnnouncement ?? '');
    await expect(announcement).toContainText(
        'Procijenjeni dolazak od 11:15 do 11:30.',
    );
    await component.update(<UpdatingCustomerEtaStory delayed />);
    await expect(announcement).toContainText(
        'Procjena dolaska je nakon završetka odabranog termina.',
    );
    await expect(announcement).toHaveAttribute('aria-atomic', 'true');
    await expect(component.getByRole('alert')).toHaveCount(0);
});

test('announces driver arrival assertively without duplicating a routine update', async ({
    mount,
}) => {
    const component = await mount(<UpdatingCustomerEtaStory />);
    await expect(component.getByRole('status')).toHaveCount(1);

    await component.update(<UpdatingCustomerEtaStory arrived />);

    await expect(component.getByRole('alert')).toHaveText(
        'Vozač je stigao na lokaciju dostave.',
    );
    await expect(component.getByRole('status')).toHaveCount(0);
    await expect(
        component.getByText('Vozač je stigao na lokaciju dostave.', {
            exact: true,
        }),
    ).toBeVisible();
});

test.describe('customer ETA on a narrow touch screen', () => {
    test.use({
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
    });

    test('contains the promise without horizontal overflow', async ({
        mount,
        page,
    }) => {
        await mount(<FallbackCustomerEtaStory />);
        const card = page.getByTestId('customer-delivery-card');
        expect(
            await card.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
            ),
        ).toBe(true);
    });
});
