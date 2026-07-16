import { expect, test } from '@playwright/experimental-ct-react';
import {
    DeliveryFailedActionStory,
    DeliveryQueuedArrivalStory,
} from './DeliveryStopCardStory';
import {
    DriverDashboardBulkRecipientAdvanceStory,
    DriverDashboardOfflineContinuationStory,
    DriverDashboardPendingRerouteStory,
} from './DriverDashboardOfflineStory';
import {
    NonCurrentDeliveryRecoveryFailureStory,
    NonCurrentPickupRecoveryFailureStory,
} from './DriverRecoveryFailureStory';
import {
    OfflineRouteAcknowledgedDeliveryStory,
    OfflineRouteArrivalStory,
    OfflineRouteBlockedContinuationStory,
    OfflineRouteExceptionBarrierStory,
    OfflineRoutePendingRerouteStory,
} from './OfflineRoutePanelStory';
import '../app/globals.css';

test('keeps an offline arrival visibly pending while allowing advisory verification and delivery', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryQueuedArrivalStory />);
    await expect(
        page.getByText('Radnja je spremljena na uređaju i čeka potvrdu.'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dolazak čeka potvrdu' }),
    ).toBeDisabled();
    await expect(page.getByText('QR provjera predaje')).toBeVisible();
    await expect(
        page.getByText(
            'Svi urodi s dostupnim QR kodom provjereni su za ovu stanicu.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: /Dostavi .* dalje|Dostavljeno · dalje/,
        }),
    ).toBeEnabled();
});

test('already loaded dashboard exposes the next stop after a locally queued delivery', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardOfflineContinuationStory />);
    await expect(
        page.getByText(
            'Dostava je spremljena na uređaju i čeka potvrdu poslužitelja. Možeš nastaviti na sljedeću stanicu.',
        ),
    ).toBeVisible();
    await expect(page.getByTitle('Vukovarska 42, Zagreb')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Navigacija' })).toHaveCount(1);
    await expect(
        page.getByRole('button', { name: 'Stigao sam' }),
    ).toBeEnabled();
});

test('already loaded dashboard blocks its stale next stop while rerouting', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardPendingRerouteStory />);
    await expect(
        page.getByText(
            'Poslužitelj je potvrdio radnju, ali novi plan rute još nije sigurno učitan.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Navigacija čeka novi plan' }),
    ).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Navigacija' })).toHaveCount(0);
});

test('clears private handoff notes when the actionable bulk recipients change', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardBulkRecipientAdvanceStory />);
    const note = page.getByLabel('Napomena o predaji');
    await note.fill('Privatna napomena za početnu skupinu');
    await page
        .getByRole('button', { name: 'Simuliraj djelomičnu iznimku' })
        .click();
    await expect(note).toHaveValue('');
    await expect(
        page.getByRole('heading', { name: /2 uroda · skupna dostava/ }),
    ).toBeVisible();
});

test('offers an explicit retry for a durable failed action', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryFailedActionStory />);
    await expect(
        page.getByText(
            'Radnja je spremljena na uređaju, ali slanje nije uspjelo.',
        ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.getByTestId('offline-action-result')).toHaveText(
        'retried',
    );
});

test('preserves newer server truth and requires explicit local conflict recovery', async ({
    mount,
    page,
}) => {
    await mount(<DeliveryFailedActionStory state="conflicted" />);
    await expect(
        page.getByText('Poslužitelj ima noviju verziju rute.'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Dostava čeka potvrdu/ }),
    ).toBeDisabled();
    await page
        .getByRole('button', { name: 'Učitaj stanje poslužitelja' })
        .click();
    await expect(page.getByTestId('offline-action-result')).toHaveText(
        'discarded',
    );
});

test('keeps non-current delivery recovery failures beside the recovery command', async ({
    mount,
    page,
}) => {
    await mount(<NonCurrentDeliveryRecoveryFailureStory />);
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(
        page.getByText('Ponovno slanje dostave nije uspjelo.', {
            exact: true,
        }),
    ).toBeVisible();
});

test('keeps non-current pickup recovery failures beside the recovery command', async ({
    mount,
    page,
}) => {
    await mount(<NonCurrentPickupRecoveryFailureStory />);
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(
        page.getByText('Ponovno slanje preuzimanja nije uspjelo.', {
            exact: true,
        }),
    ).toBeVisible();
});

