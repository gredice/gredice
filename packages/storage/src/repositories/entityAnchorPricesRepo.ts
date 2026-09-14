import 'server-only';
import type { AnchorPrice } from '@gredice/js/pricing';
import { and, desc, eq, inArray, lte, or } from 'drizzle-orm';
import { storage } from '..';
import {
    anchorDateCutoff,
    resolveEntityAnchorPrice,
} from '../helpers/entityAnchorPrice';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityRevisions,
} from '../schema';
import type { EntityPriceHistoryRequest } from './entityPriceHistoryRepo';

export async function getEntityAnchorPrices(
    requests: ReadonlyArray<EntityPriceHistoryRequest>,
    date: string,
    now = new Date(),
): Promise<Record<string, AnchorPrice | null>> {
    anchorDateCutoff(date);
    if (requests.length === 0) return {};
    const entityIds = [...new Set(requests.map((request) => request.entityId))];
    const [values, revisions, entityRows] = await Promise.all([
        storage()
            .select({
                entityId: attributeValues.entityId,
                definitionId: attributeDefinitions.id,
                entityTypeName: attributeDefinitions.entityTypeName,
                category: attributeDefinitions.category,
                name: attributeDefinitions.name,
                value: attributeValues.value,
                createdAt: attributeValues.createdAt,
                updatedAt: attributeValues.updatedAt,
            })
            .from(attributeValues)
            .innerJoin(
                attributeDefinitions,
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitions.id,
                ),
            )
            .where(
                and(
                    inArray(attributeValues.entityId, entityIds),
                    inArray(attributeDefinitions.category, [
                        ...new Set(requests.map((r) => r.attributeCategory)),
                    ]),
                    inArray(attributeDefinitions.name, [
                        ...new Set(requests.map((r) => r.attributeName)),
                    ]),
                    eq(attributeValues.isDeleted, false),
                    eq(attributeDefinitions.isDeleted, false),
                ),
            ),
        storage()
            .select({
                entityId: entityRevisions.entityId,
                definitionId: entityRevisions.attributeDefinitionId,
                category: attributeDefinitions.category,
                name: attributeDefinitions.name,
                action: entityRevisions.action,
                previousValue: entityRevisions.previousValue,
                nextValue: entityRevisions.nextValue,
                previousState: entityRevisions.previousState,
                nextState: entityRevisions.nextState,
                createdAt: entityRevisions.createdAt,
            })
            .from(entityRevisions)
            .leftJoin(
                attributeDefinitions,
                eq(
                    entityRevisions.attributeDefinitionId,
                    attributeDefinitions.id,
                ),
            )
            .where(
                and(
                    inArray(entityRevisions.entityId, entityIds),
                    lte(entityRevisions.createdAt, now),
                    or(
                        inArray(entityRevisions.action, [
                            'entity.state_changed',
                            'entity.updated',
                        ]),
                        and(
                            inArray(attributeDefinitions.category, [
                                ...new Set(
                                    requests.map((r) => r.attributeCategory),
                                ),
                            ]),
                            inArray(attributeDefinitions.name, [
                                ...new Set(
                                    requests.map((r) => r.attributeName),
                                ),
                            ]),
                        ),
                    ),
                ),
            )
            .orderBy(desc(entityRevisions.createdAt), desc(entityRevisions.id)),
        storage()
            .select({
                id: entities.id,
                createdAt: entities.createdAt,
                updatedAt: entities.updatedAt,
                publishedAt: entities.publishedAt,
                state: entities.state,
            })
            .from(entities)
            .where(inArray(entities.id, entityIds)),
    ]);

    return Object.fromEntries(
        requests.map((request) => {
            const entity = entityRows.find(
                (row) => row.id === request.entityId,
            );
            const matchingValues = values.filter(
                (row) =>
                    row.entityId === request.entityId &&
                    row.entityTypeName === request.entityTypeName &&
                    row.category === request.attributeCategory &&
                    row.name === request.attributeName,
            );
            // Multiple prices under one attribute are ambiguous, not evidence.
            if (!entity || matchingValues.length > 1)
                return [request.key, null];
            const value = matchingValues[0];
            return [
                request.key,
                resolveEntityAnchorPrice({
                    date,
                    now,
                    entity,
                    value,
                    revisions: revisions.filter(
                        (row) =>
                            row.entityId === request.entityId &&
                            ([
                                'entity.state_changed',
                                'entity.updated',
                            ].includes(row.action) ||
                                (row.category === request.attributeCategory &&
                                    row.name === request.attributeName &&
                                    (!value ||
                                        row.definitionId ===
                                            value.definitionId))),
                    ),
                }),
            ];
        }),
    );
}
