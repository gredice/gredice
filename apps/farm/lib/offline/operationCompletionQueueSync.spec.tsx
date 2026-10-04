import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCompletionQueueSyncHarness } from '../../playwright/OperationCompletionQueueSyncHarness';

const attachmentId = '11111111-1111-4111-8111-111111111111';
const baseScope = {
    accountId: 'account-sync',
    expectedEntityId: 101,
    expectedTaskVersionEventId: 201,
    operationId: 301,
    requirementsFingerprint: 'optional:optional',
    userId: 'farmer-sync',
};

test.beforeEach(async ({ mount, page }) => {
    await mount(<OperationCompletionQueueSyncHarness />);
    await expect(page.getByTestId('operation-draft-store-ready')).toHaveText(
        'ready',
    );
});

test('recovers an existing photo without uploading and completes with the stable submission', async ({
    page,
}) => {
    const recoveredUrl = 'https://blob.example/already-uploaded-photo.jpg';
    const result = await page.evaluate(
        async ({ photoId, recoveredImageUrl, scope }) => {
            const store = window.__operationCompletionDraftStoreTestApi;
            const sync = window.__operationCompletionQueueSyncTestApi;
            if (!store || !sync) throw new Error('Test API is unavailable');
            sync.configure({
                recoveryPlans: [{ imageUrl: recoveredImageUrl, kind: 'found' }],
            });

            const leaseResult = await store.acquireLease(
                scope.userId,
                store.captureLogoutNonce(scope.userId),
                'photo-recovery-session',
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const handoff = await store.queue.handoff(
                {
                    ...scope,
                    notes: 'Fotografija je već poslana',
                    operationLabel: 'Berba',
                    photos: [
                        {
                            file: new File(['existing photo'], 'berba.jpg', {
                                lastModified: 1_725_000_000_000,
                                type: 'image/jpeg',
                            }),
                            id: photoId,
                        },
                    ],
                },
                { lease: leaseResult.lease },
            );
            if (handoff.status !== 'enqueued') {
                throw new Error('Expected an enqueued completion');
            }
            const claimed = await store.queue.claimNext(
                { accountId: scope.accountId, userId: scope.userId },
                {
                    claimId: 'photo-recovery-claim',
                    lease: leaseResult.lease,
                },
            );
            if (claimed.status !== 'claimed') {
                throw new Error('Expected a claimed completion');
            }

            const outcome = await sync.sync(claimed.item, leaseResult.lease);
            const stored = await store.queue.load(scope, leaseResult.lease);
            return {
                calls: sync.getState(),
                outcome,
                stored,
                submissionId: claimed.item.submissionId,
            };
        },
        {
            photoId: attachmentId,
            recoveredImageUrl: recoveredUrl,
            scope: baseScope,
        },
    );

    expect(result.outcome).toEqual({
        serverState: 'pendingVerification',
        status: 'confirmed',
    });
    expect(result.calls.uploadCalls).toEqual([]);
    expect(result.calls.recoveryCalls).toEqual([
        {
            attachmentId,
            expectedEntityId: baseScope.expectedEntityId,
            expectedRequirementsFingerprint: baseScope.requirementsFingerprint,
            expectedTaskVersionEventId: baseScope.expectedTaskVersionEventId,
            fileName: 'berba.jpg',
            operationId: baseScope.operationId,
            submissionId: result.submissionId,
        },
    ]);
    expect(result.calls.completionCalls).toEqual([
        {
            expectedEntityId: baseScope.expectedEntityId,
            expectedRequirementsFingerprint: baseScope.requirementsFingerprint,
            expectedTaskVersionEventId: baseScope.expectedTaskVersionEventId,
            imageUrls: [recoveredUrl],
            notes: 'Fotografija je već poslana',
            operationId: baseScope.operationId,
            submissionId: result.submissionId,
        },
    ]);
    expect(result.stored).toMatchObject({
        item: {
            attachments: [],
            notes: '',
            serverState: 'pendingVerification',
            state: 'server_confirmed',
            submissionId: result.submissionId,
        },
        status: 'found',
    });
});

test('recovers an ambiguous upload at the deterministic path with stable identifiers and filename', async ({
    page,
}) => {
    const recoveredUrl = 'https://blob.example/recovered-ambiguous-photo.jpg';
    const result = await page.evaluate(
        async ({ photoId, recoveredImageUrl, scope }) => {
            const store = window.__operationCompletionDraftStoreTestApi;
            const sync = window.__operationCompletionQueueSyncTestApi;
            if (!store || !sync) throw new Error('Test API is unavailable');
            sync.configure({
                recoveryPlans: [
                    { kind: 'missing' },
                    { imageUrl: recoveredImageUrl, kind: 'found' },
                ],
                uploadPlans: [{ kind: 'throw' }],
            });

            const leaseResult = await store.acquireLease(
                scope.userId,
                store.captureLogoutNonce(scope.userId),
                'ambiguous-upload-session',
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const handoff = await store.queue.handoff(
                {
                    ...scope,
                    notes: '  Fotografija nakon kiše  ',
                    operationLabel: 'Pregled usjeva',
                    photos: [
                        {
                            file: new File(
                                ['ambiguous upload bytes'],
                                'Pregled Nakon Kiše.JPG',
                                {
                                    lastModified: 1_725_000_123_456,
                                    type: 'image/jpeg',
                                },
                            ),
                            id: photoId,
                        },
                    ],
                },
                { lease: leaseResult.lease },
            );
            if (handoff.status !== 'enqueued') {
                throw new Error('Expected an enqueued completion');
            }
            const claimed = await store.queue.claimNext(
                { accountId: scope.accountId, userId: scope.userId },
                {
                    claimId: 'ambiguous-upload-claim',
                    lease: leaseResult.lease,
                },
            );
            if (claimed.status !== 'claimed') {
                throw new Error('Expected a claimed completion');
            }

            const outcome = await sync.sync(claimed.item, leaseResult.lease);
            return {
                calls: sync.getState(),
                outcome,
                submissionId: claimed.item.submissionId,
            };
        },
        {
            photoId: attachmentId,
            recoveredImageUrl: recoveredUrl,
            scope: baseScope,
        },
    );

    const expectedPath =
        `operations/${baseScope.operationId}/entity-${baseScope.expectedEntityId}` +
        `/version-${baseScope.expectedTaskVersionEventId}/submissions/` +
        `${result.submissionId}/attachments/${attachmentId}.jpg`;
    expect(result.outcome).toEqual({
        serverState: 'pendingVerification',
        status: 'confirmed',
    });
    expect(result.calls.recoveryCalls).toHaveLength(2);
    expect(result.calls.recoveryCalls[0]).toEqual(
        result.calls.recoveryCalls[1],
    );
    expect(result.calls.recoveryCalls[0]).toMatchObject({
        attachmentId,
        fileName: 'Pregled Nakon Kiše.JPG',
        submissionId: result.submissionId,
    });
    expect(result.calls.uploadCalls).toEqual([
        {
            access: 'public',
            clientPayload: expect.any(String),
            file: {
                lastModified: 1_725_000_123_456,
                name: 'Pregled Nakon Kiše.JPG',
                size: 22,
                text: 'ambiguous upload bytes',
                type: 'image/jpeg',
            },
            handleUploadUrl: '/api/operations/images/upload',
            multipart: false,
            pathname: expectedPath,
        },
    ]);
    expect(
        JSON.parse(result.calls.uploadCalls[0]?.clientPayload ?? '{}'),
    ).toEqual({
        attachmentId,
        expectedEntityId: baseScope.expectedEntityId,
        expectedRequirementsFingerprint: baseScope.requirementsFingerprint,
        expectedTaskVersionEventId: baseScope.expectedTaskVersionEventId,
        fileName: 'Pregled Nakon Kiše.JPG',
        operationId: baseScope.operationId,
        submissionId: result.submissionId,
    });
    expect(result.calls.completionCalls).toEqual([
        {
            expectedEntityId: baseScope.expectedEntityId,
            expectedRequirementsFingerprint: baseScope.requirementsFingerprint,
            expectedTaskVersionEventId: baseScope.expectedTaskVersionEventId,
            imageUrls: [recoveredUrl],
            notes: 'Fotografija nakon kiše',
            operationId: baseScope.operationId,
            submissionId: result.submissionId,
        },
    ]);
});

test('schedules a transient completion retry and reuses the same queue key and submission', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const store = window.__operationCompletionDraftStoreTestApi;
        const sync = window.__operationCompletionQueueSyncTestApi;
        if (!store || !sync) throw new Error('Test API is unavailable');
        sync.configure({
            completionPlans: [
                { kind: 'throw' },
                { kind: 'success', state: 'completed' },
            ],
        });

        const leaseResult = await store.acquireLease(
            scope.userId,
            store.captureLogoutNonce(scope.userId),
            'transient-retry-session',
        );
        if (leaseResult.status !== 'ready') {
            throw new Error('Expected a writer lease');
        }
        const handoff = await store.queue.handoff(
            {
                ...scope,
                notes: 'Ista napomena kroz pokušaje',
                operationLabel: 'Zalijevanje',
                photos: [],
            },
            { lease: leaseResult.lease },
        );
        if (handoff.status !== 'enqueued') {
            throw new Error('Expected an enqueued completion');
        }
        const firstClaim = await store.queue.claimNext(
            { accountId: scope.accountId, userId: scope.userId },
            { claimId: 'first-retry-claim', lease: leaseResult.lease },
        );
        if (firstClaim.status !== 'claimed') {
            throw new Error('Expected the first claim');
        }
        const firstOutcome = await sync.sync(
            firstClaim.item,
            leaseResult.lease,
        );
        const retryQueued = await store.queue.load(scope, leaseResult.lease);
        if (retryQueued.status !== 'found') {
            throw new Error('Expected a retryable queue item');
        }
        const retryResult = await store.queue.retry(
            {
                key: retryQueued.item.key,
                submissionId: retryQueued.item.submissionId,
            },
            leaseResult.lease,
        );
        const secondClaim = await store.queue.claimNext(
            { accountId: scope.accountId, userId: scope.userId },
            { claimId: 'second-retry-claim', lease: leaseResult.lease },
        );
        if (secondClaim.status !== 'claimed') {
            throw new Error('Expected the second claim');
        }
        const secondOutcome = await sync.sync(
            secondClaim.item,
            leaseResult.lease,
        );
        const confirmed = await store.queue.load(scope, leaseResult.lease);

        return {
            calls: sync.getState(),
            confirmed,
            first: {
                key: firstClaim.item.key,
                submissionId: firstClaim.item.submissionId,
            },
            firstOutcome,
            retryQueued,
            retryResult,
            second: {
                key: secondClaim.item.key,
                submissionId: secondClaim.item.submissionId,
            },
            secondOutcome,
        };
    }, baseScope);

    expect(result.firstOutcome).toEqual({
        failureCode: 'server_unavailable',
        status: 'retry_scheduled',
    });
    expect(result.retryQueued).toMatchObject({
        item: {
            claim: null,
            failureCode: 'server_unavailable',
            key: result.first.key,
            nextAttemptAt: expect.any(Number),
            state: 'queued',
            submissionId: result.first.submissionId,
        },
        status: 'found',
    });
    expect(result.retryResult).toEqual({ status: 'ok' });
    expect(result.second).toEqual(result.first);
    expect(result.secondOutcome).toEqual({
        serverState: 'completed',
        status: 'confirmed',
    });
    expect(
        result.calls.completionCalls.map(({ submissionId }) => submissionId),
    ).toEqual([result.first.submissionId, result.first.submissionId]);
    expect(result.confirmed).toMatchObject({
        item: {
            key: result.first.key,
            serverState: 'completed',
            state: 'server_confirmed',
            submissionId: result.first.submissionId,
        },
        status: 'found',
    });
});

