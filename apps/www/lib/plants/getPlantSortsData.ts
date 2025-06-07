import { directoriesClient } from "@gredice/client";
import { unstable_cache } from "next/cache";

export const getPlantSortsData = unstable_cache(async () => {
    return (await directoriesClient().GET('/entities/plantSort')).data;
},
    ['plantSortsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['plantSortsData']
    });

export type PlantSortData = NonNullable<Awaited<ReturnType<typeof getPlantSortsData>>>[number];
