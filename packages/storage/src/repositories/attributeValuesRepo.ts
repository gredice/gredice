import 'server-only';
import { eq } from 'drizzle-orm';
import { getAttributeDefinition, storage } from '..';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
} from '../cache/directoriesCached';
import { getPlantRelationshipMutationEntityIds } from '../helpers/plantRelationships';
import {
    attributeValues,
    entityRevisions,
    type InsertAttributeValue,
} from '../schema';

async function refreshEntitySearchDocumentsAfterMutation(
    entityIds: (number | undefined)[],
) {
    const ids = Array.from(
        new Set(
            entityIds.filter((entityId): entityId is number =>
                Boolean(entityId),
            ),
        ),
    );
    if (ids.length === 0) {
        return;
    }
    try {
        const { refreshImpactedEntitySearchDocuments } = await import(
            './entitySearchRepo'
        );
        await Promise.all(
            ids.map((entityId) =>
                refreshImpactedEntitySearchDocuments(entityId),
            ),
        );
    } catch (error) {
        console.error('Failed to refresh entity search document', {
            entityIds: ids,
            error,
        });
    }
}

export async function upsertAttributeValue(
    attributeValue: InsertAttributeValue,
    actor?: { id?: string; name?: string },
) {
    let value = attributeValue.value;
    const definition = await getAttributeDefinition(
        attributeValue.attributeDefinitionId,
    );

    // Handle default value - assign default value if value is not provided
    if (!value && definition?.defaultValue) {
        value = definition.defaultValue;
    }

    const existingValue = attributeValue.id
        ? await storage().query.attributeValues.findFirst({
              where: eq(attributeValues.id, attributeValue.id),
          })
        : undefined;
    const relationshipEntityIds = await getPlantRelationshipMutationEntityIds({
        entityId: attributeValue.entityId,
        entityTypeName: attributeValue.entityTypeName,
        attributeDefinition: definition,
        previousValue: existingValue?.value,
        nextValue: value,
    });

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
        ...relationshipEntityIds
            .filter((entityId) => entityId !== attributeValue.entityId)
            .map((entityId) => bustCached(cacheKeys.entity(entityId))),
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

    await refreshEntitySearchDocumentsAfterMutation(
        relationshipEntityIds.length
            ? relationshipEntityIds
            : [attributeValue.entityId],
    );
}

export async function deleteAttributeValue(
    id: number,
    actor?: { id?: string; name?: string },
) {
    const existingValue = await storage().query.attributeValues.findFirst({
        where: eq(attributeValues.id, id),
    });
    const definition = existingValue
        ? await getAttributeDefinition(existingValue.attributeDefinitionId)
        : undefined;
    const relationshipEntityIds = await getPlantRelationshipMutationEntityIds({
        entityId: existingValue?.entityId,
        entityTypeName: existingValue?.entityTypeName,
        attributeDefinition: definition,
        previousValue: existingValue?.value,
        nextValue: null,
    });

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
        ...relationshipEntityIds
            .filter((entityId) => entityId !== existingValue?.entityId)
            .map((entityId) => bustCached(cacheKeys.entity(entityId))),
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

    await refreshEntitySearchDocumentsAfterMutation(
        relationshipEntityIds.length
            ? relationshipEntityIds
            : [existingValue?.entityId],
    );
}
