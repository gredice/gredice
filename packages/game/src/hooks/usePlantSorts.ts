import { useQuery } from "@tanstack/react-query";
import { directoriesClient } from "@gredice/client";

async function getPlantSorts() {
    const sorts = await directoriesClient().GET("/entities/plantSort")
    return sorts.data?.sort((a, b) => a.information.name.localeCompare(b.information.name));
}

export function usePlantSorts(plantId: number | null | undefined) {
    const { data: sorts } = useAllSorts();
    return useQuery({
        queryKey: ['plants', plantId, 'sorts'],
        queryFn: async () => {
            return sorts?.filter(sort => sort.information.plant.id === plantId) ?? [];
        },
        enabled: Boolean(sorts) && Boolean(plantId),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export function usePlantSort(sortId: number | null | undefined) {
    const { data: sorts } = useAllSorts();
    return useQuery({
        queryKey: ['plants', 'sorts', sortId],
        queryFn: async () => {
            return sorts?.find(sort => sort.id === sortId) ?? null;
        },
        enabled: Boolean(sorts) && Boolean(sortId),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export function useAllSorts() {
    return useQuery({
        queryKey: ['sorts'],
        queryFn: async () => {
            const sorts = await getPlantSorts();
            return sorts ?? [];
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export function useSorts(sortIds: number[] | null | undefined) {
    const { data: sorts } = useAllSorts();
    return useQuery({
        queryKey: ['sorts', sortIds],
        queryFn: async () => {
            if (!sortIds || sortIds.length === 0) return [];
            return sorts?.filter(sort => sortIds.includes(sort.id)) ?? [];
        },
        enabled: Boolean(sorts) && Boolean(sortIds && sortIds.length > 0),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
