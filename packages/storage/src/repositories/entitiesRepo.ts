import 'server-only';
import { and, count, desc, eq, inArray, like } from 'drizzle-orm';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    type SelectEntity,
    type SelectEntityType,
    storage,
    type UpdateEntity,
} from '..';
import {
    bustCached,
    cacheKeys,
    directoriesCached,
} from '../cache/directoriesCached';

const entityCacheTtl = 60 * 60; // 1 hour

function populateMissingAttributes(
    entity: SelectEntity & {
        attributes: (SelectAttributeValue & {
            attributeDefinition: SelectAttributeDefinition;
        })[];
        entityType: SelectEntityType & {
            attributeDefinitions: SelectAttributeDefinition[];
        };
    },
) {
    // Create missing attributes that have default value based on entity type definitions
    for (const definition of entity.entityType.attributeDefinitions) {
        const hasAtleastOneAttributeValue = entity.attributes.some(
            (a) => a.attributeDefinition.id === definition.id && !a.isDeleted,
        );
        // If attribute is missing and we have default defined, create a default one
        if (
            !hasAtleastOneAttributeValue &&
            typeof definition.defaultValue !== 'undefined' &&
            definition.defaultValue !== null
        ) {
            entity.attributes.push({
                entityId: entity.id,
                entityTypeName: entity.entityType.name,
                attributeDefinitionId: definition.id,
                attributeDefinition: definition,
                value: definition.defaultValue ?? null,
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

    return rawEntities.map(populateMissingAttributes);
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
    attributes: (SelectAttributeValue & {
        attributeDefinition: SelectAttributeDefinition;
    })[];
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
            // Create array if it doesn't exist
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

            // When expanding to array, ignore the null values
            if (typeof result !== 'undefined' && result !== null) {
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
        return parseFloat(value);
    } else if (attributeDefinition.dataType === 'boolean') {
        return value === 'true';
    } else if (attributeDefinition.dataType.startsWith('json')) {
        if (!value) return null;
        return JSON.parse(value);
    } else if (attributeDefinition.dataType === 'image') {
        // Assuming the value is a URL or path to the image
        const data = JSON.parse(value) as unknown;
        let url = '';
        if (
            typeof data === 'object' &&
            data !== null &&
            'url' in data &&
            typeof data.url === 'string'
        ) {
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

// Update resolveRef to use the cache and correct types
async function resolveRef(
    value: string | null,
    attributeDefinition: SelectAttributeDefinition,
    cache: EntityTypeCache = {},
) {
    const refEntityTypeName = attributeDefinition.dataType.split(':')[1];
    if (!value) {
        return;
    }
    const refNames: string[] = [];
    if (attributeDefinition.multiple) {
        try {
            const parsedValue = JSON.parse(value);
            if (!Array.isArray(parsedValue)) {
                refNames.push(value);
            } else {
                for (const item of parsedValue) {
                    if (typeof item === 'string') {
                        refNames.push(item);
                    } else {
                        refNames.push(JSON.stringify(item));
                    }
                }
            }
        } catch {
            refNames.push(value);
        }
    } else {
        refNames.push(value);
    }

    // Use cache key based on entity type and state
    const cacheKey = `${refEntityTypeName}:published`;
    if (!cache[cacheKey]) {
        cache[cacheKey] = getEntitiesRaw(
            refEntityTypeName,
            'published',
        ) as Promise<EntityWithAttributesAndType[]>;
    }
    const refEntitiesByType = await cache[cacheKey];
    const refNameSet = new Set(refNames);
    const refEntities = refEntitiesByType.filter(
        (e: EntityWithAttributesAndType) =>
            e.attributes.some(
                (
                    a: SelectAttributeValue & {
                        attributeDefinition: SelectAttributeDefinition;
                    },
                ) =>
                    a.value != null &&
                    a.attributeDefinition.category === 'information' &&
                    a.attributeDefinition.name === 'name' &&
                    refNameSet.has(a.value),
            ),
    );

    if (attributeDefinition.multiple) {
        return await Promise.all(
            refEntities.map((ref) =>
                expandEntityAttributes(
                    {
                        id: ref.id,
                    },
                    ref.attributes,
                    cache,
                ),
            ),
        );
    } else {
        return refEntities[0]
            ? await expandEntityAttributes(
                  {
                      id: refEntities[0].id,
                  },
                  refEntities[0].attributes,
                  cache,
              )
            : null;
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
            return (await Promise.all(
                entities.map((e) => expandEntity(e, cache)),
            )) as T[];
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
            return (await expandEntity(entity, cache)) as T;
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

function escapeForLike(value: string) {
    return value.replace(/[\\%_]/g, '\\$&');
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

function attributeValueContainsEntityName(
    value: string | null,
    entityName: string,
    multiple: boolean,
) {
    if (!value) {
        return false;
    }
    if (!multiple) {
        return value === entityName;
    }

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return value === entityName;
        }

        return parsed.some((item) =>
            typeof item === 'string'
                ? item === entityName
                : JSON.stringify(item) === entityName,
        );
    } catch {
        return value === entityName;
    }
}

export async function getEntityIncomingLinks(
    entityId: number,
    sourceEntity?: NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>,
): Promise<IncomingEntityLinkGroup[]> {
    const entity = sourceEntity ?? (await getEntityRaw(entityId));
    if (!entity) {
        return [];
    }

    const entityName = entityNameFromAttributes(entity);
    if (!entityName) {
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
    const exactValueMatches = await storage().query.attributeValues.findMany({
        where: and(
            inArray(attributeValues.attributeDefinitionId, definitionIds),
            eq(attributeValues.isDeleted, false),
            eq(attributeValues.value, entityName),
        ),
    });

    const multipleDefinitionIds = refDefinitions
        .filter((definition) => definition.multiple)
        .map((definition) => definition.id);
    const linkAttributeValues = [...exactValueMatches];
    if (multipleDefinitionIds.length > 0) {
        const escapedJsonEncodedName = escapeForLike(
            JSON.stringify(entityName),
        );
        const legacyJsonArrayMatches =
            await storage().query.attributeValues.findMany({
                where: and(
                    inArray(
                        attributeValues.attributeDefinitionId,
                        multipleDefinitionIds,
                    ),
                    eq(attributeValues.isDeleted, false),
                    like(attributeValues.value, `%${escapedJsonEncodedName}%`),
                ),
            });

        const seenAttributeValueIds = new Set(
            linkAttributeValues.map((v) => v.id),
        );
        for (const legacyJsonArrayMatch of legacyJsonArrayMatches) {
            if (seenAttributeValueIds.has(legacyJsonArrayMatch.id)) {
                continue;
            }

            linkAttributeValues.push(legacyJsonArrayMatch);
            seenAttributeValueIds.add(legacyJsonArrayMatch.id);
        }
    }
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
        if (
            !attributeValueContainsEntityName(
                attributeValue.value,
                entityName,
                definition.multiple,
            )
        ) {
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

export async function createEntity(entityTypeName: string) {
    const [result] = await Promise.all([
        storage()
            .insert(entities)
            .values({ entityTypeName })
            .returning({ id: entities.id }),
        bustCached(cacheKeys.entityTypeName(entityTypeName)),
    ]);
    return result[0].id;
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
    ]);

    return newEntityId;
}

export async function updateEntity(entity: UpdateEntity) {
    const updateData = {
        ...entity,
    };

    if (updateData.state === 'published') {
        updateData.publishedAt = new Date();
    }

    await Promise.all([
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
    ]);
}

export async function deleteEntity(id: number) {
    const entity = await getEntityRaw(id);
    if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
    }

    await Promise.all([
        storage()
            .update(entities)
            .set({ isDeleted: true })
            .where(eq(entities.id, id)),
        bustCached(cacheKeys.entity(id)),
        entity.entityTypeName
            ? bustCached(cacheKeys.entityTypeName(entity.entityTypeName))
            : null,
    ]);
}
