import { and, asc, eq, gt, inArray, lte, ne } from 'drizzle-orm';
import {
    type InsertOutletOffer,
    type OutletOfferReservationStatus,
    type OutletOfferStatus,
    outletOfferReservations,
    outletOffers,
    type SelectOutletOffer,
    type SelectOutletOfferReservation,
    shoppingCartItems,
    shoppingCarts,
} from '../schema';
import { storage } from '../storage';
import { withCheckoutCartItemLock } from './checkoutCartItemLock';
import {
    assertNoActiveStripeCheckoutAttempt,
    getActiveStripeCheckoutAttempt,
} from './stripeCheckoutAttemptRepo';

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

export class OutletOfferIdentityImmutableError extends Error {
    override readonly name = 'OutletOfferIdentityImmutableError';

    constructor(readonly offerId: number) {
        super('An outlet offer with reservation history cannot change plant.');
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

type AvailabilityReservation = Pick<
    SelectOutletOfferReservation,
    | 'cartId'
    | 'cartItemId'
    | 'holdExpiresAt'
    | 'id'
    | 'outletOfferId'
    | 'quantity'
    | 'status'
>;

function countQuantity(
    reservations: readonly AvailabilityReservation[],
    now: Date,
    status: OutletOfferReservationStatus,
    protectedReservationIds: ReadonlySet<number> = new Set(),
) {
    return reservations.reduce((sum, reservation) => {
        if (reservation.status !== status) {
            return sum;
        }

        if (
            status === 'held' &&
            reservation.holdExpiresAt.getTime() <= now.getTime() &&
            !protectedReservationIds.has(reservation.id)
        ) {
            return sum;
        }

        return sum + reservation.quantity;
    }, 0);
}

function withAvailability(
    offer: SelectOutletOffer,
    reservations: readonly AvailabilityReservation[],
    now: Date,
    protectedReservationIds: ReadonlySet<number>,
): OutletOfferWithAvailability {
    const reservedQuantity = countQuantity(
        reservations,
        now,
        'held',
        protectedReservationIds,
    );
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

async function getActiveAttemptProtectedReservationIds(
    reservations: readonly AvailabilityReservation[],
    now: Date,
    db: DatabaseClient,
) {
    const expiredHeldReservationsByCartId = new Map<
        number,
        Map<number, AvailabilityReservation>
    >();
    for (const reservation of reservations) {
        if (
            reservation.status !== 'held' ||
            reservation.holdExpiresAt.getTime() > now.getTime()
        ) {
            continue;
        }
        const cartReservations =
            expiredHeldReservationsByCartId.get(reservation.cartId) ??
            new Map<number, AvailabilityReservation>();
        cartReservations.set(reservation.id, reservation);
        expiredHeldReservationsByCartId.set(
            reservation.cartId,
            cartReservations,
        );
    }

    const protectedReservationIds = new Set<number>();
    const cartIds = [...expiredHeldReservationsByCartId.keys()].sort(
        (left, right) => left - right,
    );
    for (const cartId of cartIds) {
        const activeAttempt = await getActiveStripeCheckoutAttempt(cartId, db);
        if (!activeAttempt) {
            continue;
        }
        const cartReservations = expiredHeldReservationsByCartId.get(cartId);
        if (!cartReservations) {
            continue;
        }
        for (const item of activeAttempt.snapshot.items) {
            if (!item.outlet) {
                continue;
            }
            const reservation = cartReservations.get(item.outlet.reservationId);
            if (
                reservation?.cartItemId === item.id &&
                reservation.outletOfferId === item.outlet.offerId
            ) {
                protectedReservationIds.add(reservation.id);
            }
        }
    }
    return protectedReservationIds;
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
) {
    await storage().transaction(async (db) => {
        const [offer] = await db
            .select({
                id: outletOffers.id,
                plantSortId: outletOffers.plantSortId,
            })
            .from(outletOffers)
            .where(eq(outletOffers.id, id))
            .for('update')
            .limit(1);
        if (!offer) {
            return;
        }
        if (
            data.plantSortId !== undefined &&
            data.plantSortId !== offer.plantSortId
        ) {
            const reservation =
                await db.query.outletOfferReservations.findFirst({
                    columns: { id: true },
                    where: eq(outletOfferReservations.outletOfferId, id),
                });
            if (reservation) {
                throw new OutletOfferIdentityImmutableError(id);
            }
        }
        await db.update(outletOffers).set(data).where(eq(outletOffers.id, id));
    });
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
    const protectedReservationIds =
        await getActiveAttemptProtectedReservationIds(reservations, now, db);
    return withAvailability(offer, reservations, now, protectedReservationIds);
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
    const protectedReservationIds =
        await getActiveAttemptProtectedReservationIds(reservations, now, db);
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
        withAvailability(
            offer,
            reservationsByOfferId.get(offer.id) ?? [],
            now,
            protectedReservationIds,
        ),
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

async function getReservedAndConvertedQuantities({
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
    const reservations = await db
        .select()
        .from(outletOfferReservations)
        .where(
            and(
                eq(outletOfferReservations.outletOfferId, offerId),
                inArray(outletOfferReservations.status, ['held', 'converted']),
                excludeReservationId
                    ? ne(outletOfferReservations.id, excludeReservationId)
                    : undefined,
            ),
        )
        .orderBy(asc(outletOfferReservations.id))
        .for('update');
    const protectedReservationIds =
        await getActiveAttemptProtectedReservationIds(reservations, now, db);
    return {
        reservedQuantity: countQuantity(
            reservations,
            now,
            'held',
            protectedReservationIds,
        ),
        soldQuantity: countQuantity(reservations, now, 'converted'),
    };
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
    const cartItem = await tx.query.shoppingCartItems.findFirst({
        columns: {
            cartId: true,
            entityId: true,
            entityTypeName: true,
            isDeleted: true,
        },
        where: eq(shoppingCartItems.id, cartItemId),
    });
    if (
        !cartItem ||
        cartItem.isDeleted ||
        cartItem.cartId !== cartId ||
        cartItem.entityTypeName !== 'plantSort' ||
        cartItem.entityId !== offer.plantSortId.toString()
    ) {
        throw new OutletOfferUnavailableError(
            'Outlet offer does not match the cart item.',
        );
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
    const { reservedQuantity, soldQuantity } =
        await getReservedAndConvertedQuantities({
            offerId,
            now,
            excludeReservationId,
            db: tx,
        });
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

async function lockCartAndAssertOutletMutationAllowed(
    cartId: number,
    db: TransactionClient,
) {
    const [cart] = await db
        .select({
            accountId: shoppingCarts.accountId,
            id: shoppingCarts.id,
            isDeleted: shoppingCarts.isDeleted,
            status: shoppingCarts.status,
        })
        .from(shoppingCarts)
        .where(eq(shoppingCarts.id, cartId))
        .for('update')
        .limit(1);
    if (!cart || cart.isDeleted || cart.status !== 'new') {
        throw new OutletReservationUnavailableError(
            'Outlet reservation cart is no longer mutable.',
        );
    }
    await assertNoActiveStripeCheckoutAttempt(cartId, db);
    return cart;
}

export async function reserveOutletOffer(options: ReserveOutletOfferOptions) {
    if (options.db) {
        return reserveOutletOfferInTransaction(options, options.db);
    }

    return withCheckoutCartItemLock(options.cartItemId, async (tx) => {
        const cart = await lockCartAndAssertOutletMutationAllowed(
            options.cartId,
            tx,
        );
        const item = await tx.query.shoppingCartItems.findFirst({
            columns: { cartId: true, isDeleted: true },
            where: eq(shoppingCartItems.id, options.cartItemId),
        });
        if (
            cart.accountId !== options.accountId ||
            !item ||
            item.cartId !== options.cartId ||
            item.isDeleted
        ) {
            throw new OutletReservationUnavailableError(
                'Outlet reservation cart is no longer mutable.',
            );
        }
        return reserveOutletOfferInTransaction(options, tx);
    });
}

async function releaseOutletReservationForCartItemInDatabase(
    cartItemId: number,
    now: Date,
    db: DatabaseClient,
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

export async function releaseOutletReservationForCartItem(
    cartItemId: number,
    now = new Date(),
    db?: DatabaseClient,
) {
    if (db) {
        return releaseOutletReservationForCartItemInDatabase(
            cartItemId,
            now,
            db,
        );
    }
    return withCheckoutCartItemLock(cartItemId, async (tx) => {
        const item = await tx.query.shoppingCartItems.findFirst({
            columns: { cartId: true },
            where: eq(shoppingCartItems.id, cartItemId),
        });
        if (!item) {
            return;
        }
        await lockCartAndAssertOutletMutationAllowed(item.cartId, tx);
        await releaseOutletReservationForCartItemInDatabase(
            cartItemId,
            now,
            tx,
        );
    });
}

export async function releaseOutletReservationsForCart(
    cartId: number,
    now = new Date(),
    db?: DatabaseClient,
) {
    const release = async (database: DatabaseClient) =>
        database
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
    if (db) {
        await release(db);
        return;
    }
    await storage().transaction(async (tx) => {
        await lockCartAndAssertOutletMutationAllowed(cartId, tx);
        await release(tx);
    });
}

export async function convertOutletReservationForCartItem(
    cartItemId: number,
    now = new Date(),
    db?: TransactionClient,
) {
    const convert = async (tx: TransactionClient) => {
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
            const activeAttempt = await getActiveStripeCheckoutAttempt(
                reservation.cartId,
                tx,
            );
            const capturedByBoundAttempt =
                Boolean(activeAttempt?.sessionId) &&
                activeAttempt?.snapshot.items.some(
                    (item) =>
                        item.id === cartItemId &&
                        item.outlet?.reservationId === reservation.id,
                );
            if (!capturedByBoundAttempt) {
                throw new OutletReservationUnavailableError(
                    'Outlet reservation has expired.',
                );
            }
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
    };

    return db ? convert(db) : withCheckoutCartItemLock(cartItemId, convert);
}

export async function expireOutletReservations(
    now = new Date(),
    db?: TransactionClient,
) {
    const database = db ?? storage();
    const candidates = await database
        .select({
            cartId: outletOfferReservations.cartId,
            cartItemId: outletOfferReservations.cartItemId,
            id: outletOfferReservations.id,
        })
        .from(outletOfferReservations)
        .where(
            and(
                eq(outletOfferReservations.status, 'held'),
                lte(outletOfferReservations.holdExpiresAt, now),
            ),
        )
        .orderBy(
            asc(outletOfferReservations.cartItemId),
            asc(outletOfferReservations.id),
        );

    const releasedIds: number[] = [];
    for (const candidate of candidates) {
        const release = async (tx: TransactionClient) => {
            const [reservation] = await tx
                .select()
                .from(outletOfferReservations)
                .where(eq(outletOfferReservations.id, candidate.id))
                .for('update')
                .limit(1);
            if (
                reservation?.status !== 'held' ||
                reservation.holdExpiresAt.getTime() > now.getTime()
            ) {
                return undefined;
            }
            const activeAttempt = await getActiveStripeCheckoutAttempt(
                candidate.cartId,
                tx,
            );
            if (
                activeAttempt?.snapshot.items.some(
                    (item) =>
                        item.id === candidate.cartItemId &&
                        item.outlet?.reservationId === candidate.id,
                )
            ) {
                return undefined;
            }
            const [released] = await tx
                .update(outletOfferReservations)
                .set({ status: 'released', releasedAt: now })
                .where(
                    and(
                        eq(outletOfferReservations.id, candidate.id),
                        eq(outletOfferReservations.status, 'held'),
                    ),
                )
                .returning({ id: outletOfferReservations.id });
            return released?.id;
        };
        const releasedId = await withCheckoutCartItemLock(
            candidate.cartItemId,
            release,
            db,
        );
        if (releasedId !== undefined) {
            releasedIds.push(releasedId);
        }
    }

    return releasedIds;
}

export async function closeExpiredOutletOffers(
    now = new Date(),
    db?: TransactionClient,
) {
    const close = async (tx: TransactionClient) => {
        const expiredOffers = await tx
            .select({ id: outletOffers.id })
            .from(outletOffers)
            .where(
                and(
                    eq(outletOffers.isDeleted, false),
                    eq(outletOffers.status, 'published'),
                    lte(outletOffers.endAt, now),
                ),
            )
            .orderBy(asc(outletOffers.id))
            .for('update');
        if (expiredOffers.length === 0) {
            return [];
        }
        const expiredOfferIds = expiredOffers.map((offer) => offer.id);
        const closed = await tx
            .update(outletOffers)
            .set({ status: 'closed' })
            .where(
                and(
                    inArray(outletOffers.id, expiredOfferIds),
                    eq(outletOffers.isDeleted, false),
                    eq(outletOffers.status, 'published'),
                    lte(outletOffers.endAt, now),
                ),
            )
            .returning({ id: outletOffers.id });

        return closed
            .map((offer) => offer.id)
            .sort((left, right) => left - right);
    };

    return db ? close(db) : storage().transaction(close);
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
