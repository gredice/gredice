import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EmailProviderSubmissionRejectedError,
    EmailProviderSubmissionUncertainError,
    emailProviderSubmissionIsUncertain,
} from '@gredice/email/acs';
import {
    customerDeliveryNotificationCatalog,
    type DeliveryLifecycleMilestone,
} from '@gredice/notifications/customer-delivery';
import type {
    DeliveryLifecycleEmailClaim,
    DeliveryLifecycleEmailClaimResult,
} from '@gredice/storage';
import {
    deliveryLifecycleEmailProviderOperationId,
    parseDeliveryLifecycleEmailMetadata,
    readDeliveryLifecycleEmailEnabled,
    runDeliveryLifecycleEmailWorker,
} from './deliveryLifecycleEmailWorker';

const requestId = '018f0d12-2ec4-7fab-9d91-91f890ad5d73';

function metadata(
    milestone: DeliveryLifecycleMilestone = 'route-started',
): Record<string, unknown> {
    return {
        eventVersion: 1,
        milestone,
        requestId,
        retryAttempt: 0,
        runId: 'run:1',
        source: {
            id: `source:${milestone}`,
            kind: 'stop-operation',
            version: 1,
        },
        stopId: 'stop:1',
        ...(milestone === 'exception'
            ? {
                  exception: {
                      outcome: 'deferred',
                      reason: 'customer-unavailable',
                  },
              }
            : {}),
    };
}

function claim(
    notificationId: string,
    claimMetadata: Record<string, unknown> = metadata(),
): DeliveryLifecycleEmailClaim {
    return {
        accountId: 'account:1',
        attemptId: Number(notificationId.replace(/\D/gu, '')) || 1,
        email: `${notificationId}@example.test`,
        metadata: claimMetadata,
        notificationId,
        userId: `user:${notificationId}`,
    };
}

function started(
    notificationId: string,
    email = `${notificationId}@example.test`,
) {
    return { email, status: 'started' as const };
}

test('delivery lifecycle email feature flag is false by default and explicit to enable', () => {
    assert.equal(readDeliveryLifecycleEmailEnabled(undefined), false);
    assert.equal(readDeliveryLifecycleEmailEnabled(''), false);
    assert.equal(readDeliveryLifecycleEmailEnabled('false'), false);
    assert.equal(readDeliveryLifecycleEmailEnabled('unexpected'), false);
    assert.equal(readDeliveryLifecycleEmailEnabled(' TRUE '), true);
    assert.equal(readDeliveryLifecycleEmailEnabled('enabled'), true);
});

