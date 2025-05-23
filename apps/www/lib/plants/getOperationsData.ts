import { directoriesClient } from "@gredice/client";
import { unstable_cache } from "next/cache";

export const getOperationsData = unstable_cache(async () => {
    return (await directoriesClient().GET('/entities/operation')).data;
},
    ['operationsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['operationsData']
    });

export type OperationData = NonNullable<Awaited<ReturnType<typeof getOperationsData>>>[number];