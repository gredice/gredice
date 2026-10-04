import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addInventoryItem,
    CheckoutCartItemFulfillmentStartedError,
    consumeInventoryItem,
    createEvent,
    createNotificationWithStatus,
    deleteShoppingCart,
    earnSunflowersForPayment,
    getAllShoppingCarts,
    getCheckoutFulfillmentStartedCartItemIds,
    getInventory,
    getOrCreateCheckoutOperation,
    getOrCreateShoppingCart,
    getShoppingCart,
    getSunflowers,
    hasMatchingCheckoutPlantingPurchase,
    knownEvents,
    markCartPaidIfAllItemsPaid,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    setCartItemPaid,
    spendSunflowersBatch,
    sql,
    storage,
    upsertOrRemoveCartItem,
    withCheckoutCartItemLock,
    withCheckoutCartItemProcessingLock,
    withInventoryAccountTransaction,
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

test('checkout processing lock is connection-free and separate from the database lock', async () => {
    createTestDb();
    const cartItemId = 900_001;
    let signalProcessingLockHeld = () => {};
    let signalReleaseProcessingLock = () => {};
    const processingLockHeld = new Promise<void>((resolve) => {
        signalProcessingLockHeld = resolve;
    });
    const releaseProcessingLock = new Promise<void>((resolve) => {
        signalReleaseProcessingLock = resolve;
    });
    const first = withCheckoutCartItemProcessingLock(cartItemId, async () => {
        signalProcessingLockHeld();
        await releaseProcessingLock;
    });
    await processingLockHeld;

    let secondProcessingLockEntered = false;
    const second = withCheckoutCartItemProcessingLock(cartItemId, async () => {
        secondProcessingLockEntered = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(secondProcessingLockEntered, false);

    let databaseLockEntered = false;
    await withCheckoutCartItemLock(cartItemId, async () => {
        databaseLockEntered = true;
    });
    assert.equal(databaseLockEntered, true);

    signalReleaseProcessingLock();
    await Promise.all([first, second]);
    assert.equal(secondProcessingLockEntered, true);
});

test('short checkout effect helpers reuse and roll back an existing transaction', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const rollback = new Error('roll back checkout effect test');

    await assert.rejects(
        storage().transaction(async (tx) => {
            assert.ok(await getShoppingCart(cart.id, tx));
            await withInventoryAccountTransaction(
                accountId,
                async (inventoryTx) => {
                    assert.equal(inventoryTx, tx);
                    await addInventoryItem(
                        accountId,
                        {
                            entityTypeName: 'plantSort',
                            entityId: 'rolled-back-inventory',
                            amount: 1,
                        },
                        inventoryTx,
                    );
                },
                tx,
            );
            await spendSunflowersBatch(
                accountId,
                [
                    {
                        amount: 100,
                        reason: 'shoppingCartItem:rolled-back-spend',
                    },
                ],
                tx,
            );
            throw rollback;
        }),
        (error) => error === rollback,
    );

    assert.equal(
        (await getInventory(accountId)).some(
            (item) => item.entityId === 'rolled-back-inventory',
        ),
        false,
    );
    assert.equal(await getSunflowers(accountId), 1000);
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

test('last-item removal waits for a concurrent insert and keeps the cart active', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const originalItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'original-cart-item',
        'plantSort',
        1,
    );
    assert.ok(originalItemId);

    let signalInserted = () => {};
    let signalCommitInsert = () => {};
    const inserted = new Promise<void>((resolve) => {
        signalInserted = resolve;
    });
    const commitInsert = new Promise<void>((resolve) => {
        signalCommitInsert = resolve;
    });
    const insertion = storage().transaction(async (tx) => {
        const insertedItemId = await upsertOrRemoveCartItem(
            null,
            cart.id,
            'concurrent-cart-item',
            'plantSort',
            1,
            undefined,
            undefined,
            undefined,
            null,
            'eur',
            true,
            false,
            tx,
        );
        signalInserted();
        await commitInsert;
        return insertedItemId;
    });
    await inserted;

    let removalSettled = false;
    const removal = upsertOrRemoveCartItem(
        originalItemId,
        cart.id,
        'original-cart-item',
        'plantSort',
        0,
    ).finally(() => {
        removalSettled = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(removalSettled, false);

    signalCommitInsert();
    const insertedItemId = await insertion;
    await removal;

    const persistedCart = await getShoppingCart(cart.id);
    assert.ok(persistedCart);
    assert.equal(persistedCart.status, 'new');
    assert.deepStrictEqual(
        persistedCart.items.map((item) => item.id),
        [insertedItemId],
    );
});

test('new item insert waits for cart soft delete and then rejects', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    let signalCartRowLocked = () => {};
    let signalReleaseCartRow = () => {};
    const cartRowLocked = new Promise<void>((resolve) => {
        signalCartRowLocked = resolve;
    });
    const releaseCartRow = new Promise<void>((resolve) => {
        signalReleaseCartRow = resolve;
    });
    const softDelete = storage().transaction(async (tx) => {
        await tx.execute(
            sql`select id from shopping_carts where id = ${cart.id} for update`,
        );
        signalCartRowLocked();
        await releaseCartRow;
        await tx.execute(
            sql`update shopping_carts set is_deleted = true where id = ${cart.id}`,
        );
    });
    await cartRowLocked;

    let insertSettled = false;
    const insert = upsertOrRemoveCartItem(
        null,
        cart.id,
        'late-cart-item',
        'plantSort',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'eur',
        true,
    );
    void insert.then(
        () => {
            insertSettled = true;
        },
        () => {
            insertSettled = true;
        },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const insertSettledWhileCartLocked = insertSettled;

    signalReleaseCartRow();
    await softDelete;
    assert.equal(insertSettledWhileCartLocked, false);
    await assert.rejects(insert, /inactive shopping cart/);
    assert.equal(await getShoppingCart(cart.id), undefined);
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

test('paid cart items cannot be updated through cart upsert', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
    );
    assert.ok(itemId, 'Item ID should be defined');

    await setCartItemPaid(itemId);

    await assert.rejects(
        () => upsertOrRemoveCartItem(itemId, cart.id, 'entity-1', 'plant', 2),
        /Cannot update paid shopping cart item via API/,
    );
    await assert.rejects(
        () => upsertOrRemoveCartItem(itemId, cart.id, 'entity-1', 'plant', 0),
        /Cannot update paid shopping cart item via API/,
    );
});

test('normalizeShoppingCartInventoryUsage moves duplicate inventory usage back to eur', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await addInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'entity-1',
        amount: 1,
    });

    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
        undefined,
        undefined,
        undefined,
        'slot-1',
        'inventory',
        true,
    );
    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
        undefined,
        undefined,
        undefined,
        'slot-2',
        'inventory',
        true,
    );

    const normalizedCart = await normalizeShoppingCartInventoryUsage(cart.id);
    assert.ok(normalizedCart);

    const inventoryItems = normalizedCart.items.filter(
        (item) => item.currency === 'inventory',
    );
    const eurItems = normalizedCart.items.filter(
        (item) => item.currency === 'eur',
    );

    assert.strictEqual(inventoryItems.length, 1);
    assert.strictEqual(eurItems.length, 1);
});

