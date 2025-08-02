import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { markCartPaidIfAllItemsPaid, assignStripeCustomerId, getAccount, getEntitiesFormatted, getRaisedBed, getShoppingCart, getUser, SelectShoppingCartItem, setCartItemPaid, spendSunflowers } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { CheckoutItem, getStripeCheckoutSession, stripeCheckout, stripeSessionCancel } from "@gredice/stripe/server";
import { describeRoute } from 'hono-openapi';
import { processItem } from '../../../lib/stripe/processCheckoutSession';

export type EntityStandardized = {
    id: number;
    entityType: {
        id: number;
        name: string;
        label: string;
    }
    information?: {
        name?: string;
        label?: string;
        shortDescription?: string;
        description?: string;

        // Parent items
        plant?: EntityStandardized;
    };
    images?: {
        cover?: { url?: string };
    },
    image?: {
        cover?: { url?: string };
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
    };
}

export type ShoppingCartDiscount = {
    cartItemId: number;
    discountPrice: number;
    discountDescription: string;
}

export type ShoppingCartItemWithShopData = SelectShoppingCartItem & {
    shopData: {
        name?: string;
        description?: string;
        image?: string;
        price?: number;
        discountPrice?: number;
        discountDescription?: string;
    };
};

// TODO: Move to lib
export async function getCartInfo(items: SelectShoppingCartItem[]) {
    const entityTypeNames = items.map((item) => item.entityTypeName);
    const uniqueEntityTypeNames = Array.from(new Set(entityTypeNames));
    const entitiesData = await Promise.all(uniqueEntityTypeNames.map(getEntitiesFormatted));
    const entitiesByTypeName = uniqueEntityTypeNames.reduce((acc, typeName, index) => {
        const entities = entitiesData[index] as EntityStandardized[];
        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(...entities);
        return acc;
    }, {} as Record<string, EntityStandardized[]>);

    const discounts: ShoppingCartDiscount[] = [];

    // Process paid discounts for items that are already paid
    const paidItems = items.filter(item => item.status === 'paid');
    if (paidItems.length > 0) {
        for (const item of paidItems) {
            discounts.push({
                cartItemId: item.id,
                discountPrice: 0,
                discountDescription: 'Već plaćeno',
            });
        }
    }

    const cartItemsWithShopInfo = items.map((item) => {
        const entityData = entitiesByTypeName[item.entityTypeName].find((entity) => entity?.id.toString() === item.entityId);
        if (!entityData) {
            console.warn('Entity not found', { entityId: item.entityId, entityTypeName: item.entityTypeName });
            return null;
        }

        return {
            ...item,
            shopData: {
                name: entityData.information?.label ?? entityData.information?.name,
                description: entityData.information?.shortDescription ?? entityData.information?.description,
                image: entityData.image?.cover?.url ??
                    entityData.images?.cover?.url ??
                    entityData.information?.plant?.image?.cover?.url ??
                    entityData.information?.plant?.images?.cover?.url,
                price: entityData.prices?.perOperation ??
                    entityData.prices?.perPlant ??
                    entityData.information?.plant?.prices?.perOperation ??
                    entityData.information?.plant?.prices?.perPlant,
                discountPrice: discounts.find(discount => discount.cartItemId === item.id)?.discountPrice,
                discountDescription: discounts.find(discount => discount.cartItemId === item.id)?.discountDescription
            }
        };
    }).filter(i => Boolean(i)).map(i => i!).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // --- Notes logic ---
    const notes: string[] = [];
    // Group items by raisedBedId, count items per raised bed (excluding paid items)
    // Find all 'new' raised beds
    let allowPurchase = true;
    const raisedBedItemCounts: Record<number, number> = {};
    cartItemsWithShopInfo.forEach(item => {
        if (item.raisedBedId && item.status !== 'paid') {
            raisedBedItemCounts[item.raisedBedId] = (raisedBedItemCounts[item.raisedBedId] || 0) + 1;
        }
    });
    const mentionedRaisedBedIds = Array.from(new Set(cartItemsWithShopInfo.filter(item => Boolean(item.raisedBedId)).map(item => item.raisedBedId!)));
    const mentionedRaisedBeds = await Promise.all(mentionedRaisedBedIds.map(id => getRaisedBed(id)));

    const newRaisedBeds = mentionedRaisedBeds.filter(rb => rb && rb.status === 'new');
    const requiredItemsCount = Math.ceil(newRaisedBeds.length / 2) * 9;

    const cartItemsInNewRaisedBeds = cartItemsWithShopInfo.filter(item =>
        item.status !== 'paid' &&
        item.raisedBedId &&
        item.entityTypeName === 'plantSort' &&
        newRaisedBeds.some(rb => rb?.id === item.raisedBedId));
    if (cartItemsInNewRaisedBeds.length < requiredItemsCount) {
        const missingItemsCount = requiredItemsCount - cartItemsInNewRaisedBeds.length;
        const neededPlural = missingItemsCount === 1 ? 'Potrebna je' : (missingItemsCount > 4 ? 'Potrebno je' : 'Potrebne su');
        const plantPlural = missingItemsCount === 1 ? 'biljka' : (missingItemsCount > 4 ? 'biljaka' : 'biljke');
        const raisedBedsPlural = newRaisedBeds.length === 1 ? 'nove gredice' : 'novih gredica';
        notes.push(`${neededPlural} još ${missingItemsCount} ${plantPlural} u ovoj ili susjednoj gredici za postavljanje ${raisedBedsPlural}.`);
        allowPurchase = false;
    }

    // Minimum order (0.5 EUR)
    const totalCartValue = cartItemsWithShopInfo.reduce((sum, item) => {
        if (item.status !== 'paid' && item.currency === 'eur') {
            const price = item.shopData.discountPrice ?? item.shopData.price ?? 0;
            return sum + (price * item.amount);
        }
        return sum;
    }, 0);
    if (totalCartValue > 0 && totalCartValue < 0.5) {
        notes.push('Minimalna vrijednost narudžbe je 0,50 €.');
        allowPurchase = false;
    }
    // --- End notes logic ---

    return {
        notes,
        allowPurchase,
        items: cartItemsWithShopInfo
    };
}

