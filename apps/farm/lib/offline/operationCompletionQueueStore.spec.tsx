import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCompletionDraftStoreHarness } from '../../playwright/OperationCompletionDraftStoreHarness';
import {
    FARM_OFFLINE_DATABASE_NAME,
    FARM_OFFLINE_DATABASE_VERSION,
    OPERATION_COMPLETION_DRAFT_MAX_COUNT,
    OPERATION_COMPLETION_DRAFT_STORE_NAME,
    OPERATION_COMPLETION_QUEUE_STORE_NAME,
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

test('upgrades a v1 draft database without data loss and rejects stale v1 clients', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, draftStoreName, queueStoreName }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.deleteDatabase(databaseName);
                request.onerror = () => reject(request.error);
                request.onblocked = () =>
                    reject(new Error('Database deletion was blocked'));
                request.onsuccess = () => resolve();
            });

            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(databaseName, 1);
                request.onerror = () => reject(request.error);
                request.onupgradeneeded = () => {
                    request.result.createObjectStore(draftStoreName, {
                        keyPath: 'key',
                    });
                };
                request.onsuccess = () => {
                    const database = request.result;
                    const transaction = database.transaction(
                        draftStoreName,
                        'readwrite',
                    );
                    transaction.objectStore(draftStoreName).put({
                        key: 'legacy-draft-record',
                        notes: 'legacy private draft',
                        userId: 'legacy-farmer',
                    });
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const lease = await api.acquireLease(
                'upgrade-trigger-user',
                api.captureLogoutNonce('upgrade-trigger-user'),
                'upgrade-trigger-session',
            );

            const upgraded = await new Promise<{
                legacyRecord: unknown;
                stores: string[];
                version: number;
            }>((resolve, reject) => {
                const request = indexedDB.open(databaseName);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const database = request.result;
                    const transaction = database.transaction(
                        draftStoreName,
                        'readonly',
                    );
                    const getRequest = transaction
                        .objectStore(draftStoreName)
                        .get('legacy-draft-record');
                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        resolve({
                            legacyRecord: getRequest.result,
                            stores: Array.from(database.objectStoreNames),
                            version: database.version,
                        });
                        database.close();
                    };
                };
            });

            const staleOpenError = await new Promise<string | null>(
                (resolve) => {
                    const request = indexedDB.open(databaseName, 1);
                    request.onerror = () =>
                        resolve(request.error?.name ?? 'UnknownError');
                    request.onsuccess = () => {
                        request.result.close();
                        resolve(null);
                    };
                },
            );

            return {
                leaseStatus: lease.status,
                queueStorePresent: upgraded.stores.includes(queueStoreName),
                staleOpenError,
                upgraded,
            };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            draftStoreName: OPERATION_COMPLETION_DRAFT_STORE_NAME,
            queueStoreName: OPERATION_COMPLETION_QUEUE_STORE_NAME,
        },
    );

    expect(result).toMatchObject({
        leaseStatus: 'ready',
        queueStorePresent: true,
        staleOpenError: 'VersionError',
        upgraded: {
            legacyRecord: {
                key: 'legacy-draft-record',
                notes: 'legacy private draft',
                userId: 'legacy-farmer',
            },
            version: FARM_OFFLINE_DATABASE_VERSION,
        },
    });
});

