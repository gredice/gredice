import 'server-only';
import { slugify } from '@gredice/js/slug';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityRevisions,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    type SelectEntity,
    type SelectEntityRevision,
    type SelectEntityType,
    storage,
    type UpdateEntity,
} from '..';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
    directoriesCached,
} from '../cache/directoriesCached';
import { getEntityCompleteness } from '../helpers/entityCompleteness';
import {
    attributeDefinitionPath,
    generatedImageAttributeValue,
    parseGeneratedImageUrlDefaultValue,
} from '../helpers/generatedAttributeValues';
import {
    buildPlantHealthReadModels,
    isPlantHealthAffectedPlantAttributeDefinition,
    isPlantHealthIssueEntityTypeName,
    type PlantHealthReadModel,
    parsePlantHealthReferenceTargetId,
    plantHealthAffectedPlantIdsForEntity,
    plantHealthOperationIntentForAttributeDefinition,
    sanitizePlantHealthIssueFormattedEntity,
} from '../helpers/plantHealth';
import {
    buildPlantRelationshipReadModels,
    isPlantRelationshipAttributeDefinition,
} from '../helpers/plantRelationships';

const entityCacheTtl = 60 * 60; // 1 hour

async function refreshEntitySearchDocumentAfterMutation(entityId: number) {
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

type EntityAttribute = SelectAttributeValue & {
    attributeDefinition: SelectAttributeDefinition;
};

type EntityWithAttributesAndDefinitions = SelectEntity & {
    attributes: EntityAttribute[];
    entityType: SelectEntityType & {
        attributeDefinitions: SelectAttributeDefinition[];
    };
};

export type LatestEntityRevision = Pick<
    SelectEntityRevision,
    | 'id'
    | 'entityId'
    | 'entityTypeName'
    | 'action'
    | 'actorId'
    | 'actorName'
    | 'createdAt'
>;

function tryParseAttributeJson(
    value: string,
    attributeDefinition: SelectAttributeDefinition,
) {
    try {
        return JSON.parse(value) as unknown;
    } catch (error) {
        console.error('Failed to parse entity attribute JSON value', {
            attributeDefinitionId: attributeDefinition.id,
            category: attributeDefinition.category,
            name: attributeDefinition.name,
            dataType: attributeDefinition.dataType,
            error,
        });
        return null;
    }
}

function isRangeValue(value: unknown): value is { min: number; max: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'min' in value &&
        'max' in value &&
        typeof value.min === 'number' &&
        typeof value.max === 'number'
    );
}

function parseEntityRefId(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const trimmedValue = value.trim();
    if (!/^\d+$/.test(trimmedValue)) {
        return null;
    }

    return Number.parseInt(trimmedValue, 10);
}

async function buildEffectiveEntity(
    entity: EntityWithAttributesAndDefinitions,
    visited = new Set<number>(),
): Promise<EntityWithAttributesAndDefinitions> {
    if (visited.has(entity.id)) {
        throw new Error('Cycle detected in entity hierarchy.');
    }
    visited.add(entity.id);

    if (!entity.parentId) {
        return populateMissingAttributes(entity);
    }

    const parent = await storage().query.entities.findFirst({
        where: and(
            eq(entities.id, entity.parentId),
            eq(entities.isDeleted, false),
        ),
        with: {
            attributes: {
                where: eq(attributeValues.isDeleted, false),
                with: {
                    attributeDefinition: true,
                },
            },
            entityType: {
                with: {
                    attributeDefinitions: {
                        where: eq(attributeDefinitions.isDeleted, false),
                    },
                },
            },
        },
    });

    if (!parent || parent.entityTypeName !== entity.entityTypeName) {
        return populateMissingAttributes(entity);
    }

    const parentEffective = await buildEffectiveEntity(parent, visited);
    const childByDefinitionId = new Map(
        entity.attributes.map((attribute) => [
            attribute.attributeDefinitionId,
            attribute,
        ]),
    );

    const inheritedAttributes = parentEffective.attributes.filter(
        (attribute) =>
            !childByDefinitionId.has(attribute.attributeDefinitionId),
    );

    return populateMissingAttributes({
        ...entity,
        attributes: [...entity.attributes, ...inheritedAttributes],
    });
}
function populateMissingAttributes(
    entity: EntityWithAttributesAndDefinitions,
): EntityWithAttributesAndDefinitions {
    // Create missing attributes that have default value based on entity type definitions
    for (const definition of entity.entityType.attributeDefinitions) {
        const hasAtleastOneAttributeValue = entity.attributes.some(
            (a) => a.attributeDefinition.id === definition.id && !a.isDeleted,
        );
        // If attribute is missing and we have default defined, create a default one
        const defaultValue = resolveAttributeDefaultValue(entity, definition);
        if (!hasAtleastOneAttributeValue && defaultValue !== null) {
            entity.attributes.push({
                entityId: entity.id,
                entityTypeName: entity.entityType.name,
                attributeDefinitionId: definition.id,
                attributeDefinition: definition,
                value: defaultValue,
                order: definition.order,
                createdAt: new Date(),
                updatedAt: new Date(),
                isDeleted: false,
                id: 0, // Placeholder ID, will be replaced by database
            });
        }
    }

    // Sort attributes by order, if order is not defined, default to 0
    entity.attributes = entity.attributes.sort((a, b) => {
        const orderA = a.attributeDefinition.order ?? 0;
        const orderB = b.attributeDefinition.order ?? 0;
        return Number(orderA) - Number(orderB);
    });

    return entity;
}

