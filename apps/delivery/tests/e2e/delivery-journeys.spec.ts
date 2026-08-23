import { expect, test } from '@playwright/test';
import {
    emitGeolocation,
    installGeolocationDouble,
} from '../deliveryBrowserDoubles';
import {
    customerJourneyDashboard,
    driverActiveDashboard,
    driverPlanningDashboard,
} from './deliveryJourneyFixtures';
import { installDeliveryTestSession } from './deliveryTestSession';

function json(body: object, status = 200) {
    return {
        body: JSON.stringify(body),
        contentType: 'application/json',
        status,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

const operatorCases = [
    {
        displayName: 'Admin Dostavljač',
        role: 'admin',
        roleLabel: 'Admin vozač',
    },
    {
        displayName: 'Vozač Dostavljač',
        role: 'driver',
        roleLabel: 'Vozač',
    },
] as const;

for (const operator of operatorCases) {
    test(`${operator.role} recovers a local start failure, starts a bulk route, uploads GPS, and completes the stop`, async ({
        baseURL,
        page,
    }) => {
        if (!baseURL) throw new Error('Delivery E2E requires a baseURL.');
        await installGeolocationDouble(page);
        await installDeliveryTestSession({
            baseURL,
            page,
            role: operator.role,
            userId: `${operator.role}-quality-4146`,
        });
        let active = false;
        let preflightCalls = 0;
        const selectedRequestIds: string[][] = [];
        const locationBodies: object[] = [];
        const deliveryBodies: Array<Record<string, unknown>> = [];

        await page.route('**/api/users/current-claims', (route) =>
            route.fulfill(
                json({
                    id: `${operator.role}-quality-4146`,
                    userName: operator.displayName,
                    role: operator.role,
                    accounts: [{ accountId: 'account-delivery-quality-4146' }],
                }),
            ),
        );
        await page.route('**/api/dashboard**', (route) =>
            route.fulfill(
                json(
                    active
                        ? driverActiveDashboard(operator.role)
                        : driverPlanningDashboard(operator.role),
                ),
            ),
        );
        await page.route('**/api/driver/runs/preflight', async (route) => {
            preflightCalls += 1;
            const body: unknown = route.request().postDataJSON();
            if (
                typeof body === 'object' &&
                body !== null &&
                'deliveryRequestIds' in body &&
                Array.isArray(body.deliveryRequestIds)
            ) {
                selectedRequestIds.push(
                    body.deliveryRequestIds.filter(
                        (value): value is string => typeof value === 'string',
                    ),
                );
            }
            if (preflightCalls === 1) {
                await route.fulfill(
                    json({ error: 'Privremena pogreška pripreme.' }, 503),
                );
                return;
            }
            await route.fulfill(
                json({
                    preparationToken: 'preparation-quality-4146',
                    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
                }),
            );
        });
        await page.route('**/api/driver/runs', async (route) => {
            active = true;
            await route.fulfill(json({ runId: 'run-quality-4146' }));
        });
        await page.route(
            '**/api/driver/runs/run-quality-4146/location',
            async (route) => {
                const body: unknown = route.request().postDataJSON();
                if (typeof body === 'object' && body !== null) {
                    locationBodies.push(body);
                }
                const acceptedAt = new Date().toISOString();
                await route.fulfill(
                    json({
                        status: 'live',
                        acceptedAt,
                        refreshedAt: acceptedAt,
                        replayed: false,
                    }),
                );
            },
        );
        await page.route(
            '**/api/driver/runs/run-quality-4146/stops/101/handoff/mutations',
            (route) =>
                route.fulfill(
                    json({
                        runId: 'run-quality-4146',
                        targetStopId: 101,
                        version: 1,
                        retryAttempt: 0,
                        items: [
                            {
                                stopId: 101,
                                deliveryRequestId:
                                    'request-tomato-quality-4146',
                                retryAttempt: 0,
                                traceLinkId: 1,
                                qrAvailable: true,
                                state: 'unverified',
                                reason: null,
                                verifiedAt: null,
                            },
                            {
                                stopId: 102,
                                deliveryRequestId: 'request-basil-quality-4146',
                                retryAttempt: 0,
                                traceLinkId: 2,
                                qrAvailable: true,
                                state: 'unverified',
                                reason: null,
                                verifiedAt: null,
                            },
                        ],
                        expectedCount: 2,
                        scannedCount: 0,
                        unverifiedCount: 2,
                        noLabelCount: 0,
                        missingCount: 0,
                        skippedCount: 0,
                    }),
                ),
        );
        await page.route(
            '**/api/driver/runs/run-quality-4146/stops/101/deliver',
            async (route) => {
                const body: unknown = route.request().postDataJSON();
                if (!isRecord(body)) {
                    await route.abort();
                    return;
                }
                deliveryBodies.push(body);
                const clientOperationId = Reflect.get(
                    body,
                    'clientOperationId',
                );
                await route.fulfill(
                    json({
                        clientOperationId,
                        replayed: false,
                        result: {
                            kind: 'deliver',
                            targetStopId: 101,
                            affectedStopIds: [101, 102],
                            routeRevision: 2,
                            reroutePending: false,
                            runCompleted: true,
                            override: {
                                reason: 'manual-handoff',
                                bypassed: ['handoff-review'],
                            },
                        },
                    }),
                );
            },
        );

        const response = await page.goto('/');
        expect(response?.ok()).toBe(true);
        await expect(
            page.getByText(operator.roleLabel, { exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Još nije spremno')).toBeVisible();

        const selectReady = page.getByRole('button', {
            name: 'Odaberi sve spremne',
        });
        await selectReady.focus();
        await selectReady.press('Enter');
        await expect(page.getByText('2 uroda', { exact: true })).toBeVisible();
        const startRoute = page.getByRole('button', {
            name: /Pokreni rutu s 2/,
        });
        await startRoute.click();
        await expect(
            page
                .getByRole('alert')
                .filter({ hasText: 'Privremena pogreška pripreme.' }),
        ).toBeVisible();
        await expect(startRoute).toBeEnabled();
        await startRoute.click();

        await expect(
            page.getByRole('heading', { name: '2 uroda · skupna dostava' }),
        ).toBeVisible();
        expect(selectedRequestIds).toEqual([
            ['request-tomato-quality-4146', 'request-basil-quality-4146'],
            ['request-tomato-quality-4146', 'request-basil-quality-4146'],
        ]);

        await expect(page.locator('html')).toHaveAttribute(
            'data-geolocation-watch-count',
            '1',
        );
        const capturedAt = await page.evaluate(() => Date.now());
        await emitGeolocation(page, {
            latitude: 45.815,
            longitude: 15.982,
            timestamp: capturedAt,
        });
        await expect(
            page.getByRole('group', { name: 'Status GPS praćenja' }),
        ).toContainText('GPS praćenje je aktivno');
        expect(locationBodies).toHaveLength(1);

        await page.getByRole('button', { name: 'Dostavi 2 · dalje' }).click();
        const confirmation = page.getByRole('dialog', {
            name: 'Potvrdi dostavu',
        });
        await expect(confirmation.getByRole('status')).toContainText(
            '2 očekivana uroda',
        );
        await confirmation
            .getByLabel('Razlog operativne iznimke')
            .selectOption('manual-handoff');
        await confirmation
            .getByRole('button', { name: 'Potvrdi iznimku i dostavu' })
            .click();
        await expect(
            page.getByRole('status').filter({ hasText: 'Ruta je završena' }),
        ).toBeVisible();
        expect(deliveryBodies).toHaveLength(1);
        expect(deliveryBodies[0]).toMatchObject({
            expectedRouteRevision: 1,
            completionOverride: { reason: 'manual-handoff' },
        });
    });
}

test('customer browser journey keeps live tracking and history visible through a failed refresh and focused recovery', async ({
    baseURL,
    page,
}) => {
    if (!baseURL) throw new Error('Delivery E2E requires a baseURL.');
    await installDeliveryTestSession({
        baseURL,
        page,
        role: 'user',
        userId: 'user-quality-4146',
    });
    let failRefresh = false;
    let releaseInitialDashboard: () => void = () => undefined;
    const initialDashboardGate = new Promise<void>((resolve) => {
        releaseInitialDashboard = resolve;
    });
    let dashboardCalls = 0;

    await page.route('**/api/users/current-claims', (route) =>
        route.fulfill(
            json({
                id: 'user-quality-4146',
                userName: 'Korisnik Korina',
                role: 'user',
                accounts: [{ accountId: 'account-delivery-quality-4146' }],
            }),
        ),
    );
    await page.route('**/api/dashboard**', async (route) => {
        dashboardCalls += 1;
        if (dashboardCalls === 1) await initialDashboardGate;
        await route.fulfill(
            failRefresh
                ? json({ error: 'Synthetic refresh failure.' }, 503)
                : json(customerJourneyDashboard()),
        );
    });
    await page.route('**/api/map/run-customer-quality-4146**', (route) =>
        route.fulfill({
            body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'),
            contentType: 'image/gif',
            status: 200,
        }),
    );

    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    await expect(
        page.getByText('Učitavanje dostava…', { exact: true }),
    ).toBeVisible();
    releaseInitialDashboard();

    await expect(
        page.getByRole('heading', { name: 'Moje dostave' }),
    ).toBeVisible();
    await expect(
        page.getByRole('status').filter({
            hasText: 'Lokacija vozača je uživo.',
        }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('alert')
            .filter({ hasText: 'Vozač je stigao na lokaciju dostave.' }),
    ).toBeVisible();

    const history = page.getByTestId('customer-history-section');
    const revealHistory = history.getByRole('button', {
        name: 'Prikaži još (1)',
    });
    await revealHistory.focus();
    await revealHistory.press('Enter');
    await expect(
        history.getByRole('article', {
            name: 'Nova stavka povijesti: Dostavljeni urod 7',
        }),
    ).toBeFocused();
    await expect(history.getByRole('status')).toHaveText(
        'Prikazano 7 od 7 stavki povijesti.',
    );

    failRefresh = true;
    const callsBeforeFailedRefresh = dashboardCalls;
    await expect
        .poll(() => dashboardCalls, { timeout: 12_000 })
        .toBeGreaterThan(callsBeforeFailedRefresh);
    await expect(
        page.getByRole('alert').filter({ hasText: 'Podaci nisu ažurni' }),
    ).toContainText('Prikazujemo zadnje potvrđene podatke', {
        timeout: 10_000,
    });
    await expect(
        page.getByRole('heading', { name: 'Aktivna rajčica' }),
    ).toBeVisible();

    failRefresh = false;
    const refresh = page.getByRole('button', { name: 'Osvježi podatke' });
    await refresh.focus();
    await refresh.press('Enter');
    const recovered = page.getByRole('status', {
        name: 'Podaci su ponovno ažurni',
    });
    await expect(recovered).toBeVisible();
    await expect(recovered).toBeFocused();
    expect(dashboardCalls).toBeGreaterThanOrEqual(3);
});
