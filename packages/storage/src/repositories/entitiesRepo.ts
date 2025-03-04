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

export function getEntitiesRaw(entityTypeName: string, state?: string) {
    return storage.query.entities.findMany({
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

export async function getEntitiesFormatted<T>(entityTypeName: string) {
    const entities = await getEntitiesRaw(entityTypeName, 'published');
    return entities.map(expandEntity) as T[];
}

function expandValue(value: string | null | undefined, attributeDefinition: SelectAttributeDefinition) {
    if (value === null || value === undefined) {
        return null;
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
    else {
        return value;
    }
}

function expandEntity(entityRaw: SelectEntity & { entityType: SelectEntityType, attributes: (SelectAttributeValue & { attributeDefinition: SelectAttributeDefinition })[] } | undefined) {
    if (!entityRaw) {
        return null;
    }

    // Expand attributes to entity object
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
    entityRaw.attributes.forEach(attribute => {
        // Create category object if it doesn't exist
        if (entity[attribute.attributeDefinition.category] === undefined) {
            entity[attribute.attributeDefinition.category] = {};
        }
        const category = entity[attribute.attributeDefinition.category] as Record<string, unknown>;

        if (attribute.attributeDefinition.multiple) {
            // Create array if it doesn't exist
            if (category[attribute.attributeDefinition.name] === undefined) {
                category[attribute.attributeDefinition.name] = [];
            }
            const array = category[attribute.attributeDefinition.name] as unknown[];
            array.push(expandValue(attribute.value, attribute.attributeDefinition));
            return;
        } else {
            category[attribute.attributeDefinition.name] = expandValue(attribute.value, attribute.attributeDefinition);
        }
    });

    return entity;
}

export async function getEntityFormatted(id: number) {
    const entityRaw = await getEntityRaw(id);
    return expandEntity(entityRaw);
}

export function getEntityRaw(id: number) {
    return storage.query.entities.findFirst({
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
    const result = await storage
        .insert(entities)
        .values({ entityTypeName })
        .returning({ id: entities.id });
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

    await storage
        .insert(attributeValues)
        .values(newAttributes);

    return newEntityId;
}

export async function updateEntity(entity: UpdateEntity) {
    const updateData = {
        ...entity
    };

    if (updateData.state === 'published') {
        updateData.publishedAt = new Date();
    }

    await storage
        .update(entities)
        .set(entity)
        .where(eq(entities.id, entity.id));
}

export function deleteEntity(id: number) {
    return storage
        .update(entities)
        .set({ isDeleted: true })
        .where(eq(entities.id, id));
}
