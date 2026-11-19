import { gardenActionUrl } from '@gredice/js/gardenActions';
import { resolvePlantSowingPrice } from '../../../lib/plants/resolvePlantSowingPrice';
import { KnownPages } from '../../../src/KnownPages';

type PricedPlantEntity = Parameters<typeof resolvePlantSowingPrice>[0];

/** Anchor of the header's sowing offer; the phone bar appears once it scrolls away. */
export const plantSowingOfferElementId = 'ponuda-sijanja';

/** What a visitor needs to plant this plant or sort: the price and where to go. */
export function getPlantSowingOffer(
    plant: PricedPlantEntity,
    sort?:
        | (PricedPlantEntity & {
              store?: { availableInStore?: boolean | null } | null;
          })
        | null,
) {
    const price = resolvePlantSowingPrice(plant, sort);

    return {
        href: gardenActionUrl(KnownPages.GardenApp, {
            type: 'sow',
            plantId: plant.id,
            sortId: sort?.id,
        }),
        /** `null` when there is no positive price to show. */
        price: price && price.currentPrice > 0 ? price.currentPrice : null,
        availableForSowing: sort?.store?.availableInStore !== false,
    };
}

export type PlantSowingOfferData = ReturnType<typeof getPlantSowingOffer>;