test('atomically hands a draft to the queue, preserves File metadata, and fences late draft writes', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const leaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'handoff-session',
        );
        if (leaseResult.status !== 'ready') {
            throw new Error('Expected a writer lease');
        }
        const file = new File(['photo bytes'], 'berba.jpg', {
            lastModified: 1_725_000_000_000,
            type: 'image/jpeg',
        });
        const input = {
            ...scope,
            notes: 'Privatna napomena za berbu',
            operationLabel: '  Berba rajčice  ',
            photos: [{ file, id: 'photo-a' }],
            scheduleDateKey: '2026-07-15',
        };
        const save = await api.save(input, { lease: leaseResult.lease });
        if (save.status !== 'ok' || save.revisionId === null) {
            throw new Error('Expected the source draft');
        }

        const handoff = await api.queue.handoff(input, {
            expectedDraftRevisionId: save.revisionId,
            lease: leaseResult.lease,
        });
        if (handoff.status !== 'enqueued') {
            throw new Error('Expected an enqueued handoff');
        }
        const queued = await api.queue.load(scope, leaseResult.lease);
        if (queued.status !== 'found') {
            throw new Error('Expected the queued item');
        }
        const attachment = queued.item.attachments[0];
        if (!attachment) throw new Error('Expected one attachment');

        const repeated = await api.queue.handoff(input, {
            expectedDraftRevisionId: save.revisionId,
            lease: leaseResult.lease,
        });
        const conflicting = await api.queue.handoff(
            {
                ...input,
                notes: 'Druga napomena iz drugog prozora',
                photos: [{ file, id: 'photo-from-other-tab' }],
            },
            { lease: leaseResult.lease },
        );
        const lateSave = await api.save(
            {
                ...scope,
                notes: 'Kasni upis koji ne smije uskrsnuti skicu',
                photos: [],
            },
            { lease: leaseResult.lease },
        );

        return {
            attachment: {
                id: attachment.id,
                lastModified: attachment.lastModified,
                name: attachment.name,
                size: attachment.size,
                text: await attachment.blob.text(),
                type: attachment.type,
                uploadedUrl: attachment.uploadedUrl,
            },
            draftAfterHandoff: await api.load(scope, leaseResult.lease),
            conflicting,
            handoff,
            lateSave,
            queued: {
                notes: queued.item.notes,
                operationLabel: queued.item.operationLabel,
                scheduleDateKey: queued.item.scheduleDateKey,
                state: queued.item.state,
                submissionId: queued.item.submissionId,
            },
            repeated,
        };
    }, baseScope);

    expect(result.handoff).toMatchObject({
        item: {
            attachmentCount: 1,
            contentAvailable: true,
            operationLabel: 'Berba rajčice',
            scheduleDateKey: '2026-07-15',
            state: 'queued',
        },
        status: 'enqueued',
    });
    expect(result.attachment).toEqual({
        id: 'photo-a',
        lastModified: 1_725_000_000_000,
        name: 'berba.jpg',
        size: 11,
        text: 'photo bytes',
        type: 'image/jpeg',
        uploadedUrl: null,
    });
    expect(result.queued).toMatchObject({
        notes: 'Privatna napomena za berbu',
        operationLabel: 'Berba rajčice',
        scheduleDateKey: '2026-07-15',
        state: 'queued',
    });
    expect(result.draftAfterHandoff).toEqual({
        reason: 'not_found',
        status: 'missing',
    });
    expect(result.repeated).toMatchObject({ status: 'existing' });
    expect(
        result.repeated.status === 'existing'
            ? result.repeated.item.submissionId
            : null,
    ).toBe(result.queued.submissionId);
    expect(result.conflicting).toEqual({
        reason: 'queue_conflict',
        status: 'error',
    });
    expect(result.lateSave).toEqual({
        reason: 'incompatible',
        status: 'error',
    });
});

test('shares the five-item bound between drafts and queued completions', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ maxCount, scope }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            const leaseResult = await api.acquireLease(
                scope.userId,
                api.captureLogoutNonce(scope.userId),
                'combined-bound-session',
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const queued = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Jedna stavka u redu',
                    operationLabel: 'Zalijevanje',
                    photos: [],
                },
                { lease: leaseResult.lease },
            );
            if (queued.status !== 'enqueued') {
                throw new Error('Expected the first queue item');
            }

            const draftResults = [];
            for (let offset = 1; offset < maxCount; offset += 1) {
                draftResults.push(
                    await api.save(
                        {
                            ...scope,
                            notes: `Skica ${offset}`,
                            operationId: scope.operationId + offset,
                            photos: [],
                        },
                        { lease: leaseResult.lease },
                    ),
                );
            }
            const extraDraft = await api.save(
                {
                    ...scope,
                    notes: 'Šesta stavka',
                    operationId: scope.operationId + maxCount,
                    photos: [],
                },
                { lease: leaseResult.lease },
            );
            const extraQueue = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Također šesta stavka',
                    operationId: scope.operationId + maxCount + 1,
                    operationLabel: 'Plijevljenje',
                    photos: [],
                },
                { lease: leaseResult.lease },
            );

            return {
                draftResults,
                extraDraft,
                extraQueue,
                listed: await api.queue.list(
                    { accountId: scope.accountId, userId: scope.userId },
                    leaseResult.lease,
                ),
            };
        },
        { maxCount: OPERATION_COMPLETION_DRAFT_MAX_COUNT, scope: baseScope },
    );

    expect(result.draftResults).toHaveLength(
        OPERATION_COMPLETION_DRAFT_MAX_COUNT - 1,
    );
    expect(
        result.draftResults.every(
            (item) => item.status === 'ok' && item.action === 'saved',
        ),
    ).toBe(true);
    expect(result.extraDraft).toEqual({
        reason: 'draft_count_limit',
        status: 'error',
    });
    expect(result.extraQueue).toEqual({
        reason: 'draft_count_limit',
        status: 'error',
    });
    expect(result.listed).toMatchObject({
        items: [{ operationId: baseScope.operationId }],
        status: 'ok',
    });
});

