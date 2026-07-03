import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    cartContainsDeliverableItems,
    deleteShoppingCart,
    getOrCreateShoppingCart,
    getOutletOffer,
    getRaisedBed,
    getShoppingCart,
    getSunflowers,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    OutletOfferUnavailableError,
    OutletReservationUnavailableError,
    releaseOutletReservationForCartItem,
    upsertOrRemoveCartItem,
    upsertOrRemoveCartItemWithOutletReservation,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { getCartInfo } from '../../../lib/checkout/cartInfo';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Get the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const status = context.req.query('status') as
                | 'new'
                | 'paid'
                | undefined;
            const cart = await getOrCreateShoppingCart(
                accountId,
                status || 'new',
            );
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            const inventoryNormalizedCart =
                (await normalizeShoppingCartInventoryUsage(cart.id)) ?? cart;
            const normalizedCart =
                (await normalizeShoppingCartScheduledDates(
                    inventoryNormalizedCart.id,
                )) ?? inventoryNormalizedCart;

            // Calculate total amount of items in the cart (exclude paid items)
            const cartInfo = await getCartInfo(normalizedCart.items, accountId);
            const total = cartInfo.items
                .filter(
                    (item) => item.status !== 'paid' && item.currency === 'eur',
                )
                .reduce(
                    (sum, item) =>
                        sum +
                        (typeof item.shopData.discountPrice === 'number'
                            ? item.shopData.discountPrice
                            : (item.shopData.price ?? 0)),
                    0,
                );
            const totalSunflowers = Math.round(
                cartInfo.items
                    .filter(
                        (item) =>
                            item.status !== 'paid' &&
                            item.currency === 'sunflower',
                    )
                    .reduce(
                        (sum, item) =>
                            sum +
                            (typeof item.shopData.discountPrice === 'number'
                                ? item.shopData.discountPrice
                                : (item.shopData.price ?? 0)),
                        0,
                    ) * 1000,
            );

            // Check if there are enough sunflowers in the account
            let enoughSunflowers = true;
            let enoughSunflowersNote: string | null = null;
            if (totalSunflowers > (await getSunflowers(accountId))) {
                enoughSunflowers = false;
                enoughSunflowersNote = `Nedovoljno suncokreta. Potrebno je ${totalSunflowers} 🌻, a imaš samo ${await getSunflowers(accountId)} 🌻.`;
            }

            // Check if cart contains deliverable items
            const hasDeliverableItems = await cartContainsDeliverableItems(
                cart.id,
            );

            return context.json({
                ...normalizedCart,
                items: cartInfo.items,
                total,
                totalSunflowers,
                hasDeliverableItems,
                notes: enoughSunflowersNote
                    ? [...cartInfo.notes, enoughSunflowersNote]
                    : cartInfo.notes,
                allowPurchase: cartInfo.allowPurchase && enoughSunflowers,
            });
        },
    )
    .post(
        '/',
        describeRoute({
            description: 'Add or update an item in the shopping cart',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                id: z.number().optional(),
                cartId: z.number(),
                entityId: z.string(),
                entityTypeName: z.string(),
                amount: z.number().int().min(0).max(100),
                gardenId: z.number().optional(),
                raisedBedId: z.number().optional(),
                positionIndex: z.number().int().optional(),
                additionalData: z.string().optional().nullable(),
                currency: z.string().optional().nullable(),
                outletOfferId: z.number().int().positive().optional(),
                forceCreate: z.boolean().optional().default(false),
            }),
        ),
        async (context) => {
            const {
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
                outletOfferId,
                forceCreate,
            } = context.req.valid('json');
            const { accountId } = context.get('authContext');
            const cart = await getShoppingCart(cartId);
            if (!cart || cart.accountId !== accountId) {
                return context.json({ error: 'Cart not found' }, 404);
            }
            // If updating an existing item, it must belong to this cart.
            if (
                typeof id === 'number' &&
                !cart.items.some((item) => item.id === id)
            ) {
                return context.json({ error: 'Cart item not found' }, 404);
            }
            if (outletOfferId && entityTypeName !== 'plantSort') {
                return context.json(
                    { error: 'Outlet offers can only be used for plant sorts' },
                    400,
                );
            }
            if (
                outletOfferId &&
                currency &&
                currency !== 'eur' &&
                currency !== 'sunflower'
            ) {
                return context.json(
                    {
                        error: 'Outlet offers can only be paid in euros or sunflowers',
                    },
                    400,
                );
            }
            if (outletOfferId && amount > 0) {
                const offer = await getOutletOffer(outletOfferId);
                if (!offer) {
                    return context.json(
                        { error: 'Outlet offer is not available' },
                        409,
                    );
                }

                const now = Date.now();
                if (
                    offer.status !== 'published' ||
                    offer.startAt.getTime() > now ||
                    offer.endAt.getTime() <= now ||
                    offer.remainingQuantity < amount ||
                    offer.plantSortId.toString() !== entityId
                ) {
                    return context.json(
                        { error: 'Outlet offer is not available' },
                        409,
                    );
                }
            }
            if (amount > 0 && raisedBedId) {
                const raisedBed = await getRaisedBed(raisedBedId);
                if (!raisedBed || raisedBed.accountId !== accountId) {
                    return context.json({ error: 'Raised bed not found' }, 404);
                }

                if (isRaisedBedAbandoned(raisedBed.status)) {
                    return context.json(
                        {
                            error: `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
                        },
                        409,
                    );
                }
            }
            try {
                if (outletOfferId && amount > 0) {
                    await upsertOrRemoveCartItemWithOutletReservation({
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
                        outletOfferId,
                        accountId,
                    });
                } else {
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
                    );
                    if (amount > 0 && cartItemId) {
                        await releaseOutletReservationForCartItem(cartItemId);
                    }
                }
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
                if (
                    error instanceof Error &&
                    error.message ===
                        'Cannot update paid shopping cart item via API'
                ) {
                    return context.json(
                        { error: 'Cannot update paid shopping cart item' },
                        400,
                    );
                }

                throw error;
            }
            (await getPostHogClient()).capture({
                distinctId: accountId,
                event: 'cart_item_updated',
                properties: {
                    cart_id: cartId,
                    entity_id: entityId,
                    entity_type: entityTypeName,
                    amount,
                    currency: currency ?? undefined,
                    outlet_offer_id: outletOfferId,
                },
            });
            return context.json({ success: true });
        },
    )
    .delete(
        '/',
        describeRoute({
            description: 'Delete the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            await deleteShoppingCart(accountId);
            return context.json({ success: true });
        },
    );

export default app;
