import { and, eq, gt, inArray, lte, ne, sql } from 'drizzle-orm';
import {
    type InsertOutletOffer,
    type OutletOfferReservationStatus,
    type OutletOfferStatus,
    outletOfferReservations,
    outletOffers,
    type SelectOutletOffer,
    type SelectOutletOfferReservation,
} from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

export const OUTLET_RESERVATION_HOLD_MINUTES = 15;

export class OutletOfferUnavailableError extends Error {
    constructor(message = 'Outlet offer is not available.') {
        super(message);
        this.name = 'OutletOfferUnavailableError';
    }
}

export class OutletReservationUnavailableError extends Error {
    constructor(message = 'Outlet reservation is not available.') {
        super(message);
        this.name = 'OutletReservationUnavailableError';
    }
}

type ReserveOutletOfferOptions = {
    offerId: number;
    accountId: string;
    cartId: number;
    cartItemId: number;
    quantity?: number;
    now?: Date;
    holdMinutes?: number;
    db?: TransactionClient;
};

export type OutletOfferWithAvailability = SelectOutletOffer & {
    reservedQuantity: number;
    soldQuantity: number;
    remainingQuantity: number;
};

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

function activeOfferWhere(now: Date) {
    return and(
        eq(outletOffers.isDeleted, false),
        eq(outletOffers.status, 'published'),
        lte(outletOffers.startAt, now),
        gt(outletOffers.endAt, now),
    );
}

function activeHeldReservationWhere(now: Date) {
    return and(
        eq(outletOfferReservations.status, 'held'),
        gt(outletOfferReservations.holdExpiresAt, now),
    );
}

function countQuantity(
    reservations: Pick<
        SelectOutletOfferReservation,
        'quantity' | 'status' | 'holdExpiresAt'
    >[],
    now: Date,
    status: OutletOfferReservationStatus,
) {
    return reservations.reduce((sum, reservation) => {
        if (reservation.status !== status) {
            return sum;
        }

        if (
            status === 'held' &&
            reservation.holdExpiresAt.getTime() <= now.getTime()
        ) {
            return sum;
        }

        return sum + reservation.quantity;
    }, 0);
}

function withAvailability(
    offer: SelectOutletOffer,
    reservations: Pick<
        SelectOutletOfferReservation,
        'quantity' | 'status' | 'holdExpiresAt'
    >[],
    now: Date,
): OutletOfferWithAvailability {
    const reservedQuantity = countQuantity(reservations, now, 'held');
    const soldQuantity = countQuantity(reservations, now, 'converted');
    return {
        ...offer,
        reservedQuantity,
        soldQuantity,
        remainingQuantity: Math.max(
            0,
            offer.quantity - reservedQuantity - soldQuantity,
        ),
    };
}

async function getReservationsForOfferIds(
    offerIds: number[],
    db: DatabaseClient = storage(),
) {
    if (offerIds.length === 0) {
        return [];
    }

    return db.query.outletOfferReservations.findMany({
        where: inArray(outletOfferReservations.outletOfferId, offerIds),
    });
}

export async function createOutletOffer(
    data: Omit<
        InsertOutletOffer,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
    db: DatabaseClient = storage(),
) {
    const [created] = await db
        .insert(outletOffers)
        .values(data)
        .returning({ id: outletOffers.id });

    return created.id;
}

export async function updateOutletOffer(
    id: number,
    data: Partial<
        Omit<InsertOutletOffer, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>
    >,
    db: DatabaseClient = storage(),
) {
    await db.update(outletOffers).set(data).where(eq(outletOffers.id, id));
}

export async function getOutletOffer(
    id: number,
    now = new Date(),
    db: DatabaseClient = storage(),
) {
    const offer = await db.query.outletOffers.findFirst({
        where: and(eq(outletOffers.id, id), eq(outletOffers.isDeleted, false)),
    });
    if (!offer) {
        return null;
    }

    const reservations = await getReservationsForOfferIds([offer.id], db);
    return withAvailability(offer, reservations, now);
}

export async function getOutletOfferReservation(
    id: number,
    db: DatabaseClient = storage(),
) {
    return db.query.outletOfferReservations.findFirst({
        where: eq(outletOfferReservations.id, id),
    });
}

