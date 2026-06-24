import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    __testUtils,
    type ProcessCheckoutSessionDependencies,
    processCheckoutSession,
    processItem,
} from './processCheckoutSession';

type RecordedCall = {
    name: string;
    args: unknown[];
};

function record(calls: RecordedCall[], name: string, args: unknown[] = []) {
    calls.push({ name, args });
}

function callNames(calls: RecordedCall[]) {
    return calls.map((call) => call.name);
}

function callsNamed(calls: RecordedCall[], name: string) {
    return calls.filter((call) => call.name === name);
}

function makeDependencies(
    calls: RecordedCall[],
    overrides: Partial<
        Record<keyof ProcessCheckoutSessionDependencies, unknown>
    > = {},
): ProcessCheckoutSessionDependencies {
    const dependencies = {
        isRaisedBedAbandoned: (status: unknown) => {
            record(calls, 'isRaisedBedAbandoned', [status]);
            return status === 'abandoned';
        },
        notifyDeliveryRequestEvent: async (...args: unknown[]) => {
            record(calls, 'notifyDeliveryRequestEvent', args);
        },
        notifyOperationUpdate: async (...args: unknown[]) => {
            record(calls, 'notifyOperationUpdate', args);
        },
        notifyPurchase: async (...args: unknown[]) => {
            record(calls, 'notifyPurchase', args);
        },
        consumeInventoryItem: async (...args: unknown[]) => {
            record(calls, 'consumeInventoryItem', args);
        },
        convertOutletReservationForCartItem: async (...args: unknown[]) => {
            record(calls, 'convertOutletReservationForCartItem', args);
        },
        createDeliveryRequest: async (...args: unknown[]) => {
            record(calls, 'createDeliveryRequest', args);
            return 701;
        },
        createEvent: async (...args: unknown[]) => {
            record(calls, 'createEvent', args);
        },
        createOperation: async (...args: unknown[]) => {
            record(calls, 'createOperation', args);
            return 501;
        },
        createTransaction: async (...args: unknown[]) => {
            record(calls, 'createTransaction', args);
        },
        earnSunflowersForPayment: async (...args: unknown[]) => {
            record(calls, 'earnSunflowersForPayment', args);
        },
        getCompletedTransactionByStripePaymentId: async (
            ...args: unknown[]
        ) => {
            record(calls, 'getCompletedTransactionByStripePaymentId', args);
            return undefined;
        },
        getDefaultShoppingCartScheduledDate: (...args: unknown[]) => {
            record(calls, 'getDefaultShoppingCartScheduledDate', args);
            return '2026-07-02';
        },
        getInventory: async (...args: unknown[]) => {
            record(calls, 'getInventory', args);
            return [];
        },
        getOutletOfferReservationForCartItem: async (...args: unknown[]) => {
            record(calls, 'getOutletOfferReservationForCartItem', args);
            return null;
        },
        getRaisedBed: async (...args: unknown[]) => {
            record(calls, 'getRaisedBed', args);
            return null;
        },
        getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
            record(calls, 'getRaisedBedFieldsWithEvents', args);
            return [];
        },
        getShoppingCart: async (...args: unknown[]) => {
            record(calls, 'getShoppingCart', args);
            return null;
        },
        isCartItemDeliverable: async (...args: unknown[]) => {
            record(calls, 'isCartItemDeliverable', args);
            return false;
        },
        knownEvents: {
            operations: {
                scheduledV1: (aggregateId: string, data: unknown) => ({
                    type: 'operations.scheduled',
                    aggregateId,
                    data,
                }),
            },
            raisedBedFields: {
                plantPlaceV1: (aggregateId: string, data: unknown) => ({
                    type: 'raisedBedFields.plantPlace',
                    aggregateId,
                    data,
                }),
                plantUpdateV1: (aggregateId: string, data: unknown) => ({
                    type: 'raisedBedFields.plantUpdate',
                    aggregateId,
                    data,
                }),
            },
        },
        markCartPaidIfAllItemsPaid: async (cartId: unknown) => {
            record(calls, 'markCartPaidIfAllItemsPaid', [cartId]);
        },
        normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
            record(calls, 'normalizeShoppingCartInventoryUsage', args);
            return {
                id: args[0],
                items: [],
            };
        },
        normalizeShoppingCartScheduledDates: async (...args: unknown[]) => {
            record(calls, 'normalizeShoppingCartScheduledDates', args);
            return undefined;
        },
        setCartItemPaid: async (...args: unknown[]) => {
            record(calls, 'setCartItemPaid', args);
        },
        spendSunflowers: async (...args: unknown[]) => {
            record(calls, 'spendSunflowers', args);
        },
        updateRaisedBed: async (...args: unknown[]) => {
            record(calls, 'updateRaisedBed', args);
        },
        upsertRaisedBedField: async (...args: unknown[]) => {
            record(calls, 'upsertRaisedBedField', args);
        },
        withStripePaymentProcessingLock: async (
            id: string,
            callback: () => Promise<unknown>,
        ) => {
            record(calls, 'withStripePaymentProcessingLock', [id]);
            return callback();
        },
        getStripeCheckoutSession: async (...args: unknown[]) => {
            record(calls, 'getStripeCheckoutSession', args);
            return undefined;
        },
        getCartInfo: async (...args: unknown[]) => {
            record(calls, 'getCartInfo', args);
            return {
                allowPurchase: true,
                notes: [],
                items: [],
            };
        },
        calculateSunflowerAmount: (...args: unknown[]) => {
            record(calls, 'calculateSunflowerAmount', args);
            return 5000;
        },
        notifyDeliveryScheduled: async (...args: unknown[]) => {
            record(calls, 'notifyDeliveryScheduled', args);
        },
        notifyScheduledDeliveryEmailOnce: async (...args: unknown[]) => {
            record(calls, 'notifyScheduledDeliveryEmailOnce', args);
        },
        getPostHogClient: async (...args: unknown[]) => {
            record(calls, 'getPostHogClient', args);
            return {
                capture: (...captureArgs: unknown[]) => {
                    record(calls, 'posthog.capture', captureArgs);
                },
            };
        },
        ...overrides,
    };

    return dependencies as unknown as ProcessCheckoutSessionDependencies;
}

