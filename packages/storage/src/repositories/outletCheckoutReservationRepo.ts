import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { outletOfferReservations, outletOffers } from '../schema';
import type { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];

export type CheckoutOutletReservationExpectation = {
    cartItemId: number;
    comparePriceCents: number | null;
    expiresAt?: string;
    id: number;
    initialPlantStatus: string;
    offerId: number;
    plantSortId: string;
    priceCents: number;
    quantity: number;
    sowingDate: string;
    statuses: readonly ('converted' | 'held')[];
};

export async function getCheckoutOutletReservationConflict(
    {
        accountId,
        cartId,
        cartItemIds,
        expectations,
        now,
        requireActiveHolds = true,
    }: {
        accountId: string;
        cartId: number;
        cartItemIds: readonly number[];
        expectations: readonly CheckoutOutletReservationExpectation[];
        now?: Date;
        requireActiveHolds?: boolean;
    },
    db: TransactionClient,
) {
    const uniqueCartItemIds = [...new Set(cartItemIds)];
    const uniqueOfferIds = [
        ...new Set(expectations.map((expectation) => expectation.offerId)),
    ];
    const offers =
        uniqueOfferIds.length > 0
            ? await db
                  .select()
                  .from(outletOffers)
                  .where(inArray(outletOffers.id, uniqueOfferIds))
                  .orderBy(asc(outletOffers.id))
                  .for('update')
            : [];
    const reservations =
        uniqueCartItemIds.length > 0
            ? await db
                  .select()
                  .from(outletOfferReservations)
                  .where(
                      and(
                          inArray(
                              outletOfferReservations.cartItemId,
                              uniqueCartItemIds,
                          ),
                          ne(outletOfferReservations.status, 'released'),
                      ),
                  )
                  .orderBy(asc(outletOfferReservations.id))
                  .for('update')
            : [];
    // Callers that do not inject a deterministic test time must validate
    // expiry after every offer and reservation lock wait has completed.
    const activeHoldValidationTime = now ?? new Date();

    if (reservations.length !== expectations.length) {
        return 'outlet_reservation_membership_changed' as const;
    }

    const reservationsById = new Map(
        reservations.map((reservation) => [reservation.id, reservation]),
    );
    const offersById = new Map(offers.map((offer) => [offer.id, offer]));
    for (const expected of expectations) {
        const reservation = reservationsById.get(expected.id);
        const offer = offersById.get(expected.offerId);
        if (
            !reservation ||
            !offer ||
            reservation.accountId !== accountId ||
            reservation.cartId !== cartId ||
            reservation.cartItemId !== expected.cartItemId ||
            reservation.outletOfferId !== expected.offerId ||
            reservation.quantity !== expected.quantity ||
            !(
                (reservation.status === 'held' &&
                    expected.statuses.includes('held')) ||
                (reservation.status === 'converted' &&
                    expected.statuses.includes('converted'))
            ) ||
            reservation.heldOutletPriceCents !== expected.priceCents ||
            reservation.heldComparePriceCents !== expected.comparePriceCents ||
            reservation.heldSowingDate.toISOString() !== expected.sowingDate ||
            reservation.heldInitialPlantStatus !==
                expected.initialPlantStatus ||
            offer.plantSortId.toString() !== expected.plantSortId
        ) {
            return 'outlet_reservation_changed' as const;
        }
        if (
            requireActiveHolds &&
            reservation.status === 'held' &&
            (reservation.holdExpiresAt.getTime() <=
                activeHoldValidationTime.getTime() ||
                offer.isDeleted ||
                offer.status !== 'published' ||
                offer.startAt.getTime() > activeHoldValidationTime.getTime() ||
                offer.endAt.getTime() <= activeHoldValidationTime.getTime() ||
                (expected.expiresAt !== undefined &&
                    reservation.holdExpiresAt.getTime() <
                        new Date(expected.expiresAt).getTime()))
        ) {
            return 'outlet_reservation_inactive' as const;
        }
    }

    return undefined;
}

export async function releaseOutletReservationsForCheckoutAttempt(
    cartId: number,
    reservationIds: readonly number[],
    now = new Date(),
    db: TransactionClient,
) {
    const uniqueReservationIds = [...new Set(reservationIds)].sort(
        (left, right) => left - right,
    );
    if (uniqueReservationIds.length === 0) {
        return;
    }
    const lockedReservations = await db
        .select({ id: outletOfferReservations.id })
        .from(outletOfferReservations)
        .where(
            and(
                eq(outletOfferReservations.cartId, cartId),
                inArray(outletOfferReservations.id, uniqueReservationIds),
                eq(outletOfferReservations.status, 'held'),
            ),
        )
        .orderBy(asc(outletOfferReservations.id))
        .for('update');
    if (lockedReservations.length === 0) {
        return;
    }
    await db
        .update(outletOfferReservations)
        .set({ status: 'released', releasedAt: now })
        .where(
            and(
                eq(outletOfferReservations.cartId, cartId),
                inArray(
                    outletOfferReservations.id,
                    lockedReservations.map((reservation) => reservation.id),
                ),
                eq(outletOfferReservations.status, 'held'),
            ),
        );
}
