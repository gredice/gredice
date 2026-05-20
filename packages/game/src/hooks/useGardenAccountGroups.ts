import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useGardensKeys } from './useGardens';

export const gardenAccountGroupsKeys = [...useGardensKeys, 'accountGroups'];

export function useGardenAccountGroups(disabled?: boolean) {
    return useQuery({
        queryKey: gardenAccountGroupsKeys,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.accounts.gardens.$get();
            if (response.status === 401) return null;
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch account garden groups: ${response.status} ${response.statusText}`,
                );
            }

            return response.json();
        },
        retry: false,
        enabled: !disabled,
        staleTime: 1000 * 60 * 5,
    });
}