function makeSession() {
    return {
        id: 'cs_paid',
        status: 'complete',
        paymentStatus: 'paid',
        amountTotal: 2500,
        lineItems: {
            data: [
                {
                    id: 'li_1',
                    quantity: 1,
                    amount_total: 2500,
                    amount_subtotal: 2500,
                    price: {
                        product: {
                            id: 'prod_1',
                            name: 'Planting',
                            metadata: {
                                accountId: 'account-1',
                                cartId: '100',
                                cartItemId: '1',
                                entityId: '42',
                                entityTypeName: 'operation',
                                gardenId: '200',
                                raisedBedId: '300',
                                positionIndex: '2',
                                additionalData: JSON.stringify({
                                    scheduledDate: '2026-07-01',
                                }),
                            },
                        },
                    },
                },
            ],
        },
    };
}

function makeCart() {
    return {
        id: 100,
        accountId: 'account-1',
        items: [
            {
                id: 1,
                status: 'open',
                entityId: '42',
                entityTypeName: 'operation',
                raisedBedId: 300,
            },
        ],
    };
}

function makeSunflowerCartItem() {
    return {
        id: 2,
        status: 'open',
        currency: 'sunflower',
        entityId: '99',
        entityTypeName: 'operation',
        cartId: 100,
        gardenId: 200,
        raisedBedId: 300,
        positionIndex: 3,
        amount: 1,
        additionalData: null,
        usesInventory: false,
        shopData: {
            price: 5,
            discountPrice: null,
        },
    };
}

