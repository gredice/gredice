import { directoriesClient } from '@gredice/client';
import { isPlantRecommended } from '@gredice/js/plants';
import { useQuery } from '@tanstack/react-query';

async function getPlants() {
    const plants = await directoriesClient().GET('/entities/plant');
    return (
        plants.data
            ?.sort((a, b) =>
                a.information.name.localeCompare(b.information.name),
            )
            .map((plant) => ({
                ...plant,
                isRecommended: isPlantRecommended(plant),
            })) || []
    );
}

export function usePlants() {
    return useQuery({
        queryKey: ['plants'],
        queryFn: getPlants,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
