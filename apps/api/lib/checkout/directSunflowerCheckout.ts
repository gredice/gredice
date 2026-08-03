import {
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
    lockShoppingCartForCheckout: typeof lockShoppingCartForCheckout;
    spendSunflowersBatch: typeof spendSunflowersBatch;
    withCheckoutCartItemLocks: typeof withCheckoutCartItemLocks;
    withCheckoutCartItemProcessingLocks: typeof withCheckoutCartItemProcessingLocks;
};

type DirectSunflowerCheckoutPayment =
    | {
          resolvedAmountsByCartItemId: ReadonlyMap<number, number>;
          state: 'paid';
      }
    | {
          resolvedAmount: number;
          resolvedAmountsByCartItemId: ReadonlyMap<number, number>;
          state: 'pending';
      };

const realDependencies: DirectSunflowerCheckoutDependencies = {
    calculateSunflowerAmount,
    calculateSunflowerReplayAmount,
    lockShoppingCartForCheckout,
    spendSunflowersBatch,
    withCheckoutCartItemLocks,
    withCheckoutCartItemProcessingLocks,
};

export async function withDirectSunflowerCheckoutPayment<T>({
    accountId,
    allSunflowerItems,
    cartId,
    dependencies = realDependencies,
    item,
    operation,
}: {
    accountId: string;
    allSunflowerItems: readonly ShoppingCartItemWithShopData[];
    cartId: number;
    dependencies?: DirectSunflowerCheckoutDependencies;
    item: ShoppingCartItemWithShopData;
    operation: (payment: DirectSunflowerCheckoutPayment) => Promise<T>;
}): Promise<T> {
    const coveredItemIds = allSunflowerItems.map(
        (coveredItem) => coveredItem.id,
    );
    const sunflowerAmountsByCartItemId = new Map(
        allSunflowerItems.map((coveredItem) => [
            coveredItem.id,
            coveredItem.status === 'paid'
                ? dependencies.calculateSunflowerReplayAmount(coveredItem)
                : dependencies.calculateSunflowerAmount(coveredItem),
        ]),
    );

    return dependencies.withCheckoutCartItemProcessingLocks(
        coveredItemIds,
        async () => {
            const payment = await dependencies.withCheckoutCartItemLocks(
                coveredItemIds,
                async (db) => {
                    const lockedCart =
                        await dependencies.lockShoppingCartForCheckout(
                            cartId,
                            db,
                        );
                    if (!lockedCart) {
                        throw new Error(
                            `Cart ${cartId.toString()} disappeared before sunflower fulfillment.`,
                        );
                    }
                    if (lockedCart.accountId !== accountId) {
                        throw new Error(
                            `Cart ${cartId.toString()} account changed before sunflower fulfillment.`,
                        );
                    }

                    const paymentStatesByCartItemId = new Map<
                        number,
                        'paid' | 'pending'
                    >();
                    for (const coveredItem of allSunflowerItems) {
                        const state = assertCheckoutCartItemSnapshot(
                            lockedCart.items.find(
                                (lockedItem) =>
                                    lockedItem.id === coveredItem.id,
                            ),
                            coveredItem,
                        );
                        paymentStatesByCartItemId.set(coveredItem.id, state);
                    }
                    const itemState = paymentStatesByCartItemId.get(item.id);
                    if (!itemState) {
                        throw new Error(
                            `Sunflower cart item ${item.id.toString()} is not part of the checkout coverage.`,
                        );
                    }
                    const reason = `shoppingCartItem:${item.id.toString()}`;
                    const spendResult = await dependencies.spendSunflowersBatch(
                        accountId,
                        itemState === 'pending'
                            ? [
                                  {
                                      amount:
                                          sunflowerAmountsByCartItemId.get(
                                              item.id,
                                          ) ?? 0,
                                      reason,
                                  },
                              ]
                            : [],
                        db,
                        {
                            existingCheckoutItemAmountsAreAuthoritative: true,
                            legacyCartSpend: {
                                reason: `shoppingCart:${cartId.toString()}`,
                                coveredItems: allSunflowerItems.map(
                                    (coveredItem) => {
                                        const paymentState =
                                            paymentStatesByCartItemId.get(
                                                coveredItem.id,
                                            );
                                        if (!paymentState) {
                                            throw new Error(
                                                `Sunflower cart item ${coveredItem.id.toString()} lost its payment state.`,
                                            );
                                        }
                                        return {
                                            amount:
                                                sunflowerAmountsByCartItemId.get(
                                                    coveredItem.id,
                                                ) ?? 0,
                                            cartItemId: coveredItem.id,
                                            createdAt: coveredItem.createdAt,
                                            paymentState,
                                            reason: `shoppingCartItem:${coveredItem.id.toString()}`,
                                        };
                                    },
                                ),
                            },
                        },
                    );
                    const resolvedAmountsByCartItemId = new Map<
                        number,
                        number
                    >();
                    for (const coveredItem of allSunflowerItems) {
                        const resolvedAmount =
                            spendResult.resolvedAmountsByReason[
                                `shoppingCartItem:${coveredItem.id.toString()}`
                            ];
                        if (resolvedAmount !== undefined) {
                            if (
                                !Number.isSafeInteger(resolvedAmount) ||
                                resolvedAmount <= 0
                            ) {
                                throw new Error(
                                    `Sunflower spend for cart item ${coveredItem.id.toString()} did not resolve a valid amount.`,
                                );
                            }
                            resolvedAmountsByCartItemId.set(
                                coveredItem.id,
                                resolvedAmount,
                            );
                        }
                    }
                    if (itemState === 'paid') {
                        if (!resolvedAmountsByCartItemId.has(item.id)) {
                            throw new Error(
                                `Paid sunflower cart item ${item.id.toString()} has no durable spend amount.`,
                            );
                        }
                        return {
                            resolvedAmountsByCartItemId,
                            state: 'paid' as const,
                        };
                    }

                    const resolvedAmount = resolvedAmountsByCartItemId.get(
                        item.id,
                    );
                    if (
                        typeof resolvedAmount !== 'number' ||
                        !Number.isSafeInteger(resolvedAmount) ||
                        resolvedAmount <= 0
                    ) {
                        throw new Error(
                            `Sunflower spend for cart item ${item.id.toString()} did not resolve a valid amount.`,
                        );
                    }

                    return {
                        resolvedAmount,
                        resolvedAmountsByCartItemId,
                        state: 'pending' as const,
                    };
                },
            );
            return operation(payment);
        },
    );
}