describe('processCheckoutSession', () => {
    it('skips an already completed transaction without processing items again', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getCompletedTransactionByStripePaymentId: async (
                ...args: unknown[]
            ) => {
                record(calls, 'getCompletedTransactionByStripePaymentId', args);
                return { id: 123 };
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(callNames(calls), [
            'getStripeCheckoutSession',
            'withStripePaymentProcessingLock',
            'getCompletedTransactionByStripePaymentId',
        ]);
        assert.equal(callsNamed(calls, 'createTransaction').length, 0);
        assert.equal(callsNamed(calls, 'setCartItemPaid').length, 0);
    });

    it('marks a Stripe-paid cart item paid, records the transaction, and awards sunflowers', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(
            callNames(calls).filter((name) =>
                [
                    'setCartItemPaid',
                    'createOperation',
                    'earnSunflowersForPayment',
                    'markCartPaidIfAllItemsPaid',
                    'createTransaction',
                ].includes(name),
            ),
            [
                'setCartItemPaid',
                'createOperation',
                'earnSunflowersForPayment',
                'markCartPaidIfAllItemsPaid',
                'createTransaction',
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid')[0]?.args,
            [1],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            ['account-1', 25],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'markCartPaidIfAllItemsPaid')[0]?.args,
            [100],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'createTransaction')[0]?.args,
            [
                {
                    accountId: 'account-1',
                    amount: 2500,
                    stripePaymentId: 'cs_paid',
                    status: 'completed',
                    currency: 'eur',
                },
            ],
        );
    });

    it('continues when sunflower spending fails for non-Stripe cart items but leaves them unpaid', async () => {
        const calls: RecordedCall[] = [];
        const sunflowerItem = makeSunflowerCartItem();
        const dependencies = makeDependencies(calls, {
            getStripeCheckoutSession: async (...args: unknown[]) => {
                record(calls, 'getStripeCheckoutSession', args);
                return makeSession();
            },
            getShoppingCart: async (...args: unknown[]) => {
                record(calls, 'getShoppingCart', args);
                return makeCart();
            },
            getRaisedBedFieldsWithEvents: async (...args: unknown[]) => {
                record(calls, 'getRaisedBedFieldsWithEvents', args);
                return [{ id: 88, positionIndex: 2, active: true }];
            },
            normalizeShoppingCartInventoryUsage: async (...args: unknown[]) => {
                record(calls, 'normalizeShoppingCartInventoryUsage', args);
                return {
                    id: 100,
                    items: [sunflowerItem],
                };
            },
            getCartInfo: async (...args: unknown[]) => {
                record(calls, 'getCartInfo', args);
                return {
                    allowPurchase: true,
                    notes: [],
                    items: [sunflowerItem],
                };
            },
            spendSunflowers: async (...args: unknown[]) => {
                record(calls, 'spendSunflowers', args);
                throw new Error('insufficient sunflowers');
            },
        });

        await processCheckoutSession('cs_paid', dependencies);

        assert.deepStrictEqual(callsNamed(calls, 'spendSunflowers')[0]?.args, [
            'account-1',
            5000,
            'shoppingCart:100',
        ]);
        // Characterization: see plan 006 — this silent-swallow behavior is slated to change.
        assert.deepStrictEqual(
            callsNamed(calls, 'setCartItemPaid').map((call) => call.args[0]),
            [1],
        );
        assert.equal(callsNamed(calls, 'createTransaction').length, 1);
    });
});

describe('processItem', () => {
    it('skips processing for an abandoned raised bed', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            getRaisedBed: async (...args: unknown[]) => {
                record(calls, 'getRaisedBed', args);
                return { status: 'abandoned' };
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: null,
                cartId: 100,
                cartItemId: 1,
                currency: 'eur',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: 2,
                raisedBedId: 300,
            },
            dependencies,
        );

        assert.deepStrictEqual(callNames(calls), [
            'getRaisedBed',
            'isRaisedBedAbandoned',
        ]);
        assert.equal(callsNamed(calls, 'createOperation').length, 0);
    });

    it('continues operation processing when earning sunflowers fails', async () => {
        const calls: RecordedCall[] = [];
        const dependencies = makeDependencies(calls, {
            earnSunflowersForPayment: async (...args: unknown[]) => {
                record(calls, 'earnSunflowersForPayment', args);
                throw new Error('sunflower ledger unavailable');
            },
        });

        await processItem(
            {
                accountId: 'account-1',
                amount_total: 2500,
                additionalData: {
                    scheduledDate: '2026-07-01',
                },
                cartId: 100,
                cartItemId: 1,
                currency: 'eur',
                entityId: '42',
                entityTypeName: 'operation',
                gardenId: 200,
                positionIndex: null,
                raisedBedId: null,
            },
            dependencies,
        );

        assert.deepStrictEqual(
            callNames(calls).filter((name) =>
                [
                    'createOperation',
                    'earnSunflowersForPayment',
                    'createEvent',
                    'notifyOperationUpdate',
                    'isCartItemDeliverable',
                ].includes(name),
            ),
            [
                'createOperation',
                'earnSunflowersForPayment',
                'createEvent',
                'notifyOperationUpdate',
                'isCartItemDeliverable',
            ],
        );
        assert.deepStrictEqual(
            callsNamed(calls, 'earnSunflowersForPayment')[0]?.args,
            ['account-1', 25],
        );
    });
});

describe('processCheckoutSession test utilities', () => {
    it('parses additional data values consistently', () => {
        const objectValue = { scheduledDate: '2026-07-01' };

        assert.deepStrictEqual(
            __testUtils.parseAdditionalDataValue(
                '{"scheduledDate":"2026-07-01"}',
            ),
            objectValue,
        );
        assert.equal(__testUtils.parseAdditionalDataValue('{'), null);
        assert.equal(
            __testUtils.parseAdditionalDataValue(objectValue),
            objectValue,
        );
        assert.equal(
            __testUtils.parseAdditionalDataValue(undefined),
            undefined,
        );
    });
});
