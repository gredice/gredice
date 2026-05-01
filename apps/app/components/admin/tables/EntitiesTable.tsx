'use client';

import type {
    getEntitiesRaw,
    SelectAttributeDefinition,
} from '@gredice/storage';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Duplicate } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { useState } from 'react';
import { updateEntity } from '../../../app/(actions)/entityActions';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { EntityAttributeProgress } from '../directories/EntityAttributeProgress';
import { useFilter } from '../providers';
import { EntityTableStateChip } from './EntityTableStateChip';

type Entities = Awaited<ReturnType<typeof getEntitiesRaw>>;
type InventoryItem = {
    entityId: number | null;
    quantity: number;
};
type InventoryItemWithEntityId = InventoryItem & { entityId: number };
type SortDirection = 'asc' | 'desc';
type SortKey =
    | 'name'
    | 'inventory'
    | 'progress'
    | 'updatedAt'
    | `attribute:${number}`;
type SortState = {
    key: SortKey;
    direction: SortDirection;
};

const defaultSort: SortState = {
    key: 'updatedAt',
    direction: 'desc',
};

type EntitiesTableProps = {
    entityTypeName: string;
    entities: Entities;
    attributeDefinitions: SelectAttributeDefinition[];
    inventoryItems: InventoryItem[];
    onDuplicate: (entityId: number) => Promise<void>;
};