test('delivery lifecycle email provider operation IDs are stable UUIDs per durable attempt', () => {
    const input = {
        attemptId: 42,
        notificationId: 'notification:42',
        userId: 'user:42',
    };
    const operationId = deliveryLifecycleEmailProviderOperationId(input);
    assert.match(
        operationId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    assert.equal(deliveryLifecycleEmailProviderOperationId(input), operationId);
    assert.notEqual(
        deliveryLifecycleEmailProviderOperationId({ ...input, attemptId: 43 }),
        operationId,
    );
});

test('provider failures after submission begins are uncertain until a terminal failure is known', () => {
    const operationId = deliveryLifecycleEmailProviderOperationId({
        attemptId: 42,
        notificationId: 'notification:42',
        userId: 'user:42',
    });
    for (const boundary of [
        'beginSend',
        'sending audit log',
        'provider polling',
    ]) {
        assert.equal(
            emailProviderSubmissionIsUncertain({
                operationId,
                providerSubmissionStarted: true,
            }),
            true,
            boundary,
        );
    }
    assert.equal(
        emailProviderSubmissionIsUncertain({
            operationId,
            providerSubmissionStarted: true,
            terminalProviderStatus: 'Succeeded',
        }),
        true,
        'success audit log',
    );
    assert.equal(
        emailProviderSubmissionIsUncertain({
            operationId,
            providerSubmissionStarted: true,
            terminalProviderStatus: 'Failed',
        }),
        false,
        'known terminal provider failure',
    );
    assert.equal(
        emailProviderSubmissionIsUncertain({
            operationId,
            providerSubmissionStarted: true,
            terminalProviderStatus: 'Canceled',
        }),
        false,
        'known terminal provider cancellation',
    );
    assert.equal(
        emailProviderSubmissionIsUncertain({
            operationId,
            providerSubmissionStarted: true,
            terminalProviderStatus: 'FutureProviderStatus',
        }),
        true,
        'unknown provider status',
    );
    assert.equal(
        emailProviderSubmissionIsUncertain({
            operationId,
            providerSubmissionStarted: false,
        }),
        false,
        'failure before provider submission',
    );
    assert.equal(
        emailProviderSubmissionIsUncertain({
            providerSubmissionStarted: true,
        }),
        false,
        'submission without a durable provider operation ID',
    );
});

test('delivery lifecycle email metadata parser accepts bounded source metadata and legacy rows', () => {
    const milestones = [
        'route-started',
        'near-arrival',
        'next-stop',
        'delayed',
        'arrived',
        'delivered',
        'exception',
        'recovery',
    ] satisfies DeliveryLifecycleMilestone[];
    assert.deepEqual(
        [...milestones].sort(),
        Object.keys(customerDeliveryNotificationCatalog).sort(),
    );
    for (const milestone of milestones) {
        const parsed = parseDeliveryLifecycleEmailMetadata(metadata(milestone));
        assert.ok(parsed);
        assert.equal(parsed.milestone, milestone);
        assert.equal(parsed.requestId, requestId);
        assert.deepEqual(
            Object.keys(parsed).sort(),
            milestone === 'exception'
                ? ['exception', 'milestone', 'requestId']
                : ['milestone', 'requestId'],
        );
    }

    const legacyMetadata = metadata();
    delete legacyMetadata.source;
    assert.ok(parseDeliveryLifecycleEmailMetadata(legacyMetadata));

    for (const invalid of [
        null,
        {},
        { ...metadata(), eventVersion: 2 },
        { ...metadata(), requestId: 'request/unsafe' },
        { ...metadata(), retryAttempt: -1 },
        { ...metadata(), retryAttempt: 10_001 },
        { ...metadata(), runId: 'x'.repeat(129) },
        {
            ...metadata(),
            source: { id: 'unsafe/id', kind: 'stop-operation', version: 1 },
        },
        {
            ...metadata(),
            source: { id: 'source:1', kind: 'private-kind', version: 1 },
        },
        {
            ...metadata(),
            source: {
                id: 'source:1',
                kind: 'stop-operation',
                privateNote: 'no',
                version: 1,
            },
        },
        {
            ...metadata(),
            source: { id: 'source:1', kind: 'stop-operation', version: -1 },
        },
        { ...metadata(), privateNote: 'must-not-pass' },
        {
            ...metadata('exception'),
            exception: { outcome: 'raw', reason: 'raw' },
        },
        { ...metadata('exception'), exception: undefined },
        { ...metadata(), exception: { outcome: 'failed', reason: 'raw' } },
    ]) {
        assert.equal(parseDeliveryLifecycleEmailMetadata(invalid), null);
    }
});

test('disabled delivery lifecycle email worker performs no storage or sender work', async () => {
    let listed = false;
    const result = await runDeliveryLifecycleEmailWorker({
        dependencies: {
            listCandidates: async () => {
                listed = true;
                return [];
            },
        },
        enabled: false,
    });

    assert.equal(listed, false);
    assert.deepEqual(result, {
        candidates: 0,
        claimFailures: 0,
        claimed: 0,
        deferred: 0,
        enabled: false,
        failed: 0,
        finalizationFailures: 0,
        invalidPayloads: 0,
        sent: 0,
        skipped: 0,
        unavailable: 0,
    });
});

test('worker counts non-start transitions without sending or finalization failures', async () => {
    let sends = 0;
    const candidates = [
        'start-deferred-1',
        'start-skipped-2',
        'start-unavailable-3',
    ].map((notificationId) => ({
        notificationId,
        userId: `user:${notificationId}`,
    }));
    const result = await runDeliveryLifecycleEmailWorker({
        dependencies: {
            claim: async (candidate) => ({
                claim: claim(candidate.notificationId),
                status: 'claimed',
            }),
            listCandidates: async () => candidates,
            send: async () => {
                sends += 1;
                return { id: 'provider:1' };
            },
            start: async ({ notificationId }) => {
                if (notificationId.includes('deferred')) {
                    return { reason: 'quiet_hours', status: 'deferred' };
                }
                if (notificationId.includes('skipped')) {
                    return {
                        reason: 'preference_disabled',
                        status: 'skipped',
                    };
                }
                return {
                    reason: 'notification_expired',
                    status: 'unavailable',
                };
            },
        },
        enabled: true,
    });

    assert.deepEqual(result, {
        candidates: 3,
        claimFailures: 0,
        claimed: 3,
        deferred: 1,
        enabled: true,
        failed: 0,
        finalizationFailures: 0,
        invalidPayloads: 0,
        sent: 0,
        skipped: 1,
        unavailable: 1,
    });
    assert.equal(sends, 0);
});

test('worker sends to the start-time email when the address changes after claim', async () => {
    const notificationId = 'changed-email-1';
    const startEmail = 'current-address@example.test';
    const sentTo: string[] = [];
    const templateEmails: string[] = [];
    const result = await runDeliveryLifecycleEmailWorker({
        dependencies: {
            claim: async () => ({
                claim: {
                    ...claim(notificationId),
                    email: 'stale-address@example.test',
                },
                status: 'claimed',
            }),
            listCandidates: async () => [
                {
                    notificationId,
                    userId: `user:${notificationId}`,
                },
            ],
            markSent: async () => true,
            send: async (to, config) => {
                sentTo.push(to);
                templateEmails.push(config.email);
                return { id: 'provider:changed-email' };
            },
            start: async () => started(notificationId, startEmail),
        },
        enabled: true,
    });

    assert.equal(result.sent, 1);
    assert.deepEqual(sentTo, [startEmail]);
    assert.deepEqual(templateEmails, [startEmail]);
});

test('worker isolates claims and sender failures while dropping invalid payloads', async (t) => {
    const privateSentinel = 'PRIVATE_WORKER_SENTINEL_8675309';
    const logged: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => logged.push(args));
    t.mock.method(console, 'warn', (...args: unknown[]) => logged.push(args));
    const candidates = [
        'claim-error',
        'deferred',
        'skipped',
        'unavailable',
        'invalid-4',
        'send-failure-5',
        'success-6',
    ].map((notificationId) => ({
        notificationId,
        userId: `user:${notificationId}`,
    }));
    const dropped: number[] = [];
    const failed: number[] = [];
    const sent: Array<{
        attemptId: number;
        providerMessageId?: string | null;
    }> = [];
    const sendOrder: string[] = [];

    const result = await runDeliveryLifecycleEmailWorker({
        dependencies: {
            claim: async (
                candidate,
            ): Promise<DeliveryLifecycleEmailClaimResult> => {
                switch (candidate.notificationId) {
                    case 'claim-error':
                        throw new Error(privateSentinel);
                    case 'deferred':
                        return { reason: 'quiet_hours', status: 'deferred' };
                    case 'skipped':
                        return {
                            reason: 'preference_disabled',
                            status: 'skipped',
                        };
                    case 'unavailable':
                        return {
                            reason: 'already_claimed',
                            status: 'unavailable',
                        };
                    case 'invalid-4':
                        return {
                            claim: claim(candidate.notificationId, {
                                ...metadata(),
                                rawMetadata: privateSentinel,
                            }),
                            status: 'claimed',
                        };
                    default:
                        return {
                            claim: claim(candidate.notificationId),
                            status: 'claimed',
                        };
                }
            },
            clock: () => new Date('2026-07-16T12:00:00.000Z'),
            drop: async ({ attemptId }) => {
                dropped.push(attemptId);
                return true;
            },
            listCandidates: async (options) => {
                assert.equal(options?.limit, 7);
                return candidates;
            },
            markFailed: async ({ attemptId }) => {
                failed.push(attemptId);
                return true;
            },
            markSent: async ({ attemptId, providerMessageId }) => {
                sent.push({ attemptId, providerMessageId });
                return true;
            },
            send: async (to, config) => {
                sendOrder.push(to);
                assert.deepEqual(Object.keys(config.event).sort(), [
                    'milestone',
                    'requestId',
                ]);
                if (to.startsWith('send-failure')) {
                    throw new Error(privateSentinel);
                }
                return { id: `provider:${'x'.repeat(200)}` };
            },
            start: async ({ notificationId }) => started(notificationId),
        },
        enabled: true,
        limit: 7,
    });

    assert.deepEqual(result, {
        candidates: 7,
        claimFailures: 1,
        claimed: 3,
        deferred: 1,
        enabled: true,
        failed: 1,
        finalizationFailures: 0,
        invalidPayloads: 1,
        sent: 1,
        skipped: 2,
        unavailable: 1,
    });
    assert.deepEqual(dropped, [4]);
    assert.deepEqual(failed, [5]);
    assert.equal(sent[0]?.attemptId, 6);
    assert.equal(sent[0]?.providerMessageId?.length, 128);
    assert.deepEqual(sendOrder, [
        'send-failure-5@example.test',
        'success-6@example.test',
    ]);
    assert.equal(JSON.stringify(logged).includes(privateSentinel), false);
});

