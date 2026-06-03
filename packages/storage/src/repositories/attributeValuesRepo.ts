import 'server-only';
import { and, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
} from '../cache/directoriesCached';
import { plantRelationshipTargetIdForAttributeValue } from '../helpers/plantRelationships';
import {
    attributeDefinitions,
    attributeValues,
    entityRevisions,
    type InsertAttributeValue,
} from '../schema';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

export type AttributeValueMutationSideEffects = {
    dashboardAdmin: boolean;
    entityIds: Set<number>;
    entityTypeNames: Set<string>;
    searchEntityIds: Set<number>;
};

export function createAttributeValueMutationSideEffects(): AttributeValueMutationSideEffects {
    return {
        dashboardAdmin: false,
        entityIds: new Set(),
        entityTypeNames: new Set(),
        searchEntityIds: new Set(),
    };
}

function addAttributeValueMutationSideEffects(
    sideEffects: AttributeValueMutationSideEffects,
    input: {
        entityId?: number | null;
        entityTypeName?: string | null;
        relatedEntityIds?: number[];
    },
) {
    if (input.entityId) {
        sideEffects.entityIds.add(input.entityId);
        sideEffects.searchEntityIds.add(input.entityId);
    }
    if (input.entityTypeName) {
        sideEffects.entityTypeNames.add(input.entityTypeName);
    }
    for (const entityId of input.relatedEntityIds ?? []) {
        sideEffects.entityIds.add(entityId);
        sideEffects.searchEntityIds.add(entityId);
    }
    sideEffects.dashboardAdmin = true;
}

export async function flushAttributeValueMutationSideEffects(
    sideEffects: AttributeValueMutationSideEffects,
) {
    await Promise.all([
        ...Array.from(sideEffects.entityIds).map((entityId) =>
            bustCached(cacheKeys.entity(entityId)),
        ),
        ...Array.from(sideEffects.entityTypeNames).map((entityTypeName) =>
            bustCached(cacheKeys.entityTypeName(entityTypeName)),
        ),
        sideEffects.dashboardAdmin
            ? bustCachedByPrefixes(['dashboard:admin:'])
            : undefined,
    ]);

    await Promise.all(
        Array.from(sideEffects.searchEntityIds).map((entityId) =>
            refreshEntitySearchDocumentAfterMutation(entityId),
        ),
    );
}

async function getAttributeDefinitionForMutation(
    db: DatabaseClient,
    id: number,
) {
    return db.query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.id, id),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
}

async function refreshEntitySearchDocumentAfterMutation(
    entityId: number | undefined,
) {
    if (!entityId) {
        return;
    }
    try {
        const { refreshImpactedEntitySearchDocuments } = await import(
            './entitySearchRepo'
        );
        await refreshImpactedEntitySearchDocuments(entityId);
    } catch (error) {
        console.error('Failed to refresh entity search document', {
            entityId,
            error,
        });
    }
}

export async function upsertAttributeValue(
    attributeValue: InsertAttributeValue,
    actor?: { id?: string; name?: string },
    options?: {
        db?: DatabaseClient;
        sideEffects?: AttributeValueMutationSideEffects;
    },
) {
    const db = options?.db ?? storage();
    const sideEffects =
        options?.sideEffects ?? createAttributeValueMutationSideEffects();
    let value = attributeValue.value;
    const definition = await getAttributeDefinitionForMutation(
        db,
        attributeValue.attributeDefinitionId,
    );

    // Handle default value - assign default value if value is not provided
    if (!value && definition?.defaultValue) {
        value = definition.defaultValue;
    }

    const existingValue = attributeValue.id
        ? await db.query.attributeValues.findFirst({
              where: eq(attributeValues.id, attributeValue.id),
          })
        : undefined;
    const previousRelationshipTargetId = definition
        ? plantRelationshipTargetIdForAttributeValue(
              definition,
              existingValue?.value,
          )
        : null;
    const nextRelationshipTargetId = definition
        ? plantRelationshipTargetIdForAttributeValue(definition, value)
        : null;
    const impactedRelationshipTargetIds = Array.from(
        new Set(
            [previousRelationshipTargetId, nextRelationshipTargetId].filter(
                (targetId): targetId is number =>
                    typeof targetId === 'number' &&
                    targetId !== attributeValue.entityId,
            ),
        ),
    );

    await Promise.all([
        db
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
            ? db.insert(entityRevisions).values({
                  entityId: attributeValue.entityId,
                  entityTypeName: attributeValue.entityTypeName,
                  action: existingValue
                      ? 'attribute.updated'
                      : 'attribute.created',
                  actorId: actor?.id,
                  actorName: actor?.name,
                  attributeValueId: attributeValue.id,
                  attributeDefinitionId: attributeValue.attributeDefinitionId,
                  previousValue: existingValue?.value ?? null,
                  nextValue: value ?? null,
              })
            : undefined,
    ]);

    addAttributeValueMutationSideEffects(sideEffects, {
        entityId: attributeValue.entityId ?? existingValue?.entityId,
        entityTypeName:
            attributeValue.entityTypeName ?? existingValue?.entityTypeName,
        relatedEntityIds: impactedRelationshipTargetIds,
    });
    if (!options?.sideEffects) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
}

export async function deleteAttributeValue(
    id: number,
    actor?: { id?: string; name?: string },
    options?: {
        db?: DatabaseClient;
        sideEffects?: AttributeValueMutationSideEffects;
    },
) {
    const db = options?.db ?? storage();
    const sideEffects =
        options?.sideEffects ?? createAttributeValueMutationSideEffects();
    const existingValue = await db.query.attributeValues.findFirst({
        where: eq(attributeValues.id, id),
    });
    const definition = existingValue
        ? await getAttributeDefinitionForMutation(
              db,
              existingValue.attributeDefinitionId,
          )
        : undefined;
    const relationshipTargetId =
        definition && existingValue
            ? plantRelationshipTargetIdForAttributeValue(
                  definition,
                  existingValue.value,
              )
            : null;

    await Promise.all([
        db
            .update(attributeValues)
            .set({ isDeleted: true })
            .where(eq(attributeValues.id, id)),
        existingValue
            ? db.insert(entityRevisions).values({
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
    ]);

    addAttributeValueMutationSideEffects(sideEffects, {
        entityId: existingValue?.entityId,
        entityTypeName: existingValue?.entityTypeName,
        relatedEntityIds:
            relationshipTargetId &&
            relationshipTargetId !== existingValue?.entityId
                ? [relationshipTargetId]
                : [],
    });
    if (!options?.sideEffects) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
}