test('normalizeShoppingCartInventoryUsage splits partially covered inventory item', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await addInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'entity-1',
        amount: 1,
    });

    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        2,
        undefined,
        undefined,
        undefined,
        null,
        'inventory',
    );

    const normalizedCart = await normalizeShoppingCartInventoryUsage(cart.id);
    assert.ok(normalizedCart);

    const inventoryItems = normalizedCart.items.filter(
        (item) => item.currency === 'inventory',
    );
    const eurItems = normalizedCart.items.filter(
        (item) => item.currency === 'eur',
    );

    assert.deepStrictEqual(
        inventoryItems.map((item) => item.amount),
        [1],
    );
    assert.deepStrictEqual(
        eurItems.map((item) => item.amount),
        [1],
    );
});

test('normalizeShoppingCartInventoryUsage preserves a consumed pending checkout item for retry', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await addInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'entity-1',
        amount: 1,
    });

    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'inventory',
    );
    assert.ok(itemId);
    await consumeInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'entity-1',
        amount: 1,
        source: `shoppingCartItem:${itemId.toString()}`,
    });

    const normalizedCart = await normalizeShoppingCartInventoryUsage(cart.id);
    assert.ok(normalizedCart);
    const retriableItem = normalizedCart.items.find(
        (item) => item.id === itemId,
    );
    assert.strictEqual(retriableItem?.currency, 'inventory');
    assert.strictEqual(retriableItem?.amount, 1);
    assert.strictEqual(retriableItem?.status, 'new');
    assert.strictEqual(
        normalizedCart.items.some((item) => item.currency === 'eur'),
        false,
    );
});

