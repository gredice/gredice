import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
} from '@gredice/storage';
import {
    assertStripeSessionMatchesCheckoutAttempt,
    decodeStripeCheckoutAttemptMetadata,
    getStripeCheckoutSnapshotAdditionalData,
    getStripeCheckoutSnapshotNonStripeAmounts,
    getStripeCheckoutSnapshotNonStripePaymentKinds,
    type StripeCheckoutSessionForSnapshot,
} from './stripeCheckoutSnapshot';

const attempt: StripeCheckoutAttempt = {
    sessionId: 'cs_snapshot',
    snapshot: {
        accountId: 'account-1',
        attemptId: 'f67ed76e-41f3-4a10-a7f6-472d21b3678b',
        cartId: 12,
        expectedNonStripeCartItemIds: [42],
        harvestDates: [],
        items: [
            {
                additionalData: null,
                amount: 2,
                cartId: 12,
                checkoutAdditionalData: {
                    delivery: { mode: 'pickup', slotId: 7 },
                },
                currency: 'eur',
                entityId: 'plant-7',
                entityTypeName: 'plantSort',
                gardenId: 5,
                id: 41,
                paymentAmount: 350,
                paymentKind: 'stripe',
                positionIndex: 3,
                raisedBedId: 6,
                status: 'new',
            },
            {
                additionalData: '{"scheduledDate":"2026-08-10T00:00:00.000Z"}',
                amount: 1,
                cartId: 12,
                checkoutAdditionalData: {
                    scheduledDate: '2026-08-10T00:00:00.000Z',
                },
                currency: 'sunflower',
                entityId: 'operation-9',
                entityTypeName: 'operation',
                gardenId: 5,
                id: 42,
                paymentAmount: 275,
                paymentKind: 'sunflower',
                positionIndex: 3,
                raisedBedId: 6,
                status: 'new',
            },
        ],
        userId: 'user-1',
        version: 1,
    },
};

function session(
    overrides: Partial<StripeCheckoutSessionForSnapshot> = {},
): StripeCheckoutSessionForSnapshot {
    return {
        amountTotal: 630,
        id: 'cs_snapshot',
        lineItems: {
            data: [
                {
                    amount_total: 630,
                    price: {
                        currency: 'eur',
                        product: {
                            metadata: {
                                accountId: 'account-1',
                                additionalData: JSON.stringify({
                                    delivery: {
                                        mode: 'pickup',
                                        slotId: 7,
                                    },
                                }),
                                cartId: '12',
                                cartItemId: '41',
                                entityId: 'plant-7',
                                entityTypeName: 'plantSort',
                                gardenId: '5',
                                positionIndex: '3',
                                raisedBedId: '6',
                                userId: 'user-1',
                            },
                        },
                        unit_amount: 350,
                    },
                    quantity: 2,
                },
            ],
        },
        ...overrides,
    };
}

function expectConflict(operation: () => void, category: string): void {
    assert.throws(operation, (error) => {
        assert.ok(error instanceof StripeCheckoutAttemptConflictError);
        assert.equal(error.category, category);
        return true;
    });
}

describe('Stripe checkout snapshot metadata', () => {
    it('keeps legacy sessions on the compatibility path and rejects partial metadata', () => {
        assert.equal(decodeStripeCheckoutAttemptMetadata(undefined), null);
        assert.deepEqual(
            decodeStripeCheckoutAttemptMetadata({
                checkoutAttemptId: attempt.snapshot.attemptId,
                checkoutCartId: '12',
                checkoutSnapshotVersion: '1',
            }),
            { attemptId: attempt.snapshot.attemptId, cartId: 12 },
        );
        expectConflict(
            () =>
                decodeStripeCheckoutAttemptMetadata({
                    checkoutAttemptId: attempt.snapshot.attemptId,
                }),
            'session_metadata_invalid',
        );
    });
});

describe('assertStripeSessionMatchesCheckoutAttempt', () => {
    it('accepts the immutable item identity and a Stripe promotion discount', () => {
        assert.doesNotThrow(() =>
            assertStripeSessionMatchesCheckoutAttempt(session(), attempt),
        );
    });

    it('rejects inserted, deleted, repriced, retargeted, and duplicated lines', () => {
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({
                        lineItems: {
                            data: [
                                ...(session().lineItems?.data ?? []),
                                {
                                    amount_total: 10,
                                    price: { currency: 'eur', unit_amount: 10 },
                                    quantity: 1,
                                },
                            ],
                        },
                    }),
                    attempt,
                ),
            'stripe_membership_changed',
        );
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({ amountTotal: 0, lineItems: { data: [] } }),
                    attempt,
                ),
            'stripe_membership_changed',
        );
        const repricedLine = session().lineItems?.data[0];
        assert.ok(repricedLine?.price);
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({
                        lineItems: {
                            data: [
                                {
                                    ...repricedLine,
                                    price: {
                                        ...repricedLine.price,
                                        unit_amount: 351,
                                    },
                                },
                            ],
                        },
                    }),
                    attempt,
                ),
            'stripe_item_changed',
        );
        const retargetedProduct = repricedLine.price.product;
        assert.ok(retargetedProduct && typeof retargetedProduct !== 'string');
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({
                        lineItems: {
                            data: [
                                {
                                    ...repricedLine,
                                    price: {
                                        ...repricedLine.price,
                                        product: {
                                            ...retargetedProduct,
                                            metadata: {
                                                ...retargetedProduct.metadata,
                                                positionIndex: '4',
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    }),
                    attempt,
                ),
            'stripe_item_changed',
        );
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({
                        lineItems: {
                            data: [
                                {
                                    ...repricedLine,
                                    price: {
                                        ...repricedLine.price,
                                        product: {
                                            ...retargetedProduct,
                                            metadata: {
                                                ...retargetedProduct.metadata,
                                                userId: 'user-2',
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    }),
                    attempt,
                ),
            'stripe_item_changed',
        );
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({
                        lineItems: {
                            data: [repricedLine, repricedLine],
                        },
                    }),
                    attempt,
                ),
            'stripe_membership_changed',
        );
    });
});

describe('immutable non-Stripe fulfillment inputs', () => {
    it('replays the recorded amount and additional data independently of later catalog values', () => {
        assert.equal(
            getStripeCheckoutSnapshotNonStripeAmounts(attempt).get(42),
            275,
        );
        assert.equal(
            getStripeCheckoutSnapshotNonStripePaymentKinds(attempt).get(42),
            'sunflower',
        );
        assert.deepEqual(
            getStripeCheckoutSnapshotAdditionalData(attempt).get(42),
            { scheduledDate: '2026-08-10T00:00:00.000Z' },
        );
    });
});
