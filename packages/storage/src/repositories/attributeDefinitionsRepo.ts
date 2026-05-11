import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    type ExtendedAttributeDefinition,
    type InsertAttributeDefinition,
    type InsertAttributeDefinitionCategory,
    type SelectAttributeDefinitionCategory,
    storage,
    type UpdateAttributeDefinition,
    type UpdateAttributeDefinitionCategory,
} from '..';
import { bustCachedByPrefixes } from '../cache/directoriesCached';

const entityReadModelCachePrefixes = [
    'entities:formatted:',
    'dashboard:admin:',
];

export function getAttributeDefinitions(
    entityTypeName?: string,
): Promise<ExtendedAttributeDefinition[]> {
    return storage().query.attributeDefinitions.findMany({
        where: entityTypeName
            ? and(
                  eq(attributeDefinitions.isDeleted, false),
                  eq(attributeDefinitions.entityTypeName, entityTypeName),
              )
            : eq(attributeDefinitions.isDeleted, false),
        with: {
            categoryDefinition: true,
            entityType: true,
        },
        orderBy: (table) => [asc(table.order), asc(table.id)],
    });
}

export function getAttributeDefinition(id: number) {
    return storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.id, id),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
}

export async function createAttributeDefinition(
    definition: InsertAttributeDefinition,
): Promise<number> {
    const [inserted] = await storage()
        .insert(attributeDefinitions)
        .values(definition)
        .returning({ id: attributeDefinitions.id });
    await bustCachedByPrefixes(entityReadModelCachePrefixes);
    return inserted.id;
}

export async function updateAttributeDefinition(
    definition: UpdateAttributeDefinition,
) {
    await storage()
        .update(attributeDefinitions)
        .set({ ...definition })
        .where(eq(attributeDefinitions.id, definition.id));
    await bustCachedByPrefixes(entityReadModelCachePrefixes);
}

export async function deleteAttributeDefinition(id: number) {
    await storage()
        .update(attributeDefinitions)
        .set({ isDeleted: true })
        .where(eq(attributeDefinitions.id, id));
    await bustCachedByPrefixes(entityReadModelCachePrefixes);
}

export async function getAttributeDefinitionCategories(
    entityType?: string,
): Promise<SelectAttributeDefinitionCategory[]> {
    const query = storage()
        .select()
        .from(attributeDefinitionCategories)
        .orderBy(
            asc(attributeDefinitionCategories.order),
            asc(attributeDefinitionCategories.id),
        );

    return entityType
        ? query.where(
              eq(attributeDefinitionCategories.entityTypeName, entityType),
          )
        : query;
}

export async function createAttributeDefinitionCategory(
    category: InsertAttributeDefinitionCategory,
) {
    await storage().insert(attributeDefinitionCategories).values(category);
    await bustCachedByPrefixes(entityReadModelCachePrefixes);
}

export async function updateAttributeDefinitionCategory(
    category: UpdateAttributeDefinitionCategory,
) {
    await storage()
        .update(attributeDefinitionCategories)
        .set(category)
        .where(eq(attributeDefinitionCategories.id, category.id));
    await bustCachedByPrefixes(entityReadModelCachePrefixes);
}

export async function deleteAttributeDefinitionCategory(id: number) {
    await storage()
        .update(attributeDefinitionCategories)
        .set({ isDeleted: true })
        .where(eq(attributeDefinitionCategories.id, id));
    await bustCachedByPrefixes(entityReadModelCachePrefixes);
}
