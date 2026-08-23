import 'server-only';

import {
    getAttributeDefinition,
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityTypeByName,
    getInventoryConfigByEntityTypeName,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { filterEntitiesByCompletionAndState } from '@gredice/storage/entityCompleteness';
import { defaultDirectoryEntityListSort } from './directoryEntityListConfig';
import type {
    DirectoryAttributeDefinition,
    DirectoryEntityFilterOption,
    DirectoryEntityInventoryItem,
    DirectoryEntityListEntity,
    DirectoryEntityListPage,
    DirectoryEntityListSort,
    DirectoryEntityListSortDirection,
    DirectoryEntityListSortKey,
} from './directoryEntityListTypes';
import { aggregateRelatedInventoryItems } from './inventoryDisplay';

type RawEntities = Awaited<ReturnType<typeof getEntitiesRaw>>;
type RawEntity = RawEntities[number];

type DirectoryEntityListBaseContext = {
    attributeDefinitions: DirectoryAttributeDefinition[];
    inventoryItems: DirectoryEntityInventoryItem[];
    showInventoryColumn: boolean;
    inventoryLowCountThreshold: number | null;
    inventoryLinkConfig: { id: number } | undefined;
};

export type DirectoryEntityListContext = DirectoryEntityListBaseContext & {
    refLabelsByDefinitionId: Record<number, Record<string, string>>;
    operationFilterOptions: DirectoryEntityFilterOption[];
};

export const directoryEntityListPageSize = 40;
const maxDirectoryEntityListPageSize = 100;

export function parseDirectoryEntityOperationIds(value: string | undefined) {
    if (!value) {
        return [];
    }

    return value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => /^\d+$/.test(part))
        .map((part) => Number.parseInt(part, 10));
}

export function normalizeDirectoryEntitySortDirection(
    value: string | null,
): DirectoryEntityListSortDirection {
    return value === 'asc' ? 'asc' : 'desc';
}

export function normalizeDirectoryEntitySortKey(
    value: string | null,
): DirectoryEntityListSortKey {
    if (value === 'name' || value === 'inventory' || value === 'updatedAt') {
        return value;
    }

    if (value?.startsWith('attribute:')) {
        const definitionId = Number(value.slice('attribute:'.length));
        if (Number.isInteger(definitionId) && definitionId > 0) {
            return `attribute:${definitionId}`;
        }
    }

    return defaultDirectoryEntityListSort.key;
}

function normalizeLimit(limit: number | undefined) {
    if (!limit || !Number.isFinite(limit)) {
        return directoryEntityListPageSize;
    }

    return Math.min(
        Math.max(Math.trunc(limit), 1),
        maxDirectoryEntityListPageSize,
    );
}

function serializeAttributeDefinition(definition: {
    id: number;
    category: string;
    name: string;
    label: string;
    entityTypeName: string;
    dataType: string;
    defaultValue: string | null;
    unit: string | null;
    required: boolean;
    display: boolean;
}): DirectoryAttributeDefinition {
    return {
        id: definition.id,
        category: definition.category,
        name: definition.name,
        label: definition.label,
        entityTypeName: definition.entityTypeName,
        dataType: definition.dataType,
        defaultValue: definition.defaultValue,
        unit: definition.unit,
        required: definition.required,
        display: definition.display,
    };
}

function serializeEntity(entity: RawEntity): DirectoryEntityListEntity {
    return {
        id: entity.id,
        entityTypeName: entity.entityTypeName,
        state: entity.state,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        publishedAt: entity.publishedAt?.toISOString() ?? null,
        entityType: {
            name: entity.entityType.name,
            label: entity.entityType.label,
        },
        attributes: entity.attributes.map((attribute) => ({
            attributeDefinitionId: attribute.attributeDefinitionId,
            value: attribute.value,
            attributeDefinition: serializeAttributeDefinition(
                attribute.attributeDefinition,
            ),
        })),
    };
}

function entityDisplayName(entity: {
    id: number;
    attributes: {
        value: string | null;
        attributeDefinition: { category: string; name: string };
    }[];
    entityType: { label: string };
}) {
    return (
        entity.attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'label',
        )?.value ??
        entity.attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'name',
        )?.value ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValueByDefinitionId(
    entity: RawEntity,
    definitionId: number,
) {
    return entity.attributes.find(
        (attribute) => attribute.attributeDefinitionId === definitionId,
    )?.value;
}

function booleanAttributeValue(value: string) {
    return value === 'true' ? true : value === 'false' ? false : null;
}

function attributeSortValue(
    value: string | null | undefined,
    definition: DirectoryAttributeDefinition | undefined,
) {
    if (!value) {
        return null;
    }

    if (definition?.dataType === 'number') {
        const numberValue = Number(value);
        return Number.isNaN(numberValue) ? null : numberValue;
    }

    if (definition?.dataType === 'boolean') {
        return booleanAttributeValue(value);
    }

    return value;
}

