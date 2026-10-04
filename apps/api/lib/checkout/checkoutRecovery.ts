type CheckoutRecoveryCartItem = {
    currency: string | null;
    entityTypeName: string;
    id: number;
    status: string;
};

type CheckoutOperationPaymentMapping = {
    paymentCurrency: 'eur' | 'inventory' | 'sunflower';
};

type CheckoutCartItemSnapshot = {
    additionalData: string | null;
    amount: number;
    currency: string | null;
    entityId: string;
    entityTypeName: string;
    gardenId: number | null;
    id: number;
    positionIndex: number | null;
    raisedBedId: number | null;
};

export function assertCheckoutCartItemSnapshot(
    current: (CheckoutCartItemSnapshot & { status: string }) | undefined,
    expected: CheckoutCartItemSnapshot,
) {
    if (!current) {
        throw new Error(
            `Checkout cart item ${expected.id.toString()} disappeared before fulfillment.`,
        );
    }
    if (current.status === 'paid') {
        return 'paid' as const;
    }
    const unchanged =
        current.additionalData === expected.additionalData &&
        current.amount === expected.amount &&
        current.currency === expected.currency &&
        current.entityId === expected.entityId &&
        current.entityTypeName === expected.entityTypeName &&
        current.gardenId === expected.gardenId &&
        current.positionIndex === expected.positionIndex &&
        current.raisedBedId === expected.raisedBedId;
    if (!unchanged) {
        throw new Error(
            `Checkout cart item ${expected.id.toString()} changed before fulfillment.`,
        );
    }
    return 'pending' as const;
}

export type CheckoutOperationRecoveryState =
    | 'currency_mismatch'
    | 'stripe_payment_processing';

export function getCheckoutOperationRecoveryState(
    items: readonly CheckoutRecoveryCartItem[],
    checkoutOperationMappings: ReadonlyMap<
        number,
        CheckoutOperationPaymentMapping
    >,
    fulfillmentStartedCartItemIds: ReadonlySet<number> = new Set(),
): CheckoutOperationRecoveryState | null {
    for (const item of items) {
        if (item.status === 'paid') {
            continue;
        }
        if (item.entityTypeName === 'operation') {
            const mapping = checkoutOperationMappings.get(item.id);
            if (mapping?.paymentCurrency !== undefined) {
                if (mapping.paymentCurrency !== item.currency) {
                    return 'currency_mismatch';
                }
                if (mapping.paymentCurrency === 'eur') {
                    return 'stripe_payment_processing';
                }
            }
        }
        if (
            item.currency === 'eur' &&
            fulfillmentStartedCartItemIds.has(item.id)
        ) {
            return 'stripe_payment_processing';
        }
    }
    return null;
}
