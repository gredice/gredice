import { client } from "@gredice/client";
import { unstable_cache } from "next/cache";
import { OperationData } from "../@types/OperationData";

export const getOperationsData = unstable_cache(async () => {
    return await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "operation"
        }
    })).json() as OperationData[];
},
    ['operationsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['operationsData']
    });