import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountDeletionStartedEventType,
    accounts,
    assignStripeCustomerId,
    assignStripeCustomerIdIfUnchanged,
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
    getStripeCheckoutAttemptReconciliationCursor,
    listActiveStripeCheckoutAttemptsForReconciliation,
    recordStripeCheckoutAttemptReconciliationMiss,
    releaseStripeCheckoutAttempt,
    releaseStripeCheckoutAttemptAfterReconciliationMisses,
    StripeCheckoutAttemptConflictError,
    StripeCheckoutAttemptInProgressError,
    type StripeCheckoutAttemptSnapshot,
    setStripeCheckoutAttemptReconciliationCursor,
    storage,
    upsertOrRemoveCartItem,
    verifyStripeCheckoutAttemptLiveCart,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { events } from '../src/schema';
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

test('an active snapshot fences replacement of its canonical Stripe customer', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(snapshot, { accountId });

    assert.equal(
        await assignStripeCustomerIdIfUnchanged(
            accountId,
            'checkout-test-customer',
            'checkout-replacement-customer',
        ),
        'checkout-test-customer',
    );
    await releaseStripeCheckoutAttempt({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        reason: 'cancelled',
        sessionId: null,
    });
    assert.equal(
        await assignStripeCustomerIdIfUnchanged(
            accountId,
            'checkout-test-customer',
            'checkout-replacement-customer',
        ),
        'checkout-replacement-customer',
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

test('active Stripe reconciliation pages include bound attempts and skip released history before the keyset limit', async () => {
    createTestDb();
    const attempts = [];
    for (let index = 0; index < 5; index += 1) {
        const { accountId, cart } = await createCartWithItem();
        const snapshot = snapshotFromCart(cart);
        await createStripeCheckoutAttempt(snapshot, { accountId });
        attempts.push({ cart, snapshot });
    }
    const boundAttempt = attempts[0];
    const firstReleasedAttempt = attempts[1];
    const secondReleasedAttempt = attempts[2];
    const firstActiveAttempt = attempts[3];
    assert.ok(boundAttempt);
    assert.ok(firstReleasedAttempt);
    assert.ok(secondReleasedAttempt);
    assert.ok(firstActiveAttempt);
    const listedMiss = await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: firstActiveAttempt.snapshot.attemptId,
        cartId: firstActiveAttempt.cart.id,
        observedAt: new Date('2026-08-03T09:00:00.000Z'),
    });
    assert.equal(listedMiss.status, 'recorded');
    await bindStripeCheckoutAttempt({
        attemptId: boundAttempt.snapshot.attemptId,
        cartId: boundAttempt.cart.id,
        sessionId: 'cs_reconciliation_bound',
    });
    await releaseStripeCheckoutAttempt({
        attemptId: firstReleasedAttempt.snapshot.attemptId,
        cartId: firstReleasedAttempt.cart.id,
        reason: 'session_creation_failed',
        sessionId: null,
    });
    await releaseStripeCheckoutAttempt({
        attemptId: secondReleasedAttempt.snapshot.attemptId,
        cartId: secondReleasedAttempt.cart.id,
        reason: 'session_creation_failed',
        sessionId: null,
    });

    const firstCreatedEvent = await storage().query.events.findFirst({
        where: (event, { and: all, eq: equal }) =>
            all(
                equal(
                    event.aggregateId,
                    `shoppingCart:${boundAttempt.cart.id.toString()}`,
                ),
                equal(event.type, 'checkout.stripeAttempt.created'),
            ),
    });
    assert.ok(firstCreatedEvent);

    let cursor = firstCreatedEvent.id - 1;
    const seenAttemptIds: string[] = [];
    const pageItemCounts: number[] = [];
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
        const page = await listActiveStripeCheckoutAttemptsForReconciliation({
            afterCreatedEventId: cursor,
            limit: 1,
        });
        pageItemCounts.push(page.items.length);
        if (pageIndex === 0) {
            assert.equal(
                page.items[0]?.attempt.sessionId,
                'cs_reconciliation_bound',
            );
        }
        if (pageIndex === 1 && listedMiss.status === 'recorded') {
            assert.equal(
                page.items[0]?.lastReconciliationMissAt?.toISOString(),
                listedMiss.createdAt.toISOString(),
            );
        }
        seenAttemptIds.push(
            ...page.items.map((item) => item.attempt.snapshot.attemptId),
        );
        if (pageIndex < 2) {
            assert.equal(page.hasMore, true);
            assert.ok(page.nextCreatedEventId);
            assert.ok(page.nextCreatedEventId > cursor);
            cursor = page.nextCreatedEventId;
        } else {
            assert.equal(page.hasMore, false);
            assert.equal(page.nextCreatedEventId, undefined);
        }
    }

    assert.deepEqual(pageItemCounts, [1, 1, 1]);
    assert.deepEqual(seenAttemptIds, [
        attempts[0]?.snapshot.attemptId,
        attempts[3]?.snapshot.attemptId,
        attempts[4]?.snapshot.attemptId,
    ]);
});

