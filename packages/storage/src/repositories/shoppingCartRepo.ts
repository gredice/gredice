import type { AdvancedSowingCartAuthorizationV1 } from '@gredice/js/plants';
import { and, asc, desc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import {
    events,
    notifications,
    shoppingCartItemAdvancedSowingAuthorizations,
    shoppingCartItems,
    shoppingCarts,
} from '../schema';
import { storage } from '../storage';
import { lockAccountAndAssertNotDeleting } from './accountDeletionFenceRepo';
import {
    AdvancedSowingCartAuthorizationPersistenceError,
    clearShoppingCartItemAdvancedSowingAuthorization,
    getShoppingCartItemAdvancedSowingAuthorizations,
    persistShoppingCartItemAdvancedSowingAuthorization,
} from './advancedSowingCartAuthorizationRepo';
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
    OutletReservationUnavailableError,
    releaseOutletReservationForCartItem,
    releaseOutletReservationsForCart,
    reserveOutletOffer,
} from './outletOffersRepo';
import {
    assertNoActiveStripeCheckoutAttempt,
    getActiveStripeCheckoutAttempt,
} from './stripeCheckoutAttemptRepo';

export {
    AdvancedSowingCartAuthorizationPersistenceError,
    getShoppingCartItemAdvancedSowingAuthorizations,
} from './advancedSowingCartAuthorizationRepo';

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

export class AdvancedSowingCartItemExplicitIdentityRequiredError extends Error {
    override readonly name =
        'AdvancedSowingCartItemExplicitIdentityRequiredError';
}

export class OutletCartTargetUnavailableError extends Error {
    override readonly name = 'OutletCartTargetUnavailableError';

    constructor() {
        super('Another live cart item already uses the Outlet target.');
    }
}

