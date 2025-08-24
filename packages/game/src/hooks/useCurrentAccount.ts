import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const currentAccountKeys = ['accounts', 'current'];

export function useCurrentAccount() {
    return useQuery({
        queryKey: currentAccountKeys,
        queryFn: async () => {
            const [accountResponse, sunflowers] = await Promise.all([
                client().api.accounts.current.$get(),
                client()
                    .api.accounts.current.sunflowers.$get()
                    .then((response) => response.json()),
            ]);
            const account = await accountResponse.json();
            if (accountResponse.status === 404) {
                return null;
            }
            return {
                ...account,
                sunflowers,
            };
        },
        staleTime: 1000 * 60 * 5, // 5 min
    });
}