function resolveAttributeDefaultValue(
    entity: EntityWithAttributesAndDefinitions,
    definition: SelectAttributeDefinition,
) {
    if (
        typeof definition.defaultValue === 'undefined' ||
        definition.defaultValue === null
    ) {
        return null;
    }

    const generatedImageConfig = parseGeneratedImageUrlDefaultValue(
        definition.defaultValue,
    );
    if (!generatedImageConfig) {
        return definition.defaultValue;
    }

    if (definition.dataType !== 'image') {
        return null;
    }

    const sourceValue =
        entity.attributes.find(
            (attribute) =>
                !attribute.isDeleted &&
                attributeDefinitionPath(attribute.attributeDefinition) ===
                    generatedImageConfig.source,
        )?.value ?? null;

    return generatedImageAttributeValue(generatedImageConfig, sourceValue);
}

export async function getEntitiesRaw(entityTypeName: string, state?: string) {
    const rawEntities = await storage().query.entities.findMany({
        where: state
            ? and(
                  eq(entities.entityTypeName, entityTypeName),
                  eq(entities.state, state),
                  eq(entities.isDeleted, false),
              )
            : and(
                  eq(entities.entityTypeName, entityTypeName),
                  eq(entities.isDeleted, false),
              ),
        orderBy: desc(entities.updatedAt),
        with: {
            attributes: {
                where: eq(attributeValues.isDeleted, false),
                with: {
                    attributeDefinition: true,
                },
            },
            entityType: {
                with: {
                    attributeDefinitions: {
                        where: eq(attributeDefinitions.isDeleted, false),
                    },
                },
            },
        },
    });

    return Promise.all(
        rawEntities.map((entity) => buildEffectiveEntity(entity)),
    );
}

export async function getEntitiesCount(entityTypeName: string, state?: string) {
    const result = await storage()
        .select({ count: count() })
        .from(entities)
        .where(
            state
                ? and(
                      eq(entities.entityTypeName, entityTypeName),
                      eq(entities.state, state),
                      eq(entities.isDeleted, false),
                  )
                : and(
                      eq(entities.entityTypeName, entityTypeName),
                      eq(entities.isDeleted, false),
                  ),
        );
    return result[0]?.count ?? 0;
}

// Add a type for the cache, ensuring attributes and entityType are included
interface EntityWithAttributesAndType extends SelectEntity {
    attributes: EntityAttribute[];
    entityType: SelectEntityType;
}
interface EntityTypeCache {
    [key: string]: Promise<EntityWithAttributesAndType[]>;
}

export type IncomingEntityLinkGroup = {
    entityTypeName: string;
    entityTypeLabel: string;
    entities: {
        id: number;
        displayName: string;
        linkedBy: {
            name: string;
            label: string;
        }[];
    }[];
};

// Update expandEntity to accept a cache
async function expandEntity(
    entityRaw: EntityWithAttributesAndType | undefined,
    cache: EntityTypeCache = {},
) {
    if (!entityRaw) {
        return null;
    }

    const entity: {
        id: number;
        entityType: {
            id: number;
            name: string;
            label: string;
        };
        createdAt: Date;
        updatedAt: Date;
        [key: string]: unknown;
    } = {
        id: entityRaw.id,
        entityType: {
            id: entityRaw.entityType.id,
            name: entityRaw.entityType.name,
            label: entityRaw.entityType.label,
        },
        createdAt: entityRaw.createdAt,
        updatedAt: entityRaw.updatedAt,
        slug: slugify(entityDisplayNameFromAttributes(entityRaw)),
    };
    return await expandEntityAttributes(entity, entityRaw.attributes, cache);
}

