import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import {
    events,
    notifications,
    shoppingCartItems,
    shoppingCarts,
} from '../schema';
import { storage } from '../storage';
import {
    withCheckoutCartItemLock,
    withCheckoutCartItemLocks,
} from './checkoutCartItemLock';
import {
    knownEventTypes,
    type RaisedBedFieldPlantPurchase,
} from './eventsRepo';
import {
    getCheckoutInventoryConsumptions,
    getInventory,
    withInventoryAccountTransaction,
} from './inventoryRepo';
import { getCheckoutOperationMappings } from './operationsRepo';
import {
    getOutletOfferReservationForCartItem,
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

export class CheckoutCartItemFulfillmentStartedError extends Error {
    override readonly name = 'CheckoutCartItemFulfillmentStartedError';

    constructor(readonly cartItemId: number) {
        super(
            `Shopping cart item ${cartItemId.toString()} cannot change after checkout fulfillment starts.`,
        );
    }
}

class CheckoutCartChangedDuringDeleteError extends Error {
    override readonly name = 'CheckoutCartChangedDuringDeleteError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

type CheckoutPlantingProjectionItem = {
    id: number;
    raisedBedId: number | null;
    positionIndex: number | null;
};

export async function getCheckoutPlantingFulfilledCartItemIds(
    items: readonly CheckoutPlantingProjectionItem[],
    db: DatabaseClient = storage(),
) {
    const itemIdByString = new Map(
        items.map((item) => [item.id.toString(), item.id]),
    );
    const itemIdsByPlantingAggregateId = new Map<string, Set<number>>();
    for (const item of items) {
        if (
            typeof item.raisedBedId !== 'number' ||
            typeof item.positionIndex !== 'number'
        ) {
            continue;
        }
        const aggregateId = `${item.raisedBedId.toString()}|${item.positionIndex.toString()}`;
        const aggregateItemIds =
            itemIdsByPlantingAggregateId.get(aggregateId) ?? new Set<number>();
        aggregateItemIds.add(item.id);
        itemIdsByPlantingAggregateId.set(aggregateId, aggregateItemIds);
    }

    const plantingAggregateIds = [...itemIdsByPlantingAggregateId.keys()];
    if (plantingAggregateIds.length === 0) {
        return new Set<number>();
    }

    const fulfilledItemIds = new Set<number>();
    const plantingEvents = await db
        .select({
            aggregateId: events.aggregateId,
            cartItemId: sql<string>`${events.data}->'purchase'->>'cartItemId'`,
        })
        .from(events)
        .where(
            and(
                eq(events.type, knownEventTypes.raisedBedFields.plantPlace),
                inArray(events.aggregateId, plantingAggregateIds),
            ),
        );
    for (const event of plantingEvents) {
        const itemId = itemIdByString.get(event.cartItemId);
        if (
            itemId !== undefined &&
            itemIdsByPlantingAggregateId.get(event.aggregateId)?.has(itemId)
        ) {
            if (fulfilledItemIds.has(itemId)) {
                throw new Error(
                    'Checkout cart item has multiple planting fulfillment events.',
                );
            }
            fulfilledItemIds.add(itemId);
        }
    }
    return fulfilledItemIds;
}

export async function hasMatchingCheckoutPlantingPurchase(
    {
        cartItemId,
        euroAmountCents,
        plantSortId,
        positionIndex,
        raisedBedId,
    }: {
        cartItemId: number;
        euroAmountCents: number;
        plantSortId: string;
        positionIndex: number;
        raisedBedId: number;
    },
    db: DatabaseClient = storage(),
) {
    const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    const plantingEvents = await db
        .select({ aggregateId: events.aggregateId, data: events.data })
        .from(events)
        .where(
            and(
                eq(events.type, knownEventTypes.raisedBedFields.plantPlace),
                eq(
                    sql<string>`${events.data}->'purchase'->>'cartItemId'`,
                    cartItemId.toString(),
                ),
            ),
        );
    if (plantingEvents.length > 1) {
        throw new Error(
            'Checkout cart item has multiple planting fulfillment events.',
        );
    }
    const event = plantingEvents[0];
    if (!event) {
        return false;
    }
    if (!isRecord(event.data)) {
        throw new Error('Checkout planting fulfillment event is malformed.');
    }
    const eventData = event.data;
    const purchase = eventData.purchase;
    if (!isRecord(purchase)) {
        throw new Error('Checkout planting purchase is malformed.');
    }
    if (
        event.aggregateId !== aggregateId ||
        eventData.plantSortId !== plantSortId ||
        purchase.cartItemId !== cartItemId ||
        purchase.currency !== 'eur' ||
        purchase.euroAmountCents !== euroAmountCents
    ) {
        throw new Error(
            'Checkout planting purchase conflicts with the paid cart item.',
        );
    }
    return true;
}

export async function getCheckoutFulfillmentStartedCartItemIds(
    accountId: string,
    items: readonly {
        cartId?: number;
        createdAt?: Date;
        currency?: string | null;
        id: number;
        entityTypeName: string;
        raisedBedId: number | null;
        positionIndex: number | null;
    }[],
    db: DatabaseClient = storage(),
) {
    const itemIds = items.map((item) => item.id);
    if (itemIds.length === 0) {
        return new Set<number>();
    }
    const itemIdByString = new Map(
        itemIds.map((itemId) => [itemId.toString(), itemId]),
    );
    const startedItemIds = new Set(
        (
            await getCheckoutOperationMappings(
                items
                    .filter((item) => item.entityTypeName === 'operation')
                    .map((item) => item.id),
                db,
            )
        ).keys(),
    );
    for (const consumption of await getCheckoutInventoryConsumptions(
        accountId,
        itemIds,
        db,
    )) {
        startedItemIds.add(consumption.cartItemId);
    }

    const reasons = itemIds.map(
        (itemId) => `shoppingCartItem:${itemId.toString()}`,
    );
    const sunflowerSpendEvents = await db
        .select({ reason: sql<string>`${events.data}->>'reason'` })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.spendSunflowers),
                inArray(sql<string>`${events.data}->>'reason'`, reasons),
            ),
        );
    const itemIdByReason = new Map(
        itemIds.map((itemId) => [
            `shoppingCartItem:${itemId.toString()}`,
            itemId,
        ]),
    );
    for (const event of sunflowerSpendEvents) {
        const itemId = itemIdByReason.get(event.reason);
        if (itemId !== undefined) {
            startedItemIds.add(itemId);
        }
    }

    const legacySunflowerItems = items.filter(
        (item) =>
            item.currency === 'sunflower' &&
            Number.isSafeInteger(item.cartId) &&
            item.cartId !== undefined &&
            item.cartId > 0 &&
            item.createdAt instanceof Date &&
            !Number.isNaN(item.createdAt.getTime()),
    );
    const legacyCartReasons = [
        ...new Set(
            legacySunflowerItems.map(
                (item) => `shoppingCart:${String(item.cartId)}`,
            ),
        ),
    ];
    if (legacyCartReasons.length > 0) {
        const legacyCartSpendEvents = await db
            .select({
                createdAt: events.createdAt,
                data: events.data,
                reason: sql<string>`${events.data}->>'reason'`,
            })
            .from(events)
            .where(
                and(
                    eq(events.aggregateId, accountId),
                    eq(events.type, knownEventTypes.accounts.spendSunflowers),
                    inArray(
                        sql<string>`${events.data}->>'reason'`,
                        legacyCartReasons,
                    ),
                ),
            );
        const eventsByReason = new Map<
            string,
            (typeof legacyCartSpendEvents)[number][]
        >();
        for (const event of legacyCartSpendEvents) {
            const matchingEvents = eventsByReason.get(event.reason) ?? [];
            matchingEvents.push(event);
            eventsByReason.set(event.reason, matchingEvents);
        }
        for (const item of legacySunflowerItems) {
            const reason = `shoppingCart:${String(item.cartId)}`;
            const matchingEvents = eventsByReason.get(reason) ?? [];
            if (matchingEvents.length > 1) {
                throw new Error(
                    'Checkout cart has multiple legacy sunflower spend events.',
                );
            }
            const legacyEvent = matchingEvents[0];
            if (!legacyEvent) {
                continue;
            }
            if (
                !isRecord(legacyEvent.data) ||
                parsePositiveInteger(legacyEvent.data.amount) === null
            ) {
                throw new Error(
                    'Checkout cart legacy sunflower spend event is malformed.',
                );
            }
            if (
                item.createdAt instanceof Date &&
                legacyEvent.createdAt >= item.createdAt
            ) {
                startedItemIds.add(item.id);
            }
        }
    }

    const rewardReasons = itemIds.map(
        (itemId) => `payment:shoppingCartItem:${itemId.toString()}`,
    );
    const paymentRewardEvents = await db
        .select({ reason: sql<string>`${events.data}->>'reason'` })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.earnSunflowers),
                inArray(sql<string>`${events.data}->>'reason'`, rewardReasons),
            ),
        );
    const itemIdByRewardReason = new Map(
        itemIds.map((itemId) => [
            `payment:shoppingCartItem:${itemId.toString()}`,
            itemId,
        ]),
    );
    for (const event of paymentRewardEvents) {
        const itemId = itemIdByRewardReason.get(event.reason);
        if (itemId !== undefined) {
            startedItemIds.add(itemId);
        }
    }

    for (const itemId of await getCheckoutPlantingFulfilledCartItemIds(
        items,
        db,
    )) {
        startedItemIds.add(itemId);
    }

    const itemIdStrings = [...itemIdByString.keys()];
    const checkoutIncidentNotifications = await db
        .select({
            cartItemId: sql<string>`${notifications.metadata}->>'cartItemId'`,
        })
        .from(notifications)
        .where(
            and(
                eq(notifications.accountId, accountId),
                eq(notifications.category, 'checkout_fulfillment'),
                inArray(notifications.type, [
                    'checkout_planting_raised_bed_unavailable',
                    'checkout_planting_target_conflict',
                ]),
                inArray(
                    sql<string>`${notifications.metadata}->>'cartItemId'`,
                    itemIdStrings,
                ),
            ),
        );
    for (const notification of checkoutIncidentNotifications) {
        const itemId = itemIdByString.get(notification.cartItemId);
        if (itemId !== undefined) {
            startedItemIds.add(itemId);
        }
    }
    return startedItemIds;
}

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
 * euro and aggregate-cart purchases use an outlet reservation snapshot when
 * available, then the catalog-derived equivalent as a final fallback.
 */
