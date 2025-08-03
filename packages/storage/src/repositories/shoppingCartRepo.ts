import { and, eq, not } from "drizzle-orm";
import { shoppingCarts, shoppingCartItems } from "../schema";
import { storage } from "../storage";

export async function getOrCreateShoppingCart(accountId: string, status: 'new' | 'paid' = 'new') {
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
    id: number | null | undefined,
    cartId: number,
    entityId: string,
    entityTypeName: string,
    amount: number,
    gardenId?: number,
    raisedBedId?: number,
    positionIndex?: number,
    additionalData?: string | null,
    currency?: string | null,
    forceCreate?: boolean,
    forceDelete: boolean = false
) {
    if (forceCreate && id) {
        throw new Error('Cannot create an item with an existing ID');
    }

    const existingItem = id
        ? await storage().query.shoppingCartItems.findFirst({
            where: and(
                eq(shoppingCartItems.id, id),
                eq(shoppingCartItems.isDeleted, false)
            ),
        })
        : (!forceCreate
            ? await storage().query.shoppingCartItems.findFirst({
                where: and(
                    eq(shoppingCartItems.cartId, cartId),
                    eq(shoppingCartItems.entityTypeName, entityTypeName),
                    eq(shoppingCartItems.entityId, entityId),
                    gardenId ? eq(shoppingCartItems.gardenId, gardenId) : undefined,
                    raisedBedId ? eq(shoppingCartItems.raisedBedId, raisedBedId) : undefined,
                    typeof positionIndex === 'number' ? eq(shoppingCartItems.positionIndex, positionIndex) : undefined,
                    eq(shoppingCartItems.isDeleted, false),
                ),
            })
            : null);

    // Prevent deletion of paid items
    if (!forceDelete && amount <= 0 && existingItem?.status === 'paid') {
        throw new Error('Cannot delete paid shopping cart item via API');
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
                additionalData,
                currency: currency ? currency : undefined // Update only if provided
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
                currency: currency ?? 'eur'
            })
            .returning({
                id: shoppingCartItems.id
            }))[0].id;
    }
}

export async function deleteShoppingCart(accountId: string) {
    const cart = await getOrCreateShoppingCart(accountId);
    if (cart) {
        await Promise.all([
            storage().update(shoppingCarts).set({ isDeleted: true }).where(eq(shoppingCarts.id, cart.id)),
            storage().update(shoppingCartItems).set({ isDeleted: true }).where(eq(shoppingCartItems.cartId, cart.id))
        ]);
    }
}

export async function getAllShoppingCarts({ status = 'new', filter }: {
    status?: 'new' | 'paid' | null
    filter?: {
        accountId?: string
    }
} = {}) {
    return await storage().query.shoppingCarts.findMany({
        where: and(
            eq(shoppingCarts.isDeleted, false),
            status ? eq(shoppingCarts.status, status) : undefined,
            filter?.accountId ? eq(shoppingCarts.accountId, filter.accountId) : undefined
        ),
        with: {
            account: {
                with: {
                    accountUsers: {
                        with: {
                            user: true
                        }
                    }
                }
            },
            items: {
                where: eq(shoppingCartItems.isDeleted, false),
                orderBy: shoppingCartItems.createdAt,
            }
        },
        orderBy: shoppingCarts.createdAt,
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