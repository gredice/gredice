import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export const inventoryQueryKey = ['inventory'];

export function useInventory() {
    const { data: user } = useCurrentUser();
    return useQuery({
        queryKey: inventoryQueryKey,
        queryFn: async () => {
            const response = await clientAuthenticated().api.inventory.$get();
            if (response.status === 401) {
                return null;
            }
            return response.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: Boolean(user),
    });
}
