import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCompletionDraftStoreHarness } from '../../playwright/OperationCompletionDraftStoreHarness';
import {
    FARM_OFFLINE_DATABASE_NAME,
    FARM_OFFLINE_DATABASE_VERSION,
    OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
    OPERATION_COMPLETION_DRAFT_MAX_BYTES,
    OPERATION_COMPLETION_DRAFT_STORE_NAME,
} from './operationCompletionDraftStore';

const baseScope = {
    accountId: 'account-a',
    expectedEntityId: 101,
    expectedTaskVersionEventId: 201,
    operationId: 301,
    requirementsFingerprint: 'required:optional',
    userId: 'farmer-a',
} as const;

test.beforeEach(async ({ mount, page }) => {
    await mount(<OperationCompletionDraftStoreHarness />);
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );
});

test('round-trips Blob-backed photo evidence as the original File metadata', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const original = new File(['photo bytes'], 'harvest-proof.jpg', {
            lastModified: 1_725_000_000_000,
            type: 'image/jpeg',
        });
        const saveResult = await api.save({
            ...scope,
            notes: '  Sačuvaj razmake u napomeni.  ',
            photos: [{ file: original, id: 'photo-a' }],
        });
        const loadResult = await api.load(scope);
        if (loadResult.status !== 'found') {
            return { loadResult, saveResult };
        }

        const storedPhoto = loadResult.draft.photos[0];
        if (!storedPhoto) throw new Error('Expected one stored photo');
        const restored = api.photoToFile(storedPhoto);

        return {
            draftId: loadResult.draft.draftId,
            notes: loadResult.draft.notes,
            photoId: storedPhoto.id,
            restored: {
                lastModified: restored.lastModified,
                name: restored.name,
                size: restored.size,
                text: await restored.text(),
                type: restored.type,
            },
            saveResult,
            status: loadResult.status,
        };
    }, baseScope);

    expect(result).toMatchObject({
        notes: '  Sačuvaj razmake u napomeni.  ',
        photoId: 'photo-a',
        restored: {
            lastModified: 1_725_000_000_000,
            name: 'harvest-proof.jpg',
            size: 11,
            text: 'photo bytes',
            type: 'image/jpeg',
        },
        saveResult: { action: 'saved', status: 'ok' },
        status: 'found',
    });
    expect('draftId' in result && result.draftId).toMatch(/^[0-9a-f-]{36}$/u);
});

test('isolates drafts by user, account, and operation', async ({ page }) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        await api.save({ ...scope, notes: 'Moja napomena', photos: [] });

        return {
            otherAccount: await api.load({
                ...scope,
                accountId: 'account-b',
            }),
            otherOperation: await api.load({
                ...scope,
                operationId: scope.operationId + 1,
            }),
            otherUser: await api.load({ ...scope, userId: 'farmer-b' }),
            owner: await api.load(scope),
        };
    }, baseScope);

    expect(result.owner.status).toBe('found');
    expect(result.otherUser).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.otherAccount).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.otherOperation).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
});

test('rejects stale entity, task version, and requirements fingerprints without exposing content', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        await api.save({ ...scope, notes: 'Privatna napomena', photos: [] });

        return {
            entity: await api.load({
                ...scope,
                expectedEntityId: scope.expectedEntityId + 1,
            }),
            fingerprint: await api.load({
                ...scope,
                requirementsFingerprint: 'optional:required',
            }),
            original: await api.load(scope),
            version: await api.load({
                ...scope,
                expectedTaskVersionEventId:
                    scope.expectedTaskVersionEventId + 1,
            }),
        };
    }, baseScope);

    expect(result.entity).toMatchObject({
        reason: 'incompatible',
        status: 'missing',
    });
    expect(result.version).toMatchObject({
        reason: 'incompatible',
        status: 'missing',
    });
    expect(result.fingerprint).toMatchObject({
        reason: 'incompatible',
        status: 'missing',
    });
    expect(
        'revisionId' in result.entity ? result.entity.revisionId : null,
    ).toMatch(/^[0-9a-f-]{36}$/u);
    expect(result.original.status).toBe('found');
    expect(JSON.stringify(result.entity)).not.toContain('Privatna napomena');
});

