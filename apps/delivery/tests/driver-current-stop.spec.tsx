import { expect, test } from '@playwright/experimental-ct-react';
import {
    DriverCurrentDeferredCommandStory,
    DriverCurrentDeliveryCommandStory,
    DriverCurrentPickupCommandStory,
    HarvestTraceScannerSessionStory,
} from './DriverCurrentStopCommandCenterStory';
import {
    DriverDashboardCrossQueuePickupStory,
    DriverDashboardEarlierPickupConflictStory,
    DriverDashboardEarlierPickupDeferredRetryStory,
    DriverDashboardEarlierPickupFailureStory,
    DriverDashboardLocallyAdvancedDeferredStory,
    DriverDashboardPickupManifestAdvanceStory,
    DriverDashboardServerAdvanceStory,
} from './DriverDashboardOfflineStory';
import { OfflineRouteArrivalStory } from './OfflineRoutePanelStory';
import '../app/globals.css';

test.describe('320px current-stop command center', () => {
    test.use({
        viewport: { width: 320, height: 568 },
        hasTouch: true,
        isMobile: true,
    });

    test('keeps essentials, critical notes, and direct commands visible without horizontal overflow', async ({
        mount,
        page,
    }) => {
        await mount(<DriverCurrentDeliveryCommandStory />);
        const command = page.getByRole('region', {
            name: /skupna dostava/,
        });
        const actionGroup = command.getByRole('group', {
            name: 'Radnje trenutačne stanice',
        });
        const estimateGroup = command.getByRole('region', {
            name: 'Procjene trenutačne stanice',
        });
        const criticalNotes = command.getByRole('region', {
            name: 'Važne napomene za trenutačnu stanicu',
        });

        await expect(command).toContainText('Ilica 42, Zagreb');
        await expect(command).toContainText('Ulaz iz dvorišta');
        await expect(command).toContainText('Treći kat bez lifta');
        await expect(command.getByText(/Uputa za adresu/)).toHaveCount(2);
        await expect(command).toContainText('Pozvoni dva puta.');
        await expect(command).toContainText('Sanduk ostavi u hladu.');
        await expect(
            command.getByRole('button', { name: 'Stigao sam' }),
        ).toBeEnabled();
        await expect(
            command.getByRole('button', { name: 'Prijavi problem' }),
        ).toBeEnabled();
        await expect(
            command.getByRole('link', {
                name: 'Navigacija do trenutačne stanice',
            }),
        ).toHaveAttribute(
            'href',
            'https://www.google.com/maps/dir/?api=1&destination=Ilica%2042%2C%20Zagreb',
        );
        const calls = command.getByRole('link', { name: /^Nazovi / });
        await expect(calls).toHaveCount(2);
        await expect(calls.first()).toHaveAttribute('href', /^tel:/);
        await expect(
            command.getByRole('link', {
                name: 'Nazovi Ana Anić, Cvita Cvetko',
            }),
        ).toBeVisible();
        await expect(
            command.getByRole('link', { name: 'Nazovi Borna Babić' }),
        ).toBeVisible();
        await expect(command.getByText('Zara Završena')).toHaveCount(0);
        await expect(
            command.getByText('Ne zovi ovaj završeni kontakt.'),
        ).toHaveCount(0);
        await expect(command).toContainText(
            'Napomena korisnika · Ana Anić · Rajčica Roma',
        );
        await expect(actionGroup).toBeVisible();
        await expect(estimateGroup).toBeVisible();
        await expect(criticalNotes).toBeVisible();
        const orderedLabels = await command
            .locator(':scope > [aria-label]')
            .evaluateAll((elements) =>
                elements.map((element) => element.getAttribute('aria-label')),
            );
        expect(orderedLabels.indexOf('Radnje trenutačne stanice')).toBeLessThan(
            orderedLabels.indexOf('Procjene trenutačne stanice'),
        );
        expect(orderedLabels.indexOf('Radnje trenutačne stanice')).toBeLessThan(
            orderedLabels.indexOf('Važne napomene za trenutačnu stanicu'),
        );
        await expect(
            command.getByText(
                'QR provjera otključat će se nakon potvrde dolaska.',
            ),
        ).toBeVisible();

        const arrive = command.getByRole('button', { name: 'Stigao sam' });
        const arriveBox = await arrive.boundingBox();
        const heading = command.getByRole('region', {
            name: 'Sažetak trenutačne stanice',
        });
        const geometry = await command.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            borderTopWidth: getComputedStyle(element).borderTopWidth,
        }));
        expect(geometry.scrollWidth).toBe(geometry.clientWidth);
        expect(geometry.borderTopWidth).toBe('1px');
        expect(
            await heading.evaluate(
                (element) => getComputedStyle(element).position,
            ),
        ).toBe('sticky');
        expect(arriveBox).not.toBeNull();
        expect(
            (arriveBox?.y ?? 568) + (arriveBox?.height ?? 0),
        ).toBeLessThanOrEqual(568);
    });

    test('keeps arrived delivery reachable while the note field can scroll above a reduced viewport', async ({
        mount,
        page,
    }) => {
        await mount(<DriverCurrentDeliveryCommandStory arrived />);
        const deliver = page.getByRole('button', {
            name: /Dostavi 3 · dalje/,
        });
        const deliverBox = await deliver.boundingBox();
        expect(deliverBox).not.toBeNull();
        expect(
            (deliverBox?.y ?? 568) + (deliverBox?.height ?? 0),
        ).toBeLessThanOrEqual(568);

        const note = page.getByLabel('Napomena o predaji');
        await note.focus();
        await expect(note).toBeFocused();
        await page.setViewportSize({ width: 320, height: 360 });
        await note.evaluate((element) =>
            element.scrollIntoView({ block: 'center' }),
        );
        const noteBox = await note.boundingBox();
        const keyboardDeliverBox = await deliver.boundingBox();
        const keyboardSummaryBox = await page
            .getByRole('region', { name: 'Sažetak trenutačne stanice' })
            .boundingBox();
        expect(noteBox).not.toBeNull();
        expect(keyboardDeliverBox).not.toBeNull();
        expect(keyboardSummaryBox).not.toBeNull();
        expect(
            (keyboardDeliverBox?.y ?? 360) + (keyboardDeliverBox?.height ?? 0),
        ).toBeLessThanOrEqual(360);
        expect(
            (noteBox?.y ?? 360) + (noteBox?.height ?? 0),
        ).toBeLessThanOrEqual(360);
        expect(noteBox?.y ?? 0).toBeGreaterThanOrEqual(
            (keyboardDeliverBox?.y ?? 0) + (keyboardDeliverBox?.height ?? 0),
        );
        expect(keyboardDeliverBox?.y ?? 0).toBeGreaterThanOrEqual(
            (keyboardSummaryBox?.y ?? 0) + (keyboardSummaryBox?.height ?? 0),
        );
    });

    test('opens the persisted handoff summary before completing a delivery without blocking unresolved items', async ({
        mount,
        page,
    }) => {
        await mount(<DriverCurrentDeliveryCommandStory arrived withHandoff />);
        await page.getByRole('button', { name: 'Dostavi 3 · dalje' }).click();

        const confirmation = page.getByRole('dialog', {
            name: 'Potvrdi dostavu',
        });
        await expect(confirmation).toContainText('1 provjereno');
        await expect(confirmation).toContainText('1 bez provjere');
        await expect(confirmation).toContainText('1 bez etikete');
        await expect(page.getByTestId('current-stop-result')).toHaveText(
            'none',
        );

        const confirm = confirmation.getByRole('button', {
            name: 'Potvrdi dostavu i nastavi',
        });
        await expect(confirm).toBeEnabled();
        await confirm.click();
        await expect(page.getByTestId('current-stop-result')).toHaveText(
            'delivered:',
        );
    });

    test('keeps failed delivery recovery attached to the sticky delivery action', async ({
        mount,
        page,
    }) => {
        await mount(
            <DriverCurrentDeliveryCommandStory
                arrived
                syncKind="deliver"
                syncState="failed"
            />,
        );
        const action = page.getByRole('button', {
            name: 'Dostava čeka potvrdu',
        });
        const status = page.getByTestId('current-command-status');
        const retry = page.getByRole('button', { name: 'Pokušaj ponovno' });
        await expect(action).toBeInViewport();
        await expect(retry).toBeInViewport();

        const actionBox = await action.boundingBox();
        const statusBox = await status.boundingBox();
        expect(actionBox).not.toBeNull();
        expect(statusBox).not.toBeNull();
        const actionBottom =
            (actionBox?.y ?? 0) + (actionBox?.height ?? Number.MAX_VALUE);
        expect(statusBox?.y ?? 0).toBeGreaterThanOrEqual(actionBottom);
        expect((statusBox?.y ?? 0) - actionBottom).toBeLessThanOrEqual(12);
    });

    test('keeps pickup scanning, manual fallback, and confirmation reachable before the route details', async ({
        mount,
        page,
    }) => {
        const component = await mount(<DriverCurrentPickupCommandStory />);
        for (const buttonName of [
            'Skeniraj urode',
            'Preuzeto bez QR etikete',
        ]) {
            const box = await page
                .getByRole('button', { name: buttonName })
                .boundingBox();
            expect(box).not.toBeNull();
            expect((box?.y ?? 568) + (box?.height ?? 0)).toBeLessThanOrEqual(
                568,
            );
        }

        await component.update(
            <DriverCurrentPickupCommandStory readyToConfirm />,
        );
        const confirmBox = await page
            .getByRole('button', {
                name: 'Potvrdi preuzimanje i nastavi',
            })
            .boundingBox();
        expect(confirmBox).not.toBeNull();
        expect(
            (confirmBox?.y ?? 568) + (confirmBox?.height ?? 0),
        ).toBeLessThanOrEqual(568);
    });

    test('keeps pickup recovery and its failure beside the pickup command', async ({
        mount,
        page,
    }) => {
        await mount(
            <DriverCurrentPickupCommandStory syncState="failed" failRecovery />,
        );
        const syncAlert = page.getByRole('alert', {
            name: 'Status radnje: preuzimanje',
        });
        const retry = page.getByRole('button', { name: 'Pokušaj ponovno' });
        await expect(retry).toBeInViewport();
        await retry.click();

        const recoveryError = page.getByRole('alert').filter({
            hasText: 'Pokušaj preuzimanja nije uspio.',
        });
        await expect(recoveryError).toBeInViewport();
        const syncBox = await syncAlert.boundingBox();
        const errorBox = await recoveryError.boundingBox();
        expect(syncBox).not.toBeNull();
        expect(errorBox).not.toBeNull();
        const syncBottom =
            (syncBox?.y ?? 0) + (syncBox?.height ?? Number.MAX_VALUE);
        expect(errorBox?.y ?? 0).toBeGreaterThanOrEqual(syncBottom);
        expect((errorBox?.y ?? 0) - syncBottom).toBeLessThanOrEqual(12);
    });
});