export async function getOutletOfferReservationForCartItem(
    cartItemId: number,
    db: DatabaseClient = storage(),
) {
    return db.query.outletOfferReservations.findFirst({
        where: and(
            eq(outletOfferReservations.cartItemId, cartItemId),
            ne(outletOfferReservations.status, 'released'),
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
        with: {
            outletOffer: true,
        },
    });
}

export async function getOutletOfferReservationsForOffer(
    offerId: number,
    db: DatabaseClient = storage(),
) {
    return db.query.outletOfferReservations.findMany({
        where: eq(outletOfferReservations.outletOfferId, offerId),
        orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });
}

export async function getOutletOfferReservationsForCartItems(
    cartItemIds: number[],
    db: DatabaseClient = storage(),
) {
    if (cartItemIds.length === 0) {
        return [];
    }

    return db.query.outletOfferReservations.findMany({
        where: and(
            inArray(outletOfferReservations.cartItemId, cartItemIds),
            ne(outletOfferReservations.status, 'released'),
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
        with: {
            outletOffer: true,
        },
    });
}

export async function getOutletOffers({
    includeUnavailable = false,
    statuses,
    now = new Date(),
    db = storage(),
}: {
    includeUnavailable?: boolean;
    statuses?: OutletOfferStatus[];
    now?: Date;
    db?: DatabaseClient;
} = {}) {
    const offers = await db.query.outletOffers.findMany({
        where: and(
            eq(outletOffers.isDeleted, false),
            statuses?.length
                ? inArray(outletOffers.status, statuses)
                : includeUnavailable
                  ? undefined
                  : activeOfferWhere(now),
        ),
        orderBy: (table, { asc, desc }) => [
            asc(table.endAt),
            desc(table.createdAt),
        ],
        with: {
            plantSort: true,
        },
    });

    const reservations = await getReservationsForOfferIds(
        offers.map((offer) => offer.id),
        db,
    );
    const reservationsByOfferId = new Map<
        number,
        SelectOutletOfferReservation[]
    >();
    for (const reservation of reservations) {
        const offerReservations =
            reservationsByOfferId.get(reservation.outletOfferId) ?? [];
        offerReservations.push(reservation);
        reservationsByOfferId.set(reservation.outletOfferId, offerReservations);
    }

    const offersWithAvailability = offers.map((offer) =>
        withAvailability(offer, reservationsByOfferId.get(offer.id) ?? [], now),
    );

    return includeUnavailable || statuses?.length
        ? offersWithAvailability
        : offersWithAvailability.filter((offer) => offer.remainingQuantity > 0);
}

async function lockOutletOffer(
    offerId: number,
    db: TransactionClient,
): Promise<SelectOutletOffer | null> {
    const [offer] = await db
        .select()
        .from(outletOffers)
        .where(
            and(
                eq(outletOffers.id, offerId),
                eq(outletOffers.isDeleted, false),
            ),
        )
        .for('update');

    return offer ?? null;
}

async function getActiveReservedQuantity({
    offerId,
    now,
    excludeReservationId,
    db,
}: {
    offerId: number;
    now: Date;
    excludeReservationId?: number;
    db: TransactionClient;
}) {
    const [row] = await db
        .select({
            quantity: sql<number>`coalesce(sum(${outletOfferReservations.quantity}), 0)::int`,
        })
        .from(outletOfferReservations)
        .where(
            and(
                eq(outletOfferReservations.outletOfferId, offerId),
                activeHeldReservationWhere(now),
                excludeReservationId
                    ? ne(outletOfferReservations.id, excludeReservationId)
                    : undefined,
            ),
        );

    return row?.quantity ?? 0;
}

async function getConvertedQuantity({
    offerId,
    excludeReservationId,
    db,
}: {
    offerId: number;
    excludeReservationId?: number;
    db: TransactionClient;
}) {
    const [row] = await db
        .select({
            quantity: sql<number>`coalesce(sum(${outletOfferReservations.quantity}), 0)::int`,
        })
        .from(outletOfferReservations)
        .where(
            and(
                eq(outletOfferReservations.outletOfferId, offerId),
                eq(outletOfferReservations.status, 'converted'),
                excludeReservationId
                    ? ne(outletOfferReservations.id, excludeReservationId)
                    : undefined,
            ),
        );

    return row?.quantity ?? 0;
}

async function reserveOutletOfferInTransaction(
    {
        offerId,
        accountId,
        cartId,
        cartItemId,
        quantity = 1,
        now = new Date(),
        holdMinutes = OUTLET_RESERVATION_HOLD_MINUTES,
    }: ReserveOutletOfferOptions,
    tx: TransactionClient,
) {
    if (quantity <= 0) {
        throw new OutletOfferUnavailableError(
            'Outlet reservation quantity must be positive.',
        );
    }

    const offer = await lockOutletOffer(offerId, tx);
    if (!offer) {
        throw new OutletOfferUnavailableError();
    }
    if (offer.status !== 'published') {
        throw new OutletOfferUnavailableError();
    }
    if (offer.startAt.getTime() > now.getTime()) {
        throw new OutletOfferUnavailableError('Outlet offer has not started.');
    }
    if (offer.endAt.getTime() <= now.getTime()) {
        throw new OutletOfferUnavailableError('Outlet offer has expired.');
    }

    const existingReservation =
        await tx.query.outletOfferReservations.findFirst({
            where: and(
                eq(outletOfferReservations.cartItemId, cartItemId),
                ne(outletOfferReservations.status, 'released'),
            ),
            orderBy: (table, { desc }) => [
                desc(table.createdAt),
                desc(table.id),
            ],
        });

    if (existingReservation?.status === 'converted') {
        throw new OutletReservationUnavailableError(
            'Outlet reservation is already converted.',
        );
    }
    if (existingReservation && existingReservation.outletOfferId !== offerId) {
        await tx
            .update(outletOfferReservations)
            .set({ status: 'released', releasedAt: now })
            .where(eq(outletOfferReservations.id, existingReservation.id));
    }

    const reusableReservation =
        existingReservation?.outletOfferId === offerId
            ? existingReservation
            : null;
    const excludeReservationId = reusableReservation?.id;
    const [reservedQuantity, soldQuantity] = await Promise.all([
        getActiveReservedQuantity({
            offerId,
            now,
            excludeReservationId,
            db: tx,
        }),
        getConvertedQuantity({ offerId, excludeReservationId, db: tx }),
    ]);
    const remainingQuantity = offer.quantity - reservedQuantity - soldQuantity;
    if (remainingQuantity < quantity) {
        throw new OutletOfferUnavailableError('Outlet offer is sold out.');
    }

    const holdExpiresAt = addMinutes(now, holdMinutes);
    if (reusableReservation) {
        const [updated] = await tx
            .update(outletOfferReservations)
            .set({
                quantity,
                holdExpiresAt,
                status: 'held',
                releasedAt: null,
            })
            .where(eq(outletOfferReservations.id, reusableReservation.id))
            .returning();

        return updated;
    }

    const [created] = await tx
        .insert(outletOfferReservations)
        .values({
            outletOfferId: offerId,
            accountId,
            cartId,
            cartItemId,
            quantity,
            holdExpiresAt,
            status: 'held',
            heldOutletPriceCents: offer.outletPriceCents,
            heldComparePriceCents: offer.comparePriceCents,
            heldSowingDate: offer.sowingDate,
            heldInitialPlantStatus: offer.initialPlantStatus,
        })
        .returning();

    return created;
}

export async function reserveOutletOffer(options: ReserveOutletOfferOptions) {
    if (options.db) {
        return reserveOutletOfferInTransaction(options, options.db);
    }

    return storage().transaction((tx) =>
        reserveOutletOfferInTransaction(options, tx),
    );
}

export async function releaseOutletReservationForCartItem(
    cartItemId: number,
    now = new Date(),
    db: DatabaseClient = storage(),
) {
    await db
        .update(outletOfferReservations)
        .set({
            status: 'released',
            releasedAt: now,
        })
        .where(
            and(
                eq(outletOfferReservations.cartItemId, cartItemId),
                eq(outletOfferReservations.status, 'held'),
            ),
        );
}

export async function releaseOutletReservationsForCart(
    cartId: number,
    now = new Date(),
    db: DatabaseClient = storage(),
) {
    await db
        .update(outletOfferReservations)
        .set({
            status: 'released',
            releasedAt: now,
        })
        .where(
            and(
                eq(outletOfferReservations.cartId, cartId),
                eq(outletOfferReservations.status, 'held'),
            ),
        );
}

export async function convertOutletReservationForCartItem(
    cartItemId: number,
    now = new Date(),
) {
    return storage().transaction(async (tx) => {
        const reservation = await tx.query.outletOfferReservations.findFirst({
            where: and(
                eq(outletOfferReservations.cartItemId, cartItemId),
                ne(outletOfferReservations.status, 'released'),
            ),
            orderBy: (table, { desc }) => [
                desc(table.createdAt),
                desc(table.id),
            ],
        });

        if (!reservation) {
            throw new OutletReservationUnavailableError(
                'Outlet reservation not found.',
            );
        }

        if (reservation.status === 'converted') {
            return reservation;
        }

        if (reservation.holdExpiresAt.getTime() <= now.getTime()) {
            throw new OutletReservationUnavailableError(
                'Outlet reservation has expired.',
            );
        }

        const [updated] = await tx
            .update(outletOfferReservations)
            .set({
                status: 'converted',
                convertedAt: now,
            })
            .where(eq(outletOfferReservations.id, reservation.id))
            .returning();

        return updated;
    });
}

export async function expireOutletReservations(
    now = new Date(),
    db: DatabaseClient = storage(),
) {
    const expired = await db
        .update(outletOfferReservations)
        .set({
            status: 'released',
            releasedAt: now,
        })
        .where(
            and(
                eq(outletOfferReservations.status, 'held'),
                lte(outletOfferReservations.holdExpiresAt, now),
            ),
        )
        .returning({ id: outletOfferReservations.id });

    return expired.map((reservation) => reservation.id);
}

export async function closeExpiredOutletOffers(
    now = new Date(),
    db: DatabaseClient = storage(),
) {
    const closed = await db
        .update(outletOffers)
        .set({ status: 'closed' })
        .where(
            and(
                eq(outletOffers.isDeleted, false),
                eq(outletOffers.status, 'published'),
                lte(outletOffers.endAt, now),
            ),
        )
        .returning({ id: outletOffers.id });

    return closed.map((offer) => offer.id);
}

export async function cleanupOutletLifecycle(now = new Date()) {
    const [releasedReservationIds, closedOfferIds] = await Promise.all([
        expireOutletReservations(now),
        closeExpiredOutletOffers(now),
    ]);

    return {
        releasedReservationIds,
        closedOfferIds,
    };
}
