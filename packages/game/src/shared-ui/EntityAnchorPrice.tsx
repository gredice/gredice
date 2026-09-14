import { clientPublic } from '@gredice/client';
import { AnchorPrice } from '@gredice/ui/AnchorPrice';
import { useQuery } from '@tanstack/react-query';
import { useOptionalGameState } from '../useGameState';

export function EntityAnchorPrice({
    entityTypeName,
    entityId,
    currentPrice,
}: {
    entityTypeName: string;
    entityId: string | number;
    currentPrice: number | null | undefined;
}) {
    const isMock = useOptionalGameState((state) => state.isMock, false);
    const { data } = useQuery({
        queryKey: ['public-price-catalog'],
        queryFn: async () => {
            const response = await clientPublic().api.pricing.$get();
            if (!response.ok)
                throw new Error('Failed to load reference prices');
            return response.json();
        },
        enabled:
            !isMock && typeof currentPrice === 'number' && currentPrice > 0,
        staleTime: 60_000,
    });
    const entry = data?.find(
        (entry) => entry.key === `${entityTypeName}:${entityId}`,
    );
    if (
        isMock ||
        !entry?.available ||
        currentPrice == null ||
        !entry.anchorPrice
    )
        return null;
    return (
        <AnchorPrice currentPrice={currentPrice} anchor={entry.anchorPrice} />
    );
}
