import { cache } from 'react';
import { getHqLocationsData } from '../lib/getHqLocationsData';
import { getOperationsData } from '../lib/plants/getOperationsData';
import { getPlantsData } from '../lib/plants/getPlantsData';
import { KnownPages } from '../src/KnownPages';
import {
    buildDeliveryPricingRows,
    buildOperationPricingRows,
    buildPlantPricingRows,
} from './cjenik/pricingRows';
import { summarizeLandingPricing } from './landingPricingSummary';

export const getLandingPricing = cache(async () => {
    try {
        const [plants, operations, hqLocations] = await Promise.all([
            getPlantsData(),
            getOperationsData(),
            getHqLocationsData(),
        ]);

        return summarizeLandingPricing({
            plantRows: buildPlantPricingRows(plants, []),
            operationRows: buildOperationPricingRows(operations),
            deliveryRows: buildDeliveryPricingRows(
                hqLocations,
                KnownPages.Delivery,
            ),
        });
    } catch (error) {
        console.error('Failed to load landing pricing', error);
        return null;
    }
});