test('uses section-level current-command headings in live and offline route views', async ({
    mount,
    page,
}) => {
    const component = await mount(<DriverDashboardServerAdvanceStory />);
    const currentSummary = () =>
        page.getByRole('region', { name: 'Sažetak trenutačne stanice' });

    await expect(
        currentSummary().getByRole('heading', { level: 2 }),
    ).toHaveCount(1);
    await expect(
        currentSummary().getByRole('heading', { level: 3 }),
    ).toHaveCount(0);

    await component.update(<OfflineRouteArrivalStory />);
    await expect(
        currentSummary().getByRole('heading', { level: 2 }),
    ).toHaveCount(1);
    await expect(
        currentSummary().getByRole('heading', { level: 3 }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('heading', {
            level: 3,
            name: 'Tijek rute',
        }),
    ).toBeVisible();
});

test('reveals read-only recipient and harvest details from the compact route timeline', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardServerAdvanceStory />);
    const currentSummary = page.getByRole('region', {
        name: 'Sažetak trenutačne stanice',
    });
    const beforeDocumentTop = await currentSummary.evaluate(
        (element) =>
            (element.parentElement?.getBoundingClientRect().top ?? 0) +
            window.scrollY,
    );
    const timeline = page.getByRole('list', {
        name: 'Tijek dostavne rute',
    });
    const nextRow = timeline.getByRole('listitem').nth(1);

    await nextRow.getByRole('button').click();
    await expect(
        nextRow.getByText('Telefon: +385 91 555 0101').first(),
    ).toBeVisible();
    await expect(
        nextRow.getByText('Rajčica za predaju · Gredica D'),
    ).toBeVisible();
    await expect(nextRow.getByRole('button')).toHaveCount(1);

    const afterDocumentTop = await currentSummary.evaluate(
        (element) =>
            (element.parentElement?.getBoundingClientRect().top ?? 0) +
            window.scrollY,
    );
    expect(Math.abs(afterDocumentTop - beforeDocumentTop)).toBeLessThanOrEqual(
        1,
    );
});

