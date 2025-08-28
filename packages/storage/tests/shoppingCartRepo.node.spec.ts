import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deleteShoppingCart,
    getAllShoppingCarts,
    getOrCreateShoppingCart,
    getShoppingCart,
    markCartPaidIfAllItemsPaid,
    setCartItemPaid,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import {
    createTestAccount,
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('getOrCreateShoppingCart creates and retrieves cart', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    assert.ok(cart.id);
    assert.strictEqual(cart.accountId, accountId);
    assert.strictEqual(cart.status, 'new');

    const cart2 = await getOrCreateShoppingCart(accountId);
    assert.ok(cart2);
    assert.strictEqual(cart.id, cart2.id);
});

test('upsertOrRemoveCartItem adds and removes item', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);

    await upsertOrRemoveCartItem(null, cart.id, 'entity-1', 'plant', 2);
    let foundCart = await getShoppingCart(cart.id);
    assert.ok(
        foundCart &&
            Array.isArray(foundCart.items) &&
            foundCart.items.length > 0 &&
            foundCart.items.some((i) => i.entityId === 'entity-1'),
    );
    assert.ok(foundCart.items.every((i) => i.status === 'new'));

    await upsertOrRemoveCartItem(null, cart.id, 'entity-1', 'plant', 0);
    foundCart = await getShoppingCart(cart.id);
    assert.ok(
        foundCart == null ||
            !foundCart.items.some((i) => i.entityId === 'entity-1'),
    );
});

test('upsertOrRemoveCartItem creates separate item when entityId is different', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    const item1Id = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
    );
    const item2Id = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-2',
        'plant',
        1,
    );
    assert.ok(item1Id, 'Item 1 ID should be defined');
    assert.ok(item2Id, 'Item 2 ID should be defined');
    assert.notStrictEqual(item1Id, item2Id);
});

test('upsertOrRemoveCartItem gardenId, raisedBedId and positionIndex work', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'block-1');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);

    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        2,
        gardenId,
        raisedBedId,
        0,
    );
    let foundCart = await getShoppingCart(cart.id);
    assert.ok(
        foundCart &&
            Array.isArray(foundCart.items) &&
            foundCart.items.length > 0 &&
            foundCart.items.some(
                (i) =>
                    i.entityId === 'entity-1' &&
                    i.gardenId === gardenId &&
                    i.raisedBedId === raisedBedId &&
                    i.positionIndex === 0,
            ),
    );

    await upsertOrRemoveCartItem(null, cart.id, 'entity-1', 'plant', 0);
    foundCart = await getShoppingCart(cart.id);
    assert.ok(
        foundCart == null ||
            !foundCart.items.some((i) => i.entityId === 'entity-1'),
    );
});

test('deleteShoppingCart removes cart', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    await deleteShoppingCart(accountId);
    const allCarts = await getAllShoppingCarts();
    assert.ok(!allCarts.some((c) => c.id === cart.id));
});

test('getAllShoppingCarts filters by status', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    // Default status is 'new'
    let carts = await getAllShoppingCarts({ status: 'new' });
    assert.ok(carts.some((c) => c.id === cart.id));

    const item1Id = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
    );
    assert.ok(item1Id, 'Item 1 ID should be defined');

    // Simulate paid
    const foundCart = await getShoppingCart(cart.id);
    if (!foundCart) throw new Error('Cart not found');
    await setCartItemPaid(item1Id);
    await markCartPaidIfAllItemsPaid(cart.id);

    carts = await getAllShoppingCarts({ status: 'paid' });
    assert.ok(carts.some((c) => c.id === cart.id));

    carts = await getAllShoppingCarts({ status: 'new' });
    assert.ok(!carts.some((c) => c.id === cart.id));
});

test('markCartPaidIfAllItemsPaid only marks paid if all items are paid', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    const item1Id = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
    );
    const item2Id = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-2',
        'plant',
        1,
    );
    assert.ok(item1Id, 'Item 1 ID should be defined');
    assert.ok(item2Id, 'Item 2 ID should be defined');

    let foundCart = await getShoppingCart(cart.id);
    if (!foundCart) throw new Error('Cart not found');

    // Only mark one as paid
    await setCartItemPaid(item1Id);
    await markCartPaidIfAllItemsPaid(cart.id);

    foundCart = await getShoppingCart(cart.id);
    if (!foundCart) throw new Error('Cart not found after marking');
    console.debug(
        'Found cart after marking one item as paid:',
        JSON.stringify(foundCart),
    );
    assert.strictEqual(foundCart.status, 'new');

    // Mark all as paid
    await setCartItemPaid(item2Id);
    await markCartPaidIfAllItemsPaid(cart.id);

    foundCart = await getShoppingCart(cart.id);
    if (!foundCart) throw new Error('Cart not found after marking all paid');
    assert.strictEqual(foundCart.status, 'paid');
});

test('paid items are not included in new cart queries', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const item1Id = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
    );
    assert.ok(item1Id, 'Item 1 ID should be defined');

    const foundCart = await getShoppingCart(cart.id);
    if (!foundCart) throw new Error('Cart not found');
    await setCartItemPaid(item1Id);
    await markCartPaidIfAllItemsPaid(cart.id);

    // Should not be in new carts
    const carts = await getAllShoppingCarts({ status: 'new' });
    assert.ok(!carts.some((c) => c.id === cart.id));
});
