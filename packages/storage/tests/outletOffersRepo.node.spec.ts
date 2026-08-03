import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    assignStripeCustomerId,
    bindStripeCheckoutAttempt,
    cleanupOutletLifecycle,
    convertOutletReservationForCartItem,
    createEntity,
    createOutletOffer,
    createStripeCheckoutAttempt,
    expireOutletReservations,
    fingerprintStripeCheckoutValue,
    getActiveStripeCheckoutAttempt,
    getOrCreateShoppingCart,
    getOutletOffer,
    getOutletOfferReservation,
    getOutletOffers,
    getShoppingCart,
    OutletOfferIdentityImmutableError,
    OutletOfferUnavailableError,
    recordStripeCheckoutAttemptReconciliationMiss,
    releaseOutletReservationForCartItem,
    releaseStripeCheckoutAttempt,
    releaseStripeCheckoutAttemptAfterReconciliationMisses,
    reserveOutletOffer,
    StripeCheckoutAttemptConflictError,
    type StripeCheckoutAttemptSnapshot,
    setCartItemPaid,
    storage,
    updateEntity,
    updateOutletOffer,
    upsertEntityType,
    upsertOrRemoveCartItem,
    upsertOrRemoveCartItemWithOutletReservation,
    verifyStripeCheckoutAttemptLiveCart,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { events, outletOfferReservations, outletOffers } from '../src/schema';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createTestPlantSort() {
    const entityTypeName = `outlet-plant-sort-${randomUUID()}`;
    await upsertEntityType({
        name: entityTypeName,
        label: 'Outlet Plant Sort',
    });

    const entityId = await createEntity(entityTypeName);
    await updateEntity({
        id: entityId,
        entityTypeName,
        state: 'published',
    });

    return entityId;
}

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

async function createCartItem(accountId: string, plantSortId: number) {
    await assignStripeCustomerId(accountId, 'cus_outlet');
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart, 'Cart should be created');

    const cartItemId = await upsertOrRemoveCartItem(
        null,
        cart.id,
        String(plantSortId),
        'plantSort',
        1,
        undefined,
        undefined,
        undefined,
        null,
        'eur',
        true,
    );
    assert.ok(cartItemId, 'Cart item should be created');

    return {
        cart,
        cartItemId,
    };
}

async function createPublishedOffer({
    plantSortId,
    quantity = 1,
    now = new Date('2026-05-01T10:00:00.000Z'),
}: {
    plantSortId: number;
    quantity?: number;
    now?: Date;
}) {
    return createOutletOffer({
        plantSortId,
        sowingDate: new Date('2026-04-01T00:00:00.000Z'),
        initialPlantStatus: 'sprouted',
        imageUrls: ['https://gredice.test/outlet.png'],
        outletPriceCents: 199,
        comparePriceCents: 349,
        quantity,
        startAt: addMinutes(now, -60),
        endAt: addMinutes(now, 60),
        status: 'published',
        adminNotes: null,
    });
}

function outletAttemptSnapshot({
    cartId,
    cartItemId,
    entityId,
    reservation,
}: {
    cartId: number;
    cartItemId: number;
    entityId: string;
    reservation: NonNullable<
        Awaited<ReturnType<typeof getOutletOfferReservation>>
    >;
}): StripeCheckoutAttemptSnapshot {
    const attemptId = randomUUID();
    return {
        attemptId,
        cartId,
        expectedNonStripeCartItemIds: [],
        harvestDates: [],
        items: [
            {
                additionalDataFingerprint: fingerprintStripeCheckoutValue(null),
                amount: 1,
                cartId,
                checkoutAdditionalDataFingerprint:
                    fingerprintStripeCheckoutValue({}),
                currency: 'eur',
                entityId,
                entityTypeName: 'plantSort',
                gardenId: null,
                id: cartItemId,
                outlet: {
                    comparePriceCents: reservation.heldComparePriceCents,
                    initialPlantStatus: reservation.heldInitialPlantStatus,
                    offerId: reservation.outletOfferId,
                    priceCents: reservation.heldOutletPriceCents,
                    reservationId: reservation.id,
                    sowingDate: reservation.heldSowingDate.toISOString(),
                },
                paymentAmount: reservation.heldOutletPriceCents,
                paymentKind: 'stripe',
                positionIndex: null,
                raisedBedId: null,
                status: 'new',
            },
        ],
        stripeSession: {
            allowPromotionCodes: true,
            customerFingerprint: fingerprintStripeCheckoutValue('cus_outlet'),
            expiresAt: reservation.holdExpiresAt.toISOString(),
            items: [
                {
                    cartItemId,
                    price: {
                        currency: 'eur',
                        valueInCents: reservation.heldOutletPriceCents,
                    },
                    product: { name: 'Outlet item' },
                    quantity: 1,
                },
            ],
            returnUrls: {
                cancel: 'https://example.test/cancel',
                success: 'https://example.test/success',
            },
        },
        userFingerprint: fingerprintStripeCheckoutValue('user-outlet'),
        version: 1,
    };
}

