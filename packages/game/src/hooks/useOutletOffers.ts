import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export type OutletOfferData = {
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

async function getOutletOffers(includeSoldOut: boolean) {
    const response = await clientPublic().api.outlet.offers.$get(
        includeSoldOut ? { query: { includeSoldOut: 'true' } } : { query: {} },
        {
            init: { cache: 'no-store' },
        },
    );
    if (response.status !== 200) {
        throw new Error('Failed to fetch outlet offers');
    }

    const data = await response.json();
    return data.items satisfies OutletOfferData[];
}

export const useOutletOffersQueryKey = ['outlet-offers'];
const outletOffersRefetchIntervalMs = 15 * 1000;

export function useOutletOffers({
    enabled = true,
    includeSoldOut = false,
}: {
    enabled?: boolean;
    includeSoldOut?: boolean;
} = {}) {
    return useQuery({
        enabled,
        queryKey: includeSoldOut
            ? [...useOutletOffersQueryKey, 'including-sold-out']
            : useOutletOffersQueryKey,
        queryFn: () => getOutletOffers(includeSoldOut),
        staleTime: 0,
        refetchOnMount: 'always',
        refetchInterval: enabled ? outletOffersRefetchIntervalMs : false,
    });
}
