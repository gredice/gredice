import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { assignStripeCustomerId, getAccount, getEntitiesFormatted, getEntityFormatted, getEntityTypeByName, getShoppingCart, getUser } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { CheckoutItem, getStripeCheckoutSession, stripeCheckout, stripeSessionCancel } from "@gredice/stripe/server";
import { describeRoute } from 'hono-openapi';

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
            type EntityType = Awaited<ReturnType<typeof getEntitiesFormatted>>[0];
            const entityTypeNames = cart.items.map((item) => item.entityTypeName);
            const entitiesData = await Promise.all(entityTypeNames.map(getEntitiesFormatted));
            const entitiesByTypeName = entityTypeNames.reduce((acc, typeName, index) => {
                const entities = entitiesData[index];
                if (!acc[typeName]) {
                    acc[typeName] = [];
                }
                acc[typeName].push(...entities);
                return acc;
            }, {} as Record<string, EntityType[]>);

            // TODO: Generate a stripe checkout items from cart items
            const items: CheckoutItem[] = [];
            for (const item of cart.items) {
                const entityData = entitiesByTypeName[item.entityTypeName].find((entity) => entity?.id.toString() === item.entityId);
                if (!entityData) {
                    console.warn('Entity not found', { entityId: item.entityId, entityTypeName: item.entityTypeName });
                    continue;
                }

                // TODO: Apply discounted price if available

                const name = (entityData as any)?.information?.name;
                const description = (entityData as any)?.information?.shortDescription || undefined;
                const valueInCents = Math.round((entityData as any).prices.perOperation * 100);
                const quantity = item.amount;
                const imageUrls = (entityData as any)?.images?.cover ? [
                    (entityData as any).images.cover
                ] : [];

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
                            raisedBedId: item.raisedBedId
                        }
                    },
                    price: {
                        valueInCents,
                        currency: 'EUR',
                    },
                    quantity
                });
            }

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
