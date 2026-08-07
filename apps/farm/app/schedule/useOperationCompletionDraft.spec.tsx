import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    FARM_OFFLINE_DATABASE_NAME,
    FARM_OFFLINE_DATABASE_VERSION,
    OPERATION_COMPLETION_DRAFT_STORE_NAME,
    OPERATION_COMPLETION_QUEUE_STORE_NAME,
} from '../../lib/offline/operationCompletionDraftStore';
import { OperationCompletionDraftHookHarness } from '../../playwright/OperationCompletionDraftHookHarness';

declare global {
    interface Window {
        __restoreOperationDraftPutForHookTest?: () => void;
    }
}

const scope = {
    accountId: 'account-hook',
    expectedEntityId: 701,
    expectedTaskVersionEventId: 801,
    operationId: 901,
    operationLabel: 'Zalij rajčice',
    requirementsFingerprint: 'images:optional|notes:optional',
    scheduleDateKey: '2026-07-15',
    sessionIncarnation: 'session-hook',
    userId: 'farmer-hook',
} as const;

async function readStoredCompletionRecords(page: Page) {
    return page.evaluate(
        async ({
            databaseName,
            databaseVersion,
            draftStoreName,
            queueStoreName,
        }) => {
            const database = await new Promise<IDBDatabase>(
                (resolve, reject) => {
                    const request = indexedDB.open(
                        databaseName,
                        databaseVersion,
                    );
                    request.addEventListener('success', () =>
                        resolve(request.result),
                    );
                    request.addEventListener('error', () =>
                        reject(
                            request.error ?? new Error('Database open failed'),
                        ),
                    );
                },
            );
            try {
                const transaction = database.transaction(
                    [draftStoreName, queueStoreName],
                    'readonly',
                );
                const all = (storeName: string) =>
                    new Promise<unknown[]>((resolve, reject) => {
                        const request = transaction
                            .objectStore(storeName)
                            .getAll();
                        request.addEventListener('success', () =>
                            resolve(request.result),
                        );
                        request.addEventListener('error', () =>
                            reject(
                                request.error ??
                                    new Error('Database read failed'),
                            ),
                        );
                    });
                const [drafts, queue] = await Promise.all([
                    all(draftStoreName),
                    all(queueStoreName),
                ]);
                return { drafts, queue };
            } finally {
                database.close();
            }
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            draftStoreName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
            queueStoreName: OPERATION_COMPLETION_QUEUE_STORE_NAME,
        },
    );
}

test('hands the latest form to the queue before the debounce can recreate a draft', async ({
    mount,
    page,
}) => {
    let component = await mount(
        <OperationCompletionDraftHookHarness {...scope} />,
    );
    await expect(page.getByTestId('operation-draft-gate')).toHaveText(
        '{"kind":"none"}',
    );

    await page.getByLabel('Napomena').fill('Zaliveno prije večernje smjene.');
    await page.getByRole('button', { name: 'Predaj u red' }).click();

    await expect(
        page.getByTestId('operation-draft-handoff-result'),
    ).toContainText('"status":"enqueued"');
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"kind":"queued"',
    );
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"scheduleDateKey":"2026-07-15"',
    );
    const firstGate = JSON.parse(
        (await page.getByTestId('operation-draft-gate').textContent()) ?? '{}',
    ) as { item?: { submissionId?: string } };
    expect(firstGate.item?.submissionId).toMatch(/^[0-9a-f-]{36}$/u);

    await component.unmount();
    await page.waitForTimeout(400);
    const stored = await readStoredCompletionRecords(page);
    expect(
        stored.drafts.filter(
            (value) =>
                typeof value === 'object' &&
                value !== null &&
                'operationId' in value,
        ),
    ).toHaveLength(0);
    expect(stored.queue).toHaveLength(1);
    expect(stored.queue[0]).toMatchObject({
        notes: 'Zaliveno prije večernje smjene.',
        operationLabel: 'Zalij rajčice',
        scheduleDateKey: '2026-07-15',
        submissionId: firstGate.item?.submissionId,
    });

    component = await mount(<OperationCompletionDraftHookHarness {...scope} />);
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"kind":"queued"',
    );
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        firstGate.item?.submissionId ?? 'missing-submission-id',
    );
    await component.unmount();
});

