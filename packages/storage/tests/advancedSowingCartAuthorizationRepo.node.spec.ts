import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    type AdvancedSowingCartAuthorizationV1,
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import {
    assignStripeCustomerId,
    createStripeCheckoutAttempt,
    fingerprintStripeCheckoutValue,
    getOrCreateShoppingCart,
    getShoppingCart,
    getShoppingCartItemAdvancedSowingAuthorizations,
    StripeCheckoutAttemptConflictError,
    type StripeCheckoutAttemptSnapshot,
    upsertOrRemoveCartItem,
    upsertOrRemoveCartItemWithAdvancedSowingAuthorization,
} from '@gredice/storage';
import {
    createTestAccount,
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

function authorization(
    anchorPositionIndex = 11,
): AdvancedSowingCartAuthorizationV1 {
    return {
        kind: advancedSowingCartAuthorizationKind,
        plan: buildAdvancedSowingCartConfigurationV1({
            anchorPositionIndex,
            bedFieldCount: 18,
            maxDistanceCm: 60,
            minDistanceCm: 15,
            optimalDistanceCm: 30,
            selectedDistanceCm: 60,
        }),
        version: 1,
    };
}

async function createCartTarget() {
    createTestDb();
    const accountId = await createTestAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'advanced-sowing-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    return { accountId, cart, gardenId, raisedBedId };
}

async function createAuthorizedItem() {
    const target = await createCartTarget();
    const selectedAuthorization = authorization();
    const itemId = await upsertOrRemoveCartItemWithAdvancedSowingAuthorization({
        additionalData: '{"scheduledDate":"2026-09-01T00:00:00.000Z"}',
        amount: 1,
        authorization: selectedAuthorization,
        cartId: target.cart.id,
        currency: 'eur',
        entityId: 'plant-sort-1',
        entityTypeName: 'plantSort',
        gardenId: target.gardenId,
        positionIndex: 11,
        raisedBedId: target.raisedBedId,
    });
    assert.ok(itemId);
    return { ...target, itemId, selectedAuthorization };
}

function snapshotFromCart(
    cart: NonNullable<Awaited<ReturnType<typeof getShoppingCart>>>,
    advancedSowingAuthorizationsByCartItemId: ReadonlyMap<
        number,
        AdvancedSowingCartAuthorizationV1
    >,
): StripeCheckoutAttemptSnapshot {
    return {
        attemptId: randomUUID(),
        cartId: cart.id,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: cart.items.map((item) => ({
            ...(advancedSowingAuthorizationsByCartItemId.get(item.id)
                ? {
                      advancedSowingAuthorization:
                          advancedSowingAuthorizationsByCartItemId.get(item.id),
                  }
                : {}),
            additionalDataFingerprint: fingerprintStripeCheckoutValue(
                item.additionalData,
            ),
            amount: item.amount,
            cartId: item.cartId,
            checkoutAdditionalDataFingerprint: fingerprintStripeCheckoutValue(
                {},
            ),
            currency: item.currency,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            gardenId: item.gardenId,
            id: item.id,
            paymentAmount: 500,
            paymentKind: 'stripe' as const,
            positionIndex: item.positionIndex,
            raisedBedId: item.raisedBedId,
            status: 'new' as const,
        })),
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue(
                'advanced-sowing-checkout-customer',
            ),
            expiresAt: '2026-09-01T00:00:00.000Z',
            items: cart.items.map((item) => ({
                cartItemId: item.id,
                price: { currency: 'eur' as const, valueInCents: 500 },
                product: { name: 'Tikvica' },
                quantity: item.amount,
            })),
            returnUrls: {
                cancel: 'https://example.test/cancel',
                success: 'https://example.test/success',
            },
        },
        userFingerprint: fingerprintStripeCheckoutValue(
            'advanced-sowing-checkout-user',
        ),
        version: 1,
    };
}