test('getOutletOffers returns active published offers with remaining stock', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const activeOfferId = await createPublishedOffer({
        plantSortId,
        quantity: 2,
        now,
    });
    await createOutletOffer({
        plantSortId,
        sowingDate: new Date('2026-04-01T00:00:00.000Z'),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 199,
        comparePriceCents: null,
        quantity: 1,
        startAt: addMinutes(now, -60),
        endAt: addMinutes(now, 60),
        status: 'draft',
        adminNotes: null,
    });
    await createOutletOffer({
        plantSortId,
        sowingDate: new Date('2026-04-01T00:00:00.000Z'),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 199,
        comparePriceCents: null,
        quantity: 1,
        startAt: addMinutes(now, -120),
        endAt: addMinutes(now, -60),
        status: 'published',
        adminNotes: null,
    });

    const offers = await getOutletOffers({ now });

    assert.deepEqual(
        offers.map((offer) => offer.id),
        [activeOfferId],
    );
    assert.equal(offers[0]?.remainingQuantity, 2);
    assert.equal(offers[0]?.reservedQuantity, 0);
    assert.equal(offers[0]?.soldQuantity, 0);
});

test('reserveOutletOffer creates a held reservation and blocks overselling', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);

    const reservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    assert.equal(reservation.outletOfferId, offerId);
    assert.equal(reservation.cartItemId, cartItemId);
    assert.equal(reservation.status, 'held');
    assert.equal(
        reservation.holdExpiresAt.toISOString(),
        addMinutes(now, 15).toISOString(),
    );

    const offer = await getOutletOffer(offerId, now);
    assert.equal(offer?.remainingQuantity, 0);
    assert.equal(offer?.reservedQuantity, 1);

    const otherAccountId = await createTestAccount();
    const otherCartItem = await createCartItem(otherAccountId, plantSortId);
    await assert.rejects(
        () =>
            reserveOutletOffer({
                offerId,
                accountId: otherAccountId,
                cartId: otherCartItem.cart.id,
                cartItemId: otherCartItem.cartItemId,
                now,
            }),
        OutletOfferUnavailableError,
    );
});

test('opposite outlet switches lock offers and reservations canonically', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const switchedAt = addMinutes(now, 1);
    const plantSortId = await createTestPlantSort();
    const firstOfferId = await createPublishedOffer({
        plantSortId,
        quantity: 2,
        now,
    });
    const secondOfferId = await createPublishedOffer({
        plantSortId,
        quantity: 2,
        now,
    });
    const firstAccountId = await createTestAccount();
    const secondAccountId = await createTestAccount();
    const firstCartItem = await createCartItem(firstAccountId, plantSortId);
    const secondCartItem = await createCartItem(secondAccountId, plantSortId);
    const [firstReservation, secondReservation] = await Promise.all([
        reserveOutletOffer({
            accountId: firstAccountId,
            cartId: firstCartItem.cart.id,
            cartItemId: firstCartItem.cartItemId,
            now,
            offerId: firstOfferId,
        }),
        reserveOutletOffer({
            accountId: secondAccountId,
            cartId: secondCartItem.cart.id,
            cartItemId: secondCartItem.cartItemId,
            now,
            offerId: secondOfferId,
        }),
    ]);

    const [firstSwitch, secondSwitch] = await Promise.all([
        reserveOutletOffer({
            accountId: firstAccountId,
            cartId: firstCartItem.cart.id,
            cartItemId: firstCartItem.cartItemId,
            now: switchedAt,
            offerId: secondOfferId,
        }),
        reserveOutletOffer({
            accountId: secondAccountId,
            cartId: secondCartItem.cart.id,
            cartItemId: secondCartItem.cartItemId,
            now: switchedAt,
            offerId: firstOfferId,
        }),
    ]);

    assert.equal(firstSwitch.outletOfferId, secondOfferId);
    assert.equal(secondSwitch.outletOfferId, firstOfferId);
    assert.equal(
        (await getOutletOfferReservation(firstReservation.id))?.status,
        'released',
    );
    assert.equal(
        (await getOutletOfferReservation(secondReservation.id))?.status,
        'released',
    );
    const [firstOffer, secondOffer] = await Promise.all([
        getOutletOffer(firstOfferId, switchedAt),
        getOutletOffer(secondOfferId, switchedAt),
    ]);
    assert.equal(firstOffer?.reservedQuantity, 1);
    assert.equal(firstOffer?.remainingQuantity, 1);
    assert.equal(secondOffer?.reservedQuantity, 1);
    assert.equal(secondOffer?.remainingQuantity, 1);
});