test('serializes concurrent claims and recovers a stale claim with CAS fencing', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, queueStoreName, scope }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            const leaseResult = await api.acquireLease(
                scope.userId,
                api.captureLogoutNonce(scope.userId),
                'claim-session',
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const handoff = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Sadržaj za jedan zahtjev',
                    operationLabel: 'Prihrana',
                    photos: [
                        {
                            file: new File(['claim photo'], 'claim.jpg', {
                                type: 'image/jpeg',
                            }),
                            id: 'claim-photo',
                        },
                    ],
                },
                { lease: leaseResult.lease },
            );
            if (handoff.status !== 'enqueued') {
                throw new Error('Expected an enqueued item');
            }
            const owner = {
                accountId: scope.accountId,
                userId: scope.userId,
            };
            const claims = await Promise.all([
                api.queue.claimNext(owner, {
                    claimId: 'claim-a',
                    lease: leaseResult.lease,
                }),
                api.queue.claimNext(owner, {
                    claimId: 'claim-b',
                    lease: leaseResult.lease,
                }),
            ]);
            const winner = claims.find((claim) => claim.status === 'claimed');
            if (winner?.status !== 'claimed' || !winner.item.claim) {
                throw new Error('Expected exactly one winning claim');
            }

            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(databaseName);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const database = request.result;
                    const transaction = database.transaction(
                        queueStoreName,
                        'readwrite',
                    );
                    const store = transaction.objectStore(queueStoreName);
                    const getRequest = store.get(handoff.item.key);
                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        const item = getRequest.result;
                        if (!item?.claim) {
                            reject(new Error('Expected the stored claim'));
                            return;
                        }
                        item.claim.expiresAt = Date.now() - 1;
                        store.put(item);
                    };
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const recovered = await api.queue.claimNext(owner, {
                claimId: 'claim-recovered',
                lease: leaseResult.lease,
            });
            const staleMutation = await api.queue.markAttachmentUploaded(
                {
                    attachmentId: 'claim-photo',
                    claimId: winner.item.claim.claimId,
                    key: handoff.item.key,
                    submissionId: handoff.item.submissionId,
                    uploadedUrl: 'https://example.com/stale.jpg',
                },
                leaseResult.lease,
            );

            return { claims, recovered, staleMutation };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            queueStoreName: OPERATION_COMPLETION_QUEUE_STORE_NAME,
            scope: baseScope,
        },
    );

    expect(result.claims.map((claim) => claim.status).sort()).toEqual([
        'claimed',
        'empty',
    ]);
    expect(result.recovered).toMatchObject({
        item: {
            attemptCount: 2,
            claim: { claimId: 'claim-recovered' },
            state: 'syncing',
        },
        status: 'claimed',
    });
    expect(result.staleMutation).toEqual({ status: 'conflict' });
});

