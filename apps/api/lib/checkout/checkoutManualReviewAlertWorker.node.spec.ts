import assert from 'node:assert/strict';
import test from 'node:test';
import { runCheckoutNotificationWorker } from './checkoutNotificationWorker';

const payload = {
    kind: 'payment_manual_review_slack' as const,
    paymentClaimId: 5454,
    reviewCycleId: 3,
    failureCategory: 'checkout_operation_conflict',
};
const claim = {
    attempt: 1,
    claimId: 'alert-lease',
    emailMessageId: 5454,
    maxAttempts: 3,
    payload,
    providerOperationId: '00000000-0000-5000-a000-000000005454',
    queuedAt: new Date('2026-10-24T10:00:00.000Z'),
};

test('manual-review worker fences then delivers only the privacy-safe alert context', async () => {
    const calls: string[] = [];
    const result = await runCheckoutNotificationWorker({
        limit: 1,
        dependencies: {
            claim: async () => ({ status: 'claimed', claim }),
            monotonicNow: () => 0,
            now: () => claim.queuedAt,
            start: async () => {
                calls.push('fence');
                return { status: 'started' };
            },
            notifyManualReview: async (details, options = {}) => {
                assert.deepEqual(details, payload);
                await options.beforeProviderSubmission?.();
                calls.push('provider');
                return {
                    ok: true,
                    outcome: 'accepted',
                    response: { ts: '123.456' },
                };
            },
            markSent: async ({ providerDeliveryId }) => {
                assert.equal(providerDeliveryId, '123.456');
                calls.push('sent');
                return { status: 'sent' };
            },
            notifyPurchase: async () => {
                throw new Error('Must not notify purchase');
            },
            notifyOperation: async () => {
                throw new Error('Must not replay fulfillment notifications');
            },
        },
    });
    assert.deepEqual(calls, ['fence', 'provider', 'sent']);
    assert.equal(result.sent, 1);
});

for (const skipped of ['missing_channel', 'missing_token'] as const) {
    test(`manual-review ${skipped} stays queued as configuration failure`, async () => {
        const result = await runCheckoutNotificationWorker({
            limit: 1,
            dependencies: {
                claim: async () => ({ status: 'claimed', claim }),
                monotonicNow: () => 0,
                now: () => claim.queuedAt,
                notifyManualReview: async () => ({
                    ok: false,
                    outcome: 'not_started',
                    skipped,
                }),
                start: async () => {
                    throw new Error('Must not start without configuration');
                },
                markSkipped: async () => {
                    throw new Error('Operator incidents must not disappear');
                },
                markFailed: async (failure) => {
                    assert.equal(failure.failureKind, 'configuration');
                    assert.equal(failure.failureCode, 'configuration_error');
                    return {
                        status: 'retry_scheduled',
                        attempt: 1,
                        nextAttemptAt: claim.queuedAt,
                    };
                },
            },
        });
        assert.equal(result.queuedForRetry, 1);
        assert.equal(result.skipped, 0);
    });
}

test('retryable rejection and pre-submission transport failure use durable alert retry', async () => {
    for (const beforeSubmission of [true, false]) {
        const result = await runCheckoutNotificationWorker({
            limit: 1,
            dependencies: {
                claim: async () => ({ status: 'claimed', claim }),
                monotonicNow: () => 0,
                now: () => claim.queuedAt,
                start: async () => ({ status: 'started' }),
                notifyManualReview: async (_details, options = {}) => {
                    if (beforeSubmission)
                        throw new Error('Synthetic lookup transport failure');
                    await options.beforeProviderSubmission?.();
                    return { ok: false, outcome: 'rejected', status: 429 };
                },
                markFailed: async ({ failureKind, failureCode }) => {
                    assert.equal(failureKind, 'retryable');
                    assert.equal(
                        failureCode,
                        beforeSubmission
                            ? 'worker_error_before_submission'
                            : 'provider_rejected_retryable',
                    );
                    return {
                        status: 'retry_scheduled',
                        attempt: 1,
                        nextAttemptAt: claim.queuedAt,
                    };
                },
            },
        });
        assert.equal(result.queuedForRetry, 1);
        assert.equal(result.sent, 0);
    }
});

test('ambiguous operator delivery remains fenced and visible to avoid a duplicate send', async () => {
    const result = await runCheckoutNotificationWorker({
        limit: 1,
        dependencies: {
            claim: async () => ({ status: 'claimed', claim }),
            monotonicNow: () => 0,
            now: () => claim.queuedAt,
            start: async () => ({ status: 'started' }),
            notifyManualReview: async (_details, options = {}) => {
                await options.beforeProviderSubmission?.();
                return { ok: false, outcome: 'uncertain', status: 503 };
            },
            markFailed: async ({ failureKind }) => {
                assert.equal(failureKind, 'uncertain');
                return { status: 'fenced' };
            },
        },
    });
    assert.equal(result.uncertain, 1);
    assert.equal(result.queuedForRetry, 0);
});