// Update expandEntityAttributes to accept a cache
async function expandEntityAttributes<T extends Record<string, unknown>>(
    entity: T,
    attributes: (SelectAttributeValue & {
        attributeDefinition: SelectAttributeDefinition;
    })[],
    cache: EntityTypeCache = {},
) {
    const expandedEntity = { ...entity };
    // Prepare all attribute expansion promises
    const attributePromises = attributes.map(async (attribute) => {
        if (
            isPlantRelationshipAttributeDefinition(
                attribute.attributeDefinition,
            )
        ) {
            return;
        }

        // Create category object if it doesn't exist
        if (
            expandedEntity[attribute.attributeDefinition.category] === undefined
        ) {
            (expandedEntity as Record<string, unknown>)[
                attribute.attributeDefinition.category
            ] = {};
        }
        const category = expandedEntity[
            attribute.attributeDefinition.category
        ] as Record<string, unknown>;
        if (attribute.attributeDefinition.multiple) {
            if (category[attribute.attributeDefinition.name] === undefined) {
                category[attribute.attributeDefinition.name] = [];
            }
            const array = category[
                attribute.attributeDefinition.name
            ] as unknown[];
            const result = await expandValue(
                attribute.value,
                attribute.attributeDefinition,
                cache,
            );
            if (result !== undefined && result !== null) {
                if (Array.isArray(result)) {
                    array.push(...result);
                } else {
                    array.push(result);
                }
            }
        } else {
            category[attribute.attributeDefinition.name] = await expandValue(
                attribute.value,
                attribute.attributeDefinition,
                cache,
            );
        }
    });
    await Promise.all(attributePromises);
    return expandedEntity;
}

// Update expandValue to accept a cache
async function expandValue(
    value: string | null | undefined,
    attributeDefinition: SelectAttributeDefinition,
    cache: EntityTypeCache = {},
) {
    if (value === null || value === undefined) {
        return null;
    }

    if (attributeDefinition.dataType.startsWith('ref:')) {
        return await resolveRef(value, attributeDefinition, cache);
    }
    if (attributeDefinition.dataType === 'number') {
        const trimmed = value.trim();
        return /^-?\d+(?:\.\d+)?$/u.test(trimmed)
            ? Number(trimmed)
            : Number.NaN;
    } else if (
        attributeDefinition.dataType === 'range' ||
        attributeDefinition.dataType.startsWith('range|')
    ) {
        const parsedRangeValue = tryParseAttributeJson(
            value,
            attributeDefinition,
        );
        if (isRangeValue(parsedRangeValue)) {
            return parsedRangeValue;
        }
        return null;
    } else if (attributeDefinition.dataType === 'boolean') {
        return value === 'true';
    } else if (attributeDefinition.dataType.startsWith('json')) {
        if (!value) return null;
        return tryParseAttributeJson(value, attributeDefinition);
    } else if (attributeDefinition.dataType === 'image') {
        if (!value) return null;
        const data = tryParseAttributeJson(value, attributeDefinition);
        if (!data || typeof data !== 'object') {
            return null;
        }

        let url = '';
        if ('url' in data && typeof data.url === 'string') {
            url = data.url;
        }
        return {
            url,
            // TODO: Alt, image size, etc. can be added here
        } as const;
    } else {
        return value;
    }
}

async function resolveRef(
    value: string | null,
    attributeDefinition: SelectAttributeDefinition,
    cache: EntityTypeCache = {},
) {
    const refId = parseEntityRefId(value);
    if (refId === null) {
        return null;
    }

    const refEntityTypeName = attributeDefinition.dataType.split(':')[1];
    const cacheKey = `${refEntityTypeName}:published`;
    if (!cache[cacheKey]) {
        cache[cacheKey] = getEntitiesRaw(
            refEntityTypeName,
            'published',
        ) as Promise<EntityWithAttributesAndType[]>;
    }
    const refEntitiesByType = await cache[cacheKey];
    const refEntity = refEntitiesByType.find((e) => e.id === refId);
    if (!refEntity) {
        return null;
    }

    return await expandEntityAttributes(
        { id: refEntity.id },
        refEntity.attributes,
        cache,
    );
}

