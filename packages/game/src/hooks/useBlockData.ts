import { useQuery } from "@tanstack/react-query";
import { directoriesClient } from "@gredice/client";

export function useBlockData() {
    return useQuery({
        queryKey: ['blocks'],
        queryFn: async () => {
            return (await directoriesClient().GET('/entities/block')).data ?? null;
        },
        staleTime: 1000 * 60 * 60 // 1 hour
    })
}