test('checkout rechecks outlet hold expiry after waiting for the offer lock', {
    skip: process.env.GREDICE_TEST_DB_PROVIDER === 'pglite',
}, async (t) => {
    createTestDb();
    const heldAt = new Date('2026-05-01T10:00:00.000Z');
    const checkoutStartedAt = addMinutes(heldAt, 14);
    const reallocatedAt = new Date(addMinutes(heldAt, 15).getTime() + 1);
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now: heldAt });
    const firstAccountId = await createTestAccount();
    const firstCartItem = await createCartItem(firstAccountId, plantSortId);
    const firstReservation = await reserveOutletOffer({
        accountId: firstAccountId,
        cartId: firstCartItem.cart.id,
        cartItemId: firstCartItem.cartItemId,
        now: heldAt,
        offerId,
    });
    const firstAttempt = outletAttemptSnapshot({
        cartId: firstCartItem.cart.id,
        cartItemId: firstCartItem.cartItemId,
        entityId: plantSortId.toString(),
        reservation: firstReservation,
    });
    const secondAccountId = await createTestAccount();
    const secondCartItem = await createCartItem(secondAccountId, plantSortId);

    let signalOfferLocked: (() => void) | undefined;
    const offerLocked = new Promise<void>((resolve) => {
        signalOfferLocked = resolve;
    });
    let releaseOfferLock: (() => void) | undefined;
    const holdOfferLock = new Promise<void>((resolve) => {
        releaseOfferLock = resolve;
    });
    const reallocation = storage().transaction(async (tx) => {
        await tx
            .select({ id: outletOffers.id })
            .from(outletOffers)
            .where(eq(outletOffers.id, offerId))
            .for('update');
        signalOfferLocked?.();
        await holdOfferLock;
        return reserveOutletOffer({
            accountId: secondAccountId,
            cartId: secondCartItem.cart.id,
            cartItemId: secondCartItem.cartItemId,
            db: tx,
            now: reallocatedAt,
            offerId,
        });
    });
    await offerLocked;

    t.mock.timers.enable({ apis: ['Date'], now: checkoutStartedAt });
    const rejectedAttempt = assert.rejects(
        createStripeCheckoutAttempt(firstAttempt, {
            accountId: firstAccountId,
        }),
        (error) => {
            assert.ok(error instanceof StripeCheckoutAttemptConflictError);
            assert.equal(error.category, 'outlet_reservation_inactive');
            return true;
        },
    );
    t.mock.timers.setTime(reallocatedAt.getTime());
    releaseOfferLock?.();

    const secondReservation = await reallocation;
    await rejectedAttempt;
    assert.equal(secondReservation.cartItemId, secondCartItem.cartItemId);
    assert.equal(
        await getActiveStripeCheckoutAttempt(firstCartItem.cart.id),
        undefined,
    );
    const offer = await getOutletOffer(offerId, reallocatedAt);
    assert.equal(offer?.reservedQuantity, 1);
    assert.equal(offer?.remainingQuantity, 0);
});