function applyPlantRelationshipReadModel<T>(
    entities: T[],
    rawEntities: EntityWithAttributesAndType[],
) {
    const relationshipsByEntityId =
        buildPlantRelationshipReadModels(rawEntities);
    return entities.map((entity) => {
        if (
            !entity ||
            typeof entity !== 'object' ||
            !('id' in entity) ||
            typeof entity.id !== 'number'
        ) {
            return entity;
        }

        const relationships = relationshipsByEntityId.get(entity.id);
        if (!relationships) {
            return entity;
        }

        return {
            ...entity,
            relationships,
        };
    }) as T[];
}

async function applyEntityRelationshipReadModels<T>(
    entityTypeName: string,
    formattedEntities: T[],
    rawEntities: EntityWithAttributesAndType[],
) {
    if (entityTypeName === 'plant') {
        return applyPlantRelationshipReadModel(formattedEntities, rawEntities);
    }

    if (entityTypeName !== 'plantSort') {
        return formattedEntities;
    }

    const plantEntities = (await getEntitiesRaw(
        'plant',
        'published',
    )) as EntityWithAttributesAndType[];
    return applyPlantRelationshipReadModel(formattedEntities, [
        ...rawEntities,
        ...plantEntities,
    ]);
}

function applyPlantHealthReadModel<T>(
    entities: T[],
    rawEntities: EntityWithAttributesAndType[],
    healthByPlantId: Map<number, PlantHealthReadModel>,
) {
    return entities.map((entity) => {
        if (
            !entity ||
            typeof entity !== 'object' ||
            !('id' in entity) ||
            typeof entity.id !== 'number'
        ) {
            return entity;
        }

        const rawEntity = rawEntities.find(
            (candidate) => candidate.id === entity.id,
        );
        if (!rawEntity) {
            return entity;
        }

        const health = healthByPlantId.get(rawEntity.id);
        if (!health) {
            return entity;
        }

        return {
            ...entity,
            health,
        };
    }) as T[];
}

async function buildPlantHealthReadModelForPublishedPlants(
    plantEntities: EntityWithAttributesAndType[],
) {
    const [diseases, pests, operations] = await Promise.all([
        getEntitiesRaw('plantDisease', 'published') as Promise<
            EntityWithAttributesAndType[]
        >,
        getEntitiesRaw('plantPest', 'published') as Promise<
            EntityWithAttributesAndType[]
        >,
        getEntitiesRaw('operation', 'published') as Promise<
            EntityWithAttributesAndType[]
        >,
    ]);

    return buildPlantHealthReadModels({
        plants: plantEntities,
        diseases,
        pests,
        operations,
    });
}

function applyPlantHealthIssueFormatting<T>(entityTypeName: string, entity: T) {
    if (!isPlantHealthIssueEntityTypeName(entityTypeName)) {
        return entity;
    }

    return sanitizePlantHealthIssueFormattedEntity(entity);
}

