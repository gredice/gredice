import { and, eq, inArray, sql } from 'drizzle-orm';
import {
    attributeValues,
    createAttributeValueMutationSideEffects,
    entities,
    flushAttributeValueMutationSideEffects,
    gardenBlocks,
    type SelectAttributeDefinition,
    storage,
    upsertAttributeValue,
} from '../../src';

type MutationActor = {
    id?: string;
    name?: string;
};

/**
 * Renames a block's durable catalogue identity while preserving its entity ID.
 * Existing placed blocks store the technical name directly, so those rows must
 * move in the same transaction as information.name.
 */
export async function renameBlockEntityAndPlacements({
    actor,
    entityId,
    entityTypeName,
    fromName,
    nameDefinition,
    toName,
}: {
    actor?: MutationActor;
    entityId: number;
    entityTypeName: string;
    fromName: string;
    nameDefinition: Pick<SelectAttributeDefinition, 'id' | 'order'>;
    toName: string;
}) {
    if (fromName === toName) {
        throw new Error('Block rename source and target names must differ.');
    }

    const sideEffects = createAttributeValueMutationSideEffects();
    const result = await storage().transaction(async (transaction) => {
        // Serialize retries of this specific rename so the duplicate guard and
        // mutation observe one stable catalogue state.
        await transaction.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`entity-rename:${entityTypeName}:${fromName}:${toName}`}))`,
        );

        const nameOwners = await transaction
            .select({
                attributeValueId: attributeValues.id,
                entityId: entities.id,
                value: attributeValues.value,
            })
            .from(entities)
            .innerJoin(
                attributeValues,
                eq(attributeValues.entityId, entities.id),
            )
            .where(
                and(
                    eq(entities.entityTypeName, entityTypeName),
                    eq(entities.isDeleted, false),
                    eq(attributeValues.isDeleted, false),
                    eq(
                        attributeValues.attributeDefinitionId,
                        nameDefinition.id,
                    ),
                    inArray(attributeValues.value, [fromName, toName]),
                ),
            );

        const conflictingTarget = nameOwners.find(
            (owner) => owner.value === toName && owner.entityId !== entityId,
        );
        if (conflictingTarget) {
            throw new Error(
                `Cannot rename block entity ${entityId.toString()} from ${fromName} to ${toName}: target belongs to entity ${conflictingTarget.entityId.toString()}.`,
            );
        }

        const entityNameValues = nameOwners.filter(
            (owner) => owner.entityId === entityId,
        );
        if (entityNameValues.length !== 1) {
            throw new Error(
                `Expected exactly one active source or target name for block entity ${entityId.toString()}, found ${entityNameValues.length.toString()}.`,
            );
        }

        const [entityNameValue] = entityNameValues;
        const renamedAttribute = entityNameValue.value === fromName;
        if (!renamedAttribute && entityNameValue.value !== toName) {
            throw new Error(
                `Block entity ${entityId.toString()} has unexpected name ${entityNameValue.value}.`,
            );
        }

        if (renamedAttribute) {
            await upsertAttributeValue(
                {
                    id: entityNameValue.attributeValueId,
                    attributeDefinitionId: nameDefinition.id,
                    entityId,
                    entityTypeName,
                    order: nameDefinition.order,
                    value: toName,
                },
                actor,
                {
                    db: transaction,
                    sideEffects,
                },
            );
        }

        const renamedPlacements = await transaction
            .update(gardenBlocks)
            .set({ name: toName })
            .where(eq(gardenBlocks.name, fromName))
            .returning({ id: gardenBlocks.id });

        return {
            renamedAttribute,
            renamedGardenBlocks: renamedPlacements.length,
        };
    });

    await flushAttributeValueMutationSideEffects(sideEffects);

    return result;
}
