import type {
    DeliveryPricingRow,
    OperationPricingRow,
    PlantPricingRow,
} from './cjenik/pricingRows.ts';

/**
 * Starting prices the landing page quotes. Derived from the same rows as the
 * public price list so the "od" amounts never drift from /cjenik.
 */
export function summarizeLandingPricing({
    plantRows,
    operationRows,
    deliveryRows,
}: {
    plantRows: ReadonlyArray<Pick<PlantPricingRow, 'kind' | 'price'>>;
    operationRows: ReadonlyArray<
        Pick<OperationPricingRow, 'availability' | 'label' | 'price'>
    >;
    deliveryRows: ReadonlyArray<
        Pick<DeliveryPricingRow, 'pricePerKilometer' | 'zoneRadius'>
    >;
}) {
    const plantPrices = plantRows
        .filter((row) => row.kind === 'plant' && row.price > 0)
        .map((row) => row.price);
    const cheapestOperation =
        operationRows
            .filter((row) => row.availability === 'available')
            .toSorted(
                (first, second) =>
                    first.price - second.price ||
                    first.label.localeCompare(second.label, 'hr-HR'),
            )
            .at(0) ?? null;
    const delivery =
        deliveryRows
            .toSorted(
                (first, second) =>
                    first.pricePerKilometer - second.pricePerKilometer,
            )
            .at(0) ?? null;

    return {
        minPlantPrice: plantPrices.length > 0 ? Math.min(...plantPrices) : null,
        cheapestOperation: cheapestOperation
            ? { label: cheapestOperation.label, price: cheapestOperation.price }
            : null,
        delivery: delivery
            ? {
                  pricePerKilometer: delivery.pricePerKilometer,
                  zoneRadius: delivery.zoneRadius,
              }
            : null,
    };
}

export type LandingPricingSummary = ReturnType<typeof summarizeLandingPricing>;
