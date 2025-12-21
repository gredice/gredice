import {
    notifyDeliveryRequestEvent,
    notifyOperationUpdate,
    notifyPurchase,
} from '@gredice/notifications';
import {
    consumeInventoryItem,
    createDeliveryRequest,
    createEvent,
    createOperation,
    createRaisedBedSensor,
    createTransaction,
    earnSunflowersForPayment,
    getAllTransactions,
    getInventory,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    isCartItemDeliverable,
    knownEvents,
    markCartPaidIfAllItemsPaid,
    setCartItemPaid,
    spendSunflowers,
    updateRaisedBed,
    upsertRaisedBedField,
} from '@gredice/storage';
import { getStripeCheckoutSession } from '@gredice/stripe/server';
import {
    getCartInfo,
    type ShoppingCartItemWithShopData,
} from '../checkout/cartInfo';
import { calculateSunflowerAmount } from '../checkout/sunflowerCalculations';
import { notifyDeliveryScheduled } from '../delivery/emailNotifications';

async function processNonStripeCartItems(
    cartId: number,
    accountId: string,
    deliveryInfo?: unknown,
): Promise<ShoppingCartItemWithShopData[]> {
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        console.warn(
            `No cart found for ID ${cartId} when processing non-stripe items.`,
        );
        return [];
    }

    const cartInfo = await getCartInfo(cart.items, accountId);
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
        const sunflowerAmount = calculateSunflowerAmount(item);
        sunflowerAmountsByItem.set(item.id, sunflowerAmount);
        totalSunflowersToSpend += sunflowerAmount;
    }

    let didSpendSunflowersForCart = false;
    if (totalSunflowersToSpend > 0) {
        try {
            // Spend all sunflowers in a single transaction for the entire cart
            // to prevent race conditions. Reference format: shoppingCart:${cartId}
            // (Note: This differs from immediate processing which uses shoppingCartItem:${item.id})
            await spendSunflowers(
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
                setCartItemPaid(item.id),
                processItem({
                    accountId,
                    entityId: item.entityId,
                    entityTypeName: item.entityTypeName,
                    cartId: item.cartId,
                    gardenId: item.gardenId,
                    raisedBedId: item.raisedBedId,
                    positionIndex: item.positionIndex,
                    currency: item.currency,
                    amount_total: sunflowerAmount,
                    additionalData,
                }),
            ]);
        }
    }

    const inventoryCartItems = cartInfo.items.filter(
        (item) =>
            item.status !== 'paid' &&
            (item.currency === 'inventory' || item.usesInventory),
    );

    // Validate inventory availability before processing to avoid race conditions
    let inventoryLookup = new Map<string, number>();
    if (inventoryCartItems.length > 0) {
        const inventory = await getInventory(accountId);
        inventoryLookup = new Map(
            inventory.map((inventoryItem) => [
                `${inventoryItem.entityTypeName}-${inventoryItem.entityId}`,
                inventoryItem.amount,
            ]),
        );
    }

    for (const item of inventoryCartItems) {
        const inventoryKey = `${item.entityTypeName}-${item.entityId}`;
        const available = inventoryLookup.get(inventoryKey) ?? 0;
        if (available < item.amount) {
            const errorMsg = `Insufficient inventory for item ${item.id} from cart ${cartId}. Required: ${item.amount}, Available: ${available}. Manual intervention required to refund or fulfill this order.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        const baseAdditionalData = item.additionalData
            ? JSON.parse(item.additionalData)
            : {};
        const additionalData = {
            ...baseAdditionalData,
            ...(deliveryInfo ? { delivery: deliveryInfo } : {}),
        };

        await Promise.all([
            consumeInventoryItem(accountId, {
                entityTypeName: item.entityTypeName,
                entityId: item.entityId,
                amount: item.amount,
                source: `shoppingCartItem:${item.id}`,
            }),
            setCartItemPaid(item.id),
            processItem({
                accountId,
                entityId: item.entityId,
                entityTypeName: item.entityTypeName,
                cartId: item.cartId,
                gardenId: item.gardenId,
                raisedBedId: item.raisedBedId,
                positionIndex: item.positionIndex,
                currency: item.currency,
                amount_total: 0,
                additionalData,
            }),
        ]);

        // Update the lookup to reflect consumed inventory
        inventoryLookup.set(inventoryKey, available - item.amount);
    }

    return cartInfo.items;
}

export async function processCheckoutSession(checkoutSessionId?: string) {
    if (!checkoutSessionId) {
        console.warn(`No checkout session ID provided`);
        return;
    }

    const session = await getStripeCheckoutSession(checkoutSessionId);
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

    console.debug(
        `Processing checkout session ${checkoutSessionId} with amount ${session.amountTotal} cents`,
    );

    const affectedCartIds: number[] = [];
    const purchasedItems: {
        name?: string | null;
        quantity?: number | null;
        amountSubtotal?: number | null;
    }[] = [];
    let accountId: string | undefined;
    let checkedExistingTransactions = false;
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
                    ? product.name
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
            const cart = await getShoppingCart(itemData.cartId);
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

            // Check if transaction was already processed
            if (!checkedExistingTransactions) {
                // TODO: Use pagination and retrieve last N transactions or match via date
                const transactions = await getAllTransactions({
                    filter: { accountId },
                });
                checkedExistingTransactions = true;
                const existingTransaction = transactions.find(
                    (t) =>
                        t.stripePaymentId === session.id &&
                        t.status === 'completed',
                );
                if (existingTransaction) {
                    console.info(
                        `Transaction for session ${checkoutSessionId} already processed for account ${accountId}`,
                    );
                    return;
                }
            }

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

            await setCartItemPaid(cartItem.id);
            affectedCartIds.push(cart.id);

            await processItem({
                ...itemData,
                accountId: resolvedAccountId,
                amount_total: item.amount_total,
            });
        } catch (error) {
            console.error(
                `Error processing cart item ${itemData.cartItemId} in session ${checkoutSessionId}`,
                error,
            );
        }

        // TODO: Send email to customer
        // TODO: Send invoice to customer
    }

    // Extract delivery info from the first Stripe item to use for non-Stripe items.
    // All items in a single checkout session share the same delivery information,
    // so we can safely use the delivery info from any Stripe item for all non-Stripe items.
    let deliveryInfo: unknown;
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
                deliveryInfo = additionalData.delivery;
                break;
            }
        }
    }

    const uniqueAffectedCartIds = Array.from(new Set(affectedCartIds));
    if (accountId && uniqueAffectedCartIds.length > 0) {
        for (const cartId of uniqueAffectedCartIds) {
            await processNonStripeCartItems(cartId, accountId, deliveryInfo);
        }
    }

    // Update all affected carts to mark them as paid if all items are paid
    await Promise.all([
        ...uniqueAffectedCartIds.map(markCartPaidIfAllItemsPaid),
        accountId && session.amountTotal
            ? createTransaction({
                  accountId,
                  amount: session.amountTotal,
                  stripePaymentId: session.paymentId ?? session.id,
                  status: 'completed',
                  currency: 'eur',
              })
            : undefined,
    ]);

    await notifyPurchase({
        accountId,
        amountTotal: session.amountTotal ?? null,
        checkoutSessionId: session.id ?? null,
        items: purchasedItems,
    });
}

export async function processItem(itemData: {
    entityId: string | null | undefined;
    entityTypeName: string | null | undefined;
    accountId: string | null | undefined;
    cartId: number | null | undefined;
    gardenId: number | null | undefined;
    raisedBedId: number | null | undefined;
    positionIndex: number | null | undefined;
    additionalData: unknown | null | undefined;
    currency: string | null;
    amount_total: number; // Amount in cents or sunflowers
}) {
    console.debug(
        `Processing item with entityId ${itemData.entityId} and entityTypeName ${itemData.entityTypeName} for account ${itemData.accountId} in total amount ${itemData.amount_total}`,
    );

    const earnSunflowersFunc = () =>
        itemData.accountId && itemData.currency === 'eur'
            ? earnSunflowersForPayment(
                  itemData.accountId,
                  itemData.amount_total / 100,
              )
            : Promise.resolve();

    // TODO: Move this logic to a separate function
    if (itemData.entityTypeName === 'operation') {
        // TODO: Handle operation processing
        // TODO: Handle raisedBed operation placement (not currently necessary since we can't buy raised bed operation without planting plants)

        // Special cases: Handle sensor installation
        // TODO: Mitigate hardcoded '180' as place sensor ID
        if (itemData.raisedBedId && itemData.entityId === '180') {
            try {
                await Promise.all([
                    createRaisedBedSensor({
                        raisedBedId: itemData.raisedBedId,
                    }),
                    earnSunflowersFunc(),
                ]);
                console.debug(
                    `Installed sensor in raised bed ${itemData.raisedBedId}.`,
                );
            } catch (error) {
                console.error(
                    `Failed to install sensor for raised bed ${itemData.raisedBedId}.`,
                    error,
                );
            }
        } else {
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

            // Try to resolve field ID from position index (only active fields)
            let fieldId: number | undefined;
            if (
                typeof itemData.positionIndex === 'number' &&
                itemData.raisedBedId
            ) {
                const raisedBedFields = await getRaisedBedFieldsWithEvents(
                    itemData.raisedBedId,
                );
                fieldId = raisedBedFields.find(
                    (field) =>
                        field.positionIndex === itemData.positionIndex &&
                        field.active,
                )?.id;
            }

            // Try to extract scheduled date from additional data
            let scheduledDate: string | null = null;
            const additionalData =
                typeof itemData.additionalData === 'string'
                    ? JSON.parse(itemData.additionalData)
                    : itemData.additionalData;
            if (
                typeof additionalData === 'object' &&
                additionalData != null &&
                'scheduledDate' in additionalData &&
                typeof additionalData.scheduledDate === 'string'
            ) {
                scheduledDate = additionalData.scheduledDate;
            }

            const [operationId] = await Promise.all([
                createOperation({
                    accountId: itemData.accountId,
                    entityId: entityIdNumber,
                    entityTypeName: itemData.entityTypeName,
                    gardenId: itemData.gardenId,
                    raisedBedId: itemData.raisedBedId,
                    raisedBedFieldId: fieldId,
                }),
                earnSunflowersFunc(),
            ]);
            console.debug(
                `Created operation ${itemData.entityId} of type ${itemData.entityTypeName} for account ${itemData.accountId} in garden ${itemData.gardenId ?? 'N/A'} with raised bed ${itemData.raisedBedId ?? 'N/A'} and field ${fieldId ?? 'N/A'}.`,
            );

            // Make operation scheduled event if there is schedule date in the request
            if (scheduledDate) {
                await createEvent(
                    knownEvents.operations.scheduledV1(operationId.toString(), {
                        scheduledDate,
                    }),
                );
                console.debug(
                    `Scheduled operation ${operationId} for date ${scheduledDate}.`,
                );
                const scheduledDateValue = new Date(scheduledDate);
                await notifyOperationUpdate(operationId, 'scheduled', {
                    scheduledDate: scheduledDateValue.toISOString(),
                });
            }

            // Check if this operation/entity is deliverable and create delivery request if needed
            if (itemData.cartId) {
                const isDeliverable = await isCartItemDeliverable({
                    entityId: parseInt(itemData.entityId, 10),
                });
                if (isDeliverable) {
                    console.debug(
                        `Operation ${operationId} is deliverable - checking for delivery configuration in metadata`,
                    );

                    // Check if delivery information was stored in additionalData
                    let deliveryInfo = null;
                    if (
                        typeof additionalData === 'object' &&
                        additionalData !== null &&
                        'delivery' in additionalData
                    ) {
                        deliveryInfo = additionalData.delivery;
                    }

                    if (deliveryInfo?.slotId && deliveryInfo.mode) {
                        try {
                            const deliveryRequestId =
                                await createDeliveryRequest({
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
                            await notifyDeliveryRequestEvent(
                                deliveryRequestId,
                                'created',
                            );
                            await notifyDeliveryScheduled(deliveryRequestId);
                        } catch (error) {
                            console.error(
                                `Failed to create delivery request for operation ${operationId}:`,
                                error,
                            );
                            // Don't fail the whole payment, just log the error
                        }
                    } else {
                        console.warn(
                            `Operation ${operationId} is deliverable but no delivery information found in metadata`,
                        );
                    }
                }
            }
        }
    } else if (
        itemData.entityId &&
        itemData.entityTypeName === 'plantSort' &&
        itemData.raisedBedId &&
        typeof itemData.positionIndex === 'number'
    ) {
        await Promise.all([
            upsertRaisedBedField({
                positionIndex: itemData.positionIndex,
                raisedBedId: itemData.raisedBedId,
            }),
            createEvent(
                knownEvents.raisedBedFields.plantPlaceV1(
                    `${itemData.raisedBedId}|${itemData.positionIndex}`,
                    {
                        plantSortId: itemData.entityId,
                        scheduledDate:
                            typeof itemData.additionalData === 'object' &&
                            itemData.additionalData != null &&
                            'scheduledDate' in itemData.additionalData &&
                            typeof itemData.additionalData.scheduledDate ===
                                'string'
                                ? itemData.additionalData.scheduledDate
                                : null,
                    },
                ),
            ),
            updateRaisedBed({
                id: itemData.raisedBedId,
                status: 'active',
            }),
            earnSunflowersFunc(),
        ]);
        console.debug(
            `Placed plant sort ${itemData.entityId} in raised bed ${itemData.raisedBedId} at position ${itemData.positionIndex}.`,
        );
    } else {
        console.error(
            `Unsupported item type for entityId ${itemData.entityId} in order.`,
            itemData,
        );
    }
}
