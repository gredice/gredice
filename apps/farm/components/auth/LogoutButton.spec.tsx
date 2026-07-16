import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { CompleteOperationModal } from '../../app/schedule/CompleteOperationModal';
import {
    FARM_OFFLINE_DATABASE_NAME,
    FARM_OFFLINE_DATABASE_VERSION,
    OPERATION_COMPLETION_DRAFT_STORE_NAME,
    type OperationCompletionDraftScope,
} from '../../lib/offline/operationCompletionDraftStore';
import {
    LogoutWithLateModalMountStory,
    StaleLogoutWithCurrentModalStory,
} from '../../playwright/LogoutDraftStories';
import { OperationCompletionDraftStoreHarness } from '../../playwright/OperationCompletionDraftStoreHarness';
import { LogoutButton } from './LogoutButton';

const nextNavigationRouter = {
    back: () => undefined,
    bfcacheId: 'farm-logout-test',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

const currentUserId = 'farmer-current';
const otherUserId = 'farmer-other';
const currentSessionIncarnation = 'session-current';
const authoritativeUserId = 'farmer-authoritative';
const authoritativeSessionIncarnation = 'session-authoritative';

const draftScopes = [
    {
        accountId: 'account-a',
        expectedEntityId: 701,
        expectedTaskVersionEventId: 81,
        operationId: 41,
        requirementsFingerprint: 'none:optional',
        userId: currentUserId,
    },
    {
        accountId: 'account-b',
        expectedEntityId: 702,
        expectedTaskVersionEventId: 82,
        operationId: 42,
        requirementsFingerprint: 'none:optional',
        userId: currentUserId,
    },
    {
        accountId: 'account-c',
        expectedEntityId: 703,
        expectedTaskVersionEventId: 83,
        operationId: 43,
        requirementsFingerprint: 'none:optional',
        userId: otherUserId,
    },
] satisfies OperationCompletionDraftScope[];

function logoutButton(userId: string) {
    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <OperationCompletionDraftStoreHarness />
            <LogoutButton
                sessionIncarnation={currentSessionIncarnation}
                userId={userId}
            />
        </AppRouterContext.Provider>
    );
}

const logoutRaceScope = {
    accountId: 'account-logout-race',
    expectedEntityId: 801,
    expectedTaskVersionEventId: 901,
    operationId: 501,
    requirementsFingerprint: 'none:optional',
    userId: currentUserId,
} satisfies OperationCompletionDraftScope;

function logoutWithOpenDraft() {
    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <OperationCompletionDraftStoreHarness />
            <CompleteOperationModal
                accountId={logoutRaceScope.accountId}
                conditions={{
                    completionAttachImages: true,
                    completionAttachNotes: true,
                }}
                defaultOpen
                expectedEntityId={logoutRaceScope.expectedEntityId}
                expectedTaskVersionEventId={
                    logoutRaceScope.expectedTaskVersionEventId
                }
                label="Bilješka prije odjave"
                operationId={logoutRaceScope.operationId}
                sessionIncarnation={currentSessionIncarnation}
                userId={logoutRaceScope.userId}
            />
            <LogoutButton
                sessionIncarnation={currentSessionIncarnation}
                userId={currentUserId}
            />
        </AppRouterContext.Provider>
    );
}

async function seedDrafts(page: Page) {
    await page.evaluate(
        async ({ currentSessionIncarnation, currentUserId, scopes }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            const leases = new Map();
            for (const [index, scope] of scopes.entries()) {
                let lease = leases.get(scope.userId);
                if (!lease) {
                    const leaseResult = await api.acquireLease(
                        scope.userId,
                        api.captureLogoutNonce(scope.userId),
                        scope.userId === currentUserId
                            ? currentSessionIncarnation
                            : `legacy:${scope.userId}`,
                    );
                    if (leaseResult.status !== 'ready') {
                        throw new Error('Draft lease seed failed');
                    }
                    lease = leaseResult.lease;
                    leases.set(scope.userId, lease);
                }
                const result = await api.save(
                    {
                        ...scope,
                        notes: `Lokalna skica ${index + 1}`,
                        photos: [],
                    },
                    { lease },
                );
                if (result.status !== 'ok' || result.action !== 'saved') {
                    throw new Error('Draft seed failed');
                }
            }
        },
        { currentSessionIncarnation, currentUserId, scopes: draftScopes },
    );
}

