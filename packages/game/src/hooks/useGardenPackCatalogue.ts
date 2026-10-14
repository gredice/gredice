import {
    gardenPackCatalogueKeys,
    getGardenPackCatalogueOffers,
} from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useGardenPackStorefrontContext } from './useGardenPackStorefrontContext';

export function useGardenPackCatalogue(open: boolean) {
    const context = useGardenPackStorefrontContext();
    const query = useQuery({
        queryKey: [
            ...gardenPackCatalogueKeys,
            context.userId,
            context.accountId,
        ],
        queryFn: async ({ signal }) => {
            const data = await getGardenPackCatalogueOffers(signal);
            if (data.enabled && data.accountId !== context.accountId)
                throw new Error('Account changed');
            return data;
        },
        enabled: context.eligible && open,
        retry: false,
        staleTime: 0,
    });
    return { ...query, context };
}