async function assertPlantHealthIssueReferencesCanPublish(entity: {
    entityTypeName: string;
    attributes: {
        attributeDefinitionId: number;
        value: string | null;
    }[];
    entityType: {
        attributeDefinitions: SelectAttributeDefinition[];
    };
}) {
    if (!isPlantHealthIssueEntityTypeName(entity.entityTypeName)) {
        return;
    }

    const definitionById = new Map(
        entity.entityType.attributeDefinitions.map((definition) => [
            definition.id,
            definition,
        ]),
    );
    const targetIdsByType = new Map<string, Set<number>>();
    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();
    const invalidLabels: string[] = [];

    for (const attribute of entity.attributes) {
        const definition = definitionById.get(attribute.attributeDefinitionId);
        if (!definition) {
            continue;
        }

        let targetType: 'plant' | 'operation' | null = null;
        if (isPlantHealthAffectedPlantAttributeDefinition(definition)) {
            targetType = 'plant';
        } else if (
            plantHealthOperationIntentForAttributeDefinition(definition)
        ) {
            targetType = 'operation';
        }
        if (!targetType) {
            continue;
        }

        const targetId = parsePlantHealthReferenceTargetId(attribute.value);
        if (!targetId) {
            invalidLabels.push(definition.label);
            continue;
        }

        const duplicateKey = `${definition.id}:${targetId}`;
        if (seenKeys.has(duplicateKey)) {
            duplicateKeys.add(duplicateKey);
        }
        seenKeys.add(duplicateKey);

        const targetIds = targetIdsByType.get(targetType) ?? new Set<number>();
        targetIds.add(targetId);
        targetIdsByType.set(targetType, targetIds);
    }

    const missingTargets: string[] = [];
    for (const [targetType, targetIds] of targetIdsByType) {
        const ids = Array.from(targetIds);
        if (ids.length === 0) {
            continue;
        }

        const publishedTargets = await storage().query.entities.findMany({
            where: and(
                inArray(entities.id, ids),
                eq(entities.entityTypeName, targetType),
                eq(entities.state, 'published'),
                eq(entities.isDeleted, false),
            ),
        });
        const publishedTargetIds = new Set(
            publishedTargets.map((target) => target.id),
        );
        for (const targetId of ids) {
            if (!publishedTargetIds.has(targetId)) {
                missingTargets.push(`${targetType}#${targetId}`);
            }
        }
    }

    const errors = [
        duplicateKeys.size > 0
            ? 'Remove duplicate affected plant or operation references.'
            : null,
        invalidLabels.length > 0
            ? `Fix invalid references in: ${Array.from(new Set(invalidLabels)).join(', ')}.`
            : null,
        missingTargets.length > 0
            ? `Publish or remove missing references: ${missingTargets.join(', ')}.`
            : null,
    ].filter((message): message is string => Boolean(message));

    if (errors.length > 0) {
        throw new Error(
            `Plant health issue is not ready for publishing. ${errors.join(' ')}`,
        );
    }
}

export async function getEntitiesFormatted<T>(entityTypeName: string) {
    return directoriesCached(
        cacheKeys.entityTypeName(entityTypeName),
        async () => {
            const cache: EntityTypeCache = {};
            const entities = (await getEntitiesRaw(
                entityTypeName,
                'published',
            )) as EntityWithAttributesAndType[];
            const formattedEntities = (await Promise.all(
                entities.map((e) => expandEntity(e, cache)),
            )) as T[];
            if (entityTypeName === 'plant') {
                const withRelationships = applyPlantRelationshipReadModel(
                    formattedEntities,
                    entities,
                );
                const plantHealthReadModel =
                    await buildPlantHealthReadModelForPublishedPlants(entities);
                return applyPlantHealthReadModel(
                    withRelationships,
                    entities,
                    plantHealthReadModel,
                );
            }
            if (entityTypeName === 'plantSort') {
                return await applyEntityRelationshipReadModels(
                    entityTypeName,
                    formattedEntities,
                    entities,
                );
            }
            return formattedEntities.map((entity) =>
                applyPlantHealthIssueFormatting(entityTypeName, entity),
            );
        },
        entityCacheTtl,
    );
}

export async function getEntityFormatted<T>(id: number) {
    return directoriesCached(
        cacheKeys.entity(id),
        async () => {
            const cache: EntityTypeCache = {};
            const entity = (await getEntityRaw(id)) as
                | EntityWithAttributesAndType
                | undefined;
            const formattedEntity = (await expandEntity(entity, cache)) as T;
            if (entity?.entityTypeName !== 'plant') {
                if (entity?.entityTypeName === 'plantSort') {
                    const plantEntities = (await getEntitiesRaw(
                        'plant',
                        'published',
                    )) as EntityWithAttributesAndType[];
                    return applyPlantRelationshipReadModel(
                        [formattedEntity],
                        [entity, ...plantEntities],
                    )[0];
                }
                return applyPlantHealthIssueFormatting(
                    entity?.entityTypeName ?? '',
                    formattedEntity,
                );
            }

            const plantEntities = (await getEntitiesRaw(
                'plant',
                'published',
            )) as EntityWithAttributesAndType[];
            const withRelationships = applyPlantRelationshipReadModel(
                [formattedEntity],
                plantEntities,
            );
            const plantHealthReadModel =
                await buildPlantHealthReadModelForPublishedPlants(
                    plantEntities,
                );
            return applyPlantHealthReadModel(
                withRelationships,
                plantEntities,
                plantHealthReadModel,
            )[0];
        },
        entityCacheTtl,
    );
}

