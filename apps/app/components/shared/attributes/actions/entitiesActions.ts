'use server';

import { getEntitiesFormatted } from "@gredice/storage";

export async function getEntities(entityTypeName: string) {
    return (await getEntitiesFormatted(entityTypeName)) as { id: number, information?: { name?: string, label?: string } }[];
}