test('uses per-write revisions so an old gate cannot delete or clear newer draft content', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const oldScope = scope;
        const currentScope = {
            ...scope,
            expectedEntityId: scope.expectedEntityId + 1,
            expectedTaskVersionEventId: scope.expectedTaskVersionEventId + 1,
        };
        const firstSave = await api.save({
            ...oldScope,
            notes: 'Stara skica A',
            photos: [],
        });
        const staleLoad = await api.load(currentScope);
        if (
            firstSave.status !== 'ok' ||
            firstSave.revisionId === null ||
            staleLoad.status !== 'missing' ||
            staleLoad.reason !== 'incompatible'
        ) {
            throw new Error('Expected the first stale revision');
        }

        const otherTabDiscard = await api.discard(currentScope, {
            expectedRevisionId: staleLoad.revisionId,
        });
        const secondSave = await api.save({
            ...currentScope,
            notes: 'Nova skica B',
            photos: [],
        });
        if (secondSave.status !== 'ok' || secondSave.revisionId === null) {
            throw new Error('Expected the replacement revision');
        }
        const oldStaleDiscard = await api.discard(currentScope, {
            expectedRevisionId: staleLoad.revisionId,
        });
        const retainedAfterStaleDiscard = await api.load(currentScope);
        if (retainedAfterStaleDiscard.status !== 'found') {
            throw new Error('Expected the replacement draft to survive');
        }

        const thirdSave = await api.save(
            {
                ...currentScope,
                notes: 'Ažurirana skica C',
                photos: [],
            },
            {
                expectedRevisionId: retainedAfterStaleDiscard.draft.revisionId,
            },
        );
        if (thirdSave.status !== 'ok' || thirdSave.revisionId === null) {
            throw new Error('Expected the updated revision');
        }
        const oldFoundDiscard = await api.discard(currentScope, {
            expectedRevisionId: retainedAfterStaleDiscard.draft.revisionId,
        });
        const oldQueuedClear = await api.save(
            { ...currentScope, notes: '', photos: [] },
            {
                expectedRevisionId: retainedAfterStaleDiscard.draft.revisionId,
            },
        );
        const finalDraft = await api.load(currentScope);

        return {
            finalDraft,
            firstSave,
            oldFoundDiscard,
            oldQueuedClear,
            oldStaleDiscard,
            otherTabDiscard,
            retainedRevision: retainedAfterStaleDiscard.draft.revisionId,
            secondSave,
            staleRevision: staleLoad.revisionId,
            thirdSave,
        };
    }, baseScope);

    expect(result.otherTabDiscard).toEqual({ status: 'ok' });
    expect(result.oldStaleDiscard).toEqual({ status: 'conflict' });
    expect(result.oldFoundDiscard).toEqual({ status: 'conflict' });
    expect(result.oldQueuedClear).toEqual({
        reason: 'draft_changed',
        status: 'error',
    });
    expect(result.staleRevision).not.toBe(result.secondSave.revisionId);
    expect(result.retainedRevision).toBe(result.secondSave.revisionId);
    expect(result.thirdSave.revisionId).not.toBe(result.retainedRevision);
    expect(result.finalDraft).toMatchObject({
        draft: { notes: 'Ažurirana skica C' },
        status: 'found',
    });
});

