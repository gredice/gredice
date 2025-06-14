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
            const status = context.req.query('status') as 'new' | 'paid' | undefined;
            let cart = await getOrCreateShoppingCart(accountId, undefined, status || 'new');
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            // Process shopping cart
            // 1. inject raised bed item if raised beds are not yet paid (entityTypeName = 'raisedBed')
            const mentionedRaisedBedIds = Array.from(new Set(cart.items.filter(item => Boolean(item.raisedBedId)).map(item => item.raisedBedId!)));
            const raisedBeds = await Promise.all(mentionedRaisedBedIds.map(id => getRaisedBed(id)));
            const raisedBedsToAdd = raisedBeds.filter(rb => rb && rb.status === 'new');
            if (raisedBedsToAdd.length > 0) {
                console.debug('Adding raised beds to cart', { raisedBedsToAdd });
                const operations = await getEntitiesFormatted('operation');
                const raisedBedOperation = operations.find((operation: EntityStandardized) => operation.information?.name === 'raisedBed1m');
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
            let didRemoveItems = false;
            for (const raisedBedId of mentionedRaisedBedIds) {
                const raisedBed = raisedBeds.find(rb => rb?.id === raisedBedId);
                const itemsForBed = cart.items.filter(item => item.raisedBedId === raisedBedId && !item.isDeleted);
                const itemForBed = itemsForBed[0];
                const hasOnlyAutomatic =
                    itemsForBed.length === 1 &&
                    itemForBed.entityTypeName === 'operation' &&
                    itemForBed.type === 'automatic' &&
                    itemForBed.gardenId;
                if (hasOnlyAutomatic || raisedBed?.status !== 'new') {
                    await upsertOrRemoveCartItem(
                        cart.id,
                        itemForBed.entityId,
                        itemForBed.entityTypeName,
                        0, // Remove
                        itemForBed.gardenId ?? undefined,
                        itemForBed.raisedBedId ?? undefined,
                        itemForBed.positionIndex ?? undefined,
                        itemForBed.additionalData ?? undefined,
                        'automatic',
                        true // Force delete to allow removal of paid items
                    );
                    didRemoveItems = true;
                }
            }
            if (didRemoveItems) {
                // Refresh the cart after removing items
                cart = await getOrCreateShoppingCart(accountId);
                if (!cart) {
                    return context.json({ error: 'Cart not found' }, 404);
                }
            }

            // Calculate total amount of items in the cart (exclude paid items)
            const cartItemsWithShopInfo = (await getCartItemsInfo(cart.items));
            const total = cartItemsWithShopInfo
                .filter(item => item.status !== 'paid')
                .reduce((sum, item) =>
                    sum + (typeof item.shopData.discountPrice === "number"
                        ? item.shopData.discountPrice
                        : item.shopData.price ?? 0),
                    0);

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
            // status is intentionally omitted to prevent updates from API
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