test('released paging correlation keeps a later active attempt on the same cart', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const releasedSnapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(releasedSnapshot, { accountId });
    await releaseStripeCheckoutAttempt({
        attemptId: releasedSnapshot.attemptId,
        cartId: cart.id,
        reason: 'session_creation_failed',
        sessionId: null,
    });
    const activeSnapshot = snapshotFromCart(cart);
    await createStripeCheckoutAttempt(activeSnapshot, { accountId });

    const [firstCreatedEvent] = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, `shoppingCart:${cart.id.toString()}`),
                eq(events.type, 'checkout.stripeAttempt.created'),
            ),
        )
        .orderBy(events.id)
        .limit(1);
    assert.ok(firstCreatedEvent);
    const page = await listActiveStripeCheckoutAttemptsForReconciliation({
        afterCreatedEventId: firstCreatedEvent.id - 1,
        limit: 1,
    });

    assert.equal(page.items.length, 1);
    assert.equal(
        page.items[0]?.attempt.snapshot.attemptId,
        activeSnapshot.attemptId,
    );
    assert.equal(page.hasMore, false);
});

test('Stripe checkout reconciliation cursor persists append-only advances and reset', async () => {
    createTestDb();
    await setStripeCheckoutAttemptReconciliationCursor(null);
    assert.equal(
        await getStripeCheckoutAttemptReconciliationCursor(),
        undefined,
    );
    assert.equal(await setStripeCheckoutAttemptReconciliationCursor(41), 41);
    assert.equal(await getStripeCheckoutAttemptReconciliationCursor(), 41);
    assert.equal(await setStripeCheckoutAttemptReconciliationCursor(88), 88);
    assert.equal(await getStripeCheckoutAttemptReconciliationCursor(), 88);
    assert.equal(
        await setStripeCheckoutAttemptReconciliationCursor(null),
        undefined,
    );
    assert.equal(
        await getStripeCheckoutAttemptReconciliationCursor(),
        undefined,
    );

    const cursorEvents = await storage()
        .select({ data: events.data, type: events.type })
        .from(events)
        .where(
            eq(
                events.aggregateId,
                'checkout:stripeAttemptReconciliationCursor',
            ),
        )
        .orderBy(events.id);
    assert.deepEqual(cursorEvents, [
        {
            data: { afterCreatedEventId: null },
            type: 'checkout.stripeAttempt.reconciliationCursor.reset',
        },
        {
            data: { afterCreatedEventId: 41 },
            type: 'checkout.stripeAttempt.reconciliationCursor.advanced',
        },
        {
            data: { afterCreatedEventId: 88 },
            type: 'checkout.stripeAttempt.reconciliationCursor.advanced',
        },
        {
            data: { afterCreatedEventId: null },
            type: 'checkout.stripeAttempt.reconciliationCursor.reset',
        },
    ]);
    await assert.rejects(
        () => setStripeCheckoutAttemptReconciliationCursor(0),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'reconciliation_cursor_invalid');
            return true;
        },
    );
});

test('Stripe checkout reconciliation cursor rejects malformed latest evidence', async () => {
    createTestDb();
    await storage()
        .insert(events)
        .values({
            aggregateId: 'checkout:stripeAttemptReconciliationCursor',
            data: { afterCreatedEventId: 'private-or-invalid-value' },
            type: 'checkout.stripeAttempt.reconciliationCursor.advanced',
            version: 1,
        });

    await assert.rejects(
        () => getStripeCheckoutAttemptReconciliationCursor(),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'reconciliation_cursor_malformed');
            return true;
        },
    );
});