test('legacy checkout planting evidence requires one exact EUR purchase fingerprint', async () => {
    createTestDb();
    const aggregateId = '700001|2';
    const cartItemId = 700_002;
    const plantingEvent = knownEvents.raisedBedFields.plantPlaceV1(
        aggregateId,
        {
            plantSortId: 'legacy-plant-sort',
            purchase: {
                cartItemId,
                currency: 'eur',
                euroAmountCents: 2500,
            },
            scheduledDate: null,
        },
    );
    await createEvent(plantingEvent);

    assert.equal(
        await hasMatchingCheckoutPlantingPurchase({
            cartItemId,
            euroAmountCents: 2500,
            plantSortId: 'legacy-plant-sort',
            positionIndex: 2,
            raisedBedId: 700_001,
        }),
        true,
    );
    await assert.rejects(
        hasMatchingCheckoutPlantingPurchase({
            cartItemId,
            euroAmountCents: 2500,
            plantSortId: 'legacy-plant-sort',
            positionIndex: 3,
            raisedBedId: 700_001,
        }),
        /conflicts with the paid cart item/u,
    );
    await assert.rejects(
        hasMatchingCheckoutPlantingPurchase({
            cartItemId,
            euroAmountCents: 2600,
            plantSortId: 'legacy-plant-sort',
            positionIndex: 2,
            raisedBedId: 700_001,
        }),
        /conflicts with the paid cart item/u,
    );

    await createEvent(plantingEvent);
    await assert.rejects(
        hasMatchingCheckoutPlantingPurchase({
            cartItemId,
            euroAmountCents: 2500,
            plantSortId: 'legacy-plant-sort',
            positionIndex: 2,
            raisedBedId: 700_001,
        }),
        /multiple planting fulfillment events/u,
    );
});

test('direct payment effects freeze pending cart item mutation and deletion', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    const sunflowerItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'sunflower-plant',
        'plantSort',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'sunflower',
    );
    assert.ok(sunflowerItemId);
    await spendSunflowersBatch(accountId, [
        {
            amount: 1,
            reason: `shoppingCartItem:${sunflowerItemId.toString()}`,
        },
    ]);
    await assert.rejects(
        upsertOrRemoveCartItem(
            sunflowerItemId,
            cart.id,
            'sunflower-plant',
            'plantSort',
            1,
            undefined,
            undefined,
            undefined,
            null,
            'eur',
        ),
        CheckoutCartItemFulfillmentStartedError,
    );

    const legacySunflowerItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'legacy-sunflower-plant',
        'plantSort',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'sunflower',
        true,
    );
    assert.ok(legacySunflowerItemId);
    await createEvent(
        knownEvents.accounts.sunflowersSpentV1(accountId, {
            amount: 1,
            reason: `shoppingCart:${cart.id.toString()}`,
        }),
    );
    const cartAfterLegacySpend = await getShoppingCart(cart.id);
    assert.ok(cartAfterLegacySpend);
    assert.equal(
        (
            await getCheckoutFulfillmentStartedCartItemIds(
                accountId,
                cartAfterLegacySpend.items,
            )
        ).has(legacySunflowerItemId),
        true,
    );
    await assert.rejects(
        upsertOrRemoveCartItem(
            legacySunflowerItemId,
            cart.id,
            'legacy-sunflower-plant',
            'plantSort',
            0,
            undefined,
            undefined,
            undefined,
            null,
            'sunflower',
        ),
        CheckoutCartItemFulfillmentStartedError,
    );

    await addInventoryItem(accountId, {
        entityTypeName: 'plantSort',
        entityId: 'inventory-plant',
        amount: 1,
    });
    const inventoryItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'inventory-plant',
        'plantSort',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'inventory',
    );
    assert.ok(inventoryItemId);
    await consumeInventoryItem(accountId, {
        entityTypeName: 'plantSort',
        entityId: 'inventory-plant',
        amount: 1,
        source: `shoppingCartItem:${inventoryItemId.toString()}`,
    });
    await assert.rejects(
        upsertOrRemoveCartItem(
            inventoryItemId,
            cart.id,
            'inventory-plant',
            'plantSort',
            0,
            undefined,
            undefined,
            undefined,
            null,
            'inventory',
        ),
        CheckoutCartItemFulfillmentStartedError,
    );
    await assert.rejects(
        deleteShoppingCart(accountId),
        CheckoutCartItemFulfillmentStartedError,
    );

    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'checkout-projection');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const plantedItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'placed-plant',
        'plantSort',
        1,
        gardenId,
        raisedBedId,
        0,
        null,
        'eur',
        true,
    );
    assert.ok(plantedItemId);
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(`${raisedBedId}|1`, {
            plantSortId: 'placed-plant',
            purchase: {
                cartItemId: plantedItemId,
                currency: 'eur',
                euroAmountCents: 2500,
            },
            scheduledDate: null,
        }),
    );
    const cartAfterWrongTargetPlanting = await getShoppingCart(cart.id);
    assert.ok(cartAfterWrongTargetPlanting);
    assert.equal(
        (
            await getCheckoutFulfillmentStartedCartItemIds(
                accountId,
                cartAfterWrongTargetPlanting.items,
            )
        ).has(plantedItemId),
        false,
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(`${raisedBedId}|0`, {
            plantSortId: 'placed-plant',
            purchase: {
                cartItemId: plantedItemId,
                currency: 'eur',
                euroAmountCents: 2500,
            },
            scheduledDate: null,
        }),
    );
    await assert.rejects(
        upsertOrRemoveCartItem(
            plantedItemId,
            cart.id,
            'placed-plant',
            'plantSort',
            1,
            gardenId,
            raisedBedId,
            0,
            null,
            'sunflower',
        ),
        CheckoutCartItemFulfillmentStartedError,
    );

    const rewardedOperationItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'rewarded-operation',
        'operation',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'eur',
        true,
    );
    assert.ok(rewardedOperationItemId);
    await earnSunflowersForPayment(
        accountId,
        25,
        `shoppingCartItem:${rewardedOperationItemId.toString()}`,
    );
    await assert.rejects(
        upsertOrRemoveCartItem(
            rewardedOperationItemId,
            cart.id,
            'rewarded-operation',
            'operation',
            1,
            undefined,
            undefined,
            undefined,
            null,
            'sunflower',
        ),
        CheckoutCartItemFulfillmentStartedError,
    );

    const zeroRewardOperationItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'zero-reward-operation',
        'operation',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'eur',
        true,
    );
    assert.ok(zeroRewardOperationItemId);
    const balanceBeforeZeroReward = await getSunflowers(accountId);
    await earnSunflowersForPayment(
        accountId,
        0.01,
        `shoppingCartItem:${zeroRewardOperationItemId.toString()}`,
    );
    assert.equal(await getSunflowers(accountId), balanceBeforeZeroReward);
    const cartAfterZeroReward = await getShoppingCart(cart.id);
    assert.ok(cartAfterZeroReward);
    assert.equal(
        (
            await getCheckoutFulfillmentStartedCartItemIds(
                accountId,
                cartAfterZeroReward.items,
            )
        ).has(zeroRewardOperationItemId),
        true,
    );
    await assert.rejects(
        upsertOrRemoveCartItem(
            zeroRewardOperationItemId,
            cart.id,
            'zero-reward-operation',
            'operation',
            1,
            undefined,
            undefined,
            undefined,
            null,
            'sunflower',
        ),
        CheckoutCartItemFulfillmentStartedError,
    );
});

