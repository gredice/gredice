'use server';

import { getEntitiesFormatted } from "@gredice/storage";

export async function getEntities(entityTypeName: string) {
    return (await getEntitiesFormatted(entityTypeName)) as { information?: { name?: string, label?: string } }[];
}