test('reports an expired draft once, removes it, and prunes expired records before applying the count limit', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, databaseVersion, scope, storeName }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            for (let index = 0; index < 5; index += 1) {
                await api.save({
                    ...scope,
                    notes: `Napomena ${index.toString()}`,
                    operationId: scope.operationId + index,
                    photos: [],
                });
            }
            const first = await api.load(scope);
            if (first.status !== 'found') {
                throw new Error('Expected the first draft before expiring it');
            }

            await new Promise<void>((resolve, reject) => {
                const openRequest = indexedDB.open(
                    databaseName,
                    databaseVersion,
                );
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const database = openRequest.result;
                    const transaction = database.transaction(
                        storeName,
                        'readwrite',
                    );
                    const store = transaction.objectStore(storeName);
                    const getRequest = store.get(first.draft.key);
                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        const record = getRequest.result;
                        record.expiresAt = Date.now() - 1;
                        store.put(record);
                    };
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const expired = await api.load(scope);
            const afterExpired = await api.load(scope);

            await api.save({
                ...scope,
                notes: 'Ponovno istekni ovaj zapis',
                photos: [],
            });
            const replacement = await api.load(scope);
            if (replacement.status !== 'found') {
                throw new Error('Expected the replacement draft');
            }
            await new Promise<void>((resolve, reject) => {
                const openRequest = indexedDB.open(
                    databaseName,
                    databaseVersion,
                );
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const database = openRequest.result;
                    const transaction = database.transaction(
                        storeName,
                        'readwrite',
                    );
                    const store = transaction.objectStore(storeName);
                    const getRequest = store.get(replacement.draft.key);
                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        const record = getRequest.result;
                        record.expiresAt = Date.now() - 1;
                        store.put(record);
                    };
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const sixth = await api.save({
                ...scope,
                notes: 'Novi peti živi zapis',
                operationId: scope.operationId + 5,
                photos: [],
            });

            return { afterExpired, expired, sixth };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            scope: baseScope,
            storeName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
        },
    );

    expect(result.expired).toEqual({ status: 'expired' });
    expect(result.afterExpired).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.sixth).toMatchObject({ action: 'saved', status: 'ok' });
});

test('allows exactly five live drafts per user and account without evicting any of them', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const accepted = [];
        for (let index = 0; index < 5; index += 1) {
            accepted.push(
                await api.save({
                    ...scope,
                    notes: `Draft ${index.toString()}`,
                    operationId: scope.operationId + index,
                    photos: [],
                }),
            );
        }
        const sixth = await api.save({
            ...scope,
            notes: 'Šesti zapis',
            operationId: scope.operationId + 5,
            photos: [],
        });
        const retained = await Promise.all(
            Array.from({ length: 5 }, (_, index) =>
                api.load({
                    ...scope,
                    operationId: scope.operationId + index,
                }),
            ),
        );

        return { accepted, retained, sixth };
    }, baseScope);

    expect(result.accepted).toHaveLength(5);
    expect(
        result.accepted.every(
            (saveResult) =>
                saveResult.status === 'ok' && saveResult.action === 'saved',
        ),
    ).toBe(true);
    expect(result.sixth).toEqual({
        reason: 'draft_count_limit',
        status: 'error',
    });
    expect(
        result.retained.every((loadResult) => loadResult.status === 'found'),
    ).toBe(true);
});

test('enforces the 100 MiB boundary without allocating a 100 MiB payload', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ maxBytes, scope }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            function virtualFile(size: number) {
                const file = new File([], 'virtual-proof.jpg', {
                    lastModified: 1,
                    type: 'image/jpeg',
                });
                Object.defineProperty(file, 'size', {
                    configurable: true,
                    value: size,
                });
                return file;
            }

            const atLimit = await api.save({
                ...scope,
                notes: '',
                photos: [{ file: virtualFile(maxBytes), id: 'at-limit' }],
            });
            const aboveLimit = await api.save({
                ...scope,
                accountId: 'account-over-limit',
                notes: '',
                photos: [
                    { file: virtualFile(maxBytes + 1), id: 'above-limit' },
                ],
            });

            return { aboveLimit, atLimit };
        },
        { maxBytes: OPERATION_COMPLETION_DRAFT_MAX_BYTES, scope: baseScope },
    );

    expect(result.atLimit).toMatchObject({ action: 'saved', status: 'ok' });
    expect(result.aboveLimit).toEqual({
        reason: 'draft_size_limit',
        status: 'error',
    });
});

test('reports a browser quota failure without losing control of the form', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const leaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
        );
        if (leaseResult.status !== 'ready') {
            throw new Error('Expected a writer lease');
        }

        const originalPut = Object.getOwnPropertyDescriptor(
            IDBObjectStore.prototype,
            'put',
        );
        Object.defineProperty(IDBObjectStore.prototype, 'put', {
            configurable: true,
            value: () => {
                throw new DOMException(
                    'Test quota reached',
                    'QuotaExceededError',
                );
            },
        });
        try {
            return await api.save(
                {
                    ...scope,
                    notes: 'Ostaje u obrascu',
                    photos: [],
                },
                { lease: leaseResult.lease },
            );
        } finally {
            if (originalPut) {
                Object.defineProperty(
                    IDBObjectStore.prototype,
                    'put',
                    originalPut,
                );
            } else {
                Reflect.deleteProperty(IDBObjectStore.prototype, 'put');
            }
        }
    }, baseScope);

    expect(result).toEqual({
        reason: 'quota_exceeded',
        status: 'error',
    });
});

