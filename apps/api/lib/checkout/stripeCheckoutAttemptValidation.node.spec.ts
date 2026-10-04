import assert from 'node:assert/strict';
import test from 'node:test';
import {
    fingerprintStripeCheckoutValue,
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
} from '@gredice/storage';
import { encodeHarvestDatesMetadata } from './harvestCheckout';
import {
    type StripeCheckoutAttemptValidationDependencies,
    type StripeCheckoutSessionForReconciliation,
    validateStripeCheckoutSessionAgainstAttempt,
} from './stripeCheckoutAttemptValidation';
import { encodeStripeCheckoutAttemptMetadata } from './stripeCheckoutSnapshot';

const attempt = {
    snapshot: {
        attemptId: '93b43108-696d-48ca-92ef-9990c0a84d43',
        cartId: 12,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: [],
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue('cus_1'),
            expiresAt: '2026-08-04T00:00:00.000Z',
            items: [],
            returnUrls: {
                cancel: 'https://example.test/cancel',
                success: 'https://example.test/success',
            },
        },
        userFingerprint: fingerprintStripeCheckoutValue('user-1'),
        version: 1,
    },
} satisfies StripeCheckoutAttempt;

function metadata() {
    return Object.fromEntries(
        Object.entries({
            ...encodeStripeCheckoutAttemptMetadata(attempt.snapshot),
            ...encodeHarvestDatesMetadata([], []),
        }).map(([key, value]) => [key, String(value)]),
    );
}

function dependencies({
    customerId = 'cus_1',
    userIds = ['user-1'],
}: {
    customerId?: string;
    userIds?: string[];
} = {}): StripeCheckoutAttemptValidationDependencies {
    return {
        getAccount: async () => ({ stripeCustomerId: customerId }),
        getAccountUsers: async () => userIds.map((userId) => ({ userId })),
        verifyLiveCart: async () => ({ accountId: 'account-1' }),
    };
}

function session(
    sessionMetadata = metadata(),
): StripeCheckoutSessionForReconciliation {
    return {
        amountTotal: 0,
        customerId: 'cus_1',
        id: 'cs_1',
        lineItems: { data: [] },
        metadata: sessionMetadata,
        paymentStatus: 'unpaid',
        status: 'open',
        url: 'https://stripe.test/session',
    };
}

test('validates canonical cart, customer, user, metadata, and line items', async () => {
    const identity = await validateStripeCheckoutSessionAgainstAttempt({
        attempt,
        dependencies: dependencies(),
        session: session(),
    });

    assert.deepEqual(identity, {
        accountId: 'account-1',
        customerId: 'cus_1',
        userId: 'user-1',
    });
});

test('fails closed before binding when identity or metadata changed', async () => {
    await assert.rejects(
        validateStripeCheckoutSessionAgainstAttempt({
            attempt,
            dependencies: dependencies({ customerId: 'cus_changed' }),
            session: session(),
        }),
        (error) =>
            error instanceof StripeCheckoutAttemptConflictError &&
            error.category === 'checkout_identity_changed',
    );

    await assert.rejects(
        validateStripeCheckoutSessionAgainstAttempt({
            attempt,
            dependencies: dependencies({ userIds: [] }),
            session: session(),
        }),
        (error) =>
            error instanceof StripeCheckoutAttemptConflictError &&
            error.category === 'checkout_user_inactive',
    );

    await assert.rejects(
        validateStripeCheckoutSessionAgainstAttempt({
            attempt,
            dependencies: dependencies(),
            session: session({ ...metadata(), checkoutCartId: '13' }),
        }),
        (error) =>
            error instanceof StripeCheckoutAttemptConflictError &&
            error.category === 'snapshot_identity_changed',
    );
});
