import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import { withDirectSunflowerCheckoutPayment } from './directSunflowerCheckout';

function sunflowerItem({
    discountPrice,
    id,
    price,
    status,
}: {
    discountPrice?: number;
    id: number;
    price: number;
    status: string;
}): ShoppingCartItemWithShopData {
    return {
        additionalData: null,
        amount: 1,
        cartId: 100,
        createdAt: new Date(`2026-07-01T10:0${id.toString()}:00.000Z`),
        currency: 'sunflower',
        entityData: { id },
        entityId: id.toString(),
        entityTypeName: 'plantSort',
        gardenId: 200,
        id,
        inventoryAvailable: 0,
        isDeleted: false,
        outlet: undefined,
        positionIndex: id,
        raisedBedId: 300,
        shopData: { discountPrice, price },
        status,
        updatedAt: new Date('2026-07-01T10:10:00.000Z'),
        usesInventory: false,
    };
}

test('direct sunflower checkout verifies full legacy coverage and returns the durable amount', async () => {
    const paidItem = sunflowerItem({
        discountPrice: 0,
        id: 2,
        price: 5,
        status: 'paid',
    });
    const pendingItem = sunflowerItem({
        discountPrice: 7,
        id: 3,
        price: 7,
        status: 'new',
    });
    const calls: Array<{ args: unknown[]; name: string }> = [];

    const result = await withDirectSunflowerCheckoutPayment({
        accountId: 'account-1',
        allSunflowerItems: [paidItem, pendingItem],
        cartId: 100,
        item: pendingItem,
        dependencies: {
            calculateSunflowerAmount: (item) => {
                calls.push({ args: [item.shopData], name: 'calculate' });
                return 7_000;
            },
            calculateSunflowerReplayAmount: (item) => {
                calls.push({ args: [item.status], name: 'calculateReplay' });
                return 5_000;
            },
            lockShoppingCartForCheckout: async (...args) => {
                calls.push({ args: args.slice(0, 1), name: 'lockCart' });
                return {
                    accountId: 'account-1',
                    id: 100,
                    isDeleted: false,
                    items: [paidItem, pendingItem],
                    status: 'new',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
            },
            spendSunflowersBatch: async (...args) => {
                calls.push({ args, name: 'spend' });
                return {
                    createdReasons: [],
                    existingReasons: ['shoppingCartItem:3'],
                    resolvedAmountsByReason: {
                        'shoppingCartItem:3': 6_000,
                    },
                };
            },
            withCheckoutCartItemLocks: async (ids, operation) => {
                calls.push({ args: [ids], name: 'databaseLocksStarted' });
                const value = await operation({
                    transaction: 'checkout-test',
                } as never);
                calls.push({ args: [ids], name: 'databaseLocksFinished' });
                return value;
            },
            withCheckoutCartItemProcessingLocks: async (ids, operation) => {
                calls.push({ args: [ids], name: 'processingLocksStarted' });
                const value = await operation();
                calls.push({ args: [ids], name: 'processingLocksFinished' });
                return value;
            },
        },
        operation: async (payment) => {
            calls.push({ args: [payment], name: 'fulfillment' });
            return payment;
        },
    });

    assert.deepStrictEqual(result, {
        resolvedAmount: 6_000,
        state: 'pending',
    });
    assert.deepStrictEqual(
        calls.find((call) => call.name === 'processingLocksStarted')?.args,
        [[2, 3]],
    );
    assert.deepStrictEqual(
        calls.find((call) => call.name === 'databaseLocksStarted')?.args,
        [[2, 3]],
    );
    assert.ok(
        calls.findIndex((call) => call.name === 'databaseLocksFinished') <
            calls.findIndex((call) => call.name === 'fulfillment'),
    );
    assert.ok(
        calls.findIndex((call) => call.name === 'fulfillment') <
            calls.findIndex((call) => call.name === 'processingLocksFinished'),
    );
    const spendCall = calls.find((call) => call.name === 'spend');
    assert.deepStrictEqual(spendCall?.args.slice(0, 2), [
        'account-1',
        [{ amount: 7_000, reason: 'shoppingCartItem:3' }],
    ]);
    assert.deepStrictEqual(spendCall?.args[3], {
        existingCheckoutItemAmountsAreAuthoritative: true,
        legacyCartSpend: {
            reason: 'shoppingCart:100',
            coveredItems: [
                {
                    amount: 5_000,
                    cartItemId: 2,
                    createdAt: paidItem.createdAt,
                    reason: 'shoppingCartItem:2',
                },
                {
                    amount: 7_000,
                    cartItemId: 3,
                    createdAt: pendingItem.createdAt,
                    reason: 'shoppingCartItem:3',
                },
            ],
        },
    });
});
