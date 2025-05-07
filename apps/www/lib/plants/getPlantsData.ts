import { client } from "@gredice/client";
import { PlantData } from "../@types/PlantData";
import { unstable_cache } from "next/cache";

export const getPlantsData = unstable_cache(async () => {
    return await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "plant"
        }
    })).json() as PlantData[];
},
    ['plantsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['plantsData']
    });