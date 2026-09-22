import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import { applyDefaultNewCartItemCurrency } from './defaultCartItemCurrency';

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

test('applies sunflower payment to a new affordable AI or manual cart item', async () => {
    const currencyUpdates: Array<{ currency: string; id: number }> = [];

    const result = await applyDefaultNewCartItemCurrency({
        accountId: 'account-1',
        cartItemId: 2,
        existingCartItemIds: [1],
        mutation,
        dependencies: {
            getAvailableSunflowers: async () => 4_500,
            getCartItems: async () => [
                cartItem({ currency: 'sunflower', id: 1, price: 2.5 }),
                cartItem({ id: 2, price: 2 }),
            ],
            setCartItemCurrency: async (id, _mutation, currency) => {
                currencyUpdates.push({ currency, id });
            },
        },
    });

    assert.equal(result, 'sunflower');
    assert.deepEqual(currencyUpdates, [{ currency: 'sunflower', id: 2 }]);
});

test('keeps a new item in euros when the cart commitments exceed the balance', async () => {
    let currencyUpdates = 0;

    const result = await applyDefaultNewCartItemCurrency({
        accountId: 'account-1',
        cartItemId: 2,
        existingCartItemIds: [1],
        mutation,
        dependencies: {
            getAvailableSunflowers: async () => 4_000,
            getCartItems: async () => [
                cartItem({ currency: 'sunflower', id: 1, price: 2.5 }),
                cartItem({ id: 2, price: 2 }),
            ],
            setCartItemCurrency: async () => {
                currencyUpdates += 1;
            },
        },
    });

    assert.equal(result, 'eur');
    assert.equal(currencyUpdates, 0);
});

test('preserves the selected currency when the mutation updates an existing item', async () => {
    let dependencyCalls = 0;

    const result = await applyDefaultNewCartItemCurrency({
        accountId: 'account-1',
        cartItemId: 2,
        existingCartItemIds: [1, 2],
        mutation,
        dependencies: {
            getAvailableSunflowers: async () => {
                dependencyCalls += 1;
                return 10_000;
            },
            getCartItems: async () => {
                dependencyCalls += 1;
                return [];
            },
            setCartItemCurrency: async () => {
                dependencyCalls += 1;
            },
        },
    });

    assert.equal(result, undefined);
    assert.equal(dependencyCalls, 0);
});