test('arrived stop exposes advisory scanning and delivers with its local note', async ({
    mount,
    page,
}) => {
    await mount(<DriverCurrentDeliveryCommandStory arrived />);
    await expect(
        page.getByRole('button', { name: 'Provjeri QR kodove' }),
    ).toBeEnabled();
    await expect(
        page.getByText('Provjera nije obavezna i ne blokira potvrdu dostave.'),
    ).toBeVisible();
    await page.getByLabel('Napomena o predaji').fill('Predano susjedu');
    await page.getByRole('button', { name: /Dostavi 3 · dalje/ }).click();
    await expect(page.getByTestId('current-stop-result')).toHaveText(
        'delivered:Predano susjedu',
    );
});

test('queued arrival stays attached to arrival while delivery remains available', async ({
    mount,
    page,
}) => {
    await mount(
        <DriverCurrentDeliveryCommandStory
            syncState="queued"
            arrived={false}
        />,
    );
    await expect(
        page.getByRole('alert', { name: 'Status radnje: Dolazak' }),
    ).toContainText('Dolazak: Radnja je spremljena na uređaju');
    await expect(
        page.getByRole('button', { name: 'Dolazak čeka potvrdu' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: /Dostavi 3 · dalje/ }),
    ).toBeEnabled();
});

test('sending and acknowledged arrivals keep truthful command-local status', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <DriverCurrentDeliveryCommandStory syncState="sending" />,
    );
    await expect(
        page.getByRole('alert', { name: 'Status radnje: Dolazak' }),
    ).toContainText('Radnja se šalje i još nije potvrđena.');

    await component.update(
        <DriverCurrentDeliveryCommandStory syncState="synced" />,
    );
    await expect(
        page.getByRole('button', { name: 'Dolazak potvrđen' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('alert', { name: 'Status radnje: Dolazak' }),
    ).toContainText('Poslužitelj je potvrdio radnju');
});

