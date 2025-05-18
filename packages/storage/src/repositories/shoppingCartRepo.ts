import { and, eq } from "drizzle-orm";
import { shoppingCarts, shoppingCartItems } from "../schema";
import { storage } from "../storage";

export async function getOrCreateShoppingCart(accountId: string, expiresAt?: Date) {
    let cart = await storage.query.shoppingCarts.findFirst({
        where: and(eq(shoppingCarts.accountId, accountId), eq(shoppingCarts.isDeleted, false)),
        with: {
            items: true
        },
    });
    if (cart) {
        return cart;
    }

    const createdCart = (await storage
        .insert(shoppingCarts)
        .values({ accountId, expiresAt: expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .returning({
            id: shoppingCarts.id
        }))[0];

    return await storage.query.shoppingCarts.findFirst({
        where: and(eq(shoppingCarts.id, createdCart.id), eq(shoppingCarts.isDeleted, false)),
        with: {
            items: true
        },
    });
}

export async function upsertOrRemoveCartItem(cartId: number, entityId: string, entityTypeName: string, amount: number) {
    const existingItem = await storage.query.shoppingCartItems.findFirst({
        where: and(
            eq(shoppingCartItems.cartId, cartId),
            eq(shoppingCartItems.entityId, entityId),
            eq(shoppingCartItems.isDeleted, false)
        ),
    });

    if (amount <= 0) {
        if (existingItem) {
            await storage.update(shoppingCartItems).set({
                isDeleted: true,
            }).where(eq(shoppingCartItems.id, existingItem.id));

            const remainingItems = await storage.query.shoppingCartItems.findMany({
                where: and(eq(shoppingCartItems.cartId, cartId), eq(shoppingCartItems.isDeleted, false)),
            });

            if (remainingItems.length === 0) {
                await storage.update(shoppingCarts).set({ isDeleted: true }).where(eq(shoppingCarts.id, cartId));
            }
        }
        return;
    }

    if (existingItem) {
        await storage.update(shoppingCartItems).set({
            amount,
        }).where(eq(shoppingCartItems.id, existingItem.id));
    } else {
        await storage.insert(shoppingCartItems).values({
            cartId,
            entityId,
            entityTypeName,
            amount,
        });
    }
}

export async function deleteShoppingCart(accountId: string) {
    const cart = await storage.query.shoppingCarts.findFirst({
        where: and(eq(shoppingCarts.accountId, accountId), eq(shoppingCarts.isDeleted, false)),
    });

    if (cart) {
        await storage.update(shoppingCarts).set({ isDeleted: true }).where(eq(shoppingCarts.id, cart.id));
        await storage.update(shoppingCartItems).set({ isDeleted: true }).where(eq(shoppingCartItems.cartId, cart.id));
    }
}

export async function getAllShoppingCarts() {
    return await storage.query.shoppingCarts.findMany({
        where: eq(shoppingCarts.isDeleted, false),
        with: {
            items: true
        },
    });
}

export async function getShoppingCart(cartId: number) {
    return await storage.query.shoppingCarts.findFirst({
        where: and(eq(shoppingCarts.id, cartId), eq(shoppingCarts.isDeleted, false)),
        with: {
            items: true
        },
    });
}