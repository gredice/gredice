import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountDeletionStartedEventType,
    accounts,
    assignStripeCustomerId,
    bindStripeCheckoutAttempt,
    createStripeCheckoutAttempt,
    deleteAccountWithDependencies,
    deleteShoppingCart,
    fingerprintStripeCheckoutValue,
    foldStripeCheckoutAttemptEvents,
    getActiveStripeCheckoutAttempt,
    getGarden,
    getOrCreateShoppingCart,
    getShoppingCart,
    releaseStripeCheckoutAttempt,
    StripeCheckoutAttemptConflictError,
    StripeCheckoutAttemptInProgressError,
    type StripeCheckoutAttemptSnapshot,
    storage,
    upsertOrRemoveCartItem,
    verifyStripeCheckoutAttemptLiveCart,
} from '@gredice/storage';
import {
    createTestAccount,
    createTestGarden,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

function snapshotFromCart(
    cart: NonNullable<Awaited<ReturnType<typeof getShoppingCart>>>,
): StripeCheckoutAttemptSnapshot {
    return {
        attemptId: randomUUID(),
        cartId: cart.id,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: cart.items.map((item) => ({
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
            paymentKind: 'stripe',
            positionIndex: item.positionIndex,
            raisedBedId: item.raisedBedId,
            status: 'new',
        })),
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue(
                'checkout-test-customer',
            ),
            expiresAt: '2026-08-04T00:00:00.000Z',
            items: cart.items.map((item) => ({
                cartItemId: item.id,
                price: { currency: 'eur', valueInCents: 500 },
                product: { name: 'Checkout test item' },
                quantity: item.amount,
            })),
            returnUrls: {
                cancel: 'https://example.test/cancel',
                success: 'https://example.test/success',
            },
        },
        userFingerprint: fingerprintStripeCheckoutValue('checkout-test-user'),
        version: 1,
    };
}

async function createCartWithItem(existingAccountId?: string) {
    const accountId = existingAccountId ?? (await createTestAccount());
    await assignStripeCustomerId(accountId, 'checkout-test-customer');
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    const itemId = await upsertOrRemoveCartItem(
        undefined,
        cart.id,
        'entity-1',
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
    const populatedCart = await getShoppingCart(cart.id);
    assert.ok(populatedCart);
    return { accountId, cart: populatedCart, itemId };
}

test('Stripe attempt events retain one immutable binding and retry-safe release', () => {
    const snapshot = {
        attemptId: '79d24698-c458-45aa-b025-c311dc9a3c1a',
        cartId: 4,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: [
            {
                additionalDataFingerprint: fingerprintStripeCheckoutValue(null),
                amount: 1,
                cartId: 4,
                checkoutAdditionalDataFingerprint:
                    fingerprintStripeCheckoutValue({}),
                currency: 'eur',
                entityId: 'entity-1',
                entityTypeName: 'plantSort',
                gardenId: null,
                id: 5,
                paymentAmount: 500,
                paymentKind: 'stripe',
                positionIndex: null,
                raisedBedId: null,
                status: 'new',
            },
        ],
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue('cus_1'),
            expiresAt: '2026-08-04T00:00:00.000Z',
            items: [
                {
                    cartItemId: 5,
                    price: { currency: 'eur', valueInCents: 500 },
                    product: { name: 'Checkout test item' },
                    quantity: 1,
                },
            ],
            returnUrls: {
                cancel: 'https://example.test/cancel',
                success: 'https://example.test/success',
            },
        },
        userFingerprint: fingerprintStripeCheckoutValue('user-1'),
        version: 1,
    } satisfies StripeCheckoutAttemptSnapshot;
    const created = {
        data: snapshot,
        type: 'checkout.stripeAttempt.created',
    };
    const bound = {
        data: { attemptId: snapshot.attemptId, sessionId: 'cs_1' },
        type: 'checkout.stripeAttempt.bound',
    };
    assert.equal(
        foldStripeCheckoutAttemptEvents(snapshot.attemptId, [created])
            ?.sessionId,
        undefined,
    );
    assert.equal(
        foldStripeCheckoutAttemptEvents(snapshot.attemptId, [created, bound])
            ?.sessionId,
        'cs_1',
    );
    assert.throws(
        () =>
            foldStripeCheckoutAttemptEvents(snapshot.attemptId, [
                created,
                bound,
                {
                    data: {
                        attemptId: snapshot.attemptId,
                        sessionId: 'cs_changed',
                    },
                    type: 'checkout.stripeAttempt.bound',
                },
            ]),
        StripeCheckoutAttemptConflictError,
    );
});

test('active Stripe attempt fences insert, update, last-item removal, and cart deletion', async () => {
    createTestDb();
    const { accountId, cart, itemId } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot, { accountId });

    await assert.rejects(
        () =>
            upsertOrRemoveCartItem(
                itemId,
                cart.id,
                'entity-1',
                'plantSort',
                2,
                undefined,
                undefined,
                undefined,
                null,
                'eur',
            ),
        StripeCheckoutAttemptInProgressError,
    );
    await assert.rejects(
        () =>
            upsertOrRemoveCartItem(
                undefined,
                cart.id,
                'entity-2',
                'plantSort',
                1,
                undefined,
                undefined,
                undefined,
                null,
                'eur',
                true,
            ),
        StripeCheckoutAttemptInProgressError,
    );
    await assert.rejects(
        () =>
            upsertOrRemoveCartItem(itemId, cart.id, 'entity-1', 'plantSort', 0),
        StripeCheckoutAttemptInProgressError,
    );
    await assert.rejects(
        () => deleteShoppingCart(accountId),
        StripeCheckoutAttemptInProgressError,
    );

    const activeAttempt = await getActiveStripeCheckoutAttempt(cart.id);
    assert.equal(activeAttempt?.snapshot.attemptId, snapshot.attemptId);
});

