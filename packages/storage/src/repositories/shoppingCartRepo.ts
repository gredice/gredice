import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { events, shoppingCartItems, shoppingCarts } from '../schema';
import { storage } from '../storage';
import {
    knownEventTypes,
    type RaisedBedFieldPlantPurchase,
} from './eventsRepo';
import { getInventory } from './inventoryRepo';
import {
    releaseOutletReservationForCartItem,
    releaseOutletReservationsForCart,
    reserveOutletOffer,
} from './outletOffersRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

const raisedBedFieldPurchaseMatchWindowMs = 10 * 60 * 1000;

function parsePositiveInteger(value: unknown) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
}

/**
 * Resolve the sunflower amount actually paid for the plant purchase that
 * started the current raised-bed field cycle.
 *
 * New planting events carry their cart item, currency, and paid amount. Older
 * events fall back to matching the paid cart item around the cycle start;
 * immediate sunflower checkouts can still recover the exact spend event while
 * euro and aggregate-cart purchases use the catalog-derived equivalent.
 */
export async function getRaisedBedFieldSunflowerRefundAmount({
    accountId,
    fallbackAmount = 0,
    plantCycleStartedAt,
    positionIndex,
    purchase,
    raisedBedId,
}: {
    accountId: string;
    fallbackAmount?: number;
    plantCycleStartedAt: Date;
    positionIndex: number;
    purchase?: RaisedBedFieldPlantPurchase;
    raisedBedId: number;
}) {
    if (purchase?.currency === 'inventory') {
        return 0;
    }
    if (purchase?.currency === 'sunflower') {
        return parsePositiveInteger(purchase.sunflowerAmount) ?? 0;
    }
    if (purchase?.currency === 'eur') {
        return parsePositiveInteger(purchase.euroAmountCents * 10) ?? 0;
    }

    const windowStart = new Date(
        plantCycleStartedAt.getTime() - raisedBedFieldPurchaseMatchWindowMs,
    );
    const windowEnd = new Date(
        plantCycleStartedAt.getTime() + raisedBedFieldPurchaseMatchWindowMs,
    );
    const [matchedCartItem] = await storage()
        .select({
            cartItemId: shoppingCartItems.id,
            currency: shoppingCartItems.currency,
        })
        .from(shoppingCartItems)
        .innerJoin(
            shoppingCarts,
            eq(shoppingCarts.id, shoppingCartItems.cartId),
        )
        .where(
            and(
                eq(shoppingCarts.accountId, accountId),
                eq(shoppingCarts.isDeleted, false),
                eq(shoppingCartItems.entityTypeName, 'plantSort'),
                eq(shoppingCartItems.raisedBedId, raisedBedId),
                eq(shoppingCartItems.positionIndex, positionIndex),
                eq(shoppingCartItems.status, 'paid'),
                eq(shoppingCartItems.isDeleted, false),
                gte(shoppingCartItems.updatedAt, windowStart),
                lte(shoppingCartItems.updatedAt, windowEnd),
            ),
        )
        .orderBy(desc(shoppingCartItems.updatedAt), desc(shoppingCartItems.id))
        .limit(1);

    if (!matchedCartItem || matchedCartItem.currency === 'inventory') {
        return 0;
    }

    if (matchedCartItem.currency === 'sunflower') {
        const paymentEvent = await storage().query.events.findFirst({
            where: and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.spendSunflowers),
                sql`${events.data}->>'reason' = ${`shoppingCartItem:${matchedCartItem.cartItemId.toString()}`}`,
            ),
            orderBy: [desc(events.createdAt), desc(events.id)],
        });
        const eventData = paymentEvent?.data as
            | Record<string, unknown>
            | null
            | undefined;
        const paidAmount = parsePositiveInteger(eventData?.amount);
        if (paidAmount) {
            return paidAmount;
        }
    }

    return parsePositiveInteger(fallbackAmount) ?? 0;
}

function startOfUtcDay(date: Date) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