test('clears a retryable missing Blob receipt and reuploads the same attachment path', async ({
    page,
}) => {
    const retryUrl = 'https://blob.example/retry-missing-photo.jpg';
    const result = await page.evaluate(
        async ({ photoId, retryImageUrl, scope }) => {
            const store = window.__operationCompletionDraftStoreTestApi;
            const sync = window.__operationCompletionQueueSyncTestApi;
            if (!store || !sync) throw new Error('Test API is unavailable');

            const leaseResult = await store.acquireLease(
                scope.userId,
                store.captureLogoutNonce(scope.userId),
                'missing-blob-retry-session',
            );
            if (leaseResult.status !== 'ready') {
                throw new Error('Expected a writer lease');
            }
            const handoff = await store.queue.handoff(
                {
                    ...scope,
                    notes: 'Ponovno pošalji fotografiju',
                    operationLabel: 'Pregled navodnjavanja',
                    photos: [
                        {
                            file: new File(
                                ['retry photo bytes'],
                                'navodnjavanje.jpg',
                                { type: 'image/jpeg' },
                            ),
                            id: photoId,
                        },
                    ],
                },
                { lease: leaseResult.lease },
            );
            if (handoff.status !== 'enqueued') {
                throw new Error('Expected an enqueued completion');
            }
            sync.configure({
                completionPlans: [
                    {
                        canRetry: true,
                        code: 'invalid_input',
                        kind: 'failure',
                        retryImageUrls: [retryImageUrl],
                    },
                    { kind: 'success', state: 'pendingVerification' },
                ],
                uploadPlans: [
                    { kind: 'success', url: retryImageUrl },
                    { kind: 'success', url: retryImageUrl },
                ],
            });
            const firstClaim = await store.queue.claimNext(
                { accountId: scope.accountId, userId: scope.userId },
                { claimId: 'missing-blob-first', lease: leaseResult.lease },
            );
            if (firstClaim.status !== 'claimed') {
                throw new Error('Expected the first claim');
            }
            const firstOutcome = await sync.sync(
                firstClaim.item,
                leaseResult.lease,
            );
            const retryQueued = await store.queue.load(
                scope,
                leaseResult.lease,
            );
            if (retryQueued.status !== 'found') {
                throw new Error('Expected a retryable queue item');
            }
            const retryResult = await store.queue.retry(
                {
                    key: retryQueued.item.key,
                    submissionId: retryQueued.item.submissionId,
                },
                leaseResult.lease,
            );
            const secondClaim = await store.queue.claimNext(
                { accountId: scope.accountId, userId: scope.userId },
                { claimId: 'missing-blob-second', lease: leaseResult.lease },
            );
            if (secondClaim.status !== 'claimed') {
                throw new Error('Expected the second claim');
            }
            const secondOutcome = await sync.sync(
                secondClaim.item,
                leaseResult.lease,
            );

            return {
                calls: sync.getState(),
                firstOutcome,
                retryResult,
                retryUploadedUrl: retryQueued.item.attachments[0]?.uploadedUrl,
                secondOutcome,
                submissionId: firstClaim.item.submissionId,
            };
        },
        { photoId: attachmentId, retryImageUrl: retryUrl, scope: baseScope },
    );

    expect(result.firstOutcome).toEqual({
        failureCode: 'upload_failed',
        status: 'retry_scheduled',
    });
    expect(result.retryUploadedUrl).toBeNull();
    expect(result.retryResult).toEqual({ status: 'ok' });
    expect(result.secondOutcome).toEqual({
        serverState: 'pendingVerification',
        status: 'confirmed',
    });
    expect(result.calls.uploadCalls).toHaveLength(2);
    expect(result.calls.uploadCalls[0]?.pathname).toBe(
        result.calls.uploadCalls[1]?.pathname,
    );
    expect(
        result.calls.completionCalls.map(({ submissionId }) => submissionId),
    ).toEqual([result.submissionId, result.submissionId]);
});