test('serialized attempt event omits account, user, and raw delivery data', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    const privateUserId = 'private-user-id-never-persist';
    const privateAddressId = 987654321;
    const privateNotes = 'private-delivery-note-never-persist';
    snapshot.userFingerprint = fingerprintStripeCheckoutValue(privateUserId);
    const item = snapshot.items[0];
    assert.ok(item);
    item.checkoutAdditionalDataFingerprint = fingerprintStripeCheckoutValue({
        delivery: {
            addressId: privateAddressId,
            mode: 'delivery',
            notes: privateNotes,
            slotId: 7,
        },
    });

    await createStripeCheckoutAttempt(snapshot, { accountId });
    const createdEvent = await storage().query.events.findFirst({
        where: (event, { and, eq }) =>
            and(
                eq(event.aggregateId, `shoppingCart:${cart.id.toString()}`),
                eq(event.type, 'checkout.stripeAttempt.created'),
            ),
    });
    assert.ok(createdEvent);
    const serialized = JSON.stringify(createdEvent.data);
    for (const forbidden of [
        accountId,
        privateUserId,
        privateAddressId.toString(),
        privateNotes,
        '"accountId":',
        '"userId":',
        '"additionalData":',
        '"checkoutAdditionalData":',
        '"addressId":',
        '"notes":',
    ]) {
        assert.equal(serialized.includes(forbidden), false, forbidden);
    }
});

test('attempt binding, webhook recovery, cancellation, and a later cart mutation are idempotent', async () => {
    createTestDb();
    const { accountId, cart, itemId } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot, { accountId });
    await bindStripeCheckoutAttempt({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        sessionId: 'cs_retry',
    });
    await bindStripeCheckoutAttempt({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        sessionId: 'cs_retry',
    });
    const attempt = await getActiveStripeCheckoutAttempt(cart.id);
    assert.ok(attempt);
    await verifyStripeCheckoutAttemptLiveCart(attempt);

    await releaseStripeCheckoutAttempt({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        reason: 'cancelled',
        sessionId: 'cs_retry',
    });
    await releaseStripeCheckoutAttempt({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        reason: 'expired',
        sessionId: 'cs_retry',
    });
    assert.equal(await getActiveStripeCheckoutAttempt(cart.id), undefined);
    assert.equal(
        await upsertOrRemoveCartItem(
            itemId,
            cart.id,
            'entity-1',
            'plantSort',
            2,
            undefined,
            undefined,
            undefined,
            null,
            'eur',
        ),
        itemId,
    );
});

test('snapshot creation rejects cart membership and amount changes before Stripe', async () => {
    createTestDb();
    const { accountId, cart, itemId } = await createCartWithItem();
    const staleSnapshot = snapshotFromCart(cart);
    await upsertOrRemoveCartItem(
        itemId,
        cart.id,
        'entity-1',
        'plantSort',
        2,
        undefined,
        undefined,
        undefined,
        null,
        'eur',
    );
    await assert.rejects(
        () => createStripeCheckoutAttempt(staleSnapshot, { accountId }),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'cart_item_changed');
            return true;
        },
    );

    const currentCart = await getShoppingCart(cart.id);
    assert.ok(currentCart);
    const missingItemSnapshot = snapshotFromCart(currentCart);
    missingItemSnapshot.items = [];
    await assert.rejects(
        () => createStripeCheckoutAttempt(missingItemSnapshot, { accountId }),
        StripeCheckoutAttemptConflictError,
    );
});

test('snapshot creation rejects a customer that lost the canonical assignment race', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    await assignStripeCustomerId(accountId, 'checkout-race-winner');

    await assert.rejects(
        () => createStripeCheckoutAttempt(snapshot, { accountId }),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'checkout_identity_changed');
            return true;
        },
    );
    assert.equal(await getActiveStripeCheckoutAttempt(cart.id), undefined);
});

test('an active snapshot wins account deletion before any garden mutation', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const garden = await createTestGarden({
        accountId,
        farmId: await ensureFarmId(),
    });
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot, { accountId });

    await assert.rejects(
        () => deleteAccountWithDependencies(accountId, 'missing-test-user'),
        StripeCheckoutAttemptInProgressError,
    );

    const untouchedGarden = await getGarden(garden);
    assert.equal(untouchedGarden?.accountId, accountId);
    assert.ok(await getActiveStripeCheckoutAttempt(cart.id));
    assert.equal(
        await storage().query.events.findFirst({
            where: (event, { and, eq }) =>
                and(
                    eq(event.aggregateId, accountId),
                    eq(event.type, accountDeletionStartedEventType),
                ),
        }),
        undefined,
    );
});

test('account deletion can win and remains retryable while a stale snapshot fails', async () => {
    createTestDb();
    const accountId = randomUUID();
    await storage().insert(accounts).values({ id: accountId });
    const { cart } = await createCartWithItem(accountId);
    const snapshot = snapshotFromCart(cart);

    await deleteAccountWithDependencies(accountId, 'missing-test-user');
    await deleteAccountWithDependencies(accountId, 'missing-test-user');

    assert.equal(await getShoppingCart(cart.id), undefined);
    await assert.rejects(
        () => createStripeCheckoutAttempt(snapshot, { accountId }),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'account_inactive');
            return true;
        },
    );
});