async function loadDraftStates(page: Page) {
    return page.evaluate(
        async ({ databaseName, databaseVersion, scopes, storeName }) => {
            const database = await new Promise<IDBDatabase>(
                (resolve, reject) => {
                    const request = indexedDB.open(
                        databaseName,
                        databaseVersion,
                    );
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                },
            );
            try {
                const transaction = database.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                return await Promise.all(
                    scopes.map(
                        (scope) =>
                            new Promise<
                                | { notes: string; status: 'found' }
                                | { reason: 'not_found'; status: 'missing' }
                            >((resolve, reject) => {
                                const request = store.get(
                                    JSON.stringify([
                                        1,
                                        scope.userId,
                                        scope.accountId,
                                        scope.operationId,
                                    ]),
                                );
                                request.onerror = () => reject(request.error);
                                request.onsuccess = () => {
                                    const value: unknown = request.result;
                                    if (
                                        typeof value === 'object' &&
                                        value !== null &&
                                        'notes' in value &&
                                        typeof value.notes === 'string'
                                    ) {
                                        resolve({
                                            notes: value.notes,
                                            status: 'found',
                                        });
                                        return;
                                    }
                                    resolve({
                                        reason: 'not_found',
                                        status: 'missing',
                                    });
                                };
                            }),
                    ),
                );
            } finally {
                database.close();
            }
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            scopes: draftScopes,
            storeName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
        },
    );
}

test('purges only the logged-out user drafts across accounts', async ({
    mount,
    page,
}) => {
    let logoutCalls = 0;
    await page.route('**/api/logout', async (route) => {
        logoutCalls += 1;
        await route.fulfill({
            json: {
                loggedOutSessions: [
                    {
                        sessionIncarnation: currentSessionIncarnation,
                        userId: currentUserId,
                    },
                ],
            },
            status: 200,
        });
    });
    const component = await mount(logoutButton(currentUserId));
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );
    await seedDrafts(page);

    await component.getByRole('button', { name: 'Odjavi se' }).click();

    await expect.poll(() => logoutCalls).toBe(1);
    await expect
        .poll(() => loadDraftStates(page))
        .toEqual([
            { reason: 'not_found', status: 'missing' },
            { reason: 'not_found', status: 'missing' },
            { notes: 'Lokalna skica 3', status: 'found' },
        ]);
});

test('unions the rendered session with every token identity returned by logout', async ({
    mount,
    page,
}) => {
    await page.route('**/api/logout', async (route) => {
        await route.fulfill({
            json: {
                loggedOutSessions: [
                    {
                        sessionIncarnation: `legacy:${otherUserId}`,
                        userId: otherUserId,
                    },
                ],
            },
            status: 200,
        });
    });
    const component = await mount(logoutButton(currentUserId));
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );
    await seedDrafts(page);

    await component.getByRole('button', { name: 'Odjavi se' }).click();

    await expect
        .poll(() => loadDraftStates(page))
        .toEqual([
            { reason: 'not_found', status: 'missing' },
            { reason: 'not_found', status: 'missing' },
            { reason: 'not_found', status: 'missing' },
        ]);
});

test('retains every draft when logout is rejected', async ({ mount, page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });
    let logoutCalls = 0;
    await page.route('**/api/logout', async (route) => {
        logoutCalls += 1;
        await route.fulfill({ json: { error: 'unavailable' }, status: 503 });
    });
    const component = await mount(logoutButton(currentUserId));
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );
    await seedDrafts(page);

    await component.getByRole('button', { name: 'Odjavi se' }).click();

    await expect.poll(() => logoutCalls).toBe(1);
    await expect
        .poll(() => consoleErrors)
        .toContain('Logout failed with status 503');
    await expect
        .poll(() => loadDraftStates(page))
        .toEqual([
            { notes: 'Lokalna skica 1', status: 'found' },
            { notes: 'Lokalna skica 2', status: 'found' },
            { notes: 'Lokalna skica 3', status: 'found' },
        ]);
});

