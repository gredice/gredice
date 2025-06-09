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

export async function getEntitiesFormatted(entityTypeName: string) {
    const entities = await getEntitiesRaw(entityTypeName, 'published');
    return await Promise.all(entities.map(expandEntity));
}

async function expandValue(value: string | null | undefined, attributeDefinition: SelectAttributeDefinition) {
    if (value === null || value === undefined) {
        return null;
    }

    if (attributeDefinition.dataType.startsWith('ref:')) {
        return await resolveRef(value, attributeDefinition);
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

async function expandEntityAttributes<T extends Record<string, unknown>>(entity: T, attributes: (SelectAttributeValue & { attributeDefinition: SelectAttributeDefinition })[]) {
    const expandedEntity = { ...entity };
    for (const key in attributes) {
        const attribute = attributes[key];

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
            const result = await expandValue(attribute.value, attribute.attributeDefinition);
            if (Array.isArray(result)) {
                array.push(...result);
            } else {
                array.push(result);
            }
        } else {
            category[attribute.attributeDefinition.name] = await expandValue(attribute.value, attribute.attributeDefinition);
        }
    };
    return expandedEntity;
}

async function expandEntity(
    entityRaw: SelectEntity & {
        entityType: SelectEntityType,
        attributes: (SelectAttributeValue & { attributeDefinition: SelectAttributeDefinition })[]
    } | undefined,
) {
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
    return await expandEntityAttributes(entity, entityRaw.attributes);
}

async function resolveRef(value: string | null, attributeDefinition: SelectAttributeDefinition) {
    const refEntityTypeName = attributeDefinition.dataType.split(':')[1];
    if (!value) {
        return;
    }
    const refNames: string[] = [];
    if (attributeDefinition.multiple) {
        try {
            // If the value is a JSON string, parse it
            const parsedValue = JSON.parse(value);
            if (!Array.isArray(parsedValue)) {
                refNames.push(value);
            } else {
                // If it's an array, push each item to refNames
                for (const item of parsedValue) {
                    if (typeof item === 'string') {
                        refNames.push(item);
                    } else {
                        // If the item is not a string, treat it as a single string
                        refNames.push(JSON.stringify(item));
                    }
                }
            }
        } catch {
            // If parsing fails, treat the value as a single string
            refNames.push(value);
        }
    } else {
        refNames.push(value);
    }

    // Get all entities of the referenced type
    // and filter them by the names in the attribute value
    const refEntitiesByType = await getEntitiesRaw(refEntityTypeName, 'published');
    const refEntities = refEntitiesByType.filter(e =>
        e.attributes.some(a =>
            a.value != null &&
            a.attributeDefinition.category === 'information' &&
            a.attributeDefinition.name === 'name' &&
            refNames.includes(a.value))
    );

    if (attributeDefinition.multiple) {
        return await Promise.all(refEntities.map(ref => expandEntityAttributes({
            id: ref.id,
        }, ref.attributes)));
    } else {
        return refEntities[0] ? await expandEntityAttributes({
            id: refEntities[0].id,
        }, refEntities[0].attributes) : null;
    }
}

export async function getEntityFormatted(id: number) {
    const entityRaw = await getEntityRaw(id);
    return await expandEntity(entityRaw);
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
    const result = await storage()
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

    await storage()
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

    await storage()
        .update(entities)
        .set(entity)
        .where(eq(entities.id, entity.id));
}

export function deleteEntity(id: number) {
    return storage()
        .update(entities)
        .set({ isDeleted: true })
        .where(eq(entities.id, id));
}
