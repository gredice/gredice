import { and, eq, sql } from 'drizzle-orm';
import { knownEventTypes } from '../repositories/events';
import {
    acquireScheduleTaskAdvisoryLock,
    type ScheduleTaskTransaction,
} from '../repositories/scheduleTaskTransactionsRepo';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    events,
} from '../schema';

const operationName = 'raisedBedObservation';

export async function hasRaisedBedObservationReceipt(
    operationId: number,
    entityId: number,
    tx: ScheduleTaskTransaction,
) {
    const [receipt] = await tx
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                eq(events.type, knownEventTypes.operations.observationRecorded),
                eq(events.aggregateId, String(operationId)),
                sql`${events.data} ->> 'entityId' = ${String(entityId)}`,
            ),
        )
        .limit(1);
    return receipt !== undefined;
}
const defaults = {
    'information.name': operationName,
    'information.label': 'Opažanje',
    'attributes.application': 'plant',
    'attributes.internal': 'true',
    'attributes.appliesToAllTargets': 'false',
    'attributes.deliverable': 'false',
    'attributes.duration': '0',
    'conditions.completionAttachImages': 'true',
    'conditions.completionAttachImagesRequired': 'false',
    'conditions.completionAttachNotes': 'true',
    'conditions.completionAttachNotesRequired': 'false',
};

/** Provision the internal catalogue entry atomically with the first observation. */
export async function ensureRaisedBedObservationOperation(
    tx: ScheduleTaskTransaction,
) {
    await acquireScheduleTaskAdvisoryLock(tx, `catalogue:${operationName}`);
    const definitions = await tx
        .select()
        .from(attributeDefinitions)
        .where(
            and(
                eq(attributeDefinitions.entityTypeName, 'operation'),
                eq(attributeDefinitions.isDeleted, false),
            ),
        );
    const byPath = new Map(
        definitions.map((definition) => [
            `${definition.category}.${definition.name}`,
            definition,
        ]),
    );
    const nameDefinition = byPath.get('information.name');
    if (!nameDefinition)
        throw new Error(
            'Observation operation catalogue definitions are unavailable.',
        );
    const existing = await tx
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, 'operation'),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, operationName),
            ),
        );
    if (existing.length > 1)
        throw new Error(
            'Observation operation catalogue identity is ambiguous.',
        );
    if (existing[0]) return { id: existing[0].id, created: false };
    const attributes = Object.entries(defaults).map(([path, value]) => {
        const definition = byPath.get(path);
        if (!definition)
            throw new Error(`Missing observation operation attribute: ${path}`);
        return {
            attributeDefinitionId: definition.id,
            entityTypeName: 'operation',
            value,
        };
    });
    const [entity] = await tx
        .insert(entities)
        .values({
            entityTypeName: 'operation',
            state: 'published',
            publishedAt: new Date(),
        })
        .returning({ id: entities.id });
    if (!entity)
        throw new Error(
            'Observation operation catalogue entry was not created.',
        );
    await tx.insert(attributeValues).values(
        attributes.map((attribute) => ({
            ...attribute,
            entityId: entity.id,
        })),
    );
    return { id: entity.id, created: true };
}
