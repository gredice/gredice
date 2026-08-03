import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accounts,
    bindStripeCheckoutAttempt,
    createStripeCheckoutAttempt,
    deleteAccountWithDependencies,
    deleteShoppingCart,
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
        accountId: cart.accountId ?? '',
        attemptId: randomUUID(),
        cartId: cart.id,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: cart.items.map((item) => ({
            additionalData: item.additionalData,
            amount: item.amount,
            cartId: item.cartId,
            checkoutAdditionalData: {},
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
        userId: 'checkout-test-user',
        version: 1,
    };
}

async function createCartWithItem(existingAccountId?: string) {
    const accountId = existingAccountId ?? (await createTestAccount());
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
        accountId: 'account-1',
        attemptId: '79d24698-c458-45aa-b025-c311dc9a3c1a',
        cartId: 4,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: [
            {
                additionalData: null,
                amount: 1,
                cartId: 4,
                checkoutAdditionalData: {},
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
        userId: 'user-1',
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
    const { cart, itemId } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot);

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
        () => deleteShoppingCart(snapshot.accountId),
        StripeCheckoutAttemptInProgressError,
    );

    const activeAttempt = await getActiveStripeCheckoutAttempt(cart.id);
    assert.equal(activeAttempt?.snapshot.attemptId, snapshot.attemptId);
});

test('attempt binding, webhook recovery, cancellation, and a later cart mutation are idempotent', async () => {
    createTestDb();
    const { cart, itemId } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot);
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
    const { cart, itemId } = await createCartWithItem();
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
        () => createStripeCheckoutAttempt(staleSnapshot),
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
        () => createStripeCheckoutAttempt(missingItemSnapshot),
        StripeCheckoutAttemptConflictError,
    );
});

test('an active snapshot wins account deletion before any garden mutation', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const garden = await createTestGarden({
        accountId,
        farmId: await ensureFarmId(),
    });
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot);

    await assert.rejects(
        () => deleteAccountWithDependencies(accountId, 'missing-test-user'),
        StripeCheckoutAttemptInProgressError,
    );

    const untouchedGarden = await getGarden(garden);
    assert.equal(untouchedGarden?.accountId, accountId);
    assert.ok(await getActiveStripeCheckoutAttempt(cart.id));
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
        () => createStripeCheckoutAttempt(snapshot),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'cart_inactive');
            return true;
        },
    );
});
