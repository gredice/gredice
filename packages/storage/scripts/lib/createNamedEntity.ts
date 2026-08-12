import {
    createAttributeValueMutationSideEffects,
    entities,
    entityRevisions,
    flushAttributeValueMutationSideEffects,
    type SelectAttributeDefinition,
    storage,
    upsertAttributeValue,
} from '../../src';

type MutationActor = {
    id?: string;
    name?: string;
};

export async function createNamedEntity({
    actor,
    entityTypeName,
    name,
    nameDefinition,
}: {
    actor?: MutationActor;
    entityTypeName: string;
    name: string;
    nameDefinition: Pick<SelectAttributeDefinition, 'id' | 'order'>;
}) {
    const sideEffects = createAttributeValueMutationSideEffects();
    const entityId = await storage().transaction(async (transaction) => {
        const [createdEntity] = await transaction
            .insert(entities)
            .values({ entityTypeName })
            .returning({ id: entities.id });

        await transaction.insert(entityRevisions).values({
            entityId: createdEntity.id,
            entityTypeName,
            action: 'entity.created',
            actorId: actor?.id,
            actorName: actor?.name,
        });

        await upsertAttributeValue(
            {
                attributeDefinitionId: nameDefinition.id,
                entityId: createdEntity.id,
                entityTypeName,
                order: nameDefinition.order,
                value: name,
            },
            actor,
            {
                db: transaction,
                sideEffects,
            },
        );

        return createdEntity.id;
    });

    // Flush only after commit. If this fails, the entity is still discoverable
    // by its durable name and a retry can safely update it.
    await flushAttributeValueMutationSideEffects(sideEffects);

    return entityId;
}