test('keeps a scrubbed server-confirmed tombstone that fences late writers', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, databaseVersion, maxAge, scope, storeName }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            await api.save({
                ...scope,
                notes: 'Privatna napomena ne smije ostati',
                photos: [
                    {
                        file: new File(['private photo'], 'private.jpg', {
                            type: 'image/jpeg',
                        }),
                        id: 'private-photo',
                    },
                ],
            });
            const confirmation = await api.markServerConfirmed(scope);
            const reloadResult = await api.load(scope);
            const lateWrite = await api.save({
                ...scope,
                notes: 'Kasni zapis iz drugog prozora',
                photos: [],
            });
            const lateClear = await api.save({
                ...scope,
                notes: '',
                photos: [],
            });
            const staleDiscard = await api.discard(scope);
            const afterDiscardWrite = await api.save({
                ...scope,
                notes: 'Ni odbacivanje iz starog prozora ne otvara ogradu',
                photos: [],
            });

            const emptyScope = {
                ...scope,
                operationId: scope.operationId + 1,
            };
            const emptyConfirmation = await api.markServerConfirmed(emptyScope);
            const emptyLateWrite = await api.save({
                ...emptyScope,
                notes: 'Kasni zapis bez prethodne skice',
                photos: [],
            });

            const records = await new Promise<unknown[]>((resolve, reject) => {
                const openRequest = indexedDB.open(
                    databaseName,
                    databaseVersion,
                );
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const database = openRequest.result;
                    const transaction = database.transaction(
                        storeName,
                        'readonly',
                    );
                    const getAllRequest = transaction
                        .objectStore(storeName)
                        .getAll();
                    getAllRequest.onerror = () => reject(getAllRequest.error);
                    getAllRequest.onsuccess = () =>
                        resolve(getAllRequest.result);
                    transaction.oncomplete = () => database.close();
                };
            });
            const tombstones = records
                .flatMap((record) => {
                    if (
                        typeof record !== 'object' ||
                        record === null ||
                        !('serverConfirmedAt' in record) ||
                        typeof record.serverConfirmedAt !== 'number'
                    ) {
                        return [];
                    }
                    return [
                        {
                            age:
                                'expiresAt' in record &&
                                typeof record.expiresAt === 'number'
                                    ? record.expiresAt -
                                      record.serverConfirmedAt
                                    : null,
                            notes:
                                'notes' in record &&
                                typeof record.notes === 'string'
                                    ? record.notes
                                    : null,
                            operationId:
                                'operationId' in record &&
                                typeof record.operationId === 'number'
                                    ? record.operationId
                                    : null,
                            photoCount:
                                'photos' in record &&
                                Array.isArray(record.photos)
                                    ? record.photos.length
                                    : null,
                        },
                    ];
                })
                .sort(
                    (left, right) =>
                        (left.operationId ?? 0) - (right.operationId ?? 0),
                );

            return {
                afterDiscardWrite,
                confirmation,
                emptyConfirmation,
                emptyLateWrite,
                lateClear,
                lateWrite,
                maxAge,
                reloadResult,
                staleDiscard,
                tombstones,
            };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            maxAge: OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
            scope: baseScope,
            storeName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
        },
    );

    expect(result.confirmation).toEqual({ status: 'ok' });
    expect(result.reloadResult).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.lateWrite).toEqual({
        reason: 'incompatible',
        status: 'error',
    });
    expect(result.lateClear).toEqual({
        reason: 'incompatible',
        status: 'error',
    });
    expect(result.staleDiscard).toEqual({ status: 'ok' });
    expect(result.afterDiscardWrite).toEqual({
        reason: 'incompatible',
        status: 'error',
    });
    expect(result.emptyConfirmation).toEqual({ status: 'ok' });
    expect(result.emptyLateWrite).toEqual({
        reason: 'incompatible',
        status: 'error',
    });
    expect(result.tombstones).toEqual([
        {
            age: result.maxAge,
            notes: '',
            operationId: baseScope.operationId,
            photoCount: 0,
        },
        {
            age: result.maxAge,
            notes: '',
            operationId: baseScope.operationId + 1,
            photoCount: 0,
        },
    ]);
});

