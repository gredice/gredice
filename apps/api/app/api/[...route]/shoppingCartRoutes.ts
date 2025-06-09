import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { getOrCreateShoppingCart, upsertOrRemoveCartItem, deleteShoppingCart } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { describeRoute } from 'hono-openapi';
import { getCartItemsInfo } from './checkoutRoutes';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Get the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const cart = await getOrCreateShoppingCart(accountId);
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            // TODO: Calculate total amount of items in the cart
            const cartItemsWithShopInfo = await getCartItemsInfo(cart.items);
            const total = cartItemsWithShopInfo.reduce((sum, item) => sum + (item.shopData.price ?? 0), 0);

            return context.json({
                ...cart,
                items: cartItemsWithShopInfo,
                total,
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