test('stale attempt release cannot release a later attempt reservation', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const firstReservation = await reserveOutletOffer({
        accountId,
        cartId: cart.id,
        cartItemId,
        offerId,
        now,
    });
    const firstAttempt = outletAttemptSnapshot({
        cartId: cart.id,
        cartItemId,
        entityId: plantSortId.toString(),
        reservation: firstReservation,
    });
    await createStripeCheckoutAttempt(firstAttempt, { accountId, now });
    await releaseStripeCheckoutAttempt({
        attemptId: firstAttempt.attemptId,
        cartId: cart.id,
        reason: 'cancelled',
        sessionId: null,
    });
    assert.equal(
        (await getOutletOfferReservation(firstReservation.id))?.status,
        'released',
    );

    const secondReservation = await reserveOutletOffer({
        accountId,
        cartId: cart.id,
        cartItemId,
        offerId,
        now: addMinutes(now, 1),
    });
    assert.notEqual(secondReservation.id, firstReservation.id);
    const secondAttempt = outletAttemptSnapshot({
        cartId: cart.id,
        cartItemId,
        entityId: plantSortId.toString(),
        reservation: secondReservation,
    });
    await createStripeCheckoutAttempt(secondAttempt, {
        accountId,
        now: addMinutes(now, 1),
    });

    await releaseStripeCheckoutAttempt({
        attemptId: firstAttempt.attemptId,
        cartId: cart.id,
        reason: 'expired',
        sessionId: null,
    });
    assert.equal(
        (await getOutletOfferReservation(secondReservation.id))?.status,
        'held',
    );
});

test('orphan reconciliation releases only the reservation captured by the attempt snapshot', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({
        plantSortId,
        quantity: 3,
        now,
    });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const attemptReservation = await reserveOutletOffer({
        accountId,
        cartId: cart.id,
        cartItemId,
        offerId,
        now,
    });
    const attempt = outletAttemptSnapshot({
        cartId: cart.id,
        cartItemId,
        entityId: plantSortId.toString(),
        reservation: attemptReservation,
    });
    await createStripeCheckoutAttempt(attempt, { accountId, now });

    const [unrelatedReservation] = await storage()
        .insert(outletOfferReservations)
        .values({
            accountId,
            cartId: cart.id,
            cartItemId,
            heldComparePriceCents: attemptReservation.heldComparePriceCents,
            heldInitialPlantStatus: attemptReservation.heldInitialPlantStatus,
            heldOutletPriceCents: attemptReservation.heldOutletPriceCents,
            heldSowingDate: attemptReservation.heldSowingDate,
            holdExpiresAt: addMinutes(now, 120),
            outletOfferId: offerId,
            quantity: 1,
            status: 'held',
        })
        .returning();
    assert.ok(unrelatedReservation);

    const firstObservedAt = addMinutes(attemptReservation.holdExpiresAt, 1);
    await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: attempt.attemptId,
        cartId: cart.id,
        observedAt: firstObservedAt,
    });
    await storage()
        .update(events)
        .set({ createdAt: firstObservedAt })
        .where(
            and(
                eq(events.aggregateId, `shoppingCart:${cart.id.toString()}`),
                eq(events.type, 'checkout.stripeAttempt.reconciliationMiss'),
            ),
        );
    const secondObservedAt = addMinutes(firstObservedAt, 61);
    await recordStripeCheckoutAttemptReconciliationMiss({
        attemptId: attempt.attemptId,
        cartId: cart.id,
        observedAt: secondObservedAt,
    });
    const result = await releaseStripeCheckoutAttemptAfterReconciliationMisses({
        attemptId: attempt.attemptId,
        cartId: cart.id,
        missBefore: addMinutes(secondObservedAt, -60),
        now: secondObservedAt,
    });

    assert.equal(result.status, 'released');
    assert.equal(
        (await getOutletOfferReservation(attemptReservation.id))?.status,
        'released',
    );
    assert.equal(
        (await getOutletOfferReservation(unrelatedReservation.id))?.status,
        'held',
    );
});

