import { and, eq } from 'drizzle-orm';
import { attributeDefinitionCategories, attributeDefinitions, SelectAttributeDefinition, SelectAttributeDefinitionCategory, storage } from "..";

export function getAttributeDefinitions(entityType?: string): Promise<SelectAttributeDefinition[]> {
    const query = storage
        .select()
        .from(attributeDefinitions)
        .orderBy(attributeDefinitions.category, attributeDefinitions.label);

    if (entityType) {
        return query.where(eq(attributeDefinitions.entityTypeName, entityType));
    }

    return query;
}

export function getAttributeDefinition(id: number) {
    return storage.query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.id, id),
            eq(attributeDefinitions.isDeleted, false)
        )
    });
}

export async function getAttributeDefinitionCategories(entityType?: string): Promise<SelectAttributeDefinitionCategory[]> {
    const query = storage
        .select()
        .from(attributeDefinitionCategories);

    return entityType
        ? query.where(eq(attributeDefinitionCategories.entityTypeName, entityType))
        : query;
}