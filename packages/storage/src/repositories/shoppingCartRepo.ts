import { and, eq, not } from "drizzle-orm";
import { shoppingCarts, shoppingCartItems } from "../schema";
import { storage } from "../storage";

export async function getOrCreateShoppingCart(accountId: string, expiresAt?: Date, status: 'new' | 'paid' = 'new') {
    let cart = await storage().query.shoppingCarts.findFirst({
        where: and(
            eq(shoppingCarts.accountId, accountId),
            eq(shoppingCarts.isDeleted, false),
            eq(shoppingCarts.status, status)
        ),
        with: {
            items: {
                where: and(eq(shoppingCartItems.isDeleted, false)),
                orderBy: shoppingCartItems.createdAt,
            }
        },
    });
    if (cart) {
        return cart;
    }

    const createdCartId = (await storage()
        .insert(shoppingCarts)
        .values({
            accountId,
            expiresAt: expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'new',
        })
        .returning({
            id: shoppingCarts.id
        }))[0].id;

    return getShoppingCart(createdCartId);
}

export async function markCartPaidIfAllItemsPaid(cartId: number) {
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        console.warn(`Cart ${cartId} not found for marking as paid.`);
        return;
    }

    if (cart.items.length > 0 && cart.items.every(item => item.status === 'paid')) {
        await storage()
            .update(shoppingCarts)
            .set({ status: 'paid' })
            .where(eq(shoppingCarts.id, cartId));
        console.debug(`Cart ${cartId} marked as paid because all items are paid.`);
    }
}

export async function setCartItemPaid(itemId: number) {
    await storage()
        .update(shoppingCartItems).set({ status: 'paid' })
        .where(eq(shoppingCartItems.id, itemId));
}

export async function upsertOrRemoveCartItem(
    cartId: number,
    entityId: string,
    entityTypeName: string,
    amount: number,
    gardenId?: number,
    raisedBedId?: number,
    positionIndex?: number,
    additionalData?: string | null,
    type: 'user' | 'automatic' = 'user', // new param, default to 'user'
) {
    const existingItem = await storage().query.shoppingCartItems.findFirst({
        where: and(
            eq(shoppingCartItems.cartId, cartId),
            eq(shoppingCartItems.entityTypeName, entityTypeName),
            eq(shoppingCartItems.entityId, entityId),
            gardenId ? eq(shoppingCartItems.gardenId, gardenId) : undefined,
            raisedBedId ? eq(shoppingCartItems.raisedBedId, raisedBedId) : undefined,
            positionIndex ? eq(shoppingCartItems.positionIndex, positionIndex) : undefined,
            additionalData ? eq(shoppingCartItems.additionalData, additionalData) : undefined,
            eq(shoppingCartItems.isDeleted, false),
            eq(shoppingCartItems.type, type)
        ),
    });

    // Prevent deletion of paid items
    if (amount <= 0 && existingItem?.status === 'paid') {
        throw new Error('Cannot delete paid shopping cart item via API');
    }

    // Prevent deletion of automatic items (amount <= 0)
    if (amount <= 0 && existingItem?.type === 'automatic' && existingItem.raisedBedId) {
        // Check if this is a raised bed automatic item and if there are any other items for this raised bed
        const hasOtherItemsForRaisedBed = await storage().query.shoppingCartItems.findFirst({
            where: and(
                eq(shoppingCartItems.cartId, cartId),
                eq(shoppingCartItems.raisedBedId, existingItem.raisedBedId),
                eq(shoppingCartItems.isDeleted, false),
                // Exclude the automatic item itself
                not(eq(shoppingCartItems.id, existingItem.id))
            ),
        });
        if (hasOtherItemsForRaisedBed) {
            throw new Error('Cannot delete automatic shopping cart item via API');
        }
        // Allow removal if no other items for this raised bed
        await storage().update(shoppingCartItems).set({
            isDeleted: true,
        }).where(eq(shoppingCartItems.id, existingItem.id));
        return null;
    }

    if (amount <= 0) {
        if (existingItem) {
            await storage().update(shoppingCartItems).set({
                isDeleted: true,
            }).where(eq(shoppingCartItems.id, existingItem.id));

            const remainingItems = await storage().query.shoppingCartItems.findMany({
                where: and(eq(shoppingCartItems.cartId, cartId), eq(shoppingCartItems.isDeleted, false)),
            });

            if (remainingItems.length === 0) {
                await storage().update(shoppingCarts).set({ isDeleted: true }).where(eq(shoppingCarts.id, cartId));
            }
        }
        return null;
    }

    if (existingItem) {
        return (await storage()
            .update(shoppingCartItems)
            .set({
                amount,
            })
            .where(eq(shoppingCartItems.id, existingItem.id))
            .returning({
                id: shoppingCartItems.id
            }))[0].id;
    } else {
        return (await storage()
            .insert(shoppingCartItems)
            .values({
                cartId,
                entityId,
                entityTypeName,
                amount,
                gardenId,
                raisedBedId,
                positionIndex,
                additionalData,
                type
            })
            .returning({
                id: shoppingCartItems.id
            }))[0].id;
    }
}

export async function deleteShoppingCart(accountId: string) {
    const cart = await storage().query.shoppingCarts.findFirst({
        where: and(eq(shoppingCarts.accountId, accountId), eq(shoppingCarts.isDeleted, false)),
    });

    if (cart) {
        await storage().update(shoppingCarts).set({ isDeleted: true }).where(eq(shoppingCarts.id, cart.id));
        await storage().update(shoppingCartItems).set({ isDeleted: true }).where(eq(shoppingCartItems.cartId, cart.id));
    }
}

export async function getAllShoppingCarts({ status = 'new' }: { status?: 'new' | 'paid' } = {}) {
    return await storage().query.shoppingCarts.findMany({
        where: and(eq(shoppingCarts.isDeleted, false), eq(shoppingCarts.status, status)),
        with: {
            items: {
                where: eq(shoppingCartItems.isDeleted, false),
                orderBy: shoppingCartItems.createdAt,
            }
        },
    });
}

export async function getShoppingCart(cartId: number) {
    return await storage().query.shoppingCarts.findFirst({
        where: and(
            eq(shoppingCarts.id, cartId),
            eq(shoppingCarts.isDeleted, false)),
        with: {
            items: {
                where: eq(shoppingCartItems.isDeleted, false),
                orderBy: shoppingCartItems.createdAt,
            }
        },
    });
}