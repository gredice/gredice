import { useQuery } from "@tanstack/react-query";
import { directoriesClient } from "@gredice/client";

async function getPlantSorts() {
    const sorts = await directoriesClient().GET("/entities/plantSort")
    return sorts.data;
}

export function usePlantSorts(plantId: number | null | undefined) {
    return useQuery({
        queryKey: ['plants', plantId, 'sorts'],
        queryFn: async () => {
            const sorts = await getPlantSorts();
            return sorts?.filter(sort => sort.information.plant.id === plantId) ?? [];
        },
        enabled: Boolean(plantId),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}