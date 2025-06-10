import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import {
    getOrCreateShoppingCart,
    upsertOrRemoveCartItem,
    deleteShoppingCart,
    getAllShoppingCarts,
    getShoppingCart
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';

test('getOrCreateShoppingCart creates and retrieves cart', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    assert.ok(cart.id);
    const cart2 = await getOrCreateShoppingCart(accountId);
    assert.ok(cart2);
    assert.strictEqual(cart.id, cart2.id);
});

test('upsertOrRemoveCartItem adds and removes item', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    await upsertOrRemoveCartItem(cart.id, 'entity-1', 'plant', 2);
    let foundCart = await getShoppingCart(cart.id);
    assert.ok(foundCart && Array.isArray(foundCart.items) && foundCart.items.length > 0 && foundCart.items.some(i => i.entityId === 'entity-1'));
    await upsertOrRemoveCartItem(cart.id, 'entity-1', 'plant', 0);
    foundCart = await getShoppingCart(cart.id);
    assert.ok(foundCart == null || !foundCart.items.some(i => i.entityId === 'entity-1'));
});

test('upsertOrRemoveCartItem gardenId, raisedBedId and positionIndex work', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    await upsertOrRemoveCartItem(cart.id, 'entity-1', 'plant', 2, 1, 1, 0);
    let foundCart = await getShoppingCart(cart.id);
    assert.ok(foundCart && Array.isArray(foundCart.items) && foundCart.items.length > 0 && foundCart.items.some(i => i.entityId === 'entity-1' && i.gardenId === 1 && i.raisedBedId === 1 && i.positionIndex === 0));
    await upsertOrRemoveCartItem(cart.id, 'entity-1', 'plant', 0);
    foundCart = await getShoppingCart(cart.id);
    assert.ok(foundCart == null || !foundCart.items.some(i => i.entityId === 'entity-1'));
});

test('deleteShoppingCart removes cart', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    await deleteShoppingCart(accountId);
    const allCarts = await getAllShoppingCarts();
    assert.ok(!allCarts.some(c => c.id === cart.id));
});
