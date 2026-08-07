import {
    getShoppingCart,
    lockShoppingCartForCheckout,
    spendSunflowersBatch,
    withCheckoutCartItemLocks,
    withCheckoutCartItemProcessingLocks,
} from '@gredice/storage';
import type { ShoppingCartItemWithShopData } from './cartInfo';
import { assertCheckoutCartItemSnapshot } from './checkoutRecovery';
import {
    calculateSunflowerAmount,
    calculateSunflowerReplayAmount,
} from './sunflowerCalculations';

type DirectSunflowerCheckoutDependencies = {
    calculateSunflowerAmount: typeof calculateSunflowerAmount;
    calculateSunflowerReplayAmount: typeof calculateSunflowerReplayAmount;
    getShoppingCart: typeof getShoppingCart;
    lockShoppingCartForCheckout: typeof lockShoppingCartForCheckout;
    spendSunflowersBatch: typeof spendSunflowersBatch;
    withCheckoutCartItemLocks: typeof withCheckoutCartItemLocks;
    withCheckoutCartItemProcessingLocks: typeof withCheckoutCartItemProcessingLocks;
};

export type DirectSunflowerCheckoutBatch = {
    pendingItems: readonly ShoppingCartItemWithShopData[];
    resolvedAmountsByCartItemId: ReadonlyMap<number, number>;
};

export type DirectSunflowerCheckoutResult<T> =
    | {
          cart: {
              accountId: string | null;
              id: number;
              status: string;
          };
          state: 'cart_paid';
      }
    | {
          state: 'processed';
          value: T;
      };

const realDependencies: DirectSunflowerCheckoutDependencies = {
    calculateSunflowerAmount,
    calculateSunflowerReplayAmount,
    getShoppingCart,
    lockShoppingCartForCheckout,
    spendSunflowersBatch,
    withCheckoutCartItemLocks,
    withCheckoutCartItemProcessingLocks,
};

/**
 * Serializes one direct checkout across every captured cart item. The database
 * transaction is intentionally limited to snapshot validation and the durable
 * sunflower debit; fulfillment runs after it commits while the process lock is
 * still held.
 */
