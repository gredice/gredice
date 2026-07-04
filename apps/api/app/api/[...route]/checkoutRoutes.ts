import {
    assignStripeCustomerId,
    consumeInventoryItem,
    getAccount,
    getShoppingCart,
    getUser,
    markCartPaidIfAllItemsPaid,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    OUTLET_RESERVATION_HOLD_MINUTES,
    OutletOfferUnavailableError,
    OutletReservationUnavailableError,
    releaseOutletReservationsForCart,
    reserveOutletOffer,
    setCartItemPaid,
    spendSunflowers,
} from '@gredice/storage';
import {
    type CheckoutItem,
    getStripeCheckoutSession,
    stripeCheckout,
    stripeSessionCancel,
} from '@gredice/stripe/server';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { getCartInfo } from '../../../lib/checkout/cartInfo';
import {
    buildOrderConfirmationItems,
    notifyOrderConfirmationEmail,
} from '../../../lib/checkout/orderConfirmationEmail';
import { calculateSunflowerAmount } from '../../../lib/checkout/sunflowerCalculations';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';
import { processItem } from '../../../lib/stripe/processCheckoutSession';

const STRIPE_MIN_CHECKOUT_SESSION_LIFETIME_MINUTES = 30;
const OUTLET_CHECKOUT_HOLD_MINUTES = Math.max(
    OUTLET_RESERVATION_HOLD_MINUTES,
    // Stripe requires checkout sessions to expire at least 30 minutes out.
    STRIPE_MIN_CHECKOUT_SESSION_LIFETIME_MINUTES + 1,
);

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