test('removes an expired server-confirmed tombstone before allowing a new draft', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, databaseVersion, scope, storeName }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            await api.markServerConfirmed(scope);
            await new Promise<void>((resolve, reject) => {
                const openRequest = indexedDB.open(
                    databaseName,
                    databaseVersion,
                );
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const database = openRequest.result;
                    const transaction = database.transaction(
                        storeName,
                        'readwrite',
                    );
                    const store = transaction.objectStore(storeName);
                    const getAllRequest = store.getAll();
                    getAllRequest.onerror = () => reject(getAllRequest.error);
                    getAllRequest.onsuccess = () => {
                        const record = getAllRequest.result.find(
                            (value) =>
                                typeof value === 'object' &&
                                value !== null &&
                                'serverConfirmedAt' in value &&
                                typeof value.serverConfirmedAt === 'number',
                        );
                        if (!record) {
                            reject(new Error('Expected a tombstone'));
                            return;
                        }
                        record.expiresAt = Date.now() - 1;
                        store.put(record);
                    };
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const expiredLoad = await api.load(scope);
            const saveAfterExpiry = await api.save({
                ...scope,
                notes: 'Nova skica nakon isteka ograde',
                photos: [],
            });
            return {
                expiredLoad,
                reloaded: await api.load(scope),
                saveAfterExpiry,
            };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            scope: baseScope,
            storeName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
        },
    );

    expect(result.expiredLoad).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.saveAfterExpiry).toMatchObject({
        action: 'saved',
        status: 'ok',
    });
    expect(result.reloaded.status).toBe('found');
});

test('removes malformed records on read and then reports them missing', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, databaseVersion, scope, storeName }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            await api.save({ ...scope, notes: 'Valid first', photos: [] });
            const valid = await api.load(scope);
            if (valid.status !== 'found') {
                throw new Error('Expected a valid draft before corruption');
            }

            await new Promise<void>((resolve, reject) => {
                const openRequest = indexedDB.open(
                    databaseName,
                    databaseVersion,
                );
                openRequest.onerror = () => reject(openRequest.error);
                openRequest.onsuccess = () => {
                    const database = openRequest.result;
                    const transaction = database.transaction(
                        storeName,
                        'readwrite',
                    );
                    transaction.objectStore(storeName).put({
                        key: valid.draft.key,
                        notes: 'must never escape',
                        schemaVersion: 1,
                        userId: scope.userId,
                    });
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            return {
                first: await api.load(scope),
                second: await api.load(scope),
            };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            scope: baseScope,
            storeName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
        },
    );

    expect(result.first).toEqual({
        reason: 'invalid_record',
        status: 'missing',
    });
    expect(result.second).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(JSON.stringify(result.first)).not.toContain('must never escape');
});

test('purges one user across accounts while preserving every other user', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const firstAccount = scope;
        const secondAccount = { ...scope, accountId: 'account-b' };
        const otherUser = { ...scope, userId: 'farmer-b' };
        await api.save({ ...firstAccount, notes: 'A1', photos: [] });
        await api.save({ ...secondAccount, notes: 'A2', photos: [] });
        await api.save({ ...otherUser, notes: 'B1', photos: [] });

        const purge = await api.purgeUser(scope.userId);
        const newLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'new-session-after-purge',
        );
        if (newLeaseResult.status !== 'ready') {
            throw new Error('Expected a new login writer lease');
        }

        return {
            firstAccount: await api.load(firstAccount, newLeaseResult.lease),
            otherUser: await api.load(otherUser),
            purge,
            secondAccount: await api.load(secondAccount, newLeaseResult.lease),
        };
    }, baseScope);

    expect(result.purge).toEqual({ deletedCount: 2, status: 'ok' });
    expect(result.firstAccount).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.secondAccount).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.otherUser.status).toBe('found');
});

