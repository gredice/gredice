import { eq } from 'drizzle-orm';
import { attributeDefinitions, SelectAttributeDefinition, storage } from "..";

export function getAttributeDefinitions(entityType?: string): Promise<SelectAttributeDefinition[]> {
    const query = storage
        .select()
        .from(attributeDefinitions);

    if (entityType) {
        return query.where(eq(attributeDefinitions.entityType, entityType));
    }

    return query;
}

export async function getAttributeDefinitionCategories(entityType?: string): Promise<string[]> {
    const query = storage
        .selectDistinctOn([attributeDefinitions.category], { category: attributeDefinitions.category })
        .from(attributeDefinitions);

    const queryResult = await (entityType
        ? query.where(eq(attributeDefinitions.entityType, entityType))
        : query);
    return queryResult.map(c => c.category);
}