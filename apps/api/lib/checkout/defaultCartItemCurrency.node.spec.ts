import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import {
    applyDefaultNewCartItemCurrency,
    upsertCartItemWithDefaultCurrency,
} from './defaultCartItemCurrency';

function cartItem({
    currency = 'eur',
    id,
    price,
}: {
    currency?: string;
    id: number;
    price: number;
}): ShoppingCartItemWithShopData {
    return {
        additionalData: null,
        amount: 1,
        cartId: 10,
        createdAt: new Date('2026-09-23T10:00:00.000Z'),
        currency,
        entityData: { id },
        entityId: id.toString(),
        entityTypeName: 'operation',
        gardenId: 20,
        id,
        inventoryAvailable: 0,
        isDeleted: false,
        positionIndex: null,
        raisedBedId: 30,
        shopData: { price },
        status: 'new',
        updatedAt: new Date('2026-09-23T10:00:00.000Z'),
        usesInventory: false,
    };
}

const mutation = {
    amount: 1,
    cartId: 10,
    entityId: '2',
    entityTypeName: 'operation',
    gardenId: 20,
    raisedBedId: 30,
};

type Dependencies = NonNullable<
    Parameters<typeof applyDefaultNewCartItemCurrency>[0]['dependencies']
>;

function createDependencies({
    availableSunflowers,
    cartItemIds = [1],
    items,
    onCall,
    setCartItemCurrency,
    upsertCartItem,
}: {
    availableSunflowers: number;
    cartItemIds?: readonly number[] | null;
    items: readonly ShoppingCartItemWithShopData[];
    onCall?: (name: string) => void;
    setCartItemCurrency?: () => Promise<void>;
    upsertCartItem?: () => Promise<number | null>;
}): Dependencies {
    return {
        withLockedCart: async (_accountId, _cartId, operation) => {
            onCall?.('lock');
            return operation({
                getAvailableSunflowers: async () => {
                    onCall?.('balance');
                    return availableSunflowers;
                },
                getCartItemIds: async () => {
                    onCall?.('ids');
                    return cartItemIds;
                },
                getCartItems: async () => {
                    onCall?.('items');
                    return items;
                },
                setCartItemCurrency: async () => {
                    onCall?.('currency');
                    await setCartItemCurrency?.();
                },
                upsertCartItem: async () => {
                    onCall?.('upsert');
                    return (await upsertCartItem?.()) ?? 2;
                },
            });
        },
    };
}

test('applies sunflower payment to a new affordable AI or manual cart item', async () => {
    const calls: string[] = [];

    const result = await applyDefaultNewCartItemCurrency({
        accountId: 'account-1',
        cartItemId: 2,
        existingCartItemIds: [1],
        mutation,
        dependencies: createDependencies({
            availableSunflowers: 4_500,
            items: [
                cartItem({ currency: 'sunflower', id: 1, price: 2.5 }),
                cartItem({ id: 2, price: 2 }),
            ],
            onCall: (name) => calls.push(name),
        }),
    });

    assert.equal(result, 'sunflower');
    assert.deepEqual(calls, ['lock', 'items', 'balance', 'currency']);
});

test('keeps a new item in euros when the cart commitments exceed the balance', async () => {
    const calls: string[] = [];

    const result = await applyDefaultNewCartItemCurrency({
        accountId: 'account-1',
        cartItemId: 2,
        existingCartItemIds: [1],
        mutation,
        dependencies: createDependencies({
            availableSunflowers: 4_000,
            items: [
                cartItem({ currency: 'sunflower', id: 1, price: 2.5 }),
                cartItem({ id: 2, price: 2 }),
            ],
            onCall: (name) => calls.push(name),
        }),
    });

    assert.equal(result, 'eur');
    assert.deepEqual(calls, ['lock', 'items', 'balance']);
});

test('preserves the selected currency when the mutation updates an existing item', async () => {
    let dependencyCalls = 0;

    const result = await applyDefaultNewCartItemCurrency({
        accountId: 'account-1',
        cartItemId: 2,
        existingCartItemIds: [1, 2],
        mutation,
        dependencies: createDependencies({
            availableSunflowers: 10_000,
            items: [],
            onCall: () => {
                dependencyCalls += 1;
            },
        }),
    });

    assert.equal(result, undefined);
    assert.equal(dependencyCalls, 0);
});

test('upserts an AI cart item and applies its currency within one locked transaction', async () => {
    const calls: string[] = [];

    const result = await upsertCartItemWithDefaultCurrency({
        accountId: 'account-1',
        mutation,
        dependencies: createDependencies({
            availableSunflowers: 2_000,
            items: [cartItem({ id: 2, price: 2 })],
            onCall: (name) => calls.push(name),
        }),
    });

    assert.deepEqual(result, {
        appliedCurrency: 'sunflower',
        cartItemId: 2,
    });
    assert.deepEqual(calls, [
        'lock',
        'ids',
        'upsert',
        'items',
        'balance',
        'currency',
    ]);
});

test('keeps a failed AI currency write inside the atomic mutation boundary', async () => {
    const calls: string[] = [];

    await assert.rejects(
        upsertCartItemWithDefaultCurrency({
            accountId: 'account-1',
            mutation,
            dependencies: createDependencies({
                availableSunflowers: 2_000,
                items: [cartItem({ id: 2, price: 2 })],
                onCall: (name) => calls.push(name),
                setCartItemCurrency: async () => {
                    throw new Error('currency write failed');
                },
            }),
        }),
        /currency write failed/,
    );

    assert.deepEqual(calls, [
        'lock',
        'ids',
        'upsert',
        'items',
        'balance',
        'currency',
    ]);
});
