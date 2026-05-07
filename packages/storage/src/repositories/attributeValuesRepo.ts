import 'server-only';
import { eq } from 'drizzle-orm';
import { getAttributeDefinition, storage } from '..';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
} from '../cache/directoriesCached';
import {
    attributeValues,
    entityRevisions,
    type InsertAttributeValue,
} from '../schema';

export async function upsertAttributeValue(
    attributeValue: InsertAttributeValue,
    actor?: { id?: string; name?: string },
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

    const existingValue = attributeValue.id
        ? await storage().query.attributeValues.findFirst({
              where: eq(attributeValues.id, attributeValue.id),
          })
        : undefined;

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
        attributeValue.entityId
            ? storage()
                  .insert(entityRevisions)
                  .values({
                      entityId: attributeValue.entityId,
                      entityTypeName: attributeValue.entityTypeName,
                      action: existingValue
                          ? 'attribute.updated'
                          : 'attribute.created',
                      actorId: actor?.id,
                      actorName: actor?.name,
                      attributeValueId: attributeValue.id,
                      attributeDefinitionId:
                          attributeValue.attributeDefinitionId,
                      previousValue: existingValue?.value ?? null,
                      nextValue: value ?? null,
                  })
            : undefined,
        attributeValue.entityId
            ? bustCached(cacheKeys.entity(attributeValue.entityId))
            : undefined,
        attributeValue.entityTypeName
            ? bustCached(
                  cacheKeys.entityTypeName(attributeValue.entityTypeName),
              )
            : undefined,
        bustCachedByPrefixes(['dashboard:admin:']),
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

export async function deleteAttributeValue(
    id: number,
    actor?: { id?: string; name?: string },
) {
    await Promise.all([
        storage()
            .update(attributeValues)
            .set({ isDeleted: true })
            .where(eq(attributeValues.id, id)),
        existingValue
            ? storage().insert(entityRevisions).values({
                  entityId: existingValue.entityId,
                  entityTypeName: existingValue.entityTypeName,
                  action: 'attribute.deleted',
                  actorId: actor?.id,
                  actorName: actor?.name,
                  attributeValueId: existingValue.id,
                  attributeDefinitionId: existingValue.attributeDefinitionId,
                  previousValue: existingValue.value,
                  nextValue: null,
              })
            : undefined,
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
                    bustCachedByPrefixes(['dashboard:admin:']),
                ]);
            }),
    ]);
}
