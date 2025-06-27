import 'server-only';
import { eq } from "drizzle-orm";
import { getAttributeDefinition, storage } from "..";
import { attributeValues, InsertAttributeValue } from "../schema";
import { bustCached, cacheKeys } from '../cache/directoriesCached';

export async function upsertAttributeValue(value: InsertAttributeValue) {
    let attributeValue = value.value;
    const definition = await getAttributeDefinition(value.attributeDefinitionId);
    if (Boolean(definition)) {
        // Handle default value
        if (definition?.defaultValue && !value.value) {
            attributeValue = definition.defaultValue;
        }
    }

    await Promise.all([
        storage()
            .insert(attributeValues)
            .values(value)
            .onConflictDoUpdate({
                target: attributeValues.id,
                set: {
                    ...value,
                    value: attributeValue
                },
            }),
        value.id ? storage().select().from(attributeValues).where(eq(attributeValues.id, value.id)).then(
            attributeValue => {
                return Promise.all([
                    attributeValue?.[0].entityId ? bustCached(cacheKeys.entity(attributeValue?.[0]?.entityId)) : undefined,
                    attributeValue?.[0].entityTypeName ? bustCached(cacheKeys.entityTypeName(attributeValue?.[0].entityTypeName)) : undefined
                ]);
            }
        ) : undefined
    ]);
}

export async function deleteAttributeValue(id: number) {
    await Promise.all([
        storage()
            .update(attributeValues)
            .set({ isDeleted: true })
            .where(eq(attributeValues.id, id)),
        storage().select().from(attributeValues).where(eq(attributeValues.id, id)).then(
            attributeValue => {
                return Promise.all([
                    attributeValue?.[0]?.entityId ? bustCached(cacheKeys.entity(attributeValue[0].entityId)) : undefined,
                    attributeValue?.[0]?.entityTypeName ? bustCached(cacheKeys.entityTypeName(attributeValue[0].entityTypeName)) : undefined
                ]);
            }
        ),
    ]);
}