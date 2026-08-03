import assert from 'node:assert/strict';
import test from 'node:test';
import { withCheckoutCartItemProcessingLocks } from '@gredice/storage';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import { withDirectSunflowerCheckoutBatch } from './directSunflowerCheckout';

function cartItem({
    currency = 'sunflower',
    discountPrice,
    id,
    price,
    status = 'new',
}: {
    currency?: string;
    discountPrice?: number;
    id: number;
    price: number;
    status?: string;
}): ShoppingCartItemWithShopData {
    return {
        additionalData: null,
        amount: 1,
        cartId: 100,
        createdAt: new Date(`2026-07-01T10:0${id.toString()}:00.000Z`),
        currency,
        entityData: { id },
        entityId: id.toString(),
        entityTypeName: 'plantSort',
        gardenId: 200,
        id,
        inventoryAvailable: currency === 'inventory' ? 1 : 0,
        isDeleted: false,
        outlet: undefined,
        positionIndex: id,
        raisedBedId: 300,
        shopData: { discountPrice, price },
        status,
        updatedAt: new Date('2026-07-01T10:10:00.000Z'),
        usesInventory: currency === 'inventory',
    };
}

function deferred<T>() {
    let resolve = (_value: T | PromiseLike<T>) => {};
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}

test('direct checkout debits every pending sunflower in one short transaction', async () => {
    const first = cartItem({ id: 1, price: 2 });
    const second = cartItem({ id: 2, price: 3 });
    const inventory = cartItem({ currency: 'inventory', id: 3, price: 4 });
    const allItems = [first, second, inventory];
    const calls: Array<{ args: unknown[]; name: string }> = [];

    const result = await withDirectSunflowerCheckoutBatch({
        accountId: 'account-1',
        allCheckoutItems: allItems,
        cartId: 100,
        dependencies: {
            calculateSunflowerAmount: (item) =>
                Math.round((item.shopData.price ?? 0) * 1000),
            calculateSunflowerReplayAmount: () => 9_999,
            getShoppingCart: async () => undefined,
            lockShoppingCartForCheckout: async () => ({
                accountId: 'account-1',
                id: 100,
                isDeleted: false,
                items: allItems,
                status: 'new',
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
            spendSunflowersBatch: async (...args) => {
                calls.push({ args, name: 'spend' });
                return {
                    createdReasons: [
                        'shoppingCartItem:1',
                        'shoppingCartItem:2',
                    ],
                    existingReasons: [],
                    resolvedAmountsByReason: {
                        'shoppingCartItem:1': 2_000,
                        'shoppingCartItem:2': 3_000,
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
            assert.deepStrictEqual(
                payment.pendingItems.map((item) => item.id),
                [1, 2],
            );
            return 'fulfilled';
        },
    });

    assert.deepStrictEqual(result, {
        state: 'processed',
        value: 'fulfilled',
    });
    assert.deepStrictEqual(
        calls.find((call) => call.name === 'processingLocksStarted')?.args,
        [[1, 2, 3]],
    );
    assert.deepStrictEqual(
        calls.find((call) => call.name === 'databaseLocksStarted')?.args,
        [[1, 2, 3]],
    );
    assert.equal(calls.filter((call) => call.name === 'spend').length, 1);
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
        [
            { amount: 2_000, reason: 'shoppingCartItem:1' },
            { amount: 3_000, reason: 'shoppingCartItem:2' },
        ],
    ]);
    assert.deepStrictEqual(spendCall?.args[3], {
        existingCheckoutItemAmountsAreAuthoritative: true,
        legacyCartSpend: {
            reason: 'shoppingCart:100',
            coveredItems: [
                {
                    amount: 2_000,
                    cartItemId: 1,
                    createdAt: first.createdAt,
                    paymentState: 'pending',
                    reason: 'shoppingCartItem:1',
                },
                {
                    amount: 3_000,
                    cartItemId: 2,
                    createdAt: second.createdAt,
                    paymentState: 'pending',
                    reason: 'shoppingCartItem:2',
                },
            ],
        },
    });
});

test('direct checkout returns durable paid and pending amounts across catalog drift', async () => {
    const paid = cartItem({
        discountPrice: 0,
        id: 1,
        price: 5,
        status: 'paid',
    });
    const pending = cartItem({ discountPrice: 7, id: 2, price: 7 });
    let capturedPayment:
        | {
              pendingItems: readonly ShoppingCartItemWithShopData[];
              resolvedAmountsByCartItemId: ReadonlyMap<number, number>;
          }
        | undefined;
    let requestedDebits: unknown;

    await withDirectSunflowerCheckoutBatch({
        accountId: 'account-1',
        allCheckoutItems: [paid, pending],
        cartId: 100,
        dependencies: {
            calculateSunflowerAmount: () => 7_000,
            calculateSunflowerReplayAmount: () => 5_000,
            getShoppingCart: async () => undefined,
            lockShoppingCartForCheckout: async () => ({
                accountId: 'account-1',
                id: 100,
                isDeleted: false,
                items: [paid, pending],
                status: 'new',
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
            spendSunflowersBatch: async (_accountId, items) => {
                requestedDebits = items;
                return {
                    createdReasons: ['shoppingCartItem:2'],
                    existingReasons: ['shoppingCartItem:1'],
                    resolvedAmountsByReason: {
                        'shoppingCartItem:1': 4_500,
                        'shoppingCartItem:2': 6_000,
                    },
                };
            },
            withCheckoutCartItemLocks: async (_ids, operation) =>
                operation({ transaction: 'checkout-test' } as never),
            withCheckoutCartItemProcessingLocks: async (_ids, operation) =>
                operation(),
        },
        operation: async (payment) => {
            capturedPayment = payment;
        },
    });

    assert.deepStrictEqual(requestedDebits, [
        { amount: 7_000, reason: 'shoppingCartItem:2' },
    ]);
    assert.deepStrictEqual(
        capturedPayment?.pendingItems.map((item) => item.id),
        [2],
    );
    assert.deepStrictEqual(
        capturedPayment?.resolvedAmountsByCartItemId,
        new Map([
            [1, 4_500],
            [2, 6_000],
        ]),
    );
});

test('batch debit failure starts no fulfillment work', async () => {
    const item = cartItem({ id: 1, price: 2 });
    const failure = new Error('account unavailable');
    let operationCalled = false;

    await assert.rejects(
        withDirectSunflowerCheckoutBatch({
            accountId: 'account-1',
            allCheckoutItems: [item],
            cartId: 100,
            dependencies: {
                calculateSunflowerAmount: () => 2_000,
                calculateSunflowerReplayAmount: () => 2_000,
                getShoppingCart: async () => undefined,
                lockShoppingCartForCheckout: async () => ({
                    accountId: 'account-1',
                    id: 100,
                    isDeleted: false,
                    items: [item],
                    status: 'new',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                spendSunflowersBatch: async () => {
                    throw failure;
                },
                withCheckoutCartItemLocks: async (_ids, operation) =>
                    operation({ transaction: 'checkout-test' } as never),
                withCheckoutCartItemProcessingLocks: async (_ids, operation) =>
                    operation(),
            },
            operation: async () => {
                operationCalled = true;
            },
        }),
        failure,
    );
    assert.equal(operationCalled, false);
});

test('missing durable amount evidence fails before fulfillment', async () => {
    const first = cartItem({ id: 1, price: 2 });
    const second = cartItem({ id: 2, price: 3 });
    let operationCalled = false;

    await assert.rejects(
        withDirectSunflowerCheckoutBatch({
            accountId: 'account-1',
            allCheckoutItems: [first, second],
            cartId: 100,
            dependencies: {
                calculateSunflowerAmount: (item) =>
                    Math.round((item.shopData.price ?? 0) * 1000),
                calculateSunflowerReplayAmount: () => 1,
                getShoppingCart: async () => undefined,
                lockShoppingCartForCheckout: async () => ({
                    accountId: 'account-1',
                    id: 100,
                    isDeleted: false,
                    items: [first, second],
                    status: 'new',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                spendSunflowersBatch: async () => ({
                    createdReasons: ['shoppingCartItem:1'],
                    existingReasons: [],
                    resolvedAmountsByReason: {
                        'shoppingCartItem:1': 2_000,
                    },
                }),
                withCheckoutCartItemLocks: async (_ids, operation) =>
                    operation({ transaction: 'checkout-test' } as never),
                withCheckoutCartItemProcessingLocks: async (_ids, operation) =>
                    operation(),
            },
            operation: async () => {
                operationCalled = true;
            },
        }),
        /cart item 2 did not resolve a valid amount/u,
    );
    assert.equal(operationCalled, false);
});

test('a duplicate direct checkout waits for the first and observes its paid cart', async () => {
    const item = cartItem({ id: 1, price: 2 });
    const firstFulfillmentStarted = deferred<void>();
    const releaseFirstFulfillment = deferred<void>();
    let cartPaid = false;
    let lockCartCalls = 0;
    let operationCalls = 0;
    let spendCalls = 0;

    const dependencies = {
        calculateSunflowerAmount: () => 2_000,
        calculateSunflowerReplayAmount: () => 2_000,
        getShoppingCart: async () => ({
            accountId: 'account-1',
            id: 100,
            isDeleted: false,
            items: [{ ...item, status: 'paid' }],
            status: 'paid',
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        lockShoppingCartForCheckout: async () => {
            lockCartCalls += 1;
            return cartPaid
                ? undefined
                : {
                      accountId: 'account-1',
                      id: 100,
                      isDeleted: false,
                      items: [item],
                      status: 'new',
                      createdAt: new Date(),
                      updatedAt: new Date(),
                  };
        },
        spendSunflowersBatch: async () => {
            spendCalls += 1;
            return {
                createdReasons: ['shoppingCartItem:1'],
                existingReasons: [],
                resolvedAmountsByReason: {
                    'shoppingCartItem:1': 2_000,
                },
            };
        },
        withCheckoutCartItemLocks: async <T>(
            _ids: readonly number[],
            operation: (db: never) => Promise<T>,
        ) => operation({ transaction: 'checkout-test' } as never),
        withCheckoutCartItemProcessingLocks,
    };
    const operation = async () => {
        operationCalls += 1;
        firstFulfillmentStarted.resolve();
        await releaseFirstFulfillment.promise;
        cartPaid = true;
        return 'fulfilled';
    };

    const first = withDirectSunflowerCheckoutBatch({
        accountId: 'account-1',
        allCheckoutItems: [item],
        cartId: 100,
        dependencies,
        operation,
    });
    await firstFulfillmentStarted.promise;
    const duplicate = withDirectSunflowerCheckoutBatch({
        accountId: 'account-1',
        allCheckoutItems: [item],
        cartId: 100,
        dependencies,
        operation,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(lockCartCalls, 1);
    assert.equal(spendCalls, 1);
    assert.equal(operationCalls, 1);

    releaseFirstFulfillment.resolve();
    assert.deepStrictEqual(await first, {
        state: 'processed',
        value: 'fulfilled',
    });
    assert.equal((await duplicate).state, 'cart_paid');
    assert.equal(lockCartCalls, 2);
    assert.equal(spendCalls, 1);
    assert.equal(operationCalls, 1);
});

test('a cart paid while waiting returns completed-elsewhere state without another debit', async () => {
    const item = cartItem({ id: 1, price: 2 });
    let spendCalled = false;
    let operationCalled = false;

    const result = await withDirectSunflowerCheckoutBatch({
        accountId: 'account-1',
        allCheckoutItems: [item],
        cartId: 100,
        dependencies: {
            calculateSunflowerAmount: () => 2_000,
            calculateSunflowerReplayAmount: () => 2_000,
            getShoppingCart: async () => ({
                accountId: 'account-1',
                id: 100,
                isDeleted: false,
                items: [{ ...item, status: 'paid' }],
                status: 'paid',
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
            lockShoppingCartForCheckout: async () => undefined,
            spendSunflowersBatch: async () => {
                spendCalled = true;
                return {
                    createdReasons: [],
                    existingReasons: [],
                    resolvedAmountsByReason: {},
                };
            },
            withCheckoutCartItemLocks: async (_ids, operation) =>
                operation({ transaction: 'checkout-test' } as never),
            withCheckoutCartItemProcessingLocks: async (_ids, operation) =>
                operation(),
        },
        operation: async () => {
            operationCalled = true;
        },
    });

    assert.equal(result.state, 'cart_paid');
    assert.equal(spendCalled, false);
    assert.equal(operationCalled, false);
});