class OutletCartTargetChangedDuringMutationError extends Error {
    override readonly name = 'OutletCartTargetChangedDuringMutationError';
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
        const [lockedCart] = await db
            .select({ id: shoppingCarts.id })
            .from(shoppingCarts)
            .where(eq(shoppingCarts.id, cartId))
            .for('update')
            .limit(1);
        if (!lockedCart || (await getActiveStripeCheckoutAttempt(cartId, db))) {
            return;
        }
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
    return storage().transaction(async (db) => {
        const account = await lockAccountAndAssertNotDeleting(accountId, db);
        if (!account) {
            throw new Error('Shopping cart account not found');
        }
        const cart = await db.query.shoppingCarts.findFirst({
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

        const [createdCart] = await db
            .insert(shoppingCarts)
            .values({
                accountId,
                status: 'new',
            })
            .returning({ id: shoppingCarts.id });
        if (!createdCart) {
            throw new Error('Failed to create shopping cart');
        }
        return getShoppingCart(createdCart.id, db);
    });
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
        if (existingItem && existingItem.cartId !== cartId) {
            throw new Error('Shopping cart item does not belong to this cart');
        }
        if (
            existingItem &&
            !id &&
            (
                await getShoppingCartItemAdvancedSowingAuthorizations(
                    [existingItem.id],
                    db,
                )
            ).has(existingItem.id)
        ) {
            throw new AdvancedSowingCartItemExplicitIdentityRequiredError(
                'Advanced Sowing cart items require an explicit cart item ID.',
            );
        }
        const [mutationCart] = await db
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
        if (!mutationCart) {
            throw new Error('Shopping cart not found');
        }
        await assertNoActiveStripeCheckoutAttempt(cartId, db);
        if (existingItem) {
            if (!mutationCart.accountId) {
                throw new Error('Shopping cart account is missing');
            }
            const fulfillmentStartedItemIds =
                await getCheckoutFulfillmentStartedCartItemIds(
                    mutationCart.accountId,
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
                await clearShoppingCartItemAdvancedSowingAuthorization(
                    existingItem.id,
                    db,
                );
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
            const targetChanged =
                amount !== existingItem.amount ||
                entityId !== existingItem.entityId ||
                entityTypeName !== existingItem.entityTypeName ||
                (gardenId !== undefined &&
                    gardenId !== existingItem.gardenId) ||
                (raisedBedId !== undefined &&
                    raisedBedId !== existingItem.raisedBedId) ||
                (typeof positionIndex === 'number' &&
                    positionIndex !== existingItem.positionIndex);
            if (targetChanged) {
                await clearShoppingCartItemAdvancedSowingAuthorization(
                    existingItem.id,
                    db,
                );
            }
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
        if (
            entityTypeName === 'plantSort' &&
            typeof gardenId === 'number' &&
            typeof raisedBedId === 'number' &&
            typeof positionIndex === 'number'
        ) {
            await assertNoOutletReservationAtDirectTarget(
                { cartId, gardenId, positionIndex, raisedBedId },
                db,
            );
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

/**
 * Mutates a cart item and its server-owned Advanced Sowing authorization under
 * the same checkout/cart-item fence. Client routes must never write the
 * authorization table separately or place this envelope in additionalData.
 */
export async function upsertOrRemoveCartItemWithAdvancedSowingAuthorization({
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
    authorization,
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
    authorization: AdvancedSowingCartAuthorizationV1 | null;
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
        if (cartItemId && authorization) {
            if (await getOutletOfferReservationForCartItem(cartItemId, tx)) {
                throw new AdvancedSowingCartAuthorizationPersistenceError(
                    'Advanced Sowing cannot replace an outlet-reserved cart item.',
                );
            }
            if (
                typeof gardenId !== 'number' ||
                typeof raisedBedId !== 'number'
            ) {
                throw new AdvancedSowingCartAuthorizationPersistenceError(
                    'Advanced Sowing target is incomplete.',
                );
            }
            const bedItems = await getLivePlantCartItemsForBed(
                { cartId, gardenId, raisedBedId },
                tx,
                true,
            );
            for (const targetItem of bedItems) {
                if (
                    targetItem.id === cartItemId ||
                    targetItem.positionIndex === null ||
                    !authorization.plan.occupiedPositionIndices.includes(
                        targetItem.positionIndex,
                    )
                ) {
                    continue;
                }
                const reservation = await getOutletOfferReservationForCartItem(
                    targetItem.id,
                    tx,
                );
                if (reservation?.status === 'held') {
                    throw new AdvancedSowingCartAuthorizationPersistenceError(
                        'Advanced Sowing target overlaps an Outlet reservation.',
                    );
                }
            }
            await persistShoppingCartItemAdvancedSowingAuthorization(
                cartItemId,
                authorization,
                tx,
                {
                    cartId,
                    entityId,
                    entityTypeName,
                    gardenId,
                    raisedBedId,
                },
            );
        } else if (cartItemId) {
            await clearShoppingCartItemAdvancedSowingAuthorization(
                cartItemId,
                tx,
            );
        }
        return cartItemId;
    });
}

type IdlessOutletCartItemMutation = {
    accountId: string;
    additionalData?: string | null;
    amount: number;
    cartId: number;
    currency?: string | null;
    entityId: string;
    entityTypeName: string;
    gardenId: number;
    holdMinutes?: number;
    now: Date;
    outletOfferId: number;
    positionIndex: number;
    raisedBedId: number;
};

type ExplicitOutletCartItemMutation = IdlessOutletCartItemMutation & {
    id: number;
};

function isSupportedOutletCartCurrency(
    currency: string | null | undefined,
): currency is 'eur' | 'sunflower' {
    return currency === 'eur' || currency === 'sunflower';
}

async function getLivePlantCartItemsForBed(
    {
        cartId,
        gardenId,
        raisedBedId,
    }: Pick<
        IdlessOutletCartItemMutation,
        'cartId' | 'gardenId' | 'raisedBedId'
    >,
    db: DatabaseClient,
    lockRows = false,
) {
    const query = db
        .select()
        .from(shoppingCartItems)
        .where(
            and(
                eq(shoppingCartItems.cartId, cartId),
                eq(shoppingCartItems.entityTypeName, 'plantSort'),
                eq(shoppingCartItems.gardenId, gardenId),
                eq(shoppingCartItems.raisedBedId, raisedBedId),
                eq(shoppingCartItems.isDeleted, false),
                gt(shoppingCartItems.amount, 0),
            ),
        )
        .orderBy(asc(shoppingCartItems.id));

    return lockRows ? query.for('update') : query;
}

function getPlantCartItemsAtPosition<
    T extends { id: number; positionIndex: number | null },
>(items: readonly T[], positionIndex: number): T[] {
    return items.filter((item) => item.positionIndex === positionIndex);
}

function sameCartItemIds(
    expectedIds: readonly number[],
    items: readonly { id: number }[],
) {
    return (
        expectedIds.length === items.length &&
        expectedIds.every((id, index) => id === items[index]?.id)
    );
}

async function assertNoPendingAdvancedSowingFootprintAtTarget(
    items: readonly { id: number; status: string }[],
    positionIndex: number,
    db: TransactionClient,
    excludedCartItemId?: number,
) {
    const pendingItemIds = items
        .filter(
            (item) => item.status === 'new' && item.id !== excludedCartItemId,
        )
        .map((item) => item.id);
    let authorizations: Awaited<
        ReturnType<typeof getShoppingCartItemAdvancedSowingAuthorizations>
    >;
    try {
        authorizations = await getShoppingCartItemAdvancedSowingAuthorizations(
            pendingItemIds,
            db,
        );
    } catch (error) {
        if (error instanceof AdvancedSowingCartAuthorizationPersistenceError) {
            throw new OutletCartTargetUnavailableError();
        }
        throw error;
    }
    if (
        Array.from(authorizations.values()).some((authorization) =>
            authorization.plan.occupiedPositionIndices.includes(positionIndex),
        )
    ) {
        throw new OutletCartTargetUnavailableError();
    }
}

async function lockCartForOutletMutation(
    {
        accountId,
        cartId,
    }: Pick<IdlessOutletCartItemMutation, 'accountId' | 'cartId'>,
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
    if (
        !cart ||
        cart.accountId !== accountId ||
        cart.isDeleted ||
        cart.status !== 'new'
    ) {
        throw new OutletReservationUnavailableError(
            'Outlet reservation cart is no longer mutable.',
        );
    }
    await assertNoActiveStripeCheckoutAttempt(cartId, db);
}

async function applyIdlessOutletCartItemMutation(
    mutation: IdlessOutletCartItemMutation,
    discoveredBedItemIds: readonly number[],
    db: TransactionClient,
) {
    await lockCartForOutletMutation(mutation, db);
    const bedItems = await getLivePlantCartItemsForBed(mutation, db, true);
    if (!sameCartItemIds(discoveredBedItemIds, bedItems)) {
        throw new OutletCartTargetChangedDuringMutationError();
    }
    await assertNoPendingAdvancedSowingFootprintAtTarget(
        bedItems,
        mutation.positionIndex,
        db,
    );
    const targetItems = getPlantCartItemsAtPosition(
        bedItems,
        mutation.positionIndex,
    );

    const normalizedAdditionalData =
        mutation.additionalData === undefined
            ? undefined
            : normalizeScheduledDateAdditionalData(mutation.additionalData);
    const existingItem = targetItems[0];
    if (existingItem) {
        if (targetItems.length !== 1) {
            throw new OutletCartTargetUnavailableError();
        }
        const reservation = await getOutletOfferReservationForCartItem(
            existingItem.id,
            db,
        );
        const isExactRetry =
            existingItem.entityId === mutation.entityId &&
            existingItem.entityTypeName === mutation.entityTypeName &&
            existingItem.amount === mutation.amount &&
            reservation?.accountId === mutation.accountId &&
            reservation.cartId === mutation.cartId &&
            reservation.cartItemId === existingItem.id &&
            reservation.outletOfferId === mutation.outletOfferId &&
            reservation.status === 'held';
        if (!isExactRetry) {
            throw new OutletCartTargetUnavailableError();
        }

        const fulfillmentStartedItemIds =
            await getCheckoutFulfillmentStartedCartItemIds(
                mutation.accountId,
                [existingItem],
                db,
            );
        if (fulfillmentStartedItemIds.has(existingItem.id)) {
            throw new CheckoutCartItemFulfillmentStartedError(existingItem.id);
        }

        const finalCurrency = mutation.currency ?? existingItem.currency;
        if (!isSupportedOutletCartCurrency(finalCurrency)) {
            throw new OutletReservationUnavailableError(
                'Outlet cart item has an unsupported currency.',
            );
        }
        if (existingItem.currency !== finalCurrency) {
            await db
                .update(shoppingCartItems)
                .set({ currency: finalCurrency })
                .where(eq(shoppingCartItems.id, existingItem.id));
        }
        await clearShoppingCartItemAdvancedSowingAuthorization(
            existingItem.id,
            db,
        );
        await reserveOutletOffer({
            offerId: mutation.outletOfferId,
            accountId: mutation.accountId,
            cartId: mutation.cartId,
            cartItemId: existingItem.id,
            quantity: mutation.amount,
            now: mutation.now,
            holdMinutes: mutation.holdMinutes,
            db,
        });
        return existingItem.id;
    }

    const finalCurrency = mutation.currency ?? 'eur';
    if (!isSupportedOutletCartCurrency(finalCurrency)) {
        throw new OutletReservationUnavailableError(
            'Outlet cart item has an unsupported currency.',
        );
    }
    const [createdItem] = await db
        .insert(shoppingCartItems)
        .values({
            cartId: mutation.cartId,
            entityId: mutation.entityId,
            entityTypeName: mutation.entityTypeName,
            amount: mutation.amount,
            gardenId: mutation.gardenId,
            raisedBedId: mutation.raisedBedId,
            positionIndex: mutation.positionIndex,
            additionalData: normalizedAdditionalData,
            currency: finalCurrency,
        })
        .returning({ id: shoppingCartItems.id });
    if (!createdItem) {
        throw new OutletReservationUnavailableError(
            'Outlet cart item could not be created.',
        );
    }
    await reserveOutletOffer({
        offerId: mutation.outletOfferId,
        accountId: mutation.accountId,
        cartId: mutation.cartId,
        cartItemId: createdItem.id,
        quantity: mutation.amount,
        now: mutation.now,
        holdMinutes: mutation.holdMinutes,
        db,
    });
    return createdItem.id;
}

async function assertNoOutletReservationAtDirectTarget(
    {
        cartId,
        gardenId,
        positionIndex,
        raisedBedId,
    }: {
        cartId: number;
        gardenId: number;
        positionIndex: number;
        raisedBedId: number;
    },
    db: TransactionClient,
    excludedCartItemId?: number,
) {
    const bedItems = await getLivePlantCartItemsForBed(
        { cartId, gardenId, raisedBedId },
        db,
        true,
    );
    const targetItems = getPlantCartItemsAtPosition(bedItems, positionIndex);
    for (const targetItem of targetItems) {
        if (targetItem.id === excludedCartItemId) {
            continue;
        }
        const reservation = await getOutletOfferReservationForCartItem(
            targetItem.id,
            db,
        );
        if (reservation?.status === 'held') {
            throw new OutletCartTargetUnavailableError();
        }
    }
}

async function applyExplicitOutletCartItemMutation(
    mutation: ExplicitOutletCartItemMutation,
    discoveredBedItemIds: readonly number[],
    db: TransactionClient,
) {
    await lockCartForOutletMutation(mutation, db);
    const bedItems = await getLivePlantCartItemsForBed(mutation, db, true);
    if (!sameCartItemIds(discoveredBedItemIds, bedItems)) {
        throw new OutletCartTargetChangedDuringMutationError();
    }

    const [existingItem] = await db
        .select()
        .from(shoppingCartItems)
        .where(
            and(
                eq(shoppingCartItems.id, mutation.id),
                eq(shoppingCartItems.isDeleted, false),
            ),
        )
        .for('update')
        .limit(1);
    if (!existingItem || existingItem.cartId !== mutation.cartId) {
        throw new OutletReservationUnavailableError(
            'Outlet cart item is no longer available.',
        );
    }
    if (existingItem.status === 'paid') {
        throw new Error('Cannot update paid shopping cart item via API');
    }

    const fulfillmentStartedItemIds =
        await getCheckoutFulfillmentStartedCartItemIds(
            mutation.accountId,
            [existingItem],
            db,
        );
    if (fulfillmentStartedItemIds.has(existingItem.id)) {
        throw new CheckoutCartItemFulfillmentStartedError(existingItem.id);
    }
    await assertNoPendingAdvancedSowingFootprintAtTarget(
        bedItems,
        mutation.positionIndex,
        db,
        existingItem.id,
    );
    const targetItems = getPlantCartItemsAtPosition(
        bedItems,
        mutation.positionIndex,
    );

    const reservation = await getOutletOfferReservationForCartItem(
        existingItem.id,
        db,
    );
    const hasMatchingHeldReservation =
        reservation?.accountId === mutation.accountId &&
        reservation.cartId === mutation.cartId &&
        reservation.cartItemId === existingItem.id &&
        reservation.outletOfferId === mutation.outletOfferId &&
        reservation.quantity === mutation.amount &&
        reservation.status === 'held';
    const hasMatchingStaticTarget =
        existingItem.entityId === mutation.entityId &&
        existingItem.entityTypeName === mutation.entityTypeName &&
        existingItem.gardenId === mutation.gardenId &&
        existingItem.raisedBedId === mutation.raisedBedId;
    const isPureHeldReservationPositionMove =
        hasMatchingHeldReservation &&
        hasMatchingStaticTarget &&
        existingItem.amount === mutation.amount &&
        existingItem.positionIndex !== mutation.positionIndex;

    if (
        !hasMatchingStaticTarget ||
        (existingItem.positionIndex !== mutation.positionIndex &&
            !isPureHeldReservationPositionMove)
    ) {
        throw new OutletCartTargetUnavailableError();
    }
    const otherTargetItems = targetItems.filter(
        (item) => item.id !== existingItem.id,
    );
    if (otherTargetItems.length > 0) {
        if (
            !isPureHeldReservationPositionMove ||
            otherTargetItems.length !== 1 ||
            existingItem.positionIndex === null
        ) {
            throw new OutletCartTargetUnavailableError();
        }
        const swapItem = otherTargetItems[0];
        if (swapItem?.status !== 'new') {
            throw new OutletCartTargetUnavailableError();
        }
        let swapItemAuthorizations: Awaited<
            ReturnType<typeof getShoppingCartItemAdvancedSowingAuthorizations>
        >;
        try {
            swapItemAuthorizations =
                await getShoppingCartItemAdvancedSowingAuthorizations(
                    [swapItem.id],
                    db,
                );
        } catch (error) {
            if (
                error instanceof AdvancedSowingCartAuthorizationPersistenceError
            ) {
                throw new OutletCartTargetUnavailableError();
            }
            throw error;
        }
        if (swapItemAuthorizations.has(swapItem.id)) {
            throw new OutletCartTargetUnavailableError();
        }
        const swapItemFulfillmentStartedIds =
            await getCheckoutFulfillmentStartedCartItemIds(
                mutation.accountId,
                [swapItem],
                db,
            );
        if (swapItemFulfillmentStartedIds.has(swapItem.id)) {
            throw new CheckoutCartItemFulfillmentStartedError(swapItem.id);
        }
        await assertNoPendingAdvancedSowingFootprintAtTarget(
            bedItems,
            existingItem.positionIndex,
            db,
            existingItem.id,
        );
        const oldPositionItems = getPlantCartItemsAtPosition(
            bedItems,
            existingItem.positionIndex,
        ).filter((item) => item.id !== existingItem.id);
        if (oldPositionItems.length > 0) {
            throw new OutletCartTargetUnavailableError();
        }
        await db
            .update(shoppingCartItems)
            .set({ positionIndex: existingItem.positionIndex })
            .where(eq(shoppingCartItems.id, swapItem.id));
    }

    const finalCurrency = mutation.currency ?? existingItem.currency;
    if (!isSupportedOutletCartCurrency(finalCurrency)) {
        throw new OutletReservationUnavailableError(
            'Outlet cart item has an unsupported currency.',
        );
    }
    const normalizedAdditionalData =
        mutation.additionalData === undefined
            ? undefined
            : normalizeScheduledDateAdditionalData(mutation.additionalData);
    await db
        .update(shoppingCartItems)
        .set({
            additionalData: normalizedAdditionalData,
            amount: mutation.amount,
            currency: finalCurrency,
            positionIndex: mutation.positionIndex,
        })
        .where(eq(shoppingCartItems.id, existingItem.id));
    await clearShoppingCartItemAdvancedSowingAuthorization(existingItem.id, db);
    await reserveOutletOffer({
        offerId: mutation.outletOfferId,
        accountId: mutation.accountId,
        cartId: mutation.cartId,
        cartItemId: existingItem.id,
        quantity: mutation.amount,
        now: mutation.now,
        holdMinutes: mutation.holdMinutes,
        db,
    });
    return existingItem.id;
}

async function upsertIdlessOutletCartItemWithReservation(
    mutation: IdlessOutletCartItemMutation,
) {
    const retryLimit = 4;
    for (let attempt = 0; attempt < retryLimit; attempt += 1) {
        const discoveredItems = await getLivePlantCartItemsForBed(
            mutation,
            storage(),
        );
        const discoveredItemIds = discoveredItems.map((item) => item.id);
        try {
            return await withCheckoutCartItemLocks(discoveredItemIds, (db) =>
                applyIdlessOutletCartItemMutation(
                    mutation,
                    discoveredItemIds,
                    db,
                ),
            );
        } catch (error) {
            if (
                error instanceof OutletCartTargetChangedDuringMutationError &&
                attempt + 1 < retryLimit
            ) {
                continue;
            }
            if (error instanceof OutletCartTargetChangedDuringMutationError) {
                throw new OutletCartTargetUnavailableError();
            }
            throw error;
        }
    }
    throw new OutletCartTargetUnavailableError();
}

async function upsertExplicitOutletCartItemWithReservation(
    mutation: ExplicitOutletCartItemMutation,
) {
    const retryLimit = 4;
    for (let attempt = 0; attempt < retryLimit; attempt += 1) {
        const discoveredBedItems = await getLivePlantCartItemsForBed(
            mutation,
            storage(),
        );
        const discoveredBedItemIds = discoveredBedItems.map((item) => item.id);
        const lockItemIds = [...discoveredBedItemIds, mutation.id];
        try {
            return await withCheckoutCartItemLocks(lockItemIds, (db) =>
                applyExplicitOutletCartItemMutation(
                    mutation,
                    discoveredBedItemIds,
                    db,
                ),
            );
        } catch (error) {
            if (
                error instanceof OutletCartTargetChangedDuringMutationError &&
                attempt + 1 < retryLimit
            ) {
                continue;
            }
            if (error instanceof OutletCartTargetChangedDuringMutationError) {
                throw new OutletCartTargetUnavailableError();
            }
            throw error;
        }
    }
    throw new OutletCartTargetUnavailableError();
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
    if (amount > 0 && amount !== 1) {
        throw new OutletReservationUnavailableError(
            'Outlet cart items require exactly one plant.',
        );
    }
    if (amount > 0) {
        if (
            typeof gardenId !== 'number' ||
            !Number.isSafeInteger(gardenId) ||
            gardenId <= 0 ||
            typeof raisedBedId !== 'number' ||
            !Number.isSafeInteger(raisedBedId) ||
            raisedBedId <= 0 ||
            typeof positionIndex !== 'number' ||
            !Number.isSafeInteger(positionIndex) ||
            positionIndex < 0
        ) {
            throw new OutletCartTargetUnavailableError();
        }
        const mutation = {
            accountId,
            additionalData,
            amount,
            cartId,
            currency,
            entityId,
            entityTypeName,
            gardenId,
            holdMinutes,
            now,
            outletOfferId,
            positionIndex,
            raisedBedId,
        };
        if (id == null) {
            return upsertIdlessOutletCartItemWithReservation(mutation);
        }
        if (forceCreate) {
            throw new Error('Cannot create an item with an existing ID');
        }
        return upsertExplicitOutletCartItemWithReservation({
            ...mutation,
            id,
        });
    }

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
            const persistedCartItem =
                await tx.query.shoppingCartItems.findFirst({
                    columns: { currency: true },
                    where: eq(shoppingCartItems.id, cartItemId),
                });
            if (
                !persistedCartItem ||
                !isSupportedOutletCartCurrency(persistedCartItem.currency)
            ) {
                throw new OutletReservationUnavailableError(
                    'Outlet cart item has an unsupported currency.',
                );
            }
            await clearShoppingCartItemAdvancedSowingAuthorization(
                cartItemId,
                tx,
            );
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
                await assertNoActiveStripeCheckoutAttempt(lockedCart.id, db);

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
                if (liveItemIds.length > 0) {
                    await db
                        .delete(shoppingCartItemAdvancedSowingAuthorizations)
                        .where(
                            inArray(
                                shoppingCartItemAdvancedSowingAuthorizations.cartItemId,
                                liveItemIds,
                            ),
                        );
                }
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
        const [lockedCart] = await checkoutTx
            .select({ id: shoppingCarts.id })
            .from(shoppingCarts)
            .where(eq(shoppingCarts.id, cartId))
            .for('update')
            .limit(1);
        if (
            !lockedCart ||
            (await getActiveStripeCheckoutAttempt(cartId, checkoutTx))
        ) {
            return;
        }
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
                    await clearShoppingCartItemAdvancedSowingAuthorization(
                        item.id,
                        tx,
                    );

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
