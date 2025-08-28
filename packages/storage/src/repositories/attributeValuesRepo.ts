import 'server-only';
import { eq } from 'drizzle-orm';
import { getAttributeDefinition, storage } from '..';
import { bustCached, cacheKeys } from '../cache/directoriesCached';
import { attributeValues, type InsertAttributeValue } from '../schema';

export async function upsertAttributeValue(
    attributeValue: InsertAttributeValue,
) {
    let value = attributeValue.value;

    // Handle default value - assign default value if value is not provided
    if (!value) {
        const definition = await getAttributeDefinition(
            attributeValue.attributeDefinitionId,
        );
        if (definition?.defaultValue) {
            value = definition.defaultValue;
        }
    }

    await Promise.all([
        storage()
            .insert(attributeValues)
            .values({
                ...attributeValue,
                value,
            })
            .onConflictDoUpdate({
                target: attributeValues.id,
                set: {
                    ...attributeValue,
                    value,
                },
            }),
        // Bust cache if value exists
        attributeValue.id
            ? storage()
                  .select()
                  .from(attributeValues)
                  .where(eq(attributeValues.id, attributeValue.id))
                  .then((attributeValue) => {
                      return Promise.all([
                          attributeValue?.[0].entityId
                              ? bustCached(
                                    cacheKeys.entity(
                                        attributeValue?.[0]?.entityId,
                                    ),
                                )
                              : undefined,
                          attributeValue?.[0].entityTypeName
                              ? bustCached(
                                    cacheKeys.entityTypeName(
                                        attributeValue?.[0].entityTypeName,
                                    ),
                                )
                              : undefined,
                      ]);
                  })
            : undefined,
    ]);
}

export async function deleteAttributeValue(id: number) {
    await Promise.all([
        storage()
            .update(attributeValues)
            .set({ isDeleted: true })
            .where(eq(attributeValues.id, id)),
        storage()
            .select()
            .from(attributeValues)
            .where(eq(attributeValues.id, id))
            .then((attributeValue) => {
                return Promise.all([
                    attributeValue?.[0]?.entityId
                        ? bustCached(
                              cacheKeys.entity(attributeValue[0].entityId),
                          )
                        : undefined,
                    attributeValue?.[0]?.entityTypeName
                        ? bustCached(
                              cacheKeys.entityTypeName(
                                  attributeValue[0].entityTypeName,
                              ),
                          )
                        : undefined,
                ]);
            }),
    ]);
}