test('fences a late pagehide flush and clears in-memory proof after logout', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.route('**/api/logout', async (route) => {
        await route.fulfill({
            json: {
                loggedOutSessions: [
                    {
                        sessionIncarnation: currentSessionIncarnation,
                        userId: currentUserId,
                    },
                ],
            },
            status: 200,
        });
    });
    await mount(logoutWithOpenDraft());
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );
    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const notes = dialog.getByPlaceholder('Upišite napomenu o završetku...');
    await expect(notes).toBeVisible();
    await notes.fill('Privatna bilješka neposredno prije odjave.');
    const fileInputs = await dialog
        .locator('input[type="file"]')
        .elementHandles();
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('private photo proof'),
        mimeType: 'image/jpeg',
        name: 'privatni-dokaz.jpg',
    });
    await expect(dialog.getByText('privatni-dokaz.jpg')).toBeVisible();
    await expect(dialog.locator('[data-operation-upload-item]')).toHaveCount(1);

    await page.locator('button[title="Odjavi se"]').evaluate((button) => {
        if (button instanceof HTMLElement) button.click();
    });
    await expect(dialog.getByText('Sesija je završila')).toBeVisible();
    await expect(
        dialog.getByText(
            'Ovaj unos nije spremljen i neće ostati na ovom uređaju. Ponovno se prijavi prije nastavka.',
        ),
    ).toBeVisible();
    await expect(notes).toHaveCount(0);
    await expect(dialog.getByText('privatni-dokaz.jpg')).toHaveCount(0);
    await expect(dialog.locator('[data-operation-upload-item]')).toHaveCount(0);
    for (const fileInput of fileInputs) {
        expect(
            await fileInput.evaluate((input) =>
                input instanceof HTMLInputElement ? input.files?.length : null,
            ),
        ).toBe(0);
    }
    const closeButton = dialog.getByRole('button', { name: 'Zatvori' });
    await expect(
        dialog.locator('[data-operation-draft-session-focus]'),
    ).toBeFocused();
    await closeButton.scrollIntoViewIfNeeded();
    const closeBox = await closeButton.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox?.height).toBeGreaterThanOrEqual(44);
    expect(closeBox?.x).toBeGreaterThanOrEqual(0);
    expect(closeBox ? closeBox.x + closeBox.width : 321).toBeLessThanOrEqual(
        320,
    );
    expect(closeBox?.y).toBeGreaterThanOrEqual(0);
    expect(closeBox ? closeBox.y + closeBox.height : 569).toBeLessThanOrEqual(
        568,
    );
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide'));
        Object.defineProperties(document, {
            hidden: { configurable: true, value: true },
            visibilityState: { configurable: true, value: 'hidden' },
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect
        .poll(() =>
            page.evaluate(async (scope) => {
                const api = window.__operationCompletionDraftStoreTestApi;
                if (!api) {
                    throw new Error('Draft store test API is unavailable');
                }
                return api.load(scope);
            }, logoutRaceScope),
        )
        .toEqual({ reason: 'not_found', status: 'missing' });
    await expect(dialog.getByText('Sesija je završila')).toBeVisible();
});

