import { useQuery } from "@tanstack/react-query";
import { client } from '@gredice/client';

export const userOperationsKeys = ['user-operations'];

export function useUserOperations() {
    return useQuery({
        queryKey: userOperationsKeys,
        queryFn: () => client().api.operations.$get(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
