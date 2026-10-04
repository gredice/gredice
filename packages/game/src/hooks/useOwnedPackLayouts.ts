import { getGardenPackLayouts } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useGardenPackStorefrontContext } from './useGardenPackStorefrontContext';

export function useOwnedPackLayouts(
    purchaseId: string | undefined,
    open = false,
) {
    const context = useGardenPackStorefrontContext();
    const query = useQuery({
        queryKey: [
            'garden-pack-layouts',
            context.userId,
            context.accountId,
            purchaseId,
        ],
        enabled: context.eligible && Boolean(purchaseId) && open,
        retry: false,
        staleTime: 0,
        queryFn: async ({ signal }) => {
            if (!purchaseId || !context.eligible)
                throw new Error('Odaberi vlastiti vrt.');
            const result = await getGardenPackLayouts(purchaseId, { signal });
            if (
                !result.enabled ||
                result.accountId !== context.accountId ||
                result.purchaseId !== purchaseId
            )
                throw new Error('Raspored trenutačno nije dostupan.');
            return result;
        },
    });
    return { ...query, context };
}
