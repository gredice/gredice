import { directoriesClient } from "@gredice/client";
import { unstable_cache } from "next/cache";
import { isPlantRecommended } from "../../../../packages/js/src/plants/isPlantRecommended";

export const getPlantsData = unstable_cache(
    async () => {
        return (await directoriesClient().GET('/entities/plant')).data?.map((plant) => ({
            ...plant,
            isRecommended: isPlantRecommended(plant),
        }))
    },
    ['plantsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['plantsData']
    });
