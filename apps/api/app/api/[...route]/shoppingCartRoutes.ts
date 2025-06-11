import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import { getOrCreateShoppingCart, upsertOrRemoveCartItem, deleteShoppingCart, getRaisedBed, getEntitiesFormatted } from '@gredice/storage';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { describeRoute } from 'hono-openapi';
import { EntityStandardized, getCartItemsInfo } from './checkoutRoutes';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Get the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            let cart = await getOrCreateShoppingCart(accountId);
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            // Process shopping cart
            // 1. inject raised bed item if raised beds are not yet paid (entityTypeName = 'raisedBed')
            const mentionedRaisedBeds = Array.from(new Set(cart.items.filter(item => Boolean(item.raisedBedId)).map(item => item.raisedBedId!)));
            const raisedBeds = await Promise.all(mentionedRaisedBeds.map(id => getRaisedBed(id)));
            const raisedBedsToAdd = raisedBeds.filter(rb => rb && rb.status === 'new');
            if (raisedBedsToAdd.length > 0) {
                console.debug('Adding raised beds to cart', { raisedBedsToAdd });
                const operations = await getEntitiesFormatted('operation');
                const raisedBedOperation = operations.find(operation => (operation as EntityStandardized).information?.name === 'raisedBed1m');
                if (!raisedBedOperation) {
                    return context.json({ error: 'Raised bed operation not found' }, 500);
                }

                for (const raisedBed of raisedBedsToAdd) {
                    if (!raisedBed) continue;

                    await upsertOrRemoveCartItem(
                        cart.id,
                        (raisedBedOperation.id ?? 0).toString(),
                        raisedBedOperation.entityType.name,
                        1, // Amount is always 1 for raised beds
                        raisedBed.gardenId,
                        raisedBed.id,
                        undefined,
                        undefined,
                        'automatic' // Mark as automatic
                    );
                }

                // Refresh the cart after adding raised beds
                cart = await getOrCreateShoppingCart(accountId);
                if (!cart) {
                    return context.json({ error: 'Cart not found' }, 404);
                }
            }

            // 2. Remove automatic raised bed operation if no items reference the raised bed
            for (const raisedBed of mentionedRaisedBeds) {
                const itemsForBed = cart.items.filter(item => item.raisedBedId === raisedBed && !item.isDeleted);
                const hasOnlyAutomatic = itemsForBed.length === 1 && itemsForBed[0].entityTypeName === 'operation' && itemsForBed[0].type === 'automatic';
                if (hasOnlyAutomatic) {
                    await upsertOrRemoveCartItem(
                        cart.id,
                        itemsForBed[0].entityId,
                        itemsForBed[0].entityTypeName,
                        0, // Remove
                        itemsForBed[0].gardenId,
                        itemsForBed[0].raisedBedId,
                        itemsForBed[0].positionIndex,
                        itemsForBed[0].additionalData,
                        'automatic'
                    );
                }
            }

            // Calculate total amount of items in the cart
            const cartItemsWithShopInfo = await getCartItemsInfo(cart.items);
            const total = cartItemsWithShopInfo.reduce((sum, item) => sum + (typeof item.shopData.discountPrice === "number" ? item.shopData.discountPrice : item.shopData.price ?? 0), 0);

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
            await upsertOrRemoveCartItem(cartId, entityId, entityTypeName, amount, gardenId, raisedBedId, positionIndex, additionalData, 'user');
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