test('checkout planting incident notifications freeze pending cart items', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    const incidentTypes = [
        'checkout_planting_raised_bed_unavailable',
        'checkout_planting_target_conflict',
    ] as const;
    const itemIds: number[] = [];
    for (const [index, type] of incidentTypes.entries()) {
        const itemId = await upsertOrRemoveCartItem(
            null,
            cart.id,
            `incident-plant-${index.toString()}`,
            'plantSort',
            1,
            undefined,
            undefined,
            undefined,
            null,
            'eur',
            true,
        );
        assert.ok(itemId);
        itemIds.push(itemId);
        await createNotificationWithStatus(
            {
                accountId,
                header: 'Plaćena sadnja čeka provjeru',
                content: 'Zadatak je evidentiran za pregled tima farme.',
                category: 'checkout_fulfillment',
                type,
                metadata: { cartItemId: itemId },
                timestamp: new Date(),
            },
            {
                idempotencyKey: `checkout-planting-incident:${itemId.toString()}`,
                routeDelivery: false,
            },
        );
    }

    const incidentCart = await getShoppingCart(cart.id);
    assert.ok(incidentCart);
    const startedItemIds = await getCheckoutFulfillmentStartedCartItemIds(
        accountId,
        incidentCart.items,
    );
    assert.deepEqual(
        [...startedItemIds].sort((left, right) => left - right),
        [...itemIds].sort((left, right) => left - right),
    );

    for (const [index, itemId] of itemIds.entries()) {
        await assert.rejects(
            upsertOrRemoveCartItem(
                itemId,
                cart.id,
                `incident-plant-${index.toString()}`,
                'plantSort',
                1,
                undefined,
                undefined,
                undefined,
                null,
                'sunflower',
            ),
            CheckoutCartItemFulfillmentStartedError,
        );
    }
    await assert.rejects(
        deleteShoppingCart(accountId),
        CheckoutCartItemFulfillmentStartedError,
    );
});