test('serializes handoff after an in-flight draft save', async ({
    mount,
    page,
}) => {
    await mount(<OperationCompletionDraftHookHarness {...scope} />);
    await expect(page.getByTestId('operation-draft-gate')).toHaveText(
        '{"kind":"none"}',
    );
    await page.evaluate(() => {
        const originalPut = Object.getOwnPropertyDescriptor(
            IDBObjectStore.prototype,
            'put',
        );
        const nativePut = IDBObjectStore.prototype.put;
        window.__restoreOperationDraftPutForHookTest = () => {
            if (originalPut) {
                Object.defineProperty(
                    IDBObjectStore.prototype,
                    'put',
                    originalPut,
                );
            } else {
                Reflect.deleteProperty(IDBObjectStore.prototype, 'put');
            }
            delete window.__restoreOperationDraftPutForHookTest;
        };
        Object.defineProperty(IDBObjectStore.prototype, 'put', {
            configurable: true,
            value: function delayedDraftPut(
                this: IDBObjectStore,
                value: unknown,
                key?: IDBValidKey,
            ) {
                const request =
                    key === undefined
                        ? nativePut.call(this, value)
                        : nativePut.call(this, value, key);
                const isTargetDraft =
                    this.name === 'operation-completion-drafts' &&
                    typeof value === 'object' &&
                    value !== null &&
                    'notes' in value &&
                    value.notes === 'Pričekaj završetak prve lokalne pohrane.';
                if (!isTargetDraft) return request;
                const nativeAddEventListener = request.addEventListener;
                Object.defineProperty(request, 'addEventListener', {
                    configurable: true,
                    value: (
                        type: string,
                        listener: EventListenerOrEventListenerObject | null,
                        options?: boolean | AddEventListenerOptions,
                    ) => {
                        if (type !== 'success' || listener === null) {
                            return Reflect.apply(
                                nativeAddEventListener,
                                request,
                                [type, listener, options],
                            );
                        }
                        const delayedListener = (event: Event) => {
                            window.setTimeout(() => {
                                if (typeof listener === 'function') {
                                    listener.call(request, event);
                                } else {
                                    listener.handleEvent(event);
                                }
                            }, 500);
                        };
                        return Reflect.apply(nativeAddEventListener, request, [
                            type,
                            delayedListener,
                            options,
                        ]);
                    },
                });
                return request;
            },
        });
        window.addEventListener(
            'pagehide',
            () => {
                window.__restoreOperationDraftPutForHookTest?.();
            },
            { once: true },
        );
    });

    await page
        .getByLabel('Napomena')
        .fill('Pričekaj završetak prve lokalne pohrane.');
    await expect(page.getByTestId('operation-draft-save-state')).toContainText(
        '"kind":"saving"',
    );
    await page.getByRole('button', { name: 'Predaj u red' }).click();
    await expect(
        page.getByTestId('operation-draft-handoff-result'),
    ).toContainText('"status":"enqueued"');

    const stored = await readStoredCompletionRecords(page);
    expect(
        stored.drafts.filter(
            (value) =>
                typeof value === 'object' &&
                value !== null &&
                'operationId' in value,
        ),
    ).toHaveLength(0);
    expect(stored.queue[0]).toMatchObject({
        notes: 'Pričekaj završetak prve lokalne pohrane.',
    });
    await page.evaluate(() => {
        window.__restoreOperationDraftPutForHookTest?.();
    });
});

test('restores a server-confirmed queue tombstone as a blocking gate', async ({
    mount,
    page,
}) => {
    let component = await mount(
        <OperationCompletionDraftHookHarness {...scope} />,
    );
    await expect(page.getByTestId('operation-draft-gate')).toHaveText(
        '{"kind":"none"}',
    );
    await page.getByLabel('Napomena').fill('Potvrđeno na poslužitelju.');
    await page.getByRole('button', { name: 'Predaj u red' }).click();
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"kind":"queued"',
    );
    await page.getByRole('button', { name: 'Označi potvrđeno' }).click();
    await expect(
        page.getByTestId('operation-draft-confirmation-result'),
    ).toHaveText('{"status":"ok"}');
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"kind":"server_confirmed"',
    );

    await component.unmount();
    component = await mount(<OperationCompletionDraftHookHarness {...scope} />);
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"kind":"server_confirmed"',
    );
    await expect(page.getByTestId('operation-draft-gate')).toContainText(
        '"contentAvailable":false',
    );
    await component.unmount();
});
