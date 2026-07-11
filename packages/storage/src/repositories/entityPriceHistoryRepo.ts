import 'server-only';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { storage } from '..';
import {
    attributeDefinitions,
    entityRevisions,
    type SelectEntityRevision,
} from '../schema';

const DEFAULT_HISTORY_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type EntityPriceHistoryRequest = {
    key: string;
    entityId: number;
    entityTypeName: string;
    attributeCategory: string;
    attributeName: string;
    currentPrice: number;
};

export type EntityPriceHistorySummary = {
    lowestPrice: number;
    lastChangedAt: Date | null;
};

type PriceRevision = Pick<
    SelectEntityRevision,
    | 'entityId'
    | 'attributeDefinitionId'
    | 'action'
    | 'previousValue'
    | 'nextValue'
    | 'createdAt'
>;

function attributePath(entityTypeName: string, category: string, name: string) {
    return `${entityTypeName}:${category}.${name}`;
}

function revisionPath(entityId: number, attributeDefinitionId: number) {
    return `${entityId}:${attributeDefinitionId}`;
}

function parsePrice(value: string | null) {
    if (value === null || value.trim().length === 0) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isActualPriceChange(revision: PriceRevision) {
    if (revision.action !== 'attribute.updated') {
        return false;
    }

    const previousPrice = parsePrice(revision.previousValue);
    const nextPrice = parsePrice(revision.nextValue);
    return (
        previousPrice !== null &&
        nextPrice !== null &&
        previousPrice !== nextPrice
    );
}

export function summarizeEntityPriceHistory(
    request: EntityPriceHistoryRequest,
    attributeDefinitionId: number | undefined,
    revisions: ReadonlyArray<PriceRevision>,
): EntityPriceHistorySummary {
    if (attributeDefinitionId === undefined) {
        return {
            lowestPrice: request.currentPrice,
            lastChangedAt: null,
        };
    }

    const matchingRevisions = revisions.filter(
        (revision) =>
            revision.entityId === request.entityId &&
            revision.attributeDefinitionId === attributeDefinitionId,
    );
    const recordedPrices = matchingRevisions.flatMap((revision) =>
        [revision.previousValue, revision.nextValue]
            .map(parsePrice)
            .filter((price): price is number => price !== null),
    );
    const lastChange = matchingRevisions.find(isActualPriceChange);

    return {
        lowestPrice: Math.min(request.currentPrice, ...recordedPrices),
        lastChangedAt: lastChange?.createdAt ?? null,
    };
}

export async function getEntityPriceHistory(
    requests: ReadonlyArray<EntityPriceHistoryRequest>,
    options?: { now?: Date; historyDays?: number },
): Promise<Record<string, EntityPriceHistorySummary>> {
    if (requests.length === 0) {
        return {};
    }

    const now = options?.now ?? new Date();
    const historyDays = options?.historyDays ?? DEFAULT_HISTORY_DAYS;
    const since = new Date(now.getTime() - historyDays * MILLISECONDS_PER_DAY);
    const entityTypeNames = Array.from(
        new Set(requests.map((request) => request.entityTypeName)),
    );
    const categories = Array.from(
        new Set(requests.map((request) => request.attributeCategory)),
    );
    const names = Array.from(
        new Set(requests.map((request) => request.attributeName)),
    );

    const definitions = await storage()
        .select({
            id: attributeDefinitions.id,
            entityTypeName: attributeDefinitions.entityTypeName,
            category: attributeDefinitions.category,
            name: attributeDefinitions.name,
        })
        .from(attributeDefinitions)
        .where(
            and(
                inArray(attributeDefinitions.entityTypeName, entityTypeNames),
                inArray(attributeDefinitions.category, categories),
                inArray(attributeDefinitions.name, names),
                eq(attributeDefinitions.isDeleted, false),
            ),
        );
    const requestedPaths = new Set(
        requests.map((request) =>
            attributePath(
                request.entityTypeName,
                request.attributeCategory,
                request.attributeName,
            ),
        ),
    );
    const matchingDefinitions = definitions.filter((definition) =>
        requestedPaths.has(
            attributePath(
                definition.entityTypeName,
                definition.category,
                definition.name,
            ),
        ),
    );
    const definitionIds = matchingDefinitions.map(
        (definition) => definition.id,
    );
    const entityIds = Array.from(
        new Set(requests.map((request) => request.entityId)),
    );
    const revisions =
        definitionIds.length === 0
            ? []
            : await storage()
                  .select({
                      entityId: entityRevisions.entityId,
                      attributeDefinitionId:
                          entityRevisions.attributeDefinitionId,
                      action: entityRevisions.action,
                      previousValue: entityRevisions.previousValue,
                      nextValue: entityRevisions.nextValue,
                      createdAt: entityRevisions.createdAt,
                  })
                  .from(entityRevisions)
                  .where(
                      and(
                          inArray(entityRevisions.entityId, entityIds),
                          inArray(
                              entityRevisions.attributeDefinitionId,
                              definitionIds,
                          ),
                          gte(entityRevisions.createdAt, since),
                      ),
                  )
                  .orderBy(
                      desc(entityRevisions.createdAt),
                      desc(entityRevisions.id),
                  );
    const definitionIdsByPath = new Map(
        matchingDefinitions.map((definition) => [
            attributePath(
                definition.entityTypeName,
                definition.category,
                definition.name,
            ),
            definition.id,
        ]),
    );
    const revisionsByPath = new Map<string, PriceRevision[]>();

    for (const revision of revisions) {
        if (revision.attributeDefinitionId === null) {
            continue;
        }
        const path = revisionPath(
            revision.entityId,
            revision.attributeDefinitionId,
        );
        const pathRevisions = revisionsByPath.get(path) ?? [];
        pathRevisions.push(revision);
        revisionsByPath.set(path, pathRevisions);
    }

    return Object.fromEntries(
        requests.map((request) => {
            const definitionId = definitionIdsByPath.get(
                attributePath(
                    request.entityTypeName,
                    request.attributeCategory,
                    request.attributeName,
                ),
            );
            const requestRevisions =
                definitionId === undefined
                    ? []
                    : (revisionsByPath.get(
                          revisionPath(request.entityId, definitionId),
                      ) ?? []);

            return [
                request.key,
                summarizeEntityPriceHistory(
                    request,
                    definitionId,
                    requestRevisions,
                ),
            ];
        }),
    );
}
