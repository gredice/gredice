import { clientPublic } from '@gredice/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useGameSceneRuntimeActive } from '../scene/sceneRuntimeActivity';

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

async function getOutletOffers(includeSoldOut: boolean, signal: AbortSignal) {
    const response = await clientPublic().api.outlet.offers.$get(
        includeSoldOut ? { query: { includeSoldOut: 'true' } } : { query: {} },
        {
            init: { cache: 'no-store', signal },
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
    const runtimeActive = useGameSceneRuntimeActive();
    const queryClient = useQueryClient();
    const queryEnabled = enabled && runtimeActive;

    useEffect(() => {
        if (runtimeActive) {
            return;
        }
        const queryKey = includeSoldOut
            ? [...useOutletOffersQueryKey, 'including-sold-out']
            : useOutletOffersQueryKey;
        void queryClient.cancelQueries({ exact: true, queryKey });
    }, [includeSoldOut, queryClient, runtimeActive]);

    return useQuery({
        enabled: queryEnabled,
        queryKey: includeSoldOut
            ? [...useOutletOffersQueryKey, 'including-sold-out']
            : useOutletOffersQueryKey,
        queryFn: ({ signal }) => getOutletOffers(includeSoldOut, signal),
        staleTime: 0,
        refetchOnMount: 'always',
        refetchInterval: queryEnabled ? outletOffersRefetchIntervalMs : false,
    });
}