test('refuses a stale task modal that mounts only after logout', async ({
    mount,
    page,
}) => {
    await page.route('**/api/logout', async (route) => {
        await route.fulfill({
            json: {
                loggedOutSessions: [
                    {
                        sessionIncarnation: currentSessionIncarnation,
                        userId: currentUserId,
                    },
                ],
            },
            status: 200,
        });
    });
    const component = await mount(
        <LogoutWithLateModalMountStory
            accountId={logoutRaceScope.accountId}
            expectedEntityId={logoutRaceScope.expectedEntityId}
            expectedTaskVersionEventId={
                logoutRaceScope.expectedTaskVersionEventId
            }
            operationId={logoutRaceScope.operationId}
            sessionIncarnation={currentSessionIncarnation}
            userId={currentUserId}
        />,
    );
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );

    await component.getByRole('button', { name: 'Odjavi se' }).click();
    await expect
        .poll(() =>
            page.evaluate(
                ({ sessionIncarnation, userId }) =>
                    localStorage.getItem(
                        `gredice:farm:operation-completion-draft-logged-out-session:v1:${userId}:${sessionIncarnation}`,
                    ) !== null,
                {
                    sessionIncarnation: currentSessionIncarnation,
                    userId: currentUserId,
                },
            ),
        )
        .toBe(true);
    await component
        .getByRole('button', { name: 'Prikaži stari zadatak' })
        .click();

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    await expect(dialog.getByText('Sesija je završila')).toBeVisible();
    await expect(
        dialog.getByPlaceholder('Upišite napomenu o završetku...'),
    ).toHaveCount(0);
    await expect(
        dialog.locator('[data-operation-draft-session-focus]'),
    ).toBeFocused();
});

test('clears an open draft through the storage-event fallback', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        Object.defineProperty(window, 'BroadcastChannel', {
            configurable: true,
            value: undefined,
        });
    });
    await mount(logoutWithOpenDraft());
    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const notes = dialog.getByPlaceholder('Upišite napomenu o završetku...');
    await expect(notes).toBeVisible();
    await notes.fill('Privatna bilješka u drugoj kartici.');
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('private cross-tab proof'),
        mimeType: 'image/jpeg',
        name: 'druga-kartica.jpg',
    });
    await expect(dialog.getByText('druga-kartica.jpg')).toBeVisible();

    await page.evaluate(
        ({ sessionIncarnation, userId }) => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: `gredice:farm:operation-completion-draft-logged-out-session:v1:${userId}:${sessionIncarnation}`,
                    newValue: (Date.now() + 60_000).toString(),
                    oldValue: null,
                    storageArea: localStorage,
                }),
            );
        },
        {
            sessionIncarnation: currentSessionIncarnation,
            userId: currentUserId,
        },
    );

    await expect(dialog.getByText('Sesija je završila')).toBeVisible();
    await expect(notes).toHaveCount(0);
    await expect(dialog.getByText('druga-kartica.jpg')).toHaveCount(0);
    await expect(
        dialog.locator('[data-operation-draft-session-focus]'),
    ).toBeFocused();
});

test('purges the session the server actually logged out from a stale tab', async ({
    mount,
    page,
}) => {
    await page.route('**/api/logout', async (route) => {
        await route.fulfill({
            json: {
                loggedOutSessions: [
                    {
                        sessionIncarnation: authoritativeSessionIncarnation,
                        userId: authoritativeUserId,
                    },
                ],
            },
            status: 200,
        });
    });
    await mount(
        <StaleLogoutWithCurrentModalStory
            accountId="account-authoritative"
            currentSessionIncarnation={authoritativeSessionIncarnation}
            currentUserId={authoritativeUserId}
            expectedEntityId={912}
            expectedTaskVersionEventId={913}
            operationId={914}
            staleSessionIncarnation={currentSessionIncarnation}
            staleUserId={currentUserId}
        />,
    );
    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const notes = dialog.getByPlaceholder('Upišite napomenu o završetku...');
    await expect(notes).toBeVisible();
    await notes.fill('Privatna bilješka trenutačno prijavljenog farmera.');

    await page.locator('button[title="Odjavi se"]').evaluate((button) => {
        if (button instanceof HTMLElement) button.click();
    });

    await expect(dialog.getByText('Sesija je završila')).toBeVisible();
    await expect(notes).toHaveCount(0);
    await expect(
        dialog.locator('[data-operation-draft-session-focus]'),
    ).toBeFocused();
});
