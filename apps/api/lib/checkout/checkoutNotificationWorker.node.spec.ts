import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailProviderSubmissionUncertainError } from '@gredice/email/acs';
import { runCheckoutNotificationWorker } from './checkoutNotificationWorker';

const queuedAt = new Date('2026-08-03T08:00:00.000Z');

function operationClaim() {
    return {
        claim: {
            attempt: 1,
            claimId: 'worker-claim',
            emailMessageId: 4375,
            maxAttempts: 3,
            payload: {
                kind: 'operation_scheduled_slack' as const,
                operationId: 42,
                scheduledDate: '2026-08-04T08:00:00.000Z',
            },
            providerOperationId: '00000000-0000-5000-a000-000000004375',
            queuedAt,
        },
        status: 'claimed' as const,
    };
}

function deliveryEmailClaim() {
    return {
        claim: {
            attempt: 1,
            claimId: 'email-claim',
            emailMessageId: 4376,
            maxAttempts: 3,
            payload: {
                kind: 'delivery_scheduled_email' as const,
                requestId: 'delivery-request',
                to: 'customer@example.test',
            },
            providerOperationId: '00000000-0000-5000-a000-000000004376',
            queuedAt,
        },
        status: 'claimed' as const,
    };
}

test('worker fences Slack before submission and finalizes accepted delivery', async () => {
    let claims = 0;
    const events: string[] = [];
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            abortSignal: () => new AbortController().signal,
            claim: async () => {
                claims += 1;
                return claims === 1 ? operationClaim() : { status: 'empty' };
            },
            markSent: async () => {
                events.push('sent');
                return { status: 'sent' };
            },
            monotonicNow: () => 0,
            notifyOperation: async (
                _operationId,
                _type,
                _options,
                deliveryOptions = {},
            ) => {
                await deliveryOptions?.beforeProviderSubmission?.();
                events.push('provider');
                return {
                    ok: true,
                    outcome: 'accepted',
                    response: { ts: '123.456' },
                    status: 200,
                };
            },
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'worker-claim',
            start: async () => {
                events.push('fence');
                return { status: 'started' };
            },
        },
    });

    assert.deepEqual(events, ['fence', 'provider', 'sent']);
    assert.equal(result.claimed, 1);
    assert.equal(result.sent, 1);
    assert.equal(result.uncertain, 0);
});

test('worker never retries an uncertain Slack submission', async () => {
    let claims = 0;
    let observedFailureKind: string | undefined;
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            abortSignal: () => new AbortController().signal,
            claim: async () => {
                claims += 1;
                return claims === 1 ? operationClaim() : { status: 'empty' };
            },
            markFailed: async ({ failureKind }) => {
                observedFailureKind = failureKind;
                return { status: 'fenced' };
            },
            monotonicNow: () => 0,
            notifyOperation: async (
                _operationId,
                _type,
                _options,
                deliveryOptions = {},
            ) => {
                await deliveryOptions?.beforeProviderSubmission?.();
                return {
                    error: 'connection_reset',
                    ok: false,
                    outcome: 'uncertain',
                };
            },
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'worker-claim',
            start: async () => ({ status: 'started' }),
        },
    });

    assert.equal(observedFailureKind, 'uncertain');
    assert.equal(result.uncertain, 1);
    assert.equal(result.queuedForRetry, 0);
});

test('missing Slack configuration is deferred without submission', async () => {
    let claims = 0;
    let starts = 0;
    let observedFailureKind: string | undefined;
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            abortSignal: () => new AbortController().signal,
            claim: async () => {
                claims += 1;
                return claims === 1 ? operationClaim() : { status: 'empty' };
            },
            markFailed: async ({ failureKind }) => {
                observedFailureKind = failureKind;
                return {
                    attempt: 1,
                    nextAttemptAt: new Date('2026-08-03T09:01:00.000Z'),
                    status: 'retry_scheduled',
                };
            },
            monotonicNow: () => 0,
            notifyOperation: async () => ({
                ok: false,
                outcome: 'not_started',
                skipped: 'missing_token',
            }),
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'worker-claim',
            start: async () => {
                starts += 1;
                return { status: 'started' };
            },
        },
    });

    assert.equal(starts, 0);
    assert.equal(observedFailureKind, 'configuration');
    assert.equal(result.queuedForRetry, 1);
});

