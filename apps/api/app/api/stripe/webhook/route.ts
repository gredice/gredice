import Stripe from 'stripe';
import { getStripeCheckoutSession, stripeWebhookConstructEvent } from '@gredice/stripe/server';
import { createEvent, earnSunflowersForPayment, getRaisedBed, getShoppingCart, knownEvents, markCartPaidIfAllItemsPaid, setCartItemPaid, updateRaisedBed, upsertRaisedBedField } from '@gredice/storage';

export const dynamic = 'force-dynamic';

const relevantEvents = new Set([
    // 'product.created',
    // 'product.updated',
    // 'product.deleted',
    // 'price.created',
    // 'price.updated',
    // 'price.deleted',
    'checkout.session.completed'
]);

async function processCheckoutSession(checkoutSessionId?: string) {
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

    const affectedCartIds: number[] = [];
    for (const item of session.lineItems?.data ?? []) {
        console.log(`Item: ${item.id} Quantity: ${item.quantity}`);

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
    await Promise.all(affectedCartIds.map(markCartPaidIfAllItemsPaid));
}

export async function POST(req: Request) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = await stripeWebhookConstructEvent(body, sig, webhookSecret);

    // Ignore not supported event (check Stripe webhook config)
    if (!relevantEvents.has(event.type)) {
        return new Response(`Unsupported event type: ${event.type}`, {
            status: 400
        });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const checkoutSession = event.data.object as Stripe.Checkout.Session;
                if (checkoutSession.mode === 'payment') {
                    await processCheckoutSession(checkoutSession.id);
                }
                break;
            default:
                throw new Error('Unhandled relevant event!');
        }
    } catch (error) {
        console.error('Stripe webhook error', error);
        return new Response(
            'Stripe webhook handler failed',
            {
                status: 400
            }
        );
    }

    return new Response(JSON.stringify({ received: true }));
}
