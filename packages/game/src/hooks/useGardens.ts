import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const useGardensKeys = ['gardens'];

export function useGardens(disabled?: boolean) {
    return useQuery({
        queryKey: useGardensKeys,
        queryFn: async () => {
            const resp = await client().api.gardens.$get();
            if (resp.status === 401)
                return null;

            return resp.json();
        },
        enabled: !disabled,
        staleTime: 1000 * 60 * 60 // 1h
    });
}