test('failed and conflicted commands recover beside the command that failed', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <DriverCurrentDeliveryCommandStory
            arrived
            syncKind="deliver"
            syncState="failed"
        />,
    );
    await expect(
        page.getByRole('alert', { name: 'Status radnje: Dostava' }),
    ).toContainText('Dostava: Radnja je spremljena na uređaju');
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.getByTestId('current-stop-result')).toHaveText('retried');

    await component.update(
        <DriverCurrentDeliveryCommandStory
            arrived
            syncKind="deliver"
            syncState="conflicted"
        />,
    );
    await expect(
        page.getByRole('alert', { name: 'Status radnje: Dostava' }),
    ).toContainText('Poslužitelj ima noviju verziju rute.');
    await page
        .getByRole('button', { name: 'Učitaj stanje poslužitelja' })
        .click();
    await expect(page.getByTestId('current-stop-result')).toHaveText(
        'discarded',
    );

    await component.update(
        <DriverCurrentDeliveryCommandStory
            arrived
            syncKind="deliver"
            syncState="reconciling"
        />,
    );
    await expect(
        page.getByRole('alert', { name: 'Status radnje: Dostava' }),
    ).toContainText('novi plan rute još nije učitan');
    await page.getByRole('button', { name: 'Osvježi novi plan' }).click();
    await expect(page.getByTestId('current-stop-result')).toHaveText(
        'reconciled',
    );
});

test('enqueue failure remains local to the arrival command', async ({
    mount,
    page,
}) => {
    await mount(<DriverCurrentDeliveryCommandStory throwOnArrive />);
    await page.getByRole('button', { name: 'Stigao sam' }).click();
    await expect(page.getByRole('alert')).toContainText(
        'Dolazak nije spremljen na uređaj.',
    );
});

test('deferred stop presents retry as its only route mutation', async ({
    mount,
    page,
}) => {
    await mount(<DriverCurrentDeferredCommandStory />);
    await expect(
        page.getByRole('heading', { name: '2 uroda · skupna dostava' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Navigacija čeka novi plan' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Pokreni ponovni pokušaj' }),
    ).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Stigao sam' })).toHaveCount(
        0,
    );
    await page.getByRole('button', { name: 'Pokreni ponovni pokušaj' }).click();
    await expect(page.getByTestId('current-stop-result')).toHaveText('retried');
});

test('offline deferred stop does not present an actionable no-op retry', async ({
    mount,
    page,
}) => {
    await mount(
        <DriverCurrentDeferredCommandStory offline retryAvailable={false} />,
    );
    await expect(
        page.getByRole('button', {
            name: 'Ponovni pokušaj nakon povratka veze',
        }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', {
            name: 'Navigacija do trenutačne stanice čeka novi plan',
        }),
    ).toBeDisabled();
});

