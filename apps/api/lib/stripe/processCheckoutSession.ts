import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    notifyDeliveryRequestEvent,
    notifyOperationUpdate,
    notifyPurchase,
} from '@gredice/notifications';
import {
    consumeInventoryItem,
    convertOutletReservationForCartItem,
    createDeliveryRequest,
    createEvent,
    createOperation,
    createTransaction,
    earnSunflowersForPayment,
    getCompletedTransactionByStripePaymentId,
    getDefaultShoppingCartScheduledDate,
    getInventory,
    getOutletOfferReservationForCartItem,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    isCartItemDeliverable,
    knownEvents,
    markCartPaidIfAllItemsPaid,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    setCartItemPaid,
    spendSunflowers,
    updateRaisedBed,
    upsertRaisedBedField,
    withStripePaymentProcessingLock,
} from '@gredice/storage';
import { getStripeCheckoutSession } from '@gredice/stripe/server';
import {
    getCartInfo,
    type ShoppingCartItemWithShopData,
} from '../checkout/cartInfo';
import { calculateSunflowerAmount } from '../checkout/sunflowerCalculations';
import { notifyDeliveryScheduled } from '../delivery/emailNotifications';
import { notifyScheduledDeliveryEmailOnce } from '../delivery/scheduledEmailDeduper';
import { getPostHogClient } from '../posthog-server';

export type ProcessCheckoutSessionDependencies = {
    isRaisedBedAbandoned: typeof isRaisedBedAbandoned;
    notifyDeliveryRequestEvent: typeof notifyDeliveryRequestEvent;
    notifyOperationUpdate: typeof notifyOperationUpdate;
    notifyPurchase: typeof notifyPurchase;
    consumeInventoryItem: typeof consumeInventoryItem;
    convertOutletReservationForCartItem: typeof convertOutletReservationForCartItem;
    createDeliveryRequest: typeof createDeliveryRequest;
    createEvent: typeof createEvent;
    createOperation: typeof createOperation;
    createTransaction: typeof createTransaction;
    earnSunflowersForPayment: typeof earnSunflowersForPayment;
    getCompletedTransactionByStripePaymentId: typeof getCompletedTransactionByStripePaymentId;
    getDefaultShoppingCartScheduledDate: typeof getDefaultShoppingCartScheduledDate;
    getInventory: typeof getInventory;
    getOutletOfferReservationForCartItem: typeof getOutletOfferReservationForCartItem;
    getRaisedBed: typeof getRaisedBed;
    getRaisedBedFieldsWithEvents: typeof getRaisedBedFieldsWithEvents;
    getShoppingCart: typeof getShoppingCart;
    isCartItemDeliverable: typeof isCartItemDeliverable;
    knownEvents: typeof knownEvents;
    markCartPaidIfAllItemsPaid: typeof markCartPaidIfAllItemsPaid;
    normalizeShoppingCartInventoryUsage: typeof normalizeShoppingCartInventoryUsage;
    normalizeShoppingCartScheduledDates: typeof normalizeShoppingCartScheduledDates;
    setCartItemPaid: typeof setCartItemPaid;
    spendSunflowers: typeof spendSunflowers;
    updateRaisedBed: typeof updateRaisedBed;
    upsertRaisedBedField: typeof upsertRaisedBedField;
    withStripePaymentProcessingLock: typeof withStripePaymentProcessingLock;
    getStripeCheckoutSession: typeof getStripeCheckoutSession;
    getCartInfo: typeof getCartInfo;
    calculateSunflowerAmount: typeof calculateSunflowerAmount;
    notifyDeliveryScheduled: typeof notifyDeliveryScheduled;
    notifyScheduledDeliveryEmailOnce: typeof notifyScheduledDeliveryEmailOnce;
    getPostHogClient: typeof getPostHogClient;
};

const realDependencies: ProcessCheckoutSessionDependencies = {
    isRaisedBedAbandoned,
    notifyDeliveryRequestEvent,
    notifyOperationUpdate,
    notifyPurchase,
    consumeInventoryItem,
    convertOutletReservationForCartItem,
    createDeliveryRequest,
    createEvent,
    createOperation,
    createTransaction,
    earnSunflowersForPayment,
    getCompletedTransactionByStripePaymentId,
    getDefaultShoppingCartScheduledDate,
    getInventory,
    getOutletOfferReservationForCartItem,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    isCartItemDeliverable,
    knownEvents,
    markCartPaidIfAllItemsPaid,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    setCartItemPaid,
    spendSunflowers,
    updateRaisedBed,
    upsertRaisedBedField,
    withStripePaymentProcessingLock,
    getStripeCheckoutSession,
    getCartInfo,
    calculateSunflowerAmount,
    notifyDeliveryScheduled,
    notifyScheduledDeliveryEmailOnce,
    getPostHogClient,
};

