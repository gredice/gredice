import { clientPublic } from '@gredice/client';

export type OutletOffer = {
    id: number;
    plantSort: {
        id: number;
        name: string;
        description: string | null;
        imageUrl: string | null;
        plant: {
            id: number;
            name: string | null;
        } | null;
    };
    sowingDate: string;
    initialPlantStatus: string;
    imageUrls: string[];
    outletPrice: number;
    comparePrice: number | null;
    quantity: number;
    remainingQuantity: number;
    reservedQuantity: number;
    soldQuantity: number;
    startAt: string;
    endAt: string;
    url: string;
};

export async function getOutletOffers() {
    try {
        const response = await clientPublic().api.outlet.offers.$get();
        if (response.status !== 200) {
            return [];
        }

        const data = await response.json();
        return data.items satisfies OutletOffer[];
    } catch (error) {
        console.error('Failed to fetch outlet offers', error);
        return [];
    }
}

export function outletOfferImage(offer: OutletOffer) {
    return offer.imageUrls[0] ?? offer.plantSort.imageUrl;
}

export function outletGardenUrl(offerId: number) {
    return `https://vrt.gredice.com/?outlet=${encodeURIComponent(offerId)}`;
}