test('restored offline route keeps pending actions visible and supports ordered arrival then delivery', async ({
    mount,
    page,
}) => {
    await mount(<OfflineRouteArrivalStory />);
    const nextRouteRow = page
        .getByRole('list', { name: 'Izvanmrežni tijek dostavne rute' })
        .getByRole('listitem')
        .nth(1);
    await nextRouteRow.getByRole('button').click();
    await expect(
        nextRouteRow.getByRole('button', {
            name: 'Navigacija do sljedeće stanice čeka završetak trenutačne dostave',
        }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Stigao sam' }).click();
    await expect(
        page.getByRole('button', { name: 'Dolazak čeka potvrdu' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Dostavljeno · dalje' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Provjeri QR kodove' }).click();
    await page
        .getByLabel('Ručni unos')
        .fill('https://www.gredice.com/trag/offline-tomato-0001');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(page.getByTestId('offline-verification')).toHaveText(
        '/trag/offline-tomato-0001',
    );
    await page.getByRole('button', { name: 'Završi provjeru' }).click();
    await page.getByRole('button', { name: 'Dostavljeno · dalje' }).click();
    await expect(page.getByTestId('offline-operations')).toHaveText(
        'arrive,deliver',
    );
    await expect(
        page.getByRole('link', { name: 'Navigacija do trenutačne stanice' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Stigao sam' }).click();
    await page.getByRole('button', { name: 'Dostavljeno · dalje' }).click();
    await expect(page.getByTestId('offline-operations')).toHaveText(
        'arrive,deliver,arrive,deliver',
    );
});

test('restored server acknowledgement is not mislabeled as waiting for confirmation', async ({
    mount,
    page,
}) => {
    await mount(<OfflineRouteAcknowledgedDeliveryStory />);
    await expect(
        page.getByText(
            'Poslužitelj je potvrdio dostavu. Čeka se osvježeno stanje rute. Možeš nastaviti na sljedeću stanicu.',
        ),
    ).toBeVisible();
    await expect(
        page.getByText(/Dostava je spremljena.*čeka potvrdu poslužitelja/),
    ).toHaveCount(0);
    await expect(
        page.getByRole('link', { name: 'Navigacija do trenutačne stanice' }),
    ).toBeEnabled();
});

test('server-required reroute blocks stale cached continuation until reconciliation', async ({
    mount,
    page,
}) => {
    await mount(<OfflineRoutePendingRerouteStory />);
    await expect(
        page.getByText(
            'Poslužitelj je potvrdio radnju, ali novi plan rute još nije sigurno učitan.',
        ),
    ).toBeVisible();
    await expect(
        page
            .getByRole('list', {
                name: 'Izvanmrežni tijek dostavne rute',
            })
            .getByText('Trenutačna stanica', { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: 'Navigacija do trenutačne stanice čeka novi plan',
        }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Osvježi novi plan' }).click();
    await expect(page.getByTestId('offline-reroute-reconciled')).toHaveText(
        'yes',
    );
});

test('completed-stop copy never tells the driver to continue through a queue barrier', async ({
    mount,
    page,
}) => {
    await mount(<OfflineRouteBlockedContinuationStory />);
    await expect(
        page.getByText(
            'Dostava je spremljena na uređaju i čeka potvrdu poslužitelja.',
            { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByText(/Možeš nastaviti/)).toHaveCount(0);
    await expect(
        page.getByText(
            'Prva nesinkronizirana radnja nije poslana. Kasnije radnje čekaju iza nje.',
        ),
    ).toBeVisible();
});

test('restored route can safely queue a delivery exception', async ({
    mount,
    page,
}) => {
    await mount(<OfflineRouteArrivalStory />);
    await page.getByRole('button', { name: 'Prijavi problem' }).click();
    await page.getByRole('button', { name: 'Spremi i nastavi rutu' }).click();
    await expect(page.getByTestId('offline-exception')).toHaveText('queued');
});

test('restored exception remains a route barrier and memory fallback is truthful', async ({
    mount,
    page,
}) => {
    await mount(<OfflineRouteExceptionBarrierStory />);
    await expect(
        page.getByText(
            'Problem je potvrđen, ali novi plan rute još nije sigurno učitan.',
        ),
    ).toBeVisible();
    await expect(
        page.getByText(
            /Radnje su spremljene samo dok je ova stranica otvorena/,
        ),
    ).toBeVisible();
    const nextRouteRow = page
        .getByRole('list', { name: 'Izvanmrežni tijek dostavne rute' })
        .getByRole('listitem')
        .nth(1);
    await nextRouteRow.getByRole('button').click();
    await expect(
        nextRouteRow.getByRole('button', {
            name: 'Navigacija do sljedeće stanice čeka novi plan',
        }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Osvježi novi plan' }).click();
    await expect(page.getByTestId('offline-reconciled')).toHaveText('yes');
});