export async function withDirectSunflowerCheckoutBatch<T>({
    accountId,
    allCheckoutItems,
    cartId,
    dependencies = realDependencies,
    operation,
}: {
    accountId: string;
    allCheckoutItems: readonly ShoppingCartItemWithShopData[];
    cartId: number;
    dependencies?: DirectSunflowerCheckoutDependencies;
    operation: (payment: DirectSunflowerCheckoutBatch) => Promise<T>;
}): Promise<DirectSunflowerCheckoutResult<T>> {
    const coveredItemIds = allCheckoutItems.map((item) => item.id);
    if (coveredItemIds.length === 0) {
        throw new Error('Direct checkout requires at least one cart item.');
    }

    const expectedItemIds = new Set(coveredItemIds);
    const sunflowerItems = allCheckoutItems.filter(
        (item) => item.currency === 'sunflower',
    );

    return dependencies.withCheckoutCartItemProcessingLocks(
        coveredItemIds,
        async () => {
            const prepared = await dependencies.withCheckoutCartItemLocks(
                coveredItemIds,
                async (db) => {
                    const lockedCart =
                        await dependencies.lockShoppingCartForCheckout(
                            cartId,
                            db,
                        );
                    if (!lockedCart) {
                        const currentCart = await dependencies.getShoppingCart(
                            cartId,
                            db,
                        );
                        if (!currentCart) {
                            throw new Error(
                                `Cart ${cartId.toString()} disappeared before direct checkout.`,
                            );
                        }
                        if (currentCart.accountId !== accountId) {
                            throw new Error(
                                `Cart ${cartId.toString()} account changed before direct checkout.`,
                            );
                        }
                        if (currentCart.status === 'paid') {
                            return {
                                cart: currentCart,
                                state: 'cart_paid' as const,
                            };
                        }
                        throw new Error(
                            `Cart ${cartId.toString()} is not active for direct checkout.`,
                        );
                    }
                    if (lockedCart.accountId !== accountId) {
                        throw new Error(
                            `Cart ${cartId.toString()} account changed before direct checkout.`,
                        );
                    }
                    if (
                        lockedCart.items.length !== expectedItemIds.size ||
                        lockedCart.items.some(
                            (item) => !expectedItemIds.has(item.id),
                        )
                    ) {
                        throw new Error(
                            `Cart ${cartId.toString()} changed before direct checkout.`,
                        );
                    }

                    const paymentStatesByCartItemId = new Map<
                        number,
                        'paid' | 'pending'
                    >();
                    for (const expectedItem of allCheckoutItems) {
                        const paymentState = assertCheckoutCartItemSnapshot(
                            lockedCart.items.find(
                                (item) => item.id === expectedItem.id,
                            ),
                            expectedItem,
                        );
                        paymentStatesByCartItemId.set(
                            expectedItem.id,
                            paymentState,
                        );
                    }

                    if (sunflowerItems.length === 0) {
                        return {
                            pendingItems: [] as const,
                            resolvedAmountsByCartItemId: new Map<
                                number,
                                number
                            >(),
                            state: 'ready' as const,
                        };
                    }

                    const sunflowerAmountsByCartItemId = new Map(
                        sunflowerItems.map((item) => {
                            const paymentState = paymentStatesByCartItemId.get(
                                item.id,
                            );
                            if (!paymentState) {
                                throw new Error(
                                    `Sunflower cart item ${item.id.toString()} lost its payment state.`,
                                );
                            }
                            return [
                                item.id,
                                paymentState === 'paid'
                                    ? dependencies.calculateSunflowerReplayAmount(
                                          { ...item, status: 'paid' },
                                      )
                                    : dependencies.calculateSunflowerAmount(
                                          item,
                                      ),
                            ] as const;
                        }),
                    );
                    const pendingItems = sunflowerItems.filter(
                        (item) =>
                            paymentStatesByCartItemId.get(item.id) ===
                            'pending',
                    );
                    const spendResult = await dependencies.spendSunflowersBatch(
                        accountId,
                        pendingItems.map((item) => ({
                            amount:
                                sunflowerAmountsByCartItemId.get(item.id) ?? 0,
                            reason: `shoppingCartItem:${item.id.toString()}`,
                        })),
                        db,
                        {
                            existingCheckoutItemAmountsAreAuthoritative: true,
                            legacyCartSpend: {
                                reason: `shoppingCart:${cartId.toString()}`,
                                coveredItems: sunflowerItems.map((item) => {
                                    const paymentState =
                                        paymentStatesByCartItemId.get(item.id);
                                    if (!paymentState) {
                                        throw new Error(
                                            `Sunflower cart item ${item.id.toString()} lost its payment state.`,
                                        );
                                    }
                                    return {
                                        amount:
                                            sunflowerAmountsByCartItemId.get(
                                                item.id,
                                            ) ?? 0,
                                        cartItemId: item.id,
                                        createdAt: item.createdAt,
                                        paymentState,
                                        reason: `shoppingCartItem:${item.id.toString()}`,
                                    };
                                }),
                            },
                        },
                    );
                    const resolvedAmountsByCartItemId = new Map<
                        number,
                        number
                    >();
                    for (const item of sunflowerItems) {
                        const resolvedAmount =
                            spendResult.resolvedAmountsByReason[
                                `shoppingCartItem:${item.id.toString()}`
                            ];
                        if (
                            typeof resolvedAmount !== 'number' ||
                            !Number.isSafeInteger(resolvedAmount) ||
                            resolvedAmount <= 0
                        ) {
                            throw new Error(
                                `Sunflower spend for cart item ${item.id.toString()} did not resolve a valid amount.`,
                            );
                        }
                        resolvedAmountsByCartItemId.set(
                            item.id,
                            resolvedAmount,
                        );
                    }

                    return {
                        pendingItems,
                        resolvedAmountsByCartItemId,
                        state: 'ready' as const,
                    };
                },
            );
            if (prepared.state === 'cart_paid') {
                return prepared;
            }

            return {
                state: 'processed',
                value: await operation({
                    pendingItems: prepared.pendingItems,
                    resolvedAmountsByCartItemId:
                        prepared.resolvedAmountsByCartItemId,
                }),
            };
        },
    );
}
