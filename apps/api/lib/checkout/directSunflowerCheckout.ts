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
    operation: (
        payment:
            | { state: 'paid' }
            | { resolvedAmount: number; state: 'pending' },
    ) => Promise<T>;
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

                    let itemState: 'paid' | 'pending' | undefined;
                    for (const coveredItem of allSunflowerItems) {
                        const state = assertCheckoutCartItemSnapshot(
                            lockedCart.items.find(
                                (lockedItem) =>
                                    lockedItem.id === coveredItem.id,
                            ),
                            coveredItem,
                        );
                        if (coveredItem.id === item.id) {
                            itemState = state;
                        }
                    }
                    if (!itemState) {
                        throw new Error(
                            `Sunflower cart item ${item.id.toString()} is not part of the checkout coverage.`,
                        );
                    }
                    if (itemState === 'paid') {
                        return { state: 'paid' as const };
                    }

                    const reason = `shoppingCartItem:${item.id.toString()}`;
                    const spendResult = await dependencies.spendSunflowersBatch(
                        accountId,
                        [
                            {
                                amount:
                                    sunflowerAmountsByCartItemId.get(item.id) ??
                                    0,
                                reason,
                            },
                        ],
                        db,
                        {
                            existingCheckoutItemAmountsAreAuthoritative: true,
                            legacyCartSpend: {
                                reason: `shoppingCart:${cartId.toString()}`,
                                coveredItems: allSunflowerItems.map(
                                    (coveredItem) => ({
                                        amount:
                                            sunflowerAmountsByCartItemId.get(
                                                coveredItem.id,
                                            ) ?? 0,
                                        cartItemId: coveredItem.id,
                                        createdAt: coveredItem.createdAt,
                                        reason: `shoppingCartItem:${coveredItem.id.toString()}`,
                                    }),
                                ),
                            },
                        },
                    );
                    const resolvedAmount =
                        spendResult.resolvedAmountsByReason[reason];
                    if (
                        !Number.isSafeInteger(resolvedAmount) ||
                        resolvedAmount <= 0
                    ) {
                        throw new Error(
                            `Sunflower spend for cart item ${item.id.toString()} did not resolve a valid amount.`,
                        );
                    }

                    return { resolvedAmount, state: 'pending' as const };
                },
            );
            return operation(payment);
        },
    );
}