const app = new Hono<{ Variables: AuthVariables }>()
    .post(
        '/checkout',
        describeRoute({
            description: 'Create a Stripe checkout session for the given cart',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                cartId: z.number(),
                deliveryInfo: z
                    .object({
                        slotId: z.number(),
                        mode: z.enum(['delivery', 'pickup']),
                        addressId: z.number().optional(),
                        locationId: z.number().optional(),
                        notes: z.string().max(500).optional(),
                    })
                    .optional(),
            }),
        ),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { cartId, deliveryInfo } = context.req.valid('json');

            // Retrieve data
            const [account, user, initialCart] = await Promise.all([
                getAccount(accountId),
                getUser(userId),
                getShoppingCart(cartId),
            ]);
            if (!account) {
                return context.json({ error: 'Account not found' }, 404);
            }
            if (!user) {
                return context.json({ error: 'User not found' }, 404);
            }
            if (!initialCart) {
                return context.json({ error: 'Cart not found' }, 404);
            }
            const inventoryNormalizedCart =
                (await normalizeShoppingCartInventoryUsage(cartId)) ??
                initialCart;
            const cart =
                (await normalizeShoppingCartScheduledDates(
                    inventoryNormalizedCart.id,
                    {
                        defaultMissingScheduledDates: true,
                    },
                )) ?? inventoryNormalizedCart;
            if (cart.accountId !== accountId) {
                console.warn('Account ID mismatch', {
                    accountId,
                    cartAccountId: cart.accountId,
                });
                return context.json({ error: 'Cart not found' }, 404);
            }

            // Validate cart status
            if (cart.status === 'paid') {
                return context.json({ error: 'Cart already paid' }, 400);
            }

            // Retrieve entities data
            const cartInfo = await getCartInfo(cart.items, accountId);
            if (!cartInfo.allowPurchase) {
                return context.json({ error: 'Cart in invalid state' }, 400);
            }
            const outletCheckoutStartedAt = new Date();
            const outletCheckoutExpiresAt = addMinutes(
                outletCheckoutStartedAt,
                OUTLET_CHECKOUT_HOLD_MINUTES,
            );
            let hasOutletStripeItems = false;
            for (const item of cartInfo.items) {
                if (
                    item.status === 'paid' ||
                    item.currency !== 'eur' ||
                    !item.outlet
                ) {
                    continue;
                }
                hasOutletStripeItems = true;

                try {
                    await reserveOutletOffer({
                        offerId: item.outlet.offerId,
                        accountId,
                        cartId: item.cartId,
                        cartItemId: item.id,
                        quantity: item.amount,
                        now: outletCheckoutStartedAt,
                        holdMinutes: OUTLET_CHECKOUT_HOLD_MINUTES,
                    });
                } catch (error) {
                    if (
                        error instanceof OutletOfferUnavailableError ||
                        error instanceof OutletReservationUnavailableError
                    ) {
                        return context.json(
                            { error: 'Outlet offer is not available' },
                            409,
                        );
                    }

                    throw error;
                }
            }

            const requiresStripePayment = cartInfo.items.some(
                (item) => item.status !== 'paid' && item.currency === 'eur',
            );

            // Handle sunflower items
            if (!requiresStripePayment) {
                const scheduledDeliveryEmailKeys = new Set<string>();
                const sunflowerCartItemsWithShopData = cartInfo.items.filter(
                    (item) =>
                        item.status !== 'paid' && item.currency === 'sunflower',
                );
                if (sunflowerCartItemsWithShopData.length > 0) {
                    // Check if there are enough sunflowers in the account
                    for (const item of sunflowerCartItemsWithShopData) {
                        const sunflowerAmount = calculateSunflowerAmount(item);
                        let didPaySunflowers = false;
                        try {
                            await spendSunflowers(
                                accountId,
                                sunflowerAmount,
                                `shoppingCartItem:${item.id}`,
                            );
                            didPaySunflowers = true;
                        } catch (error) {
                            console.error('Error spending sunflowers', {
                                error,
                                accountId,
                                sunflowerAmount,
                                item,
                            });
                        }

                        if (didPaySunflowers) {
                            await Promise.all([
                                setCartItemPaid(item.id),
                                processItem({
                                    accountId,
                                    cartItemId: item.id,
                                    ...item,
                                    amount_total: sunflowerAmount,
                                    scheduledDeliveryEmailKeys,
                                    additionalData: {
                                        ...(item.additionalData
                                            ? JSON.parse(item.additionalData)
                                            : {}),
                                        ...(deliveryInfo
                                            ? { delivery: deliveryInfo }
                                            : {}),
                                    },
                                }),
                            ]);
                        }
                    }

                    // After processing sunflower items, check if all items are paid
                    await markCartPaidIfAllItemsPaid(cart.id);
                }

                // Handle inventory items
                const inventoryCartItems = cartInfo.items.filter(
                    (item) =>
                        item.status !== 'paid' &&
                        (item.currency === 'inventory' || item.usesInventory),
                );

                if (inventoryCartItems.length > 0) {
                    for (const item of inventoryCartItems) {
                        if ((item.inventoryAvailable ?? 0) < item.amount) {
                            return context.json(
                                { error: 'Nema dovoljno predmeta u ruksaku' },
                                400,
                            );
                        }

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
                                cartItemId: item.id,
                                ...item,
                                amount_total: 0,
                                scheduledDeliveryEmailKeys,
                                additionalData: {
                                    ...(item.additionalData
                                        ? JSON.parse(item.additionalData)
                                        : {}),
                                    ...(deliveryInfo
                                        ? { delivery: deliveryInfo }
                                        : {}),
                                },
                            }),
                        ]);
                    }

                    await markCartPaidIfAllItemsPaid(cart.id);
                }

                const completedCart = await getShoppingCart(cart.id);
                if (completedCart?.status === 'paid') {
                    await notifyOrderConfirmationEmail({
                        to: user.userName,
                        cartId: cart.id,
                        items: buildOrderConfirmationItems(
                            cartInfo.items,
                            calculateSunflowerAmount,
                        ),
                        totalAmountCents: null,
                        currency: null,
                    });
                }
            }

            // Generate a stripe checkout items from cart items
            const stripeCartItemsWithShopData = cartInfo.items.filter(
                (item) => item.status !== 'paid' && item.currency === 'eur',
            ); // Exclude paid items and sunflowers
            const stripeItems: CheckoutItem[] = [];
            for (const item of stripeCartItemsWithShopData) {
                // TODO: Apply discounted price if available

                const name = item.shopData?.name;
                const description = item.shopData?.description || undefined;
                const finalPrice =
                    typeof item.shopData.discountPrice === 'number'
                        ? item.shopData.discountPrice
                        : (item.shopData.price ?? 0);
                const valueInCents = Math.round((finalPrice ?? 0) * 100);
                const quantity = item.amount;
                const imageUrls = item.shopData.image
                    ? [
                          /^https?:\/\//u.test(item.shopData.image)
                              ? item.shopData.image
                              : `https://www.gredice.com${item.shopData.image}`,
                      ]
                    : [];

                // TODO: Validate item data
                if (!name || !valueInCents || !quantity) {
                    console.warn('Invalid item data', {
                        name,
                        valueInCents,
                        quantity,
                    });
                    continue;
                }
                if (quantity <= 0) {
                    console.warn('Invalid item quantity', { quantity });
                    continue;
                }
                // Invalid price check
                // - valueInCents should be a positive integer
                // - valueInCents should not exceed a certain limit (e.g., 10000 cents = 100 EUR)
                if (valueInCents < 0 || valueInCents > 10000) {
                    console.warn('Invalid item price', { valueInCents });
                    continue;
                }

                stripeItems.push({
                    product: {
                        name,
                        description,
                        imageUrls,
                        // TODO: Construct/deconstruct functions
                        metadata: {
                            cartItemId: item.id.toString(),
                            entityId: item.entityId,
                            entityTypeName: item.entityTypeName,
                            accountId: account.id,
                            userId: user.id,
                            cartId: cart.id,
                            gardenId: item.gardenId,
                            raisedBedId: item.raisedBedId,
                            positionIndex:
                                item.positionIndex?.toString() ?? null,
                            additionalData: JSON.stringify({
                                ...(item.additionalData
                                    ? JSON.parse(item.additionalData)
                                    : {}),
                                ...(deliveryInfo
                                    ? { delivery: deliveryInfo }
                                    : {}),
                            }),
                            outletOfferId: item.outlet?.offerId ?? null,
                            outletReservationId:
                                item.outlet?.reservationId ?? null,
                            outletSowingDate:
                                item.outlet?.sowingDate.toISOString() ?? null,
                            outletInitialPlantStatus:
                                item.outlet?.initialPlantStatus ?? null,
                            outletPriceCents:
                                typeof item.outlet?.outletPrice === 'number'
                                    ? Math.round(item.outlet.outletPrice * 100)
                                    : null,
                            outletComparePriceCents:
                                typeof item.outlet?.comparePrice === 'number'
                                    ? Math.round(item.outlet.comparePrice * 100)
                                    : null,
                        },
                    },
                    price: {
                        valueInCents,
                        currency: 'eur',
                    },
                    quantity,
                });
            }

            if (stripeCartItemsWithShopData.length) {
                const { customerId, sessionId, url } = await stripeCheckout(
                    {
                        id: account.id,
                        email: user.userName,
                        name: user.userName,
                        stripeCustomerId: account.stripeCustomerId ?? undefined,
                    },
                    {
                        items: stripeItems,
                        expiresAt: hasOutletStripeItems
                            ? outletCheckoutExpiresAt
                            : undefined,
                    },
                );

                if (account.stripeCustomerId !== customerId) {
                    await assignStripeCustomerId(account.id, customerId);
                }

                (await getPostHogClient()).capture({
                    distinctId: accountId,
                    event: 'checkout_initiated',
                    properties: {
                        cart_id: cartId,
                        payment_method: 'stripe',
                        item_count: stripeItems.length,
                    },
                });

                return context.json({ sessionId, url });
            }

            (await getPostHogClient()).capture({
                distinctId: accountId,
                event: 'checkout_initiated',
                properties: {
                    cart_id: cartId,
                    payment_method: cartInfo.items.some(
                        (i) => i.currency === 'sunflower',
                    )
                        ? 'sunflower'
                        : 'inventory',
                    item_count: cartInfo.items.length,
                },
            });

            return context.json({ success: true });
        },
    )
    .delete(
        '/checkout/:sessionId',
        describeRoute({
            description: 'Cancel the current Stripe checkout session',
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ sessionId: z.string() })),
        async (context) => {
            const { sessionId } = context.req.valid('param');
            const { accountId } = context.get('authContext');
            const account = await getAccount(accountId);
            if (!account) {
                return context.json({ error: 'Account not found' }, 404);
            }
            if (!account.stripeCustomerId) {
                console.warn('Stripe customer ID not found', { accountId });
                return context.json({ error: 'Account not found' }, 404);
            }

            try {
                const session = await getStripeCheckoutSession(sessionId);
                if (session.customerId !== account.stripeCustomerId) {
                    return context.json(
                        { error: 'Session does not belong to this account' },
                        403,
                    );
                }
                if (session.status === 'complete') {
                    return context.json(
                        { error: 'Session already completed' },
                        400,
                    );
                }
                if (session.status === 'expired') {
                    return context.json(
                        { error: 'Session already canceled' },
                        400,
                    );
                }
                await stripeSessionCancel(sessionId);
                const outletCartIds = new Set<number>();
                for (const item of session.lineItems?.data ?? []) {
                    const product = item.price?.product;
                    if (typeof product === 'string' || product?.deleted) {
                        continue;
                    }

                    const cartId = product?.metadata.cartId
                        ? parseInt(product.metadata.cartId, 10)
                        : undefined;
                    if (cartId && product?.metadata.outletOfferId) {
                        outletCartIds.add(cartId);
                    }
                }

                await Promise.all(
                    Array.from(outletCartIds).map((cartId) =>
                        releaseOutletReservationsForCart(cartId),
                    ),
                );
            } catch (error) {
                console.error(
                    'Error retrieving or cancelling Stripe checkout session',
                    { error },
                );
                return context.json(
                    {
                        error: 'Error retrieving or cancelling Stripe checkout session',
                    },
                    500,
                );
            }

            (await getPostHogClient()).capture({
                distinctId: accountId,
                event: 'checkout_cancelled',
                properties: { session_id: sessionId },
            });

            return context.json({ success: true });
        },
    );

export default app;
