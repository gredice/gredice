import type { SelectOperationPrice } from '@gredice/storage';

export function operationDefinitionPricing(
    entityId: number,
    userPrice: number | undefined,
    prices: SelectOperationPrice[],
) {
    const farmerPrice =
        prices.find(
            (price) =>
                price.entityTypeName === 'operation' &&
                price.entityId === entityId,
        ) ??
        prices.find(
            (price) =>
                price.entityTypeName === 'operation' && price.entityId === null,
        );
    const parsedPrice = farmerPrice ? Number(farmerPrice.pricePerUnit) : null;
    const farmerAmount =
        parsedPrice !== null && Number.isFinite(parsedPrice)
            ? parsedPrice
            : null;
    const customerAmount =
        typeof userPrice === 'number' && Number.isFinite(userPrice)
            ? userPrice
            : null;
    const profit =
        customerAmount !== null &&
        farmerAmount !== null &&
        farmerPrice?.currency.toUpperCase() === 'EUR'
            ? (Math.round(customerAmount * 100) -
                  Math.round(farmerAmount * 100)) /
              100
            : null;
    return {
        customerAmount,
        farmerAmount,
        farmerCurrency: farmerPrice?.currency ?? 'EUR',
        profit,
    };
}

export function operationMoneyDisplay(value: number | null, currency = 'EUR') {
    if (value === null) return 'Nije određeno';
    return new Intl.NumberFormat('hr-HR', {
        style: 'currency',
        currency,
    }).format(value);
}