/**
 * Recursively sorts object keys for deterministic JSON serialization.
 * Handles nested objects and arrays to ensure consistent comparison.
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    return Object.keys(obj)
        .sort()
        .reduce((result: Record<string, unknown>, key) => {
            result[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
            return result;
        }, {});
}

async function processNonStripeCartItems(
    cartId: number,
    accountId: string,
    deliveryInfo?: unknown,
    scheduledDeliveryEmailKeys?: Set<string>,
    checkoutSessionId?: string | null,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
): Promise<ShoppingCartItemWithShopData[]> {
    const inventoryNormalizedCart =
        await dependencies.normalizeShoppingCartInventoryUsage(cartId);
    if (!inventoryNormalizedCart) {
        console.warn(
            `No cart found for ID ${cartId} when processing non-stripe items.`,
        );
        return [];
    }
    const cart =
        (await dependencies.normalizeShoppingCartScheduledDates(
            inventoryNormalizedCart.id,
            {
                defaultMissingScheduledDates: true,
            },
        )) ?? inventoryNormalizedCart;

    const cartInfo = await dependencies.getCartInfo(cart.items, accountId);
    if (!cartInfo.allowPurchase) {
        console.warn(
            `Cart ${cartId} failed validation when processing non-stripe items: ${cartInfo.notes.join('; ')}`,
        );
        return [];
    }

    const sunflowerCartItemsWithShopData = cartInfo.items.filter(
        (item) => item.status !== 'paid' && item.currency === 'sunflower',
    );

    // Precompute sunflower amounts and total required, so we can spend in a single operation
    const sunflowerAmountsByItem = new Map<number, number>();
    let totalSunflowersToSpend = 0;

    for (const item of sunflowerCartItemsWithShopData) {
        const sunflowerAmount = dependencies.calculateSunflowerAmount(item);
        sunflowerAmountsByItem.set(item.id, sunflowerAmount);
        totalSunflowersToSpend += sunflowerAmount;
    }

    let didSpendSunflowersForCart = false;
    if (totalSunflowersToSpend > 0) {
        try {
            // Spend all sunflowers in a single transaction for the entire cart
            // to prevent race conditions. Reference format: shoppingCart:${cartId}
            // (Note: This differs from immediate processing which uses shoppingCartItem:${item.id})
            await dependencies.spendSunflowers(
                accountId,
                totalSunflowersToSpend,
                `shoppingCart:${cartId}`,
            );
            didSpendSunflowersForCart = true;
        } catch (error) {
            console.error('Error spending sunflowers during cart processing', {
                error,
                accountId,
                totalSunflowersToSpend,
                cartId,
            });
        }
    }

    if (didSpendSunflowersForCart) {
        for (const item of sunflowerCartItemsWithShopData) {
            const sunflowerAmount = sunflowerAmountsByItem.get(item.id) ?? 0;
            const baseAdditionalData = item.additionalData
                ? JSON.parse(item.additionalData)
                : {};
            const additionalData = {
                ...baseAdditionalData,
                ...(deliveryInfo ? { delivery: deliveryInfo } : {}),
            };

            await Promise.all([
                dependencies.setCartItemPaid(item.id),
                processItem(
                    {
                        accountId,
                        cartItemId: item.id,
                        entityId: item.entityId,
                        entityTypeName: item.entityTypeName,
                        cartId: item.cartId,
                        gardenId: item.gardenId,
                        raisedBedId: item.raisedBedId,
                        positionIndex: item.positionIndex,
                        currency: item.currency,
                        amount_total: sunflowerAmount,
                        additionalData,
                        scheduledDeliveryEmailKeys,
                        checkoutSessionId,
                    },
                    dependencies,
                ),
            ]);
        }
    }

    const inventoryCartItems = cartInfo.items.filter(
        (item) =>
            item.status !== 'paid' &&
            (item.currency === 'inventory' || item.usesInventory),
    );

    // Helper function to generate inventory key
    const getInventoryKey = (item: {
        entityTypeName: string;
        entityId: string;
    }) => `${item.entityTypeName}-${item.entityId}`;

    // Pre-validate that total required inventory for all items is available
    // This prevents partial processing when multiple items consume the same inventory
    let inventoryLookup = new Map<string, number>();
    if (inventoryCartItems.length > 0) {
        const inventory = await dependencies.getInventory(accountId);
        inventoryLookup = new Map(
            inventory.map((inventoryItem) => [
                getInventoryKey(inventoryItem),
                inventoryItem.amount,
            ]),
        );

        // Calculate total required inventory for each unique entity
        const requiredInventory = new Map<string, number>();
        for (const item of inventoryCartItems) {
            const inventoryKey = getInventoryKey(item);
            const currentRequired = requiredInventory.get(inventoryKey) ?? 0;
            requiredInventory.set(inventoryKey, currentRequired + item.amount);
        }

        // Validate all required inventory is available before processing any items
        for (const [
            inventoryKey,
            requiredAmount,
        ] of requiredInventory.entries()) {
            const available = inventoryLookup.get(inventoryKey) ?? 0;
            if (available < requiredAmount) {
                const errorMsg = `Insufficient inventory for key ${inventoryKey} in cart ${cartId}. Required: ${requiredAmount}, Available: ${available}. Manual intervention required to refund or fulfill this order.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        for (const item of inventoryCartItems) {
            const inventoryKey = getInventoryKey(item);
            const available = inventoryLookup.get(inventoryKey) ?? 0;
            const baseAdditionalData = item.additionalData
                ? JSON.parse(item.additionalData)
                : {};
            const additionalData = {
                ...baseAdditionalData,
                ...(deliveryInfo ? { delivery: deliveryInfo } : {}),
            };

            await Promise.all([
                dependencies.consumeInventoryItem(accountId, {
                    entityTypeName: item.entityTypeName,
                    entityId: item.entityId,
                    amount: item.amount,
                    source: `shoppingCartItem:${item.id}`,
                }),
                dependencies.setCartItemPaid(item.id),
                processItem(
                    {
                        accountId,
                        cartItemId: item.id,
                        entityId: item.entityId,
                        entityTypeName: item.entityTypeName,
                        cartId: item.cartId,
                        gardenId: item.gardenId,
                        raisedBedId: item.raisedBedId,
                        positionIndex: item.positionIndex,
                        currency: item.currency,
                        amount_total: 0,
                        additionalData,
                        scheduledDeliveryEmailKeys,
                        checkoutSessionId,
                    },
                    dependencies,
                ),
            ]);

            // Update the lookup to reflect consumed inventory
            inventoryLookup.set(inventoryKey, available - item.amount);
        }
    }

    return cartInfo.items;
}

export async function processCheckoutSession(
    checkoutSessionId?: string,
    dependenciesOrMapIndex:
        | ProcessCheckoutSessionDependencies
        | number = realDependencies,
) {
    const dependencies =
        typeof dependenciesOrMapIndex === 'number'
            ? realDependencies
            : dependenciesOrMapIndex;

    if (!checkoutSessionId) {
        console.warn(`No checkout session ID provided`);
        return;
    }

    const session =
        await dependencies.getStripeCheckoutSession(checkoutSessionId);
    if (!session) {
        console.warn(`No session found for ID ${checkoutSessionId}`);
        return;
    }
    if (session.status !== 'complete') {
        console.warn(
            `Session ${checkoutSessionId} is not complete, current status: ${session.status}`,
        );
        return;
    }
    if (session.paymentStatus !== 'paid') {
        console.warn(
            `Payment not completed for session ${checkoutSessionId} with status: ${session.paymentStatus}`,
        );
        return;
    }

    return dependencies.withStripePaymentProcessingLock(session.id, () =>
        processPaidCheckoutSession(checkoutSessionId, session, dependencies),
    );
}

async function processPaidCheckoutSession(
    checkoutSessionId: string,
    session: NonNullable<Awaited<ReturnType<typeof getStripeCheckoutSession>>>,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    const alreadyProcessed =
        await dependencies.getCompletedTransactionByStripePaymentId(session.id);
    if (alreadyProcessed) {
        console.info(
            `Checkout session ${checkoutSessionId} already processed; skipping.`,
        );
        return;
    }

    console.debug(
        `Processing checkout session ${checkoutSessionId} with amount ${session.amountTotal} cents`,
    );

    const affectedCartIds: number[] = [];
    const purchasedItems: {
        name?: string | null;
        quantity?: number | null;
        amountSubtotal?: number | null;
    }[] = [];
    const scheduledDeliveryEmailKeys = new Set<string>();
    let accountId: string | undefined;
    for (const item of session.lineItems?.data ?? []) {
        console.debug(`Item: ${item.id} Quantity: ${item.quantity}`);

        const product = item.price?.product;
        if (typeof product === 'string') {
            console.warn(
                `Product is a string: ${product}. This is not supported.`,
            );
            continue;
        }

        if (product?.deleted) {
            console.warn(
                `Product is deleted: ${product.id}. This is not supported.`,
            );
            continue;
        }

        purchasedItems.push({
            name:
                typeof product?.name === 'string'
                    ? `${product.name}${
                          product.metadata?.outletOfferId
                              ? ` (Outlet #${product.metadata.outletOfferId}${
                                    product.metadata.outletSowingDate
                                        ? `, sjetva ${product.metadata.outletSowingDate.slice(0, 10)}`
                                        : ''
                                })`
                              : ''
                      }`
                    : (product?.metadata?.name ?? null),
            quantity: item.quantity ?? null,
            amountSubtotal:
                (item as { amount_subtotal?: number }).amount_subtotal ??
                item.amount_total ??
                null,
        });

        // Extract metadata from the product
        const itemData = {
            cartItemId: product?.metadata.cartItemId
                ? parseInt(product.metadata.cartItemId, 10)
                : undefined,
            entityId: product?.metadata.entityId,
            entityTypeName: product?.metadata.entityTypeName,
            accountId: product?.metadata.accountId,
            userId: product?.metadata.userId,
            cartId: product?.metadata.cartId
                ? parseInt(product.metadata.cartId, 10)
                : undefined,
            gardenId: product?.metadata.gardenId
                ? parseInt(product.metadata.gardenId, 10)
                : undefined,
            raisedBedId: product?.metadata.raisedBedId
                ? parseInt(product.metadata.raisedBedId, 10)
                : undefined,
            positionIndex: product?.metadata.positionIndex
                ? parseInt(product.metadata.positionIndex, 10)
                : undefined,
            additionalData: product?.metadata.additionalData
                ? JSON.parse(product.metadata.additionalData)
                : undefined,
            outletOfferId: product?.metadata.outletOfferId
                ? parseInt(product.metadata.outletOfferId, 10)
                : undefined,
            outletReservationId: product?.metadata.outletReservationId
                ? parseInt(product.metadata.outletReservationId, 10)
                : undefined,
            outletSowingDate: product?.metadata.outletSowingDate ?? undefined,
            outletInitialPlantStatus:
                product?.metadata.outletInitialPlantStatus ?? undefined,
            outletPriceCents: product?.metadata.outletPriceCents
                ? parseInt(product.metadata.outletPriceCents, 10)
                : undefined,
            currency: 'eur',
        };

        // Save accountId from metadata if not already set
        accountId ??= itemData.accountId;

        // Validate required metadata (accountId can be derived from cart)
        if (
            !itemData.cartItemId ||
            !itemData.entityId ||
            !itemData.entityTypeName ||
            !itemData.cartId
        ) {
            console.warn(
                `Missing required metadata for item ${item.id} in session ${checkoutSessionId}`,
            );
            continue;
        }

        // Process cart item
        try {
            let resolvedAccountId: string | undefined;
            const cart = await dependencies.getShoppingCart(itemData.cartId);
            if (!cart) {
                console.warn(
                    `No cart found for ID ${itemData.cartId} in session ${checkoutSessionId}`,
                );
                continue;
            }

            resolvedAccountId =
                itemData.accountId ?? cart.accountId ?? undefined;
            if (!resolvedAccountId) {
                console.warn(
                    `Missing accountId for cart ${itemData.cartId} when processing session ${checkoutSessionId}`,
                );
                continue;
            }

            // Ensure we have an accountId for the whole session (prefer the cart value)
            if (accountId && accountId !== resolvedAccountId) {
                console.warn(
                    `AccountId mismatch for session ${checkoutSessionId}: metadata ${accountId} vs cart ${resolvedAccountId}. Using cart accountId.`,
                );
            }
            accountId = resolvedAccountId;

            // Find cart item by cartItemId for more reliable matching
            const cartItem = cart.items.find(
                (i) => i.id === itemData.cartItemId,
            );

            if (cartItem?.status === 'paid') {
                console.warn(
                    `Cart item ${cartItem.id} is already paid. Skipping so we don't double process.`,
                );
                continue;
            }
            if (!cartItem) {
                console.warn(
                    `No cart item found with ID ${itemData.cartItemId} in cart ${itemData.cartId} for session ${checkoutSessionId}`,
                );
                continue;
            }

            // Additional validation: ensure the cart item matches the expected entity details
            if (
                cartItem.entityId !== itemData.entityId ||
                cartItem.entityTypeName !== itemData.entityTypeName
            ) {
                console.warn(
                    `Cart item ${itemData.cartItemId} entity mismatch. Expected: ${itemData.entityId}/${itemData.entityTypeName}, Found: ${cartItem.entityId}/${cartItem.entityTypeName}`,
                );
                continue;
            }
            if (
                !(await assertRaisedBedAllowsCheckoutItem(
                    cartItem.raisedBedId,
                    dependencies,
                ))
            ) {
                continue;
            }

            await dependencies.setCartItemPaid(cartItem.id);
            affectedCartIds.push(cart.id);

            if (typeof item.amount_total !== 'number') {
                console.warn(
                    `Missing amount_total for Stripe line item ${item.id} in session ${checkoutSessionId}. Skipping processing to avoid inconsistent state.`,
                );
                continue;
            }

            await processItem(
                {
                    ...itemData,
                    accountId: resolvedAccountId,
                    amount_total: item.amount_total,
                    scheduledDeliveryEmailKeys,
                    checkoutSessionId: session.id,
                },
                dependencies,
            );
        } catch (error) {
            console.error(
                `Error processing cart item ${itemData.cartItemId} in session ${checkoutSessionId}`,
                error,
            );
        }

        // TODO: Send email to customer
        // TODO: Send invoice to customer
    }

    // Extract and validate delivery info from Stripe items to use for non-Stripe items.
    // All items in a single checkout session should share the same delivery information.
    let deliveryInfo: unknown;
    const deliveryInfosFound = new Set<string>();
    for (const item of session.lineItems?.data ?? []) {
        const product = item.price?.product;
        if (typeof product !== 'string' && !product?.deleted) {
            const additionalData = product?.metadata?.additionalData
                ? JSON.parse(product.metadata.additionalData)
                : undefined;
            if (
                additionalData &&
                typeof additionalData === 'object' &&
                'delivery' in additionalData
            ) {
                const itemDeliveryInfo = additionalData.delivery;
                // Use deterministic serialization with sorted keys for reliable comparison
                const serialized = JSON.stringify(
                    sortObjectKeys(itemDeliveryInfo),
                );
                deliveryInfosFound.add(serialized);

                if (!deliveryInfo) {
                    deliveryInfo = itemDeliveryInfo;
                }
            }
        }
    }

    // Warn if multiple different delivery configurations were found
    if (deliveryInfosFound.size > 1) {
        console.warn(
            `Multiple different delivery configurations found in session ${checkoutSessionId}. ` +
                `Using the first one encountered. This may indicate a checkout flow issue.`,
        );
    }

    const uniqueAffectedCartIds = Array.from(new Set(affectedCartIds));
    if (accountId && uniqueAffectedCartIds.length > 0) {
        for (const cartId of uniqueAffectedCartIds) {
            await processNonStripeCartItems(
                cartId,
                accountId,
                deliveryInfo,
                scheduledDeliveryEmailKeys,
                session.id,
                dependencies,
            );
        }
    }

    // Update all affected carts to mark them as paid if all items are paid
    await Promise.all([
        ...uniqueAffectedCartIds.map(dependencies.markCartPaidIfAllItemsPaid),
        accountId && session.amountTotal
            ? dependencies.createTransaction({
                  accountId,
                  amount: session.amountTotal,
                  stripePaymentId: session.id,
                  status: 'completed',
                  currency: 'eur',
              })
            : undefined,
    ]);

    await dependencies.notifyPurchase({
        accountId,
        amountTotal: session.amountTotal ?? null,
        checkoutSessionId: session.id ?? null,
        items: purchasedItems,
    });

    if (accountId) {
        (await dependencies.getPostHogClient()).capture({
            distinctId: accountId,
            event: 'purchase_completed',
            properties: {
                amount_total: session.amountTotal,
                currency: 'eur',
                item_count: purchasedItems.length,
                checkout_session_id: session.id,
            },
        });
    }
}

async function assertRaisedBedAllowsCheckoutItem(
    raisedBedId?: number | null,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    if (!raisedBedId) {
        return true;
    }

    const raisedBed = await dependencies.getRaisedBed(raisedBedId);
    if (raisedBed && dependencies.isRaisedBedAbandoned(raisedBed.status)) {
        console.warn(
            `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
            { raisedBedId },
        );
        return false;
    }

    return true;
}

async function outletReservationForCheckout(
    itemData: {
        cartItemId?: number | null;
        entityId: string | null | undefined;
        outletOfferId?: number | null;
        outletReservationId?: number | null;
    },
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    if (!itemData.cartItemId) {
        return null;
    }

    const reservation = await dependencies.getOutletOfferReservationForCartItem(
        itemData.cartItemId,
    );
    if (!reservation) {
        if (itemData.outletOfferId || itemData.outletReservationId) {
            throw new Error(
                `Outlet reservation not found for cart item ${itemData.cartItemId}.`,
            );
        }

        return null;
    }

    if (
        itemData.outletReservationId &&
        itemData.outletReservationId !== reservation.id
    ) {
        throw new Error(
            `Outlet reservation mismatch for cart item ${itemData.cartItemId}.`,
        );
    }
    if (
        itemData.outletOfferId &&
        itemData.outletOfferId !== reservation.outletOfferId
    ) {
        throw new Error(
            `Outlet offer mismatch for cart item ${itemData.cartItemId}.`,
        );
    }
    if (reservation.outletOffer.plantSortId.toString() !== itemData.entityId) {
        throw new Error(
            `Outlet plant sort mismatch for cart item ${itemData.cartItemId}.`,
        );
    }

    await dependencies.convertOutletReservationForCartItem(itemData.cartItemId);
    return reservation;
}

function parseAdditionalDataValue(additionalData: unknown) {
    if (typeof additionalData !== 'string') {
        return additionalData;
    }

    try {
        return JSON.parse(additionalData);
    } catch {
        return null;
    }
}

export const __testUtils = {
    parseAdditionalDataValue,
};

function scheduledDateFromAdditionalData(additionalData: unknown) {
    const parsedAdditionalData = parseAdditionalDataValue(additionalData);
    const scheduledDate =
        typeof parsedAdditionalData === 'object' &&
        parsedAdditionalData != null &&
        'scheduledDate' in parsedAdditionalData &&
        typeof parsedAdditionalData.scheduledDate === 'string'
            ? parsedAdditionalData.scheduledDate
            : null;
    if (!scheduledDate) {
        return null;
    }

    return Number.isNaN(new Date(scheduledDate).getTime())
        ? null
        : scheduledDate;
}

function greenhouseSowingLocationFromAdditionalData(additionalData: unknown) {
    const parsedAdditionalData = parseAdditionalDataValue(additionalData);
    return typeof parsedAdditionalData === 'object' &&
        parsedAdditionalData != null &&
        'sowingLocation' in parsedAdditionalData &&
        parsedAdditionalData.sowingLocation === 'greenhouse'
        ? 'greenhouse'
        : undefined;
}

function checkoutScheduledDateFromAdditionalData(
    additionalData: unknown,
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    return (
        scheduledDateFromAdditionalData(additionalData) ??
        dependencies.getDefaultShoppingCartScheduledDate()
    );
}

export async function processItem(
    itemData: {
        entityId: string | null | undefined;
        entityTypeName: string | null | undefined;
        accountId: string | null | undefined;
        cartItemId?: number | null;
        cartId: number | null | undefined;
        gardenId: number | null | undefined;
        raisedBedId: number | null | undefined;
        positionIndex: number | null | undefined;
        additionalData: unknown | null | undefined;
        outletOfferId?: number | null;
        outletReservationId?: number | null;
        outletSowingDate?: string | null;
        outletInitialPlantStatus?: string | null;
        outletPriceCents?: number | null;
        currency: string | null;
        amount_total: number; // Amount in cents or sunflowers
        scheduledDeliveryEmailKeys?: Set<string>;
        checkoutSessionId?: string | null;
    },
    dependencies: ProcessCheckoutSessionDependencies = realDependencies,
) {
    console.debug(
        `Processing item with entityId ${itemData.entityId} and entityTypeName ${itemData.entityTypeName} for account ${itemData.accountId} in total amount ${itemData.amount_total}`,
    );

    const earnSunflowersFunc = () =>
        itemData.accountId && itemData.currency === 'eur'
            ? dependencies.earnSunflowersForPayment(
                  itemData.accountId,
                  itemData.amount_total / 100,
              )
            : Promise.resolve();

    // TODO: Move this logic to a separate function
    if (itemData.entityTypeName === 'operation') {
        // TODO: Handle operation processing
        // TODO: Handle raisedBed operation placement (not currently necessary since we can't buy raised bed operation without planting plants)

        // Validate item data
        if (
            !itemData.accountId ||
            !itemData.entityId ||
            !itemData.entityTypeName
        ) {
            console.error(
                `Missing required metadata for operation item in order.`,
                itemData,
            );
            return;
        }
        const entityIdNumber = parseInt(itemData.entityId, 10);
        if (Number.isNaN(entityIdNumber)) {
            console.error(
                `Invalid entityId ${itemData.entityId} for operation item in order.`,
                itemData,
            );
            return;
        }
        if (
            !(await assertRaisedBedAllowsCheckoutItem(
                itemData.raisedBedId,
                dependencies,
            ))
        ) {
            return;
        }

        // Try to resolve field ID from position index (only active fields)
        let fieldId: number | undefined;
        if (
            typeof itemData.positionIndex === 'number' &&
            itemData.raisedBedId
        ) {
            const raisedBedFields =
                await dependencies.getRaisedBedFieldsWithEvents(
                    itemData.raisedBedId,
                );
            fieldId = raisedBedFields.find(
                (field) =>
                    field.positionIndex === itemData.positionIndex &&
                    field.active,
            )?.id;
        }

        let additionalData = itemData.additionalData;
        if (typeof additionalData === 'string') {
            try {
                additionalData = JSON.parse(additionalData);
            } catch (error) {
                console.error(
                    `Invalid additionalData for operation item in order.`,
                    {
                        additionalData,
                        itemData,
                        error,
                    },
                );
                additionalData = null;
            }
        }
        const scheduledDate = checkoutScheduledDateFromAdditionalData(
            additionalData,
            dependencies,
        );

        const operationId = await dependencies.createOperation({
            accountId: itemData.accountId,
            entityId: entityIdNumber,
            entityTypeName: itemData.entityTypeName,
            gardenId: itemData.gardenId,
            raisedBedId: itemData.raisedBedId,
            raisedBedFieldId: fieldId,
        });

        try {
            await earnSunflowersFunc();
        } catch (error) {
            console.error(
                `Failed to award sunflowers for operation item in order.`,
                error,
            );
        }
        console.debug(
            `Created operation ${itemData.entityId} of type ${itemData.entityTypeName} for account ${itemData.accountId} in garden ${itemData.gardenId ?? 'N/A'} with raised bed ${itemData.raisedBedId ?? 'N/A'} and field ${fieldId ?? 'N/A'}.`,
        );

        // Every purchased operation is scheduled; missing dates default to tomorrow.
        try {
            await dependencies.createEvent(
                dependencies.knownEvents.operations.scheduledV1(
                    operationId.toString(),
                    {
                        scheduledDate,
                    },
                ),
            );
            console.debug(
                `Scheduled operation ${operationId} for date ${scheduledDate}.`,
            );
        } catch (error) {
            console.error(
                `Failed to create scheduled event for operation ${operationId}:`,
                error,
            );
        }
        await dependencies.notifyOperationUpdate(operationId, 'scheduled', {
            scheduledDate: new Date(scheduledDate).toISOString(),
        });

        // Check if this operation/entity is deliverable and create delivery request if needed
        if (itemData.cartId) {
            const isDeliverable = await dependencies.isCartItemDeliverable({
                entityId: entityIdNumber,
            });
            if (isDeliverable) {
                console.debug(
                    `Operation ${operationId} is deliverable - checking for delivery configuration in metadata`,
                );

                // Check if delivery information was stored in additionalData
                let deliveryInfo: {
                    slotId?: number;
                    mode?: 'delivery' | 'pickup';
                    addressId?: number;
                    locationId?: number;
                    notes?: string;
                } | null = null;
                if (
                    typeof additionalData === 'object' &&
                    additionalData !== null &&
                    'delivery' in additionalData
                ) {
                    deliveryInfo = (additionalData as Record<string, unknown>)
                        .delivery as {
                        slotId?: number;
                        mode?: 'delivery' | 'pickup';
                        addressId?: number;
                        locationId?: number;
                        notes?: string;
                    };
                }

                if (deliveryInfo?.slotId && deliveryInfo.mode) {
                    try {
                        const deliveryRequestId =
                            await dependencies.createDeliveryRequest({
                                operationId,
                                slotId: deliveryInfo.slotId,
                                mode: deliveryInfo.mode,
                                addressId: deliveryInfo.addressId,
                                locationId: deliveryInfo.locationId,
                                notes: deliveryInfo.notes,
                                accountId: itemData.accountId,
                            });
                        console.debug(
                            `Created delivery request ${deliveryRequestId} for operation ${operationId}`,
                        );
                        await dependencies.notifyDeliveryRequestEvent(
                            deliveryRequestId,
                            'created',
                        );
                        await dependencies.notifyScheduledDeliveryEmailOnce({
                            requestId: deliveryRequestId,
                            accountId: itemData.accountId,
                            deliveryInfo,
                            notifiedKeys: itemData.scheduledDeliveryEmailKeys,
                            notify: dependencies.notifyDeliveryScheduled,
                        });
                    } catch (error) {
                        console.error(
                            `Failed to create delivery request for operation ${operationId}:`,
                            error,
                        );
                        // Payment already captured -- do not re-throw. Surface the failure so ops
                        // can reconcile the paid-but-undelivered order.
                        (await dependencies.getPostHogClient()).capture({
                            distinctId: itemData.accountId,
                            event: 'delivery_request_creation_failed',
                            properties: {
                                operation_id: operationId,
                                account_id: itemData.accountId,
                                slot_id: deliveryInfo.slotId,
                                mode: deliveryInfo.mode,
                                checkout_session_id:
                                    itemData.checkoutSessionId ?? null,
                            },
                        });
                    }
                } else {
                    console.warn(
                        `Operation ${operationId} is deliverable but no delivery information found in metadata`,
                    );
                }
            }
        }
    } else if (
        itemData.entityId &&
        itemData.entityTypeName === 'plantSort' &&
        itemData.raisedBedId &&
        typeof itemData.positionIndex === 'number'
    ) {
        if (
            !(await assertRaisedBedAllowsCheckoutItem(
                itemData.raisedBedId,
                dependencies,
            ))
        ) {
            return;
        }

        const outletReservation = await outletReservationForCheckout(
            itemData,
            dependencies,
        );
        const aggregateId = `${itemData.raisedBedId}|${itemData.positionIndex}`;

        await dependencies.upsertRaisedBedField({
            positionIndex: itemData.positionIndex,
            raisedBedId: itemData.raisedBedId,
        });
        await dependencies.createEvent(
            dependencies.knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
                plantSortId: itemData.entityId,
                scheduledDate: outletReservation
                    ? null
                    : checkoutScheduledDateFromAdditionalData(
                          itemData.additionalData,
                          dependencies,
                      ),
                sowingLocation: outletReservation
                    ? 'greenhouse'
                    : greenhouseSowingLocationFromAdditionalData(
                          itemData.additionalData,
                      ),
            }),
        );
        if (outletReservation) {
            await dependencies.createEvent(
                dependencies.knownEvents.raisedBedFields.plantUpdateV1(
                    aggregateId,
                    {
                        status: 'sowed',
                        effectiveDate:
                            outletReservation.heldSowingDate.toISOString(),
                    },
                ),
            );

            if (outletReservation.heldInitialPlantStatus !== 'sowed') {
                await dependencies.createEvent(
                    dependencies.knownEvents.raisedBedFields.plantUpdateV1(
                        aggregateId,
                        {
                            status: outletReservation.heldInitialPlantStatus,
                        },
                    ),
                );
            }
        }

        await Promise.all([
            dependencies.updateRaisedBed({
                id: itemData.raisedBedId,
                status: 'active',
            }),
            earnSunflowersFunc(),
        ]);
        console.debug(
            `Placed plant sort ${itemData.entityId} in raised bed ${itemData.raisedBedId} at position ${itemData.positionIndex}.`,
        );
        if (outletReservation && itemData.accountId) {
            (await dependencies.getPostHogClient()).capture({
                distinctId: itemData.accountId,
                event: 'outlet_reservation_converted',
                properties: {
                    outlet_offer_id: outletReservation.outletOfferId,
                    outlet_reservation_id: outletReservation.id,
                    cart_item_id: itemData.cartItemId,
                },
            });
        }
    } else {
        console.error(
            `Unsupported item type for entityId ${itemData.entityId} in order.`,
            itemData,
        );
    }
}
