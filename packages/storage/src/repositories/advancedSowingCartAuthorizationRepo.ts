import {
    ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    type AdvancedSowingCartAuthorizationV1,
    parseAdvancedSowingCartAuthorizationV1,
} from '@gredice/js/plants';
import { eq, inArray } from 'drizzle-orm';
import {
    shoppingCartItemAdvancedSowingAuthorizations,
    shoppingCartItems,
} from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

export class AdvancedSowingCartAuthorizationPersistenceError extends Error {
    override readonly name = 'AdvancedSowingCartAuthorizationPersistenceError';
}

function parsePersistedAdvancedSowingCartAuthorization(
    value: unknown,
): AdvancedSowingCartAuthorizationV1 {
    try {
        return parseAdvancedSowingCartAuthorizationV1(value);
    } catch {
        throw new AdvancedSowingCartAuthorizationPersistenceError(
            'Advanced Sowing cart authorization is invalid.',
        );
    }
}

export async function getShoppingCartItemAdvancedSowingAuthorizations(
    cartItemIds: readonly number[],
    db: DatabaseClient = storage(),
) {
    const normalizedIds = [...new Set(cartItemIds)].sort(
        (left, right) => left - right,
    );
    if (
        normalizedIds.some(
            (cartItemId) =>
                !Number.isSafeInteger(cartItemId) || cartItemId <= 0,
        )
    ) {
        throw new AdvancedSowingCartAuthorizationPersistenceError(
            'Advanced Sowing cart item IDs are invalid.',
        );
    }
    if (normalizedIds.length === 0) {
        return new Map<number, AdvancedSowingCartAuthorizationV1>();
    }

    const rows = await db
        .select({
            authorization:
                shoppingCartItemAdvancedSowingAuthorizations.authorization,
            cartItemId: shoppingCartItemAdvancedSowingAuthorizations.cartItemId,
        })
        .from(shoppingCartItemAdvancedSowingAuthorizations)
        .where(
            inArray(
                shoppingCartItemAdvancedSowingAuthorizations.cartItemId,
                normalizedIds,
            ),
        );
    return new Map(
        rows.map((row) => [
            row.cartItemId,
            parsePersistedAdvancedSowingCartAuthorization(row.authorization),
        ]),
    );
}

export async function clearShoppingCartItemAdvancedSowingAuthorization(
    cartItemId: number,
    db: TransactionClient,
) {
    await db
        .delete(shoppingCartItemAdvancedSowingAuthorizations)
        .where(
            eq(
                shoppingCartItemAdvancedSowingAuthorizations.cartItemId,
                cartItemId,
            ),
        );
}

export async function persistShoppingCartItemAdvancedSowingAuthorization(
    cartItemId: number,
    authorizationValue: unknown,
    db: TransactionClient,
    expected: {
        cartId: number;
        entityId: string;
        entityTypeName: string;
        gardenId?: number;
        raisedBedId?: number;
    },
) {
    const authorization =
        parsePersistedAdvancedSowingCartAuthorization(authorizationValue);
    const [cartItem] = await db
        .select({
            amount: shoppingCartItems.amount,
            cartId: shoppingCartItems.cartId,
            entityId: shoppingCartItems.entityId,
            entityTypeName: shoppingCartItems.entityTypeName,
            gardenId: shoppingCartItems.gardenId,
            id: shoppingCartItems.id,
            isDeleted: shoppingCartItems.isDeleted,
            positionIndex: shoppingCartItems.positionIndex,
            raisedBedId: shoppingCartItems.raisedBedId,
            status: shoppingCartItems.status,
        })
        .from(shoppingCartItems)
        .where(eq(shoppingCartItems.id, cartItemId))
        .limit(1);
    if (
        !cartItem ||
        cartItem.isDeleted ||
        cartItem.status !== 'new' ||
        cartItem.cartId !== expected.cartId ||
        cartItem.entityId !== expected.entityId ||
        cartItem.entityTypeName !== expected.entityTypeName ||
        cartItem.entityTypeName !== 'plantSort' ||
        cartItem.gardenId !== (expected.gardenId ?? null) ||
        cartItem.amount !== 1 ||
        cartItem.raisedBedId === null ||
        cartItem.raisedBedId !== (expected.raisedBedId ?? null) ||
        cartItem.positionIndex === null ||
        cartItem.positionIndex !== authorization.plan.anchorPositionIndex ||
        authorization.plan.bedFieldCount !==
            ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT
    ) {
        throw new AdvancedSowingCartAuthorizationPersistenceError(
            'Advanced Sowing authorization does not match the mutable cart item.',
        );
    }

    await db
        .insert(shoppingCartItemAdvancedSowingAuthorizations)
        .values({ authorization, cartItemId })
        .onConflictDoUpdate({
            set: { authorization, updatedAt: new Date() },
            target: shoppingCartItemAdvancedSowingAuthorizations.cartItemId,
        });
    return authorization;
}
