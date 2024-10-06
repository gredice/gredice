import { eq } from 'drizzle-orm';
import { attributeDefinitionCategories, attributeDefinitions, SelectAttributeDefinition, SelectAttributeDefinitionCategory, storage } from "..";

export function getAttributeDefinitions(entityType?: string): Promise<SelectAttributeDefinition[]> {
    const query = storage
        .select()
        .from(attributeDefinitions)
        .orderBy(attributeDefinitions.category, attributeDefinitions.label);

    if (entityType) {
        return query.where(eq(attributeDefinitions.entityType, entityType));
    }

    return query;
}

export async function getAttributeDefinitionCategories(entityType?: string): Promise<SelectAttributeDefinitionCategory[]> {
    const query = storage
        .select()
        .from(attributeDefinitionCategories);

    return entityType
        ? query.where(eq(attributeDefinitionCategories.entityType, entityType))
        : query;
}