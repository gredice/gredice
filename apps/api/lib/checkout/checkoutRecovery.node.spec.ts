import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    assertCheckoutCartItemSnapshot,
    getCheckoutOperationRecoveryState,
} from './checkoutRecovery';

const cartItemSnapshot = {
    additionalData: null,
    amount: 1,
    currency: 'sunflower',
    entityId: 'operation-1',
    entityTypeName: 'operation',
    gardenId: 7,
    id: 42,
    positionIndex: 2,
    raisedBedId: 9,
};

describe('assertCheckoutCartItemSnapshot', () => {
    it('accepts an unchanged pending item and an already-paid replay', () => {
        assert.equal(
            assertCheckoutCartItemSnapshot(
                { ...cartItemSnapshot, status: 'new' },
                cartItemSnapshot,
            ),
            'pending',
        );
        assert.equal(
            assertCheckoutCartItemSnapshot(
                {
                    ...cartItemSnapshot,
                    amount: 99,
                    status: 'paid',
                },
                cartItemSnapshot,
            ),
            'paid',
        );
    });

    it('fails closed when the pending item changed or disappeared', () => {
        assert.throws(
            () =>
                assertCheckoutCartItemSnapshot(
                    { ...cartItemSnapshot, amount: 2, status: 'new' },
                    cartItemSnapshot,
                ),
            /changed before fulfillment/u,
        );
        assert.throws(
            () => assertCheckoutCartItemSnapshot(undefined, cartItemSnapshot),
            /disappeared before fulfillment/u,
        );
    });
});

describe('getCheckoutOperationRecoveryState', () => {
    it('blocks a new Stripe session for a mapped pending euro operation', () => {
        assert.equal(
            getCheckoutOperationRecoveryState(
                [
                    {
                        currency: 'eur',
                        entityTypeName: 'operation',
                        id: 42,
                        status: 'new',
                    },
                ],
                new Map([[42, { paymentCurrency: 'eur' }]]),
            ),
            'stripe_payment_processing',
        );
    });

    it('allows direct recovery and ordinary first-attempt checkout items', () => {
        const items = [
            {
                currency: 'sunflower',
                entityTypeName: 'operation',
                id: 42,
                status: 'new',
            },
            {
                currency: 'eur',
                entityTypeName: 'operation',
                id: 43,
                status: 'new',
            },
            {
                currency: 'eur',
                entityTypeName: 'operation',
                id: 44,
                status: 'paid',
            },
        ];

        assert.equal(
            getCheckoutOperationRecoveryState(
                items,
                new Map([
                    [42, { paymentCurrency: 'sunflower' }],
                    [44, { paymentCurrency: 'eur' }],
                ]),
            ),
            null,
        );
    });

    it('rejects both directions of mutable payment-currency drift', () => {
        const pendingOperation = {
            currency: 'sunflower',
            entityTypeName: 'operation',
            id: 42,
            status: 'new',
        };

        assert.equal(
            getCheckoutOperationRecoveryState(
                [pendingOperation],
                new Map([[42, { paymentCurrency: 'eur' }]]),
            ),
            'currency_mismatch',
        );
        assert.equal(
            getCheckoutOperationRecoveryState(
                [{ ...pendingOperation, currency: 'eur' }],
                new Map([[42, { paymentCurrency: 'inventory' }]]),
            ),
            'currency_mismatch',
        );
    });

    it('blocks a second Stripe session after any pending euro item starts fulfillment', () => {
        const pendingEuroItems = [
            {
                currency: 'eur',
                entityTypeName: 'operation',
                id: 42,
                status: 'new',
            },
            {
                currency: 'eur',
                entityTypeName: 'plantSort',
                id: 43,
                status: 'new',
            },
        ];

        assert.equal(
            getCheckoutOperationRecoveryState(
                pendingEuroItems,
                new Map(),
                new Set([42]),
            ),
            'stripe_payment_processing',
        );
        assert.equal(
            getCheckoutOperationRecoveryState(
                pendingEuroItems,
                new Map(),
                new Set([43]),
            ),
            'stripe_payment_processing',
        );
    });

    it('keeps direct-currency retries and paid euro items recoverable', () => {
        assert.equal(
            getCheckoutOperationRecoveryState(
                [
                    {
                        currency: 'sunflower',
                        entityTypeName: 'operation',
                        id: 42,
                        status: 'new',
                    },
                    {
                        currency: 'eur',
                        entityTypeName: 'plantSort',
                        id: 43,
                        status: 'paid',
                    },
                ],
                new Map(),
                new Set([42, 43]),
            ),
            null,
        );
    });
});