function entitySortValue(
    entity: RawEntity,
    key: DirectoryEntityListSortKey,
    definitions: DirectoryAttributeDefinition[],
    inventoryByEntityId: Map<number, DirectoryEntityInventoryItem>,
) {
    if (key === 'name') {
        return entityDisplayName(entity);
    }

    if (key === 'inventory') {
        return inventoryByEntityId.get(entity.id)?.quantity ?? null;
    }

    if (key === 'updatedAt') {
        return entity.updatedAt.getTime();
    }

    const definitionId = Number(key.slice('attribute:'.length));
    const definition = definitions.find((item) => item.id === definitionId);
    const value = entityAttributeValueByDefinitionId(entity, definitionId);
    return attributeSortValue(value, definition);
}

function compareSortValues(
    left: string | number | boolean,
    right: string | number | boolean,
) {
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    if (typeof left === 'boolean' && typeof right === 'boolean') {
        return Number(left) - Number(right);
    }

    return String(left).localeCompare(String(right), 'hr', {
        numeric: true,
        sensitivity: 'base',
    });
}

function compareEntities(
    left: RawEntity,
    right: RawEntity,
    sort: DirectoryEntityListSort,
    definitions: DirectoryAttributeDefinition[],
    inventoryByEntityId: Map<number, DirectoryEntityInventoryItem>,
) {
    const leftValue = entitySortValue(
        left,
        sort.key,
        definitions,
        inventoryByEntityId,
    );
    const rightValue = entitySortValue(
        right,
        sort.key,
        definitions,
        inventoryByEntityId,
    );

    if (leftValue === null && rightValue === null) {
        return left.id - right.id;
    }

    if (leftValue === null) {
        return 1;
    }

    if (rightValue === null) {
        return -1;
    }

    const compared = compareSortValues(leftValue, rightValue);
    if (compared === 0) {
        return left.id - right.id;
    }

    return sort.direction === 'asc' ? compared : -compared;
}

async function getInventoryContext(entityTypeName: string) {
    const inventoryConfig =
        await getInventoryConfigByEntityTypeName(entityTypeName);
    const directInventoryItems = inventoryConfig
        ? await getInventoryItemsByConfig(inventoryConfig.id)
        : [];
    const entityType = await getEntityTypeByName(entityTypeName);
    const inventorySourceAttributeDefinition =
        entityType?.inventorySourceAttributeDefinitionId && !inventoryConfig
            ? await getAttributeDefinition(
                  entityType.inventorySourceAttributeDefinitionId,
              )
            : undefined;
    const shouldUseRelatedInventory =
        !inventoryConfig &&
        inventorySourceAttributeDefinition?.dataType ===
            `ref:${entityTypeName}`;
    const relatedInventoryConfig = shouldUseRelatedInventory
        ? await getInventoryConfigByEntityTypeName(
              inventorySourceAttributeDefinition.entityTypeName,
          )
        : undefined;
    const relatedInventoryItems =
        shouldUseRelatedInventory && relatedInventoryConfig
            ? aggregateRelatedInventoryItems({
                  defaultLowCountThreshold:
                      relatedInventoryConfig.lowCountThreshold,
                  sourceAttributeDefinitionId:
                      inventorySourceAttributeDefinition.id,
                  sourceEntities: await getEntitiesRaw(
                      inventorySourceAttributeDefinition.entityTypeName,
                  ),
                  inventoryItems: await getInventoryItemsByConfig(
                      relatedInventoryConfig.id,
                  ),
              })
            : [];
    const inventoryItems = inventoryConfig
        ? directInventoryItems
        : relatedInventoryItems;

    return {
        inventoryItems: inventoryItems.map((item) => ({
            entityId: item.entityId,
            quantity: item.quantity,
            lowCountThreshold: item.lowCountThreshold,
        })),
        inventoryLowCountThreshold: inventoryConfig?.lowCountThreshold ?? null,
        inventoryLinkConfig: inventoryConfig ?? relatedInventoryConfig,
        showInventoryColumn: Boolean(inventoryConfig ?? relatedInventoryConfig),
    };
}

async function getDirectoryEntityListBaseContext(
    entityTypeName: string,
): Promise<DirectoryEntityListBaseContext> {
    const [attributeDefinitions, inventoryContext] = await Promise.all([
        getAttributeDefinitions(entityTypeName),
        getInventoryContext(entityTypeName),
    ]);

    return {
        attributeDefinitions: attributeDefinitions.map(
            serializeAttributeDefinition,
        ),
        ...inventoryContext,
    };
}

async function getRefLabelsByDefinitionId(
    attributeDefinitions: DirectoryAttributeDefinition[],
) {
    const refDefinitions = attributeDefinitions.filter((definition) =>
        definition.dataType.startsWith('ref:'),
    );
    const refEntityTypes = Array.from(
        new Set(
            refDefinitions.map(
                (definition) => definition.dataType.split(':')[1],
            ),
        ),
    );
    const refEntitiesByType = await Promise.all(
        refEntityTypes.map(async (refEntityTypeName) => ({
            refEntityTypeName,
            entities: await getEntitiesRaw(refEntityTypeName, 'published'),
        })),
    );

    return Object.fromEntries(
        refDefinitions.map((definition) => {
            const refEntityTypeName = definition.dataType.split(':')[1];
            const refEntities =
                refEntitiesByType.find(
                    (entry) => entry.refEntityTypeName === refEntityTypeName,
                )?.entities ?? [];

            return [
                definition.id,
                Object.fromEntries(
                    refEntities.map((entity) => [
                        entity.id.toString(),
                        entityDisplayName(entity),
                    ]),
                ),
            ];
        }),
    );
}

