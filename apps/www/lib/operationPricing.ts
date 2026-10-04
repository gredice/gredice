export type OperationPriceAvailability =
    | 'available'
    | 'internal'
    | 'unavailable';

type OperationPricingData = {
    attributes?: {
        internal?: boolean;
    } | null;
    prices?: {
        perOperation?: number | null;
    } | null;
};

export function getOperationPriceAvailability(
    operation: OperationPricingData,
): OperationPriceAvailability {
    if (operation.attributes?.internal === true) {
        return 'internal';
    }

    const price = operation.prices?.perOperation;
    return typeof price === 'number' && price > 0 ? 'available' : 'unavailable';
}