export async function getRaisedBedFieldSunflowerRefundAmount({
    accountId,
    db = storage(),
    fallbackAmount = 0,
    plantCycleStartedAt,
    positionIndex,
    purchase,
    raisedBedId,
}: {
    accountId: string;
    db?: DatabaseClient;
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
    const [matchedCartItem] = await db
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

    const outletReservation = await getOutletOfferReservationForCartItem(
        matchedCartItem.cartItemId,
        db,
    );
    const outletAmount = parsePositiveInteger(
        (outletReservation?.heldOutletPriceCents ?? 0) * 10,
    );
    if (outletAmount) {
        return outletAmount;
    }

    if (matchedCartItem.currency === 'sunflower') {
        const paymentEvent = await db.query.events.findFirst({
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
        checkoutOperationMappings: suppliedCheckoutOperationMappings,
        defaultMissingScheduledDates = false,
    }: {
        checkoutOperationMappings?: Awaited<
            ReturnType<typeof getCheckoutOperationMappings>
        >;
        defaultMissingScheduledDates?: boolean;
    } = {},
) {
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        return cart;
    }

    // Only normalize open carts; paid/historical carts should not be mutated.
    if (cart.status !== 'new') {
        return cart;
    }

    const pendingItems = cart.items.filter((item) => item.status === 'new');
    const checkoutOperationMappings =
        suppliedCheckoutOperationMappings ??
        (await getCheckoutOperationMappings(
            pendingItems
                .filter((item) => item.entityTypeName === 'operation')
                .map((item) => item.id),
        ));
    const itemUpdates = pendingItems
        .filter((item) => !checkoutOperationMappings.has(item.id))
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

    const itemIds = itemUpdates.map((item) => item.id);
    await withCheckoutCartItemLocks(itemIds, async (db) => {
        const lockedItems = await db
            .select()
            .from(shoppingCartItems)
            .where(
                and(
                    eq(shoppingCartItems.cartId, cartId),
                    eq(shoppingCartItems.isDeleted, false),
                    eq(shoppingCartItems.status, 'new'),
                    inArray(shoppingCartItems.id, itemIds),
                ),
            )
            .for('update');
        const fulfillmentStartedItemIds =
            await getCheckoutFulfillmentStartedCartItemIds(
                cart.accountId ?? '',
                lockedItems,
                db,
            );

        for (const item of lockedItems) {
            if (fulfillmentStartedItemIds.has(item.id)) {
                continue;
            }
            const normalizedAdditionalData =
                normalizeScheduledDateAdditionalData(item.additionalData, {
                    defaultMissingScheduledDate: defaultMissingScheduledDates,
                });
            if (normalizedAdditionalData === item.additionalData) {
                continue;
            }
            await db
                .update(shoppingCartItems)
                .set({ additionalData: normalizedAdditionalData })
                .where(eq(shoppingCartItems.id, item.id));
        }
    });

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

export async function setCartItemPaid(
    itemId: number,
    db: DatabaseClient = storage(),
) {
    await db
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
    transaction?: TransactionClient,
) {
    if (additionalData !== undefined) {
        additionalData = normalizeScheduledDateAdditionalData(additionalData);
    }

    if (forceCreate && id) {
        throw new Error('Cannot create an item with an existing ID');
    }

    const findExistingItem = (db: DatabaseClient, lockedItemId?: number) => {
        const targetItemId = lockedItemId ?? id;
        if (targetItemId) {
            return db.query.shoppingCartItems.findFirst({
                where: and(
                    eq(shoppingCartItems.id, targetItemId),
                    eq(shoppingCartItems.isDeleted, false),
                ),
            });
        }
        if (forceCreate) {
            return null;
        }
        return db.query.shoppingCartItems.findFirst({
            where: and(
                eq(shoppingCartItems.cartId, cartId),
                eq(shoppingCartItems.entityTypeName, entityTypeName),
                eq(shoppingCartItems.entityId, entityId),
                gardenId ? eq(shoppingCartItems.gardenId, gardenId) : undefined,
                raisedBedId
                    ? eq(shoppingCartItems.raisedBedId, raisedBedId)
                    : undefined,
                typeof positionIndex === 'number'
                    ? eq(shoppingCartItems.positionIndex, positionIndex)
                    : undefined,
                typeof additionalData === 'string'
                    ? eq(shoppingCartItems.additionalData, additionalData)
                    : undefined,
                currency ? eq(shoppingCartItems.currency, currency) : undefined,
                eq(shoppingCartItems.isDeleted, false),
            ),
        });
    };

    const applyMutation = async (
        db: TransactionClient,
        lockedItemId?: number,
    ) => {
        // Re-read after taking the checkout-item lock. A checkout that won the
        // race may have committed a payment or fulfillment effect meanwhile.
        const existingItem = await findExistingItem(db, lockedItemId);
        if (existingItem) {
            const cart = await db.query.shoppingCarts.findFirst({
                columns: { accountId: true },
                where: eq(shoppingCarts.id, existingItem.cartId),
            });
            if (!cart) {
                throw new Error('Shopping cart not found');
            }
            if (!cart.accountId) {
                throw new Error('Shopping cart account is missing');
            }
            const fulfillmentStartedItemIds =
                await getCheckoutFulfillmentStartedCartItemIds(
                    cart.accountId,
                    [existingItem],
                    db,
                );
            if (fulfillmentStartedItemIds.has(existingItem.id)) {
                throw new CheckoutCartItemFulfillmentStartedError(
                    existingItem.id,
                );
            }
        }

        if (!existingItem && lockedItemId !== undefined) {
            if (amount <= 0) {
                return null;
            }
            throw new Error('Shopping cart item not found');
        }

        // Prevent API changes to paid items. Historical cart rows are immutable.
        if (!forceDelete && existingItem?.status === 'paid') {
            throw new Error('Cannot update paid shopping cart item via API');
        }

        if (amount <= 0) {
            if (existingItem) {
                const [activeCart] = await db
                    .select({ id: shoppingCarts.id })
                    .from(shoppingCarts)
                    .where(
                        and(
                            eq(shoppingCarts.id, existingItem.cartId),
                            eq(shoppingCarts.isDeleted, false),
                            eq(shoppingCarts.status, 'new'),
                        ),
                    )
                    .for('update')
                    .limit(1);
                if (!activeCart) {
                    return null;
                }
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

                const remainingItems =
                    await db.query.shoppingCartItems.findMany({
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
        }

        const [activeCart] = await db
            .select({ id: shoppingCarts.id })
            .from(shoppingCarts)
            .where(
                and(
                    eq(shoppingCarts.id, cartId),
                    eq(shoppingCarts.isDeleted, false),
                    eq(shoppingCarts.status, 'new'),
                ),
            )
            .for('update')
            .limit(1);
        if (!activeCart) {
            throw new Error('Cannot add an item to an inactive shopping cart');
        }

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
    };

    const applyLockedMutation = (db: TransactionClient, lockedItemId: number) =>
        applyMutation(db, lockedItemId);

    if (id) {
        return withCheckoutCartItemLock(
            id,
            (db) => applyLockedMutation(db, id),
            transaction,
        );
    }

    const existingItem = await findExistingItem(transaction ?? storage());
    if (existingItem) {
        return withCheckoutCartItemLock(
            existingItem.id,
            (db) => applyLockedMutation(db, existingItem.id),
            transaction,
        );
    }

    return transaction
        ? applyMutation(transaction)
        : storage().transaction((db) => applyMutation(db));
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
    if (!cart) {
        return;
    }

    const deleteCartWithItemLocks = async (
        liveItemIds: readonly number[],
    ): Promise<void> => {
        try {
            await withCheckoutCartItemLocks(liveItemIds, async (db) => {
                // Cart-item locks are acquired first in canonical order. The
                // cart row then prevents a new item from being attached while
                // the pending set is rechecked and deleted.
                const [lockedCart] = await db
                    .select({
                        accountId: shoppingCarts.accountId,
                        id: shoppingCarts.id,
                    })
                    .from(shoppingCarts)
                    .where(
                        and(
                            eq(shoppingCarts.id, cart.id),
                            eq(shoppingCarts.isDeleted, false),
                        ),
                    )
                    .for('update')
                    .limit(1);
                if (!lockedCart) {
                    return;
                }
                if (lockedCart.accountId !== accountId) {
                    throw new Error('Shopping cart account mismatch');
                }

                const liveItems = await db.query.shoppingCartItems.findMany({
                    where: and(
                        eq(shoppingCartItems.cartId, lockedCart.id),
                        eq(shoppingCartItems.isDeleted, false),
                    ),
                });
                const lockedItemIds = new Set(liveItemIds);
                if (
                    liveItems.length !== lockedItemIds.size ||
                    liveItems.some((item) => !lockedItemIds.has(item.id))
                ) {
                    throw new CheckoutCartChangedDuringDeleteError();
                }

                const paidItem = liveItems.find(
                    (item) => item.status === 'paid',
                );
                if (paidItem) {
                    throw new CheckoutCartItemFulfillmentStartedError(
                        paidItem.id,
                    );
                }

                const fulfillmentStartedItemIds =
                    await getCheckoutFulfillmentStartedCartItemIds(
                        accountId,
                        liveItems,
                        db,
                    );
                const startedCartItemId = fulfillmentStartedItemIds
                    .values()
                    .next().value;
                if (startedCartItemId !== undefined) {
                    throw new CheckoutCartItemFulfillmentStartedError(
                        startedCartItemId,
                    );
                }

                await db
                    .update(shoppingCarts)
                    .set({ isDeleted: true })
                    .where(eq(shoppingCarts.id, lockedCart.id));
                await db
                    .update(shoppingCartItems)
                    .set({ isDeleted: true })
                    .where(eq(shoppingCartItems.cartId, lockedCart.id));
                await releaseOutletReservationsForCart(
                    lockedCart.id,
                    new Date(),
                    db,
                );
            });
        } catch (error) {
            if (!(error instanceof CheckoutCartChangedDuringDeleteError)) {
                throw error;
            }

            const refreshedCart = await getShoppingCart(cart.id);
            if (!refreshedCart) {
                return;
            }
            await deleteCartWithItemLocks(
                refreshedCart.items.map((item) => item.id),
            );
        }
    };

    await deleteCartWithItemLocks(cart.items.map((item) => item.id));
}

export async function normalizeShoppingCartInventoryUsage(cartId: number) {
    const cart = await getShoppingCart(cartId);
    if (!cart?.accountId) {
        return cart;
    }
    const accountId = cart.accountId;
    const inventoryItemIds = cart.items
        .filter(
            (item) => item.status === 'new' && item.currency === 'inventory',
        )
        .map((item) => item.id);
    if (inventoryItemIds.length === 0) {
        return cart;
    }

    await withCheckoutCartItemLocks(inventoryItemIds, async (checkoutTx) => {
        await withInventoryAccountTransaction(
            accountId,
            async (tx) => {
                const inventoryItems = await tx
                    .select()
                    .from(shoppingCartItems)
                    .where(
                        and(
                            eq(shoppingCartItems.cartId, cartId),
                            eq(shoppingCartItems.isDeleted, false),
                            eq(shoppingCartItems.status, 'new'),
                            eq(shoppingCartItems.currency, 'inventory'),
                            inArray(shoppingCartItems.id, inventoryItemIds),
                        ),
                    )
                    .orderBy(
                        asc(shoppingCartItems.createdAt),
                        asc(shoppingCartItems.id),
                    )
                    .for('update');

                if (inventoryItems.length === 0) {
                    return;
                }

                const inventory = await getInventory(accountId, tx);
                const checkoutConsumptions =
                    await getCheckoutInventoryConsumptions(
                        accountId,
                        inventoryItems.map((item) => item.id),
                        tx,
                    );
                const fulfillmentStartedItemIds =
                    await getCheckoutFulfillmentStartedCartItemIds(
                        accountId,
                        inventoryItems,
                        tx,
                    );
                const availableInventory = new Map(
                    inventory.map((item) => [
                        `${item.entityTypeName}-${item.entityId}`,
                        item.amount,
                    ]),
                );
                const inventoryItemsById = new Map(
                    inventoryItems.map((item) => [item.id, item]),
                );
                const consumedInventoryItemIds = new Set<number>();
                for (const consumption of checkoutConsumptions) {
                    const item = inventoryItemsById.get(consumption.cartItemId);
                    if (
                        !item ||
                        item.entityTypeName !== consumption.entityTypeName ||
                        item.entityId !== consumption.entityId ||
                        item.amount !== consumption.amount
                    ) {
                        throw new Error(
                            `Inventory consumption for cart item ${consumption.cartItemId.toString()} conflicts with the pending cart item`,
                        );
                    }
                    consumedInventoryItemIds.add(item.id);
                }

                for (const item of inventoryItems) {
                    // A prior checkout attempt already consumed this exact item's
                    // inventory. Reserve that durable consumption for the same item;
                    // only still-live inventory may be allocated to other cart items.
                    if (consumedInventoryItemIds.has(item.id)) {
                        continue;
                    }
                    const inventoryKey = `${item.entityTypeName}-${item.entityId}`;
                    const remainingInventory =
                        availableInventory.get(inventoryKey) ?? 0;

                    if (fulfillmentStartedItemIds.has(item.id)) {
                        availableInventory.set(
                            inventoryKey,
                            Math.max(remainingInventory - item.amount, 0),
                        );
                        continue;
                    }

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
            },
            checkoutTx,
        );
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

export async function getShoppingCart(
    cartId: number,
    db: DatabaseClient = storage(),
) {
    return await db.query.shoppingCarts.findFirst({
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

export async function lockShoppingCartForCheckout(
    cartId: number,
    db: TransactionClient,
) {
    const [activeCart] = await db
        .select({ id: shoppingCarts.id })
        .from(shoppingCarts)
        .where(
            and(
                eq(shoppingCarts.id, cartId),
                eq(shoppingCarts.isDeleted, false),
                eq(shoppingCarts.status, 'new'),
            ),
        )
        .for('update')
        .limit(1);
    if (!activeCart) {
        return undefined;
    }
    return getShoppingCart(activeCart.id, db);
}
