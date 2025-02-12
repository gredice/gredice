import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const currentAccountKeys = ['accounts', 'current'];

export function useCurrentAccount() {
    return useQuery({
        queryKey: currentAccountKeys,
        queryFn: async () => {
            const accountResponse = await client.api.accounts.current.$get();
            if (accountResponse.status === 404) {
                return null;
            }
            const account = await accountResponse.json();
            const sunflowers = await client.api.accounts.current.sunflowers.$get().then(response => response.json());
            return {
                ...account,
                sunflowers
            };
        }
    });
}