export async function getEntityRaw(id: number) {
    const entity = await storage().query.entities.findFirst({
        where: and(eq(entities.id, id), eq(entities.isDeleted, false)),
        with: {
            attributes: {
                where: eq(attributeValues.isDeleted, false),
                with: {
                    attributeDefinition: true,
                },
            },
            entityType: {
                with: {
                    attributeDefinitions: {
                        where: eq(attributeDefinitions.isDeleted, false),
                    },
                },
            },
        },
    });
    if (!entity) {
        return undefined;
    }
    return populateMissingAttributes(entity);
}

function entityNameFromAttributes(
    entity: SelectEntity & {
        attributes: (SelectAttributeValue & {
            attributeDefinition: SelectAttributeDefinition;
        })[];
    },
) {
    return (
        entity.attributes.find(
            (a) =>
                a.attributeDefinition.category === 'information' &&
                a.attributeDefinition.name === 'name',
        )?.value ?? null
    );
}

function entityDisplayNameFromAttributes(
    entity: SelectEntity & {
        entityType: SelectEntityType;
        attributes: (SelectAttributeValue & {
            attributeDefinition: SelectAttributeDefinition;
        })[];
    },
) {
    const label = entity.attributes.find(
        (a) =>
            a.attributeDefinition.category === 'information' &&
            a.attributeDefinition.name === 'label',
    )?.value;
    const name = entityNameFromAttributes(entity);
    return label ?? name ?? `${entity.entityType.label} ${entity.id}`;
}