test('checkout rejects an outlet switch and active attempt fences later reservations', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const firstOfferId = await createPublishedOffer({
        plantSortId,
        quantity: 2,
        now,
    });
    const secondOfferId = await createPublishedOffer({
        plantSortId,
        quantity: 1,
        now,
    });
    const otherPlantSortId = await createTestPlantSort();
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const firstReservation = await reserveOutletOffer({
        accountId,
        cartId: cart.id,
        cartItemId,
        holdMinutes: 31,
        now,
        offerId: firstOfferId,
    });
    await assert.rejects(
        () =>
            updateOutletOffer(firstOfferId, {
                plantSortId: otherPlantSortId,
            }),
        OutletOfferIdentityImmutableError,
    );
    const staleAttempt = outletAttemptSnapshot({
        cartId: cart.id,
        cartItemId,
        entityId: plantSortId.toString(),
        reservation: firstReservation,
    });
    const switchedAt = addMinutes(now, 1);
    const secondReservation = await reserveOutletOffer({
        accountId,
        cartId: cart.id,
        cartItemId,
        holdMinutes: 31,
        now: switchedAt,
        offerId: secondOfferId,
    });

    await assert.rejects(
        () =>
            createStripeCheckoutAttempt(staleAttempt, {
                accountId,
                now: switchedAt,
            }),
        (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /outlet_reservation/u);
            return true;
        },
    );

    const currentAttempt = outletAttemptSnapshot({
        cartId: cart.id,
        cartItemId,
        entityId: plantSortId.toString(),
        reservation: secondReservation,
    });
    await createStripeCheckoutAttempt(currentAttempt, {
        accountId,
        now: switchedAt,
    });
    await assert.rejects(
        () =>
            reserveOutletOffer({
                accountId,
                cartId: cart.id,
                cartItemId,
                holdMinutes: 31,
                now: addMinutes(switchedAt, 1),
                offerId: firstOfferId,
            }),
        /active Stripe checkout attempt/u,
    );
    await assert.rejects(
        () => releaseOutletReservationForCartItem(cartItemId),
        /active Stripe checkout attempt/u,
    );
    const delayedWebhookAt = new Date(
        secondReservation.holdExpiresAt.getTime() + 1,
    );
    const protectedOffer = await getOutletOffer(
        secondOfferId,
        delayedWebhookAt,
    );
    assert.equal(protectedOffer?.reservedQuantity, 1);
    assert.equal(protectedOffer?.remainingQuantity, 0);
    const otherAccountId = await createTestAccount();
    const otherCartItem = await createCartItem(otherAccountId, plantSortId);
    await assert.rejects(
        () =>
            reserveOutletOffer({
                accountId: otherAccountId,
                cartId: otherCartItem.cart.id,
                cartItemId: otherCartItem.cartItemId,
                now: delayedWebhookAt,
                offerId: secondOfferId,
            }),
        OutletOfferUnavailableError,
    );
    const releasedAtExpiry = await expireOutletReservations(delayedWebhookAt);
    assert.equal(releasedAtExpiry.includes(secondReservation.id), false);
    assert.equal(
        (await getOutletOfferReservation(secondReservation.id))?.status,
        'held',
    );
    await bindStripeCheckoutAttempt({
        attemptId: currentAttempt.attemptId,
        cartId: cart.id,
        sessionId: 'cs_delayed_outlet',
    });
    assert.equal(
        (
            await convertOutletReservationForCartItem(
                cartItemId,
                delayedWebhookAt,
            )
        ).status,
        'converted',
    );
    const fulfillmentCommittedAttempt = await getActiveStripeCheckoutAttempt(
        cart.id,
    );
    assert.ok(fulfillmentCommittedAttempt);
    await verifyStripeCheckoutAttemptLiveCart(fulfillmentCommittedAttempt);
    await setCartItemPaid(cartItemId);
    const resumableAttempt = await getActiveStripeCheckoutAttempt(cart.id);
    assert.ok(resumableAttempt);
    await verifyStripeCheckoutAttemptLiveCart(resumableAttempt);
});

test('outlet cart upsert rolls back when reservation fails', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);

    await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    const otherAccountId = await createTestAccount();
    const otherCart = await getOrCreateShoppingCart(otherAccountId);
    assert.ok(otherCart, 'Cart should be created');

    await assert.rejects(
        () =>
            upsertOrRemoveCartItemWithOutletReservation({
                cartId: otherCart.id,
                entityId: plantSortId.toString(),
                entityTypeName: 'plantSort',
                amount: 1,
                currency: 'eur',
                forceCreate: true,
                outletOfferId: offerId,
                accountId: otherAccountId,
                now,
            }),
        OutletOfferUnavailableError,
    );

    const rolledBackCart = await getShoppingCart(otherCart.id);
    assert.deepEqual(rolledBackCart?.items ?? [], []);
});

test('reserveOutletOffer refreshes an existing reservation without double-counting stock', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const refreshedAt = addMinutes(now, 5);
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);

    const firstReservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });
    const refreshedReservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now: refreshedAt,
    });

    assert.equal(refreshedReservation.id, firstReservation.id);
    assert.equal(
        refreshedReservation.holdExpiresAt.toISOString(),
        addMinutes(refreshedAt, 15).toISOString(),
    );

    const offer = await getOutletOffer(offerId, refreshedAt);
    assert.equal(offer?.remainingQuantity, 0);
    assert.equal(offer?.reservedQuantity, 1);
});

