import { useQuery } from "@tanstack/react-query";
import { directoriesClient } from "@gredice/client";

async function getPlants() {
    const plants = await directoriesClient().GET("/entities/plant")
    return plants.data?.sort((a, b) => a.information.name.localeCompare(b.information.name));
}

export function usePlants() {
    return useQuery({
        queryKey: ['plants'],
        queryFn: getPlants,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}