export async function getEntityIncomingLinks(
    entityId: number,
    sourceEntity?: NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>,
): Promise<IncomingEntityLinkGroup[]> {
    const entity = sourceEntity ?? (await getEntityRaw(entityId));
    if (!entity) {
        return [];
    }

    const refDefinitions = await storage().query.attributeDefinitions.findMany({
        where: and(
            eq(attributeDefinitions.isDeleted, false),
            eq(attributeDefinitions.dataType, `ref:${entity.entityTypeName}`),
        ),
    });
    if (refDefinitions.length === 0) {
        return [];
    }

    const definitionById = new Map(refDefinitions.map((d) => [d.id, d]));
    const definitionIds = refDefinitions.map((d) => d.id);
    const linkAttributeValues = await storage().query.attributeValues.findMany({
        where: and(
            inArray(attributeValues.attributeDefinitionId, definitionIds),
            eq(attributeValues.isDeleted, false),
            eq(attributeValues.value, String(entityId)),
        ),
    });

    const entityToDefinitionIds = new Map<number, Set<number>>();
    for (const attributeValue of linkAttributeValues) {
        if (attributeValue.entityId === entityId) {
            continue;
        }
        const definition = definitionById.get(
            attributeValue.attributeDefinitionId,
        );
        if (!definition) {
            continue;
        }

        const definitionIdsByEntity =
            entityToDefinitionIds.get(attributeValue.entityId) ?? new Set();
        definitionIdsByEntity.add(definition.id);
        entityToDefinitionIds.set(
            attributeValue.entityId,
            definitionIdsByEntity,
        );
    }

    const sourceEntityIds = Array.from(entityToDefinitionIds.keys());
    if (sourceEntityIds.length === 0) {
        return [];
    }

    const sourceEntities = await storage().query.entities.findMany({
        where: and(
            inArray(entities.id, sourceEntityIds),
            eq(entities.isDeleted, false),
        ),
        with: {
            attributes: {
                where: eq(attributeValues.isDeleted, false),
                with: {
                    attributeDefinition: true,
                },
            },
            entityType: true,
        },
    });

    const grouped = new Map<string, IncomingEntityLinkGroup>();
    for (const sourceEntity of sourceEntities) {
        const linkedByIds = entityToDefinitionIds.get(sourceEntity.id);
        if (!linkedByIds) {
            continue;
        }

        const linkedBy = Array.from(linkedByIds)
            .map((definitionId) => definitionById.get(definitionId))
            .filter((definition): definition is SelectAttributeDefinition =>
                Boolean(definition),
            )
            .map((definition) => ({
                name: definition.name,
                label: definition.label,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const group = grouped.get(sourceEntity.entityTypeName) ?? {
            entityTypeName: sourceEntity.entityTypeName,
            entityTypeLabel: sourceEntity.entityType.label,
            entities: [],
        };
        group.entities.push({
            id: sourceEntity.id,
            displayName: entityDisplayNameFromAttributes(sourceEntity),
            linkedBy,
        });
        grouped.set(sourceEntity.entityTypeName, group);
    }

    return Array.from(grouped.values())
        .map((group) => ({
            ...group,
            entities: group.entities.sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            ),
        }))
        .sort((a, b) => a.entityTypeLabel.localeCompare(b.entityTypeLabel));
}

export async function createEntity(
    entityTypeName: string,
    actor?: { id?: string; name?: string },
) {
    const [result] = await Promise.all([
        storage()
            .insert(entities)
            .values({ entityTypeName })
            .returning({ id: entities.id }),
        bustCached(cacheKeys.entityTypeName(entityTypeName)),
        bustCachedByPrefixes(['dashboard:admin:']),
    ]);
    const entityId = result[0].id;
    await storage().insert(entityRevisions).values({
        entityId,
        entityTypeName,
        action: 'entity.created',
        actorId: actor?.id,
        actorName: actor?.name,
    });
    return entityId;
}

export async function duplicateEntity(id: number) {
    const entity = await getEntityRaw(id);
    if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
    }

    const newEntityId = await createEntity(entity.entityTypeName);
    const newAttributes = entity.attributes.map((attr) => ({
        entityId: newEntityId,
        entityTypeName: entity.entityTypeName,
        attributeDefinitionId: attr.attributeDefinition.id,
        value: attr.value,
        order: attr.order,
    }));

    await Promise.all([
        storage().insert(attributeValues).values(newAttributes),
        bustCached(cacheKeys.entityTypeName(entity.entityTypeName)),
        bustCached(cacheKeys.entity(newEntityId)),
        bustCachedByPrefixes(['dashboard:admin:']),
    ]);

    return newEntityId;
}

export async function updateEntity(
    entity: UpdateEntity,
    actor?: { id?: string; name?: string },
) {
    const previousEntity = await storage().query.entities.findFirst({
        where: eq(entities.id, entity.id),
    });
    if (!previousEntity) {
        throw new Error(`Entity with id ${entity.id} not found`);
    }

    const nextParentId =
        typeof entity.parentId === 'undefined'
            ? previousEntity.parentId
            : entity.parentId;
    const nextEntityTypeName =
        entity.entityTypeName ?? previousEntity.entityTypeName;

    if (
        typeof entity.parentId !== 'undefined' ||
        typeof entity.entityTypeName !== 'undefined'
    ) {
        if (nextParentId === entity.id) {
            throw new Error('Entity cannot be its own parent.');
        }
        if (nextParentId !== null) {
            const parentEntity = await storage().query.entities.findFirst({
                where: and(
                    eq(entities.id, nextParentId),
                    eq(entities.isDeleted, false),
                ),
            });
            if (!parentEntity) {
                throw new Error(`Parent entity ${nextParentId} was not found.`);
            }
            if (parentEntity.entityTypeName !== nextEntityTypeName) {
                throw new Error(
                    'Parent entity must have the same entity type as the child.',
                );
            }

            let cursor = parentEntity;
            const visited = new Set<number>([entity.id]);
            while (cursor.parentId !== null) {
                if (visited.has(cursor.id)) {
                    throw new Error('Cycle detected in entity hierarchy.');
                }
                visited.add(cursor.id);
                const nextParent = await storage().query.entities.findFirst({
                    where: and(
                        eq(entities.id, cursor.parentId),
                        eq(entities.isDeleted, false),
                    ),
                });
                if (!nextParent) {
                    break;
                }
                cursor = nextParent;
            }
        }
    }

    const updateData = {
        ...entity,
    };

    if (updateData.state === 'published') {
        const entityForValidation = await storage().query.entities.findFirst({
            where: and(
                eq(entities.id, entity.id),
                eq(entities.isDeleted, false),
            ),
            with: {
                attributes: {
                    where: eq(attributeValues.isDeleted, false),
                },
                entityType: {
                    with: {
                        attributeDefinitions: {
                            where: eq(attributeDefinitions.isDeleted, false),
                        },
                    },
                },
            },
        });

        if (!entityForValidation) {
            throw new Error(`Entity with id ${entity.id} not found.`);
        }

        const completeness = getEntityCompleteness(
            entityForValidation,
            entityForValidation.entityType.attributeDefinitions,
        );
        if (!completeness.isComplete) {
            const missingFields = completeness.missingRequiredDefinitions
                .map((definition) => definition.label)
                .join(', ');
            throw new Error(
                `Entity is not ready for publishing. Fill required fields: ${missingFields}.`,
            );
        }

        await assertPlantHealthIssueReferencesCanPublish(entityForValidation);

        updateData.publishedAt = new Date();
    }

    const previousPlantHealthTargetIds = isPlantHealthIssueEntityTypeName(
        previousEntity.entityTypeName,
    )
        ? plantHealthAffectedPlantIdsForEntity(await getEntityRaw(entity.id))
        : [];

    await Promise.all([
        previousEntity
            ? storage()
                  .insert(entityRevisions)
                  .values({
                      entityId: entity.id,
                      entityTypeName:
                          entity.entityTypeName ??
                          previousEntity.entityTypeName,
                      action:
                          previousEntity.state !== updateData.state
                              ? 'entity.state_changed'
                              : 'entity.updated',
                      actorId: actor?.id,
                      actorName: actor?.name,
                      previousState: previousEntity.state,
                      nextState: updateData.state ?? previousEntity.state,
                  })
            : undefined,
        storage()
            .update(entities)
            .set(updateData)
            .where(eq(entities.id, entity.id)),
        bustCached(cacheKeys.entity(entity.id)),
        entity.id
            ? storage()
                  .select()
                  .from(entities)
                  .where(eq(entities.id, entity.id))
                  .then((entityToUpdate) => {
                      return Promise.all([
                          entityToUpdate?.[0].id
                              ? bustCached(
                                    cacheKeys.entity(entityToUpdate?.[0]?.id),
                                )
                              : undefined,
                          entityToUpdate?.[0].entityTypeName
                              ? bustCached(
                                    cacheKeys.entityTypeName(
                                        entityToUpdate?.[0].entityTypeName,
                                    ),
                                )
                              : undefined,
                      ]);
                  })
            : undefined,
        entity.entityTypeName
            ? bustCached(cacheKeys.entityTypeName(entity.entityTypeName))
            : null,
        isPlantHealthIssueEntityTypeName(
            entity.entityTypeName ?? previousEntity.entityTypeName,
        )
            ? Promise.all([
                  bustCached(cacheKeys.entityTypeName('plant')),
                  ...previousPlantHealthTargetIds.map((plantId) =>
                      bustCached(cacheKeys.entity(plantId)),
                  ),
              ])
            : null,
        bustCachedByPrefixes(['dashboard:admin:']),
    ]);

    await refreshEntitySearchDocumentAfterMutation(entity.id);
}

export async function deleteEntity(
    id: number,
    actor?: { id?: string; name?: string },
) {
    const entity = await getEntityRaw(id);
    if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
    }

    const plantHealthTargetIds = isPlantHealthIssueEntityTypeName(
        entity.entityTypeName,
    )
        ? plantHealthAffectedPlantIdsForEntity(entity)
        : [];

    await Promise.all([
        storage().insert(entityRevisions).values({
            entityId: id,
            entityTypeName: entity.entityTypeName,
            action: 'entity.deleted',
            actorId: actor?.id,
            actorName: actor?.name,
            previousState: entity.state,
            nextState: entity.state,
        }),
        storage()
            .update(entities)
            .set({ isDeleted: true })
            .where(eq(entities.id, id)),
        bustCached(cacheKeys.entity(id)),
        entity.entityTypeName
            ? bustCached(cacheKeys.entityTypeName(entity.entityTypeName))
            : null,
        isPlantHealthIssueEntityTypeName(entity.entityTypeName)
            ? Promise.all([
                  bustCached(cacheKeys.entityTypeName('plant')),
                  ...plantHealthTargetIds.map((plantId) =>
                      bustCached(cacheKeys.entity(plantId)),
                  ),
              ])
            : null,
        bustCachedByPrefixes(['dashboard:admin:']),
    ]);

    await refreshEntitySearchDocumentAfterMutation(id);
}

export async function getEntityRevisions(entityId: number) {
    return storage().query.entityRevisions.findMany({
        where: eq(entityRevisions.entityId, entityId),
        orderBy: (revisions, { desc }) => [
            desc(revisions.createdAt),
            desc(revisions.id),
        ],
    });
}

export async function getLatestEntityRevisions(
    limit = 100,
): Promise<LatestEntityRevision[]> {
    return storage().query.entityRevisions.findMany({
        columns: {
            id: true,
            entityId: true,
            entityTypeName: true,
            action: true,
            actorId: true,
            actorName: true,
            createdAt: true,
        },
        orderBy: (revisions, { desc }) => [
            desc(revisions.createdAt),
            desc(revisions.id),
        ],
        limit,
    });
}