test('successful send finalization failure is not converted into a retryable sender failure', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    let markedFailed = 0;
    const result = await runDeliveryLifecycleEmailWorker({
        dependencies: {
            claim: async () => ({
                claim: claim('success-1'),
                status: 'claimed',
            }),
            listCandidates: async () => [
                { notificationId: 'success-1', userId: 'user:success-1' },
            ],
            markFailed: async () => {
                markedFailed += 1;
                return true;
            },
            markSent: async () => false,
            send: async () => ({ id: 'provider:1' }),
            start: async ({ notificationId }) => started(notificationId),
        },
        enabled: true,
    });

    assert.equal(result.sent, 0);
    assert.equal(result.finalizationFailures, 1);
    assert.equal(markedFailed, 0);
});

test('worker retries bounded transient provider rejections and drops terminal rejections', async (t) => {
    const logged: unknown[] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => logged.push(args));
    const retryableNotificationId = 'retryable-rejection-429';
    const terminalNotificationId = 'terminal-rejection-400';
    const failed: number[] = [];
    const dropped: Array<{ attemptId: number; reason: string }> = [];

    const result = await runDeliveryLifecycleEmailWorker({
        dependencies: {
            claim: async (candidate) => ({
                claim: claim(candidate.notificationId),
                status: 'claimed',
            }),
            drop: async ({ attemptId, reason }) => {
                dropped.push({ attemptId, reason });
                return true;
            },
            listCandidates: async () => [
                {
                    notificationId: retryableNotificationId,
                    userId: `user:${retryableNotificationId}`,
                },
                {
                    notificationId: terminalNotificationId,
                    userId: `user:${terminalNotificationId}`,
                },
            ],
            markFailed: async ({ attemptId }) => {
                failed.push(attemptId);
                return true;
            },
            send: async (to) => {
                throw new EmailProviderSubmissionRejectedError(
                    to.startsWith('retryable') ? 429 : 400,
                );
            },
            start: async ({ notificationId }) => started(notificationId),
        },
        enabled: true,
    });

    assert.equal(result.claimed, 2);
    assert.equal(result.failed, 2);
    assert.deepEqual(failed, [429]);
    assert.deepEqual(dropped, [
        { attemptId: 400, reason: 'provider_rejected' },
    ]);
    assert.equal(
        JSON.stringify(logged).includes('email_provider_submission_rejected'),
        true,
    );
    assert.equal(JSON.stringify(logged).includes('"retryable":true'), true);
    assert.equal(JSON.stringify(logged).includes('"retryable":false'), true);
});

