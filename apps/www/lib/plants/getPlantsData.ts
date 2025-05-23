import { directoriesClient } from "@gredice/client";
import { unstable_cache } from "next/cache";

export const getPlantsData = unstable_cache(async () => {
    return (await directoriesClient().GET('/entities/plant')).data;
},
    ['plantsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['plantsData']
    });
