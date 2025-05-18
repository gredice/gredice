import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { getOrCreateShoppingCart, upsertOrRemoveCartItem, deleteShoppingCart, getShoppingCart } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { describeRoute } from 'hono-openapi';

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
            return context.json(cart);
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
            amount: z.number().int().min(1),
        })),
        async (context) => {
            const { cartId, entityId, entityTypeName, amount } = context.req.valid('json');
            await upsertOrRemoveCartItem(cartId, entityId, entityTypeName, amount);
            return context.json({ success: true });
        }
    )
    .patch(
        '/',
        describeRoute({
            description: 'Update an item in the shopping cart',
        }),
        authValidator(['user', 'admin']),
        zValidator('json', z.object({
            cartId: z.number(),
            entityId: z.string(),
            entityTypeName: z.string(),
            amount: z.number().int(),
        })),
        async (context) => {
            const { cartId, entityId, entityTypeName, amount } = context.req.valid('json');
            await upsertOrRemoveCartItem(cartId, entityId, entityTypeName, amount);
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
