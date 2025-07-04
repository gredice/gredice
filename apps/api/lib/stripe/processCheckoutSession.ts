import { getShoppingCart, setCartItemPaid, upsertRaisedBedField, createEvent, knownEvents, earnSunflowersForPayment, updateRaisedBed, markCartPaidIfAllItemsPaid, createTransaction, getTransactions, createRaisedBedSensor } from "@gredice/storage";
import { getStripeCheckoutSession } from "@gredice/stripe/server";

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
        console.warn(`Session ${checkoutSessionId} is not complete, current status: ${session.status}`);
        return;
    }
    if (session.paymentStatus !== 'paid') {
        console.warn(`Payment not completed for session ${checkoutSessionId} with status: ${session.paymentStatus}`);
        return;
    }

    console.debug(`Processing checkout session ${checkoutSessionId} with amount ${session.amountTotal} cents`);

    const affectedCartIds: number[] = [];
    let accountId: string | undefined = undefined;
    for (const item of session.lineItems?.data ?? []) {
        console.debug(`Item: ${item.id} Quantity: ${item.quantity}`);

        const product = item.price?.product;
        if (typeof product === 'string') {
            console.warn(`Product is a string: ${product}. This is not supported.`);
            continue
        }

        if (product?.deleted) {
            console.warn(`Product is deleted: ${product.id}. This is not supported.`);
            continue;
        }

        // Extract metadata from the product
        const itemData = {
            entityId: product?.metadata.entityId,
            entityTypeName: product?.metadata.entityTypeName,
            accountId: product?.metadata.accountId,
            userId: product?.metadata.userId,
            cartId: product?.metadata.cartId ? parseInt(product.metadata.cartId, 10) : undefined,
            gardenId: product?.metadata.gardenId ? parseInt(product.metadata.gardenId, 10) : undefined,
            raisedBedId: product?.metadata.raisedBedId ? parseInt(product.metadata.raisedBedId, 10) : undefined,
            positionIndex: product?.metadata.positionIndex ? parseInt(product.metadata.positionIndex, 10) : undefined,
            additionalData: product?.metadata.additionalData ? JSON.parse(product.metadata.additionalData) : undefined
        };

        // Save accountId from metadata if not already set
        accountId ??= itemData.accountId;

        // Check if transaction was already precessed
        if (accountId) {
            // TODO: Use paginatino and retrieve last N transactions or match via date
            const transactions = await getTransactions(accountId);
            const existingTransaction = transactions.find(t =>
                t.stripePaymentId === session.id &&
                t.status === 'completed'
            );
            if (existingTransaction) {
                console.info(`Transaction for session ${checkoutSessionId} already processed for account ${accountId}`);
                return;
            }
        }

        // Validate required metadata
        if (!itemData.entityId || !itemData.entityTypeName || !itemData.accountId || !itemData.cartId) {
            console.warn(`Missing required metadata for item ${item.id} in session ${checkoutSessionId}`);
            continue;
        }

        // Process cart item
        try {
            const cart = await getShoppingCart(itemData.cartId);
            if (!cart) {
                console.warn(`No cart found for ID ${itemData.cartId} in session ${checkoutSessionId}`);
                continue;
            }
            const cartItem = cart.items.find(i =>
                i.entityId === itemData.entityId &&
                i.entityTypeName === itemData.entityTypeName &&
                (i.gardenId ?? null) === (itemData.gardenId ?? null) &&
                (i.raisedBedId ?? null) === (itemData.raisedBedId ?? null) &&
                (i.positionIndex ?? null) === (itemData.positionIndex ?? null));
            if (!cartItem) {
                console.warn(`No existing item found in cart for entityId ${itemData.entityId} in session ${checkoutSessionId}`);
                continue;
            }
            await setCartItemPaid(cartItem.id);
            affectedCartIds.push(cart.id);
        } catch (error) {
            console.error(`Error processing cart item for entityId ${itemData.entityId} in session ${checkoutSessionId}`, error);
            continue;
        }

        if (itemData.entityTypeName === 'operation') {
            // TODO: Handle operation processing
            // TODO: Handle raisedBed operation placement (not currently necessary since we can't buy raised bed operation without planting plants)

            // Handle sensor installation
            if (itemData.raisedBedId && itemData.entityId === '180') { // TODO: Mitigate hardcoded '180' as place sensor ID
                try {
                    await createRaisedBedSensor({
                        raisedBedId: itemData.raisedBedId,
                    });
                    await earnSunflowersForPayment(itemData.accountId, item.amount_total / 100); // Convert cents to dollars
                    console.debug(`Installed sensor in raised bed ${itemData.raisedBedId} for session ${checkoutSessionId}`);
                } catch (error) {
                    console.error(`Failed to install sensor for raised bed ${itemData.raisedBedId} in session ${checkoutSessionId}`, error);
                }
            }
        }

        // Process plant placement event
        if (itemData.entityTypeName === 'plantSort' &&
            itemData.raisedBedId &&
            typeof itemData.positionIndex === 'number') {
            await Promise.all([
                upsertRaisedBedField({
                    positionIndex: itemData.positionIndex,
                    raisedBedId: itemData.raisedBedId
                }),
                createEvent(knownEvents.raisedBedFields.plantPlaceV1(
                    `${itemData.raisedBedId}|${itemData.positionIndex}`,
                    {
                        plantSortId: itemData.entityId,
                        scheduledDate: itemData.additionalData?.scheduledDate || null,
                    }
                )),
                earnSunflowersForPayment(itemData.accountId, item.amount_total / 100), // Convert cents to dollars
                updateRaisedBed({
                    id: itemData.raisedBedId,
                    status: 'active'
                })
            ]);
            console.debug(`Placed plant sort ${itemData.entityId} in raised bed ${itemData.raisedBedId} at position ${itemData.positionIndex} for session ${checkoutSessionId}`);
        } else {
            console.error(`Unsupported item type for entityId ${itemData.entityId} in session ${checkoutSessionId}`, itemData);
        }

        // TODO: Send email to customer
        // TODO: Send invoice to customer
    }

    // Update all affected carts to mark them as paid if all items are paid
    await Promise.all([
        ...affectedCartIds.map(markCartPaidIfAllItemsPaid),
        accountId && session.amountTotal ? createTransaction({
            accountId,
            amount: session.amountTotal,
            stripePaymentId: session.paymentId ?? session.id,
            status: 'completed',
            currency: 'eur'
        }) : undefined
    ]);
}