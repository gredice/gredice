import { useQuery } from "@tanstack/react-query";
import { BlockData } from "../../@types/BlockData";
import { client } from "@gredice/client";

export function useBlockData() {
    return useQuery({
        queryKey: ['blocks'],
        queryFn: async () => {
            const resp = await client().api.directories.entities[":entityType"].$get({ param: { entityType: 'block' } });
            return await resp.json() as BlockData[];
        },
        staleTime: 1000 * 60 * 60 // 1 hour
    })
}