test('post-submission uncertainty keeps the durable attempt fenced from a second provider submission', async (t) => {
    const privateSentinel = 'PRIVATE_PROVIDER_POLL_SENTINEL_8675309';
    const logged: unknown[] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => logged.push(args));
    let providerSubmissions = 0;
    let markedFailed = 0;
    let attemptIsSending = false;
    let providerOperationId = '';
    const notificationId = 'ambiguous-7';
    const candidate = {
        notificationId,
        userId: `user:${notificationId}`,
    };
    const dependencies = {
        claim: async () => ({
            claim: claim(notificationId),
            status: 'claimed' as const,
        }),
        listCandidates: async () => (attemptIsSending ? [] : [candidate]),
        markFailed: async () => {
            markedFailed += 1;
            attemptIsSending = false;
            return true;
        },
        send: async (
            _to: string,
            _config: unknown,
            options: { providerOperationId: string },
        ) => {
            providerSubmissions += 1;
            attemptIsSending = true;
            providerOperationId = options.providerOperationId;
            throw new EmailProviderSubmissionUncertainError(
                options.providerOperationId,
                new Error(privateSentinel),
            );
        },
        start: async () => started(notificationId),
    };

    const first = await runDeliveryLifecycleEmailWorker({
        dependencies,
        enabled: true,
    });
    const second = await runDeliveryLifecycleEmailWorker({
        dependencies,
        enabled: true,
    });

    assert.equal(first.failed, 1);
    assert.equal(first.claimed, 1);
    assert.equal(second.candidates, 0);
    assert.equal(providerSubmissions, 1);
    assert.equal(markedFailed, 0);
    assert.equal(
        providerOperationId,
        deliveryLifecycleEmailProviderOperationId(claim(notificationId)),
    );
    assert.equal(JSON.stringify(logged).includes(privateSentinel), false);
});
