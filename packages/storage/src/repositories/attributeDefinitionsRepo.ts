import { and, eq } from 'drizzle-orm';
import { attributeDefinitionCategories, attributeDefinitions, ExtendedAttributeDefinition, SelectAttributeDefinition, SelectAttributeDefinitionCategory, storage } from "..";

export function getAttributeDefinitions(entityTypeName?: string): Promise<ExtendedAttributeDefinition[]> {
    return storage.query.attributeDefinitions.findMany({
        where: entityTypeName
            ? and(eq(attributeDefinitions.isDeleted, false), eq(attributeDefinitions.entityTypeName, entityTypeName))
            : eq(attributeDefinitions.isDeleted, false),
        with: {
            categoryDefinition: true,
            entityType: true
        },
        orderBy: attributeDefinitions.order
    });
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
        .from(attributeDefinitionCategories)
        .orderBy(attributeDefinitionCategories.order);

    return entityType
        ? query.where(eq(attributeDefinitionCategories.entityTypeName, entityType))
        : query;
}