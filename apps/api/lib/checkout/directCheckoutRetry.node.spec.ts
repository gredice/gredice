import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type DirectCheckoutRetryDependencies,
    getPaidCartCheckoutRetryResponse,
} from './directCheckoutRetry';

const cart = {
    accountId: 'account-1',
    id: 44,
    status: 'paid',
};

function dependencies(
    metadata: Record<string, unknown> | null,
): DirectCheckoutRetryDependencies {
    return {
        getConfirmationIntent: async () =>
            metadata
                ? {
                      metadata,
                  }
                : undefined,
    };
}

test('owned paid cart is an idempotent success with a durable outbox intent', async () => {
    const response = await getPaidCartCheckoutRetryResponse(
        { accountId: 'account-1', cart },
        dependencies({ outboxKind: 'order_confirmation', cartId: 44 }),
    );

    assert.deepStrictEqual(response, {
        body: { success: true },
        status: 200,
    });
});

test('paid cart without a durable outbox intent remains a visible conflict', async () => {
    const missing = await getPaidCartCheckoutRetryResponse(
        { accountId: 'account-1', cart },
        dependencies(null),
    );
    const legacyLog = await getPaidCartCheckoutRetryResponse(
        { accountId: 'account-1', cart },
        dependencies({ orderReference: 'Narudžba #44' }),
    );

    assert.strictEqual(missing?.status, 409);
    assert.strictEqual(missing?.body.code, 'CHECKOUT_CONFIRMATION_MISSING');
    assert.strictEqual(legacyLog?.status, 409);
});

test('paid cart retry helper never confirms a cart owned by another account', async () => {
    const response = await getPaidCartCheckoutRetryResponse(
        { accountId: 'account-2', cart },
        dependencies({ outboxKind: 'order_confirmation', cartId: 44 }),
    );

    assert.strictEqual(response, null);
});