test('renews only the active claim and fences expired claims and logged-out sessions', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, queueStoreName, scope }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            const session = 'claim-renewal-session';
            const leaseResult = await api.acquireLease(
                scope.userId,
                api.captureLogoutNonce(scope.userId),
                session,
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const handoff = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Fotografije se još prenose',
                    operationLabel: 'Dugi prijenos fotografija',
                    photos: [],
                },
                { lease: leaseResult.lease },
            );
            if (handoff.status !== 'enqueued') {
                throw new Error('Expected an enqueued item');
            }
            const claim = await api.queue.claimNext(
                { accountId: scope.accountId, userId: scope.userId },
                { claimId: 'long-upload-claim', lease: leaseResult.lease },
            );
            if (claim.status !== 'claimed' || !claim.item.claim) {
                throw new Error('Expected an active claim');
            }
            const target = {
                claimId: 'long-upload-claim',
                key: handoff.item.key,
                submissionId: handoff.item.submissionId,
            };
            const initialExpiry = claim.item.claim.expiresAt;
            await new Promise((resolve) => setTimeout(resolve, 5));
            const renewed = await api.queue.renewClaim(
                target,
                leaseResult.lease,
            );
            const afterRenewal = await api.queue.load(scope, leaseResult.lease);
            const wrongClaim = await api.queue.renewClaim(
                { ...target, claimId: 'wrong-claim' },
                leaseResult.lease,
            );

            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(databaseName);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const database = request.result;
                    const transaction = database.transaction(
                        queueStoreName,
                        'readwrite',
                    );
                    const store = transaction.objectStore(queueStoreName);
                    const getRequest = store.get(target.key);
                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        const item = getRequest.result;
                        if (!item?.claim) {
                            reject(new Error('Expected a stored claim'));
                            return;
                        }
                        item.claim.expiresAt = Date.now() - 1;
                        store.put(item);
                    };
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const expiredClaim = await api.queue.renewClaim(
                target,
                leaseResult.lease,
            );
            await api.purgeUser(scope.userId, session);
            const loggedOutClaim = await api.queue.renewClaim(
                target,
                leaseResult.lease,
            );

            return {
                afterRenewal:
                    afterRenewal.status === 'found'
                        ? afterRenewal.item.claim?.expiresAt
                        : null,
                expiredClaim,
                initialExpiry,
                loggedOutClaim,
                renewed,
                wrongClaim,
            };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            queueStoreName: OPERATION_COMPLETION_QUEUE_STORE_NAME,
            scope: baseScope,
        },
    );

    expect(result.renewed).toEqual({ status: 'ok' });
    expect(result.afterRenewal).toBeGreaterThan(result.initialExpiry);
    expect(result.wrongClaim).toEqual({ status: 'conflict' });
    expect(result.expiredClaim).toEqual({ status: 'conflict' });
    expect(result.loggedOutClaim).toEqual({ status: 'session_changed' });
});

