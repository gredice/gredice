import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const currentAccountKeys = ['accounts', 'current'];

export function useCurrentAccount() {
    return useQuery({
        queryKey: currentAccountKeys,
        queryFn: async () => {
            const [accountResponse, sunflowersResponse] = await Promise.all([
                clientAuthenticated().api.accounts.current.$get(),
                clientAuthenticated().api.accounts.current.sunflowers.$get(),
            ]);
            if (accountResponse.status === 401) {
                return null;
            }
            if (accountResponse.status === 404) {
                return null;
            }
            if (!accountResponse.ok) {
                throw new Error(
                    `Failed to fetch current account: ${accountResponse.status} ${accountResponse.statusText}`,
                );
            }
            if (sunflowersResponse.status === 401) {
                return null;
            }
            if (!sunflowersResponse.ok) {
                throw new Error(
                    `Failed to fetch current account sunflowers: ${sunflowersResponse.status} ${sunflowersResponse.statusText}`,
                );
            }

            const account = await accountResponse.json();
            const sunflowers = await sunflowersResponse.json();
            return {
                ...account,
                sunflowers,
            };
        },
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 min
    });
}
