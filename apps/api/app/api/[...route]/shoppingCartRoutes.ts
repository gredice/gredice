import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { getOrCreateShoppingCart, upsertOrRemoveCartItem, deleteShoppingCart } from '@gredice/storage';
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
            const cart = await getOrCreateShoppingCart(accountId, undefined, status || 'new');
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            // Calculate total amount of items in the cart (exclude paid items)
            const cartInfo = (await getCartInfo(cart.items));
            const total = cartInfo.items
                .filter(item => item.status !== 'paid')
                .reduce((sum, item) =>
                    sum + (typeof item.shopData.discountPrice === "number"
                        ? item.shopData.discountPrice
                        : item.shopData.price ?? 0),
                    0);

            return context.json({
                ...cart,
                items: cartInfo.items,
                total,
                notes: cartInfo.notes,
                allowPurchase: cartInfo.allowPurchase
            });
        })
    .post(
        '/',
        describeRoute({
            description: 'Add or update an item in the shopping cart',
        }),
        authValidator(['user', 'admin']),
        zValidator('json', z.object({
            cartId: z.number(),
            entityId: z.string(),
            entityTypeName: z.string(),
            amount: z.number().int().min(0).max(100),
            gardenId: z.number().optional(),
            raisedBedId: z.number().optional(),
            positionIndex: z.number().int().optional(),
            additionalData: z.string().optional().nullable(),
            // status is intentionally omitted to prevent updates from API
        })),
        async (context) => {
            const { cartId, entityId, entityTypeName, amount, gardenId, raisedBedId, positionIndex, additionalData } = context.req.valid('json');
            await upsertOrRemoveCartItem(cartId, entityId, entityTypeName, amount, gardenId, raisedBedId, positionIndex, additionalData);
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
