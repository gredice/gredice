import assert from 'node:assert/strict';
import test from 'node:test';
import {
    fingerprintStripeCheckoutValue,
    type StripeCheckoutAttempt,
} from '@gredice/storage';
import type { CheckoutItem } from '@gredice/stripe/server';
import { recoverStripeCheckoutAttemptSession } from './stripeCheckoutRecovery';

function checkoutAttempt(): StripeCheckoutAttempt {
    return {
        snapshot: {
            attemptId: '93b43108-696d-48ca-92ef-9990c0a84d43',
            cartId: 12,
            expectedNonStripeCartItemIds: [],
            harvestDates: [],
            items: [
                {
                    additionalDataFingerprint:
                        fingerprintStripeCheckoutValue(null),
                    amount: 1,
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
            ],
            stripeSession: {
                allowPromotionCodes: true,
                customerFingerprint: fingerprintStripeCheckoutValue('cus_1'),
                expiresAt: '2026-08-04T00:00:00.000Z',
                items: [
                    {
                        cartItemId: 41,
                        price: { currency: 'eur', valueInCents: 350 },
                        product: { name: 'Frozen catalog name' },
                        quantity: 1,
                    },
                ],
                returnUrls: {
                    cancel: 'https://old.example.test/cancel',
                    success: 'https://old.example.test/success',
                },
            },
            userFingerprint: fingerprintStripeCheckoutValue('user-1'),
            version: 1,
        },
    };
}

test('recovers create-before-bind with exact parameters and one Stripe session', async () => {
    let attempt = checkoutAttempt();
    let checkoutCalls = 0;
    const serializedRequests: string[] = [];
    const sessionsByKey = new Map<string, string>();
    const checkout = async (
        _account: {
            email: string;
            id: string;
            name: string;
            stripeCustomerId?: string;
        },
        data: {
            allowPromotionCodes?: boolean;
            expiresAt?: Date;
            items: CheckoutItem[];
            metadata?: Record<string, string | number | null>;
        },
        options: {
            customerId?: string;
            idempotencyKey?: string;
            returnUrls?: { cancel: string; success: string };
        } = {},
    ) => {
        checkoutCalls += 1;
        serializedRequests.push(JSON.stringify({ data, options }));
        const key = options.idempotencyKey;
        assert.ok(key);
        const sessionId = sessionsByKey.get(key) ?? 'cs_recovered';
        sessionsByKey.set(key, sessionId);
        if (checkoutCalls === 1) {
            throw new Error('connection lost after Stripe created the session');
        }
        return { customerId: 'cus_1', sessionId, url: 'https://stripe.test/1' };
    };
    const dependencies = {
        bindAttempt: async (binding: {
            attemptId: string;
            cartId: number;
            sessionId: string;
        }) => {
            attempt = { ...attempt, sessionId: binding.sessionId };
            throw new Error('binding response lost after commit');
        },
        checkout,
        getAttempt: async () => attempt,
        getSession: async () => undefined,
        releaseAttempt: async () => undefined,
    };
    const input = {
        account: {
            email: 'buyer@example.test',
            id: 'account-1',
            name: 'Buyer',
            stripeCustomerId: 'cus_1',
        },
        accountId: 'account-1',
        attempt,
        checkoutAdditionalDataByCartItemId: new Map([
            [41, { delivery: { mode: 'pickup', slotId: 7 } }],
        ]),
        customerId: 'cus_1',
        dependencies,
        now: new Date('2026-08-03T12:00:00.000Z'),
        userId: 'user-1',
    };

    await assert.rejects(
        recoverStripeCheckoutAttemptSession(input),
        /connection lost/,
    );

    // A catalog/URL deployment change cannot alter the persisted replay input.
    const result = await recoverStripeCheckoutAttemptSession({
        ...input,
        attempt,
    });
    assert.deepEqual(result, {
        sessionId: 'cs_recovered',
        status: 'open',
        url: 'https://stripe.test/1',
    });
    assert.equal(sessionsByKey.size, 1);
    assert.equal(serializedRequests[0], serializedRequests[1]);
    assert.match(serializedRequests[1] ?? '', /Frozen catalog name/);
    assert.match(serializedRequests[1] ?? '', /old\.example\.test/);
    assert.match(
        serializedRequests[1] ?? '',
        /93b43108-696d-48ca-92ef-9990c0a84d43/,
    );
});