export function EntitiesTable({
    entityTypeName,
    entities,
    attributeDefinitions,
    inventoryItems,
    onDuplicate,
}: EntitiesTableProps) {
    const { filter } = useFilter();
    const [sort, setSort] = useState<SortState>(defaultSort);
    const normalized = filter.toLowerCase();
    const filteredEntities = entities.filter((entity) =>
        entityDisplayName(entity).toLowerCase().includes(normalized),
    );
    const displayDefinitions = attributeDefinitions.filter((d) => d.display);
    const inventoryByEntityId = new Map(
        inventoryItems
            .filter(
                (item): item is typeof item & { entityId: number } =>
                    item.entityId !== null,
            )
            .map((item) => [item.entityId, item]),
    );
    const hasInventory = inventoryByEntityId.size > 0;
    const sortedEntities = [...filteredEntities].sort((left, right) =>
        compareEntities(
            left,
            right,
            sort,
            attributeDefinitions,
            inventoryByEntityId,
        ),
    );

    function handleSort(key: SortKey) {
        setSort((current) => ({
            key,
            direction:
                current.key === key && current.direction === 'asc'
                    ? 'desc'
                    : 'asc',
        }));
    }

    function sortableHead(key: SortKey, label: string, headKey?: number) {
        const isSorted = sort.key === key;
        const directionLabel = sort.direction === 'asc' ? 'uzlazno' : 'silazno';

        return (
            <Table.Head
                key={headKey}
                aria-sort={
                    isSorted
                        ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                        : 'none'
                }
            >
                <button
                    type="button"
                    className="flex items-center gap-1 text-left font-medium"
                    onClick={() => handleSort(key)}
                    title={`Sortiraj ${label.toLowerCase()}`}
                >
                    <span>{label}</span>
                    {isSorted && (
                        <>
                            <span aria-hidden>
                                {sort.direction === 'asc' ? '↑' : '↓'}
                            </span>
                            <span className="sr-only">
                                Sortirano {directionLabel}
                            </span>
                        </>
                    )}
                </button>
            </Table.Head>
        );
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    {sortableHead('name', 'Naziv')}
                    {displayDefinitions.map((d) =>
                        sortableHead(`attribute:${d.id}`, d.label, d.id),
                    )}
                    {hasInventory && sortableHead('inventory', 'Zalihe')}
                    {sortableHead('progress', 'Ispunjeno')}
                    {sortableHead('updatedAt', 'Izmjene')}
                    <Table.Head></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!sortedEntities.length && (
                    <Table.Row>
                        <Table.Cell
                            colSpan={
                                4 +
                                displayDefinitions.length +
                                (hasInventory ? 1 : 0)
                            }
                        >
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {sortedEntities.map((entity) => {
                    const inventoryItem = inventoryByEntityId.get(entity.id);

                    return (
                        <Table.Row key={entity.id} className="group">
                            <Table.Cell>
                                <div className="flex items-center gap-2">
                                    <EntityTableStateChip
                                        initialState={entity.state}
                                        onPublish={() =>
                                            updateEntity({
                                                id: entity.id,
                                                state: 'published',
                                            })
                                        }
                                    />
                                    <Link
                                        href={KnownPages.DirectoryEntity(
                                            entityTypeName,
                                            entity.id,
                                        )}
                                    >
                                        <Typography>
                                            {entityDisplayName(entity)}
                                        </Typography>
                                    </Link>
                                </div>
                            </Table.Cell>
                            {displayDefinitions.map((d) => (
                                <Table.Cell key={d.id}>
                                    <EntityAttributeValueCell
                                        entity={entity}
                                        definition={d}
                                    />
                                </Table.Cell>
                            ))}
                            {hasInventory && (
                                <Table.Cell>
                                    <Typography secondary>
                                        {inventoryItem?.quantity ?? 0}
                                    </Typography>
                                </Table.Cell>
                            )}
                            <Table.Cell>
                                <div className="w-20">
                                    <EntityAttributeProgress
                                        entity={entity}
                                        definitions={attributeDefinitions}
                                    />
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography secondary>
                                    <LocalDateTime time={false}>
                                        {entity.updatedAt}
                                    </LocalDateTime>
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <ServerActionIconButton
                                    variant="plain"
                                    title="Dupliciraj zapis"
                                    className="group-hover:opacity-100 opacity-0 transition-opacity"
                                    onClick={onDuplicate.bind(null, entity.id)}
                                >
                                    <Duplicate className="size-5" />
                                </ServerActionIconButton>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}

function EntityAttributeValueCell({
    entity,
    definition,
}: {
    entity: Entities[number];
    definition: SelectAttributeDefinition;
}) {
    const value = entityAttributeValueByDefinitionId(entity, definition.id);
    if (!value) {
        return <Typography secondary>-</Typography>;
    }

    if (definition.dataType === 'boolean') {
        const booleanValue = booleanAttributeValue(value);
        if (booleanValue !== null) {
            return (
                <Chip
                    color={booleanValue ? 'primary' : 'neutral'}
                    className="w-fit"
                    size="sm"
                >
                    {booleanValue ? 'Da' : 'Ne'}
                </Chip>
            );
        }
    }

    if (definition.dataType === 'image') {
        const imageUrl = imageAttributeValue(value);
        if (imageUrl) {
            return (
                <ImageViewer
                    src={imageUrl}
                    alt={definition.label}
                    previewWidth={40}
                    previewHeight={40}
                />
            );
        }
    }

    return <Typography secondary>{value}</Typography>;
}

function compareEntities(
    left: Entities[number],
    right: Entities[number],
    sort: SortState,
    definitions: SelectAttributeDefinition[],
    inventoryByEntityId: Map<number, InventoryItemWithEntityId>,
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

function entitySortValue(
    entity: Entities[number],
    key: SortKey,
    definitions: SelectAttributeDefinition[],
    inventoryByEntityId: Map<number, InventoryItemWithEntityId>,
) {
    if (key === 'name') {
        return entityDisplayName(entity);
    }

    if (key === 'inventory') {
        return inventoryByEntityId.get(entity.id)?.quantity ?? null;
    }

    if (key === 'progress') {
        return entityAttributeProgress(entity, definitions);
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

function attributeSortValue(
    value: string | null | undefined,
    definition: SelectAttributeDefinition | undefined,
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

function entityAttributeProgress(
    entity: Entities[number],
    definitions: SelectAttributeDefinition[],
) {
    const requiredDefinitions = definitions.filter((d) => d.required);
    if (!requiredDefinitions.length) {
        return 100;
    }

    const missingRequiredDefinitions = requiredDefinitions.filter(
        (d) =>
            !d.defaultValue &&
            !entity.attributes.some(
                (a) =>
                    a.attributeDefinitionId === d.id &&
                    (a.value?.length ?? 0) > 0,
            ),
    );

    return (
        ((requiredDefinitions.length - missingRequiredDefinitions.length) /
            requiredDefinitions.length) *
        100
    );
}

function entityDisplayName(entity: Entities[number]) {
    return (
        entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValue(
    entity: Entities[number],
    categoryName: string,
    attributeName: string,
) {
    return entity.attributes.find(
        (a) =>
            a.attributeDefinition.category === categoryName &&
            a.attributeDefinition.name === attributeName,
    )?.value;
}

function entityAttributeValueByDefinitionId(
    entity: Entities[number],
    definitionId: number,
) {
    return entity.attributes.find(
        (a) => a.attributeDefinitionId === definitionId,
    )?.value;
}

function imageAttributeValue(value: string) {
    try {
        const data = JSON.parse(value);
        if (data && typeof data.url === 'string') {
            return data.url;
        }
    } catch {
        // ignored intentionally
    }

    return null;
}

function booleanAttributeValue(value: string) {
    return value === 'true' ? true : value === 'false' ? false : null;
}