test('atomic cart mutation persists authorization outside generic cart reads', async () => {
    const { cart, itemId, selectedAuthorization } =
        await createAuthorizedItem();

    assert.deepEqual(
        (await getShoppingCartItemAdvancedSowingAuthorizations([itemId])).get(
            itemId,
        ),
        selectedAuthorization,
    );
    const persistedCart = await getShoppingCart(cart.id);
    assert.ok(persistedCart);
    const item = persistedCart.items.find(
        (candidate) => candidate.id === itemId,
    );
    assert.ok(item);
    assert.equal(Object.hasOwn(item, 'advancedSowingAuthorization'), false);
});

test('currency and scheduling edits preserve authorization', async () => {
    const { cart, gardenId, itemId, raisedBedId, selectedAuthorization } =
        await createAuthorizedItem();

    await upsertOrRemoveCartItem(
        itemId,
        cart.id,
        'plant-sort-1',
        'plantSort',
        1,
        gardenId,
        raisedBedId,
        11,
        '{"scheduledDate":"2026-09-02T00:00:00.000Z"}',
        'inventory',
    );

    assert.deepEqual(
        (await getShoppingCartItemAdvancedSowingAuthorizations([itemId])).get(
            itemId,
        ),
        selectedAuthorization,
    );
});

test('same-position bed and plant identity changes invalidate authorization', async () => {
    const { accountId, cart, gardenId, itemId, raisedBedId } =
        await createAuthorizedItem();
    const secondBlockId = await createTestBlock(
        gardenId,
        'advanced-sowing-second-block',
    );
    const secondRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        secondBlockId,
    );

    await upsertOrRemoveCartItem(
        itemId,
        cart.id,
        'plant-sort-1',
        'plantSort',
        1,
        gardenId,
        secondRaisedBedId,
        11,
    );
    assert.equal(
        (await getShoppingCartItemAdvancedSowingAuthorizations([itemId])).has(
            itemId,
        ),
        false,
    );

    await upsertOrRemoveCartItemWithAdvancedSowingAuthorization({
        amount: 1,
        authorization: authorization(),
        cartId: cart.id,
        entityId: 'plant-sort-1',
        entityTypeName: 'plantSort',
        gardenId,
        id: itemId,
        positionIndex: 11,
        raisedBedId,
    });
    await upsertOrRemoveCartItem(
        itemId,
        cart.id,
        'plant-sort-with-the-same-range',
        'plantSort',
        1,
        gardenId,
        raisedBedId,
        11,
    );
    assert.equal(
        (await getShoppingCartItemAdvancedSowingAuthorizations([itemId])).has(
            itemId,
        ),
        false,
    );
});

test('authorization mismatch rolls back the cart item mutation', async () => {
    const { cart, gardenId, raisedBedId } = await createCartTarget();

    await assert.rejects(() =>
        upsertOrRemoveCartItemWithAdvancedSowingAuthorization({
            amount: 1,
            authorization: authorization(10),
            cartId: cart.id,
            entityId: 'plant-sort-1',
            entityTypeName: 'plantSort',
            forceCreate: true,
            gardenId,
            positionIndex: 11,
            raisedBedId,
        }),
    );
    assert.equal((await getShoppingCart(cart.id))?.items.length, 0);
});

test('checkout attempt creation rejects authorization drift under its cart fence', async () => {
    const { accountId, cart, itemId, selectedAuthorization } =
        await createAuthorizedItem();
    await assignStripeCustomerId(
        accountId,
        'advanced-sowing-checkout-customer',
    );
    const persistedCart = await getShoppingCart(cart.id);
    assert.ok(persistedCart);

    await assert.rejects(
        () =>
            createStripeCheckoutAttempt(
                snapshotFromCart(persistedCart, new Map()),
                { accountId },
            ),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'cart_item_changed');
            return true;
        },
    );

    const matchingSnapshot = snapshotFromCart(
        persistedCart,
        new Map([[itemId, selectedAuthorization]]),
    );
    assert.deepEqual(
        await createStripeCheckoutAttempt(matchingSnapshot, { accountId }),
        matchingSnapshot,
    );
});
