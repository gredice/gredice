import { getEntitiesRaw } from "@gredice/storage";

export function entityDisplayName(entity: Awaited<ReturnType<typeof getEntitiesRaw>>[0]) {
    return entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
}

export function entityAttributeValue(entity: Awaited<ReturnType<typeof getEntitiesRaw>>[0], categoryName: string, attributeName: string) {
    return entity.attributes.find(a => a.attributeDefinition.category === categoryName && a.attributeDefinition.name === attributeName)?.value;
}