import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { getOrCreateShoppingCart, upsertOrRemoveCartItem, deleteShoppingCart, getSunflowers, cartContainsDeliverableItems } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { describeRoute } from 'hono-openapi';
import { getCartInfo } from './checkoutRoutes';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Get the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const status = context.req.query('status') as 'new' | 'paid' | undefined;
            const cart = await getOrCreateShoppingCart(accountId, status || 'new');
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            // Calculate total amount of items in the cart (exclude paid items)
            const cartInfo = (await getCartInfo(cart.items));
            const total = cartInfo.items
                .filter(item => item.status !== 'paid' && item.currency === 'eur')
                .reduce((sum, item) =>
                    sum + (typeof item.shopData.discountPrice === "number"
                        ? item.shopData.discountPrice
                        : item.shopData.price ?? 0),
                    0);
            const totalSunflowers = Math.round(cartInfo.items
                .filter(item => item.status !== 'paid' && item.currency === 'sunflower')
                .reduce((sum, item) =>
                    sum + (typeof item.shopData.discountPrice === "number"
                        ? item.shopData.discountPrice
                        : item.shopData.price ?? 0),
                    0) * 1000);

            // Check if there are enough sunflowers in the account
            let enoughSunflowers = true;
            let enoughSunflowersNote: string | null = null;
            if (totalSunflowers > await getSunflowers(accountId)) {
                enoughSunflowers = false;
                enoughSunflowersNote = `Nedovoljno suncokreta. Potrebno je ${totalSunflowers} 🌻, a imaš samo ${await getSunflowers(accountId)} 🌻.`;
            }

            // Check if cart contains deliverable items
            const hasDeliverableItems = await cartContainsDeliverableItems(cart.id);

            return context.json({
                ...cart,
                items: cartInfo.items,
                total,
                totalSunflowers,
                hasDeliverableItems,
                notes: enoughSunflowersNote ? [...cartInfo.notes, enoughSunflowersNote] : cartInfo.notes,
                allowPurchase: cartInfo.allowPurchase && enoughSunflowers,
            });
        })
    .post(
        '/',
        describeRoute({
            description: 'Add or update an item in the shopping cart',
        }),
        authValidator(['user', 'admin']),
        zValidator('json', z.object({
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
            forceCreate: z.boolean().optional().default(false),
        })),
        async (context) => {
            const { id, cartId, entityId, entityTypeName, amount, gardenId, raisedBedId, positionIndex, additionalData, currency, forceCreate } = context.req.valid('json');
            await upsertOrRemoveCartItem(id, cartId, entityId, entityTypeName, amount, gardenId, raisedBedId, positionIndex, additionalData, currency, forceCreate);
            return context.json({ success: true });
        }
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
        });

export default app;