test('late current-stop estimate remains visible beside the command', async ({
    mount,
    page,
}) => {
    await mount(<DriverCurrentDeliveryCommandStory late />);
    await expect(page.getByRole('alert')).toContainText(
        'Trenutačna procjena dolaska je nakon završetka termina.',
    );
});

test('dashboard advancement clears private state and focuses every server-driven current command', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardServerAdvanceStory />);
    await page.getByLabel('Napomena o predaji').fill('Privatna napomena A');
    await page.getByRole('button', { name: /Dostavljeno · dalje/ }).click();
    await expect(
        page.getByRole('alert').filter({
            hasText: 'Dostava nije spremljena.',
        }),
    ).toBeVisible();

    await page
        .getByRole('button', { name: 'Simuliraj potvrdu poslužitelja' })
        .click();

    await expect(page.getByLabel('Napomena o predaji')).toHaveValue('');
    await expect(page.getByText('Dostava nije spremljena.')).toHaveCount(0);
    const summary = page.getByRole('region', {
        name: 'Sažetak trenutačne stanice',
    });
    await expect(summary).toBeFocused();
    const summaryBox = await summary.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(summaryBox?.y ?? 0).toBeGreaterThanOrEqual(64);
    await expect(
        page.getByRole('status', {
            name: 'Promjena trenutačne stanice',
        }),
    ).toContainText('Trenutačna stanica je Vukovarska 42, Zagreb.');
});

test('pickup manifest advancement resets local state and announces the new slot', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardPickupManifestAdvanceStory />);
    await page
        .getByRole('button', { name: 'Preuzeto bez QR etikete' })
        .first()
        .click();
    await expect(page.getByRole('alert')).toContainText(
        'Ishod preuzimanja nije spremljen.',
    );

    await page.getByRole('button', { name: 'Potvrdi prvi manifest' }).click();
    await expect(
        page.getByText('Ishod preuzimanja nije spremljen.'),
    ).toHaveCount(0);
    await expect(
        page.getByRole('region', { name: 'Sažetak trenutačne stanice' }),
    ).toBeFocused();
    await expect(
        page.getByRole('status', {
            name: 'Promjena trenutačne stanice',
        }),
    ).toContainText('11:00');
});

test('locally projected pickup waits for the server checkpoint before accepting mutations', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardCrossQueuePickupStory />);
    await expect(
        page.getByText(
            'Prethodna radnja još čeka potvrdu rute. Preuzimanje će se otključati čim poslužitelj potvrdi ovu lokaciju.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Skeniraj urode' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Preuzeto bez QR etikete' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('link', {
            name: 'Navigacija do trenutačne stanice preuzimanja',
        }),
    ).toBeEnabled();
});

test('earlier pickup conflict blocks current mutations and exposes recovery without blocking navigation', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardEarlierPickupConflictStory />);
    await expect(
        page.getByText(
            /Ranija radnja preuzimanja blokira sinkronizaciju ove rute/,
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Skeniraj urode' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Preuzeto bez QR etikete' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('link', {
            name: 'Navigacija do trenutačne stanice preuzimanja',
        }),
    ).toBeEnabled();

    await page
        .getByRole('button', { name: 'Odbaci promjenu i osvježi' })
        .click();
    await expect(page.getByTestId('pickup-recovery-result')).toHaveText(
        'pickup-earlier-conflict',
    );
});

test('earlier retryable pickup failure also blocks current mutations until recovery', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardEarlierPickupFailureStory />);
    await expect(
        page.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toBeEnabled();
    await expect(
        page.getByRole('button', { name: 'Skeniraj urode' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Preuzeto bez QR etikete' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('link', {
            name: 'Navigacija do trenutačne stanice preuzimanja',
        }),
    ).toBeEnabled();
});

test('earlier pickup retry keeps current mutations blocked while the old command is sending', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <DriverDashboardEarlierPickupDeferredRetryStory />,
    );
    const scan = page.getByRole('button', { name: 'Skeniraj urode' });
    const confirm = page.getByRole('button', {
        name: 'Potvrdi preuzimanje i nastavi',
    });

    await expect(scan).toBeDisabled();
    await expect(confirm).toBeDisabled();
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();

    await expect(page.getByTestId('pickup-queue-state')).toHaveText('queued');
    await expect(
        page.getByText(/Ranija radnja preuzimanja čeka slanje/),
    ).toBeVisible();
    await expect(scan).toBeDisabled();
    await expect(confirm).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);

    await component.update(
        <DriverDashboardEarlierPickupDeferredRetryStory sendRetry />,
    );
    await expect(page.getByTestId('pickup-queue-state')).toHaveText('sending');
    await expect(
        page.getByText(/Ranija radnja preuzimanja se šalje/),
    ).toBeVisible();
    await expect(scan).toBeDisabled();
    await expect(confirm).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);

    await component.update(
        <DriverDashboardEarlierPickupDeferredRetryStory completeRetry />,
    );
    await expect(page.getByTestId('pickup-queue-state')).toHaveText('synced');
    await expect(scan).toBeEnabled();
    await expect(confirm).toBeEnabled();
});