test('cart item mutation waits for a checkout effect and then rejects', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'checkout-race-plant',
        'plantSort',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'sunflower',
    );
    assert.ok(itemId);

    let signalCheckoutLockHeld = () => {};
    let signalReleaseCheckoutLock = () => {};
    const checkoutLockHeld = new Promise<void>((resolve) => {
        signalCheckoutLockHeld = resolve;
    });
    const releaseCheckoutLock = new Promise<void>((resolve) => {
        signalReleaseCheckoutLock = resolve;
    });
    const checkout = withCheckoutCartItemLock(itemId, async (db) => {
        await spendSunflowersBatch(
            accountId,
            [
                {
                    amount: 1,
                    reason: `shoppingCartItem:${itemId.toString()}`,
                },
            ],
            db,
        );
        signalCheckoutLockHeld();
        await releaseCheckoutLock;
    });
    await checkoutLockHeld;

    let mutationSettled = false;
    const mutation = upsertOrRemoveCartItem(
        itemId,
        cart.id,
        'checkout-race-plant',
        'plantSort',
        2,
        undefined,
        undefined,
        undefined,
        null,
        'sunflower',
    );
    void mutation.then(
        () => {
            mutationSettled = true;
        },
        () => {
            mutationSettled = true;
        },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const mutationSettledWhileLocked = mutationSettled;

    signalReleaseCheckoutLock();
    await checkout;
    assert.equal(mutationSettledWhileLocked, false);
    await assert.rejects(mutation, CheckoutCartItemFulfillmentStartedError);
    const persistedCart = await getShoppingCart(cart.id);
    assert.equal(
        persistedCart?.items.find((item) => item.id === itemId)?.amount,
        1,
    );
});

test('explicit item update does not recreate an item deleted while waiting', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const deletedItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'deleted-while-waiting',
        'plantSort',
        1,
    );
    const retainedItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'retained-cart-item',
        'plantSort',
        1,
    );
    assert.ok(deletedItemId);
    assert.ok(retainedItemId);

    let signalItemDeleted = () => {};
    let signalReleaseItemLock = () => {};
    const itemDeleted = new Promise<void>((resolve) => {
        signalItemDeleted = resolve;
    });
    const releaseItemLock = new Promise<void>((resolve) => {
        signalReleaseItemLock = resolve;
    });
    const deletion = withCheckoutCartItemLock(
        deletedItemId,
        async (database) => {
            await database.execute(
                sql`update shopping_cart_items set is_deleted = true where id = ${deletedItemId}`,
            );
            signalItemDeleted();
            await releaseItemLock;
        },
    );
    await itemDeleted;

    let updateSettled = false;
    const update = upsertOrRemoveCartItem(
        deletedItemId,
        cart.id,
        'deleted-while-waiting',
        'plantSort',
        2,
    );
    void update.then(
        () => {
            updateSettled = true;
        },
        () => {
            updateSettled = true;
        },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const updateSettledWhileLocked = updateSettled;

    signalReleaseItemLock();
    await deletion;
    assert.equal(updateSettledWhileLocked, false);
    await assert.rejects(update, /Shopping cart item not found/);
    const persistedCart = await getShoppingCart(cart.id);
    assert.deepStrictEqual(
        persistedCart?.items.map((item) => item.id),
        [retainedItemId],
    );
});

test('cart deletion waits for checkout paid status and then rejects', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'paid-while-delete-waits',
        'plantSort',
        1,
    );
    assert.ok(itemId);

    let signalItemPaid = () => {};
    let signalReleaseItemLock = () => {};
    const itemPaid = new Promise<void>((resolve) => {
        signalItemPaid = resolve;
    });
    const releaseItemLock = new Promise<void>((resolve) => {
        signalReleaseItemLock = resolve;
    });
    const checkout = withCheckoutCartItemLock(itemId, async (db) => {
        await setCartItemPaid(itemId, db);
        signalItemPaid();
        await releaseItemLock;
    });
    await itemPaid;

    let deletionSettled = false;
    const deletion = deleteShoppingCart(accountId);
    void deletion.then(
        () => {
            deletionSettled = true;
        },
        () => {
            deletionSettled = true;
        },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const deletionSettledWhileLocked = deletionSettled;

    signalReleaseItemLock();
    await checkout;
    assert.equal(deletionSettledWhileLocked, false);
    await assert.rejects(deletion, CheckoutCartItemFulfillmentStartedError);
    const persistedCart = await getShoppingCart(cart.id);
    assert.equal(
        persistedCart?.items.find((item) => item.id === itemId)?.status,
        'paid',
    );
});