test('supports upload, retry, failure, and confirmation transitions while scrubbing the tombstone', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const leaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'transition-session',
        );
        if (leaseResult.status !== 'ready') {
            throw new Error('Expected a writer lease');
        }
        const handoff = await api.queue.handoff(
            {
                ...scope,
                notes: 'Vrlo privatna napomena',
                operationLabel: 'Rezidba osjetljivog nasada',
                photos: [
                    {
                        file: new File(['private photo bytes'], 'private.jpg', {
                            type: 'image/jpeg',
                        }),
                        id: 'private-photo',
                    },
                ],
                scheduleDateKey: '2026-07-15',
            },
            { lease: leaseResult.lease },
        );
        if (handoff.status !== 'enqueued') {
            throw new Error('Expected an enqueued item');
        }
        const owner = {
            accountId: scope.accountId,
            userId: scope.userId,
        };
        const target = {
            key: handoff.item.key,
            submissionId: handoff.item.submissionId,
        };

        const firstClaim = await api.queue.claimNext(owner, {
            claimId: 'transition-claim-1',
            lease: leaseResult.lease,
        });
        if (firstClaim.status !== 'claimed') {
            throw new Error('Expected the first claim');
        }
        const upload = await api.queue.markAttachmentUploaded(
            {
                ...target,
                attachmentId: 'private-photo',
                claimId: 'transition-claim-1',
                uploadedUrl: 'https://uploads.example/private.jpg',
            },
            leaseResult.lease,
        );
        const afterUpload = await api.queue.load(scope, leaseResult.lease);
        const release = await api.queue.releaseForRetry(
            {
                ...target,
                claimId: 'transition-claim-1',
                failureCode: 'network_unavailable',
                nextAttemptAt: Date.now() - 1,
            },
            leaseResult.lease,
        );
        const secondClaim = await api.queue.claimNext(owner, {
            claimId: 'transition-claim-2',
            lease: leaseResult.lease,
        });
        const failed = await api.queue.markFailed(
            {
                ...target,
                claimId: 'transition-claim-2',
                failureCode: 'upload_failed',
            },
            leaseResult.lease,
        );
        const afterFailure = await api.queue.load(scope, leaseResult.lease);
        const retry = await api.queue.retry(target, leaseResult.lease);
        const thirdClaim = await api.queue.claimNext(owner, {
            claimId: 'transition-claim-3',
            lease: leaseResult.lease,
        });
        const confirmed = await api.queue.markServerConfirmed(
            {
                ...target,
                claimId: 'transition-claim-3',
                serverState: 'pendingVerification',
            },
            leaseResult.lease,
        );
        const tombstone = await api.queue.load(scope, leaseResult.lease);
        const listed = await api.queue.list(owner, leaseResult.lease);

        return {
            afterFailure:
                afterFailure.status === 'found'
                    ? {
                          attemptCount: afterFailure.item.attemptCount,
                          failureCode: afterFailure.item.failureCode,
                          state: afterFailure.item.state,
                      }
                    : afterFailure,
            afterUpload:
                afterUpload.status === 'found'
                    ? {
                          uploadedUrl:
                              afterUpload.item.attachments[0]?.uploadedUrl,
                      }
                    : afterUpload,
            confirmed,
            failed,
            firstClaim,
            listed,
            release,
            retry,
            secondClaim,
            thirdClaim,
            upload,
            tombstone:
                tombstone.status === 'found'
                    ? {
                          attachmentCount: tombstone.item.attachments.length,
                          claim: tombstone.item.claim,
                          contentDiscardedAt: tombstone.item.contentDiscardedAt,
                          notes: tombstone.item.notes,
                          operationLabel: tombstone.item.operationLabel,
                          scheduleDateKey: tombstone.item.scheduleDateKey,
                          serverState: tombstone.item.serverState,
                          state: tombstone.item.state,
                      }
                    : tombstone,
        };
    }, baseScope);

    expect(result.firstClaim).toMatchObject({
        item: { attemptCount: 1, state: 'syncing' },
        status: 'claimed',
    });
    expect(result.upload).toEqual({ status: 'ok' });
    expect(result.afterUpload).toEqual({
        uploadedUrl: 'https://uploads.example/private.jpg',
    });
    expect(result.release).toEqual({ status: 'ok' });
    expect(result.secondClaim).toMatchObject({
        item: { attemptCount: 2, state: 'syncing' },
        status: 'claimed',
    });
    expect(result.failed).toEqual({ status: 'ok' });
    expect(result.afterFailure).toEqual({
        attemptCount: 2,
        failureCode: 'upload_failed',
        state: 'failed',
    });
    expect(result.retry).toEqual({ status: 'ok' });
    expect(result.thirdClaim).toMatchObject({
        item: { attemptCount: 1, state: 'syncing' },
        status: 'claimed',
    });
    expect(result.confirmed).toEqual({ status: 'ok' });
    expect(result.tombstone).toMatchObject({
        attachmentCount: 0,
        claim: null,
        notes: '',
        operationLabel: '',
        scheduleDateKey: null,
        serverState: 'pendingVerification',
        state: 'server_confirmed',
    });
    expect(
        'contentDiscardedAt' in result.tombstone
            ? result.tombstone.contentDiscardedAt
            : null,
    ).toEqual(expect.any(Number));
    expect(result.listed).toMatchObject({
        items: [
            {
                attachmentCount: 0,
                contentAvailable: false,
                operationLabel: '',
                scheduleDateKey: null,
                serverState: 'pendingVerification',
                state: 'server_confirmed',
            },
        ],
        status: 'ok',
    });
    expect(JSON.stringify(result.tombstone)).not.toContain('private');
    expect(JSON.stringify(result.listed)).not.toContain('private');
});

