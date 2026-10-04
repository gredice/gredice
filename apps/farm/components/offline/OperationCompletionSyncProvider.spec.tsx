import AxeBuilder from '@axe-core/playwright';
import {
    type ComponentFixtures,
    expect,
    test,
} from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { OperationCompletionSyncProviderHarness } from '../../playwright/OperationCompletionSyncProviderHarness';
import { OfflineQueueCompleteOperationModalStory } from '../../playwright/ScheduleTaskAttemptVersionStories';

type AnalyticsEvent = {
    eventName: string;
    properties: Record<string, unknown>;
};

declare global {
    interface Window {
        recordFarmSyncAnalytics?: (event: unknown) => void;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function captureAnalytics(page: Page) {
    const events: AnalyticsEvent[] = [];
    await page.exposeFunction('recordFarmSyncAnalytics', (event: unknown) => {
        if (
            isRecord(event) &&
            typeof event.eventName === 'string' &&
            isRecord(event.properties)
        ) {
            events.push({
                eventName: event.eventName,
                properties: event.properties,
            });
        }
    });
    await page.evaluate(() => {
        window.addEventListener('gredice:farm-sync-analytics', (event) => {
            if (event instanceof CustomEvent) {
                window.recordFarmSyncAnalytics?.(event.detail);
            }
        });
    });
    return events;
}

async function seedQueuedCompletion({
    mount,
    operationId,
    page,
}: {
    mount: ComponentFixtures['mount'];
    operationId: number;
    page: Page;
}) {
    const component = await mount(
        <OfflineQueueCompleteOperationModalStory
            conditions={{ completionAttachNotes: true }}
            defaultOpen
            expectedEntityId={701}
            label="Privatna radnja za sinkronizaciju"
            operationId={operationId}
        />,
    );
    await page.context().setOffline(true);
    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    await dialog
        .getByPlaceholder('Upišite napomenu o završetku...')
        .fill('PRIVATNA_NAPOMENA_SINKRONIZACIJE');
    await expect(dialog.locator('[data-operation-draft-status]')).toHaveText(
        'Spremljeno samo na ovom uređaju — radnja još nije dovršena.',
    );
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();
    await expect(dialog.getByRole('status')).toContainText(
        'sigurno je spremljena samo na ovom uređaju',
    );
    await component.unmount();
    await page.context().setOffline(false);
}

test('drains one phone queue item to a content-free server receipt with private-safe analytics', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const analyticsEvents = await captureAnalytics(page);
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
        window.__farmSyncRouterRefreshes = 0;
    });
    await seedQueuedCompletion({ mount, operationId: 346, page });
    await page.evaluate(() => {
        if (window.__farmScheduleActionTestState) {
            window.__farmScheduleActionTestState.hold = true;
        }
    });

    const component = await mount(<OperationCompletionSyncProviderHarness />);
    const banner = component.locator('[data-operation-completion-sync-banner]');
    await expect(banner).toContainText('radnja se šalje');
    const reviewLink = banner.getByRole('link', { name: 'Pregledaj' });
    const reviewBounds = await reviewLink.boundingBox();
    expect(reviewBounds?.height).toBeGreaterThanOrEqual(44);
    expect(reviewBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
        (reviewBounds?.x ?? 0) + (reviewBounds?.width ?? 0),
    ).toBeLessThanOrEqual(320);

    await page.evaluate(() => {
        window.__farmScheduleActionTestState?.release?.();
    });
    await expect
        .poll(
            () =>
                page.evaluate(
                    () =>
                        window.__farmScheduleActionTestState?.operationCalls ??
                        0,
                ),
            { timeout: 5_000 },
        )
        .toBe(1);
    await expect(banner).toContainText('Radnja je spremljena na farmi');
    await expect(
        component.getByText('Predaja je potvrđena i čeka provjeru.'),
    ).toBeVisible();
    await expect
        .poll(() => page.evaluate(() => window.__farmSyncRouterRefreshes ?? 0))
        .toBe(1);

    const storedReceipt = await page.evaluate(
        () =>
            new Promise<{
                attachmentCount: number;
                label: string | null;
                notes: string | null;
                scheduleDateKey: string | null;
                state: string | null;
            }>((resolve, reject) => {
                const openRequest = indexedDB.open('gredice-farm-offline');
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const database = openRequest.result;
                    const transaction = database.transaction(
                        'operation-completion-queue',
                        'readonly',
                    );
                    const request = transaction
                        .objectStore('operation-completion-queue')
                        .getAll();
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        const candidate = request.result.find(
                            (value) =>
                                typeof value === 'object' &&
                                value !== null &&
                                'operationId' in value &&
                                value.operationId === 346,
                        );
                        const value =
                            typeof candidate === 'object' && candidate !== null
                                ? candidate
                                : null;
                        resolve({
                            attachmentCount:
                                value &&
                                'attachments' in value &&
                                Array.isArray(value.attachments)
                                    ? value.attachments.length
                                    : -1,
                            label:
                                value &&
                                'operationLabel' in value &&
                                typeof value.operationLabel === 'string'
                                    ? value.operationLabel
                                    : null,
                            notes:
                                value &&
                                'notes' in value &&
                                typeof value.notes === 'string'
                                    ? value.notes
                                    : null,
                            scheduleDateKey:
                                value &&
                                'scheduleDateKey' in value &&
                                (value.scheduleDateKey === null ||
                                    typeof value.scheduleDateKey === 'string')
                                    ? value.scheduleDateKey
                                    : null,
                            state:
                                value &&
                                'state' in value &&
                                typeof value.state === 'string'
                                    ? value.state
                                    : null,
                        });
                        database.close();
                    };
                };
            }),
    );
    expect(storedReceipt).toEqual({
        attachmentCount: 0,
        label: '',
        notes: '',
        scheduleDateKey: null,
        state: 'server_confirmed',
    });

    const acknowledgeReceipt = banner.getByRole('button', { name: 'U redu' });
    const acknowledgeBounds = await acknowledgeReceipt.boundingBox();
    expect(acknowledgeBounds?.height).toBeGreaterThanOrEqual(44);
    expect(
        (acknowledgeBounds?.x ?? 0) + (acknowledgeBounds?.width ?? 0),
    ).toBeLessThanOrEqual(320);
    await acknowledgeReceipt.click();
    await expect(banner).toHaveCount(0);
    await expect(
        component.getByText('Nema radnji koje čekaju slanje.'),
    ).toBeVisible();

    await expect
        .poll(
            () =>
                analyticsEvents.filter(
                    (event) =>
                        event.eventName ===
                        'farm_completion_sync_state_changed',
                ).length,
        )
        .toBeGreaterThanOrEqual(2);
    const serializedAnalytics = JSON.stringify(analyticsEvents);
    for (const privateValue of [
        'PRIVATNA_NAPOMENA_SINKRONIZACIJE',
        'Privatna radnja za sinkronizaciju',
        'account-test',
        'user-test',
        'session-test',
        '346',
    ]) {
        expect(serializedAnalytics).not.toContain(privateValue);
    }
    for (const event of analyticsEvents.filter(
        ({ eventName }) => eventName === 'farm_completion_sync_state_changed',
    )) {
        expect(Object.keys(event.properties).sort()).toEqual(
            expect.arrayContaining([
                'age_bucket',
                'attempt_bucket',
                'queue_size_bucket',
                'state',
                'surface',
                'trigger',
            ]),
        );
    }

    const accessibilityResults = await new AxeBuilder({ page }).analyze();
    expect(
        accessibilityResults.violations.filter(
            ({ impact }) => impact === 'serious' || impact === 'critical',
        ),
    ).toEqual([]);
});