test('atomically fences every late mutation from the logged-out writer generation', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const oldLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
        );
        if (oldLeaseResult.status !== 'ready') {
            throw new Error('Expected the original writer lease');
        }
        const oldLease = oldLeaseResult.lease;
        const initialSave = await api.save(
            { ...scope, notes: 'Mora nestati pri odjavi', photos: [] },
            { lease: oldLease },
        );
        if (initialSave.status !== 'ok' || initialSave.revisionId === null) {
            throw new Error('Expected the original draft');
        }

        const otherScope = { ...scope, userId: 'farmer-other' };
        await api.save({
            ...otherScope,
            notes: 'Drugi korisnik ostaje',
            photos: [],
        });
        const purge = await api.purgeUser(scope.userId);
        const lateLoad = await api.load(scope, oldLease);
        const lateSave = await api.save(
            { ...scope, notes: 'Kasni privatni unos', photos: [] },
            {
                expectedRevisionId: initialSave.revisionId,
                lease: oldLease,
            },
        );
        const lateClear = await api.save(
            { ...scope, notes: '', photos: [] },
            {
                expectedRevisionId: initialSave.revisionId,
                lease: oldLease,
            },
        );
        const lateDiscard = await api.discard(scope, {
            expectedRevisionId: initialSave.revisionId,
            lease: oldLease,
        });
        const lateConfirmation = await api.markServerConfirmed(scope, oldLease);

        const newLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'new-session-after-logout',
        );
        if (newLeaseResult.status !== 'ready') {
            throw new Error('Expected a new login writer lease');
        }
        const newSave = await api.save(
            { ...scope, notes: 'Nova prijavljena sesija', photos: [] },
            { lease: newLeaseResult.lease },
        );

        return {
            generationChanged:
                oldLease.generation !== newLeaseResult.lease.generation,
            lateClear,
            lateConfirmation,
            lateDiscard,
            lateLoad,
            lateSave,
            newDraft: await api.load(scope, newLeaseResult.lease),
            newSave,
            otherDraft: await api.load(otherScope),
            purge,
        };
    }, baseScope);

    expect(result.purge).toEqual({ deletedCount: 1, status: 'ok' });
    expect(result.generationChanged).toBe(true);
    expect(result.lateLoad).toEqual({ status: 'session_changed' });
    expect(result.lateSave).toEqual({
        reason: 'session_changed',
        status: 'error',
    });
    expect(result.lateClear).toEqual({
        reason: 'session_changed',
        status: 'error',
    });
    expect(result.lateDiscard).toEqual({ status: 'session_changed' });
    expect(result.lateConfirmation).toEqual({ status: 'session_changed' });
    expect(result.newSave).toMatchObject({ action: 'saved', status: 'ok' });
    expect(result.newDraft).toMatchObject({
        draft: { notes: 'Nova prijavljena sesija' },
        status: 'found',
    });
    expect(result.otherDraft).toMatchObject({
        draft: { notes: 'Drugi korisnik ostaje' },
        status: 'found',
    });
});

test('retries a lease when only the logout nonce rotates during acquisition', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const capturedLogoutNonce = api.captureLogoutNonce(scope.userId);
        const originalOpen = indexedDB.open.bind(indexedDB);
        let intercepted = false;
        Object.defineProperty(indexedDB, 'open', {
            configurable: true,
            value: (name: string, version?: number) => {
                if (!intercepted) {
                    intercepted = true;
                    localStorage.setItem(
                        `gredice:farm:operation-completion-draft-logout:v1:${scope.userId}`,
                        'rotated-during-acquire',
                    );
                }
                return version === undefined
                    ? originalOpen(name)
                    : originalOpen(name, version);
            },
        });
        try {
            return await api.acquireLease(scope.userId, capturedLogoutNonce);
        } finally {
            Object.defineProperty(indexedDB, 'open', {
                configurable: true,
                value: originalOpen,
            });
        }
    }, baseScope);

    expect(result).toMatchObject({
        lease: { logoutNonce: 'rotated-during-acquire' },
        status: 'ready',
    });
});