test('reconciliation miss evidence is append-only, idempotent, and releases only after a database-timed grace', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    snapshot.stripeSession.expiresAt = '2020-01-01T00:00:00.000Z';
    await createStripeCheckoutAttempt(snapshot, { accountId });

    const firstObservedAt = new Date('2026-08-03T10:00:00.000Z');
    const firstMiss = await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        observedAt: firstObservedAt,
    });
    assert.equal(firstMiss.status, 'recorded');
    const duplicateFirstMiss =
        await recordStripeCheckoutAttemptReconciliationMiss({
            attemptId: snapshot.attemptId,
            cartId: cart.id,
            observedAt: firstObservedAt,
        });
    assert.deepEqual(duplicateFirstMiss, {
        ...firstMiss,
        status: 'existing',
    });

    const tooSoon = await releaseStripeCheckoutAttemptAfterReconciliationMisses(
        {
            attemptId: snapshot.attemptId,
            cartId: cart.id,
            missBefore: new Date(firstObservedAt.getTime() - 60 * 60 * 1000),
            now: firstObservedAt,
        },
    );
    assert.equal(tooSoon.status, 'too_soon');
    assert.ok(await getActiveStripeCheckoutAttempt(cart.id));

    await storage()
        .update(events)
        .set({ createdAt: new Date('2020-01-02T00:00:00.000Z') })
        .where(
            and(
                eq(events.aggregateId, `shoppingCart:${cart.id.toString()}`),
                eq(events.type, 'checkout.stripeAttempt.reconciliationMiss'),
            ),
        );
    const secondObservedAt = new Date('2026-08-03T12:00:00.000Z');
    const secondMiss = await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        observedAt: secondObservedAt,
    });
    assert.equal(secondMiss.status, 'recorded');
    const released =
        await releaseStripeCheckoutAttemptAfterReconciliationMisses({
            attemptId: snapshot.attemptId,
            cartId: cart.id,
            missBefore: new Date(secondObservedAt.getTime() - 60 * 60 * 1000),
            now: secondObservedAt,
        });
    assert.equal(released.status, 'released');
    assert.equal(await getActiveStripeCheckoutAttempt(cart.id), undefined);

    const repeatedRelease =
        await releaseStripeCheckoutAttemptAfterReconciliationMisses({
            attemptId: snapshot.attemptId,
            cartId: cart.id,
            missBefore: new Date(secondObservedAt.getTime() - 60 * 60 * 1000),
            now: secondObservedAt,
        });
    assert.deepEqual(repeatedRelease, {
        releaseReason: 'expired',
        status: 'already_released',
    });

    const attemptEvents = await storage()
        .select({ type: events.type })
        .from(events)
        .where(eq(events.aggregateId, `shoppingCart:${cart.id.toString()}`));
    assert.equal(
        attemptEvents.filter(
            (event) =>
                event.type === 'checkout.stripeAttempt.reconciliationMiss',
        ).length,
        2,
    );
    assert.equal(
        attemptEvents.filter(
            (event) => event.type === 'checkout.stripeAttempt.released',
        ).length,
        1,
    );
});

test('reconciliation never releases an unbound attempt without a session deadline', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    snapshot.stripeSession.expiresAt = null;
    await createStripeCheckoutAttempt(snapshot, { accountId });
    const firstObservedAt = new Date('2026-08-03T10:00:00.000Z');
    const secondObservedAt = new Date('2026-08-03T12:00:00.000Z');
    await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        observedAt: firstObservedAt,
    });
    await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        observedAt: secondObservedAt,
    });

    assert.deepEqual(
        await releaseStripeCheckoutAttemptAfterReconciliationMisses({
            attemptId: snapshot.attemptId,
            cartId: cart.id,
            missBefore: new Date(secondObservedAt.getTime() - 60 * 60 * 1000),
            now: secondObservedAt,
        }),
        { status: 'null_deadline' },
    );
    assert.ok(await getActiveStripeCheckoutAttempt(cart.id));
});

test('reconciliation never releases an unbound attempt before its session deadline', async () => {
    createTestDb();
    const { accountId, cart } = await createCartWithItem();
    const snapshot = snapshotFromCart(cart);
    snapshot.stripeSession.expiresAt = '2030-01-01T00:00:00.000Z';
    await createStripeCheckoutAttempt(snapshot, { accountId });
    const observedAt = new Date('2026-08-03T12:00:00.000Z');
    await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        observedAt,
    });

    const result = await releaseStripeCheckoutAttemptAfterReconciliationMisses({
        attemptId: snapshot.attemptId,
        cartId: cart.id,
        missBefore: new Date(observedAt.getTime() - 60 * 60 * 1000),
        now: observedAt,
    });
    assert.equal(result.status, 'not_expired');
    if (result.status === 'not_expired') {
        assert.equal(
            result.expiresAt.toISOString(),
            '2030-01-01T00:00:00.000Z',
        );
    }
    assert.ok(await getActiveStripeCheckoutAttempt(cart.id));
});
