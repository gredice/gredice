import { getEntitiesRaw, getEntityDisplayLabels } from '@gredice/storage';

type InventoryEntity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];

/**
 * Builds display labels for every entity an inventory references.
 *
 * Live entities are labelled from the directory as usual. Items whose entity
 * was deleted keep their last known name so an orphaned row stays readable in
 * the admin list and on the printout instead of falling back to a bare id.
 */
export async function getInventoryEntityLabels(
    entityTypeName: string,
    entityIds: (number | null)[],
) {
    const entities = await getEntitiesRaw(entityTypeName);
    const labels = new Map(
        entities.map((entity) => [entity.id, entityDisplayName(entity)]),
    );

    const unlabelledEntityIds = [
        ...new Set(
            entityIds.filter(
                (entityId): entityId is number =>
                    entityId !== null && !labels.has(entityId),
            ),
        ),
    ];
    if (unlabelledEntityIds.length > 0) {
        const deletedEntities =
            await getEntityDisplayLabels(unlabelledEntityIds);
        for (const entity of deletedEntities) {
            labels.set(entity.id, entity.label);
        }
    }

    return labels;
}

function entityDisplayName(entity: InventoryEntity) {
    return (
        entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValue(
    entity: InventoryEntity,
    categoryName: string,
    attributeName: string,
) {
    return entity.attributes.find(
        (attribute) =>
            attribute.attributeDefinition.category === categoryName &&
            attribute.attributeDefinition.name === attributeName,
    )?.value;
}
