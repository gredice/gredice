import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    cleanupOutletLifecycle,
    convertOutletReservationForCartItem,
    createEntity,
    createOutletOffer,
    expireOutletReservations,
    getOrCreateShoppingCart,
    getOutletOffer,
    getOutletOfferReservation,
    getOutletOffers,
    getShoppingCart,
    OutletOfferUnavailableError,
    reserveOutletOffer,
    updateEntity,
    updateOutletOffer,
    upsertEntityType,
    upsertOrRemoveCartItem,
    upsertOrRemoveCartItemWithOutletReservation,
} from '@gredice/storage';
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

    const releasedReservation = await getOutletOfferReservation(reservation.id);
    const closedOffer = await getOutletOffer(offerId, later);
    assert.equal(releasedReservation?.status, 'released');
    assert.equal(closedOffer?.status, 'closed');
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