test('keeps queued phone work visible without promising a send while rollback mode is off', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    await seedQueuedCompletion({ mount, operationId: 347, page });

    const component = await mount(
        <OperationCompletionSyncProviderHarness mode="off" />,
    );
    const banner = component.locator('[data-operation-completion-sync-banner]');
    await expect(banner).toContainText('1 radnja čeka dok je slanje pauzirano');
    await expect(banner).not.toContainText(
        'Otvori aplikaciju uz internetsku vezu',
    );
    await expect(
        component.getByText(
            'Automatsko slanje je pauzirano. Lokalni unosi ostaju na uređaju i vidljivi su za oporavak.',
        ),
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.operationCalls ?? 0,
            ),
        )
        .toBe(0);
});

test('hides queued private work immediately while auth is disabled and restores it only after the same session is authenticated again', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    await seedQueuedCompletion({ mount, operationId: 348, page });

    const component = await mount(
        <OperationCompletionSyncProviderHarness mode="off" />,
    );
    const privateLabel = component.getByText(
        'Privatna radnja za sinkronizaciju',
    );
    await expect(privateLabel).toBeVisible();

    await component.update(
        <OperationCompletionSyncProviderHarness enabled={false} mode="off" />,
    );
    await expect(privateLabel).toHaveCount(0);
    await expect(
        component.locator('[data-operation-completion-sync-banner]'),
    ).toHaveCount(0);
    await expect(component.locator('#sinkronizacija-radnji')).toHaveCount(0);

    await component.update(
        <OperationCompletionSyncProviderHarness mode="off" />,
    );
    await expect(privateLabel).toBeVisible();
    await expect(
        component.locator('[data-operation-completion-sync-banner]'),
    ).toContainText('1 radnja čeka dok je slanje pauzirano');
});

test('prevents an old in-flight session from refreshing the next auth boundary', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
        window.__farmSyncRouterRefreshes = 0;
    });
    await seedQueuedCompletion({ mount, operationId: 349, page });
    await page.evaluate(() => {
        if (window.__farmScheduleActionTestState) {
            window.__farmScheduleActionTestState.hold = true;
        }
    });

    const component = await mount(<OperationCompletionSyncProviderHarness />);
    await expect(
        component.locator('[data-operation-completion-sync-banner]'),
    ).toContainText('radnja se šalje');
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.operationCalls ?? 0,
            ),
        )
        .toBe(1);

    await component.update(
        <OperationCompletionSyncProviderHarness enabled={false} />,
    );
    await expect(
        component.getByText('Privatna radnja za sinkronizaciju'),
    ).toHaveCount(0);
    await component.update(<OperationCompletionSyncProviderHarness />);

    await page.evaluate(() => {
        window.__farmScheduleActionTestState?.release?.();
    });
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState
                        ?.operationResolutions ?? 0,
            ),
        )
        .toBe(1);
    expect(
        await page.evaluate(() => window.__farmSyncRouterRefreshes ?? 0),
    ).toBe(0);
    await expect(
        component.getByText('Privatna radnja za sinkronizaciju'),
    ).toBeVisible();
});