test('normalizeShoppingCartInventoryUsage serializes with checkout consumption', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await addInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'serialized-inventory-item',
        amount: 1,
    });
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const itemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'serialized-inventory-item',
        'plant',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'inventory',
    );
    assert.ok(itemId);

    let signalReleaseInventoryLock = () => {};
    let signalInventoryLockHeld = () => {};
    const inventoryLockHeld = new Promise<void>((resolve) => {
        signalInventoryLockHeld = resolve;
    });
    const inventoryLockRelease = new Promise<void>((resolve) => {
        signalReleaseInventoryLock = resolve;
    });
    const lockHolder = withInventoryAccountTransaction(accountId, async () => {
        signalInventoryLockHeld();
        await inventoryLockRelease;
    });
    await inventoryLockHeld;

    let normalizationSettled = false;
    const normalization = normalizeShoppingCartInventoryUsage(cart.id).finally(
        () => {
            normalizationSettled = true;
        },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(normalizationSettled, false);

    const consumption = consumeInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'serialized-inventory-item',
        amount: 1,
        source: `shoppingCartItem:${itemId.toString()}`,
    });
    signalReleaseInventoryLock();
    await Promise.all([lockHolder, normalization, consumption]);

    const retriedCart = await normalizeShoppingCartInventoryUsage(cart.id);
    assert.equal(
        retriedCart?.items.find((item) => item.id === itemId)?.currency,
        'inventory',
    );
});

test('normalizeShoppingCartInventoryUsage reserves a durable consumption for its cart item', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await addInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'entity-1',
        amount: 1,
    });

    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');
    const unconsumedItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
        undefined,
        undefined,
        undefined,
        'older-item',
        'inventory',
        true,
    );
    const consumedItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'plant',
        1,
        undefined,
        undefined,
        undefined,
        'consumed-item',
        'inventory',
        true,
    );
    assert.ok(unconsumedItemId);
    assert.ok(consumedItemId);
    await consumeInventoryItem(accountId, {
        entityTypeName: 'plant',
        entityId: 'entity-1',
        amount: 1,
        source: `shoppingCartItem:${consumedItemId.toString()}`,
    });

    const normalizedCart = await normalizeShoppingCartInventoryUsage(cart.id);
    assert.ok(normalizedCart);
    const unconsumedItem = normalizedCart.items.find(
        (item) => item.id === unconsumedItemId,
    );
    const consumedItem = normalizedCart.items.find(
        (item) => item.id === consumedItemId,
    );
    assert.strictEqual(unconsumedItem?.currency, 'eur');
    assert.strictEqual(consumedItem?.currency, 'inventory');
    assert.strictEqual(consumedItem?.amount, 1);
    assert.strictEqual(consumedItem?.status, 'new');
});

test('upsertOrRemoveCartItem normalizes scheduled date to tomorrow when date is in the past', async () => {
    createTestDb();
    const fixedNow = new Date('2024-01-15T12:00:00Z');
    test.mock.timers.enable({ now: fixedNow });
    try {
        const accountId = await createTestAccount();
        const cart = await getOrCreateShoppingCart(accountId);
        if (!cart) throw new Error('Cart not created');

        const now = new Date();
        const yesterday = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - 1,
            ),
        );
        const expectedTomorrow = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
            ),
        );

        await upsertOrRemoveCartItem(
            null,
            cart.id,
            'entity-1',
            'operation',
            1,
            undefined,
            undefined,
            undefined,
            JSON.stringify({
                scheduledDate: yesterday.toISOString(),
            }),
        );

        const foundCart = await getShoppingCart(cart.id);
        if (!foundCart) throw new Error('Cart not found');

        const additionalData = foundCart.items[0]?.additionalData;
        assert.ok(
            additionalData,
            'Scheduled additional data should be present',
        );
        assert.strictEqual(
            JSON.parse(additionalData).scheduledDate,
            expectedTomorrow.toISOString(),
        );
    } finally {
        test.mock.timers.reset();
    }
});

test('upsertOrRemoveCartItem normalizes scheduled date with time component to start-of-day UTC', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    const now = new Date();
    // Use a date 5 days in the future with a non-zero time component
    const futureWithTime = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 5,
            15,
            30,
            45,
        ),
    );
    const expectedStartOfDay = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5),
    );

    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'operation',
        1,
        undefined,
        undefined,
        undefined,
        JSON.stringify({
            scheduledDate: futureWithTime.toISOString(),
        }),
    );

    const foundCart = await getShoppingCart(cart.id);
    if (!foundCart) throw new Error('Cart not found');

    const additionalData = foundCart.items[0]?.additionalData;
    assert.ok(additionalData, 'Scheduled additional data should be present');
    assert.strictEqual(
        JSON.parse(additionalData).scheduledDate,
        expectedStartOfDay.toISOString(),
    );
});