test('expires queued private content into a durable scrubbed tombstone', async ({
    page,
}) => {
    const result = await page.evaluate(
        async ({ databaseName, queueStoreName, scope }) => {
            const api = window.__operationCompletionDraftStoreTestApi;
            if (!api) throw new Error('Draft store test API is unavailable');

            const leaseResult = await api.acquireLease(
                scope.userId,
                api.captureLogoutNonce(scope.userId),
                'expiry-session',
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const handoff = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Istekla privatna napomena',
                    operationLabel: 'Istekla operacija',
                    photos: [
                        {
                            file: new File(['expired bytes'], 'expired.jpg', {
                                type: 'image/jpeg',
                            }),
                            id: 'expired-photo',
                        },
                    ],
                    scheduleDateKey: '2026-07-14',
                },
                { lease: leaseResult.lease },
            );
            if (handoff.status !== 'enqueued') {
                throw new Error('Expected an enqueued item');
            }

            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(databaseName);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const database = request.result;
                    const transaction = database.transaction(
                        queueStoreName,
                        'readwrite',
                    );
                    const store = transaction.objectStore(queueStoreName);
                    const getRequest = store.get(handoff.item.key);
                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        const item = getRequest.result;
                        if (!item) {
                            reject(new Error('Expected a queue item'));
                            return;
                        }
                        item.expiresAt = Date.now() - 1;
                        store.put(item);
                    };
                    transaction.onabort = () => reject(transaction.error);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                };
            });

            const expired = await api.queue.load(scope, leaseResult.lease);
            const tombstone = await api.queue.load(scope, leaseResult.lease);
            const lateSave = await api.save(
                { ...scope, notes: 'Ne smije zaobići tombstone', photos: [] },
                { lease: leaseResult.lease },
            );
            const repeated = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Ne smije napraviti novi submission',
                    operationLabel: 'Novi pokušaj',
                    photos: [],
                },
                { lease: leaseResult.lease },
            );
            const discarded = await api.queue.discard(
                {
                    key: handoff.item.key,
                    submissionId: handoff.item.submissionId,
                },
                leaseResult.lease,
            );
            const afterDiscard = await api.queue.load(scope, leaseResult.lease);
            const replacement = await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Novi unos nakon izričitog odbacivanja',
                    operationLabel: 'Novi pokušaj',
                    photos: [],
                },
                { lease: leaseResult.lease },
            );

            return {
                afterDiscard,
                discarded,
                expired,
                lateSave,
                originalSubmissionId: handoff.item.submissionId,
                repeated,
                replacement,
                tombstone:
                    tombstone.status === 'found'
                        ? {
                              attachments: tombstone.item.attachments.length,
                              contentDiscardedAt:
                                  tombstone.item.contentDiscardedAt,
                              failureCode: tombstone.item.failureCode,
                              notes: tombstone.item.notes,
                              operationLabel: tombstone.item.operationLabel,
                              scheduleDateKey: tombstone.item.scheduleDateKey,
                              state: tombstone.item.state,
                              submissionId: tombstone.item.submissionId,
                          }
                        : tombstone,
            };
        },
        {
            databaseName: FARM_OFFLINE_DATABASE_NAME,
            queueStoreName: OPERATION_COMPLETION_QUEUE_STORE_NAME,
            scope: baseScope,
        },
    );

    expect(result.expired).toMatchObject({
        item: {
            attachments: [],
            contentDiscardedAt: expect.any(Number),
            failureCode: 'expired',
            notes: '',
            operationLabel: '',
            scheduleDateKey: null,
            state: 'failed',
            submissionId: result.originalSubmissionId,
        },
        status: 'expired',
    });
    expect(result.tombstone).toMatchObject({
        attachments: 0,
        failureCode: 'expired',
        notes: '',
        operationLabel: '',
        scheduleDateKey: null,
        state: 'failed',
        submissionId: result.originalSubmissionId,
    });
    expect(
        'contentDiscardedAt' in result.tombstone
            ? result.tombstone.contentDiscardedAt
            : null,
    ).toEqual(expect.any(Number));
    expect(result.lateSave).toEqual({
        reason: 'incompatible',
        status: 'error',
    });
    expect(result.repeated).toEqual({
        reason: 'queue_conflict',
        status: 'error',
    });
    expect(result.discarded).toEqual({ status: 'ok' });
    expect(result.afterDiscard).toEqual({ status: 'missing' });
    expect(result.replacement).toMatchObject({ status: 'enqueued' });
    expect(
        result.replacement.status === 'enqueued'
            ? result.replacement.item.submissionId
            : null,
    ).not.toBe(result.originalSubmissionId);
});