const app = new Hono<{ Variables: AuthVariables }>()
    .post(
        '/checkout',
        describeRoute({
            description: 'Create a Stripe checkout session for the given cart',
        }),
        authValidator(['user', 'admin']),
        zValidator('json', z.object({ cartId: z.number() })),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { cartId } = context.req.valid('json');

            // Retrieve data
            const [account, user, cart] = await Promise.all([
                getAccount(accountId),
                getUser(userId),
                getShoppingCart(cartId)
            ]);
            if (!account) {
                return context.json({ error: 'Account not found' }, 404);
            }
            if (!user) {
                return context.json({ error: 'User not found' }, 404);
            }
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }
            if (cart.accountId !== accountId) {
                console.warn('Account ID mismatch', { accountId, cartAccountId: cart.accountId });
                return context.json({ error: 'Cart not found' }, 404);
            }

            // Validate cart status
            if (cart.status === 'paid') {
                return context.json({ error: 'Cart already paid' }, 400);
            }

            // Retrieve entities data
            const cartInfo = await getCartInfo(cart.items);
            if (!cartInfo.allowPurchase) {
                return context.json({ error: 'Cart in invalid state' }, 400);
            }

            // Handle sunflower items
            const sunflowerCartItemsWithShopData = cartInfo.items
                .filter(item => item.status !== 'paid' && item.currency === 'sunflower');
            if (sunflowerCartItemsWithShopData.length > 0) {
                // Check if there are enough sunflowers in the account
                for (const item of sunflowerCartItemsWithShopData) {
                    const sunflowerAmount = Math.round((typeof item.shopData.discountPrice === "number"
                        ? item.shopData.discountPrice
                        : item.shopData.price ?? 0) * 1000);
                    let didPaySunflowers = false;
                    try {
                        await spendSunflowers(accountId, sunflowerAmount, `shoppingCartItem:${item.id}`);
                        didPaySunflowers = true;
                    } catch (error) {
                        console.error('Error spending sunflowers', { error, accountId, sunflowerAmount, item });
                    }

                    if (didPaySunflowers) {
                        await Promise.all([
                            setCartItemPaid(item.id),
                            processItem({
                                accountId,
                                ...item,
                                amount_total: sunflowerAmount
                            })
                        ]);
                    }
                }

                // After processing sunflower items, check if all items are paid
                await markCartPaidIfAllItemsPaid(cart.id);
            }

            // Generate a stripe checkout items from cart items
            const stripeCartItemsWithShopData = cartInfo.items
                .filter(item => item.status !== 'paid' && item.currency === 'eur') // Exclude paid items and sunflowers
            const stripeItems: CheckoutItem[] = [];
            for (const item of stripeCartItemsWithShopData) {
                // TODO: Apply discounted price if available

                const name = item.shopData?.name;
                const description = item.shopData?.description || undefined;
                const finalPrice = typeof item.shopData.discountPrice === "number" ? item.shopData.discountPrice : item.shopData.price ?? 0;
                const valueInCents = Math.round((finalPrice ?? 0) * 100);
                const quantity = item.amount;
                const imageUrls = item.shopData.image ? ["https://www.gredice.com" + item.shopData.image] : [];

                // TODO: Validate item data
                if (!name || !valueInCents || !quantity) {
                    console.warn('Invalid item data', { name, valueInCents, quantity });
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
                            entityId: item.entityId,
                            entityTypeName: item.entityTypeName,
                            accountId: account.id,
                            userId: user.id,
                            cartId: cart.id,
                            gardenId: item.gardenId,
                            raisedBedId: item.raisedBedId,
                            positionIndex: item.positionIndex?.toString() ?? null,
                            additionalData: item.additionalData ?? null
                        }
                    },
                    price: {
                        valueInCents,
                        currency: 'eur',
                    },
                    quantity
                });
            }

            if (stripeCartItemsWithShopData.length) {
                const { customerId, sessionId, url } = await stripeCheckout({
                    id: account.id,
                    email: user.userName,
                    name: user.userName,
                    stripeCustomerId: account.stripeCustomerId ?? undefined
                }, {
                    items: stripeItems
                });

                if (account.stripeCustomerId !== customerId) {
                    await assignStripeCustomerId(account.id, customerId);
                }

                return context.json({ sessionId, url });
            }
            return context.json({ success: true });
        }
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
                    return context.json({ error: 'Session does not belong to this account' }, 403);
                }
                if (session.status === 'complete') {
                    return context.json({ error: 'Session already completed' }, 400);
                }
                if (session.status === 'expired') {
                    return context.json({ error: 'Session already canceled' }, 400);
                }
                await stripeSessionCancel(sessionId);
            } catch (error) {
                console.error('Error retrieving or cancelling Stripe checkout session', { error });
                return context.json({ error: 'Error retrieving or cancelling Stripe checkout session' }, 500);
            }

            return context.json({ success: true });
        });

export default app;