test('normalizeShoppingCartScheduledDates updates past scheduled dates in cart', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const cart = await getOrCreateShoppingCart(accountId);
    if (!cart) throw new Error('Cart not created');

    const now = new Date();
    const futureDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7),
    );
    const pastDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 5),
    );
    const expectedTomorrow = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );

    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-1',
        'operation',
        1,
        undefined,
        undefined,
        undefined,
        JSON.stringify({
            scheduledDate: futureDate.toISOString(),
        }),
    );

    await upsertOrRemoveCartItem(
        null,
        cart.id,
        'entity-2',
        'operation',
        1,
        undefined,
        undefined,
        undefined,
        JSON.stringify({
            scheduledDate: pastDate.toISOString(),
        }),
        undefined,
        true,
    );

    const normalizedCart = await normalizeShoppingCartScheduledDates(cart.id);
    assert.ok(normalizedCart);

    const scheduledDates = normalizedCart.items.map((item) =>
        item.additionalData
            ? JSON.parse(item.additionalData).scheduledDate
            : null,
    );

    assert.deepStrictEqual(scheduledDates, [
        futureDate.toISOString(),
        expectedTomorrow.toISOString(),
    ]);
});

test('normalizeShoppingCartScheduledDates preserves a mapped operation for a later-day retry', async () => {
    createTestDb();
    const checkoutStartedAt = new Date('2026-07-01T12:00:00.000Z');
    const scheduledDate = new Date('2026-07-02T00:00:00.000Z');
    test.mock.timers.enable({ apis: ['Date'], now: checkoutStartedAt });
    try {
        const accountId = await createTestAccount();
        const cart = await getOrCreateShoppingCart(accountId);
        if (!cart) throw new Error('Cart not created');
        const cartItemId = await upsertOrRemoveCartItem(
            null,
            cart.id,
            '17',
            'operation',
            1,
            undefined,
            undefined,
            undefined,
            JSON.stringify({ scheduledDate: scheduledDate.toISOString() }),
        );
        assert.ok(cartItemId);
        const operationInput = {
            accountId,
            entityId: 17,
            entityTypeName: 'operation',
        };
        const firstAttempt = await getOrCreateCheckoutOperation(
            cartItemId,
            operationInput,
            { delivery: null, paymentCurrency: 'eur', scheduledDate },
        );
        assert.equal(firstAttempt.created, true);
        await assert.rejects(
            upsertOrRemoveCartItem(
                cartItemId,
                cart.id,
                '17',
                'operation',
                1,
                undefined,
                undefined,
                undefined,
                JSON.stringify({
                    scheduledDate: scheduledDate.toISOString(),
                }),
                'sunflower',
            ),
            CheckoutCartItemFulfillmentStartedError,
        );

        test.mock.timers.setTime(
            new Date('2026-07-05T12:00:00.000Z').getTime(),
        );
        const normalizedCart = await normalizeShoppingCartScheduledDates(
            cart.id,
        );
        const normalizedItem = normalizedCart?.items.find(
            (item) => item.id === cartItemId,
        );
        assert.ok(normalizedItem?.additionalData);
        assert.equal(
            JSON.parse(normalizedItem.additionalData).scheduledDate,
            scheduledDate.toISOString(),
        );

        assert.deepEqual(
            await getOrCreateCheckoutOperation(cartItemId, operationInput, {
                delivery: null,
                paymentCurrency: 'eur',
                scheduledDate,
            }),
            { operationId: firstAttempt.operationId, created: false },
        );
    } finally {
        test.mock.timers.reset();
    }
});