test('isolates queue content and fences every old claim after logout', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const oldSession = 'old-logout-session';
        const oldLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            oldSession,
        );
        if (oldLeaseResult.status !== 'ready') {
            throw new Error('Expected the old writer lease');
        }
        const secondAccount = { ...scope, accountId: 'account-b' };
        const otherUser = { ...scope, userId: 'farmer-b' };
        const otherLeaseResult = await api.acquireLease(
            otherUser.userId,
            api.captureLogoutNonce(otherUser.userId),
            'other-user-session',
        );
        if (otherLeaseResult.status !== 'ready') {
            throw new Error('Expected the other user lease');
        }

        const first = await api.queue.handoff(
            {
                ...scope,
                notes: 'Prvi račun',
                operationLabel: 'Prva operacija',
                photos: [],
            },
            { lease: oldLeaseResult.lease },
        );
        const second = await api.queue.handoff(
            {
                ...secondAccount,
                notes: 'Drugi račun',
                operationLabel: 'Druga operacija',
                photos: [],
            },
            { lease: oldLeaseResult.lease },
        );
        const other = await api.queue.handoff(
            {
                ...otherUser,
                notes: 'Drugi korisnik',
                operationLabel: 'Tuđa operacija',
                photos: [],
            },
            { lease: otherLeaseResult.lease },
        );
        if (
            first.status !== 'enqueued' ||
            second.status !== 'enqueued' ||
            other.status !== 'enqueued'
        ) {
            throw new Error('Expected all isolated queue items');
        }
        const claim = await api.queue.claimNext(
            { accountId: scope.accountId, userId: scope.userId },
            { claimId: 'old-claim', lease: oldLeaseResult.lease },
        );
        if (claim.status !== 'claimed') {
            throw new Error('Expected the old claim');
        }

        const beforePurge = {
            otherAccount: await api.queue.list(
                { accountId: secondAccount.accountId, userId: scope.userId },
                oldLeaseResult.lease,
            ),
            otherUserWithWrongLease: await api.queue.load(
                otherUser,
                oldLeaseResult.lease,
            ),
            owner: await api.queue.list(
                { accountId: scope.accountId, userId: scope.userId },
                oldLeaseResult.lease,
            ),
        };
        const purge = await api.purgeUser(scope.userId, oldSession);
        const staleClaimMutation = await api.queue.releaseForRetry(
            {
                claimId: 'old-claim',
                failureCode: 'network_unavailable',
                key: first.item.key,
                nextAttemptAt: Date.now(),
                submissionId: first.item.submissionId,
            },
            oldLeaseResult.lease,
        );
        const newLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'new-login-session',
        );
        if (newLeaseResult.status !== 'ready') {
            throw new Error('Expected a new writer lease');
        }

        return {
            beforePurge,
            firstAfterPurge: await api.queue.load(scope, newLeaseResult.lease),
            otherAfterPurge: await api.queue.load(
                otherUser,
                otherLeaseResult.lease,
            ),
            purge,
            secondAfterPurge: await api.queue.load(
                secondAccount,
                newLeaseResult.lease,
            ),
            staleClaimMutation,
        };
    }, baseScope);

    expect(result.beforePurge.owner).toMatchObject({
        items: [{ accountId: 'account-a' }],
        status: 'ok',
    });
    expect(result.beforePurge.otherAccount).toMatchObject({
        items: [{ accountId: 'account-b' }],
        status: 'ok',
    });
    expect(result.beforePurge.otherUserWithWrongLease).toEqual({
        status: 'session_changed',
    });
    expect(result.purge).toEqual({ deletedCount: 2, status: 'ok' });
    expect(result.staleClaimMutation).toEqual({ status: 'session_changed' });
    expect(result.firstAfterPurge).toEqual({ status: 'missing' });
    expect(result.secondAfterPurge).toEqual({ status: 'missing' });
    expect(result.otherAfterPurge.status).toBe('found');
});