test('maps a terminal submission conflict to an idempotency conflict without changing the key', async ({
    page,
}) => {
    const result = await page.evaluate(async (scope) => {
        const store = window.__operationCompletionDraftStoreTestApi;
        const sync = window.__operationCompletionQueueSyncTestApi;
        if (!store || !sync) throw new Error('Test API is unavailable');
        sync.configure({
            completionPlans: [{ code: 'submission_conflict', kind: 'failure' }],
        });

        const leaseResult = await store.acquireLease(
            scope.userId,
            store.captureLogoutNonce(scope.userId),
            'terminal-conflict-session',
        );
        if (leaseResult.status !== 'ready') {
            throw new Error('Expected a writer lease');
        }
        const handoff = await store.queue.handoff(
            {
                ...scope,
                notes: 'Sadržaj ostaje za pregled',
                operationLabel: 'Berba',
                photos: [],
            },
            { lease: leaseResult.lease },
        );
        if (handoff.status !== 'enqueued') {
            throw new Error('Expected an enqueued completion');
        }
        const claimed = await store.queue.claimNext(
            { accountId: scope.accountId, userId: scope.userId },
            { claimId: 'terminal-conflict-claim', lease: leaseResult.lease },
        );
        if (claimed.status !== 'claimed') {
            throw new Error('Expected a claimed completion');
        }
        const outcome = await sync.sync(claimed.item, leaseResult.lease);
        const stored = await store.queue.load(scope, leaseResult.lease);

        return {
            calls: sync.getState(),
            key: claimed.item.key,
            outcome,
            stored,
            submissionId: claimed.item.submissionId,
        };
    }, baseScope);

    expect(result.outcome).toEqual({
        failureCode: 'idempotency_conflict',
        status: 'failed',
    });
    expect(result.calls.completionCalls).toHaveLength(1);
    expect(result.calls.completionCalls[0]?.submissionId).toBe(
        result.submissionId,
    );
    expect(result.stored).toMatchObject({
        item: {
            claim: null,
            contentDiscardedAt: null,
            failureCode: 'idempotency_conflict',
            key: result.key,
            notes: 'Sadržaj ostaje za pregled',
            state: 'failed',
            submissionId: result.submissionId,
        },
        status: 'found',
    });
});
