import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { assignStripeCustomerId, getAccount, getEntitiesFormatted, getRaisedBed, getShoppingCart, getUser, SelectShoppingCartItem } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { CheckoutItem, getStripeCheckoutSession, stripeCheckout, stripeSessionCancel } from "@gredice/stripe/server";
import { describeRoute } from 'hono-openapi';

type EntityType = Awaited<ReturnType<typeof getEntitiesFormatted>>[0];
type EntityTypeStandardized = EntityType & {
    information?: {
        name?: string;
        label?: string;
        shortDescription?: string;
        description?: string;

        // Parent items
        plant?: EntityTypeStandardized;
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

export async function getCartItemsInfo(items: SelectShoppingCartItem[]): Promise<ShoppingCartItemWithShopData[]> {
    const entityTypeNames = items.map((item) => item.entityTypeName);
    const uniqueEntityTypeNames = Array.from(new Set(entityTypeNames));
    const entitiesData = await Promise.all(uniqueEntityTypeNames.map(getEntitiesFormatted));
    const entitiesByTypeName = uniqueEntityTypeNames.reduce((acc, typeName, index) => {
        const entities = entitiesData[index] as EntityTypeStandardized[];
        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(...entities);
        return acc;
    }, {} as Record<string, EntityTypeStandardized[]>);

    // Process auto-discounts for raised beds
    const mentionedRaisedBeds = Array.from(new Set(items.filter(item => Boolean(item.raisedBedId)).map(item => item.raisedBedId!)));
    const raisedBeds = await Promise.all(mentionedRaisedBeds.map(id => getRaisedBed(id)));
    const raisedBedsToAdd = raisedBeds.filter(rb => rb && rb.status === 'new');
    const discounts: ShoppingCartDiscount[] = [];
    if (raisedBedsToAdd.length > 0) {
        const operations = await getEntitiesFormatted('operation');
        const raisedBedOperation = operations.find(block => (block as any).information.name === 'raisedBed1m');
        if (!raisedBedOperation) {
            throw new Error('Raised bed operation not found');
        }

        for (const raisedBed of raisedBedsToAdd) {
            const itemsInCartForRaisedBed = items.filter(item => item.raisedBedId === raisedBed?.id).length;
            // If more than half of the raised bed is filled, apply a discount
            // Assuming a raised bed is considered "filled" if it has more than 4 items
            if (itemsInCartForRaisedBed > 4) {
                discounts.push({
                    cartItemId: items.find(item =>
                        item.raisedBedId === raisedBed?.id &&
                        item.entityTypeName === 'operation' &&
                        item.entityId === raisedBedOperation.id.toString())?.id ?? 0,
                    discountPrice: 0,
                    discountDescription: 'Besplatna podignuta gredica ukoliko je više od pola gredice ispunjeno',
                });
            }
        }
    }

    return items.map((item) => {
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
    }).filter(i => Boolean(i)).map(i => i!);
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

            // Retrieve entities data
            const cartItemsWithShopData = await getCartItemsInfo(cart.items);

            // Generate a stripe checkout items from cart items
            const items: CheckoutItem[] = [];
            for (const item of cartItemsWithShopData) {
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

                items.push({
                    product: {
                        name,
                        description,
                        imageUrls,
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
                        currency: 'EUR',
                    },
                    quantity
                });
            }

            console.debug('Stripe checkout items', JSON.stringify(items));

            const { customerId, sessionId } = await stripeCheckout({
                id: account.id,
                email: user.userName,
                name: user.userName,
                stripeCustomerId: account.stripeCustomerId ?? undefined
            }, {
                items
            });

            if (account.stripeCustomerId !== customerId) {
                await assignStripeCustomerId(account.id, customerId);
            }

            return context.json({ sessionId });
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