test('locally projected deferred stop withholds direct retry until server confirmation', async ({
    mount,
    page,
}) => {
    await mount(<DriverDashboardLocallyAdvancedDeferredStory />);
    await expect(
        page.getByRole('button', {
            name: 'Ponovni pokušaj čeka potvrdu rute',
        }),
    ).toBeDisabled();
});

test('pickup command owns navigation and live scanning with an offline fallback', async ({
    mount,
    page,
}) => {
    const component = await mount(<DriverCurrentPickupCommandStory />);
    await expect(
        page.getByRole('link', {
            name: 'Navigacija do trenutačne stanice preuzimanja',
        }),
    ).toBeEnabled();
    await expect(
        page.getByRole('button', { name: 'Skeniraj urode' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Preuzeto bez QR etikete' }).click();
    await expect(page.getByTestId('current-stop-result')).toHaveText(
        'item:missing-label',
    );

    await component.update(<DriverCurrentPickupCommandStory readyToConfirm />);
    await page
        .getByRole('button', { name: 'Potvrdi preuzimanje i nastavi' })
        .click();
    await expect(page.getByTestId('current-stop-result')).toHaveText(
        'confirmed',
    );

    await component.update(
        <DriverCurrentPickupCommandStory offline routeSyncBlocked />,
    );
    await expect(
        page.getByRole('button', { name: 'Skeniranje nije dostupno' }),
    ).toBeDisabled();
    await expect(
        page.getByText(
            'Skeniranje i potvrda preuzimanja nastavljaju se nakon povratka veze.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: 'Navigacija do trenutačne stanice preuzimanja čeka novi plan',
        }),
    ).toBeDisabled();
});

test('pickup recovery failure remains inside the pickup command', async ({
    mount,
    page,
}) => {
    await mount(
        <DriverCurrentPickupCommandStory syncState="failed" failRecovery />,
    );
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(
        page.getByRole('alert').filter({
            hasText: 'Pokušaj preuzimanja nije uspio.',
        }),
    ).toBeVisible();
});

test('failed durable pickup scan stays retryable and never reports success', async ({
    mount,
    page,
}) => {
    await mount(<DriverCurrentPickupCommandStory failScan />);
    await page.getByRole('button', { name: 'Skeniraj urode' }).click();
    const manualInput = page.getByLabel('Ručni unos');
    for (const attempt of [1, 2]) {
        await manualInput.fill('/trag/pickup-current-0001');
        await page.getByRole('button', { name: 'Dodaj kod' }).click();
        await expect(page.getByTestId('scan-attempts')).toHaveText(
            String(attempt),
        );
        await expect(
            page
                .getByText(
                    'Očitavanje nije sigurno spremljeno. Skeniraj QR kod ponovno.',
                )
                .first(),
        ).toBeVisible();
        await expect(page.getByText('0 očitano')).toBeVisible();
    }
});

test('late durable scan completion cannot leak into a reopened scanner session', async ({
    mount,
    page,
}) => {
    const component = await mount(<HarvestTraceScannerSessionStory />);
    const openScanner = page.getByRole('button', { name: 'Skeniraj urode' });

    await openScanner.click();
    await page.getByLabel('Ručni unos').fill('/trag/stari-urod');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(page.getByText('1 očitano')).toBeVisible();
    await page.getByRole('button', { name: 'Završi skeniranje' }).click();

    await openScanner.click();
    await expect(page.getByText('0 očitano')).toBeVisible();
    await page.getByLabel('Ručni unos').fill('/trag/novi-urod');
    await page.getByRole('button', { name: 'Dodaj kod' }).click();
    await expect(page.getByText('1 očitano')).toBeVisible();

    await component.update(
        <HarvestTraceScannerSessionStory releaseFirstScan />,
    );
    await expect(page.getByText(/Novi urod · očitano/)).toBeVisible();
    await expect(page.getByText(/Stari urod · očitano/)).toHaveCount(0);
    await expect(page.getByText('1 očitano')).toBeVisible();
});
