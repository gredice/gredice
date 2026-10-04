import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import {
    fingerprintStripeCheckoutValue,
    type StripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
} from '@gredice/storage';
import {
    assertStripeSessionMatchesCheckoutAttempt,
    buildStripeCheckoutReplayInput,
    buildVerifiedStripeCheckoutAdditionalData,
    decodeStripeCheckoutAttemptMetadata,
    getStripeCheckoutSnapshotAdvancedSowingAuthorizations,
    getStripeCheckoutSnapshotNonStripeAmounts,
    getStripeCheckoutSnapshotNonStripePaymentKinds,
    type StripeCheckoutSessionForSnapshot,
} from './stripeCheckoutSnapshot';

const attempt: StripeCheckoutAttempt = {
    sessionId: 'cs_snapshot',
    snapshot: {
        attemptId: 'f67ed76e-41f3-4a10-a7f6-472d21b3678b',
        cartId: 12,
        expectedNonStripeCartItemIds: [42],
        harvestDates: [],
        items: [
            {
                advancedSowingAuthorization: {
                    kind: advancedSowingCartAuthorizationKind,
                    plan: buildAdvancedSowingCartConfigurationV1({
                        anchorPositionIndex: 3,
                        bedFieldCount: 18,
                        maxDistanceCm: 60,
                        minDistanceCm: 15,
                        optimalDistanceCm: 30,
                        selectedDistanceCm: 30,
                    }),
                    version: 1,
                },
                additionalDataFingerprint: fingerprintStripeCheckoutValue(null),
                amount: 2,
                cartId: 12,
                checkoutAdditionalDataFingerprint:
                    fingerprintStripeCheckoutValue({
                        delivery: { mode: 'pickup', slotId: 7 },
                    }),
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
                additionalDataFingerprint: fingerprintStripeCheckoutValue(
                    '{"scheduledDate":"2026-08-10T00:00:00.000Z"}',
                ),
                amount: 1,
                cartId: 12,
                checkoutAdditionalDataFingerprint:
                    fingerprintStripeCheckoutValue({
                        delivery: { mode: 'pickup', slotId: 7 },
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                    }),
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
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue('cus_1'),
            expiresAt: '2026-08-10T12:00:00.000Z',
            items: [
                {
                    cartItemId: 41,
                    price: { currency: 'eur', valueInCents: 350 },
                    product: { name: 'Biljka' },
                    quantity: 2,
                },
            ],
            returnUrls: {
                cancel: 'https://example.test/cancel',
                success: 'https://example.test/success',
            },
        },
        userFingerprint: fingerprintStripeCheckoutValue('user-1'),
        version: 1,
    },
};

const runtimeIdentity = { accountId: 'account-1', userId: 'user-1' };

function session(
    overrides: Partial<StripeCheckoutSessionForSnapshot> = {},
): StripeCheckoutSessionForSnapshot {
    return {
        amountTotal: 630,
        customerId: 'cus_1',
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

    it('keeps server authorization in the snapshot and out of Stripe product metadata', () => {
        assert.equal(
            getStripeCheckoutSnapshotAdvancedSowingAuthorizations(attempt).get(
                41,
            )?.kind,
            advancedSowingCartAuthorizationKind,
        );
        const replay = buildStripeCheckoutReplayInput({
            accountId: runtimeIdentity.accountId,
            attempt,
            checkoutAdditionalDataByCartItemId: new Map([
                [41, { delivery: { mode: 'pickup', slotId: 7 } }],
                [
                    42,
                    {
                        delivery: { mode: 'pickup', slotId: 7 },
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                    },
                ],
            ]),
            customerId: 'cus_1',
            userId: runtimeIdentity.userId,
        });
        const metadata = replay.data.items[0]?.product.metadata;
        assert.ok(metadata);
        assert.equal(
            Object.hasOwn(metadata, 'advancedSowingAuthorization'),
            false,
        );
        assert.equal(
            JSON.stringify(metadata).includes(
                advancedSowingCartAuthorizationKind,
            ),
            false,
        );
    });
});

describe('assertStripeSessionMatchesCheckoutAttempt', () => {
    it('accepts the immutable item identity and a Stripe promotion discount', () => {
        assert.doesNotThrow(() =>
            assertStripeSessionMatchesCheckoutAttempt(
                session(),
                attempt,
                runtimeIdentity,
            ),
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
                    runtimeIdentity,
                ),
            'stripe_membership_changed',
        );
        expectConflict(
            () =>
                assertStripeSessionMatchesCheckoutAttempt(
                    session({ amountTotal: 0, lineItems: { data: [] } }),
                    attempt,
                    runtimeIdentity,
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
                    runtimeIdentity,
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
                    runtimeIdentity,
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
                    runtimeIdentity,
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
                    runtimeIdentity,
                ),
            'stripe_membership_changed',
        );
    });
});

describe('immutable non-Stripe fulfillment inputs', () => {
    it('replays recorded amounts and verifies reconstructed delivery data', () => {
        assert.equal(
            getStripeCheckoutSnapshotNonStripeAmounts(attempt).get(42),
            275,
        );
        assert.equal(
            getStripeCheckoutSnapshotNonStripePaymentKinds(attempt).get(42),
            'sunflower',
        );
        const additionalData = buildVerifiedStripeCheckoutAdditionalData({
            attempt,
            liveItems: [
                { additionalData: null, id: 41 },
                {
                    additionalData:
                        '{"scheduledDate":"2026-08-10T00:00:00.000Z"}',
                    id: 42,
                },
            ],
            session: session(),
        });
        assert.deepEqual(additionalData.get(42), {
            delivery: { mode: 'pickup', slotId: 7 },
            scheduledDate: '2026-08-10T00:00:00.000Z',
        });
    });
});