function getMinimumScheduledDate(baseDate = new Date()) {
    const tomorrow = startOfUtcDay(baseDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
}

export function getDefaultShoppingCartScheduledDate(baseDate = new Date()) {
    return getMinimumScheduledDate(baseDate).toISOString();
}

function normalizeScheduledDateAdditionalData(
    additionalData?: string | null,
    {
        defaultMissingScheduledDate = false,
    }: { defaultMissingScheduledDate?: boolean } = {},
) {
    if (!additionalData) {
        return defaultMissingScheduledDate
            ? JSON.stringify({
                  scheduledDate: getDefaultShoppingCartScheduledDate(),
              })
            : (additionalData ?? null);
    }

    try {
        const parsed = JSON.parse(additionalData);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return additionalData;
        }

        if (!('scheduledDate' in parsed)) {
            if (defaultMissingScheduledDate) {
                return JSON.stringify({
                    ...parsed,
                    scheduledDate: getDefaultShoppingCartScheduledDate(),
                });
            }
            return additionalData;
        }

        const scheduledDate = parsed.scheduledDate;
        if (typeof scheduledDate !== 'string') {
            if (defaultMissingScheduledDate) {
                return JSON.stringify({
                    ...parsed,
                    scheduledDate: getDefaultShoppingCartScheduledDate(),
                });
            }
            return additionalData;
        }

        const minimumScheduledDate = getMinimumScheduledDate();
        const parsedScheduledDate = new Date(scheduledDate);

        let finalScheduledDate: Date;
        if (Number.isNaN(parsedScheduledDate.getTime())) {
            finalScheduledDate = minimumScheduledDate;
        } else {
            const normalizedScheduledDate = startOfUtcDay(parsedScheduledDate);
            finalScheduledDate =
                normalizedScheduledDate < minimumScheduledDate
                    ? minimumScheduledDate
                    : normalizedScheduledDate;
        }

        const normalizedIso = finalScheduledDate.toISOString();
        if (normalizedIso === scheduledDate) {
            return additionalData;
        }

        return JSON.stringify({
            ...parsed,
            scheduledDate: normalizedIso,
        });
    } catch {
        return additionalData;
    }
}

export async function normalizeShoppingCartScheduledDates(
    cartId: number,
    {
        defaultMissingScheduledDates = false,
    }: { defaultMissingScheduledDates?: boolean } = {},
) {
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        return cart;
    }

    // Only normalize open carts; paid/historical carts should not be mutated.
    if (cart.status !== 'new') {
        return cart;
    }

    const itemUpdates = cart.items
        .filter((item) => item.status === 'new')
        .map((item) => ({
            id: item.id,
            originalAdditionalData: item.additionalData,
            additionalData: normalizeScheduledDateAdditionalData(
                item.additionalData,
                {
                    defaultMissingScheduledDate: defaultMissingScheduledDates,
                },
            ),
        }))
        .filter((item) => item.additionalData !== item.originalAdditionalData);

    if (itemUpdates.length === 0) {
        return cart;
    }

    await Promise.all(
        itemUpdates.map((item) =>
            storage()
                .update(shoppingCartItems)
                .set({
                    additionalData: item.additionalData,
                })
                .where(eq(shoppingCartItems.id, item.id)),
        ),
    );

    return getShoppingCart(cartId);
}

export async function getOrCreateShoppingCart(
    accountId: string,
    status: 'new' | 'paid' = 'new',
) {
    const cart = await storage().query.shoppingCarts.findFirst({
        where: and(
            eq(shoppingCarts.accountId, accountId),
            eq(shoppingCarts.isDeleted, false),
            eq(shoppingCarts.status, status),
        ),
        with: {
            items: {
                where: and(eq(shoppingCartItems.isDeleted, false)),
                orderBy: shoppingCartItems.createdAt,
            },
        },
    });
    if (cart) {
        return cart;
    }

    const createdCartId = (
        await storage()
            .insert(shoppingCarts)
            .values({
                accountId,
                status: 'new',
            })
            .returning({
                id: shoppingCarts.id,
            })
    )[0].id;

    return getShoppingCart(createdCartId);
}

export async function markCartPaidIfAllItemsPaid(cartId: number) {
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        console.warn(`Cart ${cartId} not found for marking as paid.`);
        return;
    }

    if (
        cart.items.length > 0 &&
        cart.items.every((item) => item.status === 'paid')
    ) {
        await storage()
            .update(shoppingCarts)
            .set({ status: 'paid' })
            .where(eq(shoppingCarts.id, cartId));
        console.debug(
            `Cart ${cartId} marked as paid because all items are paid.`,
        );
    }
}

export async function setCartItemPaid(itemId: number) {
    await storage()
        .update(shoppingCartItems)
        .set({ status: 'paid' })
        .where(eq(shoppingCartItems.id, itemId));
}

