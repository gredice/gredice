import 'server-only';
import { and, desc, eq } from "drizzle-orm";
import {
    attributeValues,
    entities,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    type SelectEntity,
    type SelectEntityType,
    storage,
    type UpdateEntity
} from "..";
import { bustCached, cacheKeys, directoriesCached } from '../cache/directoriesCached';

export function getEntitiesRaw(entityTypeName: string, state?: string) {
    return storage().query.entities.findMany({
        where: state
            ? and(eq(entities.entityTypeName, entityTypeName), eq(entities.state, state), eq(entities.isDeleted, false))
            : and(eq(entities.entityTypeName, entityTypeName), eq(entities.isDeleted, false)),
        orderBy: desc(entities.updatedAt),
        with: {
            attributes: {
                where: eq(entities.isDeleted, false),
                with: {
                    attributeDefinition: true
                }
            },
            entityType: true
        }
    });
}

// Add a type for the cache, ensuring attributes and entityType are included
interface EntityWithAttributesAndType extends SelectEntity {
    attributes: (SelectAttributeValue & { attributeDefinition: SelectAttributeDefinition })[];
    entityType: SelectEntityType;
}
interface EntityTypeCache {
    [key: string]: Promise<EntityWithAttributesAndType[]>;
}

// Update expandEntity to accept a cache
async function expandEntity(
    entityRaw: EntityWithAttributesAndType | undefined,
    cache: EntityTypeCache = {}
) {
    if (!entityRaw) {
        return null;
    }

    const entity: {
        id: number,
        entityType: {
            id: number,
            name: string,
            label: string,
        },
        createdAt: Date,
        updatedAt: Date,
        [key: string]: unknown
    } = {
        id: entityRaw.id,
        entityType: {
            id: entityRaw.entityType.id,
            name: entityRaw.entityType.name,
            label: entityRaw.entityType.label,
        },
        createdAt: entityRaw.createdAt,
        updatedAt: entityRaw.updatedAt
    };
    return await expandEntityAttributes(entity, entityRaw.attributes, cache);
}

// Update expandEntityAttributes to accept a cache
async function expandEntityAttributes<T extends Record<string, unknown>>(
    entity: T,
    attributes: (SelectAttributeValue & { attributeDefinition: SelectAttributeDefinition })[],
    cache: EntityTypeCache = {}
) {
    const expandedEntity = { ...entity };
    // Prepare all attribute expansion promises
    const attributePromises = attributes.map(async (attribute) => {
        // Create category object if it doesn't exist
        if (expandedEntity[attribute.attributeDefinition.category] === undefined) {
            (expandedEntity as Record<string, unknown>)[attribute.attributeDefinition.category] = {};
        }
        const category = expandedEntity[attribute.attributeDefinition.category] as Record<string, unknown>;
        if (attribute.attributeDefinition.multiple) {
            // Create array if it doesn't exist
            if (category[attribute.attributeDefinition.name] === undefined) {
                category[attribute.attributeDefinition.name] = [];
            }
            const array = category[attribute.attributeDefinition.name] as unknown[];
            const result = await expandValue(attribute.value, attribute.attributeDefinition, cache);
            if (Array.isArray(result)) {
                array.push(...result);
            } else {
                array.push(result);
            }
        } else {
            category[attribute.attributeDefinition.name] = await expandValue(attribute.value, attribute.attributeDefinition, cache);
        }
    });
    await Promise.all(attributePromises);
    return expandedEntity;
}

// Update expandValue to accept a cache
async function expandValue(
    value: string | null | undefined,
    attributeDefinition: SelectAttributeDefinition,
    cache: EntityTypeCache = {}
) {
    if (value === null || value === undefined) {
        return null;
    }

    if (attributeDefinition.dataType.startsWith('ref:')) {
        return await resolveRef(value, attributeDefinition, cache);
    }
    if (attributeDefinition.dataType === 'number') {
        return parseFloat(value);
    }
    else if (attributeDefinition.dataType === 'boolean') {
        return value === 'true';
    }
    else if (attributeDefinition.dataType.startsWith('json')) {
        return JSON.parse(value);
    }
    else if (attributeDefinition.dataType === 'image') {
        // Assuming the value is a URL or path to the image
        const data = JSON.parse(value) as unknown;
        let url = '';
        if (typeof data === 'object' && data !== null && 'url' in data && typeof data.url === 'string') {
            url = data.url;
        }
        return {
            url,
            // TODO: Alt, image size, etc. can be added here
        } as const;
    }
    else {
        return value;
    }
}

