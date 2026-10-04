import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getOrCreateShoppingCart,
    getShoppingCart,
    markCartPaidIfAllItemsPaid,
    setCartItemPaid,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createCartWithItems() {
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart, 'Cart should be created');

    const firstItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'payment-entity-1',
        'plant',
        1,
    );
    const secondItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'payment-entity-2',
        'plant',
        1,
    );
    assert.ok(firstItemId, 'First item ID should be defined');
    assert.ok(secondItemId, 'Second item ID should be defined');

    return { cartId: cart.id, firstItemId, secondItemId };
}

test('setCartItemPaid marks one cart item paid', async () => {
    createTestDb();
    const { cartId, firstItemId, secondItemId } = await createCartWithItems();

    await setCartItemPaid(firstItemId);

    const cart = await getShoppingCart(cartId);
    assert.ok(cart, 'Cart should be found');
    const firstItem = cart.items.find((item) => item.id === firstItemId);
    const secondItem = cart.items.find((item) => item.id === secondItemId);
    assert.strictEqual(firstItem?.status, 'paid');
    assert.strictEqual(secondItem?.status, 'new');
});

test('markCartPaidIfAllItemsPaid marks cart paid only after every item is paid', async () => {
    createTestDb();
    const { cartId, firstItemId, secondItemId } = await createCartWithItems();

    await setCartItemPaid(firstItemId);
    await markCartPaidIfAllItemsPaid(cartId);

    let cart = await getShoppingCart(cartId);
    assert.ok(cart, 'Cart should be found after marking one item paid');
    assert.strictEqual(cart.status, 'new');

    await setCartItemPaid(secondItemId);
    await markCartPaidIfAllItemsPaid(cartId);

    cart = await getShoppingCart(cartId);
    assert.ok(cart, 'Cart should be found after marking all items paid');
    assert.strictEqual(cart.status, 'paid');
    assert.ok(cart.items.every((item) => item.status === 'paid'));
});

test('setCartItemPaid is a safe no-op for already-paid cart items', async () => {
    createTestDb();
    const { cartId, firstItemId } = await createCartWithItems();

    await setCartItemPaid(firstItemId);
    await setCartItemPaid(firstItemId);

    const cart = await getShoppingCart(cartId);
    assert.ok(cart, 'Cart should be found');
    const item = cart.items.find((cartItem) => cartItem.id === firstItemId);
    assert.strictEqual(item?.status, 'paid');
});