async function getOperationFilterOptions(entityTypeName: string) {
    if (entityTypeName !== 'operation') {
        return [];
    }

    const operationEntities = await getEntitiesRaw('operation');

    return operationEntities
        .map(
            (entity): DirectoryEntityFilterOption => ({
                value: entity.id.toString(),
                label: entityDisplayName(entity),
            }),
        )
        .toSorted((left, right) =>
            left.label.localeCompare(right.label, 'hr', {
                numeric: true,
                sensitivity: 'base',
            }),
        );
}

export async function getDirectoryEntityListContext(
    entityTypeName: string,
): Promise<DirectoryEntityListContext> {
    const baseContext = await getDirectoryEntityListBaseContext(entityTypeName);
    const [refLabelsByDefinitionId, operationFilterOptions] = await Promise.all(
        [
            getRefLabelsByDefinitionId(baseContext.attributeDefinitions),
            getOperationFilterOptions(entityTypeName),
        ],
    );

    return {
        ...baseContext,
        refLabelsByDefinitionId,
        operationFilterOptions,
    };
}

function filteredDirectoryEntities({
    attributeDefinitions,
    completion,
    entities,
    entityTypeName,
    operationIds,
    search,
    state,
}: {
    attributeDefinitions: DirectoryAttributeDefinition[];
    completion?: string;
    entities: RawEntities;
    entityTypeName: string;
    operationIds?: number[];
    search?: string;
    state?: string;
}) {
    const statusFilteredEntities = filterEntitiesByCompletionAndState(
        entities,
        attributeDefinitions,
        {
            completion,
            state,
        },
    );
    const operationIdSet =
        entityTypeName === 'operation' && operationIds?.length
            ? new Set(operationIds)
            : null;
    const normalizedSearch = search?.trim().toLocaleLowerCase('hr') ?? '';

    return statusFilteredEntities.filter((entity) => {
        if (operationIdSet && !operationIdSet.has(entity.id)) {
            return false;
        }

        if (!normalizedSearch) {
            return true;
        }

        return entityDisplayName(entity)
            .toLocaleLowerCase('hr')
            .includes(normalizedSearch);
    });
}

export async function listDirectoryEntitiesPageFromContext({
    completion,
    context,
    entityTypeName,
    limit,
    offset = 0,
    operationIds,
    search,
    sort = defaultDirectoryEntityListSort,
    state,
}: {
    completion?: string;
    context: DirectoryEntityListBaseContext;
    entityTypeName: string;
    limit?: number;
    offset?: number;
    operationIds?: number[];
    search?: string;
    sort?: DirectoryEntityListSort;
    state?: string;
}): Promise<DirectoryEntityListPage> {
    const pageSize = normalizeLimit(limit);
    const entities = await getEntitiesRaw(entityTypeName);
    const inventoryByEntityId = new Map(
        context.inventoryItems
            .filter(
                (
                    item,
                ): item is DirectoryEntityInventoryItem & {
                    entityId: number;
                } => item.entityId !== null,
            )
            .map((item) => [item.entityId, item]),
    );
    const filteredEntities = filteredDirectoryEntities({
        attributeDefinitions: context.attributeDefinitions,
        completion,
        entities,
        entityTypeName,
        operationIds,
        search,
        state,
    });
    const sortedEntities = filteredEntities.toSorted((left, right) =>
        compareEntities(
            left,
            right,
            sort,
            context.attributeDefinitions,
            inventoryByEntityId,
        ),
    );
    const safeOffset = Math.max(0, Math.trunc(offset));
    const pageEntities = sortedEntities.slice(
        safeOffset,
        safeOffset + pageSize + 1,
    );
    const hasMore = pageEntities.length > pageSize;
    const visibleEntities = pageEntities.slice(0, pageSize);
    const visibleEntityIds = new Set(
        visibleEntities.map((entity) => entity.id),
    );

    return {
        entities: visibleEntities.map(serializeEntity),
        inventoryItems: context.inventoryItems.filter(
            (item) =>
                item.entityId !== null && visibleEntityIds.has(item.entityId),
        ),
        hasMore,
        nextOffset: hasMore ? safeOffset + pageSize : null,
        pageSize,
        totalCount: filteredEntities.length,
    };
}

export async function listDirectoryEntitiesPage({
    entityTypeName,
    ...options
}: Omit<
    Parameters<typeof listDirectoryEntitiesPageFromContext>[0],
    'context'
>) {
    const context = await getDirectoryEntityListBaseContext(entityTypeName);
    return listDirectoryEntitiesPageFromContext({
        ...options,
        context,
        entityTypeName,
    });
}