test('pre-submission Slack failures are not classified as missing ACS configuration', async () => {
    let claims = 0;
    let observedFailureCode: string | undefined;
    let observedFailureKind: string | undefined;
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            abortSignal: () => new AbortController().signal,
            claim: async () => {
                claims += 1;
                return claims === 1 ? operationClaim() : { status: 'empty' };
            },
            markFailed: async ({ failureCode, failureKind }) => {
                observedFailureCode = failureCode;
                observedFailureKind = failureKind;
                return {
                    attempt: 1,
                    nextAttemptAt: new Date('2026-08-03T09:01:00.000Z'),
                    status: 'retry_scheduled',
                };
            },
            monotonicNow: () => 0,
            notifyOperation: async (
                _operationId,
                _type,
                _options,
                deliveryOptions = {},
            ) => {
                assert.equal(deliveryOptions.throwOnLookupError, true);
                throw new Error('context lookup failed');
            },
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'worker-claim',
        },
    });

    assert.equal(observedFailureCode, 'worker_error_before_submission');
    assert.equal(observedFailureKind, 'retryable');
    assert.equal(result.queuedForRetry, 1);
});

test('delivery email resolves details, fences ACS submission, and finalizes sent', async () => {
    let claims = 0;
    const events: string[] = [];
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            abortSignal: () => new AbortController().signal,
            buildDeliveryEmailDetails: async (requestId) => {
                events.push(`details:${requestId}`);
                return {
                    accountId: 'account',
                    addressLine: 'Testna 1, Zagreb',
                    contactName: 'Kupac',
                    deliveryWindow: '4. kolovoza, 08:00 - 10:00',
                    recipients: ['customer@example.test'],
                    requestId,
                    state: 'pending',
                };
            },
            claim: async () => {
                claims += 1;
                return claims === 1
                    ? deliveryEmailClaim()
                    : { status: 'empty' };
            },
            markSent: async ({ providerDeliveryId, providerStatus }) => {
                events.push(`sent:${providerDeliveryId}:${providerStatus}`);
                return { status: 'sent' };
            },
            monotonicNow: () => 0,
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'email-claim',
            sendDeliveryEmail: async (to, config, options) => {
                if (!options) throw new Error('Expected delivery options');
                events.push(`render:${to}:${config.deliveryWindow}`);
                await options.beforeProviderSubmission?.();
                events.push('provider');
                return {
                    id: 'acs-delivery-operation',
                    status: 'Succeeded',
                };
            },
            start: async () => {
                events.push('fence');
                return { status: 'started' };
            },
        },
    });

    assert.deepEqual(events, [
        'details:delivery-request',
        'render:customer@example.test:4. kolovoza, 08:00 - 10:00',
        'fence',
        'provider',
        'sent:acs-delivery-operation:Succeeded',
    ]);
    assert.equal(result.sent, 1);
});

test('delivery email is skipped as obsolete after the request is cancelled', async () => {
    let claims = 0;
    let skippedReason: string | undefined;
    let providerCalls = 0;
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            buildDeliveryEmailDetails: async (requestId) => ({
                accountId: 'account',
                deliveryWindow: '4. kolovoza, 08:00 - 10:00',
                recipients: ['customer@example.test'],
                requestId,
                state: 'cancelled',
            }),
            claim: async () => {
                claims += 1;
                return claims === 1
                    ? deliveryEmailClaim()
                    : { status: 'empty' };
            },
            markSkipped: async ({ reason }) => {
                skippedReason = reason;
                return { status: 'skipped' };
            },
            monotonicNow: () => 0,
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'email-claim',
            sendDeliveryEmail: async () => {
                providerCalls += 1;
                return {
                    id: 'must-not-send',
                    status: 'Succeeded',
                };
            },
        },
    });

    assert.equal(skippedReason, 'obsolete');
    assert.equal(providerCalls, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.sent, 0);
});

test('ambiguous ACS delivery submission is fenced without a send retry', async () => {
    let claims = 0;
    let failureKind: string | undefined;
    const result = await runCheckoutNotificationWorker({
        dependencies: {
            abortSignal: () => new AbortController().signal,
            buildDeliveryEmailDetails: async (requestId) => ({
                accountId: 'account',
                deliveryWindow: '4. kolovoza, 08:00 - 10:00',
                recipients: ['customer@example.test'],
                requestId,
                state: 'pending',
            }),
            claim: async () => {
                claims += 1;
                return claims === 1
                    ? deliveryEmailClaim()
                    : { status: 'empty' };
            },
            markFailed: async (failure) => {
                failureKind = failure.failureKind;
                return { status: 'fenced' };
            },
            monotonicNow: () => 0,
            now: () => new Date('2026-08-03T09:00:00.000Z'),
            randomId: () => 'email-claim',
            sendDeliveryEmail: async (_to, _config, options) => {
                if (!options) throw new Error('Expected delivery options');
                await options.beforeProviderSubmission?.();
                throw new EmailProviderSubmissionUncertainError(
                    '00000000-0000-5000-a000-000000004376',
                    new Error('connection reset'),
                );
            },
            start: async () => ({ status: 'started' }),
        },
    });

    assert.equal(failureKind, 'uncertain');
    assert.equal(result.uncertain, 1);
    assert.equal(result.queuedForRetry, 0);
});