test('scheduled-date normalization waits for checkout and preserves a spent item', async () => {
    createTestDb();
    const checkoutStartedAt = new Date('2026-07-01T12:00:00.000Z');
    const scheduledDate = new Date('2026-07-02T00:00:00.000Z');
    test.mock.timers.enable({ apis: ['Date'], now: checkoutStartedAt });
    try {
        const accountId = await createTestAccount();
        const cart = await getOrCreateShoppingCart(accountId);
        if (!cart) throw new Error('Cart not created');
        const cartItemId = await upsertOrRemoveCartItem(
            null,
            cart.id,
            'scheduled-checkout-race',
            'plantSort',
            1,
            undefined,
            undefined,
            undefined,
            JSON.stringify({ scheduledDate: scheduledDate.toISOString() }),
            'sunflower',
        );
        assert.ok(cartItemId);

        let signalCheckoutEffectCreated = () => {};
        let signalReleaseCheckoutLock = () => {};
        const checkoutEffectCreated = new Promise<void>((resolve) => {
            signalCheckoutEffectCreated = resolve;
        });
        const releaseCheckoutLock = new Promise<void>((resolve) => {
            signalReleaseCheckoutLock = resolve;
        });
        const checkout = withCheckoutCartItemLock(
            cartItemId,
            async (database) => {
                await spendSunflowersBatch(
                    accountId,
                    [
                        {
                            amount: 1,
                            reason: `shoppingCartItem:${cartItemId.toString()}`,
                        },
                    ],
                    database,
                );
                signalCheckoutEffectCreated();
                await releaseCheckoutLock;
            },
        );
        await checkoutEffectCreated;
        test.mock.timers.setTime(
            new Date('2026-07-05T12:00:00.000Z').getTime(),
        );

        let normalizationSettled = false;
        const normalization = normalizeShoppingCartScheduledDates(
            cart.id,
        ).finally(() => {
            normalizationSettled = true;
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        const normalizationSettledWhileLocked = normalizationSettled;

        signalReleaseCheckoutLock();
        await checkout;
        const normalizedCart = await normalization;
        assert.equal(normalizationSettledWhileLocked, false);
        const normalizedItem = normalizedCart?.items.find(
            (item) => item.id === cartItemId,
        );
        assert.ok(normalizedItem?.additionalData);
        assert.equal(
            JSON.parse(normalizedItem.additionalData).scheduledDate,
            scheduledDate.toISOString(),
        );
    } finally {
        test.mock.timers.reset();
    }
});

test('normalizeShoppingCartScheduledDates does not treat a sunflower item as an operation mapping', async () => {
    createTestDb();
    const checkoutStartedAt = new Date('2026-07-01T12:00:00.000Z');
    const scheduledDate = new Date('2026-07-02T00:00:00.000Z');
    test.mock.timers.enable({ apis: ['Date'], now: checkoutStartedAt });
    try {
        const accountId = await createTestAccount();
        const cart = await getOrCreateShoppingCart(accountId);
        if (!cart) throw new Error('Cart not created');
        const cartItemId = await upsertOrRemoveCartItem(
            null,
            cart.id,
            'sunflower-package-small',
            'sunflowerPackage',
            1,
            undefined,
            undefined,
            undefined,
            JSON.stringify({ scheduledDate: scheduledDate.toISOString() }),
            'sunflower',
        );
        assert.ok(cartItemId);
        await getOrCreateCheckoutOperation(
            cartItemId,
            {
                accountId,
                entityId: 19,
                entityTypeName: 'operation',
            },
            { delivery: null, paymentCurrency: 'sunflower', scheduledDate },
        );

        test.mock.timers.setTime(
            new Date('2026-07-05T12:00:00.000Z').getTime(),
        );
        const normalizedCart = await normalizeShoppingCartScheduledDates(
            cart.id,
        );
        const normalizedItem = normalizedCart?.items.find(
            (item) => item.id === cartItemId,
        );
        assert.ok(normalizedItem?.additionalData);
        assert.equal(
            JSON.parse(normalizedItem.additionalData).scheduledDate,
            '2026-07-06T00:00:00.000Z',
        );
    } finally {
        test.mock.timers.reset();
    }
});

test('normalizeShoppingCartScheduledDates can default missing scheduled dates to tomorrow', async () => {
    createTestDb();
    const fixedNow = new Date('2024-01-15T12:00:00Z');
    test.mock.timers.enable({ now: fixedNow });
    try {
        const accountId = await createTestAccount();
        const cart = await getOrCreateShoppingCart(accountId);
        if (!cart) throw new Error('Cart not created');

        await upsertOrRemoveCartItem(null, cart.id, 'entity-1', 'operation', 1);
        await upsertOrRemoveCartItem(
            null,
            cart.id,
            'entity-2',
            'plantSort',
            1,
            undefined,
            undefined,
            undefined,
            JSON.stringify({
                delivery: {
                    mode: 'pickup',
                },
            }),
            undefined,
            true,
        );

        const normalizedCart = await normalizeShoppingCartScheduledDates(
            cart.id,
            {
                defaultMissingScheduledDates: true,
            },
        );
        assert.ok(normalizedCart);

        const expectedTomorrow = new Date(
            Date.UTC(
                fixedNow.getUTCFullYear(),
                fixedNow.getUTCMonth(),
                fixedNow.getUTCDate() + 1,
            ),
        ).toISOString();
        const additionalData = normalizedCart.items.map((item) =>
            item.additionalData ? JSON.parse(item.additionalData) : null,
        );

        assert.deepStrictEqual(
            additionalData.map((data) => data?.scheduledDate),
            [expectedTomorrow, expectedTomorrow],
        );
        assert.deepStrictEqual(additionalData[1]?.delivery, {
            mode: 'pickup',
        });
    } finally {
        test.mock.timers.reset();
    }
});
