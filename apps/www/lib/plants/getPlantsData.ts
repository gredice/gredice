import { client } from "@gredice/client";
import { PlantData } from "../@types/PlantData";

// TODO: Reuse this when retrieving plant data
export async function getPlantsData() {
    return await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "plant"
        }
    })).json() as PlantData[];
}