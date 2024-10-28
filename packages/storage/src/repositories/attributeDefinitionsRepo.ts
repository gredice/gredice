import { and, eq } from 'drizzle-orm';
import { attributeDefinitionCategories, attributeDefinitions, ExtendedAttributeDefinition, InsertAttributeDefinition, SelectAttributeDefinitionCategory, storage, UpdateAttributeDefinition } from "..";

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

export function createAttributeDefinition(definition: InsertAttributeDefinition) {
    return storage
        .insert(attributeDefinitions)
        .values(definition);
}

export function updateAttributeDefinition(definition: UpdateAttributeDefinition) {
    return storage
        .update(attributeDefinitions)
        .set(definition)
        .where(eq(attributeDefinitions.id, definition.id));
}

export function deleteAttributeDefinition(id: number) {
    return storage
        .update(attributeDefinitions)
        .set({ isDeleted: true })
        .where(eq(attributeDefinitions.id, id));
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