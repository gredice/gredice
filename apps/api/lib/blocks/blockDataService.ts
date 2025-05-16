import { getEntitiesFormatted } from "@gredice/storage";
import type { BlockData } from "../@types/BlockData";

export async function getBlockData() {
    return await getEntitiesFormatted('block') as unknown as BlockData[];
}