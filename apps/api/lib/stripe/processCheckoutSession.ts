import {
    createDeliveryRequest,
    createEvent,
    createOperation,
    createRaisedBedSensor,
    createTransaction,
    earnSunflowersForPayment,
    getAllTransactions,
    getRaisedBedFieldsWithEvents,
    getShoppingCart,
    isCartItemDeliverable,
    knownEvents,
    markCartPaidIfAllItemsPaid,
    setCartItemPaid,
    updateRaisedBed,
    upsertRaisedBedField,
} from '@gredice/storage';
import { getStripeCheckoutSession } from '@gredice/stripe/server';
import { notifyDeliveryScheduled } from '../delivery/emailNotifications';

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

        // Check if transaction was already precessed
        if (accountId) {
            // TODO: Use paginatino and retrieve last N transactions or match via date
            const transactions = await getAllTransactions({
                filter: { accountId },
            });
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

        // Validate required metadata
        if (
            !itemData.cartItemId ||
            !itemData.entityId ||
            !itemData.entityTypeName ||
            !itemData.accountId ||
            !itemData.cartId
        ) {
            console.warn(
                `Missing required metadata for item ${item.id} in session ${checkoutSessionId}`,
            );
            continue;
        }

        // Process cart item
        try {
            const cart = await getShoppingCart(itemData.cartId);
            if (!cart) {
                console.warn(
                    `No cart found for ID ${itemData.cartId} in session ${checkoutSessionId}`,
                );
                continue;
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
        } catch (error) {
            console.error(
                `Error processing cart item ${itemData.cartItemId} in session ${checkoutSessionId}`,
                error,
            );
            continue;
        }

        await processItem({
            ...itemData,
            amount_total: item.amount_total,
        });

        // TODO: Send email to customer
        // TODO: Send invoice to customer
    }

    // Update all affected carts to mark them as paid if all items are paid
    await Promise.all([
        ...affectedCartIds.map(markCartPaidIfAllItemsPaid),
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
        if (itemData.raisedBedId && itemData.entityId === '180') {
            // TODO: Mitigate hardcoded '180' as place sensor ID
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
                            await notifyDeliveryScheduled(deliveryRequestId, {
                                userId: itemData.userId,
                            });
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
