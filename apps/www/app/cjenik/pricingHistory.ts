import {
    type EntityPriceHistoryRequest,
    type EntityPriceHistorySummary,
    getEntityPriceHistory,
} from '@gredice/storage';
import type { PublicSunflowerPackage } from '../../lib/sunflowerPackages';
import type {
    DeliveryPricingRow,
    OperationPricingRow,
    PlantPricingRow,
} from './pricingRows';

export function pricingHistoryKey(
    entityTypeName: string,
    entityId: number | string,
) {
    return `${entityTypeName}:${entityId}`;
}

function priceHistoryRequest({
    entityId,
    entityTypeName,
    attributeCategory,
    attributeName,
    currentPrice,
}: {
    entityId: number | string;
    entityTypeName: string;
    attributeCategory: string;
    attributeName: string;
    currentPrice: number;
}): EntityPriceHistoryRequest | null {
    const numericEntityId = Number(entityId);
    if (!Number.isInteger(numericEntityId) || numericEntityId <= 0) {
        return null;
    }

    return {
        key: pricingHistoryKey(entityTypeName, numericEntityId),
        entityId: numericEntityId,
        entityTypeName,
        attributeCategory,
        attributeName,
        currentPrice,
    };
}

function currentPriceFallbacks(
    requests: ReadonlyArray<EntityPriceHistoryRequest>,
) {
    return Object.fromEntries(
        requests.map((request) => [
            request.key,
            {
                lowestPrice: request.currentPrice,
                lastChangedAt: null,
            } satisfies EntityPriceHistorySummary,
        ]),
    );
}

export async function getPricingCatalogHistory({
    sunflowerPackages,
    plantRows,
    operationRows,
    deliveryRows,
}: {
    sunflowerPackages: ReadonlyArray<PublicSunflowerPackage>;
    plantRows: ReadonlyArray<PlantPricingRow>;
    operationRows: ReadonlyArray<OperationPricingRow>;
    deliveryRows: ReadonlyArray<DeliveryPricingRow>;
}) {
    const requests = [
        ...sunflowerPackages.map((pkg) =>
            priceHistoryRequest({
                entityId: pkg.entityId,
                entityTypeName: 'sunflowerPackage',
                attributeCategory: 'pricing',
                attributeName: 'priceEur',
                currentPrice: pkg.priceEur,
            }),
        ),
        ...plantRows.map((row) =>
            priceHistoryRequest({
                entityId: row.entityId,
                entityTypeName: row.kind === 'plant' ? 'plant' : 'plantSort',
                attributeCategory: 'prices',
                attributeName: 'perPlant',
                currentPrice: row.price,
            }),
        ),
        ...operationRows.map((row) =>
            priceHistoryRequest({
                entityId: row.entityId,
                entityTypeName: 'operation',
                attributeCategory: 'prices',
                attributeName: 'perOperation',
                currentPrice: row.price,
            }),
        ),
        ...deliveryRows.map((row) =>
            priceHistoryRequest({
                entityId: row.entityId,
                entityTypeName: 'hqLocations',
                attributeCategory: 'prices',
                attributeName: 'pricePerKilometer',
                currentPrice: row.pricePerKilometer,
            }),
        ),
    ].filter(
        (request): request is EntityPriceHistoryRequest => request !== null,
    );

    try {
        return await getEntityPriceHistory(requests);
    } catch (error) {
        console.error('Failed to load pricing catalog history', error);
        return currentPriceFallbacks(requests);
    }
}