test('expired outlet holds are ignored and can be released in bulk', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const later = addMinutes(now, 16);
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const reservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    const offer = await getOutletOffer(offerId, later);
    assert.equal(offer?.remainingQuantity, 1);
    assert.equal(offer?.reservedQuantity, 0);

    const releasedIds = await expireOutletReservations(later);
    assert.ok(releasedIds.includes(reservation.id));

    const releasedReservation = await getOutletOfferReservation(reservation.id);
    assert.equal(releasedReservation?.status, 'released');
    assert.equal(
        releasedReservation?.releasedAt?.toISOString(),
        later.toISOString(),
    );
});

test('cleanupOutletLifecycle releases expired holds and closes expired offers', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const later = addMinutes(now, 61);
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const secondOfferId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const reservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    const cleanup = await cleanupOutletLifecycle(later);

    assert.ok(cleanup.releasedReservationIds.includes(reservation.id));
    assert.ok(cleanup.closedOfferIds.includes(offerId));
    assert.ok(cleanup.closedOfferIds.includes(secondOfferId));
    assert.deepEqual(
        cleanup.closedOfferIds,
        [...cleanup.closedOfferIds].sort((left, right) => left - right),
    );

    const releasedReservation = await getOutletOfferReservation(reservation.id);
    const closedOffer = await getOutletOffer(offerId, later);
    const secondClosedOffer = await getOutletOffer(secondOfferId, later);
    assert.equal(releasedReservation?.status, 'released');
    assert.equal(closedOffer?.status, 'closed');
    assert.equal(secondClosedOffer?.status, 'closed');
});

test('removing a cart item releases its outlet reservation', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const reservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    await upsertOrRemoveCartItem(
        cartItemId,
        cart.id,
        String(plantSortId),
        'plantSort',
        0,
    );

    const releasedReservation = await getOutletOfferReservation(reservation.id);
    assert.equal(releasedReservation?.status, 'released');

    const offer = await getOutletOffer(offerId, now);
    assert.equal(offer?.remainingQuantity, 1);
});

test('converting an outlet reservation is idempotent and keeps held snapshots', async () => {
    createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const reservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    await updateOutletOffer(offerId, {
        outletPriceCents: 249,
        comparePriceCents: 399,
        sowingDate: new Date('2026-04-15T00:00:00.000Z'),
    });
    await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now: addMinutes(now, 1),
        holdMinutes: 30,
    });

    const convertedReservation = await convertOutletReservationForCartItem(
        cartItemId,
        addMinutes(now, 2),
    );
    const secondConversion = await convertOutletReservationForCartItem(
        cartItemId,
        addMinutes(now, 3),
    );

    assert.equal(convertedReservation.id, reservation.id);
    assert.equal(convertedReservation.status, 'converted');
    assert.equal(secondConversion.id, reservation.id);
    assert.equal(secondConversion.status, 'converted');
    assert.equal(convertedReservation.heldOutletPriceCents, 199);
    assert.equal(convertedReservation.heldComparePriceCents, 349);
    assert.equal(
        convertedReservation.heldSowingDate.toISOString(),
        '2026-04-01T00:00:00.000Z',
    );

    const offer = await getOutletOffer(offerId, addMinutes(now, 2));
    assert.equal(offer?.remainingQuantity, 0);
    assert.equal(offer?.soldQuantity, 1);
});

test('outlet conversion rolls back with a failed planting transaction and remains retryable', async () => {
    const db = createTestDb();
    const now = new Date('2026-05-01T10:00:00.000Z');
    const plantSortId = await createTestPlantSort();
    const offerId = await createPublishedOffer({ plantSortId, now });
    const accountId = await createTestAccount();
    const { cart, cartItemId } = await createCartItem(accountId, plantSortId);
    const reservation = await reserveOutletOffer({
        offerId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });

    await assert.rejects(
        db.transaction(async (transaction) => {
            await convertOutletReservationForCartItem(
                cartItemId,
                addMinutes(now, 1),
                transaction,
            );
            throw new Error('simulated plant event insert failure');
        }),
        /simulated plant event insert failure/,
    );

    const rolledBackReservation = await getOutletOfferReservation(
        reservation.id,
    );
    assert.equal(rolledBackReservation?.status, 'held');

    const retriedReservation = await db.transaction((transaction) =>
        convertOutletReservationForCartItem(
            cartItemId,
            addMinutes(now, 2),
            transaction,
        ),
    );
    assert.equal(retriedReservation.status, 'converted');
});