test('preserves a newer same-user queue when an old logout arrives late', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const oldSession = 'late-old-session';
        const oldLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            oldSession,
        );
        if (oldLeaseResult.status !== 'ready') {
            throw new Error('Expected the old lease');
        }
        await api.queue.handoff(
            {
                ...scope,
                notes: 'Stara queue stavka',
                operationLabel: 'Stara operacija',
                photos: [],
            },
            { lease: oldLeaseResult.lease },
        );

        const newLeaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'newer-session',
        );
        if (newLeaseResult.status !== 'ready') {
            throw new Error('Expected the newer lease');
        }
        const newer = await api.queue.handoff(
            {
                ...scope,
                notes: 'Nova queue stavka mora ostati',
                operationLabel: 'Nova operacija',
                photos: [],
            },
            { lease: newLeaseResult.lease },
        );
        if (newer.status !== 'enqueued') {
            throw new Error('Expected the newer queue item');
        }

        const purge = await api.purgeUser(scope.userId, oldSession);
        return {
            newItem: await api.queue.load(scope, newLeaseResult.lease),
            oldItem: await api.queue.load(scope, oldLeaseResult.lease),
            purge,
            retry: await api.queue.retry(
                {
                    key: newer.item.key,
                    submissionId: newer.item.submissionId,
                },
                newLeaseResult.lease,
            ),
        };
    }, baseScope);

    expect(result.purge).toEqual({ deletedCount: 0, status: 'ok' });
    expect(result.oldItem).toEqual({ status: 'session_changed' });
    expect(result.newItem).toMatchObject({
        item: {
            notes: 'Nova queue stavka mora ostati',
            operationLabel: 'Nova operacija',
        },
        status: 'found',
    });
    expect(result.retry).toEqual({ status: 'conflict' });
});

test('emits owner-scoped change notifications without private completion content', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const api = window.__operationCompletionDraftStoreTestApi;
        if (!api) throw new Error('Draft store test API is unavailable');

        const leaseResult = await api.acquireLease(
            scope.userId,
            api.captureLogoutNonce(scope.userId),
            'change-event-session',
        );
        if (leaseResult.status !== 'ready') {
            throw new Error('Expected a writer lease');
        }
        let ownerNotifications = 0;
        let otherAccountNotifications = 0;
        const details: unknown[] = [];
        const unsubscribeOwner = api.queue.subscribe(
            scope.userId,
            scope.accountId,
            () => {
                ownerNotifications += 1;
            },
        );
        const unsubscribeOther = api.queue.subscribe(
            scope.userId,
            'account-b',
            () => {
                otherAccountNotifications += 1;
            },
        );
        const onChange = (event: Event) => {
            if (event instanceof CustomEvent) details.push(event.detail);
        };
        window.addEventListener(
            'gredice:operation-completion-queue-change:v1',
            onChange,
        );
        try {
            await api.queue.handoff(
                {
                    ...scope,
                    notes: 'Tajna napomena ne smije biti u događaju',
                    operationLabel: 'Tajni naziv operacije',
                    photos: [
                        {
                            file: new File(['secret bytes'], 'secret.jpg', {
                                type: 'image/jpeg',
                            }),
                            id: 'secret-photo',
                        },
                    ],
                },
                { lease: leaseResult.lease },
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        } finally {
            unsubscribeOwner();
            unsubscribeOther();
            window.removeEventListener(
                'gredice:operation-completion-queue-change:v1',
                onChange,
            );
        }

        return {
            details,
            otherAccountNotifications,
            ownerNotifications,
        };
    }, baseScope);

    expect(result.ownerNotifications).toBeGreaterThanOrEqual(1);
    expect(result.otherAccountNotifications).toBe(0);
    expect(result.details).toEqual([
        {
            accountId: baseScope.accountId,
            kind: 'changed',
            userId: baseScope.userId,
        },
    ]);
    expect(JSON.stringify(result)).not.toContain('Tajna');
    expect(JSON.stringify(result)).not.toContain('secret');
});