test('lets a successor session queued behind an older purge acquire a lease', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, databaseVersion, scope, storeName }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            const oldSession = 'queued-old-session';
            const successorSession = 'queued-successor-session';
            const oldLeaseResult = await api.acquireLease(
                scope.userId,
                api.captureLogoutNonce(scope.userId),
                oldSession,
            );
            if (oldLeaseResult.status !== 'ready') {
                throw new Error('Expected the older session lease');
            }
            await api.save(
                { ...scope, notes: 'Stari unos', photos: [] },
                { lease: oldLeaseResult.lease },
            );

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
            let releaseBlocker = false;
            let blockerStarted = false;
            const blocker = database.transaction(storeName, 'readwrite');
            const blockerStore = blocker.objectStore(storeName);
            const blockerComplete = new Promise<void>((resolve, reject) => {
                blocker.onabort = () => reject(blocker.error);
                blocker.onerror = () => reject(blocker.error);
                blocker.oncomplete = () => resolve();
            });
            const keepBlockerAlive = () => {
                const request = blockerStore.get('queued-purge-blocker');
                request.onsuccess = () => {
                    blockerStarted = true;
                    if (!releaseBlocker) keepBlockerAlive();
                };
            };
            keepBlockerAlive();
            while (!blockerStarted) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            const originalTransaction = IDBDatabase.prototype.transaction;
            let transactionCount = 0;
            Object.defineProperty(IDBDatabase.prototype, 'transaction', {
                configurable: true,
                value: function (
                    this: IDBDatabase,
                    storeNames: string | string[],
                    mode?: IDBTransactionMode,
                    options?: IDBTransactionOptions,
                ) {
                    const transaction = options
                        ? originalTransaction.call(
                              this,
                              storeNames,
                              mode,
                              options,
                          )
                        : originalTransaction.call(this, storeNames, mode);
                    transactionCount += 1;
                    return transaction;
                },
            });

            try {
                const capturedLogoutNonce = api.captureLogoutNonce(
                    scope.userId,
                );
                const purgePromise = api.purgeUser(scope.userId, oldSession);
                while (transactionCount < 1) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }

                const successorLeasePromise = api.acquireLease(
                    scope.userId,
                    capturedLogoutNonce,
                    successorSession,
                );
                while (transactionCount < 2) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }

                releaseBlocker = true;
                await blockerComplete;
                const [purge, successorLeaseResult] = await Promise.all([
                    purgePromise,
                    successorLeasePromise,
                ]);
                if (successorLeaseResult.status !== 'ready') {
                    throw new Error(
                        `Expected successor lease, received ${successorLeaseResult.status}`,
                    );
                }
                const successorSave = await api.save(
                    {
                        ...scope,
                        notes: 'Novi unos nakon stare odjave',
                        photos: [],
                    },
                    { lease: successorLeaseResult.lease },
                );
                return {
                    oldLoad: await api.load(scope, oldLeaseResult.lease),
                    purge,
                    successorLeaseResult,
                    successorSave,
                    transactionCount,
                };
            } finally {
                releaseBlocker = true;
                await blockerComplete.catch(() => undefined);
                Object.defineProperty(IDBDatabase.prototype, 'transaction', {
                    configurable: true,
                    value: originalTransaction,
                });
                database.close();
            }
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            databaseVersion: FARM_OFFLINE_DATABASE_VERSION,
            scope: baseScope,
            storeName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
        },
    );

    expect(result.purge).toEqual({ deletedCount: 1, status: 'ok' });
    expect(result.successorLeaseResult).toMatchObject({ status: 'ready' });
    expect(result.successorSave).toMatchObject({
        action: 'saved',
        status: 'ok',
    });
    expect(result.oldLoad).toEqual({ status: 'session_changed' });
    expect(result.transactionCount).toBeGreaterThanOrEqual(5);
});