export async function upsertOrRemoveCartItem(
    id: number | null | undefined,
    cartId: number,
    entityId: string,
    entityTypeName: string,
    amount: number,
    gardenId?: number,
    raisedBedId?: number,
    positionIndex?: number,
    additionalData?: string | null,
    currency?: string | null,
    forceCreate?: boolean,
    forceDelete: boolean = false,
    db: DatabaseClient = storage(),
) {
    if (additionalData !== undefined) {
        additionalData = normalizeScheduledDateAdditionalData(additionalData);
    }

    if (forceCreate && id) {
        throw new Error('Cannot create an item with an existing ID');
    }

    const existingItem = id
        ? await db.query.shoppingCartItems.findFirst({
              where: and(
                  eq(shoppingCartItems.id, id),
                  eq(shoppingCartItems.isDeleted, false),
              ),
          })
        : !forceCreate
          ? await db.query.shoppingCartItems.findFirst({
                where: and(
                    eq(shoppingCartItems.cartId, cartId),
                    eq(shoppingCartItems.entityTypeName, entityTypeName),
                    eq(shoppingCartItems.entityId, entityId),
                    gardenId
                        ? eq(shoppingCartItems.gardenId, gardenId)
                        : undefined,
                    raisedBedId
                        ? eq(shoppingCartItems.raisedBedId, raisedBedId)
                        : undefined,
                    typeof positionIndex === 'number'
                        ? eq(shoppingCartItems.positionIndex, positionIndex)
                        : undefined,
                    typeof additionalData === 'string'
                        ? eq(shoppingCartItems.additionalData, additionalData)
                        : undefined,
                    currency
                        ? eq(shoppingCartItems.currency, currency)
                        : undefined,
                    eq(shoppingCartItems.isDeleted, false),
                ),
            })
          : null;

    // Prevent API changes to paid items. Historical cart rows are immutable.
    if (!forceDelete && existingItem?.status === 'paid') {
        throw new Error('Cannot update paid shopping cart item via API');
    }

    if (amount <= 0) {
        if (existingItem) {
            await db
                .update(shoppingCartItems)
                .set({
                    isDeleted: true,
                })
                .where(eq(shoppingCartItems.id, existingItem.id));
            await releaseOutletReservationForCartItem(
                existingItem.id,
                new Date(),
                db,
            );

            const remainingItems = await db.query.shoppingCartItems.findMany({
                where: and(
                    eq(shoppingCartItems.cartId, cartId),
                    eq(shoppingCartItems.isDeleted, false),
                ),
            });

            if (remainingItems.length === 0) {
                await db
                    .update(shoppingCarts)
                    .set({ isDeleted: true })
                    .where(eq(shoppingCarts.id, cartId));
            }
        }
        return null;
    }

    if (existingItem) {
        return (
            await db
                .update(shoppingCartItems)
                .set({
                    amount,
                    additionalData,
                    currency: currency ? currency : undefined, // Update only if provided
                    positionIndex:
                        typeof positionIndex === 'number'
                            ? positionIndex
                            : undefined,
                })
                .where(eq(shoppingCartItems.id, existingItem.id))
                .returning({
                    id: shoppingCartItems.id,
                })
        )[0].id;
    } else {
        return (
            await db
                .insert(shoppingCartItems)
                .values({
                    cartId,
                    entityId,
                    entityTypeName,
                    amount,
                    gardenId,
                    raisedBedId,
                    positionIndex,
                    additionalData,
                    currency: currency ?? 'eur',
                })
                .returning({
                    id: shoppingCartItems.id,
                })
        )[0].id;
    }
}

export async function upsertOrRemoveCartItemWithOutletReservation({
    id,
    cartId,
    entityId,
    entityTypeName,
    amount,
    gardenId,
    raisedBedId,
    positionIndex,
    additionalData,
    currency,
    forceCreate,
    forceDelete = false,
    outletOfferId,
    accountId,
    now = new Date(),
    holdMinutes,
}: {
    id?: number | null;
    cartId: number;
    entityId: string;
    entityTypeName: string;
    amount: number;
    gardenId?: number;
    raisedBedId?: number;
    positionIndex?: number;
    additionalData?: string | null;
    currency?: string | null;
    forceCreate?: boolean;
    forceDelete?: boolean;
    outletOfferId: number;
    accountId: string;
    now?: Date;
    holdMinutes?: number;
}) {
    return storage().transaction(async (tx) => {
        const cartItemId = await upsertOrRemoveCartItem(
            id,
            cartId,
            entityId,
            entityTypeName,
            amount,
            gardenId,
            raisedBedId,
            positionIndex,
            additionalData,
            currency,
            forceCreate,
            forceDelete,
            tx,
        );

        if (amount > 0 && cartItemId) {
            await reserveOutletOffer({
                offerId: outletOfferId,
                accountId,
                cartId,
                cartItemId,
                quantity: amount,
                now,
                holdMinutes,
                db: tx,
            });
        }

        return cartItemId;
    });
}

