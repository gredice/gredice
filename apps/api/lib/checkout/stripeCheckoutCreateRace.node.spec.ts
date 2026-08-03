import assert from 'node:assert/strict';
import test from 'node:test';
import { StripeCheckoutAttemptConflictError } from '@gredice/storage';
import { recoverStripeCheckoutAttemptAfterCreateRace } from './stripeCheckoutCreateRace';

test('maps a conflicting concurrent attempt recovery to cart changed', async () => {
    const result = await recoverStripeCheckoutAttemptAfterCreateRace({
        getActiveAttempt: async () => ({ attemptId: 'attempt-1' }),
        recoverAttempt: async () => {
            throw new StripeCheckoutAttemptConflictError(
                'checkout_identity_changed',
            );
        },
    });

    assert.deepEqual(result, { status: 'cart_changed' });
});

test('returns a recovered concurrent attempt', async () => {
    const result = await recoverStripeCheckoutAttemptAfterCreateRace({
        getActiveAttempt: async () => ({ attemptId: 'attempt-1' }),
        recoverAttempt: async (attempt) => ({
            sessionId: `${attempt.attemptId}-session`,
        }),
    });

    assert.deepEqual(result, {
        recovery: { sessionId: 'attempt-1-session' },
        status: 'recovered',
    });
});

test('keeps unexpected concurrent recovery failures visible', async () => {
    await assert.rejects(
        recoverStripeCheckoutAttemptAfterCreateRace({
            getActiveAttempt: async () => ({ attemptId: 'attempt-1' }),
            recoverAttempt: async () => {
                throw new Error('storage unavailable');
            },
        }),
        /storage unavailable/,
    );
});