test('retains every live session revocation across later logout cycles', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const acquire = async (sessionIncarnation: string) => {
            const leaseResult = await api.acquireLease(
                scope.userId,
                api.captureLogoutNonce(scope.userId),
                sessionIncarnation,
            );
            if (leaseResult.status !== 'ready') {
                throw new Error(`Expected ${sessionIncarnation} to be ready`);
            }
            return leaseResult.lease;
        };

        await acquire('session-a');
        await api.purgeUser(scope.userId, 'session-a');
        await acquire('session-b');
        await api.purgeUser(scope.userId, 'session-b');
        const sessionC = await acquire('session-c');
        const saveC = await api.save(
            { ...scope, notes: 'Skica aktivne sesije C', photos: [] },
            { lease: sessionC },
        );

        localStorage.removeItem(
            `gredice:farm:operation-completion-draft-logged-out-session:v1:${scope.userId}:session-a`,
        );
        const lateSessionA = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'session-a',
        );

        return {
            lateSessionA,
            sessionCDraft: await api.load(scope, sessionC),
            saveC,
        };
    }, baseScope);

    expect(result.lateSessionA).toEqual({ status: 'session_changed' });
    expect(result.saveC).toMatchObject({ action: 'saved', status: 'ok' });
    expect(result.sessionCDraft).toMatchObject({
        draft: { notes: 'Skica aktivne sesije C' },
        status: 'found',
    });
});

test('rebroadcasts after durable revocation when localStorage is unavailable', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const sessionIncarnation = 'session-without-local-storage';
        let logoutEvents = 0;
        const handleLogout = () => {
            logoutEvents += 1;
        };
        window.addEventListener(
            'gredice:operation-completion-draft-logout:v1',
            handleLogout,
        );
        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;
        Object.defineProperties(Storage.prototype, {
            getItem: {
                configurable: true,
                value: () => {
                    throw new DOMException('Storage unavailable');
                },
            },
            setItem: {
                configurable: true,
                value: () => {
                    throw new DOMException('Storage unavailable');
                },
            },
        });
        try {
            const purge = await api.purgeUser(scope.userId, sessionIncarnation);
            const lateAcquire = await api.acquireLease(
                scope.userId,
                null,
                sessionIncarnation,
            );
            return { lateAcquire, logoutEvents, purge };
        } finally {
            Object.defineProperties(Storage.prototype, {
                getItem: { configurable: true, value: originalGetItem },
                setItem: { configurable: true, value: originalSetItem },
            });
            window.removeEventListener(
                'gredice:operation-completion-draft-logout:v1',
                handleLogout,
            );
        }
    }, baseScope);

    expect(result.purge.status).toBe('ok');
    expect(result.logoutEvents).toBe(2);
    expect(result.lateAcquire).toEqual({ status: 'session_changed' });
});

test('preserves a newer same-user session when an older logout response arrives late', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const oldSession = 'old-session-incarnation';
        const oldLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            oldSession,
        );
        if (oldLeaseResult.status !== 'ready') {
            throw new Error('Expected the original writer lease');
        }
        await api.save(
            { ...scope, notes: 'Stara sesija', photos: [] },
            { lease: oldLeaseResult.lease },
        );

        const newLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'new-session-incarnation',
        );
        if (newLeaseResult.status !== 'ready') {
            throw new Error('Expected the newer writer lease');
        }
        const initialNewSave = await api.save(
            { ...scope, notes: 'Nova sesija prije stare odjave', photos: [] },
            { lease: newLeaseResult.lease },
        );
        if (
            initialNewSave.status !== 'ok' ||
            initialNewSave.revisionId === null
        ) {
            throw new Error('Expected the newer session draft');
        }

        const purge = await api.purgeUser(scope.userId, oldSession);

        return {
            newDraft: await api.load(scope, newLeaseResult.lease),
            oldDraft: await api.load(scope, oldLeaseResult.lease),
            purge,
            saveAfterPurge: await api.save(
                {
                    ...scope,
                    notes: 'Nova sesija i nakon stare odjave',
                    photos: [],
                },
                {
                    expectedRevisionId: initialNewSave.revisionId,
                    lease: newLeaseResult.lease,
                },
            ),
        };
    }, baseScope);

    expect(result.purge).toEqual({ deletedCount: 0, status: 'ok' });
    expect(result.oldDraft).toEqual({ status: 'session_changed' });
    expect(result.newDraft).toMatchObject({
        draft: { notes: 'Nova sesija prije stare odjave' },
        status: 'found',
    });
    expect(result.saveAfterPurge).toMatchObject({
        action: 'saved',
        status: 'ok',
    });
});