// Update resolveRef to use the cache and correct types
async function resolveRef(
    value: string | null,
    attributeDefinition: SelectAttributeDefinition,
    cache: EntityTypeCache = {}
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
        cache[cacheKey] = getEntitiesRaw(refEntityTypeName, 'published') as Promise<EntityWithAttributesAndType[]>;
    }
    const refEntitiesByType = await cache[cacheKey];
    const refNameSet = new Set(refNames);
    const refEntities = refEntitiesByType.filter((e: EntityWithAttributesAndType) =>
        e.attributes.some((a: SelectAttributeValue & { attributeDefinition: SelectAttributeDefinition }) =>
            a.value != null &&
            a.attributeDefinition.category === 'information' &&
            a.attributeDefinition.name === 'name' &&
            refNameSet.has(a.value))
    );

    if (attributeDefinition.multiple) {
        return await Promise.all(refEntities.map(ref => expandEntityAttributes({
            id: ref.id,
        }, ref.attributes, cache)));
    } else {
        return refEntities[0] ? await expandEntityAttributes({
            id: refEntities[0].id,
        }, refEntities[0].attributes, cache) : null;
    }
}

export async function getEntitiesFormatted<T extends unknown>(entityTypeName: string) {
    return directoriesCached(cacheKeys.entityTypeName(entityTypeName), async () => {
        const cache: EntityTypeCache = {};
        const entities = await getEntitiesRaw(entityTypeName, 'published') as EntityWithAttributesAndType[];
        return await Promise.all(entities.map(e => expandEntity(e, cache))) as T[];
    }, 60 * 60);
}

export async function getEntityFormatted<T extends unknown>(id: number) {
    return directoriesCached(cacheKeys.entity(id), async () => {
        const cache: EntityTypeCache = {};
        const entity = await getEntityRaw(id) as EntityWithAttributesAndType | undefined;
        return await expandEntity(entity, cache) as T;
    }, 60 * 60);
}

export async function getEntityRaw(id: number) {
    return storage().query.entities.findFirst({
        where: and(eq(entities.id, id), eq(entities.isDeleted, false)),
        with: {
            attributes: {
                where: eq(entities.isDeleted, false),
                with: {
                    attributeDefinition: true
                }
            },
            entityType: true
        }
    });
}

export async function createEntity(entityTypeName: string) {
    const [result] = await Promise.all([
        storage()
            .insert(entities)
            .values({ entityTypeName })
            .returning({ id: entities.id }),
        bustCached(cacheKeys.entityTypeName(entityTypeName))
    ]);
    return result[0].id;
}

export async function duplicateEntity(id: number) {
    const entity = await getEntityRaw(id);
    if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
    }

    const newEntityId = await createEntity(entity.entityTypeName);
    const newAttributes = entity.attributes.map(attr => ({
        entityId: newEntityId,
        entityTypeName: entity.entityTypeName,
        attributeDefinitionId: attr.attributeDefinition.id,
        value: attr.value,
        order: attr.order,
    }));

    await Promise.all([
        storage()
            .insert(attributeValues)
            .values(newAttributes),
        bustCached(cacheKeys.entityTypeName(entity.entityTypeName)),
        bustCached(cacheKeys.entity(newEntityId))
    ]);

    return newEntityId;
}

export async function updateEntity(entity: UpdateEntity) {
    const updateData = {
        ...entity
    };

    if (updateData.state === 'published') {
        updateData.publishedAt = new Date();
    }

    await Promise.all([
        storage()
            .update(entities)
            .set(entity)
            .where(eq(entities.id, entity.id)),
        bustCached(cacheKeys.entity(entity.id)),
        entity.id ? storage().select().from(entities).where(eq(entities.id, entity.id)).then(
            entityToUpdate => {
                return Promise.all([
                    entityToUpdate?.[0].id ? bustCached(cacheKeys.entity(entityToUpdate?.[0]?.id)) : undefined,
                    entityToUpdate?.[0].entityTypeName ? bustCached(cacheKeys.entityTypeName(entityToUpdate?.[0].entityTypeName)) : undefined
                ]);
            }
        ) : undefined,
        entity.entityTypeName ? bustCached(cacheKeys.entityTypeName(entity.entityTypeName)) : null
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
        entity.entityTypeName ? bustCached(cacheKeys.entityTypeName(entity.entityTypeName)) : null
    ]);
}
