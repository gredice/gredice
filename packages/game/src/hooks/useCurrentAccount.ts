import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const currentAccountKeys = ['accounts', 'current'];

export function useCurrentAccount() {
    return useQuery({
        queryKey: currentAccountKeys,
        queryFn: async () => {
            const [accountResponse, sunflowers] = await Promise.all([
                client().api.accounts.current.$get(),
                client().api.accounts.current.sunflowers.$get().then(response => response.json())
            ]);
            const account = await accountResponse.json();
            if (accountResponse.status === 404) {
                return null;
            }
            return {
                ...account,
                sunflowers
            };
        }
    });
}