export async function deleteShoppingCart(accountId: string) {
    const cart = await getOrCreateShoppingCart(accountId);
    if (cart) {
        await Promise.all([
            storage()
                .update(shoppingCarts)
                .set({ isDeleted: true })
                .where(eq(shoppingCarts.id, cart.id)),
            storage()
                .update(shoppingCartItems)
                .set({ isDeleted: true })
                .where(eq(shoppingCartItems.cartId, cart.id)),
            releaseOutletReservationsForCart(cart.id),
        ]);
    }
}

export async function normalizeShoppingCartInventoryUsage(cartId: number) {
    const cart = await getShoppingCart(cartId);
    if (!cart?.accountId) {
        return cart;
    }

    const inventory = await getInventory(cart.accountId);
    const availableInventory = new Map(
        inventory.map((item) => [
            `${item.entityTypeName}-${item.entityId}`,
            item.amount,
        ]),
    );

    await storage().transaction(async (tx) => {
        const inventoryItems = await tx
            .select()
            .from(shoppingCartItems)
            .where(
                and(
                    eq(shoppingCartItems.cartId, cartId),
                    eq(shoppingCartItems.isDeleted, false),
                    eq(shoppingCartItems.status, 'new'),
                    eq(shoppingCartItems.currency, 'inventory'),
                ),
            )
            .orderBy(
                asc(shoppingCartItems.createdAt),
                asc(shoppingCartItems.id),
            )
            .for('update');

        for (const item of inventoryItems) {
            const inventoryKey = `${item.entityTypeName}-${item.entityId}`;
            const remainingInventory =
                availableInventory.get(inventoryKey) ?? 0;

            if (remainingInventory <= 0) {
                await tx
                    .update(shoppingCartItems)
                    .set({ currency: 'eur' })
                    .where(eq(shoppingCartItems.id, item.id));
                continue;
            }

            if (item.amount <= remainingInventory) {
                availableInventory.set(
                    inventoryKey,
                    remainingInventory - item.amount,
                );
                continue;
            }

            const inventoryAmount = remainingInventory;
            const purchaseAmount = item.amount - inventoryAmount;

            await tx
                .update(shoppingCartItems)
                .set({ amount: inventoryAmount })
                .where(eq(shoppingCartItems.id, item.id));

            await tx.insert(shoppingCartItems).values({
                cartId: item.cartId,
                entityId: item.entityId,
                entityTypeName: item.entityTypeName,
                gardenId: item.gardenId,
                raisedBedId: item.raisedBedId,
                positionIndex: item.positionIndex,
                additionalData: item.additionalData,
                amount: purchaseAmount,
                currency: 'eur',
                status: item.status,
            });

            availableInventory.set(inventoryKey, 0);
        }
    });

    return getShoppingCart(cartId);
}

export async function getAllShoppingCarts({
    status = 'new',
    filter,
}: {
    status?: 'new' | 'paid' | null;
    filter?: {
        accountId?: string;
    };
} = {}) {
    return await storage().query.shoppingCarts.findMany({
        where: and(
            eq(shoppingCarts.isDeleted, false),
            status ? eq(shoppingCarts.status, status) : undefined,
            filter?.accountId
                ? eq(shoppingCarts.accountId, filter.accountId)
                : undefined,
        ),
        with: {
            account: {
                with: {
                    accountUsers: {
                        with: {
                            user: true,
                        },
                    },
                },
            },
            items: {
                where: eq(shoppingCartItems.isDeleted, false),
                orderBy: shoppingCartItems.createdAt,
            },
        },
        orderBy: shoppingCarts.createdAt,
    });
}

export async function getShoppingCart(cartId: number) {
    return await storage().query.shoppingCarts.findFirst({
        where: and(
            eq(shoppingCarts.id, cartId),
            eq(shoppingCarts.isDeleted, false),
        ),
        with: {
            items: {
                where: eq(shoppingCartItems.isDeleted, false),
                orderBy: shoppingCartItems.createdAt,
            },
        },
    });
}
